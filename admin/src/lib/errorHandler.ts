/** Shown when the API rejects an upload for exceeding the configured size limit. */
export const FILE_SIZE_USER_FRIENDLY_MESSAGE =
  'That file is too large to upload. Try a smaller or compressed file. If you need a higher limit, ask your administrator to increase the maximum upload size.';

/**
 * Replace low-level storage errors with copy that makes sense for content editors.
 */
export function enrichAppwriteMessageForDisplay(message: string): string {
  const m = message.trim();
  if (!m) {
    return m;
  }
  const looksLikeFileSizeRejection =
    /file\s*size|filesize|payload too large|\b413\b/i.test(m) &&
    /not allowed|exceed|maximum|limit|too large|invalid|bigger than/i.test(m);
  if (looksLikeFileSizeRejection) {
    return FILE_SIZE_USER_FRIENDLY_MESSAGE;
  }
  return m;
};

/**
 * Extract error message from Appwrite error
 */
export const getAppwriteErrorMessage = (error: unknown): string => {
  if (!error) {
    return enrichAppwriteMessageForDisplay('An unexpected error occurred');
  }

  if (error instanceof Error) {
    return enrichAppwriteMessageForDisplay(error.message || 'An error occurred');
  }

  if (typeof error === 'object') {
    const appwriteError = error as {
      message?: string;
      response?: {
        message?: string;
        data?: {
          message?: string;
        };
      };
      data?: {
        message?: string;
      };
    };

    if (appwriteError.message) {
      return enrichAppwriteMessageForDisplay(appwriteError.message);
    }

    if (appwriteError.response?.message) {
      return enrichAppwriteMessageForDisplay(appwriteError.response.message);
    }

    if (appwriteError.response?.data?.message) {
      return enrichAppwriteMessageForDisplay(appwriteError.response.data.message);
    }

    if (appwriteError.data?.message) {
      return enrichAppwriteMessageForDisplay(appwriteError.data.message);
    }
  }

  if (typeof error === 'string') {
    return enrichAppwriteMessageForDisplay(error);
  }

  return enrichAppwriteMessageForDisplay('An unexpected error occurred');
};

/**
 * Check if error is an unauthorized (401) error
 * These errors are often expected and should be handled silently
 */
export const isUnauthorizedError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const appwriteError = error as {
      code?: number;
      message?: string;
      type?: string;
      response?: { code?: number };
    };
    
    if (appwriteError.code === 401 || appwriteError.response?.code === 401) {
      return true;
    }
    
    if (appwriteError.message) {
      return (
        appwriteError.message.includes('401') ||
        appwriteError.message.includes('Unauthorized') ||
        appwriteError.message.includes('missing scopes')
      );
    }
  }
  return false;
};

/**
 * Check if error is a forbidden (403) error
 */
export const isForbiddenError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const appwriteError = error as {
      code?: number;
      message?: string;
      response?: { code?: number };
    };

    if (appwriteError.code === 403 || appwriteError.response?.code === 403) {
      return true;
    }

    if (appwriteError.message) {
      return (
        appwriteError.message.includes('403') ||
        appwriteError.message.includes('Forbidden')
      );
    }
  }
  return false;
};

