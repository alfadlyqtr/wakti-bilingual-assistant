
import { supabase } from '@/integrations/supabase/client';

// PWA-only interface - notification functionality removed
export interface ProgressierUserData {
  userId: string;
  email?: string;
  displayName?: string;
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

  // PWA Installation and manifest handling only
  async registerUser(userData: ProgressierUserData): Promise<void> {
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

      console.log('Registering user with Progressier for PWA:', progressierData);
      
      await window.progressier.add(progressierData);
      
      // Store basic registration data
      await this.saveUserRegistration(userData.userId, progressierData);
      
      console.log('User successfully registered with Progressier for PWA');
    } catch (error) {
      console.error('Error registering user with Progressier:', error);
      throw error;
    }
  }

  async unregisterUser(userId: string): Promise<void> {
    try {
      await this.waitForProgressier();
      
      await window.progressier.remove(userId);
      
      // Update our database
      await this.updateUserRegistration(userId, false);
      
      console.log('User unregistered from Progressier');
    } catch (error) {
      console.error('Error unregistering user from Progressier:', error);
      throw error;
    }
  }

  private async saveUserRegistration(userId: string, data: any): Promise<void> {
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
      console.error('Error saving user registration:', error);
    }
  }

  private async updateUserRegistration(userId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_subscriptions')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user registration:', error);
    }
  }

  // PWA Installation methods
  async isPWAInstalled(): Promise<boolean> {
    // Check if running as PWA
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  async canInstallPWA(): Promise<boolean> {
    // Check if PWA can be installed
    return 'serviceWorker' in navigator && 
           !await this.isPWAInstalled();
  }
}

// Global instance
export const progressierService = new ProgressierService();

// Extend window interface for TypeScript - PWA only
declare global {
  interface Window {
    progressier?: {
      add: (userData: any) => Promise<void>;
      remove: (userId: string) => Promise<void>;
      update: (userId: string, data: any) => Promise<void>;
    };
  }
}
