
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
  private userInteracted: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioUnlocked: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor() {
    this.settings = this.loadSettings();
    this.setupUserInteraction();
    this.initializeAudioContext();
    console.log('🎵 WaktiSoundManager initialized:', {
      settings: this.settings,
      userAgent: navigator.userAgent,
      isMobile: this.isMobileDevice()
    });
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private initializeAudioContext(): void {
    try {
      // Create AudioContext for better browser compatibility
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 AudioContext created:', this.audioContext.state);
    } catch (error) {
      console.warn('🎵 Failed to create AudioContext:', error);
    }
  }

  private setupUserInteraction(): void {
    const interactionEvents = ['click', 'touchstart', 'touchend', 'mousedown', 'keydown'];
    
    const enableInteraction = async () => {
      this.userInteracted = true;
      console.log('🎵 User interaction detected, attempting to unlock audio');
      
      // Attempt to unlock audio context
      await this.unlockAudioContext();
      
      // Test audio playability
      await this.testAudioPlayability();
      
      // Remove listeners after first interaction
      interactionEvents.forEach(event => {
        document.removeEventListener(event, enableInteraction);
      });
    };
    
    interactionEvents.forEach(event => {
      document.addEventListener(event, enableInteraction, { once: true });
    });
  }

  private async unlockAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🎵 AudioContext resumed:', this.audioContext.state);
      } catch (error) {
        console.warn('🎵 Failed to resume AudioContext:', error);
      }
    }
    
    // Create and play a silent audio to unlock
    try {
      const audio = new Audio();
      audio.volume = 0;
      audio.muted = true;
      const playPromise = audio.play();
      if (playPromise) {
        await playPromise.catch(() => {}); // Ignore errors for silent unlock
      }
      this.audioUnlocked = true;
      console.log('🎵 Audio unlocked successfully');
    } catch (error) {
      console.warn('🎵 Audio unlock failed:', error);
    }
  }

  private async testAudioPlayability(): Promise<void> {
    try {
      const testUrl = WAKTI_SOUNDS.chime;
      console.log('🎵 Testing audio playability with:', testUrl);
      
      // Check if file exists
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Audio file not accessible: ${response.status}`);
      }
      
      // Try to create and load audio
      const audio = new Audio(testUrl);
      audio.volume = 0.1;
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Load timeout')), 3000);
        
        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          console.log('🎵 Audio test successful - files are playable');
          resolve(true);
        });
        
        audio.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(new Error(`Audio load error: ${e}`));
        });
        
        audio.load();
      });
      
    } catch (error) {
      console.error('🎵 Audio playability test failed:', error);
    }
  }

  private loadSettings(): SoundSettings {
    const saved = localStorage.getItem('wakti-sound-settings');
    if (saved) {
      try {
        const parsed = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
        console.log('🎵 Loaded saved settings:', parsed);
        return parsed;
      } catch (e) {
        console.warn('🎵 Failed to parse saved settings, using defaults');
        return this.getDefaultSettings();
      }
    }
    console.log('🎵 Using default settings');
    return this.getDefaultSettings();
  }

  private getDefaultSettings(): SoundSettings {
    return { enabled: true, volume: 70, selectedSound: 'chime' };
  }

  private saveSettings(): void {
    localStorage.setItem('wakti-sound-settings', JSON.stringify(this.settings));
    console.log('🎵 Settings saved:', this.settings);
  }

  async playNotificationSound(soundType?: WaktiSoundType): Promise<boolean> {
    const debugInfo = {
      soundType,
      enabled: this.settings.enabled,
      userInteracted: this.userInteracted,
      audioUnlocked: this.audioUnlocked,
      volume: this.settings.volume,
      audioContextState: this.audioContext?.state,
      isMobile: this.isMobileDevice(),
      retryCount: this.retryCount
    };
    
    console.log('🔊 playNotificationSound called:', debugInfo);

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
      return await this.attemptPlaySound(soundUrl, sound);
    } catch (error) {
      console.error('❌ Sound play failed:', error);
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying sound play (${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        return this.attemptPlaySound(soundUrl, sound);
      }
      
      this.retryCount = 0;
      return false;
    }
  }

  private async attemptPlaySound(soundUrl: string, sound: WaktiSoundType): Promise<boolean> {
    console.log('🔊 Attempting to play sound:', {
      sound,
      soundUrl,
      volume: this.settings.volume / 100
    });
    
    // Check file accessibility
    const response = await fetch(soundUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`Sound file not accessible: ${soundUrl} (${response.status})`);
    }
    
    const audio = new Audio(soundUrl);
    audio.volume = this.settings.volume / 100;
    audio.preload = 'auto';
    
    // Wait for audio to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'));
      }, 5000);
      
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        console.log('✅ Audio loaded and ready');
        resolve(true);
      });
      
      audio.addEventListener('error', (e) => {
        clearTimeout(timeout);
        console.error('❌ Audio load error:', e);
        reject(e);
      });
      
      audio.load();
    });
    
    // Play the audio
    const playPromise = audio.play();
    if (playPromise) {
      await playPromise;
    }
    
    console.log('✅ Sound played successfully');
    this.retryCount = 0; // Reset retry count on success
    return true;
  }

  async testSound(soundType: WaktiSoundType): Promise<void> {
    console.log('🎵 Testing sound:', soundType);
    
    if (!this.userInteracted) {
      throw new Error('User interaction required. Please click anywhere first.');
    }
    
    try {
      const audio = new Audio(WAKTI_SOUNDS[soundType]);
      audio.volume = this.settings.volume / 100;
      
      // Test file accessibility first
      const response = await fetch(WAKTI_SOUNDS[soundType], { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Sound file not found: ${response.status}`);
      }
      
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

  // Public method to check audio status
  getAudioStatus() {
    return {
      enabled: this.settings.enabled,
      userInteracted: this.userInteracted,
      audioUnlocked: this.audioUnlocked,
      audioContextState: this.audioContext?.state,
      isMobile: this.isMobileDevice()
    };
  }

  // Public method to manually unlock audio
  async manualUnlock(): Promise<boolean> {
    try {
      await this.unlockAudioContext();
      this.userInteracted = true;
      return true;
    } catch (error) {
      console.error('❌ Manual audio unlock failed:', error);
      return false;
    }
  }
}

export const waktiSounds = new WaktiSoundManager();

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).waktiSounds = waktiSounds;
}
