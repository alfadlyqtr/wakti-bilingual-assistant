// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Shield, Users, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PrivacySettings {
  autoApproveContacts: boolean;
  profileVisibility: boolean;
  showActivityStatus: boolean;
}

export const PrivacySettings: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [settings, setSettings] = useState<PrivacySettings>({
    autoApproveContacts: false,
    profileVisibility: true,
    showActivityStatus: true
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('auto_approve_contacts, settings')
        .eq('id', user.id)
        .single();

      if (profile) {
        setSettings({
          autoApproveContacts: profile.auto_approve_contacts || false,
          profileVisibility: profile.settings?.privacy?.profileVisibility !== false,
          showActivityStatus: profile.settings?.privacy?.activityStatus !== false
        });
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrivacySetting = async (key: keyof PrivacySettings, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      if (key === 'autoApproveContacts') {
        await supabase
          .from('profiles')
          .update({ auto_approve_contacts: value })
          .eq('id', user.id);
      } else {
        // Update privacy settings in the settings JSONB column
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .single();

        const currentSettings = currentProfile?.settings || {};
        const privacySettings = currentSettings.privacy || {};

        const updatedPrivacy = {
          ...privacySettings,
          [key === 'profileVisibility' ? 'profileVisibility' : 'activityStatus']: value
        };

        await supabase
          .from('profiles')
          .update({ 
            settings: {
              ...currentSettings,
              privacy: updatedPrivacy
            }
          })
          .eq('id', user.id);
      }

      showSuccess(language === 'ar' ? 'تم تحديث إعدادات الخصوصية' : 'Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      showError(language === 'ar' ? 'خطأ في تحديث الإعدادات' : 'Error updating settings');
      // Revert the change
      setSettings(settings);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {language === 'ar' ? 'إعدادات الخصوصية' : 'Privacy Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {language === 'ar' ? 'إعدادات الخصوصية' : 'Privacy Settings'}
        </CardTitle>
        <CardDescription>
          {language === 'ar' 
            ? 'تحكم في خصوصيتك وكيفية تفاعل الآخرين معك'
            : 'Control your privacy and how others can interact with you'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-approve Contact Requests */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'الموافقة التلقائية على طلبات التواصل' : 'Auto-approve Contact Requests'}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'قبول طلبات إضافة جهات الاتصال تلقائياً بدون مراجعة'
                : 'Automatically accept contact requests without manual review'}
            </p>
          </div>
          <Switch
            checked={settings.autoApproveContacts}
            onCheckedChange={(checked) => updatePrivacySetting('autoApproveContacts', checked)}
          />
        </div>

        {/* Profile Visibility */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'إظهار الملف الشخصي للآخرين' : 'Profile Visibility to Others'}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'السماح للمستخدمين الآخرين برؤية ملفك الشخصي'
                : 'Allow other users to view your profile information'}
            </p>
          </div>
          <Switch
            checked={settings.profileVisibility}
            onCheckedChange={(checked) => updatePrivacySetting('profileVisibility', checked)}
          />
        </div>

        {/* Activity Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <Label className="text-base font-medium">
                {language === 'ar' ? 'إظهار حالة النشاط' : 'Show Activity Status'}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'السماح للآخرين برؤية ما إذا كنت متصلاً أم لا'
                : 'Let others see when you are online or active'}
            </p>
          </div>
          <Switch
            checked={settings.showActivityStatus}
            onCheckedChange={(checked) => updatePrivacySetting('showActivityStatus', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
