/**
 * API Route: /api/knowledge-base/process
 * Story 1.6: PDF Processing & Chunking Pipeline
 * 
 * Processes pending PDF uploads:
 * - Extracts text from PDF
 * - Chunks text into semantic blocks
 * - Generates embeddings via A4F API
 * - Stores in knowledge_chunks table
 * - Sends to VPS Document Retriever for RAG search
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for admin operations
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// VPS Document Retriever URL
const VPS_RAG_URL = process.env.VPS_RAG_URL || 'http://89.117.60.144:8101';

// A4F Embedding Configuration
const A4F_API_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const A4F_EMBEDDING_MODEL = process.env.A4F_EMBEDDING_MODEL || 'provider-5/text-embedding-ada-002';

// Chunk configuration
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

interface ProcessingResult {
  pdfUploadId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

// Extract text from PDF using pdf-parse
async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import of pdf-parse
  const pdfParse = await import('pdf-parse');
  const data = await pdfParse.default(Buffer.from(pdfBuffer));
  return data.text;
}

// Chunk text into semantic blocks
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  
  // Clean the text
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }
  
  // Split by paragraphs first, then by sentences
  const paragraphs = cleanText.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      // Save current chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Add overlap from end of current chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        // Paragraph itself is too long, split by sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk.length > 0) {
              chunks.push(currentChunk.trim());
              currentChunk = currentChunk.slice(-overlap) + ' ' + sentence;
            } else {
              // Even sentence is too long, force split
              chunks.push(sentence.substring(0, chunkSize));
              currentChunk = sentence.substring(chunkSize - overlap);
            }
          }
        }
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate embeddings via A4F API
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches of 20
  const batchSize = 20;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    const response = await fetch(`${A4F_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A4F_API_KEY}`,
      },
      body: JSON.stringify({
        model: A4F_EMBEDDING_MODEL,
        input: batch,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }
    
    const data = await response.json();
    for (const item of data.data) {
      embeddings.push(item.embedding);
    }
  }
  
  return embeddings;
}

// Send document to VPS RAG service
async function addToRAGService(docId: string, content: string, metadata: Record<string, unknown>): Promise<void> {
  const params = new URLSearchParams({
    doc_id: docId,
    content: content.substring(0, 10000), // Limit content size
  });
  
  const response = await fetch(`${VPS_RAG_URL}/documents/add?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  
  if (!response.ok) {
    console.warn(`RAG service warning: ${response.status}`);
    // Don't fail if RAG service is unavailable
  }
}

// Process a single PDF
async function processPdf(supabase: ReturnType<typeof getSupabaseClient>, uploadId: string): Promise<ProcessingResult> {
  try {
    // Update status to processing
    await supabase
      .from('pdf_uploads')
      .update({ upload_status: 'processing' })
      .eq('id', uploadId);
    
    // Get upload record
    const { data: upload, error: fetchError } = await supabase
      .from('pdf_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();
    
    if (fetchError || !upload) {
      throw new Error(`PDF upload not found: ${uploadId}`);
    }
    
    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('knowledge-base-pdfs')
      .download(upload.storage_path);
    
    if (downloadError || !pdfData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }
    
    // Extract text
    const pdfBuffer = await pdfData.arrayBuffer();
    const text = await extractTextFromPdf(pdfBuffer);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from PDF');
    }
    
    // Chunk the text
    const chunks = chunkText(text);
    console.log(`Created ${chunks.length} chunks from ${upload.filename}`);
    
    // Generate embeddings
    let embeddings: number[][] = [];
    try {
      embeddings = await generateEmbeddings(chunks);
    } catch (embError) {
      console.warn('Embedding generation failed, storing without vectors:', embError);
      // Continue without embeddings - can be generated later
    }
    
    // Store chunks in database
    const chunkRecords = chunks.map((chunk, index) => ({
      pdf_upload_id: uploadId,
      chunk_text: chunk,
      content_vector: embeddings[index] ? `[${embeddings[index].join(',')}]` : null,
      source_page: Math.floor(index / 2) + 1, // Approximate page number
      chunk_index: index,
      metadata: {
        filename: upload.filename,
        subject: upload.subject,
        book_title: upload.book_title,
        author: upload.author,
        edition: upload.edition,
      },
    }));
    
    // Insert in batches
    const insertBatchSize = 50;
    for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
      const batch = chunkRecords.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('knowledge_chunks')
        .insert(batch);
      
      if (insertError) {
        console.error('Chunk insert error:', insertError);
        // Continue with remaining chunks
      }
    }
    
    // Also add to VPS RAG service
    try {
      await addToRAGService(
        `pdf-${uploadId}`,
        chunks.join('\n\n---\n\n'),
        {
          source: 'pdf_upload',
          pdf_upload_id: uploadId,
          filename: upload.filename,
          subject: upload.subject,
          book_title: upload.book_title,
          author: upload.author,
        }
      );
    } catch (ragError) {
      console.warn('RAG service update failed:', ragError);
      // Don't fail the whole process
    }
    
    // Update upload status to completed
    await supabase
      .from('pdf_uploads')
      .update({
        upload_status: 'completed',
        chunks_created: chunks.length,
        processing_errors: null,
      })
      .eq('id', uploadId);
    
    return {
      pdfUploadId: uploadId,
      chunksCreated: chunks.length,
      success: true,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update status to failed
    await supabase
      .from('pdf_uploads')
      .update({
        upload_status: 'failed',
        processing_errors: errorMessage,
      })
      .eq('id', uploadId);
    
    return {
      pdfUploadId: uploadId,
      chunksCreated: 0,
      success: false,
      error: errorMessage,
    };
  }
}

// POST: Process pending PDFs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdf_upload_id } = body;
    
    const supabase = getSupabaseClient();
    
    // If specific ID provided, process only that one
    if (pdf_upload_id) {
      const result = await processPdf(supabase, pdf_upload_id);
      return NextResponse.json(result);
    }
    
    // Otherwise, process all pending PDFs
    const { data: pendingUploads, error: fetchError } = await supabase
      .from('pdf_uploads')
      .select('id')
      .eq('upload_status', 'pending')
      .limit(10); // Process max 10 at a time
    
    if (fetchError) {
      throw new Error(`Failed to fetch pending uploads: ${fetchError.message}`);
    }
    
    if (!pendingUploads || pendingUploads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending PDFs to process',
        results: [],
      });
    }
    
    // Process each PDF
    const results: ProcessingResult[] = [];
    for (const upload of pendingUploads) {
      const result = await processPdf(supabase, upload.id);
      results.push(result);
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
    
  } catch (error) {
    console.error('PDF processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}

// GET: Check processing status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('upload_id');
  
  const supabase = getSupabaseClient();
  
  if (uploadId) {
    // Get specific upload status
    const { data, error } = await supabase
      .from('pdf_uploads')
      .select('id, filename, upload_status, chunks_created, processing_errors')
      .eq('id', uploadId)
      .single();
    
    if (error) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  }
  
  // Get summary of all uploads
  const { data: stats, error: statsError } = await supabase
    .from('pdf_uploads')
    .select('upload_status');
  
  if (statsError) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
  
  const summary = {
    total: stats?.length || 0,
    pending: stats?.filter(s => s.upload_status === 'pending').length || 0,
    processing: stats?.filter(s => s.upload_status === 'processing').length || 0,
    completed: stats?.filter(s => s.upload_status === 'completed').length || 0,
    failed: stats?.filter(s => s.upload_status === 'failed').length || 0,
  };
  
  return NextResponse.json(summary);
}
