
import { waktiToast, WaktiNotification } from './waktiToast';
import { waktiSounds, WaktiSoundType } from './waktiSounds';
import { supabase } from '@/integrations/supabase/client';

export interface WNConfig {
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

export interface WNTypeConfig {
  sound: WaktiSoundType;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  duration: number;
  vibration: number[];
}

export interface WNBadgeData {
  count: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lastUpdated: number;
}

export interface WNState {
  unreadTotal: number;
  unreadPerContact: Record<string, number>;
  taskCount: number;
  eventCount: number;
  contactCount: number;
  sharedTaskCount: number;
  maw3dEventCount: number;
  loading: boolean;
}

class WNService {
  private config: WNConfig;
  private typeConfigs: Map<string, WNTypeConfig> = new Map();
  private badges: Map<string, WNBadgeData> = new Map();
  private isActive: boolean = false;
  private userId: string | null = null;
  private channel: any = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private authListener: any = null;

  // State management
  private state: WNState = {
    unreadTotal: 0,
    unreadPerContact: {},
    taskCount: 0,
    eventCount: 0,
    contactCount: 0,
    sharedTaskCount: 0,
    maw3dEventCount: 0,
    loading: true
  };

  private listeners: Set<(state: WNState) => void> = new Set();
  private badgeListeners: Set<(type: string, data: WNBadgeData) => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
    this.setupDefaultTypeConfigs();
    this.injectBadgeStyles();
  }

  private loadConfig(): WNConfig {
    const saved = localStorage.getItem('wn-config');
    if (saved) {
      try {
        return { ...this.getDefaultConfig(), ...JSON.parse(saved) };
      } catch (e) {
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): WNConfig {
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

    const saved = localStorage.getItem('wn-type-configs');
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

  // UNIFIED REAL-TIME SYSTEM - Listen to all relevant tables
  start(userId: string): void {
    if (this.isActive && this.userId === userId) {
      console.log('🔄 WN already active for user:', userId);
      return;
    }

    this.userId = userId;
    this.isActive = true;
    
    console.log('🚀 Starting WN unified system for user:', userId);

    // Initial data fetch
    this.fetchAllData('start');

    // UNIFIED REAL-TIME CHANNEL - Listen to ALL relevant tables
    this.channel = supabase
      .channel('wn-unified-system')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_queue', filter: `user_id=eq.${userId}` }, (payload) => {
        console.log('📨 WN: notification_queue update:', payload.new);
        this.processQueuedNotification(payload.new);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        console.log('📨 WN: messages updated');
        this.fetchAllData('realtime-messages');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_task_completions' }, () => {
        console.log('📨 WN: shared task completions updated');
        this.fetchAllData('realtime-shared-tasks');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maw3d_rsvps' }, () => {
        console.log('📨 WN: maw3d RSVPs updated');
        this.fetchAllData('realtime-maw3d');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        console.log('📨 WN: contacts updated');
        this.fetchAllData('realtime-contacts');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'my_tasks' }, () => {
        console.log('📨 WN: tasks updated');
        this.fetchAllData('realtime-tasks');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ WN unified system subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ WN channel error');
          this.isActive = false;
        }
      });

    // Fallback polling every 30s
    this.pollInterval = setInterval(() => {
      this.fetchAllData('polling');
    }, 30000);

    // Auth state change handler
    this.authListener = supabase.auth.onAuthStateChange((_event, _session) => {
      this.fetchAllData('auth-state-change');
    });
  }

  stop(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.authListener) {
      this.authListener.data.subscription.unsubscribe();
      this.authListener = null;
    }
    this.isActive = false;
    this.userId = null;
    console.log('🛑 WN system stopped');
  }

  // UNIFIED DATA FETCHER - Replaces useUnreadMessages logic
  private async fetchAllData(from: string = 'manual'): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      this.resetState();
      return;
    }
    const userId = session.session.user.id;

    try {
      // Fetch unread messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("sender_id, is_read")
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (messagesError) throw messagesError;

      const unreadPerContact: Record<string, number> = {};
      let unreadTotal = 0;
      if (messagesData) {
        messagesData.forEach((msg: any) => {
          unreadPerContact[msg.sender_id] = (unreadPerContact[msg.sender_id] || 0) + 1;
          unreadTotal += 1;
        });
      }

      // Fetch overdue tasks
      const { data: tasksData } = await supabase
        .from("my_tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "overdue");

      // Fetch pending contact requests
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_id", userId)
        .eq("status", "pending");

      // Fetch shared task completions (last 24h)
      const { data: sharedData } = await supabase
        .from("shared_task_completions")
        .select(`task_id, my_tasks!inner(user_id)`)
        .eq("my_tasks.user_id", userId)
        .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Fetch Maw3d RSVP responses (last 24h)
      const { data: maw3dData } = await supabase
        .from("maw3d_rsvps")
        .select(`event_id, maw3d_events!inner(created_by)`)
        .eq("maw3d_events.created_by", userId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Update state
      this.state = {
        unreadTotal,
        unreadPerContact,
        taskCount: tasksData ? tasksData.length : 0,
        eventCount: 0,
        contactCount: contactsData ? contactsData.length : 0,
        sharedTaskCount: sharedData ? sharedData.length : 0,
        maw3dEventCount: maw3dData ? maw3dData.length : 0,
        loading: false
      };

      // Update badges
      this.updateBadge('message', unreadTotal, unreadTotal > 5 ? 'high' : 'normal');
      this.updateBadge('task', this.state.taskCount + this.state.sharedTaskCount, this.state.taskCount + this.state.sharedTaskCount > 5 ? 'high' : 'normal');
      this.updateBadge('contact', this.state.contactCount, 'normal');
      this.updateBadge('event', this.state.maw3dEventCount, 'normal');

      console.log(`📊 WN: Data updated via ${from}:`, this.state);
      this.notifyStateListeners();

    } catch (error) {
      console.error('❌ WN: Error fetching data:', error);
      this.resetState();
    }
  }

  private resetState(): void {
    this.state = {
      unreadTotal: 0,
      unreadPerContact: {},
      taskCount: 0,
      eventCount: 0,
      contactCount: 0,
      sharedTaskCount: 0,
      maw3dEventCount: 0,
      loading: false
    };
    this.notifyStateListeners();
  }

  // NOTIFICATION PROCESSING - From original WaktiNotificationService
  private async processQueuedNotification(queueItem: any): Promise<void> {
    try {
      console.log('🔄 WN: Processing queued notification:', queueItem);
      
      await this.showNotification({
        type: queueItem.notification_type,
        title: queueItem.title,
        message: queueItem.body,
        data: queueItem.data || {}
      });

      if (this.config.enableBadges) {
        this.updateBadgeForNotificationType(queueItem.notification_type);
      }

    } catch (error) {
      console.error('❌ WN: Error processing queued notification:', error);
    }
  }

  private updateBadgeForNotificationType(type: string): void {
    const typeMapping: Record<string, string> = {
      'shared_task': 'task',
      'messages': 'message',
      'contact_requests': 'contact',
      'event': 'event',
      'admin': 'admin'
    };

    const badgeType = typeMapping[type] || type;
    this.incrementBadge(badgeType, 1, 'normal');
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
      console.log('🔇 WN: Notification skipped - quiet hours active');
      return;
    }

    const typeConfig = this.typeConfigs.get(data.type);
    if (!typeConfig) {
      console.warn(`⚠️ WN: No config found for notification type: ${data.type}`);
      return;
    }

    const notification: WaktiNotification = {
      id: `wn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: data.type as WaktiNotification['type'],
      title: data.title,
      message: data.message,
      priority: data.customPriority || typeConfig.priority,
      sound: data.customSound || typeConfig.sound,
      duration: typeConfig.duration
    };

    console.log('🔔 WN: Showing notification:', notification);

    // UNIFIED SYSTEM: Toast + Sound + Vibration
    if (this.config.enableToasts) {
      await waktiToast.show(notification);
    }

    if (this.config.enableSounds) {
      console.log('🔊 WN: Playing sound:', notification.sound);
      waktiSounds.playNotificationSound(notification.sound);
    }

    if (this.config.enableVibration && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(typeConfig.vibration);
      } catch (error) {
        console.warn('📳 WN: Vibration failed:', error);
      }
    }
  }

  // BADGE MANAGEMENT - Merged from waktiBadges
  updateBadge(type: string, count: number, priority: WNBadgeData['priority'] = 'normal'): void {
    if (!this.config.enableBadges) return;

    const previousData = this.badges.get(type);
    const badgeData: WNBadgeData = {
      count: Math.max(0, count),
      priority,
      lastUpdated: Date.now()
    };

    this.badges.set(type, badgeData);

    if (!previousData || previousData.count !== count) {
      this.notifyBadgeListeners(type, badgeData);
    }
  }

  getBadge(type: string): WNBadgeData | null {
    return this.badges.get(type) || null;
  }

  getBadgeDisplay(type: string): { show: boolean; count: string; priority: string } {
    const badge = this.badges.get(type);
    
    if (!badge || !this.config.enableBadges) {
      return { show: false, count: '0', priority: 'normal' };
    }

    const show = badge.count > 0;
    const count = badge.count > 99 ? '99+' : badge.count.toString();

    return { show, count, priority: badge.priority };
  }

  clearBadge(type: string): void {
    this.updateBadge(type, 0);
  }

  incrementBadge(type: string, amount: number = 1, priority: WNBadgeData['priority'] = 'normal'): void {
    const current = this.badges.get(type);
    const newCount = (current?.count || 0) + amount;
    this.updateBadge(type, newCount, priority);
  }

  clearBadgeOnPageVisit(pageType: 'tr' | 'maw3d' | 'messages' | 'contacts'): void {
    const badgeMap = {
      'tr': ['task'],
      'maw3d': ['event'],
      'messages': ['message'],
      'contacts': ['contact']
    };

    const badgesToClear = badgeMap[pageType] || [];
    badgesToClear.forEach(badge => this.clearBadge(badge));
    console.log(`🧹 WN: Cleared badges for ${pageType} page visit:`, badgesToClear);
  }

  // STATE & BADGE LISTENERS
  addStateListener(callback: (state: WNState) => void): void {
    this.listeners.add(callback);
  }

  removeStateListener(callback: (state: WNState) => void): void {
    this.listeners.delete(callback);
  }

  addBadgeListener(callback: (type: string, data: WNBadgeData) => void): void {
    this.badgeListeners.add(callback);
  }

  removeBadgeListener(callback: (type: string, data: WNBadgeData) => void): void {
    this.badgeListeners.delete(callback);
  }

  private notifyStateListeners(): void {
    this.listeners.forEach(callback => callback(this.state));
  }

  private notifyBadgeListeners(type: string, data: WNBadgeData): void {
    this.badgeListeners.forEach(callback => callback(type, data));
  }

  // PUBLIC API
  getState(): WNState {
    return { ...this.state };
  }

  refetch(): void {
    this.fetchAllData('manual-refetch');
  }

  async testNotification(type: string): Promise<void> {
    await this.showNotification({
      type,
      title: 'Test Notification',
      message: `This is a test ${type} notification from WN unified system`
    });
  }

  updateConfig(newConfig: Partial<WNConfig>): void {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('wn-config', JSON.stringify(this.config));
  }

  getConfig(): WNConfig {
    return { ...this.config };
  }

  getProcessorStatus(): { active: boolean; userId: string | null } {
    return {
      active: this.isActive,
      userId: this.userId
    };
  }

  private injectBadgeStyles(): void {
    if (typeof document === 'undefined' || document.getElementById('wn-badge-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'wn-badge-styles';
    styles.textContent = `
      .wn-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        color: white;
        padding: 0 6px;
        border: 2px solid hsl(var(--background));
        z-index: 10;
      }

      .wn-badge-normal {
        background: hsl(var(--destructive));
      }

      .wn-badge-high {
        background: hsl(var(--accent-orange));
      }

      .wn-badge-urgent {
        background: hsl(var(--destructive));
        animation: wn-badge-pulse 1s infinite;
      }

      @keyframes wn-badge-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }

      @media (max-width: 640px) {
        .wn-badge {
          min-width: 18px;
          height: 18px;
          font-size: 10px;
          top: -6px;
          right: -6px;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
}

export const WN = new WNService();
