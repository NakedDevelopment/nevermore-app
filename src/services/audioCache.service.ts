import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}audio/`;
// v3: cached files are named by sniffing the downloaded file's actual
// container bytes (falling back to the HTTP content type), instead of a
// URL-based guess which is always wrong for extension-less Appwrite Storage
// URLs. A wrong extension still lets audio play but leaves the native decoder
// unable to parse duration/seek metadata (dead progress bar + seek buttons).
// Bumping the key drops old, possibly mislabeled entries so they get
// re-downloaded and re-extensioned correctly.
const CACHE_INDEX_KEY = '@audio_cache_index_v3';

interface CacheEntry {
  remoteUrl: string;
  localPath: string;
  cachedAt: number;
}

interface CacheIndex {
  [urlHash: string]: CacheEntry;
}

// A cold Appwrite Storage file serves the FIRST byte-range request it sees with
// `HTTP 200 + the whole file from byte 0` (header `x-debug-fallback: true`) while
// still advertising `accept-ranges: bytes`; every subsequent request to that now-
// warm file returns a correct `206`. A cheap throwaway request spends that one-shot
// fallback so the native player's real requests all get proper ranges — see
// `primeRangeSupport`. These bound how often we re-prime and how long we wait.
const PRIME_TTL_MS = 60 * 1000;
const PRIME_TIMEOUT_MS = 5000;

/**
 * Service for caching audio files locally
 * Downloads audio once and serves from local storage on subsequent plays
 */
class AudioCacheService {
  private cacheIndex: CacheIndex = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private downloadPromises: Partial<Record<string, Promise<string>>> = {};
  // remoteUrl -> timestamp of the last successful prime (see primeRangeSupport)
  private primedAt: Map<string, number> = new Map();
  // remoteUrl -> in-flight prime, so concurrent callers share one request
  private primingInFlight: Map<string, Promise<void>> = new Map();

  /**
   * Generate a simple hash from URL for filename
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Extract file extension from URL
   */
  private getExtension(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      const ext = urlPath.split('.').pop()?.toLowerCase();
      if (ext && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'].includes(ext)) {
        return ext;
      }
    } catch {}
    return 'mp3'; // Default to mp3
  }

  /**
   * Map an HTTP Content-Type/mimeType to a file extension. Needed because
   * Appwrite Storage "view" URLs (used for all CMS audio) never carry a real
   * file extension in the path, so `getExtension` can only guess 'mp3' from
   * the URL. Caching a non-MP3 file under a forced `.mp3` name causes native
   * decoders to misidentify the container: playback and elapsed-time tracking
   * still work, but duration/seek metadata parsing silently fails.
   */
  private getExtensionFromMimeType(mimeType: string | null | undefined): string | null {
    if (!mimeType) return null;
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/wave': 'wav',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'application/ogg': 'ogg',
      'audio/webm': 'webm',
    };
    return map[normalized] ?? null;
  }

  /**
   * Decode the leading bytes of a base64 string into a byte array. Kept inline
   * so header sniffing needs no extra base64 dependency.
   */
  private base64ToBytes(base64: string): number[] {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < base64.length; i++) {
      const c = base64[i];
      if (c === '=') break;
      const idx = chars.indexOf(c);
      if (idx === -1) continue;
      buffer = (buffer << 6) | idx;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    return bytes;
  }

  /**
   * Identify the true audio container from the file's leading "magic" bytes.
   * This is far more reliable than the URL or HTTP content type for
   * extension-less Appwrite Storage URLs, and giving the cached file its real
   * extension is what lets native decoders parse duration/seek metadata.
   * Returns null when the header isn't recognized.
   */
  private async detectExtensionFromContent(localPath: string): Promise<string | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(localPath, {
        encoding: FileSystem.EncodingType.Base64,
        position: 0,
        length: 16,
      });
      const bytes = this.base64ToBytes(base64);
      if (bytes.length < 4) return null;

      // WAV: "RIFF"
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'wav';
      // OGG: "OggS"
      if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
      // WebM / Matroska (EBML): 0x1A 0x45 0xDF 0xA3
      if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
      // MP4 / M4A: "ftyp" box at offset 4
      if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a';
      // ID3-tagged MP3: "ID3"
      if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'mp3';
      // MPEG-audio / ADTS-AAC frame sync: 0xFF 0xEx-0xFx
      if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
        // ADTS AAC keeps the "layer" field (bits 1-2) at 00; MP3 sets it non-zero.
        if ((bytes[1] & 0x06) === 0x00) return 'aac';
        return 'mp3';
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Initialize cache directory and load index
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    await this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
      }

      // Load cache index from AsyncStorage
      const indexJson = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (indexJson) {
        this.cacheIndex = JSON.parse(indexJson);
        
        // Validate that cached files still exist
        await this.validateCache();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing audio cache:', error);
      this.cacheIndex = {};
      this.initialized = true;
    }
  }

  /**
   * Validate that cached files still exist on disk
   */
  private async validateCache(): Promise<void> {
    const validEntries: CacheIndex = {};
    
    for (const [hash, entry] of Object.entries(this.cacheIndex)) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
        if (fileInfo.exists) {
          validEntries[hash] = entry;
        }
      } catch {
        // File doesn't exist, skip it
      }
    }

    if (Object.keys(validEntries).length !== Object.keys(this.cacheIndex).length) {
      this.cacheIndex = validEntries;
      await this.saveIndex();
    }
  }

  /**
   * Save cache index to AsyncStorage
   */
  private async saveIndex(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(this.cacheIndex));
    } catch (error) {
      console.error('Error saving audio cache index:', error);
    }
  }

  /**
   * Check if audio is cached locally
   */
  async isCached(remoteUrl: string): Promise<boolean> {
    await this.init();
    const hash = this.hashUrl(remoteUrl);
    const entry = this.cacheIndex[hash];
    
    if (!entry) return false;
    
    // Verify file still exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  /**
   * Return a cached file immediately when available. When the file is not
   * cached yet, return the remote URL so playback can stream right away.
   */
  async getPlayableUri(remoteUrl: string): Promise<string> {
    await this.init();

    if (!remoteUrl || remoteUrl.trim() === '') {
      return remoteUrl;
    }

    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith(FileSystem.documentDirectory || '') || remoteUrl.startsWith(FileSystem.cacheDirectory || '')) {
      return remoteUrl;
    }

    const hash = this.hashUrl(remoteUrl);
    const cachedEntry = this.cacheIndex[hash];

    if (cachedEntry) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedEntry.localPath);
        if (fileInfo.exists) {
          return cachedEntry.localPath;
        }
      } catch {
        // Cache entry is stale; stream now and refresh it below.
      }
    }

    return remoteUrl;
  }

  /**
   * Spend Appwrite Storage's cold-file range fallback on a throwaway request so
   * the native player never sees it.
   *
   * A "cold" Appwrite file (one not in the server's range cache) answers the
   * FIRST byte-range request with `HTTP 200 + the entire file from byte 0`
   * (`x-debug-fallback: true`) instead of a `206`, even though it advertises
   * `accept-ranges: bytes`. When that bad response lands on the AVPlayer — e.g.
   * a read-ahead segment or a resume/seek that requests a mid-file range — the
   * player writes start-of-file audio at a mid-track offset, heard as the track
   * audibly restarting while the progress bar keeps advancing. This was the
   * client-reported "restarts at ~2:24" bug.
   *
   * Verified against production (2026-07-21): the fallback is a strict one-shot.
   * A single HEAD (0 bytes downloaded, ~1s) warms the file server-side, after
   * which every range request — from any client, the warm is shared at the
   * origin, not a per-client CDN cache — returns a correct `206`. So we fire one
   * cheap HEAD and await it BEFORE handing the URL to a fresh player; the
   * player's own requests then all hit a warm file. This is deliberately NOT a
   * download: on cellular (where the heavy files stream, since `warmAudio` is
   * WiFi-only) playback starts as fast as plain streaming plus this one HEAD.
   *
   * Best-effort and bounded: capped at PRIME_TIMEOUT_MS, never throws, and a
   * failure/timeout just falls through to streaming (no worse than not priming).
   * A short PRIME_TTL_MS + in-flight dedup keep rapid resume/seek/replay taps
   * from re-priming a file that was primed moments ago, so only the first play
   * of a track pays the HEAD; resumes and seeks within the window are instant.
   */
  async primeRangeSupport(remoteUrl: string): Promise<void> {
    if (!remoteUrl || remoteUrl.trim() === '') return;
    if (
      remoteUrl.startsWith('file://') ||
      remoteUrl.startsWith(FileSystem.documentDirectory || '') ||
      remoteUrl.startsWith(FileSystem.cacheDirectory || '')
    ) {
      return;
    }

    const last = this.primedAt.get(remoteUrl);
    if (last != null && Date.now() - last < PRIME_TTL_MS) return;

    const existing = this.primingInFlight.get(remoteUrl);
    if (existing) return existing;

    const prime = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PRIME_TIMEOUT_MS);
      try {
        // HEAD warms the server-side range cache without pulling any body. The
        // response is the 200 fallback itself, which we discard — we only need
        // the server to have assembled the file so later 206s succeed.
        await fetch(remoteUrl, { method: 'HEAD', signal: controller.signal });
        this.primedAt.set(remoteUrl, Date.now());
      } catch {
        // Timed out or failed — leave unprimed so a later play retries. Playback
        // proceeds by streaming regardless; priming only ever helps.
      } finally {
        clearTimeout(timer);
        this.primingInFlight.delete(remoteUrl);
      }
    })();

    this.primingInFlight.set(remoteUrl, prime);
    return prime;
  }

  /**
   * Whether a *background* full-file download is allowed on the current
   * connection. Background warming pulls the entire file, and on metered
   * cellular it competes for bandwidth with the native player's own streaming
   * fetch when the user taps play on an audio that isn't fully cached yet —
   * starving the actual playback stream (worst for the heaviest files, e.g.
   * "Internal Thoughts"). It also burns cellular data the client asked us to
   * conserve. So warming only runs on unmetered links (WiFi/Ethernet); on
   * cellular the file simply streams on tap (getting the whole pipe) and is
   * warmed later once the user is on WiFi.
   *
   * Fails OPEN (returns true) if the network type can't be determined, so a
   * transient probe failure never permanently disables caching.
   */
  private async isBackgroundDownloadAllowed(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) return false;
      if (state.type === Network.NetworkStateType.CELLULAR) return false;
      return true;
    } catch {
      return true;
    }
  }

  /**
   * User-initiated foreground download of the full file into the cache, with
   * progress. UNLIKE `warmAudio`, this deliberately does NOT self-gate to
   * WiFi — it runs on cellular too, because the user explicitly asked to
   * download this track (e.g. after the "slow connection" prompt). Returns the
   * local file URI on success, or the remote URL as a streaming fallback if the
   * download fails. Already-cached files return immediately (progress 1).
   */
  async downloadForPlayback(
    remoteUrl: string,
    onProgress?: (fraction: number) => void
  ): Promise<string> {
    await this.init();

    if (!remoteUrl || remoteUrl.trim() === '') {
      return remoteUrl;
    }

    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith(FileSystem.documentDirectory || '') || remoteUrl.startsWith(FileSystem.cacheDirectory || '')) {
      onProgress?.(1);
      return remoteUrl;
    }

    const hash = this.hashUrl(remoteUrl);
    const cachedEntry = this.cacheIndex[hash];

    if (cachedEntry) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedEntry.localPath);
        if (fileInfo.exists) {
          onProgress?.(1);
          return cachedEntry.localPath;
        }
      } catch {
        // File disappeared; redownload below.
      }
    }

    return this.downloadAndCache(remoteUrl, hash, onProgress);
  }

  async warmAudio(remoteUrl: string): Promise<void> {
    await this.init();

    if (!remoteUrl || remoteUrl.trim() === '') {
      return;
    }

    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith(FileSystem.documentDirectory || '') || remoteUrl.startsWith(FileSystem.cacheDirectory || '')) {
      return;
    }

    const hash = this.hashUrl(remoteUrl);
    const cachedEntry = this.cacheIndex[hash];

    if (cachedEntry) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedEntry.localPath);
        if (fileInfo.exists) {
          return;
        }
      } catch {
        // File disappeared; redownload below.
      }
    }

    // Only warm on unmetered connections — see isBackgroundDownloadAllowed.
    // Already-cached files returned above are served regardless of connection.
    if (!(await this.isBackgroundDownloadAllowed())) {
      return;
    }

    await this.downloadAndCache(remoteUrl, hash);
  }

  /**
   * Download audio file and cache it locally
   */
  private async downloadAndCache(
    remoteUrl: string,
    hash: string,
    onProgress?: (fraction: number) => void
  ): Promise<string> {
    if (this.downloadPromises[hash]) {
      return this.downloadPromises[hash];
    }

    const guessedExt = this.getExtension(remoteUrl);
    let localPath = `${AUDIO_CACHE_DIR}${hash}.${guessedExt}`;

    this.downloadPromises[hash] = (async () => {
      console.log('Downloading audio to cache:', remoteUrl);

      // createDownloadResumable (not downloadAsync) so we can report progress
      // to a user-facing "Downloading X%" indicator. The callback is a no-op
      // when onProgress is omitted (background warm path).
      const resumable = FileSystem.createDownloadResumable(
        remoteUrl,
        localPath,
        {},
        (p) => {
          if (onProgress && p.totalBytesExpectedToWrite > 0) {
            onProgress(Math.min(1, p.totalBytesWritten / p.totalBytesExpectedToWrite));
          }
        }
      );
      const downloadResult = await resumable.downloadAsync();

      if (!downloadResult || downloadResult.status !== 200) {
        console.warn('Audio download failed with status:', downloadResult?.status);
        return remoteUrl; // Fall back to streaming
      }

      // The URL rarely carries a real extension (Appwrite Storage "view"
      // URLs never do). A wrong extension still plays but leaves the native
      // decoder unable to parse duration/seek metadata, so determine the real
      // container by sniffing the downloaded file's magic bytes, falling back
      // to the HTTP content type, and rename the file if our URL-based guess
      // was wrong.
      const contentType = downloadResult.mimeType ?? downloadResult.headers?.['Content-Type'] ?? downloadResult.headers?.['content-type'];
      const sniffedExt = await this.detectExtensionFromContent(localPath);
      const realExt = sniffedExt ?? this.getExtensionFromMimeType(contentType);
      if (realExt && realExt !== guessedExt) {
        const correctedPath = `${AUDIO_CACHE_DIR}${hash}.${realExt}`;
        try {
          await FileSystem.moveAsync({ from: localPath, to: correctedPath });
          localPath = correctedPath;
        } catch (error) {
          console.warn('Failed to rename cached audio to its real extension:', error);
        }
      }

      // Save to index
      this.cacheIndex[hash] = {
        remoteUrl,
        localPath,
        cachedAt: Date.now(),
      };
      await this.saveIndex();

      console.log('Audio cached successfully:', localPath);
      return localPath;
    })();

    try {
      return await this.downloadPromises[hash];
    } catch (error) {
      console.error('Error caching audio:', error);
      return remoteUrl; // Fall back to streaming
    } finally {
      delete this.downloadPromises[hash];
    }
  }
}

export const audioCacheService = new AudioCacheService();

