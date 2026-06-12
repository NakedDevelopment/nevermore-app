import { ID, account } from "./appwrite.config";
import type { Models } from "react-native-appwrite";
import type { User } from "../types";
import { showAppwriteError } from "./notifications";
import { isUnauthorizedError } from "./errorHandler";
import { userProfileService } from "./userProfile.service";
import { invitationService } from "./invitation.service";

export interface SignUpParams {
  email: string;
  password: string;
  name?: string;
  nickname?: string;
  type?: string;
}

export const signUp = async ({ 
  email, 
  password, 
  name, 
  nickname, 
  type 
}: SignUpParams): Promise<Models.User<Models.Preferences>> => {
  try {
    const newAccount = await account.create(
      ID.unique(),
      email,
      password,
      name
    );

    if (!newAccount) {
      throw new Error('Failed to create account');
    }

    await signIn(email, password);

    try {
      await userProfileService.createUserProfile({
        auth_id: newAccount.$id,
        full_name: name || email.split('@')[0],
        nickname: nickname || '',
        type: type || 'patient',
      });
    } catch (profileError: any) {
      // Profile creation failed, but account is created
    }

    return newAccount;
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<Models.Session> => {
  try {
    const existingSession = await getCurrentSession();
    if (existingSession) {
      try {
        await account.deleteSession('current');
      } catch (deleteError) {
        // Ignore delete errors
      }
    }

    const session = await account.createEmailPasswordSession(email, password);
    
    // Update invitation status to accepted if user has a pending invitation
    try {
      await invitationService.acceptInvitationByEmail(email);
    } catch (invitationError) {
      // Silently fail - invitation acceptance shouldn't block sign-in
    }
    
    return session;
  } catch (error: unknown) {
    const isInvalidCredentials = isUnauthorizedError(error);
    if (!isInvalidCredentials) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
    throw error;
  }
};

export const getCurrentSession = async (): Promise<Models.Session | null> => {
  try {
    const session = await account.getSession('current');
    return session;
  } catch (error: unknown) {
    if (isUnauthorizedError(error)) {
      return null;
    }
    showAppwriteError(error, { skipUnauthorized: true });
    return null;
  }
};

export const getCurrentUser = async (): Promise<Models.User<Models.Preferences> | null> => {
  try {
    const user = await account.get();
    return user;
  } catch (error: unknown) {
    if (isUnauthorizedError(error)) {
      return null;
    }
    showAppwriteError(error, { skipUnauthorized: true });
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await account.deleteSession('current');
  } catch (error: unknown) {
    if (isUnauthorizedError(error)) {
      return;
    }
  }
};

export const createPasswordRecovery = async (
  email: string,
  url?: string
): Promise<void> => {
  try {
    // Use the admin redirect app for deep linking - opens app if installed, falls back to the web redirect if not.
    // The app will intercept /reset-password path via Universal Links/App Links
    // Website will open at root (/) when app is not installed
    const recoveryUrl = url || "https://nevermore-admin-app-seven.vercel.app/reset-password";
    await account.createRecovery({
      email,
      url: recoveryUrl,
    });
  } catch (error: unknown) {
    throw error;
  }
};

export const updatePasswordRecovery = async (
  userId: string,
  secret: string,
  password: string
): Promise<void> => {
  try {
    await account.updateRecovery(userId, secret, password);
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    return false;
  }
};

export const createMagicURLToken = async (
  email: string,
  url?: string
): Promise<void> => {
  try {
    const magicUrl = url || "https://nevermore-admin-app-seven.vercel.app/verify-magic-url";
    await account.createMagicURLToken({
      userId: ID.unique(),
      email,
      url: magicUrl,
    });
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

export const createMagicURLSession = async (
  userId: string,
  secret: string
): Promise<Models.Session> => {
  try {
    const existingSession = await getCurrentSession();
    if (existingSession) {
      try {
        await account.deleteSession('current');
      } catch (deleteError) {
        // Ignore delete errors
      }
    }

    const session = await account.createSession({
      userId,
      secret,
    });
    
    // Get user after session creation
    const user = await getCurrentUser();
    
    if (user) {
      // Check if user profile exists, if not create one
      try {
        const existingProfile = await userProfileService.getUserProfileByAuthId(user.$id);
        if (!existingProfile) {
          // Create user profile with default values
          await userProfileService.createUserProfile({
            auth_id: user.$id,
            full_name: user.name || user.email?.split('@')[0] || '',
            nickname: '',
            type: 'patient',
          });
        }
      } catch (profileError: any) {
        // Profile creation/check failed, but session is created - don't block login
        console.error('User profile check/create error:', profileError);
      }
      
      // Update invitation status to accepted if user has a pending invitation
      try {
        if (user.email) {
          await invitationService.acceptInvitationByEmail(user.email);
        }
      } catch (invitationError) {
        // Silently fail - invitation acceptance shouldn't block sign-in
      }
    }
    
    return session;
  } catch (error: unknown) {
    const isInvalidCredentials = isUnauthorizedError(error);
    if (!isInvalidCredentials) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
    throw error;
  }
};

export const deleteAccount = async (): Promise<void> => {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    try {
      const userProfile = await userProfileService.getUserProfileByAuthId(currentUser.$id);
      if (userProfile && userProfile.$id) {
        await userProfileService.deleteUserProfile(userProfile.$id);
      }
    } catch (profileError) {
      // Ignore profile deletion errors
    }

    try {
      await account.updateStatus();
    } catch (statusError) {
      // Ignore status update errors
    }

    await signOut();
  } catch (error: unknown) {
    showAppwriteError(error, { skipUnauthorized: true });
    throw error;
  }
};

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
