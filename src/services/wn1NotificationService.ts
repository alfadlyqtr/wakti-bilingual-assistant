
import { supabase } from '@/integrations/supabase/client';
import { waktiSounds } from '@/services/waktiSounds';
import { waktiBadges } from '@/services/waktiBadges';
import { toast } from 'sonner';

export interface WN1NotificationData {
  id: string;
  type: 'messages' | 'contacts' | 'shared_tasks' | 'maw3d_events' | 'admin_messages' | 'task_updates' | 'contact_requests';
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLink?: string;
  timestamp: number;
  userId: string;
}

export interface WN1NotificationPreferences {
  enableToasts: boolean;
  enableBadges: boolean;
  enableVibration: boolean;
  enableSounds: boolean;
  soundVolume: number;
  // Specific notification types
  messages: boolean;
  contact_requests: boolean;
  task_updates: boolean;
  shared_task_updates: boolean;
  event_rsvps: boolean;
  calendar_reminders: boolean;
  admin_gifts: boolean;
  // Sound and badge settings
  notification_sound: 'chime' | 'beep' | 'ding';
  show_badges: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

class WN1NotificationService {
  private isInitialized = false;
  private hasPermission = false;
  private preferences: WN1NotificationPreferences = {
    enableToasts: true,
    enableBadges: true,
    enableVibration: true,
    enableSounds: true,
    soundVolume: 70,
    // Notification types - all enabled by default
    messages: true,
    contact_requests: true,
    task_updates: true,
    shared_task_updates: true,
    event_rsvps: true,
    calendar_reminders: true,
    admin_gifts: true,
    // Sound and badge settings
    notification_sound: 'chime',
    show_badges: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  };
  private offlineQueue: WN1NotificationData[] = [];
  private isOnline = navigator.onLine;
  private subscriptions: { [key: string]: any } = {};
  private currentUserId: string | null = null;

  constructor() {
    this.setupOnlineListener();
    this.loadPreferences();
  }

  // Standardize badge type mapping
  private getBadgeType(notificationType: string): string {
    switch (notificationType) {
      case 'maw3d_events':
      case 'event':
        return 'maw3d_events';
      case 'shared_tasks':
      case 'shared_task':
        return 'shared_tasks';
      case 'messages':
        return 'messages';
      case 'task_updates':
        return 'task_updates';
      case 'contact_requests':
        return 'contact_requests';
      case 'admin_messages':
      case 'admin_gifts':
        return 'admin_messages';
      default:
        return notificationType;
    }
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) {
      console.log('🔄 WN1 Service already initialized for user:', userId);
      return;
    }

    console.log('🔥 Initializing WN1 notification service for user:', userId);
    
    this.currentUserId = userId;
    await this.requestNotificationPermission();
    await this.loadUserPreferences(userId);
    await this.setupRealtimeSubscriptions(userId);
    await this.processOfflineQueue();
    
    this.isInitialized = true;
    console.log('✅ WN1 Service initialized successfully');
  }

  private async requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('🚫 Browser notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      console.log('🔔 Notification permission:', permission);
    }
  }

  private async loadUserPreferences(userId: string): Promise<void> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (profile?.notification_preferences) {
        this.preferences = {
          ...this.preferences,
          ...profile.notification_preferences
        };
        console.log('📋 Loaded user preferences:', this.preferences);
      }
    } catch (error) {
      console.error('❌ Failed to load preferences:', error);
    }
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Back online, processing queue');
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Gone offline, queuing notifications');
    });
  }

  private async setupRealtimeSubscriptions(userId: string): Promise<void> {
    console.log('🔗 Setting up WN1 realtime subscriptions for user:', userId);

    // Cleanup existing subscriptions first
    this.cleanup();

    // Single subscription to notification_queue for all notification types
    this.subscriptions.notifications = supabase
      .channel('wn1-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_queue',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('📨 WN1 notification received:', payload.new);
        this.handleQueuedNotification(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ WN1 notification processor subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ WN1 notification processor channel error');
          this.isInitialized = false;
        }
      });

    console.log('✅ WN1 realtime subscriptions active');
  }

  private async handleQueuedNotification(queueItem: any): Promise<void> {
    const notificationType = queueItem.notification_type;
    
    console.log('🔄 Processing notification type:', notificationType);
    
    // Check if this notification type is enabled in preferences
    const typeEnabled = this.isNotificationTypeEnabled(notificationType);
    
    if (!typeEnabled) {
      console.log(`🔇 Notification type '${notificationType}' is disabled, skipping`);
      return;
    }

    const notification: WN1NotificationData = {
      id: queueItem.id,
      type: this.mapNotificationTypeToDataType(notificationType),
      title: queueItem.title,
      body: queueItem.body,
      data: queueItem.data || {},
      deepLink: queueItem.deep_link,
      timestamp: Date.now(),
      userId: queueItem.user_id
    };

    console.log('🚀 Processing notification:', notification);
    await this.processNotification(notification);
  }

  private isNotificationTypeEnabled(type: string): boolean {
    const typeMap: Record<string, keyof WN1NotificationPreferences> = {
      'messages': 'messages',
      'contact_requests': 'contact_requests',
      'shared_task': 'shared_task_updates',
      'event': 'event_rsvps',
      'task': 'task_updates',
      'admin_messages': 'admin_gifts',
      'admin_gifts': 'admin_gifts'
    };

    const preferenceKey = typeMap[type];
    const enabled = preferenceKey ? this.preferences[preferenceKey] as boolean : true;
    console.log(`🔍 Notification type '${type}' enabled: ${enabled}`);
    return enabled;
  }

  private mapNotificationTypeToDataType(type: string): WN1NotificationData['type'] {
    const typeMap: Record<string, WN1NotificationData['type']> = {
      'messages': 'messages',
      'contact_requests': 'contacts',
      'shared_task': 'shared_tasks',
      'event': 'maw3d_events',
      'admin_messages': 'admin_messages',
      'admin_gifts': 'admin_messages'
    };

    return typeMap[type] || 'shared_tasks';
  }

  private async processNotification(notification: WN1NotificationData): Promise<void> {
    console.log('🔔 Processing WN1 notification:', notification.type, notification.title);

    // Check quiet hours
    if (this.isQuietHours()) {
      console.log('🤫 Quiet hours active, skipping notification');
      return;
    }

    // If offline, queue the notification
    if (!this.isOnline) {
      await this.queueOfflineNotification(notification);
      return;
    }

    // Show toast notification
    if (this.preferences.enableToasts) {
      console.log('🍞 Showing toast for notification');
      this.showToast(notification);
    }

    // Play notification sound
    if (this.preferences.enableSounds) {
      console.log('🔊 Playing sound for notification');
      await this.playNotificationSound();
    }

    // Show browser notification
    if (this.hasPermission) {
      console.log('🌐 Showing browser notification');
      this.showBrowserNotification(notification);
    }

    // Trigger vibration
    if (this.preferences.enableVibration && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // Update badge count
    if (this.preferences.enableBadges && this.preferences.show_badges) {
      console.log('🏷️ Updating badge for notification');
      this.updateBadgeCount(notification.type);
    }
  }

  private isQuietHours(): boolean {
    if (!this.preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime > endTime) {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }

  private showToast(notification: WN1NotificationData): void {
    toast(notification.title, {
      description: notification.body,
      duration: 4000,
      action: notification.deepLink ? {
        label: 'View',
        onClick: () => {
          if (notification.deepLink) {
            window.location.href = notification.deepLink;
          }
        }
      } : undefined
    });
  }

  private async playNotificationSound(): Promise<void> {
    try {
      await waktiSounds.playNotificationSound(this.preferences.notification_sound);
      console.log('🔊 Played notification sound:', this.preferences.notification_sound);
    } catch (error) {
      console.error('🔇 Failed to play sound:', error);
    }
  }

  private showBrowserNotification(notification: WN1NotificationData): void {
    if (!this.hasPermission) return;

    const browserNotification = new Notification(notification.title, {
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: notification.type,
      data: notification.data,
      requireInteraction: false,
      silent: true // We handle sound separately
    });

    browserNotification.onclick = () => {
      if (notification.deepLink) {
        window.focus();
        window.location.href = notification.deepLink;
      }
      browserNotification.close();
    };

    // Auto-close after 6 seconds
    setTimeout(() => {
      browserNotification.close();
    }, 6000);
  }

  private updateBadgeCount(type: WN1NotificationData['type']): void {
    const badgeType = this.getBadgeType(type);
    waktiBadges.incrementBadge(badgeType, 1, 'normal');
    console.log(`🏷️ Incremented badge for type: ${type} -> ${badgeType}`);
  }

  private async queueOfflineNotification(notification: WN1NotificationData): Promise<void> {
    this.offlineQueue.push(notification);
    
    // Store in IndexedDB for persistence
    try {
      await this.storeInIndexedDB(notification);
      console.log('💾 Notification queued offline:', notification.id);
    } catch (error) {
      console.error('❌ Failed to store offline notification:', error);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    console.log('📤 Processing', this.offlineQueue.length, 'offline notifications');
    
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const notification of queue) {
      await this.processNotification(notification);
      await this.removeFromIndexedDB(notification.id);
    }
  }

  private async storeInIndexedDB(notification: WN1NotificationData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WN1NotificationQueue', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['notifications'], 'readwrite');
        const store = transaction.objectStore('notifications');
        
        store.add(notification);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: 'id' });
        }
      };
    });
  }

  private async removeFromIndexedDB(notificationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WN1NotificationQueue', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['notifications'], 'readwrite');
        const store = transaction.objectStore('notifications');
        
        store.delete(notificationId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  private loadPreferences(): void {
    const saved = localStorage.getItem('wn1-preferences');
    if (saved) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      } catch (error) {
        console.error('❌ Failed to load preferences from localStorage');
      }
    }
  }

  private savePreferences(): void {
    localStorage.setItem('wn1-preferences', JSON.stringify(this.preferences));
  }

  // Badge management methods - extended to cover entire app
  clearBadge(type: string): void {
    const badgeType = this.getBadgeType(type);
    console.log(`🏷️ Clearing ${badgeType} badge`);
    waktiBadges.clearBadge(badgeType);
  }

  clearBadgeOnPageVisit(pageType: 'tr' | 'maw3d' | 'messages' | 'contacts' | 'dashboard'): void {
    const badgeMap = {
      'tr': ['task_updates', 'shared_tasks'],
      'maw3d': ['maw3d_events'],
      'messages': ['messages'],
      'contacts': ['contact_requests'],
      'dashboard': [] // Dashboard shows all badges, don't clear any
    };

    const badgesToClear = badgeMap[pageType] || [];
    badgesToClear.forEach(badge => this.clearBadge(badge));
    console.log(`🧹 Cleared badges for ${pageType} page visit:`, badgesToClear);
  }

  updateBadgeCount(type: string, count: number, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    if (this.preferences.enableBadges) {
      const badgeType = this.getBadgeType(type);
      waktiBadges.updateBadge(badgeType, count, priority);
    }
  }

  // Public API methods
  async updatePreferences(newPreferences: Partial<WN1NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
    console.log('💾 WN1 Preferences updated:', this.preferences);
  }

  getPreferences(): WN1NotificationPreferences {
    return { ...this.preferences };
  }

  async testNotification(type: string = 'maw3d_events'): Promise<void> {
    const testNotification: WN1NotificationData = {
      id: 'test-' + Date.now(),
      type: 'maw3d_events',
      title: '🧪 Test Notification',
      body: 'This is a test notification from the unified WN1 system',
      timestamp: Date.now(),
      userId: 'test'
    };

    console.log('🧪 Testing unified notification system');
    await this.processNotification(testNotification);
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    await this.requestNotificationPermission();
    return Notification.permission;
  }

  getProcessorStatus(): { active: boolean; userId: string | null } {
    return {
      active: this.isInitialized,
      userId: this.currentUserId
    };
  }

  cleanup(): void {
    console.log('🧹 Cleaning up WN1 service');
    
    // Unsubscribe from all channels
    Object.values(this.subscriptions).forEach(subscription => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    });
    
    this.subscriptions = {};
    this.isInitialized = false;
    this.currentUserId = null;
  }
}

export const wn1NotificationService = new WN1NotificationService();
