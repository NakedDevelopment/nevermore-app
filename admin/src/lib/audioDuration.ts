/**
 * Reads an audio file's duration client-side (browser decodes the container's
 * real metadata) so it can be stored on the content document at upload time.
 * The app then has a known-good duration for progress/seek without depending
 * on the mobile native player resolving `duration` from an extension-less
 * Appwrite Storage stream, which doesn't always work.
 */
export function getAudioDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    const timeoutId = setTimeout(() => finish(null), 8000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const duration = audio.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeoutId);
      finish(null);
    });

    audio.src = objectUrl;
  });
}

export async function getAudioDurationsSec(files: File[]): Promise<(number | null)[]> {
  return Promise.all(files.map(getAudioDurationSec));
}

/**
 * Same as `getAudioDurationSec`, but reads the duration directly from an
 * already-uploaded file's URL instead of a local `File` — used to backfill
 * duration metadata for audio that was uploaded before duration tracking
 * existed, without re-uploading anything.
 */
export function getAudioDurationFromUrl(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timeoutId = setTimeout(() => finish(null), 15000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const duration = audio.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeoutId);
      finish(null);
    });

    audio.preload = 'metadata';
    audio.src = url;
  });
}
