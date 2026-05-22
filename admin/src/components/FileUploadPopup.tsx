import { useState, useRef, useEffect, useId } from 'react';
import CloudUploadIcon from '../assets/icons/cloud-upload';
import CloseIcon from '../assets/icons/close';
import { Select } from './Select';
import type { SelectOption } from './Select';
import { Button } from './Button';
import { showWarning } from '../lib/notifications';
import {
  fileExceedsMaxUpload,
  formatFileSize,
  getConfiguredMaxUploadBytes,
} from '../lib/uploadLimits';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  contentType: string;
}

export interface FileUploadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: UploadFile[]) => void | Promise<void>;
  accept?: string;
  contentTypes: SelectOption[];
  /**
   * Optional hint to force the initial content type for newly added files.
   * Used to fix transcript flows (e.g. "Upload Recovery Transcript").
   */
  preferredContentType?: string | null;
  maxFiles?: number;
  title?: string;
  supportedFormats?: string;
}

export const FileUploadPopup: React.FC<FileUploadPopupProps> = ({
  isOpen,
  onClose,
  onUpload,
  accept = '*',
  contentTypes,
  preferredContentType = null,
  maxFiles,
  title = 'Upload',
  supportedFormats = 'JPEG, PNG, GIF, MP4, PDF, PSD, AI, Word, PPT',
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset files when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUploadFiles([]);
    }
  }, [isOpen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Detects the file type and returns the appropriate content type
   */
  const detectContentType = (file: File): string => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // Check for image files
    if (
      fileType.startsWith('image/') ||
      fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i)
    ) {
      // If preferredContentType is set and it's an image type, use that
      if (preferredContentType && 
          (preferredContentType === 'recoveryImage' || preferredContentType === 'supportImage') &&
          contentTypes.some(ct => ct.value === preferredContentType)) {
        return preferredContentType;
      }
      // Check if 'image' content type exists in options
      if (contentTypes.some(ct => ct.value === 'image')) {
        return 'image';
      }
      // Check for recovery/support image types
      if (contentTypes.some(ct => ct.value === 'recoveryImage')) {
        return 'recoveryImage';
      }
      if (contentTypes.some(ct => ct.value === 'supportImage')) {
        return 'supportImage';
      }
    }

    // Check for audio files
    if (
      fileType.startsWith('audio/') ||
      fileName.match(/\.(mp3|wav|m4a|aac|ogg|flac|wma|opus)$/i)
    ) {
      if (
        preferredContentType &&
        (preferredContentType === 'questionRecovery' ||
          preferredContentType === 'questionSupport') &&
        contentTypes.some((ct) => ct.value === preferredContentType)
      ) {
        return preferredContentType;
      }
      const hasQuestionRecovery = contentTypes.some((ct) => ct.value === 'questionRecovery');
      const hasQuestionSupport = contentTypes.some((ct) => ct.value === 'questionSupport');
      if (hasQuestionRecovery && hasQuestionSupport) {
        return 'questionRecovery';
      }
      if (hasQuestionRecovery) {
        return 'questionRecovery';
      }
      if (hasQuestionSupport) {
        return 'questionSupport';
      }
      if (contentTypes.some((ct) => ct.value === 'question')) {
        return 'question';
      }
      if (contentTypes.some((ct) => ct.value === 'audio')) {
        return 'audio';
      }
    }

    // Check for document files (map to transcript only if those types exist in this popup)
    if (
      fileType.includes('pdf') ||
      fileType.includes('document') ||
      fileType.includes('msword') ||
      fileType.includes('wordprocessingml') ||
      fileType.includes('presentation') ||
      fileType.includes('powerpoint') ||
      fileName.match(/\.(pdf|doc|docx|txt|psd|ai|ppt|pptx|rtf|odt)$/i)
    ) {
      if (contentTypes.some(ct => ct.value === 'supportTranscript')) {
        return 'supportTranscript';
      }
      if (contentTypes.some(ct => ct.value === 'transcript')) {
        return 'transcript';
      }
      if (contentTypes.some(ct => ct.value === 'question')) {
        return 'question';
      }
    }

    // Default to first content type if available, otherwise empty
    return contentTypes.length > 0 ? contentTypes[0].value : '';
  };

  // Single-file content types (only one file allowed per type)
  const singleFileTypes = [
    'mainContentSupport',
    'mainContentRecovery',
    'transcript', // Legacy
  ];

  const transcriptTypes = ['supportTranscript', 'recoveryTranscript'].filter((t) =>
    contentTypes.some((ct) => ct.value === t)
  );

  const addFiles = (files: File[]) => {
    // Create UploadFile objects with auto-detected content types
    const newFiles: UploadFile[] = [];
    let discardedCount = 0;
    let oversizedCount = 0;
    const maxUploadBytes = getConfiguredMaxUploadBytes();

    const existingTranscriptCount = uploadFiles.filter((uf) =>
      transcriptTypes.includes(uf.contentType)
    ).length;

    let newTranscriptCount = 0;

    files.forEach((file) => {
      if (fileExceedsMaxUpload(file, maxUploadBytes)) {
        oversizedCount++;
        return;
      }

      const detectedType = detectContentType(file);
      
      // Check if this is a single-file type and if one already exists
      if (singleFileTypes.includes(detectedType)) {
        const hasExisting = uploadFiles.some(
          (uf) => uf.contentType === detectedType
        );
        const hasInNew = newFiles.some(
          (uf) => uf.contentType === detectedType
        );
        
        if (hasExisting || hasInNew) {
          discardedCount++;
          return; // Skip this file
        }
      }

      // Handle transcript files - allow max 2 total (one of each type)
      if (transcriptTypes.includes(detectedType)) {
        // If the parent opened the popup in a "specific transcript" mode,
        // force all added transcript files to that type.
        if (preferredContentType && transcriptTypes.includes(preferredContentType)) {
          const hasPreferredExisting = uploadFiles.some(
            (uf) => uf.contentType === preferredContentType
          );
          const hasPreferredInNew = newFiles.some(
            (uf) => uf.contentType === preferredContentType
          );

          if (hasPreferredExisting || hasPreferredInNew) {
            discardedCount++;
            return;
          }

          newFiles.push({
            id: `${Date.now()}-${Math.random()}`,
            file,
            progress: 0,
            contentType: preferredContentType,
          });
          newTranscriptCount++;
          return;
        }

        const totalTranscripts = existingTranscriptCount + newTranscriptCount;
        if (totalTranscripts >= 2) {
          discardedCount++;
          return; // Skip this file
        }
        
        // Assign alternating type if we already have one
        let assignedType = detectedType;
        const existingSupportTranscript = uploadFiles.some(uf => uf.contentType === 'supportTranscript') ||
          newFiles.some(uf => uf.contentType === 'supportTranscript');
        const existingRecoveryTranscript = uploadFiles.some(uf => uf.contentType === 'recoveryTranscript') ||
          newFiles.some(uf => uf.contentType === 'recoveryTranscript');
        
        if (existingSupportTranscript && !existingRecoveryTranscript) {
          assignedType = 'recoveryTranscript';
        } else if (!existingSupportTranscript && existingRecoveryTranscript) {
          assignedType = 'supportTranscript';
        }
        
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          progress: 0,
          contentType: assignedType,
        });
        newTranscriptCount++;
        return;
      }
      
      newFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        contentType: detectedType,
      });
    });

       if (oversizedCount > 0) {
      showWarning(
        `${oversizedCount} file(s) were not added — each must be ${formatFileSize(maxUploadBytes)} or smaller. Use smaller or compressed files, or ask your administrator to raise the upload limit.`
      );
    }

    // Show warning if files were discarded
    if (discardedCount > 0) {
      showWarning(
        `${discardedCount} file(s) discarded. Only one file per type is allowed for main content${
          transcriptTypes.length > 0 ? ', and max 2 transcript files when transcript types are enabled.' : '.'
        }`
      );
    }

    setUploadFiles((prev) => {
      const updated = [...prev, ...newFiles];
      // Limit to maxFiles if specified
      if (maxFiles && updated.length > maxFiles) {
        return updated.slice(0, maxFiles);
      }
      return updated;
    });

    // Simulate upload progress for each file
    newFiles.forEach((uploadFile) => {
      simulateUpload(uploadFile.id);
    });
  };

  const simulateUpload = (fileId: string) => {
    // Simulate progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
      );
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const updateContentType = (fileId: string, contentType: string) => {
    // Check if this type is single-file and already exists
    if (singleFileTypes.includes(contentType)) {
      const hasExisting = uploadFiles.some(
        (uf) => uf.id !== fileId && uf.contentType === contentType
      );
      if (hasExisting) {
        showWarning(`Only one ${contentType} file is allowed.`);
        return;
      }
    }

    // Check transcript types - prevent duplicate types
    if (transcriptTypes.includes(contentType)) {
      const hasExisting = uploadFiles.some(
        (uf) => uf.id !== fileId && uf.contentType === contentType
      );
      if (hasExisting) {
        showWarning(`Only one file per transcript type is allowed.`);
        return;
      }
    }

    setUploadFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, contentType } : f))
    );
  };

  const handleUpload = () => {
    onUpload(uploadFiles);
    // Optionally close after upload
    // onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal Content */}
      <div
        className="relative backdrop-blur-[10px] bg-[rgba(255,255,255,0.1)] rounded-[16px] p-8 w-[700px] max-w-[90vw] max-h-[90vh] flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          className="text-white text-[24px] leading-[normal] whitespace-nowrap"
          style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
        >
          {title}
        </h2>

        {/* Drag & Drop Area — label opens picker on iPad/iOS Safari (programmatic .click() on display:none inputs is blocked) */}
        <label
          htmlFor={fileInputId}
          className="bg-[rgba(150,92,223,0.1)] border border-[#965cdf] border-dashed rounded-[16px] p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition hover:bg-[rgba(150,92,223,0.15)]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CloudUploadIcon width={48} height={48} color="#fff" />
          <div className="text-center">
            <p
              className="text-white text-[16px] leading-[24px] mb-1"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
            >
              Drag & drop files or{' '}
              <span className="text-[#965cdf]">Browse</span>
            </p>
            <p
              className="text-[#8f8f8f] text-[12px] leading-[16px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Supported formats: {supportedFormats}
            </p>
            <p
              className="text-[#8f8f8f] text-[12px] leading-[16px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Maximum size: {formatFileSize(getConfiguredMaxUploadBytes())} per file
            </p>
          </div>
        </label>
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          tabIndex={-1}
        />

        {/* Uploading Files List - Scrollable */}
        {uploadFiles.length > 0 && (
          <div className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden max-h-[400px] pr-2 custom-scrollbar min-h-0 py-2">
            {uploadFiles.map((uploadFile) => (
              <div key={uploadFile.id} className="flex gap-6 items-start shrink-0 min-w-0">
                {/* File Info with Progress - Fixed width */}
                <div className="w-[380px] flex flex-col gap-2 shrink-0 min-w-0">
                  <label
                    className="text-white text-[14px] leading-[20px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Uploading
                  </label>
                  <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] rounded-[16px] pt-4 px-4 pb-0 flex flex-col gap-3 items-start min-w-0">
                    {/* File Name and Close Button */}
                    <div className="flex items-center justify-between w-full gap-2 min-w-0">
                      <p
                        className="text-white text-[16px] leading-[24px] truncate flex-1 min-w-0"
                        style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                        title={uploadFile.file.name}
                      >
                        {uploadFile.file.name}
                      </p>
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center cursor-pointer hover:opacity-80 transition"
                        aria-label="Remove file"
                      >
                        <CloseIcon
                          width={24}
                          height={24}
                          color="#8f8f8f"
                        />
                      </button>
                    </div>
                    {/* Progress Bar */}
                    <div className="bg-[rgba(255,255,255,0.07)] h-[4px] rounded-full overflow-hidden w-full">
                      <div
                        className="bg-[#965cdf] h-full transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Content Type Select - Fixed width */}
                <div className="w-[220px] flex flex-col gap-2 shrink-0">
                  <label
                    className="text-white text-[14px] leading-[20px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Content Type
                  </label>
                  <Select
                    options={contentTypes}
                    value={uploadFile.contentType}
                    onChange={(value) => updateContentType(uploadFile.id, value)}
                    placeholder="Select"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        {uploadFiles.length > 0 && (
          <Button
            className="w-full h-[56px]"
            onClick={handleUpload}
            disabled={uploadFiles.some((f) => f.progress < 100)}
          >
            Upload File(s)
          </Button>
        )}
      </div>
    </div>
  );
};

