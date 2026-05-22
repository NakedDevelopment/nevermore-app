import { tablesDB } from './appwrite';
import { ID, Query } from 'appwrite';
import { showAppwriteError, showSuccess } from './notifications';

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const SETTINGS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || 'settings';

export interface SettingDocument {
  $id: string;
  key: string; // 'terms' or 'privacy'
  value: string; // Markdown content
  $createdAt?: string;
  $updatedAt?: string;
}

export interface AppLinkSettings {
  deepLinkUrl: string | null;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

/**
 * Get a setting by key (terms or privacy)
 */
export async function getSetting(key: 'terms' | 'privacy'): Promise<SettingDocument | null> {
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!SETTINGS_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_SETTINGS_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: SETTINGS_COLLECTION_ID,
      queries: [
        Query.equal('key', key),
        Query.limit(1)
      ]
    });

    if (response.rows.length === 0) {
      return null;
    }

    return response.rows[0] as unknown as SettingDocument;
  } catch (error) {
    console.error('Error fetching setting:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Create or update a setting
 */
/**
 * Get app link settings (deepLinkUrl, playStoreUrl, appStoreUrl)
 */
export async function getAppLinkSettings(): Promise<AppLinkSettings> {
  if (!DATABASE_ID || !SETTINGS_COLLECTION_ID) {
    console.error('Database configuration missing');
    return { deepLinkUrl: null, playStoreUrl: null, appStoreUrl: null };
  }

  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: SETTINGS_COLLECTION_ID,
      queries: [
        Query.equal('key', ['deepLinkUrl', 'playStoreUrl', 'appStoreUrl'])
      ]
    });

    const settings: AppLinkSettings = {
      deepLinkUrl: null,
      playStoreUrl: null,
      appStoreUrl: null
    };

    response.rows.forEach((row: unknown) => {
      const doc = row as SettingDocument;
      if (doc.key === 'deepLinkUrl' && doc.value && doc.value !== '-') {
        settings.deepLinkUrl = doc.value;
      } else if (doc.key === 'playStoreUrl' && doc.value && doc.value !== '-') {
        settings.playStoreUrl = doc.value;
      } else if (doc.key === 'appStoreUrl' && doc.value && doc.value !== '-') {
        settings.appStoreUrl = doc.value;
      }
    });

    return settings;
  } catch (error) {
    console.error('Error fetching app link settings:', error);
    return { deepLinkUrl: null, playStoreUrl: null, appStoreUrl: null };
  }
}

/**
 * Create or update a setting
 */
export async function saveSetting(key: 'terms' | 'privacy', value: string): Promise<string> {
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!SETTINGS_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_SETTINGS_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    // Check if setting already exists
    const existing = await getSetting(key);

    if (existing) {
      // Update existing setting
      const response = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: SETTINGS_COLLECTION_ID,
        rowId: existing.$id,
        data: {
          value: value,
        }
      });

      showSuccess(`${key === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'} updated successfully`);
      return response.$id;
    } else {
      // Create new setting
      const response = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: SETTINGS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          key: key,
          value: value,
        }
      });

      showSuccess(`${key === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'} created successfully`);
      return response.$id;
    }
  } catch (error) {
    console.error('Error saving setting:', error);
    showAppwriteError(error);
    throw error;
  }
}

