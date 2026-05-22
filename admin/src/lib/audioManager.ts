// Global audio manager to ensure only one audio plays at a time
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayerId: string | null = null;
  private players: Map<string, HTMLAudioElement> = new Map();

  register(playerId: string, audioElement: HTMLAudioElement) {
    this.players.set(playerId, audioElement);
  }

  unregister(playerId: string) {
    this.players.delete(playerId);
    if (this.currentPlayerId === playerId) {
      this.currentAudio = null;
      this.currentPlayerId = null;
    }
  }

  play(playerId: string): boolean {
    const audio = this.players.get(playerId);
    if (!audio) return false;

    // Pause currently playing audio if different
    if (this.currentAudio && this.currentAudio !== audio) {
      if (!this.currentAudio.paused) {
        this.currentAudio.pause();
      }
      // Clear current player if it's different
      if (this.currentPlayerId !== playerId) {
        this.currentPlayerId = null;
      }
    }

    // Set the new current audio (will be played by the component)
    this.currentAudio = audio;
    this.currentPlayerId = playerId;
    return true;
  }

  pause(playerId: string) {
    const audio = this.players.get(playerId);
    if (audio && !audio.paused) {
      audio.pause();
    }
    if (this.currentPlayerId === playerId) {
      this.currentAudio = null;
      this.currentPlayerId = null;
    }
  }

  isPlaying(playerId: string): boolean {
    return this.currentPlayerId === playerId && this.currentAudio !== null && !this.currentAudio.paused;
  }

  getCurrentPlayerId(): string | null {
    return this.currentPlayerId;
  }
}

export const audioManager = new AudioManager();

