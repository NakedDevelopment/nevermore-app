import { create } from 'zustand';
import type { Models } from 'appwrite';
import type { User } from '../types';
import * as authService from '../lib/auth';

interface AppState {
  // Sidebar state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Auth state
  user: User | null;
  appwriteUser: Models.User<Models.Preferences> | null; // Keep full Appwrite user for Settings page
  session: Models.Session | null;
  isLoading: boolean;
  error: string | null;
  isAuthChecked: boolean; // Track if we've checked auth
  
  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Sidebar state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  
  // Auth state
  user: null,
  appwriteUser: null,
  session: null,
  isLoading: false,
  error: null,
  isAuthChecked: false,
  
  // Auth actions
  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await authService.signIn(email, password);
      const appwriteUser = await authService.getCurrentUser();
      
      if (appwriteUser) {
        const user = authService.mapAppwriteUserToUser(appwriteUser);
        set({ user, appwriteUser, session, isLoading: false, error: null });
      } else {
        set({ isLoading: false, error: 'Failed to get user information' });
      }
    } catch (error: unknown) {
      // Get error message directly from Appwrite error
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : (typeof error === 'string')
        ? error
        : 'Failed to sign in. Please check your credentials.';
      
      set({ 
        isLoading: false, 
        error: errorMessage
      });
      throw error;
    }
  },
  
  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.signOut();
      // Clear auth state after successful sign out
      set({ user: null, appwriteUser: null, session: null, isLoading: false, error: null, isAuthChecked: false });
    } catch {
      // Even if sign out fails (e.g., already signed out), clear the local state
      // This ensures the UI reflects the signed-out state
      set({ user: null, appwriteUser: null, session: null, isLoading: false, error: null, isAuthChecked: false });
    }
  },
  
  checkAuth: async () => {
    // Prevent duplicate calls - if already loading or already checked, skip
    const { isLoading, isAuthChecked } = get();
    if (isLoading || isAuthChecked) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const session = await authService.getCurrentSession();
      if (session) {
        const appwriteUser = await authService.getCurrentUser();
        if (appwriteUser) {
          const user = authService.mapAppwriteUserToUser(appwriteUser);
          set({ user, appwriteUser, session, isLoading: false, error: null, isAuthChecked: true });
        } else {
          // No user found even though session exists - clear state
          set({ user: null, appwriteUser: null, session: null, isLoading: false, error: null, isAuthChecked: true });
        }
      } else {
        // No session exists - this is normal for unauthenticated users
        // Don't set an error, just clear the auth state
        set({ user: null, appwriteUser: null, session: null, isLoading: false, error: null, isAuthChecked: true });
      }
    } catch (error: unknown) {
      // Only set error for unexpected errors
      console.error("Unexpected error checking auth:", error);
      set({ user: null, appwriteUser: null, session: null, isLoading: false, error: null, isAuthChecked: true });
    }
  },
  
  clearError: () => set({ error: null }),
}));

