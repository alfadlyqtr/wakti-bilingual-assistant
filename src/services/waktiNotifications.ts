import { waktiToast, WaktiNotification } from './waktiToast';
import { waktiSounds, WaktiSoundType } from './waktiSounds';
import { waktiBadges } from './waktiBadges';
import { supabase } from '@/integrations/supabase/client';

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
  private isProcessorActive: boolean = false;
  private userId: string | null = null;

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
      ['contact_requests', { sound: 'chime' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [300, 100, 300] }],
      ['messages', { sound: 'chime' as WaktiSoundType, priority: 'normal' as const, duration: 3000, vibration: [200, 100, 200] }],
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

  // CRITICAL: Real-time notification processor - bridges database to client
  startNotificationProcessor(userId: string): void {
    if (this.isProcessorActive && this.userId === userId) {
      console.log('🔄 WAKTI Notification processor already active for user:', userId);
      return;
    }

    this.userId = userId;
    this.isProcessorActive = true;
    
    console.log('🚀 Starting WAKTI unified notification processor for user:', userId);

    // Listen to notification_queue table for new notifications
    const channel = supabase
      .channel('wakti-unified-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('📨 New notification queued:', payload.new);
          this.processQueuedNotification(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ WAKTI notification processor subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ WAKTI notification processor channel error');
          this.isProcessorActive = false;
        }
      });

    // Store channel reference for cleanup
    (window as any).waktiNotificationChannel = channel;
  }

  stopNotificationProcessor(): void {
    if ((window as any).waktiNotificationChannel) {
      supabase.removeChannel((window as any).waktiNotificationChannel);
      (window as any).waktiNotificationChannel = null;
    }
    this.isProcessorActive = false;
    this.userId = null;
    console.log('🛑 WAKTI notification processor stopped');
  }

  // Process notifications from the queue and trigger the unified system
  private async processQueuedNotification(queueItem: any): Promise<void> {
    try {
      console.log('🔄 Processing queued notification:', queueItem);
      
      await this.showNotification({
        type: queueItem.notification_type,
        title: queueItem.title,
        message: queueItem.body,
        data: queueItem.data || {}
      });

      // Update badge count based on notification type
      if (this.config.enableBadges) {
        this.updateBadgeForNotificationType(queueItem.notification_type);
      }

    } catch (error) {
      console.error('❌ Error processing queued notification:', error);
    }
  }

  private updateBadgeForNotificationType(type: string): void {
    // Map notification types to badge categories
    const typeMapping: Record<string, string> = {
      'shared_task': 'shared_task',
      'messages': 'message',
      'contact_requests': 'contact',
      'event': 'event',
      'task': 'task',
      'admin': 'admin'
    };

    const badgeType = typeMapping[type] || type;
    waktiBadges.incrementBadge(badgeType, 1, 'normal');
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
      console.log('🔇 Notification skipped - quiet hours active');
      return;
    }

    const typeConfig = this.typeConfigs.get(data.type);
    if (!typeConfig) {
      console.warn(`⚠️ No config found for notification type: ${data.type}`);
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

    console.log('🔔 Showing unified WAKTI notification:', notification);

    // UNIFIED SYSTEM: Toast + Sound + Vibration
    if (this.config.enableToasts) {
      await waktiToast.show(notification);
    }

    if (this.config.enableSounds) {
      console.log('🔊 Playing sound:', notification.sound);
      waktiSounds.playNotificationSound(notification.sound);
    }

    if (this.config.enableVibration && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(typeConfig.vibration);
      } catch (error) {
        console.warn('📳 Vibration failed:', error);
      }
    }
  }

  // Badge management methods
  clearBadge(type: string): void {
    console.log(`🏷️ Clearing ${type} badge`);
    waktiBadges.clearBadge(type);
  }

  clearBadgeOnPageVisit(pageType: 'tr' | 'maw3d' | 'messages' | 'contacts'): void {
    const badgeMap = {
      'tr': ['task', 'shared_task'],
      'maw3d': ['event'],
      'messages': ['message'],
      'contacts': ['contact']
    };

    const badgesToClear = badgeMap[pageType] || [];
    badgesToClear.forEach(badge => this.clearBadge(badge));
    console.log(`🧹 Cleared badges for ${pageType} page visit:`, badgesToClear);
  }

  updateBadgeCount(type: string, count: number, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    if (this.config.enableBadges) {
      waktiBadges.updateBadge(type, count, priority);
    }
  }

  async testNotification(type: string): Promise<void> {
    await this.showNotification({
      type,
      title: 'Test Notification',
      message: `This is a test ${type} notification from WAKTI unified system`
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

  getProcessorStatus(): { active: boolean; userId: string | null } {
    return {
      active: this.isProcessorActive,
      userId: this.userId
    };
  }
}

export const waktiNotifications = new WaktiNotificationService();
