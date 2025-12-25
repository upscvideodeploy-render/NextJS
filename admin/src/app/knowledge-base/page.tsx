'use client';

import { useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';

interface PdfUpload {
  id: string;
  title: string;
  topic: string;
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_created: number;
  uploaded_at: string;
  processing_errors: string | null;
}

export default function KnowledgeBasePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [uploads, setUploads] = useState<PdfUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState({
    topic: '',
    author: '',
    edition: '',
    priority: 50,
  });

  // Fetch uploads
  const fetchUploads = async () => {
    const { data, error } = await supabase
      .from('pdf_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setUploads(data as PdfUpload[]);
    }
  };

  // Initial fetch
  useState(() => {
    fetchUploads();
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!metadata.topic) {
      alert('Please select a subject');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(Math.round(((i + 0.5) / selectedFiles.length) * 100));

      try {
        // Upload to Supabase Storage
        const filePath = `knowledge-base/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('knowledge-base-pdfs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create database record
        const { data: uploadRecord, error: dbError } = await supabase
          .from('pdf_uploads')
          .insert({
            title: file.name,
            topic: metadata.topic,
            source: metadata.author || 'Unknown',
            status: 'pending',
            file_size_bytes: file.size,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Trigger processing via Edge Function
        await supabase.functions.invoke('process_pdf_job', {
          body: { pdf_upload_id: uploadRecord.id },
        });

      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
      }

      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
    }

    setIsUploading(false);
    setSelectedFiles([]);
    fetchUploads();
  };

  const handleReprocess = async (uploadId: string) => {
    await supabase.functions.invoke('process_pdf_job', {
      body: { pdf_upload_id: uploadId },
    });
    fetchUploads();
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base Management</h1>
        <p className="text-gray-400">Upload and manage PDF documents for the RAG knowledge base</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="neon-glass p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">Upload PDFs</h2>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-neon-blue bg-neon-blue/10'
                  : 'border-white/20 hover:border-neon-blue/50'
              }`}
            >
              <input {...getInputProps()} />
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isDragActive ? (
                <p className="text-neon-blue">Drop files here...</p>
              ) : (
                <>
                  <p className="text-gray-300 mb-2">Drag & drop PDFs here</p>
                  <p className="text-sm text-gray-500">Max 500MB per file</p>
                </>
              )}
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">{selectedFiles.length} file(s) selected:</p>
                <ul className="space-y-2">
                  {selectedFiles.map((file, i) => (
                    <li key={i} className="text-sm text-gray-300 truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata Form */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={metadata.topic}
                  onChange={(e) => setMetadata({ ...metadata, topic: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select subject...</option>
                  <option value="Polity">Polity</option>
                  <option value="History">History</option>
                  <option value="Geography">Geography</option>
                  <option value="Economy">Economy</option>
                  <option value="Environment">Environment</option>
                  <option value="Science & Tech">Science & Tech</option>
                  <option value="International Relations">International Relations</option>
                  <option value="Ethics">Ethics</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Author</label>
                <input
                  type="text"
                  value={metadata.author}
                  onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                  placeholder="e.g., Laxmikanth"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Edition</label>
                <input
                  type="text"
                  value={metadata.edition}
                  onChange={(e) => setMetadata({ ...metadata, edition: e.target.value })}
                  placeholder="e.g., 6th Edition"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority: {metadata.priority}</label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={metadata.priority}
                  onChange={(e) => setMetadata({ ...metadata, priority: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>

        {/* Uploads Table */}
        <div className="lg:col-span-2">
          <div className="neon-glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Uploaded Documents</h2>
              <button
                onClick={fetchUploads}
                className="px-4 py-2 text-sm text-neon-blue hover:bg-neon-blue/10 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4">Subject</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Chunks</th>
                    <th className="pb-3 pr-4">Uploaded</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-4 text-white truncate max-w-xs" title={upload.title}>
                        {upload.title}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{upload.topic}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(upload.status)}`}>
                          {upload.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{upload.chunks_created || '-'}</td>
                      <td className="py-3 pr-4 text-gray-400 text-sm">
                        {format(new Date(upload.uploaded_at), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3">
                        {upload.status === 'failed' && (
                          <button
                            onClick={() => handleReprocess(upload.id)}
                            className="px-3 py-1 text-xs text-neon-blue hover:bg-neon-blue/10 rounded"
                          >
                            Reprocess
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {uploads.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No documents uploaded yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
