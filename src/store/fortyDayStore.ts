import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentService, Content } from '../services/content.service';
import { getFirstFileUrl, getFileUrl } from '../utils/storageUtils';
import { userDataSyncService } from '../services/userDataSync.service';

export interface Task {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  contentId?: string;
  audioUrl?: string;
  duration?: number;
  /**
   * Per-task icon URL set in the admin dashboard. May be an Appwrite file ID or
   * a full URL; normalized to a URL via getFileUrl. Undefined for older tasks
   * that have no icon, in which case the app falls back to a default icon.
   */
  icon?: string;
}

const FREE_JOURNEY_DAYS_MAX = 3;

export interface DayData {
  day: number;
  title: string;
  completionPercentage: number;
  tasks: Task[];
  audioUrl?: string;
  /** True when this day is free (admin-set). Only Day 1–3 can be free. */
  isFree?: boolean;
}

interface FortyDayState {
  currentDay: number;
  days: DayData[];
  completedTasks: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  setCurrentDay: (day: number) => void;
  setDays: (days: DayData[]) => void;
  toggleTask: (day: number, taskId: string) => void;
  getCompletedTasks: () => Record<string, boolean>;
  resetProgress: () => void;
  clearProgress: () => void;
  hydrateProgressFromBackend: () => Promise<void>;
  loadFortyDayContent: () => Promise<void>;
}

const convertContentToTasks = (content: Content): Task[] => {
  const tasks: Task[] = [];

  if (Array.isArray(content.tasks)) {
    return content.tasks.map((taskString, index) => {
      try {
        const taskObj = typeof taskString === 'string' ? JSON.parse(taskString) : taskString;
        
        const taskId = taskObj.id || taskObj.$id || `task-${index}`;

        const iconRaw =
          taskObj.icon || taskObj.iconUrl || taskObj.image || taskObj.imageUrl;
        const icon =
          typeof iconRaw === 'string' ? getFileUrl(iconRaw) : undefined;

        return {
          id: taskId,
          title: taskObj.title || `Task ${index + 1}`,
          subtitle: taskObj.subtitle || taskObj.type || '',
          completed: false,
          contentId: taskObj.contentId,
          audioUrl: taskObj.audioUrl,
          duration: taskObj.duration,
          icon,
        };
      } catch (error) {
        return {
          id: `task-${index}`,
          title: typeof taskString === 'string' ? taskString : `Task ${index + 1}`,
          subtitle: '',
          completed: false,
        };
      }
    });
  }

  return tasks;
};

const getTaskStorageKey = (day: number, taskId: string) => `day-${day}-task-${taskId}`;

const isValidChallengeDay = (day: unknown): day is number =>
  typeof day === 'number' && Number.isFinite(day) && day >= 1;

const syncFortyDayProgress = (currentDay: number, completedTasks: Record<string, boolean>) => {
  void userDataSyncService
    .updateSyncedUserData({
      fortyDayCurrentDay: currentDay,
      fortyDayCompletedTasks: completedTasks,
    })
    .catch((error) => console.warn('Failed to sync 40-day progress:', error));
};

export const useFortyDayStore = create<FortyDayState>()(
  persist(
    (set, get) => ({
      currentDay: 1,
      days: [],
      completedTasks: {},
      loading: false,
      error: null,
      
      setCurrentDay: (day: number) => {
        if (isValidChallengeDay(day)) {
          set({ currentDay: day });
          syncFortyDayProgress(day, get().completedTasks);
        }
      },

      setDays: (days: DayData[]) => {
        set((state) => {
          const completedTasks = { ...(state.completedTasks || {}) };
          days.forEach((day) => {
            day.tasks.forEach((task) => {
              const taskKey = getTaskStorageKey(day.day, task.id);
              if (task.completed) {
                completedTasks[taskKey] = true;
              } else if (!(taskKey in completedTasks)) {
                completedTasks[taskKey] = false;
              }
            });
          });
          return { days, completedTasks };
        });
      },

      getCompletedTasks: () => {
        const state = get();
        const completedTasks: Record<string, boolean> = {
          ...((state as any).completedTasks || {}),
        };
        
        state.days.forEach((day) => {
          day.tasks.forEach((task) => {
            if (task.completed) {
              const taskKey = getTaskStorageKey(day.day, task.id);
              completedTasks[taskKey] = true;
            }
          });
        });
        
        return completedTasks;
      },
      
      toggleTask: (day: number, taskId: string) => {
        let nextCompletedTasks: Record<string, boolean> = {};
        set((state) => {
          const completedTaskMap = { ...(state.completedTasks || {}) };
          const days = state.days.map((d) => {
            if (d.day === day) {
              const updatedTasks = d.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
              );
              const toggledTask = updatedTasks.find((task) => task.id === taskId);
              const taskKey = getTaskStorageKey(day, taskId);
              if (toggledTask?.completed) {
                completedTaskMap[taskKey] = true;
              } else {
                delete completedTaskMap[taskKey];
              }
              const completedTaskCount = updatedTasks.filter(task => task.completed).length;
              const completionPercentage = updatedTasks.length > 0 
                ? Math.round((completedTaskCount / updatedTasks.length) * 100)
                : 0;
              
              return {
                ...d,
                tasks: updatedTasks,
                completionPercentage,
              };
            }
            return d;
          });

          nextCompletedTasks = completedTaskMap;
          return { days, completedTasks: completedTaskMap };
        });
        syncFortyDayProgress(get().currentDay, nextCompletedTasks);
      },
      
      resetProgress: () => {
        set({
          currentDay: 1,
          days: [],
          completedTasks: {},
          error: null,
        });
        syncFortyDayProgress(1, {});
        get().loadFortyDayContent();
      },

      clearProgress: () => {
        set({
          currentDay: 1,
          days: [],
          completedTasks: {},
          error: null,
        });
        syncFortyDayProgress(1, {});
      },

      hydrateProgressFromBackend: async () => {
        try {
          const syncedData = await userDataSyncService.getSyncedUserData();
          const syncedCompletedTasks = syncedData.fortyDayCompletedTasks;
          const syncedCurrentDay = syncedData.fortyDayCurrentDay;

          set((state) => ({
            completedTasks:
              syncedCompletedTasks && typeof syncedCompletedTasks === 'object'
                ? syncedCompletedTasks
                : state.completedTasks,
            currentDay:
              isValidChallengeDay(syncedCurrentDay)
                ? syncedCurrentDay
                : state.currentDay,
          }));
        } catch (error) {
          console.warn('Failed to hydrate 40-day progress:', error);
        }
      },

      loadFortyDayContent: async () => {
        await get().hydrateProgressFromBackend();
        const existingCompletedTasks = get().getCompletedTasks();
        set({ loading: true, error: null });
        
        try {
          const fortyDayContent = await contentService.getFortyDayContent();
          
          if (fortyDayContent.length === 0) {
            set({ 
              loading: false, 
              error: 'No 40-day journey content found. Please add content with type "forty_day_journey".',
            });
            return;
          }
          
          const sortedContent = [...fortyDayContent].sort((a, b) => {
            if (a.day !== undefined && b.day !== undefined) {
              return Number(a.day) - Number(b.day);
            }
            if (a.$createdAt && b.$createdAt) {
              return new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime();
            }
            return (a.title || '').localeCompare(b.title || '');
          });
          
          const days: DayData[] = sortedContent.map((content, index) => {
            const dayNumber = content.day !== undefined && content.day !== null 
              ? Number(content.day) 
              : index + 1;
            
            const tasks = convertContentToTasks(content);
            
            tasks.forEach((task) => {
              const taskKey = getTaskStorageKey(dayNumber, task.id);
              if (existingCompletedTasks[taskKey]) {
                task.completed = true;
              }
            });
            
            const completedTasks = tasks.filter(task => task.completed).length;
            const completionPercentage = tasks.length > 0
              ? Math.round((completedTasks / tasks.length) * 100)
              : 0;
            
            // Convert Appwrite file ID to proper storage URL
            const audioUrl = getFirstFileUrl(content.files);
            // Only Day 1–3 can be free; respect content.isFree when set
            const isFree =
              dayNumber <= FREE_JOURNEY_DAYS_MAX && content.isFree === true;

            return {
              day: dayNumber,
              title: content.title || `Day ${dayNumber}`,
              completionPercentage,
              tasks,
              audioUrl,
              isFree,
            };
          });
          
          set({ 
            days, 
            completedTasks: existingCompletedTasks,
            loading: false,
            error: null,
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to load forty day content';
          
          console.error('Error loading forty day content:', error);
          
          set({ 
            loading: false, 
            error: errorMessage,
          });
        }
      },
    }),
    {
      name: 'forty-day-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentDay: state.currentDay,
        completedTasks: state.completedTasks,
      }),
    }
  )
);
