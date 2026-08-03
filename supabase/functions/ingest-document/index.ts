// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseDocument } from '../_shared/documentParser.ts';
import { generateEmbeddingsBatch } from '../_shared/embeddingService.ts';

serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('EXPO_PUBLIC_GEMINI_API_KEY') || '';
    if (!apiKey) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Missing documentId in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = getServiceClient();

    // 1. Fetch document metadata
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: `Document not found in database: ${docError?.message}` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Ingest] Processing document: ${document.title} (${document.filename})`);

    // Check for previous uploads of the same filename by this user to handle versioning
    if (document.uploaded_by) {
      const { data: existingDocs } = await supabaseAdmin
        .from('documents')
        .select('id, version')
        .eq('filename', document.filename)
        .eq('uploaded_by', document.uploaded_by)
        .neq('id', document.id) // exclude current document row
        .order('version', { ascending: false });

      if (existingDocs && existingDocs.length > 0) {
        // Versioning: Increment version based on highest existing version
        const latestVersion = existingDocs[0].version;
        const newVersion = latestVersion + 1;
        
        await supabaseAdmin
          .from('documents')
          .update({ version: newVersion })
          .eq('id', document.id);
          
        console.log(`[Ingest] Incremented version of ${document.filename} to v${newVersion}`);

        // Cleanup: We can choose to delete old versions or keep them.
        // For standard storage optimization, we delete old versions chunks & documents
        // to avoid duplicate semantic search hits.
        const oldDocIds = existingDocs.map(d => d.id);
        
        // Suppress old docs from search or delete old docs
        await supabaseAdmin.from('documents').delete().in('id', oldDocIds);
        console.log(`[Ingest] Cleaned up ${oldDocIds.length} older version document records and chunks.`);
      }
    }

    // 2. Download file from storage
    const { data: fileBuffer, error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .download(document.storage_path);

    if (storageError || !fileBuffer) {
      return new Response(
        JSON.stringify({ error: `Failed to download file from Storage: ${storageError?.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileBuffer.arrayBuffer();

    // 3. Extract text and chunk
    console.log(`[Ingest] Extracting text and chunking...`);
    const chunks = await parseDocument(arrayBuffer, document.file_type, document.filename, {
      document_id: document.id,
      uploaded_by: document.uploaded_by,
    });

    if (chunks.length === 0) {
      console.warn(`[Ingest] Document generated 0 text chunks.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Document parsed successfully but no indexable text was found.',
          chunksCount: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Ingest] Split into ${chunks.length} chunks. Generating embeddings...`);

    // 4. Generate embeddings in batches
    const chunkTexts = chunks.map((c) => c.chunk_text);
    const vectors = await generateEmbeddingsBatch(chunkTexts, apiKey);

    // 5. Save chunks to database
    console.log(`[Ingest] Storing chunks and embeddings into database...`);
    const dbRecords = chunks.map((chunk, index) => ({
      document_id: document.id,
      chunk_text: chunk.chunk_text,
      embedding: vectors[index],
      page_number: chunk.page_number || null,
      section: chunk.section || null,
      metadata: chunk.metadata,
    }));

    // Insert database records
    const { error: insertError } = await supabaseAdmin
      .from('document_chunks')
      .insert(dbRecords);

    if (insertError) {
      console.error(`[Ingest] Database insertion error:`, insertError);
      throw new Error(`Failed to insert document chunks into database: ${insertError.message}`);
    }

    console.log(`[Ingest] Ingestion completed. Successfully processed ${chunks.length} chunks.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully ingested document with ${chunks.length} chunks.`,
        chunksCount: chunks.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error(`[Ingest Error]`, error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown ingestion error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
