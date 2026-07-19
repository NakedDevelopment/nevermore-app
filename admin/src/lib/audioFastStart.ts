/**
 * Some M4A/MP4 audio exports place the `moov` atom (the container's duration
 * and seek/sample-table metadata) at the end of the file instead of the
 * front. Streamed progressively — which is exactly how the mobile app plays
 * audio straight from an Appwrite Storage URL — the native player can't
 * reliably resolve real duration/seek data until it reaches that trailing
 * atom. It ends up estimating duration from whatever has buffered so far,
 * and once real playback runs past that misestimate, believes it has
 * reached the end of the track and restarts it from 0 mid-playback.
 *
 * Remuxing with `-movflags +faststart` moves `moov` to the front. Using
 * `-c copy` (stream copy) never touches the actual audio samples — this is
 * a pure container rewrite, not a re-encode, so it cannot change audio
 * quality or content. Idempotent: running it on a file that's already
 * faststart is a harmless no-op.
 *
 * Applied at upload time (see `uploadFile` in `content.ts`) so every audio
 * file that lands in Appwrite Storage is safe to stream, regardless of how
 * the source file was exported. Only MP4-family containers (m4a/mp4/m4b/mov)
 * have this failure mode — other formats (mp3/wav/ogg) are left untouched.
 * Any failure (unsupported file, wasm load failure, etc.) falls back to the
 * original file unchanged, so this can only help, never block an upload.
 */

const MP4_FAMILY_EXTENSIONS = new Set(['m4a', 'mp4', 'm4b', 'mov']);
const MP4_FAMILY_MIME_TYPES = new Set(['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'video/mp4', 'video/quicktime']);

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isMp4FamilyAudioFile(file: File): boolean {
  return MP4_FAMILY_EXTENSIONS.has(getExtension(file.name)) || MP4_FAMILY_MIME_TYPES.has(file.type);
}

let ffmpegPromise: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null = null;

async function loadFfmpeg(): Promise<import('@ffmpeg/ffmpeg').FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      // Single-threaded core: no cross-origin-isolation (COOP/COEP) headers
      // required on the admin site, unlike the multi-threaded core.
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })().catch((error) => {
      // Don't cache a permanent failure — a transient network/CDN blip
      // should not permanently disable fast-start for the rest of the
      // session; the next upload gets to retry loading ffmpeg.
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

// The ffmpeg.wasm instance can only run one job at a time against its
// virtual filesystem. A batch upload (e.g. several question-audio files
// picked together) calls this concurrently via Promise.all in uploadFiles(),
// so queue remux jobs onto a single chain instead of letting them race.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job, job);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function remux(file: File): Promise<File> {
  const ffmpeg = await loadFfmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const ext = getExtension(file.name) || 'm4a';
  const inputName = `in.${ext}`;
  const outputName = `out.${ext}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  try {
    await ffmpeg.exec(['-i', inputName, '-map', '0', '-c', 'copy', '-movflags', '+faststart', outputName]);
    const data = await ffmpeg.readFile(outputName);
    if (!(data instanceof Uint8Array) || data.byteLength === 0) {
      throw new Error('fast-start remux produced no output');
    }
    // Cast to a plain BlobPart — Uint8Array<ArrayBufferLike> from ffmpeg.wasm
    // isn't assignable to the DOM Uint8Array<ArrayBuffer> type File expects.
    return new File([data as unknown as BlobPart], file.name, { type: file.type });
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

/**
 * Returns `file` unchanged if it isn't an MP4-family audio file. Otherwise
 * attempts a fast-start remux and returns the fixed file; if the remux fails
 * for any reason, logs a warning and returns the original file unchanged so
 * the upload always proceeds.
 */
export async function ensureAudioFastStart(file: File): Promise<File> {
  if (!isMp4FamilyAudioFile(file)) {
    return file;
  }

  try {
    return await enqueue(() => remux(file));
  } catch (error) {
    console.warn(
      `Could not optimize "${file.name}" for streaming (fast-start remux failed). Uploading it unchanged.`,
      error
    );
    return file;
  }
}
