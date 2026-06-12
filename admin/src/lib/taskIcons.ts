import { ID, Query } from 'appwrite';
import { storage } from './appwrite';
import { showAppwriteError, showSuccess } from './notifications';
import {
  fileExceedsMaxUpload,
  formatFileSize,
  getConfiguredMaxUploadBytes,
} from './uploadLimits';

const STORAGE_BUCKET_ID = import.meta.env.VITE_APPWRITE_STORAGE_BUCKET_ID || '';
const TASK_ICON_PREFIX = 'task-icon__';

export interface TaskIcon {
  id: string;
  name: string;
  url: string;
}

function requireBucketId(): string {
  if (!STORAGE_BUCKET_ID) {
    throw new Error(
      'VITE_APPWRITE_STORAGE_BUCKET_ID is not set in environment variables. Please add it to your .env file.'
    );
  }

  return STORAGE_BUCKET_ID;
}

function toTaskIcon(file: { $id: string; name: string; mimeType?: string }): TaskIcon {
  const bucketId = requireBucketId();
  const url = storage.getFileView({
    bucketId,
    fileId: file.$id,
  });

  return {
    id: file.$id,
    name: file.name.replace(TASK_ICON_PREFIX, ''),
    url: url.toString(),
  };
}

export async function fetchTaskIcons(): Promise<TaskIcon[]> {
  const bucketId = requireBucketId();

  try {
    const response = await storage.listFiles({
      bucketId,
      queries: [Query.limit(100)],
    });

    return response.files
      .filter((file) => file.name.startsWith(TASK_ICON_PREFIX))
      .map(toTaskIcon)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching task icons:', error);
    showAppwriteError(error);
    throw error;
  }
}

export async function uploadTaskIcon(file: File): Promise<TaskIcon> {
  const bucketId = requireBucketId();
  const maxBytes = getConfiguredMaxUploadBytes();

  if (!file.type.startsWith('image/')) {
    throw new Error('Task icons must be image files.');
  }

  if (fileExceedsMaxUpload(file, maxBytes)) {
    throw new Error(
      `"${file.name}" is ${formatFileSize(file.size)}. The maximum size per file is ${formatFileSize(maxBytes)}.`
    );
  }

  try {
    const iconFile = new File([file], `${TASK_ICON_PREFIX}${file.name}`, {
      type: file.type,
      lastModified: file.lastModified,
    });

    const response = await storage.createFile({
      bucketId,
      fileId: ID.unique(),
      file: iconFile,
    });

    showSuccess('Task icon uploaded successfully.');
    return toTaskIcon(response);
  } catch (error) {
    console.error('Error uploading task icon:', error);
    showAppwriteError(error);
    throw error;
  }
}

export async function deleteTaskIcon(iconId: string): Promise<void> {
  const bucketId = requireBucketId();

  try {
    await storage.deleteFile({
      bucketId,
      fileId: iconId,
    });
    showSuccess('Task icon deleted successfully.');
  } catch (error) {
    console.error('Error deleting task icon:', error);
    showAppwriteError(error);
    throw error;
  }
}
