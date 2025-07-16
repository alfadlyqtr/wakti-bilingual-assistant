
import { waktiToast, WaktiNotification } from './waktiToast';
import { waktiSounds, WaktiSoundType } from './waktiSounds';
import { waktiBadges } from './waktiBadges';

export interface WaktiNotificationConfig {
  enableToasts: boolean;
  enableSounds: boolean;
  enableBadges: boolean;
  enableVibration: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface NotificationTypeConfig {
  sound: WaktiSoundType;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  duration: number;
  vibration: number[];
}

class WaktiNotificationService {
  private config: WaktiNotificationConfig;
  private typeConfigs: Map<string, NotificationTypeConfig> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.setupDefaultTypeConfigs();
  }

  private loadConfig(): WaktiNotificationConfig {
    const saved = localStorage.getItem('wakti-notification-config');
    if (saved) {
      try {
        return { ...this.getDefaultConfig(), ...JSON.parse(saved) };
      } catch (e) {
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): WaktiNotificationConfig {
    return {
      enableToasts: true,
      enableSounds: true,
      enableBadges: true,
      enableVibration: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  private setupDefaultTypeConfigs(): void {
    const defaults = new Map([
      ['message', { sound: 'chime' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [200, 100, 200] }],
      ['task', { sound: 'ding' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [100, 50, 100] }],
      ['shared_task', { sound: 'beep' as WaktiSoundType, priority: 'high' as const, duration: 4000, vibration: [200, 100, 200, 100, 200] }],
      ['contact', { sound: 'chime' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [300, 100, 300] }],
      ['event', { sound: 'ding' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [150, 75, 150] }],
      ['admin', { sound: 'chime' as WaktiSoundType, priority: 'high' as const, duration: 4000, vibration: [500, 100, 500] }]
    ]);

    const saved = localStorage.getItem('wakti-notification-type-configs');
    if (saved) {
      try {
        const savedConfigs = JSON.parse(saved);
        defaults.forEach((defaultConfig, type) => {
          this.typeConfigs.set(type, { ...defaultConfig, ...savedConfigs[type] });
        });
      } catch (e) {
        this.typeConfigs = defaults;
      }
    } else {
      this.typeConfigs = defaults;
    }
  }

  private isQuietTime(): boolean {
    if (!this.config.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = this.config.quietHours;
    
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }
    
    return currentTime >= start && currentTime <= end;
  }

  async showNotification(data: {
    type: string;
    title: string;
    message: string;
    data?: any;
    customSound?: WaktiSoundType;
    customPriority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<void> {
    if (this.isQuietTime()) {
      console.log('Notification skipped - quiet hours active');
      return;
    }

    const typeConfig = this.typeConfigs.get(data.type);
    if (!typeConfig) {
      console.warn(`No config found for notification type: ${data.type}`);
      return;
    }

    const notification: WaktiNotification = {
      id: `wakti-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: data.type as WaktiNotification['type'],
      title: data.title,
      message: data.message,
      priority: data.customPriority || typeConfig.priority,
      sound: data.customSound || typeConfig.sound,
      duration: typeConfig.duration
    };

    if (this.config.enableToasts) {
      await waktiToast.show(notification);
    }

    if (this.config.enableBadges) {
      waktiBadges.incrementBadge(data.type, 1, notification.priority);
    }

    if (this.config.enableVibration && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(typeConfig.vibration);
      } catch (error) {
        console.warn('Vibration failed:', error);
      }
    }
  }

  updateBadgeCount(type: string, count: number, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    if (this.config.enableBadges) {
      waktiBadges.updateBadge(type, count, priority);
    }
  }

  clearBadge(type: string): void {
    waktiBadges.clearBadge(type);
  }

  async testNotification(type: string): Promise<void> {
    await this.showNotification({
      type,
      title: 'Test Notification',
      message: `This is a test ${type} notification`
    });
  }

  updateConfig(newConfig: Partial<WaktiNotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('wakti-notification-config', JSON.stringify(this.config));
  }

  getConfig(): WaktiNotificationConfig {
    return { ...this.config };
  }

  getTypeConfig(type: string): NotificationTypeConfig | null {
    return this.typeConfigs.get(type) || null;
  }

  getAllTypeConfigs(): Map<string, NotificationTypeConfig> {
    return new Map(this.typeConfigs);
  }
}

export const waktiNotifications = new WaktiNotificationService();
