
export type WaktiSoundType = 'chime' | 'beep' | 'ding';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  selectedSound: WaktiSoundType;
}

const WAKTI_SOUNDS = {
  chime: '/lovable-uploads/chime.mp3',
  beep: '/lovable-uploads/beep.mp3',
  ding: '/lovable-uploads/ding.mp3'
};

class WaktiSoundManager {
  private settings: SoundSettings;
  private audioContext: AudioContext | null = null;
  private soundsInitialized = false;
  private userInteracted = false;

  constructor() {
    this.settings = this.loadSettings();
    console.log('🎵 WaktiSoundManager initialized:', this.settings);
    this.setupUserInteractionListener();
  }

  private setupUserInteractionListener(): void {
    // Listen for first user interaction to enable sounds
    const enableSounds = () => {
      this.userInteracted = true;
      this.initializeAudioContext();
      document.removeEventListener('click', enableSounds);
      document.removeEventListener('touchstart', enableSounds);
      document.removeEventListener('keydown', enableSounds);
    };

    document.addEventListener('click', enableSounds);
    document.addEventListener('touchstart', enableSounds);
    document.addEventListener('keydown', enableSounds);
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 Audio context initialized');
    } catch (error) {
      console.warn('🎵 Could not create audio context:', error);
    }
  }

  private loadSettings(): SoundSettings {
    const saved = localStorage.getItem('wakti-sound-settings');
    if (saved) {
      try {
        return { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      } catch (e) {
        console.warn('🎵 Failed to parse saved settings, using defaults');
        return this.getDefaultSettings();
      }
    }
    return this.getDefaultSettings();
  }

  private getDefaultSettings(): SoundSettings {
    return { enabled: true, volume: 70, selectedSound: 'chime' };
  }

  private saveSettings(): void {
    localStorage.setItem('wakti-sound-settings', JSON.stringify(this.settings));
  }

  async playNotificationSound(soundType?: WaktiSoundType): Promise<boolean> {
    if (!this.settings.enabled) {
      console.log('🔇 Sound disabled in settings');
      return false;
    }

    if (!this.userInteracted) {
      console.log('🔇 No user interaction yet, cannot play sound');
      return false;
    }

    const sound = soundType || this.settings.selectedSound;
    const soundUrl = WAKTI_SOUNDS[sound];
    
    try {
      console.log('🔊 Playing sound:', sound, 'from:', soundUrl);
      
      // Resume audio context if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const audio = new Audio(soundUrl);
      audio.volume = this.settings.volume / 100;
      
      // Add error handling for audio loading
      audio.onerror = (error) => {
        console.error('❌ Audio loading failed:', error);
      };

      audio.oncanplaythrough = () => {
        console.log('✅ Audio loaded successfully');
      };

      await audio.play();
      console.log('✅ Sound played successfully');
      return true;
    } catch (error) {
      console.error('❌ Sound play failed:', error);
      
      // Show user-friendly message for autoplay blocks
      if (error.name === 'NotAllowedError') {
        console.log('🔇 Autoplay blocked by browser. User needs to interact first.');
      }
      
      return false;
    }
  }

  async testSound(soundType: WaktiSoundType): Promise<boolean> {
    if (!this.userInteracted) {
      console.log('🔇 Cannot test sound without user interaction');
      return false;
    }

    try {
      const audio = new Audio(WAKTI_SOUNDS[soundType]);
      audio.volume = this.settings.volume / 100;
      await audio.play();
      console.log('✅ Test sound played:', soundType);
      return true;
    } catch (error) {
      console.error('❌ Test sound failed:', error);
      return false;
    }
  }

  updateSettings(newSettings: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    console.log('🎵 Settings updated:', this.settings);
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  getAllSounds(): WaktiSoundType[] {
    return Object.keys(WAKTI_SOUNDS) as WaktiSoundType[];
  }

  getSoundDisplayName(sound: WaktiSoundType): string {
    const names = {
      chime: 'Gentle Chime',
      beep: 'Classic Beep',
      ding: 'Pleasant Ding'
    };
    return names[sound];
  }

  isUserInteracted(): boolean {
    return this.userInteracted;
  }

  // Method to manually enable sounds after user interaction
  enableSounds(): void {
    this.userInteracted = true;
    this.initializeAudioContext();
  }
}

export const waktiSounds = new WaktiSoundManager();

if (typeof window !== 'undefined') {
  (window as any).waktiSounds = waktiSounds;
}
