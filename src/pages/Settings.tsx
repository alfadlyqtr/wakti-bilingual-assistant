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
    showNavWidget: false, showCalendarWidget: true, showTRWidget: true,
    showEventsWidget: false, showQuoteWidget: false, showMaw3dWidget: false,
    showWhoopWidget: false, showJournalWidget: false,
  };

  // Separate widget settings for each mode — they never share state
  const [dashboardWidgets, setDashboardWidgets] = useState<WidgetConfig>({ ...DEFAULT_DASHBOARD_WIDGETS });
  const [homescreenWidgets, setHomescreenWidgets] = useState<WidgetConfig>({ ...DEFAULT_HOMESCREEN_WIDGETS });

  // Homescreen background style
  type BgMode = 'solid' | 'gradient';
  const [hsBgMode,   setHsBgMode]   = useState<BgMode>('solid');
  const [hsBgColor1, setHsBgColor1] = useState('#0c0f14');
  const [hsBgColor2, setHsBgColor2] = useState('#1a1040');
  const [hsBgColor3, setHsBgColor3] = useState('');
  const [hsBgAngle,  setHsBgAngle]  = useState(180);
  const [hsGlow,     setHsGlow]     = useState(true);

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

      // Load homescreen background style
      if (s?.homescreenBg) {
        const bg = s.homescreenBg;
        if (bg.mode === 'solid' || bg.mode === 'gradient') setHsBgMode(bg.mode);
        if (bg.color1) setHsBgColor1(bg.color1);
        if (bg.color2) setHsBgColor2(bg.color2);
        if (bg.color3 !== undefined) setHsBgColor3(bg.color3 || '');
        if (typeof bg.angle === 'number') setHsBgAngle(bg.angle);
        if (typeof bg.glow === 'boolean') setHsGlow(bg.glow);
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

  const saveHomescreenBg = async (mode: BgMode, color1: string, color2: string, color3: string, angle: number, glow: boolean) => {
    try {
      const { data: currentProfile } = await supabase
        .from('profiles').select('settings').eq('id', user?.id).single();
      const currentSettings = (currentProfile?.settings as any) || {};
      const payload = { mode, color1, color2, color3, angle, glow };
      await supabase.from('profiles').update({
        settings: { ...currentSettings, homescreenBg: payload }
      }).eq('id', user?.id);
      window.dispatchEvent(new CustomEvent('homescreenBgChanged', { detail: payload }));
      showSuccess(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error saving homescreen bg:', error);
      showError(t("errorUpdatingSettings", language));
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
                { key: 'showCalendarWidget', labelEn: 'Calendar',                   labelAr: 'التقويم' },
                { key: 'showTRWidget',       labelEn: 'Tasks & Reminders',          labelAr: 'المهام والتذكيرات' },
                { key: 'showMaw3dWidget',    labelEn: 'Maw3d Events',               labelAr: 'أحداث مواعيد' },
                { key: 'showWhoopWidget',    labelEn: 'WHOOP Widget',               labelAr: 'ويدجت WHOOP' },
                { key: 'showJournalWidget',  labelEn: "Today's Journal",            labelAr: 'يوميات وقتي' },
                { key: 'showQuoteWidget',    labelEn: 'Daily Quote',                labelAr: 'اقتباس اليوم' },
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

            {/* Homescreen Background Style — only when homescreen look is active */}
            {dashboardLook === 'homescreen' && (() => {
              // Compute preview gradient string
              const gradientStr = hsBgMode === 'gradient'
                ? hsBgColor3
                  ? `linear-gradient(${hsBgAngle}deg, ${hsBgColor1} 0%, ${hsBgColor3} 50%, ${hsBgColor2} 100%)`
                  : `linear-gradient(${hsBgAngle}deg, ${hsBgColor1} 0%, ${hsBgColor2} 100%)`
                : hsBgColor1;

              // Angle presets
              const ANGLES: { label: string; labelAr: string; deg: number; icon: string }[] = [
                { label: 'Top → Bottom', labelAr: '↓', deg: 180, icon: '↓' },
                { label: 'Bottom → Top', labelAr: '↑', deg: 0,   icon: '↑' },
                { label: 'Left → Right', labelAr: '→', deg: 90,  icon: '→' },
                { label: 'Right → Left', labelAr: '←', deg: 270, icon: '←' },
                { label: '↘ Diagonal',   labelAr: '↘', deg: 135, icon: '↘' },
                { label: '↗ Diagonal',   labelAr: '↗', deg: 45,  icon: '↗' },
                { label: '↙ Diagonal',   labelAr: '↙', deg: 225, icon: '↙' },
                { label: '↖ Diagonal',   labelAr: '↖', deg: 315, icon: '↖' },
              ];

              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      {language === 'ar' ? 'خلفية الشاشة الرئيسية' : 'Home Screen Style'}
                    </CardTitle>
                    <CardDescription>
                      {language === 'ar'
                        ? 'اختر لون أو تدرج مع زاوية وثلاثة ألوان'
                        : 'Solid color or custom gradient — pick angle and up to 3 colors'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">

                    {/* Mode toggle */}
                    <div className="flex gap-2">
                      {(['solid', 'gradient'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setHsBgMode(m)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                            hsBgMode === m
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {m === 'solid'
                            ? (language === 'ar' ? 'لون ثابت' : 'Solid')
                            : (language === 'ar' ? 'تدرج' : 'Gradient')}
                        </button>
                      ))}
                    </div>

                    {/* Live preview — tall enough to feel real */}
                    <div
                      className="w-full h-24 rounded-2xl border border-border/40 relative overflow-hidden"
                      style={{ background: gradientStr }}
                    >
                      {hsGlow && (
                        <div className="absolute inset-0 pointer-events-none" style={{
                          background: `radial-gradient(ellipse at 50% 20%, ${hsBgColor2}66 0%, transparent 65%)`
                        }} />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-3">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-10 h-10 rounded-[23%] bg-white/20 backdrop-blur-sm border border-white/30"
                            style={{ boxShadow: hsGlow ? `0 0 14px ${hsBgColor2}aa` : 'none' }}
                          />
                        ))}
                      </div>
                      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/50">
                        {language === 'ar' ? 'معاينة' : 'Preview'}
                      </span>
                    </div>

                    {/* Color pickers */}
                    <div className="space-y-3">
                      {/* Color 1 */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" style={{ background: hsBgColor1 }} />
                          <Label className="text-sm font-medium">
                            {hsBgMode === 'gradient' ? (language === 'ar' ? 'اللون ١' : 'Color 1') : (language === 'ar' ? 'اللون' : 'Color')}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono hidden sm:block">{hsBgColor1}</span>
                          <input type="color" title={language === 'ar' ? 'اللون الأول' : 'Color 1'}
                            value={hsBgColor1} onChange={e => setHsBgColor1(e.target.value)}
                            className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                        </div>
                      </div>

                      {/* Color 2 — gradient only */}
                      {hsBgMode === 'gradient' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" style={{ background: hsBgColor2 }} />
                            <Label className="text-sm font-medium">{language === 'ar' ? 'اللون ٢' : 'Color 2'}</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono hidden sm:block">{hsBgColor2}</span>
                            <input type="color" title={language === 'ar' ? 'اللون الثاني' : 'Color 2'}
                              value={hsBgColor2} onChange={e => setHsBgColor2(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                          </div>
                        </div>
                      )}

                      {/* Color 3 — gradient only, optional */}
                      {hsBgMode === 'gradient' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0"
                              style={{ background: hsBgColor3 || 'transparent' }} />
                            <div>
                              <Label className="text-sm font-medium">{language === 'ar' ? 'اللون ٣ (اختياري)' : 'Color 3 (optional)'}</Label>
                              {!hsBgColor3 && <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'اضغط لإضافة لون وسط' : 'Tap to add middle color'}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hsBgColor3 && (
                              <button onClick={() => setHsBgColor3('')}
                                className="text-[10px] text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg border border-border">
                                {language === 'ar' ? 'حذف' : 'Clear'}
                              </button>
                            )}
                            <input type="color" title={language === 'ar' ? 'اللون الثالث' : 'Color 3 (middle)'}
                              value={hsBgColor3 || hsBgColor1}
                              onChange={e => setHsBgColor3(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Angle selector — gradient only */}
                    {hsBgMode === 'gradient' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{language === 'ar' ? 'اتجاه التدرج' : 'Gradient Direction'}</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {ANGLES.map(a => (
                            <button
                              key={a.deg}
                              onClick={() => setHsBgAngle(a.deg)}
                              className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-base font-bold transition-all ${
                                hsBgAngle === a.deg
                                  ? 'border-primary bg-primary/15 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              <span className="text-lg leading-none">{a.icon}</span>
                              <span className="text-[9px] mt-1 font-normal opacity-70">{a.deg}°</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Glow toggle */}
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {language === 'ar' ? 'تأثير الإضاءة ✨' : 'Glow Effect ✨'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'إضاءة ملونة خلف الأيقونات والودجيتس' : 'Colored glow behind icons and widgets'}
                        </p>
                      </div>
                      <Switch checked={hsGlow} onCheckedChange={v => setHsGlow(v)} />
                    </div>

                    {/* Save button */}
                    <Button
                      className="w-full h-12 text-sm font-semibold rounded-xl"
                      onClick={() => saveHomescreenBg(hsBgMode, hsBgColor1, hsBgColor2, hsBgColor3, hsBgAngle, hsGlow)}
                    >
                      {language === 'ar' ? 'حفظ النمط' : 'Save Style'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
