import { supabase } from '@/integrations/supabase/client';
import { waktiSounds } from '@/services/waktiSounds';
import { toast } from 'sonner';

export interface WN1NotificationData {
  id: string;
  type: 'messages' | 'contacts' | 'shared_tasks' | 'maw3d_events' | 'admin_messages';
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
  private soundRotationIndex = 0;
  private soundFiles = ['chime', 'beep', 'ding'];

  constructor() {
    this.setupOnlineListener();
    this.loadPreferences();
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔥 Initializing notification service for user:', userId);
    
    await this.requestNotificationPermission();
    await this.loadUserPreferences(userId);
    await this.setupRealtimeSubscriptions(userId);
    await this.processOfflineQueue();
    
    this.isInitialized = true;
    console.log('✅ Service initialized successfully');
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
    console.log('🔗 Setting up realtime subscriptions');

    // Messages subscription
    this.subscriptions.messages = supabase
      .channel('notifications-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${userId}`
      }, (payload) => {
        if (this.preferences.messages) {
          this.handleMessageNotification(payload.new);
        }
      })
      .subscribe();

    // Contacts subscription
    this.subscriptions.contacts = supabase
      .channel('notifications-contacts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contacts',
        filter: `contact_id=eq.${userId}`
      }, (payload) => {
        if (this.preferences.contact_requests) {
          this.handleContactNotification(payload.new);
        }
      })
      .subscribe();

    // Shared task completions subscription
    this.subscriptions.sharedTasks = supabase
      .channel('notifications-shared-tasks')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'shared_task_completions'
      }, (payload) => {
        if (this.preferences.shared_task_updates) {
          this.handleSharedTaskNotification(payload.new, userId);
        }
      })
      .subscribe();

    // Maw3d RSVP subscription
    this.subscriptions.maw3dEvents = supabase
      .channel('notifications-maw3d')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'maw3d_rsvps'
      }, (payload) => {
        if (this.preferences.event_rsvps) {
          this.handleMaw3dNotification(payload.new, userId);
        }
      })
      .subscribe();

    // Admin messages subscription
    this.subscriptions.adminMessages = supabase
      .channel('notifications-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_messages',
        filter: `recipient_id=eq.${userId}`
      }, (payload) => {
        if (this.preferences.admin_gifts) {
          this.handleAdminNotification(payload.new);
        }
      })
      .subscribe();

    console.log('✅ All realtime subscriptions active');
  }

  private async handleMessageNotification(message: any): Promise<void> {
    // Get sender name
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', message.sender_id)
      .single();

    const notification: WN1NotificationData = {
      id: message.id,
      type: 'messages',
      title: 'New Message',
      body: `${sender?.display_name || 'Someone'} sent you a message`,
      data: { messageId: message.id, senderId: message.sender_id },
      deepLink: '/contacts',
      timestamp: Date.now(),
      userId: message.recipient_id
    };

    await this.processNotification(notification);
  }

  private async handleContactNotification(contact: any): Promise<void> {
    if (contact.status !== 'pending') return;

    // Get requester name
    const { data: requester } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', contact.user_id)
      .single();

    const notification: WN1NotificationData = {
      id: contact.id,
      type: 'contacts',
      title: 'Contact Request',
      body: `${requester?.display_name || 'Someone'} wants to connect with you`,
      data: { contactId: contact.id, requesterId: contact.user_id },
      deepLink: '/contacts',
      timestamp: Date.now(),
      userId: contact.contact_id
    };

    await this.processNotification(notification);
  }

  private async handleSharedTaskNotification(completion: any, userId: string): Promise<void> {
    // Get task details and check if user is the owner
    const { data: task } = await supabase
      .from('my_tasks')
      .select('title, user_id')
      .eq('id', completion.task_id)
      .single();

    if (!task || task.user_id !== userId) return;

    const notification: WN1NotificationData = {
      id: completion.id,
      type: 'shared_tasks',
      title: 'Task Update',
      body: `${completion.completed_by_name || 'Someone'} completed: ${task.title}`,
      data: { taskId: completion.task_id, completionId: completion.id },
      deepLink: '/tr',
      timestamp: Date.now(),
      userId: userId
    };

    await this.processNotification(notification);
  }

  private async handleMaw3dNotification(rsvp: any, userId: string): Promise<void> {
    // Get event details and check if user is the creator
    const { data: event } = await supabase
      .from('maw3d_events')
      .select('title, created_by')
      .eq('id', rsvp.event_id)
      .single();

    if (!event || event.created_by !== userId) return;

    const notification: WN1NotificationData = {
      id: rsvp.id,
      type: 'maw3d_events',
      title: 'Event RSVP',
      body: `${rsvp.guest_name} responded ${rsvp.response} to: ${event.title}`,
      data: { eventId: rsvp.event_id, rsvpId: rsvp.id },
      deepLink: '/maw3d',
      timestamp: Date.now(),
      userId: userId
    };

    await this.processNotification(notification);
  }

  private async handleAdminNotification(adminMessage: any): Promise<void> {
    const notification: WN1NotificationData = {
      id: adminMessage.id,
      type: 'admin_messages',
      title: adminMessage.subject || 'Admin Message',
      body: adminMessage.content.substring(0, 100) + (adminMessage.content.length > 100 ? '...' : ''),
      data: { messageId: adminMessage.id },
      deepLink: '/dashboard',
      timestamp: Date.now(),
      userId: adminMessage.recipient_id
    };

    await this.processNotification(notification);
  }

  private async processNotification(notification: WN1NotificationData): Promise<void> {
    console.log('🔔 Processing notification:', notification.type, notification.title);

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
      this.showToast(notification);
    }

    // Play notification sound
    if (this.preferences.enableSounds) {
      await this.playNotificationSound();
    }

    // Show browser notification
    if (this.hasPermission) {
      this.showBrowserNotification(notification);
    }

    // Trigger vibration
    if (this.preferences.enableVibration && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // Update badge count
    if (this.preferences.enableBadges && this.preferences.show_badges) {
      this.updateBadgeCount();
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

  private updateBadgeCount(): void {
    // This will be handled by the existing badge system
    // Just trigger a refresh of unread counts
    window.dispatchEvent(new CustomEvent('notification-received'));
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
      const request = indexedDB.open('NotificationQueue', 1);
      
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
      const request = indexedDB.open('NotificationQueue', 1);
      
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

  // Public API methods
  async updatePreferences(newPreferences: Partial<WN1NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
    console.log('💾 Preferences updated:', this.preferences);
  }

  getPreferences(): WN1NotificationPreferences {
    return { ...this.preferences };
  }

  async testNotification(type: string = 'Test'): Promise<void> {
    const testNotification: WN1NotificationData = {
      id: 'test-' + Date.now(),
      type: 'messages',
      title: '🧪 Test Notification',
      body: 'This is a test notification from the notification system',
      timestamp: Date.now(),
      userId: 'test'
    };

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
      userId: this.isInitialized ? 'current' : null
    };
  }

  cleanup(): void {
    console.log('🧹 Cleaning up service');
    
    // Unsubscribe from all channels
    Object.values(this.subscriptions).forEach(subscription => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    });
    
    this.subscriptions = {};
    this.isInitialized = false;
  }
}

export const wn1NotificationService = new WN1NotificationService();
