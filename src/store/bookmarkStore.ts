import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userDataSyncService } from '../services/userDataSync.service';

export interface Bookmark {
  id: string;
  title: string;
  timestamp: number;
  role: string; // Role field from content (Recovery/Support)
}

interface BookmarkState {
  bookmarks: Bookmark[];
  activeTab: 'Recovery' | 'Support';
  addBookmark: (id: string, title: string, role: string) => void;
  removeBookmark: (id: string, role: string) => void;
  isBookmarked: (id: string, role: string) => boolean;
  toggleBookmark: (id: string, title: string, role: string) => void;
  clearBookmarks: () => void;
  setActiveTab: (tab: 'Recovery' | 'Support') => void;
  getFilteredBookmarks: (tab?: 'Recovery' | 'Support') => Bookmark[];
  hydrateFromBackend: () => Promise<void>;
}

const syncBookmarks = (bookmarks: Bookmark[], activeTab: 'Recovery' | 'Support') => {
  void userDataSyncService
    .updateSyncedUserData({ bookmarks, bookmarkActiveTab: activeTab })
    .catch((error) => console.warn('Failed to sync bookmarks:', error));
};

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      activeTab: 'Recovery',
      
      addBookmark: (id: string, title: string, role: string) => {
        let nextBookmarks: Bookmark[] = [];
        set((state) => {
          nextBookmarks = [
            ...state.bookmarks,
            { id, title, timestamp: Date.now(), role }
          ];
          return { bookmarks: nextBookmarks };
        });
        syncBookmarks(nextBookmarks, get().activeTab);
      },
      
      removeBookmark: (id: string, role: string) => {
        let nextBookmarks: Bookmark[] = [];
        set((state) => {
          nextBookmarks = state.bookmarks.filter(
            bookmark => !(bookmark.id === id && bookmark.role === role)
          );
          return { bookmarks: nextBookmarks };
        });
        syncBookmarks(nextBookmarks, get().activeTab);
      },
      
      isBookmarked: (id: string, role: string) => {
        return get().bookmarks.some(
          bookmark => bookmark.id === id && bookmark.role === role
        );
      },
      
      toggleBookmark: (id: string, title: string, role: string) => {
        const state = get();
        if (state.isBookmarked(id, role)) {
          state.removeBookmark(id, role);
        } else {
          state.addBookmark(id, title, role);
        }
      },
      
      clearBookmarks: () => {
        set({ bookmarks: [] });
        syncBookmarks([], get().activeTab);
      },

      setActiveTab: (tab: 'Recovery' | 'Support') => {
        set({ activeTab: tab });
        syncBookmarks(get().bookmarks, tab);
      },

      getFilteredBookmarks: (tab?: 'Recovery' | 'Support') => {
        const state = get();
        const activeTab = tab || state.activeTab;
        const filtered = state.bookmarks.filter(bookmark => {
          return !bookmark.role || bookmark.role.toLowerCase() === activeTab.toLowerCase();
        });
        return filtered;
      },

      hydrateFromBackend: async () => {
        try {
          const syncedData = await userDataSyncService.getSyncedUserData();
          set((state) => ({
            bookmarks: Array.isArray(syncedData.bookmarks)
              ? syncedData.bookmarks
              : state.bookmarks,
            activeTab: syncedData.bookmarkActiveTab || state.activeTab,
          }));
        } catch (error) {
          console.warn('Failed to hydrate bookmarks:', error);
        }
      },
    }),
    {
      name: 'bookmark-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
