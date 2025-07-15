
import { supabase } from '@/integrations/supabase/client';

// 3 embedded notification sounds as base64 data (short 1-2 second clips)
const NOTIFICATION_SOUNDS = {
  chime: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwMZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAUUXrTp3KFSDwxFnODyvmYfBTuM0+7PfC0GMnS86uOiUgcQXK3j2qhXEAouiNDJew==',
  beep: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwMZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAUUXrTp3KFSDwxFnODyvmYfBTuM0+7PfC0GMnS86uOiUgcQXK3j2qhXEAouiNDJew==',
  ding: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwMZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAUUXrTp3KFSDwxFnODyvmYfBTuM0+7PfC0GMnS86uOiUgcQXK3j2qhXEAouiNDJew=='
};

export class NotificationService {
  private currentSound: string = 'chime';
  private isInitialized: boolean = false;
  private subscriptions: any[] = [];

  constructor() {
    // Load user's sound preference from localStorage
    const savedSound = localStorage.getItem('wakti-notification-sound');
    if (savedSound && NOTIFICATION_SOUNDS[savedSound as keyof typeof NOTIFICATION_SOUNDS]) {
      this.currentSound = savedSound;
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
      const audio = new Audio(NOTIFICATION_SOUNDS[this.currentSound as keyof typeof NOTIFICATION_SOUNDS]);
      audio.volume = 0.7;
      audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (error) {
      console.log('Sound playback failed:', error);
    }
  }

  setSoundPreference(soundName: keyof typeof NOTIFICATION_SOUNDS) {
    this.currentSound = soundName;
    localStorage.setItem('wakti-notification-sound', soundName);
  }

  getSoundOptions() {
    return Object.keys(NOTIFICATION_SOUNDS);
  }

  getCurrentSound() {
    return this.currentSound;
  }

  testSound(soundName: keyof typeof NOTIFICATION_SOUNDS) {
    const audio = new Audio(NOTIFICATION_SOUNDS[soundName]);
    audio.volume = 0.7;
    audio.play().catch(e => console.log('Could not play test sound:', e));
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
