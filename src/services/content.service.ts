import { Query } from 'react-native-appwrite';
import { tablesDB } from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_CONTENT_COLLECTION_ID } from '@env';

/**
 * Content row from Appwrite.
 * For free-content gating:
 * - Journey: content.isFree (only Day 1–3 allowed in admin). App uses this for lock/access.
 * - Temptations: free item per category is determined by Category.freeTemptationContentId.
 */
export interface Content {
  $id: string;
  title: string;
  day?: number;
  category?: string | { $id: string; name?: string; title?: string; label?: string; [key: string]: unknown };
  type: string;
  mainContentRecoveryURL?: string;
  mainContentSupportURL?: string;
  /**
   * In-app transcript body. Appwrite attributes must be exactly `transcriptRecoveryText` / `transcriptSupportText`
   * (use a large text type: mediumtext/longtext or high-size string per your Appwrite version).
   */
  transcriptRecoveryText?: string;
  transcriptSupportText?: string;
  images?: string[];
  recoveryImages?: string[];
  supportImages?: string[];
  files?: string[];
  /** Durations (seconds) for `files`, set by the admin at upload time. Index-aligned with `files`. */
  fileDurations?: number[];
  recoveryQuestionFiles?: string[];
  supportQuestionFiles?: string[];
  tasks?: string[];
  /** If true, this content is free (no subscription). For journey: only Day 1–3 can be free. */
  isFree?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: unknown;
}

/** Normalize image URL lists from Appwrite (arrays, JSON strings, single URL, `{ url }` rows). */
export function normalizeUrlStringList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const el of raw) {
      if (typeof el === 'string') {
        const t = el.trim();
        if (t) out.push(t);
      } else if (el && typeof el === 'object' && 'url' in el && typeof (el as { url: unknown }).url === 'string') {
        const t = (el as { url: string }).url.trim();
        if (t) out.push(t);
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        return normalizeUrlStringList(JSON.parse(t));
      } catch {
        /* treat as plain URL */
      }
    }
    return [t];
  }
  return [];
}

export function unionUrlStringLists(...raws: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of raws) {
    for (const u of normalizeUrlStringList(raw)) {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

export function getPresentationImageLists(content: Content): {
  legacy: string[];
  recovery: string[];
  support: string[];
} {
  const row = content as Record<string, unknown>;
  const legacy = unionUrlStringLists(row.images);
  const recovery = unionUrlStringLists(row.recoveryImages, row.recovery_images);
  const support = unionUrlStringLists(row.supportImages, row.support_images);
  return { legacy, recovery, support };
}

/** Role-specific reflection question audio lists; legacy is normalized `files`. */
export function getPresentationQuestionFileLists(content: Content): {
  legacy: string[];
  recovery: string[];
  support: string[];
} {
  const row = content as Record<string, unknown>;
  const legacy = normalizeUrlStringList(row.files);
  const recovery = unionUrlStringLists(row.recoveryQuestionFiles, row.recovery_question_files);
  const support = unionUrlStringLists(row.supportQuestionFiles, row.support_question_files);
  return { legacy, recovery, support };
}

export function getContentCategoryId(content: Content): string | null {
  if (!content.category) return null;
  if (typeof content.category === 'string') return content.category;
  if (typeof content.category === 'object' && content.category.$id) return content.category.$id;
  return null;
}

class ContentService {
  private validateConfig(): void {
    if (!APPWRITE_DATABASE_ID) {
      const error = new Error(
        'APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
      );
      console.error('Configuration Error:', error.message);
      throw error;
    }
    if (!APPWRITE_CONTENT_COLLECTION_ID) {
      const error = new Error(
        'APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
      );
      console.error('Configuration Error:', error.message);
      throw error;
    }
  }

  async getContent(): Promise<Content[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        queries: [
          Query.limit(1000),
        ],
      });

      return response.rows as unknown as Content[];
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message?: string; code?: string; type?: string };
        console.error('Error fetching content:', {
          message: errorObj.message,
          code: errorObj.code || 'unknown',
          type: errorObj.type || 'unknown',
          databaseId: APPWRITE_DATABASE_ID,
          collectionId: APPWRITE_CONTENT_COLLECTION_ID,
        });
      } else {
        console.error('Unknown error fetching content:', error);
      }

      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Failed to fetch content';

      if (errorMessage.includes('404') || errorMessage.includes('Route not found')) {
        const detailedError = new Error(
          `Content collection not found (404). Please verify:\n` +
          `1. Database ID is set: ${APPWRITE_DATABASE_ID ? '✅' : '❌ Missing APPWRITE_DATABASE_ID'}\n` +
          `2. Collection ID: "${APPWRITE_CONTENT_COLLECTION_ID}"\n` +
          `3. The collection "${APPWRITE_CONTENT_COLLECTION_ID}" exists in database "${APPWRITE_DATABASE_ID}"\n` +
          `4. Your Appwrite project has the correct API key and permissions\n` +
          `5. Check your Appwrite console to verify the database and collection IDs`
        );
        console.error(detailedError.message);
        throw detailedError;
      }

      throw error;
    }
  }

  async getContentByCategory(categoryId: string): Promise<Content[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        queries: [
          Query.equal('category', categoryId),
          Query.limit(1000),
        ],
      });

      return response.rows as unknown as Content[];
    } catch (error: unknown) {
      console.error('Error fetching content by category:', error);
      throw error;
    }
  }

  async getContentById(contentId: string): Promise<Content | null> {
    try {
      this.validateConfig();

      const content = await tablesDB.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        rowId: contentId,
      });

      return content as unknown as Content;
    } catch (error: any) {
      console.error('Get content by ID error:', error);
      return null;
    }
  }

  async getContentByType(type: string): Promise<Content[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        queries: [
          Query.equal('type', type),
          Query.limit(1000),
        ],
      });

      return response.rows as unknown as Content[];
    } catch (error: unknown) {
      console.error('Error fetching content by type:', error);
      throw error;
    }
  }

  async getFortyDayContent(): Promise<Content[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        queries: [
          Query.equal('type', 'forty_day_journey'),
          Query.limit(1000),
        ],
      });

      return response.rows as unknown as Content[];
    } catch (error: unknown) {
      console.error('Error fetching FortyDay content:', error);
      throw error;
    }
  }

  async getContentByCategoryAndRole(categoryId: string, role: string): Promise<Content[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_CONTENT_COLLECTION_ID,
        queries: [
          Query.equal('category', categoryId),
          Query.equal('role', role),
          Query.limit(1000),
        ],
      });

      return response.rows as unknown as Content[];
    } catch (error: unknown) {
      console.error('Error fetching content by category and role:', error);
      throw error;
    }
  }
}

export const contentService = new ContentService();

