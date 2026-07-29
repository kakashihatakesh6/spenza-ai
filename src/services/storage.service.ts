import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
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

export const storageService = {
  /**
   * Uploads an image file to Supabase receipts bucket.
   * Compresses the image natively first if possible.
   */
  async uploadReceipt(fileUri: string, userId: string): Promise<string> {
    if (!fileUri) throw new Error('File URI is required for upload');

    let processedUri = fileUri;

    // Compressing native images before upload
    if (Platform.OS !== 'web' && !fileUri.startsWith('data:') && !fileUri.startsWith('http')) {
      try {
        const manipulateResult = await ImageManipulator.manipulateAsync(
          fileUri,
          [{ resize: { width: 1000 } }], // Resize down to 1000px width limit
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = manipulateResult.uri;
      } catch (compressError) {
        logger.warn('Failed to compress image before upload, using original', compressError);
      }
    }

    // 1. Generate a unique filename under user's directory
    const fileExt = processedUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    let fileBody: ArrayBuffer | Blob;

    if (Platform.OS === 'web' || processedUri.startsWith('data:') || processedUri.startsWith('http')) {
      const response = await fetch(processedUri);
      fileBody = await response.blob();
    } else {
      // Native FileSystem read to base64
      const base64 = await FileSystem.readAsStringAsync(processedUri, {
        encoding: 'base64',
      });
      fileBody = base64ToArrayBuffer(base64);
    }

    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, fileBody, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get the public URL of the uploaded receipt
    const { data: publicUrlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  },

  /**
   * Helper to ensure the profile-pics bucket exists in Supabase.
   * If it already exists, Supabase will return a 409 or error, which we log/ignore.
   */
  async ensureProfilePicsBucket(): Promise<void> {
    try {
      const { error } = await supabase.storage.createBucket('profile-pics', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      });
      if (error) {
        logger.info('Bucket "profile-pics" status check', { message: error.message });
      } else {
        logger.info('Bucket "profile-pics" created successfully');
      }
    } catch (e) {
      logger.warn('Failed to ensure profile-pics bucket', e);
    }
  },

  /**
   * Uploads an avatar image file to Supabase storage.
   * Compresses the image natively first if possible.
   * Self-healing: if 'profile-pics' bucket fails, falls back to 'receipts' under avatars/ prefix.
   */
  async uploadAvatar(fileUri: string, userId: string): Promise<string> {
    if (!fileUri) throw new Error('File URI is required for upload');

    // Attempt to ensure the bucket exists first
    await this.ensureProfilePicsBucket();

    let processedUri = fileUri;

    // Compressing native images before upload
    if (Platform.OS !== 'web' && !fileUri.startsWith('data:') && !fileUri.startsWith('http')) {
      try {
        const manipulateResult = await ImageManipulator.manipulateAsync(
          fileUri,
          [{ resize: { width: 400 } }], // Resize down to 400px for avatar
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = manipulateResult.uri;
      } catch (compressError) {
        logger.warn('Failed to compress avatar before upload, using original', compressError);
      }
    }

    // 1. Generate a unique filename under user's directory
    const fileExt = processedUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    let fileBody: ArrayBuffer | Blob;

    if (Platform.OS === 'web' || processedUri.startsWith('data:') || processedUri.startsWith('http')) {
      const response = await fetch(processedUri);
      fileBody = await response.blob();
    } else {
      // Native FileSystem read to base64
      const base64 = await FileSystem.readAsStringAsync(processedUri, {
        encoding: 'base64',
      });
      fileBody = base64ToArrayBuffer(base64);
    }

    // Try to upload to 'profile-pics' bucket first
    let bucketName = 'profile-pics';
    let uploadResult = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBody, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    // If 'profile-pics' bucket upload fails (e.g. bucket doesn't exist/unauthorized), fallback to 'receipts' under avatars/ prefix
    if (uploadResult.error) {
      logger.warn(`Upload to bucket failed, falling back to receipts bucket`, { bucketName, error: uploadResult.error.message });
      bucketName = 'receipts';
      // Store in receipts bucket under avatars/ folder structure
      const fallbackFileName = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      uploadResult = await supabase.storage
        .from(bucketName)
        .upload(fallbackFileName, fileBody, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadResult.error) {
        throw uploadResult.error;
      }
    }

    // Get the public URL of the uploaded avatar
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadResult.data.path);

    return publicUrlData.publicUrl;
  },

  /**
   * Deletes a receipt image from Supabase storage using its public URL.
   */
  async deleteReceipt(publicUrl: string): Promise<void> {
    if (!publicUrl) return;

    try {
      // URL format: https://.../storage/v1/object/public/receipts/userId/filename
      const parts = publicUrl.split('/receipts/');
      if (parts.length < 2) return;
      
      const filePath = parts[1]; // e.g. "userId/filename"
      const { error } = await supabase.storage
        .from('receipts')
        .remove([filePath]);

      if (error) {
        logger.warn('Failed to delete receipt from Supabase storage', error);
      }
    } catch (err) {
      logger.warn('Error deleting receipt image', err);
    }
  },
};
