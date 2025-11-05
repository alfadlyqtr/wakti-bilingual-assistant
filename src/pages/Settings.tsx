
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { PageContainer } from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import { QuotePreferencesManager } from "@/components/settings/QuotePreferencesManager";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { t } from "@/utils/translations";
import { Shield, Users, Eye, Quote, Palette, Bell, Layout } from "lucide-react";
import { useToastHelper } from "@/hooks/use-toast-helper";

export default function Settings() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToastHelper();
  const [activeTab, setActiveTab] = useState("appearance");

  // Widget visibility settings
  const [widgetSettings, setWidgetSettings] = useState({
    showCalendarWidget: true,
    showEventsWidget: true,
    showQuoteWidget: true,
    showMaw3dWidget: true,
    showTRWidget: true,
    showWhoopWidget: true,
    showJournalWidget: true,
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    autoApproveContacts: false,
    profileVisibility: true,
    showActivityStatus: true
  });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings, auto_approve_contacts')
        .eq('id', user?.id)
        .single();

      if (profile?.settings?.widgets) {
        const widgets = profile.settings.widgets as any;
        // Merge legacy showTasksWidget into the combined showTRWidget
        const mergedShowTR = (widgets.showTRWidget !== false) || (widgets.showTasksWidget === true);
        setWidgetSettings(prev => ({
          ...prev,
          ...widgets,
          showTRWidget: mergedShowTR,
        }));
      }

      // Load privacy settings
      setPrivacySettings({
        autoApproveContacts: profile?.auto_approve_contacts || false,
        profileVisibility: profile?.settings?.privacy?.profileVisibility !== false,
        showActivityStatus: profile?.settings?.privacy?.activityStatus !== false
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    if (newLanguage === 'en' || newLanguage === 'ar') {
      setLanguage(newLanguage);
    }
  };

  const updateWidgetSetting = async (key: keyof typeof widgetSettings, value: boolean) => {
    try {
      const newSettings = { ...widgetSettings, [key]: value };
      setWidgetSettings(newSettings);

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user?.id)
        .single();

      const currentSettings = currentProfile?.settings || {};

      await supabase
        .from('profiles')
        .update({ 
          settings: {
            ...currentSettings,
            widgets: newSettings
          }
        })
        .eq('id', user?.id);

      showSuccess(t("settingsUpdated", language));
      
      // Force dashboard to reload by dispatching a custom event
      window.dispatchEvent(new CustomEvent('widgetSettingsChanged', { detail: newSettings }));
    } catch (error) {
      console.error('Error updating widget setting:', error);
      showError(t("errorUpdatingSettings", language));
      setWidgetSettings(widgetSettings);
    }
  };

  const updatePrivacySetting = async (key: keyof typeof privacySettings, value: boolean) => {
    try {
      const newSettings = { ...privacySettings, [key]: value };
      setPrivacySettings(newSettings);

      if (key === 'autoApproveContacts') {
        await supabase
          .from('profiles')
          .update({ auto_approve_contacts: value })
          .eq('id', user?.id);
      } else {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user?.id)
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
          .eq('id', user?.id);
      }

      showSuccess(language === 'ar' ? 'تم تحديث إعدادات الخصوصية' : 'Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      showError(language === 'ar' ? 'خطأ في تحديث الإعدادات' : 'Error updating settings');
      setPrivacySettings(privacySettings);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full p-6">
        <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {t("settings", language)}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة إعدادات التطبيق" : "Manage your app settings"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t("appearance", language)}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t("notifications", language)}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              {language === "ar" ? "لوحة التحكم" : "Dashboard"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("appearanceSettings", language)}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "تخصيص مظهر التطبيق" : "Customize the app appearance"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t("theme", language)}</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("lightMode", language)}</SelectItem>
                      <SelectItem value="dark">{t("darkMode", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">{t("language", language)}</Label>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("english", language)}</SelectItem>
                      <SelectItem value="ar">{t("arabic", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings in Appearance Tab */}
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
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'الموافقة التلقائية على طلبات التواصل' : 'Auto-approve Contact Requests'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'قبول طلبات إضافة جهات الاتصال تلقائياً بدون مراجعة'
                        : 'Automatically accept contact requests without manual review'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.autoApproveContacts}
                    onCheckedChange={(checked) => updatePrivacySetting('autoApproveContacts', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'إظهار الملف الشخصي للآخرين' : 'Profile Visibility to Others'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'السماح للمستخدمين الآخرين برؤية ملفك الشخصي'
                        : 'Allow other users to view your profile information'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.profileVisibility}
                    onCheckedChange={(checked) => updatePrivacySetting('profileVisibility', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-green-500"></div>
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'إظهار حالة النشاط' : 'Show Activity Status'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'السماح للآخرين برؤية ما إذا كنت متصلاً أم لا'
                        : 'Let others see when you are online or active'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.showActivityStatus}
                    onCheckedChange={(checked) => updatePrivacySetting('showActivityStatus', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
            
            {/* Quote Preferences */}
            <QuotePreferencesManager />

            {/* Custom Quotes */}
            <CustomQuoteManager />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Widget Visibility */}
            <Card>
              <CardHeader>
                <CardTitle>{t("widgetVisibility", language)}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "اختر الأدوات التي تريد عرضها في لوحة التحكم" : "Choose which widgets to display on your dashboard"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "إظهار الأحداث والمواعيد القادمة" : "Show upcoming events and appointments"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showCalendarWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showCalendarWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "إظهار المهام والتذكيرات" : "Show Tasks & Reminders"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showTRWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showTRWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "إظهار أحداث مواعيد القادمة" : "Show upcoming Maw3d events"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showMaw3dWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showMaw3dWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "إظهار الاقتباسات التحفيزية اليومية" : "Show daily inspirational quotes"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showQuoteWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showQuoteWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "ويدجت WHOOP للوحة التحكم" : "WHOOP Dashboard Widget"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showWhoopWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showWhoopWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "إظهار يوميات وقطي" : "Show Today's Journal"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showJournalWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showJournalWidget', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
