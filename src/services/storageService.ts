import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import type { MessageType } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { extractVideoMetadata } from '../utils/videoProcessor';

export class StorageService {
  private bucketName = 'ivy-media';

  /**
   * Determine MessageType from MIME type or file extension
   */
  getMessageTypeFromMime(mimeType: string, fileName: string = ''): MessageType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'voice';
    return 'document';
  }

  /**
   * Convert File or Blob to Data URL for instant optimistic display or offline fallback
   */
  fileToDataUrl(file: Blob | File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Process & compress image file before upload
   */
  async processAndUploadImage(
    file: File | Blob,
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ fileUrl: string; mimeType: string; fileName: string; fileSize: number; dataUrl: string }> {
    try {
      const { blob, dataUrl, compressedSize } = await compressImage(file);
      const name = fileName || (file as File).name || `img_${Date.now()}.jpg`;

      const uploadResult = await this.uploadFile(blob, 'chat', name, onProgress);
      return {
        fileUrl: uploadResult.fileUrl || dataUrl,
        mimeType: uploadResult.mimeType || 'image/jpeg',
        fileName: name,
        fileSize: compressedSize,
        dataUrl,
      };
    } catch (err) {
      logger.warn('Client-side compression fallback to original file:', err);
      const dataUrl = await this.fileToDataUrl(file);
      const name = fileName || (file as File).name || `img_${Date.now()}`;
      return {
        fileUrl: dataUrl,
        mimeType: file.type || 'image/jpeg',
        fileName: name,
        fileSize: file.size,
        dataUrl,
      };
    }
  }

  /**
   * Process video file, extract thumbnail & metadata, then upload
   */
  async processAndUploadVideo(
    file: File | Blob,
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<{
    fileUrl: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
    dataUrl: string;
    thumbnailUrl: string;
    duration: number;
  }> {
    try {
      const { thumbnailUrl, duration, dataUrl } = await extractVideoMetadata(file);
      const name = fileName || (file as File).name || `vid_${Date.now()}.mp4`;

      const uploadResult = await this.uploadFile(file, 'chat', name, onProgress);
      return {
        fileUrl: uploadResult.fileUrl || dataUrl,
        mimeType: file.type || 'video/mp4',
        fileName: name,
        fileSize: file.size,
        dataUrl,
        thumbnailUrl,
        duration,
      };
    } catch (err) {
      logger.warn('Video metadata extraction fallback:', err);
      const dataUrl = await this.fileToDataUrl(file);
      const name = fileName || (file as File).name || `vid_${Date.now()}`;
      return {
        fileUrl: dataUrl,
        mimeType: file.type || 'video/mp4',
        fileName: name,
        fileSize: file.size,
        dataUrl,
        thumbnailUrl: '',
        duration: 0,
      };
    }
  }

  /**
   * Process and upload any document / generic file
   */
  async processAndUploadDocument(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ fileUrl: string; mimeType: string; fileName: string; fileSize: number; dataUrl: string }> {
    const dataUrl = await this.fileToDataUrl(file);
    const name = file.name || `file_${Date.now()}`;
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = file.size;

    const uploadResult = await this.uploadFile(file, 'chat', name, onProgress);

    return {
      fileUrl: uploadResult.fileUrl || dataUrl,
      mimeType,
      fileName: name,
      fileSize,
      dataUrl,
    };
  }

  /**
   * Upload File to Supabase Storage with local base64 fallback
   */
  async uploadFile(
    file: File | Blob,
    folder: 'chat' | 'avatars' = 'chat',
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ fileUrl: string; mimeType: string; fileName: string; fileSize: number }> {
    const name = fileName || (file as File).name || `file_${Date.now()}`;
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = file.size;
    const path = `${folder}/${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (onProgress) onProgress(20);

    if (supabase) {
      try {
        const { error } = await supabase.storage.from(this.bucketName).upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

        if (onProgress) onProgress(70);

        if (!error) {
          const { data: urlData } = supabase.storage.from(this.bucketName).getPublicUrl(path);
          if (onProgress) onProgress(100);
          return {
            fileUrl: urlData.publicUrl,
            mimeType,
            fileName: name,
            fileSize,
          };
        } else {
          logger.warn('Supabase storage upload returned error, using fallback DataURL:', error.message);
        }
      } catch (err) {
        logger.error('Supabase storage upload exception:', err);
      }
    }

    // Fallback: Convert to DataURL for offline / non-storage environments
    const dataUrl = await this.fileToDataUrl(file);
    if (onProgress) onProgress(100);
    return {
      fileUrl: dataUrl,
      mimeType,
      fileName: name,
      fileSize,
    };
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

export const storageService = new StorageService();
