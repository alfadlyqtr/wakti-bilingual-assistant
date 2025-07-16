import { waktiSounds, WaktiSoundType } from './waktiSounds';

export interface WaktiNotification {
  id: string;
  type: 'message' | 'task' | 'contact' | 'event' | 'admin' | 'shared_task';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sound?: WaktiSoundType;
  duration?: number;
}

export interface ToastSettings {
  enabled: boolean;
  position: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
  maxVisible: number;
  showProgress: boolean;
}

class WaktiToastManager {
  private toasts: Map<string, WaktiNotification> = new Map();
  private settings: ToastSettings;
  private container: HTMLElement | null = null;
  private recentToasts: Set<string> = new Set();

  constructor() {
    this.settings = this.loadToastSettings();
    this.createContainer();
  }

  private loadToastSettings(): ToastSettings {
    const saved = localStorage.getItem('wakti-toast-settings');
    if (saved) {
      try {
        return { ...this.getDefaultToastSettings(), ...JSON.parse(saved) };
      } catch (e) {
        return this.getDefaultToastSettings();
      }
    }
    return this.getDefaultToastSettings();
  }

  private getDefaultToastSettings(): ToastSettings {
    return {
      enabled: true,
      position: 'top-right',
      maxVisible: 3,
      showProgress: true
    };
  }

  private createContainer(): void {
    if (typeof window === 'undefined') return;
    this.container = document.createElement('div');
    this.container.id = 'wakti-toast-container';
    this.updateContainerPosition();
    document.body.appendChild(this.container);
  }

  private updateContainerPosition(): void {
    if (!this.container) return;
    const baseStyles = {
      position: 'fixed',
      zIndex: '10000',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '400px',
      padding: '16px'
    };
    const positionStyles = {
      'top-right': { top: '0', right: '0' },
      'top-center': { top: '0', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '0', right: '0' },
      'bottom-center': { bottom: '0', left: '50%', transform: 'translateX(-50%)' }
    };
    Object.assign(this.container.style, baseStyles, positionStyles[this.settings.position]);
  }

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
    if (!this.settings.enabled) return;
    
    if (this.isDuplicateToast(notification)) return;

    if (!notification.id) {
      notification.id = `wakti-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!notification.duration) {
      const durations = { low: 2000, normal: 3000, high: 4000, urgent: 6000 };
      notification.duration = durations[notification.priority];
    }

    // Play sound FIRST and wait for it
    try {
      if (notification.sound) {
        await waktiSounds.playNotificationSound(notification.sound);
      } else {
        await waktiSounds.playNotificationSound();
      }
    } catch (error) {
      console.warn('Sound failed, but continuing with toast:', error);
    }

    this.toasts.set(notification.id, notification);
    this.limitVisibleToasts();
    this.createToastElement(notification);
    
    setTimeout(() => {
      this.dismiss(notification.id);
    }, notification.duration);
  }

  private limitVisibleToasts(): void {
    const toastIds = Array.from(this.toasts.keys());
    if (toastIds.length > this.settings.maxVisible) {
      const toRemove = toastIds.slice(0, toastIds.length - this.settings.maxVisible);
      toRemove.forEach(id => this.dismiss(id));
    }
  }

  private createToastElement(notification: WaktiNotification): void {
    if (!this.container) return;
    const toast = document.createElement('div');
    toast.id = `toast-${notification.id}`;
    const icon = this.getNotificationIcon(notification.type);
    
    toast.innerHTML = `
      <div class="wakti-toast-content">
        <div class="wakti-toast-icon">${icon}</div>
        <div class="wakti-toast-text">
          <div class="wakti-toast-title">${notification.title}</div>
          <div class="wakti-toast-message">${notification.message}</div>
        </div>
        <button class="wakti-toast-close" onclick="window.waktiToast.dismiss('${notification.id}')">×</button>
      </div>
      ${this.settings.showProgress ? `<div class="wakti-toast-progress"><div class="wakti-toast-progress-bar"></div></div>` : ''}
    `;

    this.addToastStyles();
    this.container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('wakti-toast-enter');
    });

    if (this.settings.showProgress) {
      const progressBar = toast.querySelector('.wakti-toast-progress-bar') as HTMLElement;
      if (progressBar) {
        progressBar.style.animation = `wakti-progress ${notification.duration}ms linear`;
      }
    }
  }

  private getNotificationIcon(type: string): string {
    const icons = {
      message: '💬', task: '✅', contact: '👥',
      event: '📅', admin: '🎁', shared_task: '🔄'
    };
    return icons[type] || '🔔';
  }

  dismiss(id: string): void {
    const toast = document.getElementById(`toast-${id}`);
    if (toast) {
      toast.classList.add('wakti-toast-exit');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
    this.toasts.delete(id);
  }

  private addToastStyles(): void {
    if (document.getElementById('wakti-toast-styles')) return;
    const styles = document.createElement('style');
    styles.id = 'wakti-toast-styles';
    styles.textContent = `
      .wakti-toast-content {
        pointer-events: auto;
        background: hsl(var(--background));
        border: 1px solid hsl(var(--border));
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
      }
      .wakti-toast-enter .wakti-toast-content { transform: translateX(0); opacity: 1; }
      .wakti-toast-exit .wakti-toast-content { transform: translateX(100%); opacity: 0; }
      .wakti-toast-icon { font-size: 20px; flex-shrink: 0; }
      .wakti-toast-title { font-weight: 600; font-size: 14px; color: hsl(var(--foreground)); }
      .wakti-toast-message { font-size: 13px; color: hsl(var(--muted-foreground)); }
      .wakti-toast-close { background: none; border: none; cursor: pointer; }
      .wakti-toast-progress { height: 3px; background: hsl(var(--muted)); }
      .wakti-toast-progress-bar { height: 100%; background: hsl(var(--accent-blue)); width: 100%; transform: translateX(-100%); }
      @keyframes wakti-progress { to { transform: translateX(0); } }
    `;
    document.head.appendChild(styles);
  }

  updateSettings(newSettings: Partial<ToastSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('wakti-toast-settings', JSON.stringify(this.settings));
    this.updateContainerPosition();
  }

  getSettings(): ToastSettings {
    return { ...this.settings };
  }
}

export const waktiToast = new WaktiToastManager();
if (typeof window !== 'undefined') {
  (window as any).waktiToast = waktiToast;
}
