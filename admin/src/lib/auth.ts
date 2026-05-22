import { account, tablesDB } from "./appwrite";
import { Query } from "appwrite";
import type { Models } from "appwrite";
import type { User } from "../types";
import { showAppwriteError } from "./notifications";
import { isForbiddenError, isUnauthorizedError } from "./errorHandler";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const USER_PROFILES_COLLECTION_ID = import.meta.env.VITE_APPWRITE_USER_PROFILES_COLLECTION_ID || 'user_profiles';
/** Attribute on `user_profiles` that stores the account email (for pre-recovery coach checks). */
const USER_PROFILE_EMAIL_FIELD =
  import.meta.env.VITE_USER_PROFILE_EMAIL_FIELD || 'email';

const ADMIN_RECOVERY_EMAIL_NOT_ELIGIBLE_MESSAGE =
  'No admin account was found for this email address.';

interface UserProfile {
  $id: string;
  type: string;
  auth_id: string;
  [key: string]: unknown;
}

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map<string, UserProfile | null>();

/**
 * Get user profile from user_profiles collection by auth_id
 * Results are cached to avoid repeated API calls
 */
const getUserProfile = async (authId: string): Promise<UserProfile | null> => {
  // Check cache first
  if (userProfileCache.has(authId)) {
    return userProfileCache.get(authId) || null;
  }

  if (!DATABASE_ID || !USER_PROFILES_COLLECTION_ID) {
    console.error('Database ID or User Profiles Collection ID not configured');
    return null;
  }

  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_PROFILES_COLLECTION_ID,
      queries: [
        Query.equal('auth_id', authId),
      ],
    });

    const profile = response.rows && response.rows.length > 0 
      ? (response.rows[0] as unknown as UserProfile)
      : null;
    
    // Cache the result
    userProfileCache.set(authId, profile);
    
    return profile;
  } catch (error: unknown) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

/**
 * Clear user profile cache (call on sign out)
 */
const clearUserProfileCache = () => {
  userProfileCache.clear();
};

/**
 * Check if user is a coach
 */
const isCoach = async (authId: string): Promise<boolean> => {
  const profile = await getUserProfile(authId);
  return profile?.type === 'coach';
};

/**
 * Sign in with email and password
 * Only allows login if user type is 'coach'
 */
export const signIn = async (
  email: string,
  password: string
): Promise<Models.Session> => {
  try {
    const session = await account.createEmailPasswordSession({email, password});
    
    // After successful login, verify user is a coach
    const appwriteUser = await account.get();
    if (appwriteUser) {
      const userIsCoach = await isCoach(appwriteUser.$id);
      
      if (!userIsCoach) {
        // User is not a coach - sign them out and throw error
        try {
          await account.deleteSession({sessionId: "current"});
        } catch {
          // Ignore sign out errors
        }
        throw new Error('Access denied. Only coaches can access the admin panel.');
      }
    }
    
    return session;
  } catch (error: unknown) {
    // Don't show notification for invalid credentials (401) - we'll show it in the form
    // But show notifications for other errors
    const isInvalidCredentials = isUnauthorizedError(error);
    if (!isInvalidCredentials) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
    
    // Just throw the error as-is - Appwrite error will be displayed directly
    throw error;
  }
};

/**
 * Get current user session
 */
export const getCurrentSession = async (): Promise<Models.Session | null> => {
  try {
    const session = await account.getSession({sessionId: "current"});
    return session;
  } catch (error: unknown) {
    // 401 Unauthorized is expected when user is not authenticated (guest user)
    // This is not an error condition, just means no active session exists
    if (isUnauthorizedError(error)) {
      // No session exists - this is normal for unauthenticated users
      return null;
    }
    // Show notification for unexpected errors
    showAppwriteError(error, { skipUnauthorized: true });
    console.error("Error getting current session:", error);
    return null;
  }
};

/**
 * Get current user
 * Also validates that user is a coach
 */
export const getCurrentUser =
  async (): Promise<Models.User<Models.Preferences> | null> => {
    try {
      const user = await account.get();
      
      // Validate user is a coach
      if (user) {
        const userIsCoach = await isCoach(user.$id);
        if (!userIsCoach) {
          // User is not a coach - sign them out
          try {
            await account.deleteSession({sessionId: "current"});
          } catch {
            // Ignore sign out errors
          }
          return null;
        }
      }
      
      return user;
    } catch (error: unknown) {
      // 401 Unauthorized is expected when user is not authenticated (guest user)
      // This is not an error condition, just means no active session exists
      if (isUnauthorizedError(error)) {
        // No user session - this is normal for unauthenticated users
        return null;
      }
      // Show notification for unexpected errors
      showAppwriteError(error, { skipUnauthorized: true });
      console.error("Error getting current user:", error);
      return null;
    }
  };

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await account.deleteSession({sessionId: "current"});
    // Clear user profile cache on sign out
    clearUserProfileCache();
  } catch (error: unknown) {
    // If user is already signed out (401), that's fine - don't show error
    // For other errors, log them but don't show notification (user action is already handled)
    if (isUnauthorizedError(error)) {
      // User is already signed out - this is expected and not an error
      // Still clear cache
      clearUserProfileCache();
      return;
    }
    // Log other errors but don't show notification (sign out should still proceed)
    console.error("Error signing out:", error);
    // Don't throw - we want to clear local state even if server sign out fails
    // Clear cache anyway
    clearUserProfileCache();
  }
};

/**
 * When the project allows unauthenticated reads on `user_profiles` (or equivalent),
 * ensure the email belongs to a coach before Appwrite sends a recovery message.
 * If the lookup cannot run (e.g. 401), we skip this gate so recovery still works.
 */
const assertCoachEmailForAdminRecovery = async (
  normalizedEmail: string
): Promise<void> => {
  if (!DATABASE_ID || !USER_PROFILES_COLLECTION_ID) {
    return;
  }

  try {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: USER_PROFILES_COLLECTION_ID,
      queries: [
        Query.equal(USER_PROFILE_EMAIL_FIELD, normalizedEmail),
        Query.equal('type', 'coach'),
        Query.limit(1),
      ],
    });

    if (!response.rows?.length) {
      throw new Error(ADMIN_RECOVERY_EMAIL_NOT_ELIGIBLE_MESSAGE);
    }
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === ADMIN_RECOVERY_EMAIL_NOT_ELIGIBLE_MESSAGE
    ) {
      throw error;
    }
    if (isUnauthorizedError(error) || isForbiddenError(error)) {
      return;
    }
    console.warn('Coach email check skipped (could not verify):', error);
  }
};

/**
 * Create password recovery (sends recovery email)
 */
export const createPasswordRecovery = async (
  email: string,
  url?: string
): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await assertCoachEmailForAdminRecovery(normalizedEmail);
    // If no URL is provided, construct the default recovery URL
    // Appwrite will append userId and secret as query parameters
    const recoveryUrl = url || `${window.location.origin}/create-new-password`;
    await account.createRecovery({
      email: normalizedEmail,
      url: recoveryUrl,
    });
  } catch (error: unknown) {
    const isEligibilityError =
      error instanceof Error &&
      error.message === ADMIN_RECOVERY_EMAIL_NOT_ELIGIBLE_MESSAGE;
    if (!isEligibilityError) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
    throw error;
  }
};

/**
 * Update password using recovery (userId and secret from recovery link)
 */
export const updatePasswordRecovery = async (
  userId: string,
  secret: string,
  password: string
): Promise<void> => {
  try {
    // Clear any existing sessions before password reset to avoid conflicts
    try {
      await account.deleteSession({sessionId: "current"});
    } catch {
      // Ignore if no session exists
    }
    
    await account.updateRecovery({
      userId,
      secret,
      password,
    });
  } catch (error: unknown) {
    // Show notification for password update errors
    showAppwriteError(error, { skipUnauthorized: true });
    // Just throw the error as-is
    throw error;
  }
};

/**
 * Update user email
 */
export const updateEmail = async (
  email: string,
  password: string
): Promise<Models.User<Models.Preferences>> => {
  try {
    const user = await account.updateEmail({
      email,
      password,
    });
    return user;
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

/**
 * Update user password
 */
export const updatePassword = async (
  password: string,
  oldPassword: string
): Promise<Models.User<Models.Preferences>> => {
  try {
    const user = await account.updatePassword({
      password,
      oldPassword,
    });
    return user;
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

/**
 * Update user phone number in user_profiles table
 * Password is required for security verification
 */
export const updatePhone = async (
  phone: string,
  password: string
): Promise<Models.User<Models.Preferences>> => {
  try {
    // Get current user to verify authentication and get auth_id
    const currentUser = await account.get();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Verify password by attempting to update email with the same email
    // This verifies the password - if email unchanged, that's fine (password verified)
    // If unauthorized, password is wrong
    try {
      await account.updateEmail({
        email: currentUser.email,
        password,
      });
    } catch (error: unknown) {
      // If password verification fails (unauthorized), throw error
      if (isUnauthorizedError(error)) {
        throw new Error('Invalid password. Please try again.');
      }
      // If email is unchanged or other non-auth errors, continue (password was verified)
      // Only throw if it's a critical error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('unauthorized') || 
          errorMessage.toLowerCase().includes('invalid credentials')) {
        throw new Error('Invalid password. Please try again.');
      }
      // For other errors (like "email unchanged"), continue - password was verified
    }

    // Get user profile from user_profiles table
    const userProfile = await getUserProfile(currentUser.$id);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Update phone number in user_profiles table
    if (!DATABASE_ID || !USER_PROFILES_COLLECTION_ID) {
      throw new Error('Database configuration missing');
    }

    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: USER_PROFILES_COLLECTION_ID,
      rowId: userProfile.$id,
      data: {
        phone: phone,
      },
    });

    // Clear cache to force refresh on next access
    userProfileCache.delete(currentUser.$id);

    // Return the current user (phone is stored in user_profiles, not auth)
    return currentUser;
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

/**
 * Get current user's profile from user_profiles table
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const currentUser = await account.get();
    if (!currentUser) {
      return null;
    }
    return await getUserProfile(currentUser.$id);
  } catch (error: unknown) {
    if (isUnauthorizedError(error)) {
      return null;
    }
    console.error('Error getting current user profile:', error);
    return null;
  }
};

/**
 * Convert Appwrite User to our User type
 */
export const mapAppwriteUserToUser = (
  appwriteUser: Models.User<Models.Preferences>
): User => {
  return {
    id: appwriteUser.$id,
    email: appwriteUser.email,
    name: appwriteUser.name || appwriteUser.email,
    role: (appwriteUser.prefs as Models.Preferences & { role?: string })?.role || "user",
    createdAt: appwriteUser.$createdAt,
  };
};
