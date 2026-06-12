import { Query } from 'react-native-appwrite';
import { tablesDB } from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_SETTINGS_COLLECTION_ID } from '@env';

export interface Setting {
  $id: string;
  key: string;
  value: string;
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: unknown;
}

class SettingsService {
  private validateConfig(): void {
    if (!APPWRITE_DATABASE_ID || (typeof APPWRITE_DATABASE_ID === 'string' && APPWRITE_DATABASE_ID.trim() === '')) {
      console.error('Configuration Error: APPWRITE_DATABASE_ID is not set in environment variables.');
      console.error('Current value:', APPWRITE_DATABASE_ID, 'Type:', typeof APPWRITE_DATABASE_ID);
      const error = new Error(
        'APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file and restart the app with cleared cache.'
      );
      throw error;
    }
    if (!APPWRITE_SETTINGS_COLLECTION_ID || (typeof APPWRITE_SETTINGS_COLLECTION_ID === 'string' && APPWRITE_SETTINGS_COLLECTION_ID.trim() === '')) {
      console.error('Configuration Error: APPWRITE_SETTINGS_COLLECTION_ID is not set in environment variables.');
      console.error('Current value:', APPWRITE_SETTINGS_COLLECTION_ID, 'Type:', typeof APPWRITE_SETTINGS_COLLECTION_ID);
      const error = new Error(
        'APPWRITE_SETTINGS_COLLECTION_ID is not set in environment variables. Please add it to your .env file and restart the app with cleared cache.'
      );
      throw error;
    }
  }

  async getSettingByKey(key: string): Promise<Setting | null> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_SETTINGS_COLLECTION_ID,
        queries: [
          Query.equal('key', key),
          Query.limit(1),
        ],
      });

      if (response.rows.length === 0) {
        console.warn(`Setting with key "${key}" not found`);
        return null;
      }

      return response.rows[0] as unknown as Setting;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message?: string; code?: string; type?: string };
        console.error('Error fetching setting:', {
          message: errorObj.message,
          code: errorObj.code || 'unknown',
          type: errorObj.type || 'unknown',
          key,
          databaseId: APPWRITE_DATABASE_ID,
          collectionId: APPWRITE_SETTINGS_COLLECTION_ID,
        });
      } else {
        console.error('Unknown error fetching setting:', error);
      }

      throw error;
    }
  }

  async getPrivacyPolicy(): Promise<string | null> {
    try {
      const setting =
        (await this.getSettingByKey('privacy')) ||
        (await this.getSettingByKey('privacyPolicy'));
      return setting?.value || null;
    } catch (error: unknown) {
      console.error('Error fetching privacy policy:', error);
      throw error;
    }
  }

  async getTermsAndConditions(): Promise<string | null> {
    try {
      const setting =
        (await this.getSettingByKey('terms')) ||
        (await this.getSettingByKey('termsAndCondition'));
      return setting?.value || null;
    } catch (error: unknown) {
      console.error('Error fetching terms and conditions:', error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    this.validateConfig();

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_SETTINGS_COLLECTION_ID,
        queries: [
          Query.limit(100),
        ],
      });

      return response.rows as unknown as Setting[];
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message?: string; code?: string; type?: string };
        console.error('Error fetching settings:', {
          message: errorObj.message,
          code: errorObj.code || 'unknown',
          type: errorObj.type || 'unknown',
          databaseId: APPWRITE_DATABASE_ID,
          collectionId: APPWRITE_SETTINGS_COLLECTION_ID,
        });
      } else {
        console.error('Unknown error fetching settings:', error);
      }

      throw error;
    }
  }
}

export const settingsService = new SettingsService();

