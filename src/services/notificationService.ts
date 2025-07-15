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

  private preloadAudioFiles() {
    Object.entries(NOTIFICATION_SOUNDS).forEach(([soundName, soundPath]) => {
      const audio = new Audio(soundPath);
      audio.preload = 'auto';
      audio.volume = 0.7;
      
      // Handle loading errors gracefully
      audio.addEventListener('error', (e) => {
        console.warn(`Failed to preload audio file: ${soundPath}`, e);
      });
      
      this.audioCache.set(soundName, audio);
    });
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

    // Subscribe to task updates (shared task completions)
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

    // Subscribe to event RSVPs
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

    // Subscribe to admin messages
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

  playNotificationSound() {
    try {
      // Try to get cached audio first
      let audio = this.audioCache.get(this.currentSound);
      
      if (!audio) {
        // Fallback: create new audio element
        const soundPath = NOTIFICATION_SOUNDS[this.currentSound as keyof typeof NOTIFICATION_SOUNDS];
        audio = new Audio(soundPath);
        audio.volume = 0.7;
        this.audioCache.set(this.currentSound, audio);
      }
      
      // Reset audio to beginning and play
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.log('Could not play notification sound:', e);
        // Try fallback with new audio element
        this.playFallbackSound();
      });
    } catch (error) {
      console.log('Sound playback failed:', error);
      this.playFallbackSound();
    }
  }

  private playFallbackSound() {
    try {
      const soundPath = NOTIFICATION_SOUNDS[this.currentSound as keyof typeof NOTIFICATION_SOUNDS];
      const fallbackAudio = new Audio(soundPath);
      fallbackAudio.volume = 0.7;
      fallbackAudio.play().catch(e => console.log('Fallback sound also failed:', e));
    } catch (error) {
      console.log('Fallback sound failed:', error);
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

  testSound(soundName: keyof typeof NOTIFICATION_SOUNDS) {
    try {
      // Try cached audio first
      let audio = this.audioCache.get(soundName);
      
      if (!audio) {
        // Create new audio for testing
        audio = new Audio(NOTIFICATION_SOUNDS[soundName]);
        audio.volume = 0.7;
        this.audioCache.set(soundName, audio);
      }
      
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.log('Could not play test sound:', e);
        // Fallback for test sound
        const fallbackAudio = new Audio(NOTIFICATION_SOUNDS[soundName]);
        fallbackAudio.volume = 0.7;
        fallbackAudio.play().catch(err => console.log('Test sound fallback failed:', err));
      });
    } catch (error) {
      console.log('Test sound failed:', error);
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
    
    // Add toast styles if not already present
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
    
    // Remove toast after 4 seconds
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
