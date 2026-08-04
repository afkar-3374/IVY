export type FileCategory =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'archive'
  | 'text'
  | 'code'
  | 'apk'
  | 'generic';

/**
 * Classify file type based on extension and MIME type
 */
export function getFileCategory(fileName: string = '', mimeType: string = ''): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType.toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return 'excel';
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return 'archive';
  if (['txt', 'md', 'rtf'].includes(ext) || mime.startsWith('text/plain')) return 'text';
  if (['json', 'js', 'ts', 'html', 'css', 'xml'].includes(ext) || mime.includes('json')) return 'code';
  if (ext === 'apk' || mime.includes('android.package-archive')) return 'apk';

  return 'generic';
}

/**
 * Extract clean file extension (e.g. "PDF", "DOCX", "ZIP")
 */
export function getFileExtensionLabel(fileName: string = ''): string {
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext ? ext.slice(0, 5) : 'FILE';
}

/**
 * Format bytes into human readable file size string
 */
export function formatFileSize(bytes: number = 0, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
