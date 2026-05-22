import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { AudioPlayer } from '../components/AudioPlayer';
import { FileUploadPopup, type UploadFile } from '../components/FileUploadPopup';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import ChevronLeftIcon from '../assets/icons/chevron-left';
import PlusIcon from '../assets/icons/plus';
import CloseIcon from '../assets/icons/close';
import {
  deleteContent,
  publishContent,
  updateContentWithFiles,
  fetchContentById,
  fetchFortyDayJourneyByDay,
  type ContentDocument,
} from '../lib/content';
import { showAppwriteError } from '../lib/notifications';

interface JourneyData {
  id?: string;
  title: string;
  tasks?: string[];
  hasAudio?: boolean;
  day?: number;
}

export const Journey40Day = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const journeyData = location.state?.journeyData as JourneyData | undefined;
  const isEditMode = !!params.id || !!journeyData;
  const contentId = params.id || journeyData?.id;

  const [contentTitle, setContentTitle] = useState('');
  const [day, setDay] = useState<number | ''>('');
  const [tasks, setTasks] = useState<string[]>(['']);
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const [uploadedAudioFiles, setUploadedAudioFiles] = useState<File[]>([]);
  const [uploadedAudioUrls, setUploadedAudioUrls] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [originalContentData, setOriginalContentData] = useState<ContentDocument | null>(null);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDay, setOriginalDay] = useState<number | ''>('');
  const [originalTasks, setOriginalTasks] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [dayValidationPending, setDayValidationPending] = useState(false);

  const dayBlocksSubmit = useMemo(() => {
    if (day === '') return false;
    return !!dayError || dayValidationPending;
  }, [day, dayError, dayValidationPending]);

  // Real-time day validation (range + duplicate check)
  useEffect(() => {
    if (isEditMode && !isEditing) {
      setDayError(null);
      setDayValidationPending(false);
      return;
    }

    if (day === '') {
      setDayError(null);
      setDayValidationPending(false);
      return;
    }

    const dayNum = Number(day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 40) {
      setDayError('Day must be a whole number between 1 and 40');
      setDayValidationPending(false);
      return;
    }

    setDayValidationPending(true);
    let cancelled = false;

    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const existing = await fetchFortyDayJourneyByDay(dayNum, contentId, { silent: true });
          if (cancelled) return;
          if (existing) {
            setDayError(
              `Day ${dayNum} is already used by "${existing.title?.trim() || 'Untitled'}". Choose a different day.`
            );
          } else {
            setDayError(null);
          }
        } catch {
          if (!cancelled) {
            setDayError('Could not verify this day. Try again.');
          }
        } finally {
          if (!cancelled) {
            setDayValidationPending(false);
          }
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setDayValidationPending(false);
    };
  }, [day, contentId, isEditMode, isEditing]);

  // Load data when component mounts or journeyData changes
  useEffect(() => {
    const loadContentData = async () => {
      const idToLoad = contentId;
      if (idToLoad && !originalContentData) {
        try {
          const contentDoc = await fetchContentById(idToLoad);
          if (contentDoc) {
            setOriginalContentData(contentDoc);
            // Load audio files from URLs
            if (contentDoc.files && contentDoc.files.length > 0) {
              setUploadedAudioUrls(contentDoc.files);
            }
            // If we navigated directly to an edit route without state, hydrate fields from the document
            if (!journeyData) {
              setContentTitle(contentDoc.title || '');
              setOriginalTitle(contentDoc.title || '');
              const dayValue = contentDoc.day !== undefined ? contentDoc.day : '';
              setDay(dayValue);
              setOriginalDay(dayValue);
              const docTasks = contentDoc.tasks && contentDoc.tasks.length > 0 ? contentDoc.tasks : [''];
              setTasks(docTasks);
              setOriginalTasks(contentDoc.tasks ? [...contentDoc.tasks] : []);
            }
          }
        } catch (error) {
          console.error('Error loading content data:', error);
        }
      }

      if (journeyData) {
        const title = journeyData.title || '';
        setContentTitle(title);
        setOriginalTitle(title);
        
        const dayValue = journeyData.day !== undefined ? journeyData.day : '';
        setDay(dayValue);
        setOriginalDay(dayValue);
        
        if (journeyData.tasks && journeyData.tasks.length > 0) {
          setTasks(journeyData.tasks);
          setOriginalTasks([...journeyData.tasks]);
        } else {
          setTasks(['']);
          setOriginalTasks([]);
        }
      }
    };

    loadContentData();
  }, [journeyData, originalContentData, contentId]);

  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index] = value;
    setTasks(newTasks);
  };

  const handleAddTask = () => {
    setTasks([...tasks, '']);
  };

  const handleRemoveTask = (index: number) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, i) => i !== index);
      setTasks(newTasks);
    }
  };

  const handleUploadFiles = () => {
    setIsUploadPopupOpen(true);
  };

  const handleUploadComplete = (uploadFiles: UploadFile[]) => {
    // Filter for audio files only
    const audioFiles = uploadFiles
      .filter((uf) => uf.contentType === 'audio')
      .map((uf) => uf.file);
    
    if (audioFiles.length > 0) {
      setUploadedAudioFiles((prev) => [...prev, ...audioFiles]);
      // If content title is empty, suggest a title from the first file
      if (!contentTitle.trim() && audioFiles[0]) {
        const fileName = audioFiles[0].name;
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        setContentTitle(nameWithoutExt);
      }
    }
    
    // Close the upload popup after handling files
    setIsUploadPopupOpen(false);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!contentId) return false;
    
    const titleChanged = contentTitle.trim() !== originalTitle.trim();
    const dayChanged = day !== originalDay;
    const tasksChanged = JSON.stringify(tasks.filter(t => t.trim())) !== JSON.stringify(originalTasks.filter(t => t.trim()));
    
    // Check if new files were uploaded
    const newAudioUploaded = uploadedAudioFiles.length > 0;
    
    // Check if existing files were removed
    const audioRemoved = originalContentData?.files && originalContentData.files.length > 0 && uploadedAudioFiles.length === 0 && uploadedAudioUrls.length === 0;
    
    const filesChanged = newAudioUploaded || audioRemoved;
    
    return titleChanged || dayChanged || tasksChanged || filesChanged;
  };

  const handleSave = async () => {
    if (!contentId) {
      showAppwriteError(new Error('Content ID is required to save changes'));
      return;
    }

    // If there are no changes, don't do anything
    if (!hasUnsavedChanges()) {
      return;
    }

    // Validate required fields
    if (!contentTitle.trim()) {
      showAppwriteError(new Error('Content title is required'));
      return;
    }

    // Check if we have at least one file uploaded (new or existing)
    if (uploadedAudioFiles.length === 0 && uploadedAudioUrls.length === 0) {
      showAppwriteError(new Error('Please upload at least one audio file'));
      return;
    }

    if (dayBlocksSubmit) {
      return;
    }

    // Filter out empty tasks
    const validTasks = tasks.filter((task) => task.trim().length > 0);

    setIsSaving(true);
    setSaveProgress(0);

    try {
      // Update content (uploads new files and updates content document, preserving existing URLs)
      await updateContentWithFiles(
        contentId,
        {
          title: contentTitle.trim(),
          type: 'forty_day_journey',
          day: day !== '' ? Number(day) : undefined,
        },
        [], // No images for 40-day journey
        uploadedAudioFiles,
        null, // No transcript for journey
        validTasks.length > 0 ? validTasks : undefined,
        (progress) => {
          setSaveProgress(progress);
        },
        [], // No existing image URLs
        uploadedAudioUrls, // Pass existing audio URLs
        null // No transcript URL
      );

      // Reload content to get updated URLs
      const updatedContent = await fetchContentById(contentId);
      if (updatedContent) {
        setOriginalContentData(updatedContent);
        
        // Reload audio URLs
        if (updatedContent.files && updatedContent.files.length > 0) {
          setUploadedAudioUrls(updatedContent.files);
        } else {
          setUploadedAudioUrls([]);
        }
      }

      // Update original values after successful save
      setOriginalTitle(contentTitle);
      setOriginalDay(day);
      setOriginalTasks([...tasks]);
      // Clear newly uploaded files (keep URLs)
      setUploadedAudioFiles([]);
      
      // Navigate back to content management after successful save
      navigate('/content-management');
    } catch (error) {
      console.error('Error saving content:', error);
      // Error is already shown by updateContentWithFiles function
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  const handleEdit = () => {
    if (!contentId) return;
    setIsEditing(true);
  };

  const handlePublish = async () => {
    // Validate required fields
    if (!contentTitle.trim()) {
      showAppwriteError(new Error('Content title is required'));
      return;
    }

    // Check if we have at least one file uploaded
    if (uploadedAudioFiles.length === 0) {
      showAppwriteError(new Error('Please upload at least one audio file'));
      return;
    }

    // Filter out empty tasks
    const validTasks = tasks.filter((task) => task.trim().length > 0);

    // Warn if no tasks are provided (but allow publishing)
    if (validTasks.length === 0) {
      console.warn('No tasks provided for the journey');
    }

    if (dayBlocksSubmit) {
      return;
    }

    setIsPublishing(true);
    setPublishProgress(0);

    try {
      // Publish content (uploads files and creates content document)
      // Files are uploaded to the same storage bucket
      // Content is saved to the same content table with type 'forty_day_journey'
      await publishContent(
        {
          title: contentTitle.trim(),
          type: 'forty_day_journey', // Content type: forty_day_journey
          day: day !== '' ? Number(day) : undefined, // Day number for 40-day journey
        },
        [], // No images for 40-day journey
        uploadedAudioFiles, // Audio files - uploaded to storage
        null, // No transcript for journey
        undefined, // No transcript files
        validTasks.length > 0 ? validTasks : undefined, // Tasks array - stored in content document
        (progress: number) => {
          setPublishProgress(progress);
        }
      );

      // Navigate back to content management after successful publish
      navigate('/content-management');
    } catch (error) {
      console.error('Error publishing content:', error);
      // Error is already shown by publishContent function
      setIsPublishing(false);
      setPublishProgress(0);
    }
  };

  const handleDelete = () => {
    if (!contentId) {
      showAppwriteError(new Error('Content ID is required to delete'));
      return;
    }
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!contentId) {
      showAppwriteError(new Error('Content ID is required to delete'));
      return;
    }

    setIsDeleting(true);
    try {
      await deleteContent(contentId);
      setIsDeleteModalOpen(false);
      navigate('/content-management');
    } catch (error) {
      console.error('Error deleting content:', error);
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    navigate('/content-management');
  };

  return (
    <div className="bg-neutral-950 min-h-screen">
      {/* Header with Back Button, Title, and Action Buttons */}
      <div className="flex flex-col gap-4 px-4 pt-6 sm:px-8 sm:pt-9 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
          <button
            onClick={() => navigate('/content-management')}
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
            {isEditMode ? 'Content Details' : '40 DAY JOURNEY'}
          </h1>
        </div>
        {isEditMode && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              className="h-[56px] w-full sm:w-[120px]"
              onClick={isEditing ? handleSave : handleEdit}
              disabled={
                isSaving ||
                !contentId ||
                (isEditing && !hasUnsavedChanges()) ||
                (isEditing && dayBlocksSubmit)
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
              disabled={isSaving || isDeleting || !contentId}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="px-4 pt-6 pb-6 sm:px-8 sm:pt-9 sm:pb-8">
        <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] rounded-[16px] sm:rounded-[24px] p-4 sm:p-8 flex flex-col gap-10 sm:gap-16 items-center">
        {/* Content Section */}
        <div className="flex w-full flex-col gap-10 xl:flex-row xl:items-start xl:gap-16">
          {/* Left Section - Content Title and Audio */}
          <div className="flex flex-1 flex-col gap-10 xl:items-end">
            {/* Content Title with Upload Button */}
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2">
                  <label className="text-white text-[14px] leading-[20px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Title
                  </label>
                  <input
                    value={contentTitle}
                    onChange={(e) => setContentTitle(e.target.value)}
                    placeholder=" "
                    disabled={isEditMode ? !isEditing : false}
                    className={`w-full min-w-0 ${isEditMode ? 'bg-transparent border-none text-[22px] sm:text-[30px] lg:text-[40px]' : 'h-[56px] bg-[#131313] border border-[#965cdf] rounded-[16px] px-4 text-[18px] sm:text-[20px] focus:ring-2 focus:ring-[#965cdf]'} text-white focus:outline-none placeholder-[#616161] disabled:opacity-60 disabled:cursor-not-allowed`}
                    style={{ 
                      fontFamily: 'Cinzel, serif', 
                      fontWeight: 400,
                      lineHeight: 'normal'
                    }}
                  />
                </div>
              </div>
              <Button
                onClick={handleUploadFiles}
                className="h-[56px] w-full shrink-0 sm:w-[120px]"
                disabled={isEditMode ? !isEditing : false}
              >
                Upload Files
              </Button>
            </div>

            {/* Day Field */}
            <div className="w-full flex flex-col gap-2">
              <label className="text-white text-[14px] leading-[20px] font-roboto font-normal">
                Day
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Enter day number (e.g., 1, 2, 3)"
                min="1"
                max="40"
                disabled={isEditMode ? !isEditing : false}
                aria-invalid={!!dayError}
                aria-describedby={dayError || dayValidationPending ? 'day-field-feedback' : undefined}
                className={`h-[56px] bg-[#131313] border rounded-[16px] px-4 font-lato text-[16px] leading-[24px] text-white placeholder:text-[#616161] focus:outline-none focus:ring-2 ${
                  dayError
                    ? 'border-red-400 focus:ring-red-400/60'
                    : 'border-[rgba(255,255,255,0.25)] focus:ring-[#965cdf]'
                }`}
              />
              <div id="day-field-feedback" className="min-h-[20px]">
                {dayValidationPending && (
                  <p className="text-[13px] leading-[20px] text-[#c4b5fd] font-roboto">
                    Checking day…
                  </p>
                )}
                {dayError && !dayValidationPending && (
                  <p className="text-[13px] leading-[20px] text-red-400 font-roboto" role="alert">
                    {dayError}
                  </p>
                )}
              </div>
            </div>

            {/* Audio Players */}
            {(uploadedAudioFiles.length > 0 || uploadedAudioUrls.length > 0) && (
              <div className="flex flex-col gap-4 w-full">
                {/* Newly uploaded audio files */}
                {uploadedAudioFiles.map((file, index) => {
                  const audioIndex = index;
                  return (
                    <AudioPlayer
                      key={`new-${file.name}-${index}`}
                      label={audioIndex === 0 ? 'Main Content' : `Question ${audioIndex}`}
                      file={file}
                      onRemove={
                        isEditMode && !isEditing
                          ? undefined
                          : () => {
                              setUploadedAudioFiles((prev) => {
                                const newFiles = [...prev];
                                newFiles.splice(index, 1);
                                return newFiles;
                              });
                            }
                      }
                      className="w-full"
                    />
                  );
                })}
                {/* Existing audio URLs - display as AudioPlayer components */}
                {uploadedAudioUrls.map((url, index) => {
                  const audioIndex = uploadedAudioFiles.length + index;
                  return (
                    <AudioPlayer
                      key={`existing-audio-${index}`}
                      label={audioIndex === 0 ? 'Main Content' : `Question ${audioIndex}`}
                      url={url}
                      onRemove={
                        isEditMode && !isEditing
                          ? undefined
                          : () => {
                              setUploadedAudioUrls((prev) => prev.filter((_, i) => i !== index));
                            }
                      }
                      className="w-full"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Section - Tasks */}
          <div className="flex w-full flex-col gap-4 xl:w-[464px] xl:shrink-0">
            <h3
              className="text-white text-[16px] leading-[24px] font-cinzel font-bold sm:whitespace-nowrap"
              style={{ fontWeight: 550 }}
            >
              Input user tasks below:
            </h3>

            {/* Task Inputs */}
            {tasks.map((task, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-white text-[14px] leading-[20px] font-roboto font-normal">
                    Task {index + 1}
                  </label>
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => handleTaskChange(index, e.target.value)}
                    placeholder={
                      index === 0
                        ? 'Day 2 Check-in'
                        : index === 1
                        ? 'Read a Book'
                        : index === 2
                        ? 'You should listen to this'
                        : 'Exercise'
                    }
                    disabled={isEditMode ? !isEditing : false}
                    className="h-[56px] bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] px-4 font-lato text-[16px] leading-[24px] text-white placeholder:text-[#616161] focus:outline-none focus:ring-2 focus:ring-[#965cdf]"
                  />
                </div>
                {tasks.length > 1 && (
                  <button
                    onClick={() => handleRemoveTask(index)}
                    className="mb-2 p-2 cursor-pointer hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    aria-label="Remove task"
                    disabled={isEditMode ? !isEditing : false}
                  >
                    <CloseIcon width={20} height={20} color="#8f8f8f" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Task Button */}
            <button
              onClick={handleAddTask}
              className="flex items-center gap-2 h-[56px] bg-[#131313] border border-[#965cdf] rounded-[16px] px-4 text-[#965cdf] font-roboto font-medium text-[16px] leading-[24px] hover:bg-[rgba(150,92,223,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={isEditMode ? !isEditing : false}
            >
              <PlusIcon width={20} height={20} color="#965cdf" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Action Buttons - Only show for create mode */}
        {!isEditMode && (
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
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
              disabled={isPublishing || dayBlocksSubmit}
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
        )}
      </div>
      </div>

      {/* File Upload Popup */}
      <FileUploadPopup
        isOpen={isUploadPopupOpen}
        onClose={() => setIsUploadPopupOpen(false)}
        onUpload={handleUploadComplete}
        accept="audio/mpeg,audio/wav,audio/x-m4a,audio/m4a,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        title="Upload Audio"
        supportedFormats="MP3, WAV, M4A, AAC, OGG, FLAC"
        contentTypes={[
          { value: 'audio', label: 'Audio' },
        ]}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return;
          setIsDeleteModalOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        itemName={contentTitle || undefined}
        isLoading={isDeleting}
      />
    </div>
  );
};

