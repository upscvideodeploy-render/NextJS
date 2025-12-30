/**
 * API Route: /api/pyqs/upload
 * Story 8.1: PYQ PDF Upload
 * 
 * Handles PDF upload to Supabase storage and creates paper record
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const year = formData.get('year') as string;
    const paperType = formData.get('paper_type') as string;

    // Validation
    if (!file || !year || !paperType) {
      return NextResponse.json(
        { error: 'file, year, and paper_type are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `pyqs/${year}/${paperType}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Create paper record
    const { data: paper, error: dbError } = await supabase
      .from('pyq_papers')
      .insert({
        year: parseInt(year),
        paper_type: paperType,
        file_url: fileUrl,
        status: 'pending',
        progress: 0
      })
      .select('id')
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      paper_id: paper.id,
      file_url: fileUrl,
      message: 'Upload successful. Paper is pending OCR processing.'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
