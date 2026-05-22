import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChevronLeftIcon from '../assets/icons/chevron-left';
import { Select } from '../components/Select';
import type { SelectOption } from '../components/Select';
import { Button } from '../components/Button';
import { AudioPlayer } from '../components/AudioPlayer';
import { FileUploadPopup, type UploadFile } from '../components/FileUploadPopup';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { categoriesToSelectOptions, getCategoryName } from '../lib/categories';
import { updateTemptationContent, fetchContentById, deleteContent, type ContentDocument, type TemptationFiles, type ExistingTemptationUrls } from '../lib/content';
import { showAppwriteError } from '../lib/notifications';
import DeleteIcon from '@/assets/icons/delete';
import { useCategoriesStore } from '../store/categoriesStore';


// Content type options for file upload (matching CreateTemptation)
const contentTypeOptions: SelectOption[] = [
  { value: 'mainContentSupport', label: 'Main Content (Support)' },
  { value: 'mainContentRecovery', label: 'Main Content (Recovery)' },
  { value: 'questionRecovery', label: 'Question (Recovery)' },
  { value: 'questionSupport', label: 'Question (Support)' },
  { value: 'recoveryImage', label: 'Recovery Image' },
  { value: 'supportImage', label: 'Support Image' },
];

interface TemptationData {
  id?: string;
  title: string;
  category?: string;
}

export const TemptationDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const temptationData = location.state?.temptationData as TemptationData | undefined;
  const { categories, isLoading: isLoadingCategories, error: categoriesError, loadCategories } = useCategoriesStore();

  // Redirect to create page if no ID is provided
  useEffect(() => {
    if (!temptationData?.id) {
      navigate('/content-management/create-40-temptations');
    }
  }, [temptationData, navigate]);

  const [contentTitle, setContentTitle] = useState('');
  const [categoryType, setCategoryType] = useState('');
  
  // New file state based on content types (matching CreateTemptation)
  const [questionRecoveryFiles, setQuestionRecoveryFiles] = useState<File[]>([]);
  const [questionSupportFiles, setQuestionSupportFiles] = useState<File[]>([]);
  const [questionRecoveryUrls, setQuestionRecoveryUrls] = useState<string[]>([]);
  const [questionSupportUrls, setQuestionSupportUrls] = useState<string[]>([]);
  const [mainContentSupportFile, setMainContentSupportFile] = useState<File | null>(null);
  const [mainContentSupportUrl, setMainContentSupportUrl] = useState<string | null>(null);
  const [mainContentRecoveryFile, setMainContentRecoveryFile] = useState<File | null>(null);
  const [mainContentRecoveryUrl, setMainContentRecoveryUrl] = useState<string | null>(null);
  const [transcriptSupportText, setTranscriptSupportText] = useState('');
  const [transcriptRecoveryText, setTranscriptRecoveryText] = useState('');
  const [recoveryImages, setRecoveryImages] = useState<Array<{ id: string; src: string; file?: File; url?: string }>>([]);
  const [supportImages, setSupportImages] = useState<Array<{ id: string; src: string; file?: File; url?: string }>>([]);
  
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalContentData, setOriginalContentData] = useState<ContentDocument | null>(null);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalCategory, setOriginalCategory] = useState('');
  const [uploadPreferredContentType, setUploadPreferredContentType] = useState<string | null>(null);

  // Fetch categories on mount (only once, centrally managed)
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Memoize category options to avoid recalculation
  const categoryOptions = useMemo(() => categoriesToSelectOptions(categories), [categories]);

  // Load data when component mounts or temptationData changes
  useEffect(() => {
    const loadContentData = async () => {
      if (temptationData?.id && !originalContentData) {
        try {
          const contentDoc = await fetchContentById(temptationData.id);
          if (contentDoc) {
            setOriginalContentData(contentDoc);
            
            
            const recQ = (contentDoc.recoveryQuestionFiles as string[] | undefined)?.filter(Boolean) || [];
            const supQ = (contentDoc.supportQuestionFiles as string[] | undefined)?.filter(Boolean) || [];
            if (recQ.length > 0 || supQ.length > 0) {
              setQuestionRecoveryUrls(recQ);
              setQuestionSupportUrls(supQ);
            } else if (contentDoc.files && contentDoc.files.length > 0) {
              setQuestionRecoveryUrls([...contentDoc.files]);
              setQuestionSupportUrls([]);
            }
            
            // Load Main Content (Support) URL
            if (contentDoc.mainContentSupportURL) {
              setMainContentSupportUrl(contentDoc.mainContentSupportURL);
            }
            
            // Load Main Content (Recovery) URL
            if (contentDoc.mainContentRecoveryURL) {
              setMainContentRecoveryUrl(contentDoc.mainContentRecoveryURL);
            }
            
            setTranscriptSupportText(
              typeof contentDoc.transcriptSupportText === 'string' ? contentDoc.transcriptSupportText : ''
            );
            setTranscriptRecoveryText(
              typeof contentDoc.transcriptRecoveryText === 'string' ? contentDoc.transcriptRecoveryText : ''
            );
            
            // Load Recovery images from URLs
            if (contentDoc.recoveryImages && contentDoc.recoveryImages.length > 0) {
              const loadedRecoveryImages = contentDoc.recoveryImages.map((url, index) => ({
                id: `existing-recovery-${index}-${Date.now()}`,
                src: url,
                url: url,
              }));
              setRecoveryImages(loadedRecoveryImages);
            }
            
            // Load Support images from URLs
            if (contentDoc.supportImages && contentDoc.supportImages.length > 0) {
              const loadedSupportImages = contentDoc.supportImages.map((url, index) => ({
                id: `existing-support-${index}-${Date.now()}`,
                src: url,
                url: url,
              }));
              setSupportImages(loadedSupportImages);
            }
          }
        } catch (error) {
          console.error('Error loading content data:', error);
        }
      }

      if (temptationData && categories.length > 0) {
        const title = temptationData.title || '';
        setContentTitle(title);
        setOriginalTitle(title);
        
        if (temptationData.category) {
          // Find category by name or ID (for backward compatibility)
          const category = categories.find(
            (cat) => getCategoryName(cat) === temptationData.category || cat.$id === temptationData.category
          );
          if (category) {
            setCategoryType(category.$id);
            setOriginalCategory(category.$id);
          } else {
            // If category is already an ID, use it directly
            setCategoryType(temptationData.category);
            setOriginalCategory(temptationData.category);
          }
        }
      } else if (temptationData && categories.length === 0 && !isLoadingCategories) {
        // If categories are loaded but not found, still set the title
        const title = temptationData.title || '';
        setContentTitle(title);
        setOriginalTitle(title);
      }
    };

    loadContentData();
  }, [temptationData, categories, isLoadingCategories, originalContentData]);

  const handleBack = () => {
    navigate('/content-management');
  };



  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!temptationData?.id) return false;
    if (!originalContentData) return false;

    const titleChanged = contentTitle.trim() !== originalTitle.trim();
    const categoryChanged = categoryType !== originalCategory;
    
    // Check if new files were uploaded
    const newQuestionRecoveryUploaded = questionRecoveryFiles.length > 0;
    const newQuestionSupportUploaded = questionSupportFiles.length > 0;
    const newMainContentSupportUploaded = mainContentSupportFile !== null;
    const newMainContentRecoveryUploaded = mainContentRecoveryFile !== null;
    const newRecoveryImagesUploaded = recoveryImages.some(img => img.file);
    const newSupportImagesUploaded = supportImages.some(img => img.file);
    // Check if existing files were removed
    const hadSplitQuestions =
      (originalContentData?.recoveryQuestionFiles?.length ?? 0) > 0 ||
      (originalContentData?.supportQuestionFiles?.length ?? 0) > 0;
    const hadLegacyQuestions = !hadSplitQuestions && (originalContentData?.files?.length ?? 0) > 0;
    const questionRecoveryRemoved =
      (hadSplitQuestions || hadLegacyQuestions) &&
      questionRecoveryFiles.length === 0 &&
      questionRecoveryUrls.length === 0;
    const questionSupportRemoved =
      hadSplitQuestions &&
      questionSupportFiles.length === 0 &&
      questionSupportUrls.length === 0;
    const mainContentSupportRemoved = originalContentData?.mainContentSupportURL && !mainContentSupportFile && !mainContentSupportUrl;
    const mainContentRecoveryRemoved = originalContentData?.mainContentRecoveryURL && !mainContentRecoveryFile && !mainContentRecoveryUrl;
    const originalSupportText = (originalContentData?.transcriptSupportText as string | undefined) || '';
    const originalRecoveryText = (originalContentData?.transcriptRecoveryText as string | undefined) || '';
    const transcriptSupportChanged = transcriptSupportText !== originalSupportText;
    const transcriptRecoveryChanged = transcriptRecoveryText !== originalRecoveryText;

    const legacyQuestions = hadLegacyQuestions;
    const baselineRecoveryUrls = legacyQuestions
      ? [...(originalContentData.files || [])]
      : [...(originalContentData.recoveryQuestionFiles || [])];
    const baselineSupportUrls = legacyQuestions
      ? []
      : [...(originalContentData.supportQuestionFiles || [])];
    const normUrls = (arr: string[]) => [...arr].sort().join('|');
    const questionUrlsChanged =
      normUrls(questionRecoveryUrls) !== normUrls(baselineRecoveryUrls) ||
      normUrls(questionSupportUrls) !== normUrls(baselineSupportUrls);

    const filesChanged =
      newQuestionRecoveryUploaded ||
      newQuestionSupportUploaded ||
      newMainContentSupportUploaded ||
      newMainContentRecoveryUploaded ||
      questionRecoveryRemoved ||
      questionSupportRemoved ||
      questionUrlsChanged ||
      mainContentSupportRemoved ||
      mainContentRecoveryRemoved ||
      transcriptSupportChanged ||
      transcriptRecoveryChanged ||
      newRecoveryImagesUploaded ||
      newSupportImagesUploaded;
    
    return titleChanged || categoryChanged || filesChanged;
  };

  const handleSave = async () => {
    if (!temptationData?.id) {
      showAppwriteError(new Error('Content ID is required to save changes'));
      return;
    }

    // If there are no changes, don't do anything
    if (!hasUnsavedChanges()) {
      return;
    }

    // Validate required fields (same as CreateTemptation)
    if (!contentTitle.trim()) {
      showAppwriteError(new Error('Content title is required'));
      return;
    }

    if (!categoryType) {
      showAppwriteError(new Error('Category is required'));
      return;
    }


    // Check for Main Content Support (new file or existing URL)
    if (!mainContentSupportFile && !mainContentSupportUrl) {
      showAppwriteError(new Error('Main Content (Support) is required'));
      return;
    }

    // Check for Main Content Recovery (new file or existing URL)
    if (!mainContentRecoveryFile && !mainContentRecoveryUrl) {
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

    const hasRecoveryQ =
      questionRecoveryFiles.length > 0 || questionRecoveryUrls.length > 0;
    const hasSupportQ =
      questionSupportFiles.length > 0 || questionSupportUrls.length > 0;

    if (!hasRecoveryQ) {
      showAppwriteError(new Error('Please add at least one Recovery question audio file'));
      return;
    }

    const isLegacyQuestionFormat =
      !originalContentData?.recoveryQuestionFiles?.length &&
      !originalContentData?.supportQuestionFiles?.length &&
      (originalContentData?.files?.length ?? 0) > 0;

    if (!isLegacyQuestionFormat && !hasSupportQ) {
      showAppwriteError(new Error('Please add at least one Support question audio file'));
      return;
    }

    setIsSaving(true);
    setSaveProgress(0);

    try {
      // Extract File objects from newly uploaded recovery and support images
      const newRecoveryImageFiles = recoveryImages.filter((img) => img.file).map((img) => img.file!);
      const newSupportImageFiles = supportImages.filter((img) => img.file).map((img) => img.file!);
      
      // Preserve existing recovery and support image URLs
      const existingRecoveryImageUrls = recoveryImages.filter((img) => img.url && !img.file).map((img) => img.url!);
      const existingSupportImageUrls = supportImages.filter((img) => img.url && !img.file).map((img) => img.url!);
      
      // Prepare temptation files
      const temptationFiles: TemptationFiles = {
        questionRecoveryFiles,
        questionSupportFiles,
        mainContentSupportFile: mainContentSupportFile,
        mainContentRecoveryFile: mainContentRecoveryFile,
        recoveryImageFiles: newRecoveryImageFiles,
        supportImageFiles: newSupportImageFiles,
      };
      
      // Prepare existing URLs
      const existingUrls: ExistingTemptationUrls = {
        questionRecoveryUrls,
        questionSupportUrls,
        mainContentSupportURL: mainContentSupportUrl,
        mainContentRecoveryURL: mainContentRecoveryUrl,
        recoveryImageUrls: existingRecoveryImageUrls,
        supportImageUrls: existingSupportImageUrls,
      };
      
      // Update content (uploads new files and updates content document, preserving existing URLs)
      await updateTemptationContent(
        temptationData.id,
        {
          title: contentTitle,
          category: categoryType,
          type: 'forty_temptations',
          transcriptSupportText: transcriptSupportText.trim(),
          transcriptRecoveryText: transcriptRecoveryText.trim(),
        },
        temptationFiles,
        existingUrls,
        (progress) => {
          setSaveProgress(progress);
        }
      );

      // Reload content to get updated URLs
      const updatedContent = await fetchContentById(temptationData.id);
      if (updatedContent) {
        setOriginalContentData(updatedContent);
        
        
        const uRec = (updatedContent.recoveryQuestionFiles as string[] | undefined)?.filter(Boolean) || [];
        const uSup = (updatedContent.supportQuestionFiles as string[] | undefined)?.filter(Boolean) || [];
        if (uRec.length > 0 || uSup.length > 0) {
          setQuestionRecoveryUrls(uRec);
          setQuestionSupportUrls(uSup);
        } else if (updatedContent.files && updatedContent.files.length > 0) {
          setQuestionRecoveryUrls([...updatedContent.files]);
          setQuestionSupportUrls([]);
        } else {
          setQuestionRecoveryUrls([]);
          setQuestionSupportUrls([]);
        }
        
        // Reload Main Content URLs
        setMainContentSupportUrl(updatedContent.mainContentSupportURL || null);
        setMainContentRecoveryUrl(updatedContent.mainContentRecoveryURL || null);
        
        setTranscriptSupportText(
          typeof updatedContent.transcriptSupportText === 'string' ? updatedContent.transcriptSupportText : ''
        );
        setTranscriptRecoveryText(
          typeof updatedContent.transcriptRecoveryText === 'string' ? updatedContent.transcriptRecoveryText : ''
        );
        
        // Reload Recovery images
        if (updatedContent.recoveryImages && updatedContent.recoveryImages.length > 0) {
          const reloadedRecoveryImages = updatedContent.recoveryImages.map((url, index) => ({
            id: `existing-recovery-${index}-${Date.now()}`,
            src: url,
            url: url,
          }));
          setRecoveryImages(reloadedRecoveryImages);
        } else {
          setRecoveryImages([]);
        }
        
        // Reload Support images
        if (updatedContent.supportImages && updatedContent.supportImages.length > 0) {
          const reloadedSupportImages = updatedContent.supportImages.map((url, index) => ({
            id: `existing-support-${index}-${Date.now()}`,
            src: url,
            url: url,
          }));
          setSupportImages(reloadedSupportImages);
        } else {
          setSupportImages([]);
        }
      }

      // Update original values after successful save
      setOriginalTitle(contentTitle);
      setOriginalCategory(categoryType);
      
      // Clear newly uploaded files (keep URLs)
      setQuestionRecoveryFiles([]);
      setQuestionSupportFiles([]);
      setMainContentSupportFile(null);
      setMainContentRecoveryFile(null);
      // Navigate back to content management after successful save
      navigate('/content-management');
    } catch (error) {
      console.error('Error saving content:', error);
      // Error is already shown by updateTemptationContent function
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  const handleEdit = () => {
    if (!temptationData?.id) return;
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!temptationData?.id) {
      showAppwriteError(new Error('Content ID is required to delete'));
      return;
    }

    setIsDeleting(true);
    try {
      await deleteContent(temptationData.id);
      setIsDeleteModalOpen(false);
      navigate('/content-management');
    } catch (error) {
      console.error('Error deleting content:', error);
      setIsDeleting(false);
    }
  };

  const handleUploadButtonClick = (preferredContentType?: string | null) => {
    setUploadPreferredContentType(preferredContentType ?? null);
    setIsUploadPopupOpen(true);
  };

  const handleUploadComplete = (uploadFiles: UploadFile[]) => {
    // Route files to their appropriate places based on content type (matching CreateTemptation)
    uploadFiles.forEach((uploadFile) => {
      switch (uploadFile.contentType) {
        case 'questionRecovery':
          setQuestionRecoveryFiles((prev) => [...prev, uploadFile.file]);
          break;
        case 'questionSupport':
          setQuestionSupportFiles((prev) => [...prev, uploadFile.file]);
          break;
        case 'mainContentSupport':
          setMainContentSupportFile(uploadFile.file);
          break;
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


  return (
    <div className="bg-neutral-950 min-h-screen">
      {/* Header with Back Button, Title, and Action Buttons */}
      <div className="flex flex-col gap-4 px-4 pt-6 sm:px-8 sm:pt-9 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
          <button
            onClick={handleBack}
            className="flex w-fit shrink-0 items-center gap-2 text-[#965cdf] text-[12px] hover:opacity-80 transition cursor-pointer" 
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            <ChevronLeftIcon width={24} height={24} color="#965cdf" />
            <span>Back</span>
          </button>
          <h1
            className="min-w-0 text-white text-[20px] leading-tight sm:text-[24px]"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
          >
            Content Details
          </h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Button
            className="h-[56px] w-full sm:w-[120px]"
            onClick={isEditing ? handleSave : handleEdit}
            disabled={
              isSaving ||
              !temptationData?.id ||
              (isEditing && !hasUnsavedChanges())
            }
          >
            {isSaving ? `Saving... ${saveProgress}%` : isEditing ? 'Save' : 'Edit'}
          </Button>
          {isSaving && saveProgress > 0 && saveProgress < 100 && (
            <div className="h-[4px] w-full max-w-[240px] rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden sm:w-[200px]">
              <div
                className="bg-[#965cdf] h-full transition-all duration-300"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
          )}
          <Button
            variant="outline"
            className="h-[56px] w-full sm:w-[120px]"
            onClick={handleDelete}
            disabled={isSaving || isDeleting || !temptationData?.id}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pt-6 pb-6 sm:px-8 sm:pt-9 sm:pb-8">
        <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] rounded-[16px] sm:rounded-[24px] p-4 sm:p-8">
          <div className="relative mb-10 flex flex-col gap-10 xl:mb-16 xl:flex-row xl:items-start xl:gap-16">
            {/* Left Column - Form Fields */}
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              {/* Content Title and Upload Files Button */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[14px] leading-[20px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      Title
                    </label>
                    <input
                      value={contentTitle}
                      onChange={(e) => setContentTitle(e.target.value)}
                      placeholder="Enter content title"
                      disabled={!isEditing}
                      className="w-full min-w-0 bg-transparent border-none text-[22px] leading-tight text-white focus:outline-none placeholder-[#616161] disabled:opacity-60 disabled:cursor-not-allowed sm:text-[30px] lg:text-[40px]"
                      style={{ 
                        fontFamily: 'Cinzel, serif', 
                        fontWeight: 400,
                        lineHeight: 'normal'
                      }}
                    />
                  </div>
                </div>
                <Button
                  className="h-[56px] w-full shrink-0 sm:w-[120px]"
                  onClick={() => handleUploadButtonClick()}
                  disabled={!isEditing}
                >
                  Upload Files
                </Button>
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
                <div className={!isEditing ? 'pointer-events-none opacity-60' : undefined}>
                  <Select
                    options={categoryOptions}
                    value={categoryType}
                    onChange={setCategoryType}
                    placeholder={isLoadingCategories ? 'Loading categories...' : 'Select Category'}
                  />
                </div>
              </div>

              {/* Main Content Audio Players */}
              {(mainContentSupportFile || mainContentSupportUrl || mainContentRecoveryFile || mainContentRecoveryUrl) && (
                <div className="flex flex-col gap-4">
                  {/* Main Content (Support) */}
                  {(mainContentSupportFile || mainContentSupportUrl) && (
                    <AudioPlayer
                      key="main-content-support"
                      label="Main Content (Support)"
                      file={mainContentSupportFile || undefined}
                      url={mainContentSupportFile ? undefined : mainContentSupportUrl || undefined}
                      onRemove={
                        isEditing
                          ? () => {
                              setMainContentSupportFile(null);
                              setMainContentSupportUrl(null);
                            }
                          : undefined
                      }
                    />
                  )}
                  {/* Main Content (Recovery) */}
                  {(mainContentRecoveryFile || mainContentRecoveryUrl) && (
                    <AudioPlayer
                      key="main-content-recovery"
                      label="Main Content (Recovery)"
                      file={mainContentRecoveryFile || undefined}
                      url={mainContentRecoveryFile ? undefined : mainContentRecoveryUrl || undefined}
                      onRemove={
                        isEditing
                          ? () => {
                              setMainContentRecoveryFile(null);
                              setMainContentRecoveryUrl(null);
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              )}

              {/* Recovery question audio */}
              {(questionRecoveryFiles.length > 0 || questionRecoveryUrls.length > 0) && (
                <div className="flex flex-col gap-4">
                  <p
                    className="text-[#965cdf] text-[12px] leading-[16px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Recovery questions
                  </p>
                  {questionRecoveryFiles.map((file, index) => (
                    <AudioPlayer
                      key={`question-recovery-new-${file.name}-${index}`}
                      label={`Recovery question ${index + 1}`}
                      file={file}
                      onRemove={
                        isEditing
                          ? () => {
                              setQuestionRecoveryFiles((prev) => {
                                const next = [...prev];
                                next.splice(index, 1);
                                return next;
                              });
                            }
                          : undefined
                      }
                    />
                  ))}
                  {questionRecoveryUrls.map((url, index) => (
                    <AudioPlayer
                      key={`question-recovery-url-${index}`}
                      label={`Recovery question ${questionRecoveryFiles.length + index + 1}`}
                      url={url}
                      onRemove={
                        isEditing
                          ? () => {
                              setQuestionRecoveryUrls((prev) => prev.filter((_, i) => i !== index));
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}

              {/* Support question audio */}
              {(questionSupportFiles.length > 0 || questionSupportUrls.length > 0) && (
                <div className="flex flex-col gap-4">
                  <p
                    className="text-[#965cdf] text-[12px] leading-[16px]"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Support questions
                  </p>
                  {questionSupportFiles.map((file, index) => (
                    <AudioPlayer
                      key={`question-support-new-${file.name}-${index}`}
                      label={`Support question ${index + 1}`}
                      file={file}
                      onRemove={
                        isEditing
                          ? () => {
                              setQuestionSupportFiles((prev) => {
                                const next = [...prev];
                                next.splice(index, 1);
                                return next;
                              });
                            }
                          : undefined
                      }
                    />
                  ))}
                  {questionSupportUrls.map((url, index) => (
                    <AudioPlayer
                      key={`question-support-url-${index}`}
                      label={`Support question ${questionSupportFiles.length + index + 1}`}
                      url={url}
                      onRemove={
                        isEditing
                          ? () => {
                              setQuestionSupportUrls((prev) => prev.filter((_, i) => i !== index));
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Image and Transcript Upload */}
            <div className="flex w-full flex-col gap-6 xl:w-[464px] xl:shrink-0">

              {/* In-app transcripts (plain text, shown in mobile app) */}
              <div className="flex flex-col gap-4">
                <label
                  className="text-white text-[16px] leading-[24px]"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                >
                  Transcripts (in-app)
                </label>
                <p className="text-[#8f8f8f] text-[12px] leading-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  Paste full transcript text for each role. This replaces file-based transcripts.
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-[#965cdf] text-[12px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Support transcript
                  </label>
                  <textarea
                    value={transcriptSupportText}
                    onChange={(e) => setTranscriptSupportText(e.target.value)}
                    disabled={!isEditing}
                    rows={8}
                    placeholder="Paste Support transcript…"
                    className="w-full rounded-[12px] bg-[#131313] border border-[rgba(255,255,255,0.25)] text-white text-[14px] leading-[22px] p-3 placeholder-[#616161] focus:outline-none focus:ring-2 focus:ring-[#965cdf] disabled:opacity-60 resize-y min-h-[120px]"
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
                    disabled={!isEditing}
                    rows={8}
                    placeholder="Paste Recovery transcript…"
                    className="w-full rounded-[12px] bg-[#131313] border border-[rgba(255,255,255,0.25)] text-white text-[14px] leading-[22px] p-3 placeholder-[#616161] focus:outline-none focus:ring-2 focus:ring-[#965cdf] disabled:opacity-60 resize-y min-h-[120px]"
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
                        {isEditing && (
                          <button
                            onClick={() => {
                              setRecoveryImages((prev) => prev.filter((img) => img.id !== image.id));
                            }}
                            className="absolute top-1.5 right-1.5 w-8 h-8 bg-white/7 backdrop-blur-[20px] rounded-full flex items-center justify-center transition-opacity cursor-pointer"
                            aria-label="Remove image"
                          >
                            <DeleteIcon width={16} height={16} color="#fff" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] h-[120px] flex items-center justify-center ${isEditing ? 'cursor-pointer hover:border-[#965cdf]' : ''} transition-colors`}
                    onClick={() => isEditing && handleUploadButtonClick('recoveryImage')}
                  >
                    <div className="text-[#8f8f8f] text-[14px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      No recovery images uploaded
                    </div>
                  </div>
                )}
                {isEditing && (
                  <Button
                    className="w-full h-[56px]"
                    onClick={() => handleUploadButtonClick('recoveryImage')}
                  >
                    Upload Recovery Images
                  </Button>
                )}
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
                        {isEditing && (
                          <button
                            onClick={() => {
                              setSupportImages((prev) => prev.filter((img) => img.id !== image.id));
                            }}
                            className="absolute top-1.5 right-1.5 w-8 h-8 bg-white/7 backdrop-blur-[20px] rounded-full flex items-center justify-center transition-opacity cursor-pointer"
                            aria-label="Remove image"
                          >
                            <DeleteIcon width={16} height={16} color="#fff" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] h-[120px] flex items-center justify-center ${isEditing ? 'cursor-pointer hover:border-[#965cdf]' : ''} transition-colors`}
                    onClick={() => isEditing && handleUploadButtonClick('supportImage')}
                  >
                    <div className="text-[#8f8f8f] text-[14px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      No support images uploaded
                    </div>
                  </div>
                )}
                {isEditing && (
                  <Button
                    className="w-full h-[56px]"
                    onClick={() => handleUploadButtonClick('supportImage')}
                  >
                    Upload Support Images
                  </Button>
                )}
              </div>
            </div>
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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={contentTitle || undefined}
        isLoading={isDeleting}
      />
    </div>
  );
};

