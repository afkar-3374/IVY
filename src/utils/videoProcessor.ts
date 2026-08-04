import { logger } from '../services/logger/logger';

export interface VideoMetadataResult {
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
  dataUrl: string;
}

/**
 * Client-side video metadata and thumbnail extraction helper.
 * Loads video, seeks to frame 1.0s, draws to canvas to generate JPEG thumbnail Data URL,
 * and extracts duration, width, height, and file size.
 */
export async function extractVideoMetadata(file: File | Blob): Promise<VideoMetadataResult> {
  return new Promise((resolve, reject) => {
    const fileSize = file.size;
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Seek to 1.0 second or half of duration if video is very short
      const seekTime = Math.min(1.0, video.duration / 2 || 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        const duration = Math.round(video.duration || 0);

        const canvas = document.createElement('canvas');
        canvas.width = Math.min(width, 1280);
        canvas.height = Math.round((height * canvas.width) / width);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);

          // Convert file to Data URL for instant optimistic offline display
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            cleanUp();
            logger.info(`Extracted video metadata: ${duration}s, ${width}x${height}`);
            resolve({
              thumbnailUrl,
              duration,
              width,
              height,
              fileSize,
              dataUrl,
            });
          };
          reader.onerror = (err) => {
            cleanUp();
            reject(err);
          };
          reader.readAsDataURL(file);
        } else {
          cleanUp();
          reject(new Error('Failed to get canvas context for video thumbnail'));
        }
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };

    video.onerror = (err) => {
      cleanUp();
      reject(err);
    };

    video.src = objectUrl;
  });
}
