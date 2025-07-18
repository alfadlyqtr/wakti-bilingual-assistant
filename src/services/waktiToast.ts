
import { waktiSounds, WaktiSoundType } from './waktiSounds';
import { toast } from 'sonner';

export interface WaktiNotification {
  id: string;
  type: 'message' | 'task' | 'contact' | 'event' | 'admin' | 'shared_task';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sound?: WaktiSoundType;
  duration?: number;
}

class WaktiToastManager {
  private recentToasts: Set<string> = new Set();

  private generateToastKey(notification: WaktiNotification): string {
    return `${notification.type}-${notification.title}-${notification.message}`;
  }

  private isDuplicateToast(notification: WaktiNotification): boolean {
    const key = this.generateToastKey(notification);
    if (this.recentToasts.has(key)) {
      console.log('🚫 Duplicate toast prevented:', key);
      return true;
    }
    
    this.recentToasts.add(key);
    setTimeout(() => this.recentToasts.delete(key), 2000);
    return false;
  }

  async show(notification: WaktiNotification): Promise<void> {
    console.log('📢 WaktiToast.show called:', notification);
    
    if (this.isDuplicateToast(notification)) return;

    if (!notification.id) {
      notification.id = `wakti-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (!notification.duration) {
      const durations = { low: 2000, normal: 3000, high: 4000, urgent: 6000 };
      notification.duration = durations[notification.priority];
    }

    // Play sound first - with proper error handling
    try {
      const soundSuccess = await waktiSounds.playNotificationSound(notification.sound);
      if (!soundSuccess) {
        console.log('🔇 Sound failed to play, but continuing with toast');
      }
    } catch (error) {
      console.warn('🔊 Sound failed, but continuing with toast:', error);
    }

    // Show toast
    const icon = this.getNotificationIcon(notification.type);
    const toastMessage = `${icon} ${notification.title}: ${notification.message}`;
    
    console.log('📢 Showing toast:', toastMessage);
    
    switch (notification.priority) {
      case 'urgent':
      case 'high':
        toast.error(toastMessage, { duration: notification.duration });
        break;
      case 'normal':
        toast.success(toastMessage, { duration: notification.duration });
        break;
      case 'low':
      default:
        toast(toastMessage, { duration: notification.duration });
        break;
    }
  }

  private getNotificationIcon(type: string): string {
    const icons = {
      message: '💬', task: '✅', contact: '👥',
      event: '📅', admin: '🎁', shared_task: '🔄'
    };
    return icons[type] || '🔔';
  }
}

export const waktiToast = new WaktiToastManager();
if (typeof window !== 'undefined') {
  (window as any).waktiToast = waktiToast;
}
