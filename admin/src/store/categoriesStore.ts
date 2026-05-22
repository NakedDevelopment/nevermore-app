import { create } from 'zustand';
import { fetchCategories, type Category } from '../lib/categories';

interface CategoriesState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  isFetched: boolean; // Track if we've already fetched
  
  // Actions
  loadCategories: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  clearError: () => void;
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,
  isFetched: false,
  
  loadCategories: async () => {
    // If already loading or already fetched, don't fetch again
    const { isLoading, isFetched } = get();
    if (isLoading || isFetched) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const fetchedCategories = await fetchCategories();
      set({ 
        categories: fetchedCategories, 
        isLoading: false, 
        error: null,
        isFetched: true 
      });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load categories. Please check your AppWrite configuration.';
      set({ 
        isLoading: false, 
        error: errorMessage,
        isFetched: false // Allow retry on error
      });
    }
  },

  refreshCategories: async () => {
    set({ isFetched: false });
    await get().loadCategories();
  },
  
  clearError: () => set({ error: null }),
}));

