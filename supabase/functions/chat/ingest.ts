// @ts-nocheck
import { parseDocument } from '../_shared/documentParser.ts';
import { generateEmbeddingsBatch } from '../_shared/embeddingService.ts';
import { EMBEDDED_ASSETS } from './assets/embeddedAssets.ts';

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Global variable to cache ingestion status during container lifetime
let isIngested = false;

async function getFileHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function ensureIngested(supabaseAdmin: any, apiKey: string) {
  if (isIngested) {
    return;
  }

  try {
    const documentsToIngest = [
      {
        filename: 'spendly-qna.csv',
        title: 'Spendly FAQ & QnA Guide',
        url: new URL('./assets/spendly-qna.csv', import.meta.url),
        type: 'csv'
      },
      {
        filename: 'spendly-knowlege-base.pdf',
        title: 'Spendly App Knowledge Base',
        url: new URL('./assets/spendly-knowlege-base.pdf', import.meta.url),
        type: 'pdf'
      }
    ];

    for (const docInfo of documentsToIngest) {
      // 1. Read local file from assets, falling back to embedded assets if Deno.readFile path is missing in runtime
      let fileBytes: Uint8Array;
      try {
        fileBytes = await Deno.readFile(docInfo.url);
      } catch (_readErr) {
        if (EMBEDDED_ASSETS[docInfo.filename]) {
          fileBytes = base64ToUint8Array(EMBEDDED_ASSETS[docInfo.filename]);
        } else {
          console.error(`[Ingest Error] Failed to read local file ${docInfo.filename} and no embedded fallback found.`);
          continue;
        }
      }
      
      // 2. Calculate SHA-256 hash to detect changes
      const fileHash = await getFileHash(fileBytes);

      // 3. Check if document already exists with this hash
      const { data: existingDoc, error: queryError } = await supabaseAdmin
        .from('documents')
        .select('id, storage_path')
        .eq('filename', docInfo.filename)
        .is('uploaded_by', null) // filter by global system documents
        .maybeSingle();

      if (queryError) {
        console.error(`[Ingest Error] Failed to query documents for ${docInfo.filename}:`, queryError);
        continue;
      }

      // If document already exists and has the same hash, skip ingestion
      if (existingDoc && existingDoc.storage_path === fileHash) {
        console.log(`[Ingest] Document ${docInfo.filename} is up to date (hash: ${fileHash}). Skipping.`);
        continue;
      }

      console.log(`[Ingest] Document ${docInfo.filename} changed or missing. Ingesting...`);

      // 4. If an old document exists, delete it (cascade will delete its chunks)
      if (existingDoc) {
        const { error: deleteError } = await supabaseAdmin
          .from('documents')
          .delete()
          .eq('id', existingDoc.id);
        
        if (deleteError) {
          console.error(`[Ingest Error] Failed to delete existing document ${docInfo.filename}:`, deleteError);
          continue;
        }
      }

      // 5. Create new document entry
      const { data: newDoc, error: insertError } = await supabaseAdmin
        .from('documents')
        .insert({
          title: docInfo.title,
          filename: docInfo.filename,
          storage_path: fileHash, // store the hash in storage_path
          uploaded_by: null,      // global/system document
          file_type: docInfo.type,
          version: 1
        })
        .select('id')
        .single();

      if (insertError || !newDoc) {
        console.error(`[Ingest Error] Failed to insert document metadata for ${docInfo.filename}:`, insertError);
        continue;
      }

      // 6. Parse document into chunks
      const chunks = await parseDocument(fileBytes.buffer, docInfo.type, docInfo.filename, {
        document_id: newDoc.id
      });

      if (!chunks || chunks.length === 0) {
        console.warn(`[Ingest Warning] No chunks parsed from ${docInfo.filename}.`);
        continue;
      }

      console.log(`[Ingest] Parsed ${chunks.length} chunks from ${docInfo.filename}. Generating embeddings...`);

      // 7. Generate embeddings in batches and insert chunks
      const chunkTexts = chunks.map(c => c.chunk_text);
      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddingsBatch(chunkTexts, apiKey);
      } catch (embErr) {
        console.error(`[Ingest Error] Failed to generate embeddings for ${docInfo.filename}:`, embErr);
        // Clean up partially created document metadata so we retry next time
        await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
        continue;
      }

      // Prepare chunks for insertion
      const chunksToInsert = chunks.map((chunk, index) => ({
        document_id: newDoc.id,
        chunk_text: chunk.chunk_text,
        embedding: embeddings[index],
        page_number: chunk.page_number || null,
        section: chunk.section || null,
        metadata: chunk.metadata || {}
      }));

      // Insert chunks in batches to avoid payload size limit
      const BATCH_SIZE = 100;
      let batchFailed = false;
      for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
        const batch = chunksToInsert.slice(i, i + BATCH_SIZE);
        const { error: chunksInsertError } = await supabaseAdmin
          .from('document_chunks')
          .insert(batch);
        
        if (chunksInsertError) {
          console.error(`[Ingest Error] Failed to insert document chunks batch for ${docInfo.filename}:`, chunksInsertError);
          batchFailed = true;
          break;
        }
      }

      if (batchFailed) {
        // Clean up partially created document metadata so we retry next time
        await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
        continue;
      }

      console.log(`[Ingest] Document ${docInfo.filename} successfully ingested with ${chunksToInsert.length} chunks.`);
    }

    isIngested = true;
  } catch (err: any) {
    console.error(`[Ingest Error] Global ingestion failed:`, err);
  }
}
