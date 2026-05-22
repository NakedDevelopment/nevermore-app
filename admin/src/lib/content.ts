import { storage, tablesDB } from './appwrite';
import { Query, ID } from 'appwrite';
import { showAppwriteError, showSuccess } from './notifications';
import {
  fileExceedsMaxUpload,
  formatFileSize,
  getConfiguredMaxUploadBytes,
} from './uploadLimits';

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const CONTENT_COLLECTION_ID = import.meta.env.VITE_APPWRITE_CONTENT_COLLECTION_ID || 'content';
const STORAGE_BUCKET_ID = import.meta.env.VITE_APPWRITE_STORAGE_BUCKET_ID || '';

export interface ContentData {
  title: string;
  category?: string; // Category ID (relationship - Many to one)
  type: string; // Enum: required field
  images?: string[]; // Array of URLs
  files?: string[];
  recoveryQuestionFiles?: string[];
  supportQuestionFiles?: string[];
  transcript?: string; // Single URL (deprecated, use transcripts)
  transcripts?: string[]; // Array of URLs (for multiple transcript files)
  tasks?: string[]; // Array of strings (for 40 Day Journey)
  day?: number; // Day number (for 40 Day Journey)
  // New fields for 40 Temptations
  mainContentRecoveryURL?: string; // Single URL for Main Content (Recovery) audio
  mainContentSupportURL?: string; // Single URL for Main Content (Support) audio
  transcriptRecoveryText?: string; // In-app Recovery transcript (plain text)
  transcriptSupportText?: string; // In-app Support transcript (plain text)
  recoveryImages?: string[]; // Array of URLs for Recovery images
  supportImages?: string[]; // Array of URLs for Support images
}

export interface UploadedFile {
  fileId: string;
  url: string;
}

/**
 * Extract file ID and bucket ID from Appwrite storage URL
 */
function extractFileInfoFromUrl(url: string): { bucketId: string; fileId: string } | null {
  try {
    // Appwrite URL pattern: /storage/buckets/{bucketId}/files/{fileId}/view
    const match = url.match(/\/buckets\/([^/]+)\/files\/([^/]+)/);
    if (match && match[1] && match[2]) {
      return { bucketId: match[1], fileId: match[2] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get file name from Appwrite storage URL
 */
export async function getFileNameFromUrl(url: string): Promise<string | null> {
  const fileInfo = extractFileInfoFromUrl(url);
  if (!fileInfo) {
    return null;
  }

  try {
    const file = await storage.getFile({
      bucketId: fileInfo.bucketId,
      fileId: fileInfo.fileId,
    });
    return file.name;
  } catch (error) {
    console.error('Error fetching file name:', error);
    return null;
  }
}

/**
 * Upload a single file to Appwrite Storage
 */
export async function uploadFile(
  file: File,
  bucketId: string = STORAGE_BUCKET_ID
): Promise<UploadedFile> {
  if (!bucketId) {
    throw new Error(
      'VITE_APPWRITE_STORAGE_BUCKET_ID is not set in environment variables. Please add it to your .env file.'
    );
  }

  const maxBytes = getConfiguredMaxUploadBytes();
  if (fileExceedsMaxUpload(file, maxBytes)) {
    const err = new Error(
      `"${file.name}" is ${formatFileSize(file.size)}. The maximum size per file is ${formatFileSize(maxBytes)}. Use a smaller file or ask your administrator to raise the limit.`
    );
    showAppwriteError(err);
    throw err;
  }

  try {
    // Create a unique file ID
    const fileId = ID.unique();
    
    // Upload file to storage
    const response = await storage.createFile({
      bucketId,
      fileId,
      file
    });
    
    // Get the file URL using Appwrite Storage API
    // getFileView returns a URL string that can be used to view the file
    const fileUrl = storage.getFileView({
      bucketId,
      fileId: response.$id
    });
    
    return {
      fileId: response.$id,
      url: fileUrl.toString(),
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Upload multiple files to Appwrite Storage
 */
export async function uploadFiles(
  files: File[],
  bucketId: string = STORAGE_BUCKET_ID
): Promise<UploadedFile[]> {
  if (files.length === 0) {
    return [];
  }

  // Upload all files in parallel
  const uploadPromises = files.map((file) => uploadFile(file, bucketId));
  
  try {
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Error uploading files:', error);
    throw error;
  }
}

/**
 * Create content document in Appwrite Database
 */
export async function createContent(contentData: ContentData): Promise<string> {
  // Validate environment variables
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!CONTENT_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    // Validate required fields
    if (!contentData.type) {
      throw new Error('Content type is required');
    }

    // Prepare the document data
    const documentData: Record<string, unknown> = {
      title: contentData.title,
      type: contentData.type, // Required field
    };

    // Add optional fields if they exist
    if (contentData.category) {
      documentData.category = contentData.category; // Category ID for relationship
    }

    if (contentData.images && contentData.images.length > 0) {
      documentData.images = contentData.images;
    }

    if (contentData.files && contentData.files.length > 0) {
      documentData.files = contentData.files;
    }

    if (contentData.tasks && contentData.tasks.length > 0) {
      documentData.tasks = contentData.tasks;
    }

    if (contentData.day !== undefined) {
      documentData.day = contentData.day;
    }

    if (contentData.transcript) {
      documentData.transcript = contentData.transcript;
    }

    if (contentData.transcripts && contentData.transcripts.length > 0) {
      documentData.transcripts = contentData.transcripts;
    }

    // Add new fields for 40 Temptations
    if (contentData.mainContentRecoveryURL) {
      documentData.mainContentRecoveryURL = contentData.mainContentRecoveryURL;
    }

    if (contentData.mainContentSupportURL) {
      documentData.mainContentSupportURL = contentData.mainContentSupportURL;
    }

    if (contentData.transcriptRecoveryText !== undefined) {
      const t =
        typeof contentData.transcriptRecoveryText === 'string'
          ? contentData.transcriptRecoveryText.trim()
          : '';
      if (t.length > 0) {
        documentData.transcriptRecoveryText = t;
      }
    }

    if (contentData.transcriptSupportText !== undefined) {
      const t =
        typeof contentData.transcriptSupportText === 'string'
          ? contentData.transcriptSupportText.trim()
          : '';
      if (t.length > 0) {
        documentData.transcriptSupportText = t;
      }
    }

    if (contentData.recoveryImages && contentData.recoveryImages.length > 0) {
      documentData.recoveryImages = contentData.recoveryImages;
    }

    if (contentData.supportImages && contentData.supportImages.length > 0) {
      documentData.supportImages = contentData.supportImages;
    }

    if (contentData.recoveryQuestionFiles && contentData.recoveryQuestionFiles.length > 0) {
      documentData.recoveryQuestionFiles = contentData.recoveryQuestionFiles;
    }

    if (contentData.supportQuestionFiles && contentData.supportQuestionFiles.length > 0) {
      documentData.supportQuestionFiles = contentData.supportQuestionFiles;
    }

    // Create the row
    const response = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      rowId: ID.unique(),
      data: documentData
    });

    console.log('Content created successfully:', response.$id);
    return response.$id;
  } catch (error) {
    console.error('Error creating content:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Files for 40 Temptations content type
 */
export interface TemptationFiles {
  mainContentRecoveryFile?: File | null;
  mainContentSupportFile?: File | null;
  questionRecoveryFiles?: File[];
  questionSupportFiles?: File[];
  recoveryImageFiles?: File[];
  supportImageFiles?: File[];
}

/**
 * Upload files and create content in one operation
 */
export async function publishContent(
  contentData: ContentData,
  imageFiles: File[],
  audioFiles: File[],
  transcriptFile: File | null,
  transcriptFiles?: File[],
  tasks?: string[],
  onProgress?: (progress: number) => void,
  temptationFiles?: TemptationFiles
): Promise<string> {
  try { 
    // Calculate total steps based on what needs to be uploaded
    let totalSteps = 1; // +1 for creating content
    
    // For 40 Temptations with new file structure
    if (temptationFiles) {
      if (temptationFiles.questionRecoveryFiles && temptationFiles.questionRecoveryFiles.length > 0) totalSteps++;
      if (temptationFiles.questionSupportFiles && temptationFiles.questionSupportFiles.length > 0) totalSteps++;
      if (temptationFiles.mainContentRecoveryFile) totalSteps++;
      if (temptationFiles.mainContentSupportFile) totalSteps++;
      if (temptationFiles.recoveryImageFiles && temptationFiles.recoveryImageFiles.length > 0) totalSteps++;
      if (temptationFiles.supportImageFiles && temptationFiles.supportImageFiles.length > 0) totalSteps++;
    } else {
      // Legacy file handling
      if (imageFiles.length > 0) totalSteps++;
      if (audioFiles.length > 0) totalSteps++;
      if (transcriptFile) totalSteps++;
      if (transcriptFiles && transcriptFiles.length > 0) totalSteps++;
    }

    let currentStep = 0;

    // Variables for URLs
    let imageUrls: string[] = [];
    let audioUrls: string[] = [];
    let transcriptUrl: string | undefined;
    let transcriptUrls: string[] = [];
    let mainContentRecoveryURL: string | undefined;
    let mainContentSupportURL: string | undefined;
    let recoveryImageUrls: string[] = [];
    let supportImageUrls: string[] = [];
    let recoveryQuestionUrls: string[] = [];
    let supportQuestionUrls: string[] = [];

    // Handle 40 Temptations file structure
    if (temptationFiles) {

      // Upload Recovery question audio files
      if (temptationFiles.questionRecoveryFiles && temptationFiles.questionRecoveryFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedAudio = await uploadFiles(temptationFiles.questionRecoveryFiles);
        recoveryQuestionUrls = uploadedAudio.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload Support question audio files
      if (temptationFiles.questionSupportFiles && temptationFiles.questionSupportFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedAudio = await uploadFiles(temptationFiles.questionSupportFiles);
        supportQuestionUrls = uploadedAudio.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      audioUrls = [...recoveryQuestionUrls, ...supportQuestionUrls];

      // Upload Main Content (Recovery)
      if (temptationFiles.mainContentRecoveryFile) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploaded = await uploadFile(temptationFiles.mainContentRecoveryFile);
        mainContentRecoveryURL = uploaded.url;
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload Main Content (Support)
      if (temptationFiles.mainContentSupportFile) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploaded = await uploadFile(temptationFiles.mainContentSupportFile);
        mainContentSupportURL = uploaded.url;
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload Recovery images
      if (temptationFiles.recoveryImageFiles && temptationFiles.recoveryImageFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedRecoveryImages = await uploadFiles(temptationFiles.recoveryImageFiles);
        recoveryImageUrls = uploadedRecoveryImages.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload Support images
      if (temptationFiles.supportImageFiles && temptationFiles.supportImageFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedSupportImages = await uploadFiles(temptationFiles.supportImageFiles);
        supportImageUrls = uploadedSupportImages.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

    } else {
      // Legacy file handling for backward compatibility
      // Upload images
      if (imageFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedImages = await uploadFiles(imageFiles);
        imageUrls = uploadedImages.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload audio files
      if (audioFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedAudio = await uploadFiles(audioFiles);
        audioUrls = uploadedAudio.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload single transcript (for backward compatibility)
      if (transcriptFile) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedTranscript = await uploadFile(transcriptFile);
        transcriptUrl = uploadedTranscript.url;
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }

      // Upload multiple transcripts
      if (transcriptFiles && transcriptFiles.length > 0) {
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
        const uploadedTranscripts = await uploadFiles(transcriptFiles);
        transcriptUrls = uploadedTranscripts.map((file) => file.url);
        currentStep++;
        onProgress?.(Math.round((currentStep / totalSteps) * 100));
      }
    }

    // Create content document
    onProgress?.(Math.round((currentStep / totalSteps) * 100));
    const contentId = await createContent({
      ...contentData,
      images: imageUrls.length > 0 ? imageUrls : undefined,
      files: audioUrls.length > 0 ? audioUrls : undefined, // Store question audio files in 'files' array
      transcript: transcriptUrl,
      transcripts: transcriptUrls.length > 0 ? transcriptUrls : undefined,
      tasks: tasks && tasks.length > 0 ? tasks : undefined,
      mainContentRecoveryURL,
      mainContentSupportURL,
      recoveryImages: recoveryImageUrls.length > 0 ? recoveryImageUrls : undefined,
      supportImages: supportImageUrls.length > 0 ? supportImageUrls : undefined,
      recoveryQuestionFiles:
        recoveryQuestionUrls.length > 0 ? recoveryQuestionUrls : undefined,
      supportQuestionFiles:
        supportQuestionUrls.length > 0 ? supportQuestionUrls : undefined,
    });
    currentStep++;
    onProgress?.(100);

    showSuccess('Content published successfully!');
    return contentId;
  } catch (error) {
    console.error('Error publishing content:', error);
    throw error;
  }
}

/**
 * Content document from Appwrite
 */
export interface ContentDocument {
  $id: string;
  title: string;
  category?: string; // Category ID (relationship)
  type: string; // Enum: forty_day_journey, forty_temptations
  images?: string[];
  files?: string[]; // Legacy combined question audio URLs
  recoveryQuestionFiles?: string[];
  supportQuestionFiles?: string[];
  transcript?: string; // Single URL (deprecated, use transcripts)
  transcripts?: string[]; // Array of URLs (for multiple transcript files)
  tasks?: string[];
  day?: number; // Day number (for 40 Day Journey)
  // New fields for 40 Temptations
  mainContentRecoveryURL?: string;
  mainContentSupportURL?: string;
  transcriptRecoveryText?: string;
  transcriptSupportText?: string;
  recoveryImages?: string[];
  supportImages?: string[];
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Update content document in Appwrite Database
 */
export async function updateContent(
  contentId: string,
  contentData: ContentData
): Promise<string> {
  // Validate environment variables
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!CONTENT_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    // Validate required fields
    if (!contentData.type) {
      throw new Error('Content type is required');
    }

    // Prepare the document data
    const documentData: Record<string, unknown> = {
      title: contentData.title,
      type: contentData.type, // Required field
    };

    // Add optional fields if they exist
    if (contentData.category) {
      documentData.category = contentData.category; // Category ID for relationship
    }

    if (contentData.images && contentData.images.length > 0) {
      documentData.images = contentData.images;
    } else {
      documentData.images = []; // Clear images if empty
    }

    if (contentData.files && contentData.files.length > 0) {
      documentData.files = contentData.files;
    } else {
      documentData.files = []; // Clear files if empty
    }

    if (contentData.tasks && contentData.tasks.length > 0) {
      documentData.tasks = contentData.tasks;
    }

    if (contentData.day !== undefined) {
      documentData.day = contentData.day;
    }

    // Handle new fields for 40 Temptations
    if (contentData.mainContentRecoveryURL) {
      documentData.mainContentRecoveryURL = contentData.mainContentRecoveryURL;
    } else {
      documentData.mainContentRecoveryURL = null;
    }

    if (contentData.mainContentSupportURL) {
      documentData.mainContentSupportURL = contentData.mainContentSupportURL;
    } else {
      documentData.mainContentSupportURL = null;
    }

    if (contentData.transcriptRecoveryText !== undefined) {
      const t =
        typeof contentData.transcriptRecoveryText === 'string'
          ? contentData.transcriptRecoveryText.trim()
          : '';
      documentData.transcriptRecoveryText = t.length > 0 ? t : null;
    }

    if (contentData.transcriptSupportText !== undefined) {
      const t =
        typeof contentData.transcriptSupportText === 'string'
          ? contentData.transcriptSupportText.trim()
          : '';
      documentData.transcriptSupportText = t.length > 0 ? t : null;
    }

    if (contentData.recoveryImages) {
      documentData.recoveryImages = contentData.recoveryImages;
    } else {
      documentData.recoveryImages = null;
    }

    if (contentData.supportImages) {
      documentData.supportImages = contentData.supportImages;
    } else {
      documentData.supportImages = null;
    }

    if (contentData.recoveryQuestionFiles) {
      documentData.recoveryQuestionFiles = contentData.recoveryQuestionFiles;
    } else {
      documentData.recoveryQuestionFiles = null;
    }

    if (contentData.supportQuestionFiles) {
      documentData.supportQuestionFiles = contentData.supportQuestionFiles;
    } else {
      documentData.supportQuestionFiles = null;
    }

    // Update the row
    const response = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      rowId: contentId,
      data: documentData
    });

    console.log('Content updated successfully:', response.$id);
    return response.$id;
  } catch (error) {
    console.error('Error updating content:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Update content with file uploads
 */
export async function updateContentWithFiles(
  contentId: string,
  contentData: ContentData,
  imageFiles: File[],
  audioFiles: File[],
  transcriptFile: File | null,
  tasks?: string[],
  onProgress?: (progress: number) => void,
  _existingImageUrls?: string[],
  existingAudioUrls?: string[],
  existingTranscriptUrl?: string | null
): Promise<string> {
  try { 
    const totalSteps = 
      (imageFiles.length > 0 ? 1 : 0) +
      (audioFiles.length > 0 ? 1 : 0) +
      (transcriptFile ? 1 : 0) +
      1; // +1 for updating content
    let currentStep = 0;

    // Upload new images
    let _newImageUrls: string[] = [];
    if (imageFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedImages = await uploadFiles(imageFiles);
      _newImageUrls = uploadedImages.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }


    // Upload new audio files
    let newAudioUrls: string[] = [];
    if (audioFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedAudio = await uploadFiles(audioFiles);
      newAudioUrls = uploadedAudio.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Combine existing audio URLs with new ones
    const allAudioUrls = [...(existingAudioUrls || []), ...newAudioUrls];

    // Upload new transcript
    let newTranscriptUrl: string | undefined;
    if (transcriptFile) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedTranscript = await uploadFile(transcriptFile);
      newTranscriptUrl = uploadedTranscript.url;
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Use new transcript URL if uploaded, otherwise keep existing one
    const finalTranscriptUrl = newTranscriptUrl || existingTranscriptUrl || undefined;

    // Update content document
    onProgress?.(Math.round((currentStep / totalSteps) * 100));
    await updateContent(contentId, {
      ...contentData,
      images: _newImageUrls.length > 0 ? _newImageUrls : undefined,
      files: allAudioUrls.length > 0 ? allAudioUrls : undefined, // Store audio files in 'files' array
      transcript: finalTranscriptUrl,
      tasks: tasks && tasks.length > 0 ? tasks : undefined,
    });
    currentStep++;
    onProgress?.(100);

    showSuccess('Content updated successfully!');
    return contentId;
  } catch (error) {
    console.error('Error updating content:', error);
    throw error;
  }
}

/**
 * Existing URLs for temptation content update
 */
export interface ExistingTemptationUrls {
  questionRecoveryUrls?: string[];
  questionSupportUrls?: string[];
  mainContentSupportURL?: string | null;
  mainContentRecoveryURL?: string | null;
  recoveryImageUrls?: string[];
  supportImageUrls?: string[];
}

/**
 * Update temptation content with new file structure
 */
export async function updateTemptationContent(
  contentId: string,
  contentData: ContentData,
  temptationFiles: TemptationFiles,
  existingUrls: ExistingTemptationUrls,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Calculate total steps
    let totalSteps = 1; // +1 for updating content
    if (temptationFiles.questionRecoveryFiles && temptationFiles.questionRecoveryFiles.length > 0) totalSteps++;
    if (temptationFiles.questionSupportFiles && temptationFiles.questionSupportFiles.length > 0) totalSteps++;
    if (temptationFiles.mainContentSupportFile) totalSteps++;
    if (temptationFiles.mainContentRecoveryFile) totalSteps++;
    if (temptationFiles.recoveryImageFiles && temptationFiles.recoveryImageFiles.length > 0) totalSteps++;
    if (temptationFiles.supportImageFiles && temptationFiles.supportImageFiles.length > 0) totalSteps++;
    let currentStep = 0;

    // Variables for URLs
    let newQuestionRecoveryUrls: string[] = [];
    let newQuestionSupportUrls: string[] = [];
    let mainContentSupportURL: string | undefined;
    let mainContentRecoveryURL: string | undefined;
    let newRecoveryImageUrls: string[] = [];
    let newSupportImageUrls: string[] = [];


    // Upload new Recovery question audio files
    if (temptationFiles.questionRecoveryFiles && temptationFiles.questionRecoveryFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedQuestions = await uploadFiles(temptationFiles.questionRecoveryFiles);
      newQuestionRecoveryUrls = uploadedQuestions.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Upload new Support question audio files
    if (temptationFiles.questionSupportFiles && temptationFiles.questionSupportFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedQuestions = await uploadFiles(temptationFiles.questionSupportFiles);
      newQuestionSupportUrls = uploadedQuestions.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Upload Main Content (Support)
    if (temptationFiles.mainContentSupportFile) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploaded = await uploadFile(temptationFiles.mainContentSupportFile);
      mainContentSupportURL = uploaded.url;
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Upload Main Content (Recovery)
    if (temptationFiles.mainContentRecoveryFile) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploaded = await uploadFile(temptationFiles.mainContentRecoveryFile);
      mainContentRecoveryURL = uploaded.url;
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Upload Recovery images
    if (temptationFiles.recoveryImageFiles && temptationFiles.recoveryImageFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedRecoveryImages = await uploadFiles(temptationFiles.recoveryImageFiles);
      newRecoveryImageUrls = uploadedRecoveryImages.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Upload Support images
    if (temptationFiles.supportImageFiles && temptationFiles.supportImageFiles.length > 0) {
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
      const uploadedSupportImages = await uploadFiles(temptationFiles.supportImageFiles);
      newSupportImageUrls = uploadedSupportImages.map((file) => file.url);
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    }

    // Combine existing URLs with new ones
    const allQuestionRecoveryUrls = [
      ...(existingUrls.questionRecoveryUrls || []),
      ...newQuestionRecoveryUrls,
    ];
    const allQuestionSupportUrls = [
      ...(existingUrls.questionSupportUrls || []),
      ...newQuestionSupportUrls,
    ];
    const allQuestionUrlsCombined = [...allQuestionRecoveryUrls, ...allQuestionSupportUrls];
    const allRecoveryImageUrls = [...(existingUrls.recoveryImageUrls || []), ...newRecoveryImageUrls];
    const allSupportImageUrls = [...(existingUrls.supportImageUrls || []), ...newSupportImageUrls];

    // Use new URL if uploaded, otherwise keep existing
    const finalMainContentSupportURL = mainContentSupportURL || existingUrls.mainContentSupportURL || undefined;
    const finalMainContentRecoveryURL = mainContentRecoveryURL || existingUrls.mainContentRecoveryURL || undefined;

    // Update content document
    onProgress?.(Math.round((currentStep / totalSteps) * 100));
    await updateContent(contentId, {
      ...contentData,
      images: undefined, // No general images for temptations
      files: allQuestionUrlsCombined.length > 0 ? allQuestionUrlsCombined : undefined,
      recoveryQuestionFiles:
        allQuestionRecoveryUrls.length > 0 ? allQuestionRecoveryUrls : undefined,
      supportQuestionFiles:
        allQuestionSupportUrls.length > 0 ? allQuestionSupportUrls : undefined,
      mainContentSupportURL: finalMainContentSupportURL,
      mainContentRecoveryURL: finalMainContentRecoveryURL,
      recoveryImages: allRecoveryImageUrls.length > 0 ? allRecoveryImageUrls : undefined,
      supportImages: allSupportImageUrls.length > 0 ? allSupportImageUrls : undefined,
    });
    currentStep++;
    onProgress?.(100);

    showSuccess('Content updated successfully!');
    return contentId;
  } catch (error) {
    console.error('Error updating temptation content:', error);
    throw error;
  }
}

/**
 * Delete a content document and all associated files
 */
export async function deleteContent(contentId: string): Promise<void> {
  if (!DATABASE_ID || !CONTENT_COLLECTION_ID) {
    throw new Error('Database configuration is missing');
  }

  try {
    // First fetch the content to get all file URLs
    const content = await fetchContentById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Collect all file URLs to delete
    const fileUrls: string[] = [];
    
    if (content.images) fileUrls.push(...content.images);
    if (content.files) fileUrls.push(...content.files);
    if (content.transcript) fileUrls.push(content.transcript);
    if (content.transcripts) fileUrls.push(...content.transcripts);
    if (content.mainContentRecoveryURL) fileUrls.push(content.mainContentRecoveryURL);
    if (content.mainContentSupportURL) fileUrls.push(content.mainContentSupportURL);
    if (content.recoveryImages) fileUrls.push(...content.recoveryImages);
    if (content.supportImages) fileUrls.push(...content.supportImages);
    if (content.recoveryQuestionFiles) fileUrls.push(...content.recoveryQuestionFiles);
    if (content.supportQuestionFiles) fileUrls.push(...content.supportQuestionFiles);

    const uniqueFileUrls = [...new Set(fileUrls)];
    // Delete all files from storage
    for (const url of uniqueFileUrls) {
      const fileInfo = extractFileInfoFromUrl(url);
      if (fileInfo) {
        try {
          await storage.deleteFile({
            bucketId: fileInfo.bucketId,
            fileId: fileInfo.fileId,
          });
        } catch (fileError) {
          // Log but continue - file might already be deleted
          console.warn(`Failed to delete file: ${url}`, fileError);
        }
      }
    }

    // Delete the document from the database
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      rowId: contentId,
    });

    showSuccess('Content deleted successfully');
  } catch (error) {
    console.error('Error deleting content:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Fetch a single content document by ID
 */
export async function fetchContentById(contentId: string): Promise<ContentDocument | null> {
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!CONTENT_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    const response = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      rowId: contentId,
    });

    return response as unknown as ContentDocument;
  } catch (error) {
    console.error('Error fetching content:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Fetch all content documents from Appwrite
 */
export async function fetchContent(
  limit?: number,
  offset?: number,
  searchQuery?: string,
  filters?: {
    category?: string;
    type?: string;
  }
): Promise<{ documents: ContentDocument[]; total: number }> {
  // Validate environment variables
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!CONTENT_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    const queries: string[] = [];

    // Add pagination queries
    if (limit !== undefined) {
      queries.push(Query.limit(limit));
    }
    if (offset !== undefined) {
      queries.push(Query.offset(offset));
    }

    // Add search query if provided
    // Using Query.contains() instead of Query.search() to avoid requiring a fulltext index
    if (searchQuery && searchQuery.trim()) {
      queries.push(Query.contains('title', searchQuery.trim()));
    }

    // Add filters
    if (filters?.category) {
      queries.push(Query.equal('category', filters.category));
    }
    if (filters?.type) {
      // Map display type to database type
      const typeMap: Record<string, string> = {
        '40-temptations': 'forty_temptations',
        '40-day-journey': 'forty_day_journey',
      };
      const dbType = typeMap[filters.type] || filters.type;
      queries.push(Query.equal('type', dbType));
    }

    // Order by creation date (newest first)
    queries.push(Query.orderDesc('$createdAt'));

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      queries
    });

    return {
      documents: response.rows as unknown as ContentDocument[],
      total: response.total,
    };
  } catch (error) {
    console.error('Error fetching content:', error);
    showAppwriteError(error);
    throw error;
  }
}

/**
 * Returns another 40-day journey document that already uses this day number, if any.
 * Pass excludeContentId when editing so the current document is not treated as a conflict.
 */
export async function fetchFortyDayJourneyByDay(
  dayNumber: number,
  excludeContentId?: string,
  options?: { silent?: boolean }
): Promise<ContentDocument | null> {
  if (!DATABASE_ID) {
    const error = new Error(
      'VITE_APPWRITE_DATABASE_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  if (!CONTENT_COLLECTION_ID) {
    const error = new Error(
      'VITE_APPWRITE_CONTENT_COLLECTION_ID is not set in environment variables. Please add it to your .env file.'
    );
    console.error('Configuration Error:', error.message);
    throw error;
  }

  try {
    const queries: string[] = [
      Query.equal('type', 'forty_day_journey'),
      Query.equal('day', dayNumber),
      Query.limit(25),
    ];

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CONTENT_COLLECTION_ID,
      queries,
    });

    const rows = (response.rows as unknown as ContentDocument[]).filter(
      (row) => row.$id !== excludeContentId
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching journey by day:', error);
    if (!options?.silent) {
      showAppwriteError(error);
    }
    throw error;
  }
}

