import { useState, useRef, useEffect, useId } from 'react';
import CloudUploadIcon from '../assets/icons/cloud-upload';
import CloseIcon from '../assets/icons/close';
import { Button } from './Button';
import { showWarning } from '../lib/notifications';
import {
  fileExceedsMaxUpload,
  formatFileSize,
  getConfiguredMaxUploadBytes,
} from '../lib/uploadLimits';

export interface TranscriptFile {
  id: string;
  file: File;
  progress: number;
}

export interface TranscriptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: TranscriptFile[]) => void | Promise<void>;
  accept?: string;
  supportedFormats?: string;
}

export const TranscriptUploadModal: React.FC<TranscriptUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  accept = '.pdf,.doc,.docx,.txt,.rtf,.odt',
  supportedFormats = 'PDF, DOC, DOCX, TXT, RTF, ODT',
}) => {
  const [uploadFiles, setUploadFiles] = useState<TranscriptFile[]>([]);
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

  const addFiles = (files: File[]) => {
    const maxUploadBytes = getConfiguredMaxUploadBytes();
    const accepted: File[] = [];
    let oversizedCount = 0;
    for (const file of files) {
      if (fileExceedsMaxUpload(file, maxUploadBytes)) {
        oversizedCount++;
        continue;
      }
      accepted.push(file);
    }
    if (oversizedCount > 0) {
      showWarning(
        `${oversizedCount} file(s) were not added — each must be ${formatFileSize(maxUploadBytes)} or smaller. Use smaller or compressed files, or ask your administrator to raise the upload limit.`
      );
    }
    if (accepted.length === 0) {
      return;
    }

    const newFiles: TranscriptFile[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random()}-${file.name}`,
      file,
      progress: 0,
    }));

    setUploadFiles((prev) => [...prev, ...newFiles]);

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
          UPLOAD
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
          <div className="flex flex-col gap-4">
            <label
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Uploading
            </label>
            <div className="flex flex-col gap-3 overflow-y-auto overflow-x-hidden max-h-[300px] pr-2 custom-scrollbar min-h-0">
              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] rounded-[16px] pt-4 px-4 pb-0 flex flex-col gap-3 items-start min-w-0"
                >
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
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {uploadFiles.length > 0 && (
          <Button
            className="w-full h-[56px]"
            onClick={handleUpload}
            disabled={uploadFiles.some((f) => f.progress < 100)}
          >
            Upload File
          </Button>
        )}
      </div>
    </div>
  );
};

