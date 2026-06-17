import { account } from './appwrite.config';

export type SyncedBookmark = {
  id: string;
  title: string;
  timestamp: number;
  role: string;
};

export type SyncedUserData = {
  bookmarks?: SyncedBookmark[];
  bookmarkActiveTab?: 'Recovery' | 'Support';
  fortyDayCompletedTasks?: Record<string, boolean>;
  fortyDayCurrentDay?: number;
  updatedAt?: string;
};

const PREF_KEY = 'nevermoreUserData';

const parseSyncedData = (value: unknown): SyncedUserData => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && value !== null ? (value as SyncedUserData) : {};
};

export const userDataSyncService = {
  async getSyncedUserData(): Promise<SyncedUserData> {
    const prefs = await account.getPrefs();
    return parseSyncedData((prefs as Record<string, unknown>)[PREF_KEY]);
  },

  async updateSyncedUserData(patch: Partial<SyncedUserData>): Promise<void> {
    const prefs = await account.getPrefs();
    const current = parseSyncedData((prefs as Record<string, unknown>)[PREF_KEY]);
    await account.updatePrefs({
      ...prefs,
      [PREF_KEY]: {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  },
};
