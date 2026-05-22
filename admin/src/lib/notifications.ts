import { useNotificationStore } from '../store/notificationStore';
import { getAppwriteErrorMessage, isUnauthorizedError } from './errorHandler';

/**
 * Show a notification from an Appwrite error
 * Automatically extracts the error message and shows it as an error notification
 * @param error - The error to display
 * @param options - Optional configuration
 */
export const showAppwriteError = (
  error: unknown,
  options?: {
    skipUnauthorized?: boolean; // Skip 401 errors (often expected)
    duration?: number;
  }
) => {
  // Skip unauthorized errors if requested (often expected in auth flows)
  if (options?.skipUnauthorized && isUnauthorizedError(error)) {
    return;
  }

  const message = getAppwriteErrorMessage(error);
  const store = useNotificationStore.getState();
  
  store.addNotification({
    message,
    type: 'error',
    duration: options?.duration ?? 3000,
  });
};

/**
 * Show a success notification
 */
export const showSuccess = (message: string, duration?: number) => {
  const store = useNotificationStore.getState();
  store.addNotification({
    message,
    type: 'success',
    duration: duration ?? 3000,
  });
};

/**
 * Show an info notification
 */
export const showInfo = (message: string, duration?: number) => {
  const store = useNotificationStore.getState();
  store.addNotification({
    message,
    type: 'info',
    duration: duration ?? 3000,
  });
};

/**
 * Show a warning notification
 */
export const showWarning = (message: string, duration?: number) => {
  const store = useNotificationStore.getState();
  store.addNotification({
    message,
    type: 'warning',
    duration: duration ?? 3000,
  });
};

