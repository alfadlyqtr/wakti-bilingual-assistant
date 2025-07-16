
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

  constructor() {
    this.settings = this.loadSettings();
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

  async playNotificationSound(soundType?: WaktiSoundType): Promise<void> {
    if (!this.settings.enabled) {
      console.log('Sound disabled in settings');
      return;
    }
    
    const sound = soundType || this.settings.selectedSound;
    console.log('🔊 Playing sound:', sound, 'volume:', this.settings.volume);
    
    try {
      const audio = new Audio(WAKTI_SOUNDS[sound]);
      audio.volume = this.settings.volume / 100;
      await audio.play();
      console.log('✅ Sound played successfully');
    } catch (error) {
      console.error('❌ Sound play failed:', error);
    }
  }

  async testSound(soundType: WaktiSoundType): Promise<void> {
    console.log('🎵 Testing sound:', soundType);
    
    try {
      const audio = new Audio(WAKTI_SOUNDS[soundType]);
      audio.volume = this.settings.volume / 100;
      await audio.play();
      console.log('✅ Test sound successful');
    } catch (error) {
      console.error('❌ Test sound failed:', error);
      throw error;
    }
  }

  updateSettings(newSettings: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    console.log('🔧 Sound settings updated:', this.settings);
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
