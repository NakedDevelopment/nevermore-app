import { useState, useEffect, useCallback } from 'react';
import { contentService, Content } from '../services/content.service';
import { useFortyDayStore, Task, DayData } from '../store/fortyDayStore';

interface UseFortyDayReturn {
  days: DayData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Converts FortyDay Content from Appwrite to local DayData format
 */
function convertToLocalFormat(fortyDayContent: Content[], completedTasks: Record<string, boolean>): DayData[] {
  return fortyDayContent.map((content) => {
    let tasks: Task[] = [];

    // Handle tasks - array of JSON strings
    if (Array.isArray(content.tasks)) {
      tasks = content.tasks.map((taskString, index) => {
        try {
          // Try to parse as JSON object
          const taskObj = typeof taskString === 'string' ? JSON.parse(taskString) : taskString;
          
          const taskId = taskObj.id || taskObj.$id || `task-${index}`;
          const taskKey = `day-${content.day}-task-${taskId}`;
          
          return {
            id: taskId,
            title: taskObj.title || `Task ${index + 1}`,
            subtitle: taskObj.subtitle || taskObj.type || '',
            completed: completedTasks[taskKey] || false,
            contentId: taskObj.contentId,
            audioUrl: taskObj.audioUrl,
            duration: taskObj.duration,
          };
        } catch (error) {
          // If parsing fails, treat as simple string
          const taskKey = `day-${content.day}-task-${index}`;
          return {
            id: `task-${index}`,
            title: typeof taskString === 'string' ? taskString : `Task ${index + 1}`,
            subtitle: '',
            completed: completedTasks[taskKey] || false,
          };
        }
      });
    }

    // Calculate completion percentage
    const completedCount = tasks.filter(t => t.completed).length;
    const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    return {
      day: content.day || 0,
      completionPercentage,
      tasks,
      title: content.title,
      description: content.description,
    };
  });
}

/**
 * Hook to fetch all 40-day data from Appwrite and sync with local store
 */
export function useFortyDay(): UseFortyDayReturn {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get store methods
  const { days, setDays, getCompletedTasks, hydrateProgressFromBackend } = useFortyDayStore();

  const fetchFortyDayData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fortyDayContent = await contentService.getFortyDayContent();
      
      if (fortyDayContent.length === 0) {
        setError('No 40-day journey content found. Please add content with type "forty_day_journey".');
        return;
      }

      await hydrateProgressFromBackend();

      // Get completed tasks from store to preserve user progress
      const completedTasks = getCompletedTasks();
      
      // Convert to local format
      const localDays = convertToLocalFormat(fortyDayContent, completedTasks);
      
      // Update store with fetched data
      setDays(localDays);
      
      console.log(`Successfully loaded ${localDays.length} days from content collection`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch 40-day journey content';
      setError(errorMessage);
      console.error('Error in useFortyDay hook:', err);
    } finally {
      setLoading(false);
    }
  }, [setDays, getCompletedTasks, hydrateProgressFromBackend]);

  useEffect(() => {
    fetchFortyDayData();
  }, [fetchFortyDayData]);

  return {
    days,
    loading,
    error,
    refetch: fetchFortyDayData,
  };
}

interface UseFortyDayDetailsReturn {
  day: Content | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch a specific day's content by day number
 */
export function useFortyDayDetails(dayNumber: number): UseFortyDayDetailsReturn {
  const [day, setDay] = useState<Content | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDay = useCallback(async () => {
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      setError('Invalid day number. Must be a positive whole number.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch all FortyDay content and find the specific day
      const fortyDayContent = await contentService.getFortyDayContent();
      const dayContent = fortyDayContent.find(content => content.day === dayNumber);
      
      if (!dayContent) {
        setError(`Day ${dayNumber} not found in 40-day journey content.`);
      }
      
      setDay(dayContent || null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch day details';
      setError(errorMessage);
      console.error('Error in useFortyDayDetails hook:', err);
    } finally {
      setLoading(false);
    }
  }, [dayNumber]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay]);

  return {
    day,
    loading,
    error,
    refetch: fetchDay,
  };
}

