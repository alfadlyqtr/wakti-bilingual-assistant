const WAKTI_SOUNDS = {
  chime: '/lovable-uploads/chime.mp3',
  beep: '/lovable-uploads/beep.mp3',
  ding: '/lovable-uploads/ding.mp3'
};

export type WaktiSoundType = keyof typeof WAKTI_SOUNDS;

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  selectedSound: WaktiSoundType;
}

export class WaktiSoundManager {
  private settings: SoundSettings;
  private audioCache: Map<WaktiSoundType, HTMLAudioElement> = new Map();

  constructor() {
    this.settings = this.loadSettings();
    this.preloadSounds();
  }

  private loadSettings(): SoundSettings {
    const saved = localStorage.getItem('wakti-sound-settings');
    if (saved) {
      try {
        return { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      } catch (e) {
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

  private async preloadSounds(): Promise<void> {
    for (const [key, url] of Object.entries(WAKTI_SOUNDS)) {
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = this.settings.volume / 100;
        this.audioCache.set(key as WaktiSoundType, audio);
      } catch (error) {
        console.warn(`Failed to preload sound: ${key}`);
      }
    }
  }

  async playNotificationSound(soundType?: WaktiSoundType): Promise<void> {
    if (!this.settings.enabled) return;
    
    const sound = soundType || this.settings.selectedSound;
    console.log('Playing sound:', sound);
    
    try {
      const audio = new Audio(WAKTI_SOUNDS[sound]);
      audio.volume = this.settings.volume / 100;
      await audio.play();
    } catch (error) {
      console.warn('Sound failed:', error);
    }
  }

  async testSound(soundType: WaktiSoundType): Promise<void> {
    try {
      const audio = new Audio(WAKTI_SOUNDS[soundType]);
      audio.volume = this.settings.volume / 100;
      await audio.play();
    } catch (error) {
      console.error('Test sound failed:', error);
    }
  }

  updateSettings(newSettings: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    if (newSettings.volume !== undefined) {
      this.audioCache.forEach(audio => {
        audio.volume = this.settings.volume / 100;
      });
    }
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
}

export const waktiSounds = new WaktiSoundManager();
