
import { supabase } from '@/integrations/supabase/client';

// Updated notification sounds using the uploaded MP3 files
const NOTIFICATION_SOUNDS = {
  chime: '/lovable-uploads/chime.mp3',
  beep: '/lovable-uploads/beep.mp3', 
  ding: '/lovable-uploads/ding.mp3'
};

export class NotificationService {
  private currentSound: string = 'chime';
  private isInitialized: boolean = false;
  private subscriptions: any[] = [];
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Load user's sound preference from localStorage
    const savedSound = localStorage.getItem('wakti-notification-sound');
    if (savedSound && NOTIFICATION_SOUNDS[savedSound as keyof typeof NOTIFICATION_SOUNDS]) {
      this.currentSound = savedSound;
    }
    
    // Preload audio files
    this.preloadAudioFiles();
  }

  private async preloadAudioFiles() {
    for (const [soundName, soundPath] of Object.entries(NOTIFICATION_SOUNDS)) {
      try {
        // First check if the file exists
        const response = await fetch(soundPath, { method: 'HEAD' });
        if (!response.ok) {
          console.warn(`Audio file not found: ${soundPath}`);
          continue;
        }

        const audio = new Audio(soundPath);
        audio.preload = 'auto';
        audio.volume = 0.7;
        
        // Handle loading errors gracefully
        audio.addEventListener('error', (e) => {
          console.warn(`Failed to preload audio file: ${soundPath}`, e);
        });
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`Audio file loaded successfully: ${soundPath}`);
        });
        
        this.audioCache.set(soundName, audio);
      } catch (error) {
        console.warn(`Failed to check/preload audio file: ${soundPath}`, error);
      }
    }
  }

  init() {
    if (this.isInitialized) return;
    
    console.log('🔔 Initializing notification service...');
    this.isInitialized = true;
    this.setupRealtimeSubscriptions();
  }

  cleanup() {
    console.log('🛑 Cleaning up notification service...');
    this.subscriptions.forEach(subscription => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    });
    this.subscriptions = [];
    this.isInitialized = false;
    
    // Clean up audio cache
    this.audioCache.clear();
  }

  private setupRealtimeSubscriptions() {
    // Subscribe to contact requests
    const contactsChannel = supabase
      .channel('notification-contacts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts'
        },
        (payload) => {
          if (payload.new.status === 'pending') {
            this.showToast(
              'New Contact Request',
              'Someone wants to connect with you',
              'contact'
            );
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('notification-tasks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shared_task_completions'
        },
        (payload) => {
          this.showToast(
            'Task Update',
            `${payload.new.completed_by_name || 'Someone'} completed a shared task`,
            'task'
          );
        }
      )
      .subscribe();

    const rsvpChannel = supabase
      .channel('notification-rsvps')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_rsvps'
        },
        (payload) => {
          this.showToast(
            'New RSVP',
            `${payload.new.guest_name || 'Someone'} responded to your event`,
            'event'
          );
        }
      )
      .subscribe();

    const adminChannel = supabase
      .channel('notification-admin')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_messages'
        },
        (payload) => {
          this.showToast(
            'Message from Admin',
            payload.new.subject || 'You have a new admin message',
            'admin'
          );
        }
      )
      .subscribe();

    this.subscriptions = [contactsChannel, tasksChannel, rsvpChannel, adminChannel];
  }

  async playNotificationSound() {
    try {
      console.log(`🔊 Attempting to play sound: ${this.currentSound}`);
      
      // Try to get cached audio first
      let audio = this.audioCache.get(this.currentSound);
      
      if (!audio) {
        console.log('Creating new audio element for', this.currentSound);
        const soundPath = NOTIFICATION_SOUNDS[this.currentSound as keyof typeof NOTIFICATION_SOUNDS];
        audio = new Audio(soundPath);
        audio.volume = 0.7;
        this.audioCache.set(this.currentSound, audio);
      }
      
      // Reset audio to beginning and play
      audio.currentTime = 0;
      
      // Use async play with proper error handling
      await audio.play();
      console.log(`✅ Sound played successfully: ${this.currentSound}`);
      
    } catch (error) {
      console.warn('🔇 Sound playback failed:', error);
      // Try fallback with direct file creation
      await this.playFallbackSound();
    }
  }

  private async playFallbackSound() {
    try {
      console.log('🔄 Trying fallback sound playback');
      const soundPath = NOTIFICATION_SOUNDS[this.currentSound as keyof typeof NOTIFICATION_SOUNDS];
      const fallbackAudio = new Audio(soundPath);
      fallbackAudio.volume = 0.7;
      await fallbackAudio.play();
      console.log('✅ Fallback sound played successfully');
    } catch (error) {
      console.warn('🔇 Fallback sound also failed:', error);
    }
  }

  setSoundPreference(soundName: keyof typeof NOTIFICATION_SOUNDS) {
    this.currentSound = soundName;
    localStorage.setItem('wakti-notification-sound', soundName);
    
    // Preload the new sound if not cached
    if (!this.audioCache.has(soundName)) {
      const audio = new Audio(NOTIFICATION_SOUNDS[soundName]);
      audio.preload = 'auto';
      audio.volume = 0.7;
      this.audioCache.set(soundName, audio);
    }
  }

  getSoundOptions() {
    return Object.keys(NOTIFICATION_SOUNDS);
  }

  getCurrentSound() {
    return this.currentSound;
  }

  async testSound(soundName: keyof typeof NOTIFICATION_SOUNDS) {
    try {
      console.log(`🧪 Testing sound: ${soundName}`);
      
      // Try cached audio first
      let audio = this.audioCache.get(soundName);
      
      if (!audio) {
        // Create new audio for testing
        audio = new Audio(NOTIFICATION_SOUNDS[soundName]);
        audio.volume = 0.7;
        this.audioCache.set(soundName, audio);
      }
      
      audio.currentTime = 0;
      await audio.play();
      console.log(`✅ Test sound played successfully: ${soundName}`);
      
    } catch (error) {
      console.warn('🔇 Test sound failed:', error);
      // Fallback for test sound
      try {
        const fallbackAudio = new Audio(NOTIFICATION_SOUNDS[soundName]);
        fallbackAudio.volume = 0.7;
        await fallbackAudio.play();
        console.log('✅ Test fallback sound played');
      } catch (err) {
        console.warn('🔇 Test sound fallback also failed:', err);
      }
    }
  }

  showToast(title: string, message: string, type: 'message' | 'task' | 'contact' | 'event' | 'admin') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'wakti-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${this.getIconForType(type)}</div>
        <div class="toast-text">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
      </div>
    `;
    
    if (!document.head.querySelector('style[data-wakti-toast]')) {
      const style = document.createElement('style');
      style.setAttribute('data-wakti-toast', 'true');
      style.textContent = `
        .wakti-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: hsl(var(--card));
          color: hsl(var(--card-foreground));
          border: 1px solid hsl(var(--border));
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
          max-width: 320px;
          min-width: 280px;
        }
        
        .toast-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .toast-icon {
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        
        .toast-text {
          flex: 1;
        }
        
        .toast-title {
          font-weight: 600;
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 4px;
        }
        
        .toast-message {
          font-size: 13px;
          opacity: 0.8;
          line-height: 1.4;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
    
    // Play sound
    this.playNotificationSound();
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'message': return '💬';
      case 'task': return '✅';
      case 'contact': return '👥';
      case 'event': return '📅';
      case 'admin': return '🎁';
      default: return '🔔';
    }
  }
}

export const notificationService = new NotificationService();
