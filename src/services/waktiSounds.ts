
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

  constructor() {
    this.settings = this.loadSettings();
    console.log('🎵 WaktiSoundManager initialized:', this.settings);
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

    const sound = soundType || this.settings.selectedSound;
    const soundUrl = WAKTI_SOUNDS[sound];
    
    try {
      console.log('🔊 Playing sound:', sound, 'from:', soundUrl);
      
      const audio = new Audio(soundUrl);
      audio.volume = this.settings.volume / 100;
      
      await audio.play();
      console.log('✅ Sound played successfully');
      return true;
    } catch (error) {
      console.error('❌ Sound play failed:', error);
      return false;
    }
  }

  async testSound(soundType: WaktiSoundType): Promise<boolean> {
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
}

export const waktiSounds = new WaktiSoundManager();

if (typeof window !== 'undefined') {
  (window as any).waktiSounds = waktiSounds;
}
