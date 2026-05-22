/** Default when `VITE_MAX_UPLOAD_FILE_SIZE_MB` is not set. Keep in sync with Appwrite bucket limits. */
export const DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 30;

/**
 * Max upload size in bytes. Uses `VITE_MAX_UPLOAD_FILE_SIZE_MB` when set to a positive number;
 * otherwise {@link DEFAULT_MAX_UPLOAD_FILE_SIZE_MB} (30 MB).
 */
export function getConfiguredMaxUploadBytes(): number {
  const raw = import.meta.env.VITE_MAX_UPLOAD_FILE_SIZE_MB as string | undefined;
  if (raw !== undefined && raw !== '') {
    const mb = Number(raw);
    if (Number.isFinite(mb) && mb > 0) {
      return Math.floor(mb * 1024 * 1024);
    }
  }
  return Math.floor(DEFAULT_MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExceedsMaxUpload(file: File, maxBytes: number): boolean {
  return file.size > maxBytes;
}
