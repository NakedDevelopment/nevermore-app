import { useMemo } from 'react';
import {
  Content,
  getPresentationImageLists,
  getPresentationQuestionFileLists,
  getPresentationQuestionFileDurationLists,
} from '../services/content.service';

interface UseContentPresentationReturn {
  mainContentURL: string | null;
  /** Known duration (seconds) for `mainContentURL`, computed by the admin at upload time. */
  mainContentDurationSec: number | undefined;
  /** Plain text from CMS (transcriptRecoveryText / transcriptSupportText). */
  transcriptTextFromFields: string | null;
  images: string[];
  displayImage: string;
  audioFiles: string[];
  /** Known durations (seconds), index-aligned with `audioFiles`. */
  audioFileDurations: (number | null)[];
  hasAudio: boolean;
  hasTranscript: boolean;
  hasImages: boolean;
}

const DEFAULT_IMAGE = 'https://cdn.pixabay.com/photo/2023/10/30/12/36/hospital-8352776_640.jpg';

/**
 * Hook to extract and format presentation data from content
 * Provides a clean interface for accessing content display properties
 * 
 * @param content - The content object to extract data from
 * @param role - The selected role ('recovery' | 'support') to determine which URLs to use
 * @returns Formatted presentation data
 */
export function useContentPresentation(
  content: Content | null,
  role: 'recovery' | 'support' = 'recovery'
): UseContentPresentationReturn {
  return useMemo(() => {
    if (!content) {
      return {
        mainContentURL: null,
        mainContentDurationSec: undefined,
        transcriptTextFromFields: null,
        images: [],
        displayImage: DEFAULT_IMAGE,
        audioFiles: [],
        audioFileDurations: [],
        hasAudio: false,
        hasTranscript: false,
        hasImages: false,
      };
    }

    // Get role-specific URLs
    const mainContentURL = role === 'recovery'
      ? content.mainContentRecoveryURL || null
      : content.mainContentSupportURL || null;

    const mainContentDurationSec = role === 'recovery'
      ? content.mainContentRecoveryDurationSec
      : content.mainContentSupportDurationSec;

    const transcriptTextFromFieldsRaw = role === 'recovery'
      ? content.transcriptRecoveryText
      : content.transcriptSupportText;
    const transcriptTextFromFields =
      typeof transcriptTextFromFieldsRaw === 'string' && transcriptTextFromFieldsRaw.trim().length > 0
        ? transcriptTextFromFieldsRaw.trim()
        : null;

    const { legacy: legacyImages, recovery: recoveryImages, support: supportImages } =
      getPresentationImageLists(content);
    const images =
      role === 'recovery'
        ? recoveryImages.length > 0
          ? recoveryImages
          : legacyImages
        : supportImages.length > 0
          ? supportImages
          : legacyImages;
    const displayImage = images.length > 0 ? images[0] : DEFAULT_IMAGE;

    const {
      legacy: legacyQuestionFiles,
      recovery: recoveryQuestionFiles,
      support: supportQuestionFiles,
    } = getPresentationQuestionFileLists(content);
    const audioFiles =
      role === 'recovery'
        ? recoveryQuestionFiles.length > 0
          ? recoveryQuestionFiles
          : legacyQuestionFiles
        : supportQuestionFiles.length > 0
          ? supportQuestionFiles
          : legacyQuestionFiles;

    const {
      legacy: legacyQuestionDurations,
      recovery: recoveryQuestionDurations,
      support: supportQuestionDurations,
    } = getPresentationQuestionFileDurationLists(content);
    // Mirrors the exact same branch decision as `audioFiles` above so
    // audioFileDurations[i] stays aligned with audioFiles[i].
    const audioFileDurations =
      role === 'recovery'
        ? recoveryQuestionFiles.length > 0
          ? recoveryQuestionDurations
          : legacyQuestionDurations
        : supportQuestionFiles.length > 0
          ? supportQuestionDurations
          : legacyQuestionDurations;

    return {
      mainContentURL,
      mainContentDurationSec,
      transcriptTextFromFields,
      images,
      displayImage,
      audioFiles,
      audioFileDurations,
      hasAudio: audioFiles.length > 0,
      hasTranscript: !!transcriptTextFromFields,
      hasImages: images.length > 0,
    };
  }, [content, role]);
}

