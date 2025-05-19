
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { useQueryClient } from '@tanstack/react-query';

// Define interfaces for different setting types
export interface WidgetSettings {
  tasksWidget: boolean;
  calendarWidget: boolean;
  remindersWidget: boolean;
  quoteWidget: boolean;
}

export interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
}

export interface PrivacySettings {
  profileVisibility: boolean;
  activityStatus: boolean;
}

export interface QuotePreferences {
  category: string;
  frequency: string;
  customQuotes?: string[];
}

export interface UserSettings {
  widgets: WidgetSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  quotes: QuotePreferences;
}

export function useSettings() {
  const { language } = useTheme();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    widgets: {
      tasksWidget: true,
      calendarWidget: true,
      remindersWidget: true,
      quoteWidget: true
    },
    notifications: {
      pushNotifications: true,
      emailNotifications: false
    },
    privacy: {
      profileVisibility: true,
      activityStatus: true
    },
    quotes: {
      category: 'mixed',
      frequency: 'daily'
    }
  });

  // Load settings from localStorage or defaults
  const loadFromLocalStorage = useCallback(() => {
    try {
      // Load widgets settings
      const storedWidgets = localStorage.getItem('widgetVisibility');
      if (storedWidgets) {
        setSettings(prev => ({
          ...prev,
          widgets: JSON.parse(storedWidgets)
        }));
      }
      
      // Load notification settings
      const storedNotifications = localStorage.getItem('notificationSettings');
      if (storedNotifications) {
        setSettings(prev => ({
          ...prev,
          notifications: JSON.parse(storedNotifications)
        }));
      }
      
      // Load privacy settings
      const storedPrivacy = localStorage.getItem('privacySettings');
      if (storedPrivacy) {
        setSettings(prev => ({
          ...prev,
          privacy: JSON.parse(storedPrivacy)
        }));
      }
      
      // Load quote preferences
      const storedQuotes = localStorage.getItem('quotePreferences');
      if (storedQuotes) {
        setSettings(prev => ({
          ...prev,
          quotes: JSON.parse(storedQuotes)
        }));
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load settings from Supabase
  const loadFromSupabase = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (profile?.settings) {
        // First update localStorage
        if (profile.settings.widgets) {
          localStorage.setItem('widgetVisibility', JSON.stringify(profile.settings.widgets));
        }
        
        if (profile.settings.notifications) {
          localStorage.setItem('notificationSettings', JSON.stringify(profile.settings.notifications));
        }
        
        if (profile.settings.privacy) {
          localStorage.setItem('privacySettings', JSON.stringify(profile.settings.privacy));
        }
        
        if (profile.settings.quotes) {
          localStorage.setItem('quotePreferences', JSON.stringify(profile.settings.quotes));
        }
        
        // Then update state with complete settings
        setSettings({
          widgets: profile.settings.widgets || settings.widgets,
          notifications: profile.settings.notifications || settings.notifications,
          privacy: profile.settings.privacy || settings.privacy,
          quotes: profile.settings.quotes || settings.quotes
        });
        
        // Broadcast changes to other components
        window.dispatchEvent(new Event('storage'));
      }
    } catch (error) {
      console.error('Error loading settings from Supabase:', error);
      // If error loading from Supabase, fall back to localStorage
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [settings, loadFromLocalStorage]);

  // Save all settings to both localStorage and Supabase
  const saveSettings = useCallback(async (newSettings: Partial<UserSettings> = settings) => {
    try {
      setIsSaving(true);
      
      // Merge existing settings with new settings
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };
      
      // Save to localStorage first
      if (updatedSettings.widgets) {
        localStorage.setItem('widgetVisibility', JSON.stringify(updatedSettings.widgets));
      }
      
      if (updatedSettings.notifications) {
        localStorage.setItem('notificationSettings', JSON.stringify(updatedSettings.notifications));
      }
      
      if (updatedSettings.privacy) {
        localStorage.setItem('privacySettings', JSON.stringify(updatedSettings.privacy));
      }
      
      if (updatedSettings.quotes) {
        localStorage.setItem('quotePreferences', JSON.stringify(updatedSettings.quotes));
      }
      
      // Update state
      setSettings(updatedSettings);
      
      // Save to Supabase if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ settings: updatedSettings })
          .eq('id', user.id);
          
        if (error) throw error;
      }
      
      // Broadcast changes
      window.dispatchEvent(new Event('storage'));
      
      // Invalidate user profile query
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      // Show success message
      toast.success(t('settingsUpdated', language));
      
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('errorUpdatingSettings', language));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings, language, queryClient]);

  // Update a specific setting category
  const updateSettings = useCallback(<T extends keyof UserSettings>(
    category: T, 
    newValue: Partial<UserSettings[T]>
  ) => {
    const updatedCategorySettings = {
      ...settings[category],
      ...newValue
    };
    
    const updatedSettings = {
      ...settings,
      [category]: updatedCategorySettings
    };
    
    return saveSettings(updatedSettings);
  }, [settings, saveSettings]);

  // Load settings on component mount
  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  // Listen for storage events from other components
  useEffect(() => {
    const handleStorageChange = () => {
      loadFromLocalStorage();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadFromLocalStorage]);

  return {
    settings,
    isLoading,
    isSaving,
    loadSettings: loadFromSupabase,
    saveSettings,
    updateSettings
  };
}
