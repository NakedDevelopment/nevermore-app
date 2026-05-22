import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ChevronLeftIcon from '../assets/icons/chevron-left';
import { Select } from '../components/Select';
import type { SelectOption } from '../components/Select';
import { Button } from '../components/Button';
import { AudioPlayer } from '../components/AudioPlayer';
import { FileUploadPopup, type UploadFile } from '../components/FileUploadPopup';
import { categoriesToSelectOptions } from '../lib/categories';
import { publishContent, type TemptationFiles } from '../lib/content';
import { showAppwriteError } from '../lib/notifications';
import DeleteIcon from '@/assets/icons/delete';
import { useCategoriesStore } from '../store/categoriesStore';

// Content type options for file upload
const contentTypeOptions: SelectOption[] = [
  { value: 'mainContentSupport', label: 'Main Content (Support)' },
  { value: 'mainContentRecovery', label: 'Main Content (Recovery)' },
  { value: 'questionRecovery', label: 'Question (Recovery)' },
  { value: 'questionSupport', label: 'Question (Support)' },
  { value: 'recoveryImage', label: 'Recovery Image' },
  { value: 'supportImage', label: 'Support Image' },
];

export const CreateTemptation = () => {
  const navigate = useNavigate();
  const { categories, isLoading: isLoadingCategories, error: categoriesError, loadCategories } = useCategoriesStore();

  const [contentTitle, setContentTitle] = useState('');
  const [categoryType, setCategoryType] = useState('');
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [uploadPreferredContentType, setUploadPreferredContentType] = useState<string | null>(null);
  
  // New file state based on content types
  const [questionRecoveryFiles, setQuestionRecoveryFiles] = useState<File[]>([]);
  const [questionSupportFiles, setQuestionSupportFiles] = useState<File[]>([]);
  const [mainContentSupportFile, setMainContentSupportFile] = useState<File | null>(null);
  const [mainContentRecoveryFile, setMainContentRecoveryFile] = useState<File | null>(null);
  const [transcriptSupportText, setTranscriptSupportText] = useState('');
  const [transcriptRecoveryText, setTranscriptRecoveryText] = useState('');
  const [recoveryImages, setRecoveryImages] = useState<Array<{ id: string; src: string; file: File }>>([]);
  const [supportImages, setSupportImages] = useState<Array<{ id: string; src: string; file: File }>>([]);

  // Fetch categories on mount (only once, centrally managed)
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Memoize category options and cards to avoid recalculation
  const categoryOptions = useMemo(() => categoriesToSelectOptions(categories), [categories]);

  const handleBack = () => {
    navigate('/content-management');
  };



  const handleUploadButtonClick = (preferredContentType?: string | null) => {
    setUploadPreferredContentType(preferredContentType ?? null);
    setIsUploadPopupOpen(true);
  };

  const handleUploadComplete = (uploadFiles: UploadFile[]) => {
    uploadFiles.forEach((uploadFile) => {
      switch (uploadFile.contentType) {
        case 'questionRecovery':
          setQuestionRecoveryFiles((prev) => [...prev, uploadFile.file]);
          break;
        case 'questionSupport':
          setQuestionSupportFiles((prev) => [...prev, uploadFile.file]);
          break;
        case 'mainContentSupport': {
          setMainContentSupportFile(uploadFile.file);
          // Auto-fill content title from main content support file name
          if (!contentTitle.trim()) {
            const fileName = uploadFile.file.name;
            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
            setContentTitle(nameWithoutExt);
          }
          break;
        }
        case 'mainContentRecovery':
          setMainContentRecoveryFile(uploadFile.file);
          break;
        case 'recoveryImage': {
          const reader = new FileReader();
          reader.onloadend = () => {
            setRecoveryImages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                src: reader.result as string,
                file: uploadFile.file,
              },
            ]);
          };
          reader.readAsDataURL(uploadFile.file);
          break;
        }
        case 'supportImage': {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSupportImages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                src: reader.result as string,
                file: uploadFile.file,
              },
            ]);
          };
          reader.readAsDataURL(uploadFile.file);
          break;
        }
      }
    });

    setIsUploadPopupOpen(false);
    setUploadPreferredContentType(null);
  };



  const handlePublish = async () => {
    // Validation
    if (!contentTitle.trim()) {
      showAppwriteError(new Error('Content title is required'));
      return;
    }

    if (!categoryType) {
      showAppwriteError(new Error('Category is required'));
      return;
    }


    if (!mainContentSupportFile) {
      showAppwriteError(new Error('Main Content (Support) is required'));
      return;
    }

    if (!mainContentRecoveryFile) {
      showAppwriteError(new Error('Main Content (Recovery) is required'));
      return;
    }

    if (!transcriptSupportText.trim()) {
      showAppwriteError(new Error('Support transcript text is required'));
      return;
    }

    if (!transcriptRecoveryText.trim()) {
      showAppwriteError(new Error('Recovery transcript text is required'));
      return;
    }

    if (questionRecoveryFiles.length === 0) {
      showAppwriteError(new Error('Please upload at least one Recovery question audio file'));
      return;
    }

    if (questionSupportFiles.length === 0) {
      showAppwriteError(new Error('Please upload at least one Support question audio file'));
      return;
    }

    setIsPublishing(true);
    setPublishProgress(0);

    try {
      const temptationFiles: TemptationFiles = {
        questionRecoveryFiles,
        questionSupportFiles,
        mainContentSupportFile,
        mainContentRecoveryFile,
        recoveryImageFiles: recoveryImages.map(img => img.file),
        supportImageFiles: supportImages.map(img => img.file),
      };
      
      await publishContent(
        {
          title: contentTitle.trim(),
          category: categoryType,
          type: 'forty_temptations',
          transcriptSupportText: transcriptSupportText.trim(),
          transcriptRecoveryText: transcriptRecoveryText.trim(),
        },
        [], // Legacy imageFiles
        [], // Legacy audioFiles
        null, // Legacy single transcript
        undefined, // Legacy multiple transcripts
        undefined, // tasks
        (progress) => {
          setPublishProgress(progress);
        },
        temptationFiles
      );

      navigate('/content-management');
    } catch (error) {
      console.error('Error publishing content:', error);
      setIsPublishing(false);
      setPublishProgress(0);
    }
  };

  const handleCancel = () => {
    navigate('/content-management');
  };

  return (
    <div className="bg-neutral-950 min-h-screen">
      {/* Header with Back Button and Title */}
      <div className="flex flex-col gap-3 px-4 pt-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:pt-9">
        <button
          onClick={handleBack}
          className="flex w-fit shrink-0 items-center gap-2 text-[#965cdf] text-[12px] hover:opacity-80 transition cursor-pointer" 
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          <ChevronLeftIcon width={24} height={24} color="#965cdf" />
          <span>Back</span>
        </button>
        <h1
          className="min-w-0 text-white text-[20px] leading-tight sm:ml-2 sm:text-[24px] md:ml-8"
          style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
        >
          40 TEMPTATIONS
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pt-6 pb-6 sm:px-8 sm:pt-9 sm:pb-8">
        <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] rounded-[16px] sm:rounded-[24px] p-4 sm:p-8">
          <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-16">
            {/* Left Column - Form Fields */}
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              {/* Content Title */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-white text-[14px] leading-[20px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Content Title
                  </label>
                  <input
                    value={contentTitle}
                    onChange={(e) => setContentTitle(e.target.value)}
                    placeholder="Enter content title"
                    className="w-full h-[56px] bg-transparent border border-[#965cdf] rounded-[16px] px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#965cdf] placeholder-[#616161]"
                    style={{ 
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '16px',
                      lineHeight: '24px'
                    }}
                  />
                </div>
              </div>

              {/* Category Type */}
              <div className="flex flex-col gap-2">
                <label className="text-white text-[14px] leading-[20px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  Category Type
                  {isLoadingCategories && (
                    <span className="text-[#8f8f8f] text-[12px] ml-2">(Loading...)</span>
                  )}
                  {categoriesError && (
                    <span className="text-red-400 text-[12px] ml-2" title={categoriesError}>
                      (Error - check console)
                    </span>
                  )}
                </label>
                <Select
                  options={categoryOptions}
                  value={categoryType}
                  onChange={setCategoryType}
                  placeholder={isLoadingCategories ? 'Loading categories...' : 'Select Category'}
                />
              </div>

              {/* Pre-defined Categories */}

              {/* Main Content Audio Players */}
              {(mainContentSupportFile || mainContentRecoveryFile) && (
                <div className="flex flex-col gap-4">
                  {mainContentSupportFile && (
                    <AudioPlayer
                      key="main-content-support"
                      label="Main Content (Support)"
                      file={mainContentSupportFile}
                      onRemove={() => setMainContentSupportFile(null)}
                    />
                  )}
                  {mainContentRecoveryFile && (
                    <AudioPlayer
                      key="main-content-recovery"
                      label="Main Content (Recovery)"
                      file={mainContentRecoveryFile}
                      onRemove={() => setMainContentRecoveryFile(null)}
                    />
                  )}
                </div>
              )}

              {/* Recovery question audio */}
              {questionRecoveryFiles.length > 0 && (
                <div className="flex flex-col gap-4">
                  <p
                    className="text-[#965cdf] text-[12px] leading-[16px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Recovery questions
                  </p>
                  {questionRecoveryFiles.map((file, index) => (
                    <AudioPlayer
                      key={`question-recovery-${file.name}-${index}`}
                      label={`Recovery question ${index + 1}`}
                      file={file}
                      onRemove={() => {
                        setQuestionRecoveryFiles((prev) => {
                          const newFiles = [...prev];
                          newFiles.splice(index, 1);
                          return newFiles;
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Support question audio */}
              {questionSupportFiles.length > 0 && (
                <div className="flex flex-col gap-4">
                  <p
                    className="text-[#965cdf] text-[12px] leading-[16px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Support questions
                  </p>
                  {questionSupportFiles.map((file, index) => (
                    <AudioPlayer
                      key={`question-support-${file.name}-${index}`}
                      label={`Support question ${index + 1}`}
                      file={file}
                      onRemove={() => {
                        setQuestionSupportFiles((prev) => {
                          const newFiles = [...prev];
                          newFiles.splice(index, 1);
                          return newFiles;
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Uploads */}
            <div className="flex w-full flex-col gap-6 xl:w-[464px] xl:shrink-0">

              <div className="flex flex-col gap-4">
                <label
                  className="text-white text-[16px] leading-[24px]"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                >
                  Transcripts (in-app)
                </label>
                <p className="text-[#8f8f8f] text-[12px] leading-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  Paste full transcript text for each role.
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-[#965cdf] text-[12px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Support transcript
                  </label>
                  <textarea
                    value={transcriptSupportText}
                    onChange={(e) => setTranscriptSupportText(e.target.value)}
                    rows={8}
                    placeholder="Paste Support transcript…"
                    className="w-full rounded-[12px] bg-[#131313] border border-[rgba(255,255,255,0.25)] text-white text-[14px] leading-[22px] p-3 placeholder-[#616161] focus:outline-none focus:ring-2 focus:ring-[#965cdf] resize-y min-h-[120px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[#965cdf] text-[12px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Recovery transcript
                  </label>
                  <textarea
                    value={transcriptRecoveryText}
                    onChange={(e) => setTranscriptRecoveryText(e.target.value)}
                    rows={8}
                    placeholder="Paste Recovery transcript…"
                    className="w-full rounded-[12px] bg-[#131313] border border-[rgba(255,255,255,0.25)] text-white text-[14px] leading-[22px] p-3 placeholder-[#616161] focus:outline-none focus:ring-2 focus:ring-[#965cdf] resize-y min-h-[120px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  />
                </div>
              </div>

              {/* Recovery Images Section */}
              <div className="flex flex-col gap-4">
                <label
                  className="text-white text-[16px] leading-[24px]"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                >
                  Recovery Images
                </label>
                {recoveryImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {recoveryImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[12px] h-[110px] overflow-hidden group"
                      >
                        <img
                          src={image.src}
                          alt="Recovery content"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => {
                            setRecoveryImages((prev) => prev.filter((img) => img.id !== image.id));
                          }}
                          className="absolute top-1.5 right-1.5 w-8 h-8 bg-white/7 backdrop-blur-[20px] rounded-full flex items-center justify-center transition-opacity cursor-pointer"
                          aria-label="Remove image"
                        >
                          <DeleteIcon width={16} height={16} color="#fff" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] h-[120px] flex items-center justify-center cursor-pointer hover:border-[#965cdf] transition-colors"
                    onClick={() => handleUploadButtonClick('recoveryImage')}
                  >
                    <div className="text-[#8f8f8f] text-[14px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      No recovery images uploaded
                    </div>
                  </div>
                )}
                <Button
                  className="w-full h-[56px]"
                  onClick={() => handleUploadButtonClick('recoveryImage')}
                >
                  Upload Recovery Images
                </Button>
              </div>

              {/* Support Images Section */}
              <div className="flex flex-col gap-4">
                <label
                  className="text-white text-[16px] leading-[24px]"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                >
                  Support Images
                </label>
                {supportImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {supportImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[12px] h-[110px] overflow-hidden group"
                      >
                        <img
                          src={image.src}
                          alt="Support content"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => {
                            setSupportImages((prev) => prev.filter((img) => img.id !== image.id));
                          }}
                          className="absolute top-1.5 right-1.5 w-8 h-8 bg-white/7 backdrop-blur-[20px] rounded-full flex items-center justify-center transition-opacity cursor-pointer"
                          aria-label="Remove image"
                        >
                          <DeleteIcon width={16} height={16} color="#fff" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] h-[120px] flex items-center justify-center cursor-pointer hover:border-[#965cdf] transition-colors"
                    onClick={() => handleUploadButtonClick('supportImage')}
                  >
                    <div className="text-[#8f8f8f] text-[14px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      No support images uploaded
                    </div>
                  </div>
                )}
                <Button
                  className="w-full h-[56px]"
                  onClick={() => handleUploadButtonClick('supportImage')}
                >
                  Upload Support Images
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <button
              onClick={handleCancel}
              disabled={isPublishing}
              className="h-[56px] w-full rounded-[12px] border border-[#965cdf] text-white font-roboto font-medium text-[16px] leading-normal hover:bg-[rgba(150,92,223,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:w-[120px]"
            >
              Cancel
            </button>
            <Button
              onClick={handlePublish}
              className="h-[56px] w-full rounded-[12px] sm:w-[120px]"
              disabled={isPublishing}
            >
              {isPublishing ? `Publishing... ${publishProgress}%` : 'Publish'}
            </Button>
            {isPublishing && publishProgress > 0 && publishProgress < 100 && (
              <div className="h-[4px] w-full max-w-[240px] rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden sm:w-[200px]">
                <div
                  className="bg-[#965cdf] h-full transition-all duration-300"
                  style={{ width: `${publishProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Upload Popup */}
      <FileUploadPopup
        isOpen={isUploadPopupOpen}
        onClose={() => {
          setIsUploadPopupOpen(false);
          setUploadPreferredContentType(null);
        }}
        onUpload={handleUploadComplete}
        accept="*"
        title="Upload Files"
        supportedFormats="Images, Audio (MP3, WAV, M4A), Documents (PDF, DOC, DOCX)"
        contentTypes={contentTypeOptions}
        preferredContentType={uploadPreferredContentType}
      />
    </div>
  );
};

