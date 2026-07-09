import { ID, Models, Query } from 'react-native-appwrite';
import { tablesDB } from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_USER_PROFILES_COLLECTION_ID } from '@env';

export interface UserProfile {
  $id?: string;
  auth_id: string;
  full_name?: string;
  nickname?: string;
  phone?: string;
  type?: string;
  /** ISO datetime when the free trial was first started (Appwrite datetime attribute). */
  trial_started_at?: string;
  subscription_status?: 'active' | 'inactive';
  subscription_updated_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface CreateUserProfileParams {
  auth_id: string;
  full_name?: string;
  nickname?: string;
  type?: string;
}

class UserProfileService {
  private validateConfig(): void {
    if (!APPWRITE_DATABASE_ID) {
      throw new Error(
        'APPWRITE_DATABASE_ID is not configured. Please check your .env file.'
      );
    }
    if (!APPWRITE_USER_PROFILES_COLLECTION_ID) {
      throw new Error(
        'APPWRITE_USER_PROFILES_COLLECTION_ID is not configured. Please check your .env file and refer to APPWRITE_SETUP.md for setup instructions.'
      );
    }
  }

  async createUserProfile({
    auth_id,
    full_name,
    nickname,
    type,
  }: CreateUserProfileParams): Promise<Models.Document> {
    try {
      this.validateConfig();

      const profile = await tablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USER_PROFILES_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          auth_id,
          full_name: full_name || '',
          nickname: nickname || '',
          type: type || 'patient',
        },
      });

      return profile as unknown as Models.Document;
    } catch (error: any) {
      console.error('Create user profile error:', error);
      
      if (error.message?.includes('not authorized') || error.code === 401) {
        throw new Error(
          'Permission denied: Please configure collection permissions in Appwrite. ' +
          'Go to your collection Settings → Permissions and add "Users" role with Create, Read, and Update permissions. ' +
          'See APPWRITE_SETUP.md for detailed instructions.'
        );
      }
      
      throw new Error(error.message || 'Failed to create user profile');
    }
  }

  /**
   * Idempotent: sets trial_started_at on first call; returns existing server value if already set.
   */
  async ensureTrialStarted(auth_id: string): Promise<string | null> {
    try {
      this.validateConfig();
      const profile = await this.getUserProfileByAuthId(auth_id);
      if (!profile?.$id) {
        return null;
      }
      if (profile.trial_started_at) {
        return profile.trial_started_at;
      }
      const iso = new Date().toISOString();
      const updated = await this.updateUserProfile(profile.$id, {
        trial_started_at: iso,
      });
      const row = updated as unknown as UserProfile;
      return row.trial_started_at ?? iso;
    } catch (error: any) {
      console.error('ensureTrialStarted error:', error);
      return null;
    }
  }

  async getUserProfileByAuthId(auth_id: string): Promise<UserProfile | null> {
    try {
      this.validateConfig();

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USER_PROFILES_COLLECTION_ID,
        queries: [Query.equal('auth_id', auth_id)],
      });

      if (response.rows.length > 0) {
        return response.rows[0] as unknown as UserProfile;
      }

      return null;
    } catch (error: any) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  async updateUserProfile(
    profileId: string,
    data: Partial<UserProfile>
  ): Promise<Models.Document> {
    try {
      this.validateConfig();

      const profile = await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USER_PROFILES_COLLECTION_ID,
        rowId: profileId,
        data,
      });

      return profile as unknown as Models.Document;
    } catch (error: any) {
      console.error('Update user profile error:', error);
      throw new Error(error.message || 'Failed to update user profile');
    }
  }

  async syncSubscriptionStatus(auth_id: string, isSubscribed: boolean): Promise<void> {
    try {
      this.validateConfig();

      const profile = await this.getUserProfileByAuthId(auth_id);
      if (!profile?.$id) {
        return;
      }

      await this.updateUserProfile(profile.$id, {
        subscription_status: isSubscribed ? 'active' : 'inactive',
        subscription_updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('syncSubscriptionStatus error:', error);
    }
  }

  async deleteUserProfile(profileId: string): Promise<void> {
    try {
      this.validateConfig();

      await tablesDB.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USER_PROFILES_COLLECTION_ID,
        rowId: profileId,
      });
    } catch (error: any) {
      console.error('Delete user profile error:', error);
      throw new Error(error.message || 'Failed to delete user profile');
    }
  }
}

export const userProfileService = new UserProfileService();
