
import { supabase } from '@/integrations/supabase/client';

export interface ProgressierUserData {
  userId: string;
  email?: string;
  displayName?: string;
  tags?: string[];
}

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  vibrate?: number[];
}

class ProgressierService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private async waitForProgressier(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const checkProgressier = () => {
        if (window.progressier) {
          this.isInitialized = true;
          resolve();
        } else {
          setTimeout(checkProgressier, 100);
        }
      };

      // Start checking immediately
      checkProgressier();

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('Progressier script failed to load'));
        }
      }, 10000);
    });

    return this.initPromise;
  }

  async addUser(userData: ProgressierUserData): Promise<void> {
    try {
      await this.waitForProgressier();
      
      const progressierData: any = {
        userId: userData.userId,
      };

      if (userData.email) {
        progressierData.email = userData.email;
      }

      if (userData.displayName) {
        progressierData.name = userData.displayName;
      }

      if (userData.tags && userData.tags.length > 0) {
        progressierData.tags = userData.tags;
      }

      console.log('Adding user to Progressier:', progressierData);
      
      await window.progressier.add(progressierData);
      
      // Store subscription data in our database
      await this.saveSubscriptionData(userData.userId, progressierData);
      
      console.log('User successfully added to Progressier');
    } catch (error) {
      console.error('Error adding user to Progressier:', error);
      throw error;
    }
  }

  async removeUser(userId: string): Promise<void> {
    try {
      await this.waitForProgressier();
      
      await window.progressier.remove(userId);
      
      // Update our database
      await this.updateSubscriptionStatus(userId, false);
      
      console.log('User removed from Progressier');
    } catch (error) {
      console.error('Error removing user from Progressier:', error);
      throw error;
    }
  }

  async updateUserTags(userId: string, tags: string[]): Promise<void> {
    try {
      await this.waitForProgressier();
      
      await window.progressier.update(userId, { tags });
      
      console.log('User tags updated in Progressier');
    } catch (error) {
      console.error('Error updating user tags:', error);
      throw error;
    }
  }

  private async saveSubscriptionData(userId: string, data: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_subscriptions')
        .upsert({
          user_id: userId,
          progressier_user_id: data.userId,
          subscription_data: data,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
          is_active: true,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving subscription data:', error);
    }
  }

  private async updateSubscriptionStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_subscriptions')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating subscription status:', error);
    }
  }

  async getNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }
}

// Global instance
export const progressierService = new ProgressierService();

// Extend window interface for TypeScript
declare global {
  interface Window {
    progressier?: {
      add: (userData: any) => Promise<void>;
      remove: (userId: string) => Promise<void>;
      update: (userId: string, data: any) => Promise<void>;
    };
  }
}
