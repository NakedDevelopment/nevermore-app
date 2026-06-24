import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}audio/`;
const CACHE_INDEX_KEY = '@audio_cache_index';

interface CacheEntry {
  remoteUrl: string;
  localPath: string;
  cachedAt: number;
}

interface CacheIndex {
  [urlHash: string]: CacheEntry;
}

/**
 * Service for caching audio files locally
 * Downloads audio once and serves from local storage on subsequent plays
 */
class AudioCacheService {
  private cacheIndex: CacheIndex = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private downloadPromises: Partial<Record<string, Promise<string>>> = {};

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
   * Get local path for cached audio, or download and cache if not available
   * @returns Local file URI to use for playback
   */
  async getAudioUri(remoteUrl: string): Promise<string> {
    await this.init();

    if (!remoteUrl || remoteUrl.trim() === '') {
      return remoteUrl;
    }

    // Check if already a local file
    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith(FileSystem.documentDirectory || '') || remoteUrl.startsWith(FileSystem.cacheDirectory || '')) {
      return remoteUrl;
    }

    const hash = this.hashUrl(remoteUrl);
    const cachedEntry = this.cacheIndex[hash];

    // Check if cached and file exists
    if (cachedEntry) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedEntry.localPath);
        if (fileInfo.exists) {
          console.log('Using cached audio:', cachedEntry.localPath);
          return cachedEntry.localPath;
        }
      } catch {
        // File doesn't exist, will re-download
      }
    }

    // Download and cache
    return this.downloadAndCache(remoteUrl, hash);
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

    await this.downloadAndCache(remoteUrl, hash);
  }

  /**
   * Download audio file and cache it locally
   */
  private async downloadAndCache(remoteUrl: string, hash: string): Promise<string> {
    if (this.downloadPromises[hash]) {
      return this.downloadPromises[hash];
    }

    const ext = this.getExtension(remoteUrl);
    const localPath = `${AUDIO_CACHE_DIR}${hash}.${ext}`;

    this.downloadPromises[hash] = (async () => {
      console.log('Downloading audio to cache:', remoteUrl);
      
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);

      if (downloadResult.status !== 200) {
        console.warn('Audio download failed with status:', downloadResult.status);
        return remoteUrl; // Fall back to streaming
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

