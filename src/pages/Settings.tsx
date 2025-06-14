import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { t } from '@/utils/translations';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { CustomQuoteManager } from '@/components/settings/CustomQuoteManager';
import { QuotePreferencesManager } from '@/components/settings/QuotePreferencesManager';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { NotificationSetupCard } from '@/components/settings/NotificationSetupCard';
import { PageContainer } from '@/components/PageContainer';
import { Sun, Moon, Bell, Layout, Palette } from 'lucide-react';
import { getUserPreferences, saveUserPreferences, fetchRemoteWidgetPrefs, saveRemoteWidgetPrefs } from '@/utils/widgetPreferences';

export default function Settings() {
  const { showSuccess } = useToastHelper();
  const { language, theme, setTheme, toggleLanguage } = useTheme();

  // DB widget fields: calendarWidget, tasksWidget, maw3dWidget, remindersWidget, quoteWidget
  // Dashboard expects: calendar, tr, maw3d, quote
  // So: tr = tasksWidget || remindersWidget

  const [widgetPrefs, setWidgetPrefs] = useState({
    calendarWidget: true,
    tasksWidget: true,
    maw3dWidget: true,
    remindersWidget: true,
    quoteWidget: true
  });

  useEffect(() => {
    // Try to load DB prefs, fallback to localStorage
    (async () => {
      const remote = await fetchRemoteWidgetPrefs();
      if (remote) {
        setWidgetPrefs({
          calendarWidget: remote.calendarWidget !== false,
          tasksWidget: remote.tasksWidget !== false,
          maw3dWidget: remote.maw3dWidget !== false,
          remindersWidget: remote.remindersWidget !== false,
          quoteWidget: remote.quoteWidget !== false,
        });
      } else {
        // Fallback: treat local tr pref as both tasks/reminders
        const local = getUserPreferences();
        setWidgetPrefs({
          calendarWidget: local.calendar !== false,
          tasksWidget: local.tr !== false,
          maw3dWidget: local.maw3d !== false,
          remindersWidget: local.tr !== false,
          quoteWidget: local.dailyQuote !== false,
        });
      }
    })();
  }, []);

  // Helper: on widget toggle, set + save to both Supabase DB and localStorage for compatibility
  const handleWidgetToggle = async (settingKey: string, enabled: boolean) => {
    const newPrefs = { ...widgetPrefs, [settingKey]: enabled };

    setWidgetPrefs(newPrefs);

    // Update DB (Supabase profile.settings.widgets)
    await saveRemoteWidgetPrefs(newPrefs);

    // Also update localStorage for compatibility with old fallback (e.g. force tr/dailyQuote, etc)
    const localWidgetPrefs = {
      // map DB to local for grid
      calendar: newPrefs.calendarWidget !== false,
      tr: (newPrefs.tasksWidget !== false) || (newPrefs.remindersWidget !== false),
      maw3d: newPrefs.maw3dWidget !== false,
      dailyQuote: newPrefs.quoteWidget !== false,
    };
    saveUserPreferences(localWidgetPrefs);

    showSuccess(language === 'ar' ? 'تم تحديث تفضيلات الأدوات' : 'Widget preferences updated');
  };

  return (
    <PageContainer showHeader={false}>
      <div className="container mx-auto max-w-4xl p-4 space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('settings', language)}</h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' ? 'إدارة إعدادات التطبيق وتفضيلاتك' : 'Manage your app settings and preferences'}
          </p>
        </div>

        <Tabs defaultValue="appearance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="appearance" className="flex flex-col items-center gap-1 p-3">
              <Palette className="h-4 w-4" />
              <span className="text-xs">{t('appearance', language)}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex flex-col items-center gap-1 p-3">
              <Bell className="h-4 w-4" />
              <span className="text-xs">{t('notifications', language)}</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 p-3">
              <Layout className="h-4 w-4" />
              <span className="text-xs">{language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            {/* Theme and Language */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t('appearanceSettings', language)}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'تخصيص مظهر التطبيق واللغة' : 'Customize app appearance and language'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Selection */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{t('theme', language)}</Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'اختر مظهر التطبيق' : 'Choose your app theme'}
                    </p>
                  </div>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          {t('light', language)}
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          {t('dark', language)}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language Selection */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{t('language', language)}</Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'اختر لغة التطبيق' : 'Choose your app language'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={toggleLanguage}
                    className="min-w-[120px]"
                  >
                    {language === 'en' ? t('arabic', language) : t('english', language)}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <PrivacySettings />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            {/* Notification Setup */}
            <NotificationSetupCard />

            {/* Notification Settings */}
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            {/* Widget Visibility */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  {language === 'ar' ? 'رؤية الأدوات' : 'Widget Visibility'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'تحكم في الأدوات التي تظهر في لوحة التحكم'
                    : 'Control which widgets appear on your dashboard'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة التقويم' : 'Calendar Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض الأحداث والمواعيد القادمة' : 'Show upcoming events and appointments'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.calendarWidget}
                    onCheckedChange={(checked) => handleWidgetToggle('calendarWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة المهام' : 'Tasks Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض المهام المعلقة' : 'Show pending tasks'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.tasksWidget}
                    onCheckedChange={(checked) => handleWidgetToggle('tasksWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة التذكيرات' : 'Reminders Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض التذكيرات المعلقة' : 'Show pending reminders'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.remindersWidget}
                    onCheckedChange={(checked) => handleWidgetToggle('remindersWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة أحداث مواعيد' : 'Maw3d Events Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض أحداث مواعيد القادمة' : 'Show upcoming Maw3d events'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.maw3dWidget}
                    onCheckedChange={(checked) => handleWidgetToggle('maw3dWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة الاقتباس اليومي' : 'Daily Quote Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض اقتباس ملهم يومي' : 'Show daily inspirational quotes'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.quoteWidget}
                    onCheckedChange={(checked) => handleWidgetToggle('quoteWidget', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quote Preferences */}
            <QuotePreferencesManager />

            {/* Custom Quote Manager */}
            <CustomQuoteManager />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
