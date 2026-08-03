import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { logger } from './logger';

const lookup = new Uint8Array(256);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let bufferLength = base64.length * 0.75;
  const len = base64.length;
  
  if (base64[len - 1] === '=') {
    bufferLength--;
    if (base64[len - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return arrayBuffer;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  filename: string;
  storage_path: string;
  uploaded_by: string;
  file_type: string;
  version: number;
  created_at: string;
}

export const documentService = {
  /**
   * Uploads any supported document (PDF, Word, spreadsheet, text) to Supabase Storage
   * and triggers the ingestion pipeline edge function.
   */
  async uploadDocument(
    fileUri: string,
    fileName: string,
    fileType: string,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<DocumentMetadata> {
    if (!fileUri) throw new Error('File URI is required for upload');
    
    // 1. Upload file binary to Supabase Storage
    const cleanedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `${userId}/${Date.now()}-${cleanedFileName}`;
    
    let fileBody: ArrayBuffer | Blob;
    
    if (Platform.OS === 'web' || fileUri.startsWith('data:') || fileUri.startsWith('http')) {
      const response = await fetch(fileUri);
      fileBody = await response.blob();
    } else {
      // Native FileSystem read to base64
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });
      fileBody = base64ToArrayBuffer(base64);
    }

    onProgress?.(0.3); // Upload started

    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBody, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: true,
      });

    if (storageError) {
      logger.error('Failed to upload document to Storage', storageError);
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    onProgress?.(0.6); // Upload complete, registering in DB

    // 2. Insert document row to Database
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        title: fileName.replace(/\.[^/.]+$/, ""), // file title without extension
        filename: fileName,
        storage_path: storageData.path,
        uploaded_by: userId,
        file_type: fileType,
        version: 1,
      })
      .select('*')
      .single();

    if (docError || !docRecord) {
      // Cleanup uploaded file from storage if db registration failed
      await supabase.storage.from('documents').remove([storagePath]);
      logger.error('Failed to register document in Database', docError);
      throw new Error(`Database registration failed: ${docError?.message}`);
    }

    onProgress?.(0.8); // Processing vector indexing

    // 3. Trigger Ingestion Edge Function
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'ingest-document',
        {
          body: { documentId: docRecord.id },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (functionData?.error) {
        throw new Error(functionData.error);
      }
    } catch (ingestError: any) {
      logger.error('Document ingestion edge function failed, cleaning up metadata', ingestError);
      // Delete document record & file so user can retry clean
      await supabase.from('documents').delete().eq('id', docRecord.id);
      await supabase.storage.from('documents').remove([storagePath]);
      throw new Error(`Document parsing failed: ${ingestError.message || ingestError}`);
    }

    onProgress?.(1.0); // Complete
    return docRecord as DocumentMetadata;
  },

  /**
   * Fetches all uploaded documents for the active user.
   */
  async getDocuments(userId: string): Promise<DocumentMetadata[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('uploaded_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to retrieve user documents', error);
      throw error;
    }

    return (data || []) as DocumentMetadata[];
  },

  /**
   * Deletes a document record and its associated storage file.
   * Cascade RLS & DB constraints will delete chunks automatically.
   */
  async deleteDocument(documentId: string, storagePath: string): Promise<void> {
    // 1. Delete row from Database (cascade deletes document_chunks)
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      logger.error('Failed to delete document from database', dbError);
      throw dbError;
    }

    // 2. Remove file from Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([storagePath]);

    if (storageError) {
      logger.warn('Failed to delete document file from Storage', storageError);
    }
  },
};
