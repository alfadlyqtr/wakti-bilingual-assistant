// @ts-nocheck

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
import { Shield, Users, Eye, Quote, Palette, Bell, Layout, Home, LayoutDashboard } from "lucide-react";
import { useToastHelper } from "@/hooks/use-toast-helper";

export default function Settings() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToastHelper();
  const [activeTab, setActiveTab] = useState("appearance");

  type WidgetConfig = {
    showNavWidget: boolean;
    showCalendarWidget: boolean;
    showEventsWidget: boolean;
    showQuoteWidget: boolean;
    showMaw3dWidget: boolean;
    showTRWidget: boolean;
    showWhoopWidget: boolean;
    showJournalWidget: boolean;
  };
  const DEFAULT_DASHBOARD_WIDGETS: WidgetConfig = {
    showNavWidget: true, showCalendarWidget: true, showEventsWidget: true,
    showQuoteWidget: true, showMaw3dWidget: true, showTRWidget: true,
    showWhoopWidget: true, showJournalWidget: true,
  };
  // Homescreen: only 3 on by default
  const DEFAULT_HOMESCREEN_WIDGETS: WidgetConfig = {
    showNavWidget: true, showCalendarWidget: true, showTRWidget: true,
    showEventsWidget: false, showQuoteWidget: false, showMaw3dWidget: false,
    showWhoopWidget: false, showJournalWidget: false,
  };

  // Separate widget settings for each mode — they never share state
  const [dashboardWidgets, setDashboardWidgets] = useState<WidgetConfig>({ ...DEFAULT_DASHBOARD_WIDGETS });
  const [homescreenWidgets, setHomescreenWidgets] = useState<WidgetConfig>({ ...DEFAULT_HOMESCREEN_WIDGETS });

  // Dashboard look preference ('dashboard' = default widget grid, 'homescreen' = new home screen look)
  const [dashboardLook, setDashboardLook] = useState<'dashboard' | 'homescreen'>(() => {
    const cached = localStorage.getItem('wakti_dashboard_look');
    return cached === 'homescreen' ? 'homescreen' : 'dashboard';
  });

  // Active widget settings based on current mode
  const widgetSettings = dashboardLook === 'homescreen' ? homescreenWidgets : dashboardWidgets;
  const setWidgetSettings = dashboardLook === 'homescreen' ? setHomescreenWidgets : setDashboardWidgets;

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

      const s = profile?.settings as any;

      // Load dashboard widgets (legacy key 'widgets' maps to dashboard)
      if (s?.dashboardWidgets) {
        const w = s.dashboardWidgets;
        setDashboardWidgets(prev => ({ ...prev, ...w, showTRWidget: (w.showTRWidget !== false) || (w.showTasksWidget === true) }));
      } else if (s?.widgets) {
        // legacy fallback
        const w = s.widgets;
        setDashboardWidgets(prev => ({ ...prev, ...w, showTRWidget: (w.showTRWidget !== false) || (w.showTasksWidget === true) }));
      }

      // Load homescreen widgets — enforce max 3 on load
      if (s?.homescreenWidgets) {
        const raw = { ...DEFAULT_HOMESCREEN_WIDGETS, ...s.homescreenWidgets };
        const keys = Object.keys(raw) as (keyof WidgetConfig)[];
        let onCount = 0;
        const clamped = { ...raw };
        for (const k of keys) {
          if (clamped[k]) {
            if (onCount < 3) onCount++;
            else clamped[k] = false;
          }
        }
        setHomescreenWidgets(clamped);
      }

      // Load dashboard look preference
      const savedLook = s?.dashboardLook;
      if (savedLook === 'dashboard' || savedLook === 'homescreen') {
        setDashboardLook(savedLook);
      }

      setPrivacySettings({
        autoApproveContacts: profile?.auto_approve_contacts || false,
        profileVisibility: s?.privacy?.profileVisibility !== false,
        showActivityStatus: s?.privacy?.activityStatus !== false
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

  const updateWidgetSetting = async (key: keyof WidgetConfig, value: boolean) => {
    const isHomescreen = dashboardLook === 'homescreen';
    const current = isHomescreen ? homescreenWidgets : dashboardWidgets;
    const newSettings = { ...current, [key]: value };

    // Optimistic update
    if (isHomescreen) setHomescreenWidgets(newSettings);
    else setDashboardWidgets(newSettings);

    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user?.id)
        .single();

      const currentSettings = (currentProfile?.settings as any) || {};
      const storageKey = isHomescreen ? 'homescreenWidgets' : 'dashboardWidgets';

      await supabase
        .from('profiles')
        .update({
          settings: {
            ...currentSettings,
            [storageKey]: newSettings,
            // Keep legacy 'widgets' key in sync for dashboard mode
            ...(isHomescreen ? {} : { widgets: newSettings }),
          }
        })
        .eq('id', user?.id);

      showSuccess(t("settingsUpdated", language));
      window.dispatchEvent(new CustomEvent('widgetSettingsChanged', { detail: { ...newSettings, mode: dashboardLook } }));
    } catch (error) {
      console.error('Error updating widget setting:', error);
      showError(t("errorUpdatingSettings", language));
      // Revert
      if (isHomescreen) setHomescreenWidgets(current);
      else setDashboardWidgets(current);
    }
  };

  const updateDashboardLook = async (look: 'dashboard' | 'homescreen') => {
    try {
      setDashboardLook(look);

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
            dashboardLook: look
          }
        })
        .eq('id', user?.id);

      showSuccess(t("settingsUpdated", language));
      
      // Force dashboard to reload by dispatching a custom event
      window.dispatchEvent(new CustomEvent('dashboardLookChanged', { detail: look }));
    } catch (error) {
      console.error('Error updating dashboard look:', error);
      showError(t("errorUpdatingSettings", language));
      setDashboardLook(dashboardLook);
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
          <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
            <TabsTrigger value="appearance" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Palette className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {t("appearance", language)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {t("notifications", language)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Layout className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {language === "ar" ? "لوحة التحكم" : "Dashboard"}
              </span>
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
            {/* Dashboard Look Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  {language === "ar" ? "مظهر لوحة التحكم" : "Dashboard Look"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "اختر مظهر شاشتك الرئيسية" : "Choose your home screen style"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "الشكل الافتراضي (لوحة التحكم)" : "Default Look (Dashboard)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" 
                        ? "عرض الأدوات كبطاقات قابلة للتخصيص" 
                        : "Show widgets as customizable cards"}
                    </p>
                  </div>
                  <Switch 
                    checked={dashboardLook === 'dashboard'}
                    onCheckedChange={(checked) => updateDashboardLook(checked ? 'dashboard' : 'homescreen')}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "شكل الشاشة الرئيسية" : "Home Screen Look"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" 
                        ? "عرض أنيق ومركز للوصول السريع" 
                        : "Clean, focused layout for quick access"}
                    </p>
                  </div>
                  <Switch 
                    checked={dashboardLook === 'homescreen'}
                    onCheckedChange={(checked) => updateDashboardLook(checked ? 'homescreen' : 'dashboard')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Widget Visibility — always shown, behavior changes per mode */}
            {(() => {
              const isHomescreen = dashboardLook === 'homescreen';

              // Widget entries — for homescreen these are the stats/app row choices
              const widgetEntries: { key: keyof typeof widgetSettings; labelEn: string; labelAr: string }[] = [
                { key: 'showNavWidget',      labelEn: 'Quick Access',               labelAr: 'الوصول السريع' },
                { key: 'showCalendarWidget', labelEn: 'Upcoming Events',            labelAr: 'الأحداث القادمة' },
                { key: 'showTRWidget',       labelEn: 'Tasks & Reminders',          labelAr: 'المهام والتذكيرات' },
                { key: 'showMaw3dWidget',    labelEn: 'Maw3d Events',               labelAr: 'أحداث مواعيد' },
                { key: 'showWhoopWidget',    labelEn: 'WHOOP Widget',               labelAr: 'ويدجت WHOOP' },
                { key: 'showJournalWidget',  labelEn: "Today's Journal",            labelAr: 'يوميات وقتي' },
              ];

              // Count how many are currently ON
              const enabledCount = widgetEntries.filter(e => widgetSettings[e.key]).length;

              const handleWidgetToggle = (key: keyof typeof widgetSettings, checked: boolean) => {
                if (isHomescreen && checked && enabledCount >= 3) return; // max 3 in homescreen
                updateWidgetSetting(key, checked);
              };

              return (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{t("widgetVisibility", language)}</span>
                        {isHomescreen && (
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {language === 'ar' ? `${enabledCount}/3 محدد` : `${enabledCount}/3 selected`}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {isHomescreen
                          ? (language === "ar" ? "اختر ما يصل إلى ٣ إحصائيات تظهر في الشاشة الرئيسية" : "Choose up to 3 stats to show on your Home Screen")
                          : (language === "ar" ? "اختر الأدوات التي تريد عرضها في لوحة التحكم" : "Choose which widgets to display on your dashboard")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {widgetEntries.map(({ key, labelEn, labelAr }) => {
                        const isOn = !!widgetSettings[key];
                        const isDisabled = isHomescreen && !isOn && enabledCount >= 3;
                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between rounded-md border p-4 transition-opacity ${isDisabled ? 'opacity-40' : ''}`}
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">
                                {language === "ar" ? labelAr : labelEn}
                              </p>
                              {isDisabled && (
                                <p className="text-xs text-muted-foreground">
                                  {language === 'ar' ? 'الحد الأقصى ٣ عناصر' : 'Max 3 reached'}
                                </p>
                              )}
                            </div>
                            <Switch
                              checked={isOn}
                              disabled={isDisabled}
                              onCheckedChange={(checked) => handleWidgetToggle(key, checked)}
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Daily Quote toggle — only in homescreen mode */}
                  {isHomescreen && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Quote className="h-5 w-5" />
                          {language === 'ar' ? 'اقتباس اليوم' : 'Daily Quote'}
                        </CardTitle>
                        <CardDescription>
                          {language === 'ar' ? 'إظهار اقتباس يومي ملهم في الشاشة الرئيسية' : 'Show a daily inspirational quote on your Home Screen'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between rounded-md border p-4">
                          <p className="text-sm font-medium">
                            {language === 'ar' ? 'إظهار الاقتباسات اليومية' : 'Show daily inspirational quotes'}
                          </p>
                          <Switch
                            checked={widgetSettings.showQuoteWidget}
                            onCheckedChange={(checked) => updateWidgetSetting('showQuoteWidget', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dashboard mode: quote widget inline */}
                  {!isHomescreen && (
                    <Card>
                      <CardHeader>
                        <CardTitle>{language === 'ar' ? 'الاقتباسات اليومية' : 'Daily Quotes'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between rounded-md border p-4">
                          <p className="text-sm font-medium">
                            {language === "ar" ? "إظهار الاقتباسات التحفيزية اليومية" : "Show daily inspirational quotes"}
                          </p>
                          <Switch
                            checked={widgetSettings.showQuoteWidget}
                            onCheckedChange={(checked) => updateWidgetSetting('showQuoteWidget', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
