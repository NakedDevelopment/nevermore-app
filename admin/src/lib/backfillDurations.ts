import { tablesDB } from './appwrite';
import { Query } from 'appwrite';
import { getAudioDurationFromUrl } from './audioDuration';

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const CONTENT_COLLECTION_ID = import.meta.env.VITE_APPWRITE_CONTENT_COLLECTION_ID || 'content';

export interface BackfillProgress {
  processed: number;
  total: number;
  updated: number;
}

export interface BackfillResult {
  scanned: number;
  updated: number;
  failed: number;
}

function isValidDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function needsBackfill(urls: string[], durations: unknown[]): boolean {
  return urls.some((url, idx) => !!url && !isValidDuration(durations[idx]));
}

/**
 * Computes and persists durations for audio that was uploaded before duration
 * tracking existed, WITHOUT re-uploading anything: it reads each file's
 * duration directly from its existing Appwrite Storage URL (browser-decoded,
 * same as at upload time) and patches only the duration fields on the row.
 * Safe to re-run — rows/files that already have a valid duration are skipped.
 */
export async function backfillAudioDurations(
  onProgress?: (progress: BackfillProgress) => void
): Promise<BackfillResult> {
  if (!DATABASE_ID || !CONTENT_COLLECTION_ID) {
    throw new Error('Appwrite database/collection configuration is missing');
  }

  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: CONTENT_COLLECTION_ID,
    queries: [Query.limit(1000)],
  });

  const rows = response.rows as Array<Record<string, unknown>>;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.({ processed: i, total: rows.length, updated });

    try {
      const patch: Record<string, unknown> = {};

      const files = Array.isArray(row.files) ? (row.files as string[]) : [];
      const existingFileDurations = Array.isArray(row.fileDurations)
        ? (row.fileDurations as unknown[])
        : [];
      if (files.length > 0 && needsBackfill(files, existingFileDurations)) {
        patch.fileDurations = await Promise.all(
          files.map((url, idx) =>
            isValidDuration(existingFileDurations[idx])
              ? Promise.resolve(existingFileDurations[idx])
              : getAudioDurationFromUrl(url)
          )
        );
      }

      const mainRecoveryUrl = row.mainContentRecoveryURL;
      if (typeof mainRecoveryUrl === 'string' && mainRecoveryUrl && !isValidDuration(row.mainContentRecoveryDurationSec)) {
        patch.mainContentRecoveryDurationSec = await getAudioDurationFromUrl(mainRecoveryUrl);
      }

      const mainSupportUrl = row.mainContentSupportURL;
      if (typeof mainSupportUrl === 'string' && mainSupportUrl && !isValidDuration(row.mainContentSupportDurationSec)) {
        patch.mainContentSupportDurationSec = await getAudioDurationFromUrl(mainSupportUrl);
      }

      const recoveryQuestionFiles = Array.isArray(row.recoveryQuestionFiles)
        ? (row.recoveryQuestionFiles as string[])
        : [];
      const existingRecoveryQuestionDurations = Array.isArray(row.recoveryQuestionFileDurations)
        ? (row.recoveryQuestionFileDurations as unknown[])
        : [];
      if (recoveryQuestionFiles.length > 0 && needsBackfill(recoveryQuestionFiles, existingRecoveryQuestionDurations)) {
        patch.recoveryQuestionFileDurations = await Promise.all(
          recoveryQuestionFiles.map((url, idx) =>
            isValidDuration(existingRecoveryQuestionDurations[idx])
              ? Promise.resolve(existingRecoveryQuestionDurations[idx])
              : getAudioDurationFromUrl(url)
          )
        );
      }

      const supportQuestionFiles = Array.isArray(row.supportQuestionFiles)
        ? (row.supportQuestionFiles as string[])
        : [];
      const existingSupportQuestionDurations = Array.isArray(row.supportQuestionFileDurations)
        ? (row.supportQuestionFileDurations as unknown[])
        : [];
      if (supportQuestionFiles.length > 0 && needsBackfill(supportQuestionFiles, existingSupportQuestionDurations)) {
        patch.supportQuestionFileDurations = await Promise.all(
          supportQuestionFiles.map((url, idx) =>
            isValidDuration(existingSupportQuestionDurations[idx])
              ? Promise.resolve(existingSupportQuestionDurations[idx])
              : getAudioDurationFromUrl(url)
          )
        );
      }

      if (Object.keys(patch).length > 0) {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: CONTENT_COLLECTION_ID,
          rowId: row.$id as string,
          data: patch,
        });
        updated++;
      }
    } catch (error) {
      console.warn(`Failed to backfill durations for content ${row.$id}:`, error);
      failed++;
    }
  }

  onProgress?.({ processed: rows.length, total: rows.length, updated });
  return { scanned: rows.length, updated, failed };
}
