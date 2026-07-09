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
 *
 * Rejects (rather than resolving null) when the duration can't be determined,
 * so callers can tell "genuinely no duration" apart from "the browser
 * couldn't decode this / the request failed" — the backfill needs that
 * distinction to avoid miscounting CORS/codec failures as successes.
 */
export function getAudioDurationFromUrl(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let settled = false;

    const finishOk = (value: number) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const finishError = (reason: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(reason));
    };

    const timeoutId = setTimeout(() => finishError('timed out waiting for metadata'), 15000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        finishOk(duration);
      } else {
        finishError(`decoded but duration was ${duration}`);
      }
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeoutId);
      const mediaError = audio.error;
      finishError(mediaError ? `media error code ${mediaError.code}` : 'unknown media error');
    });

    audio.preload = 'metadata';
    audio.src = url;
  });
}
