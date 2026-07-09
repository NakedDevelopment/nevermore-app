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

export interface BackfillFailure {
  contentId: string;
  url: string;
  reason: string;
}

export interface BackfillResult {
  scanned: number;
  updated: number;
  failed: number;
  failures: BackfillFailure[];
}

const PAGE_SIZE = 100;

function isValidDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function needsBackfill(urls: string[], durations: unknown[]): boolean {
  return urls.some((url, idx) => !!url && !isValidDuration(durations[idx]));
}

async function fetchAllContentRows(): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;

  while (true) {
    const queries = [Query.orderAsc('$id'), Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      queries,
    });
    const page = response.rows as Array<Record<string, unknown>>;
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].$id as string;
  }

  return rows;
}

/**
 * Resolves durations for a list of URLs, reusing already-valid existing
 * values. Never throws: a per-URL failure is recorded in `failures` and that
 * slot falls back to its previous value (so a good array can still be
 * written for the OTHER slots that did resolve, and the failed slot stays
 * eligible for `needsBackfill` on the next run instead of being masked).
 */
async function resolveDurations(
  urls: string[],
  existing: unknown[],
  contentId: string,
  failures: BackfillFailure[]
): Promise<{ durations: (number | null)[]; changed: boolean }> {
  let changed = false;

  const durations = await Promise.all(
    urls.map(async (url, idx) => {
      const existingValue = existing[idx];
      if (isValidDuration(existingValue)) return existingValue;
      if (!url) return null;

      try {
        const duration = await getAudioDurationFromUrl(url);
        changed = true;
        return duration;
      } catch (error) {
        failures.push({ contentId, url, reason: error instanceof Error ? error.message : String(error) });
        return null;
      }
    })
  );

  return { durations, changed };
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

  const rows = await fetchAllContentRows();
  let updated = 0;
  const failures: BackfillFailure[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const contentId = row.$id as string;
    onProgress?.({ processed: i, total: rows.length, updated });

    try {
      const patch: Record<string, unknown> = {};
      let rowChanged = false;

      const files = Array.isArray(row.files) ? (row.files as string[]) : [];
      const existingFileDurations = Array.isArray(row.fileDurations)
        ? (row.fileDurations as unknown[])
        : [];
      if (files.length > 0 && needsBackfill(files, existingFileDurations)) {
        const result = await resolveDurations(files, existingFileDurations, contentId, failures);
        patch.fileDurations = result.durations;
        rowChanged = rowChanged || result.changed;
      }

      const mainRecoveryUrl = row.mainContentRecoveryURL;
      if (typeof mainRecoveryUrl === 'string' && mainRecoveryUrl && !isValidDuration(row.mainContentRecoveryDurationSec)) {
        try {
          patch.mainContentRecoveryDurationSec = await getAudioDurationFromUrl(mainRecoveryUrl);
          rowChanged = true;
        } catch (error) {
          failures.push({ contentId, url: mainRecoveryUrl, reason: error instanceof Error ? error.message : String(error) });
        }
      }

      const mainSupportUrl = row.mainContentSupportURL;
      if (typeof mainSupportUrl === 'string' && mainSupportUrl && !isValidDuration(row.mainContentSupportDurationSec)) {
        try {
          patch.mainContentSupportDurationSec = await getAudioDurationFromUrl(mainSupportUrl);
          rowChanged = true;
        } catch (error) {
          failures.push({ contentId, url: mainSupportUrl, reason: error instanceof Error ? error.message : String(error) });
        }
      }

      const recoveryQuestionFiles = Array.isArray(row.recoveryQuestionFiles)
        ? (row.recoveryQuestionFiles as string[])
        : [];
      const existingRecoveryQuestionDurations = Array.isArray(row.recoveryQuestionFileDurations)
        ? (row.recoveryQuestionFileDurations as unknown[])
        : [];
      if (recoveryQuestionFiles.length > 0 && needsBackfill(recoveryQuestionFiles, existingRecoveryQuestionDurations)) {
        const result = await resolveDurations(recoveryQuestionFiles, existingRecoveryQuestionDurations, contentId, failures);
        patch.recoveryQuestionFileDurations = result.durations;
        rowChanged = rowChanged || result.changed;
      }

      const supportQuestionFiles = Array.isArray(row.supportQuestionFiles)
        ? (row.supportQuestionFiles as string[])
        : [];
      const existingSupportQuestionDurations = Array.isArray(row.supportQuestionFileDurations)
        ? (row.supportQuestionFileDurations as unknown[])
        : [];
      if (supportQuestionFiles.length > 0 && needsBackfill(supportQuestionFiles, existingSupportQuestionDurations)) {
        const result = await resolveDurations(supportQuestionFiles, existingSupportQuestionDurations, contentId, failures);
        patch.supportQuestionFileDurations = result.durations;
        rowChanged = rowChanged || result.changed;
      }

      if (Object.keys(patch).length > 0) {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: CONTENT_COLLECTION_ID,
          rowId: contentId,
          data: patch,
        });
        if (rowChanged) updated++;
      }
    } catch (error) {
      console.warn(`Failed to backfill durations for content ${contentId}:`, error);
      failures.push({ contentId, url: '', reason: error instanceof Error ? error.message : String(error) });
    }
  }

  onProgress?.({ processed: rows.length, total: rows.length, updated });
  return { scanned: rows.length, updated, failed: failures.length, failures };
}
