
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
import { PageContainer } from '@/components/PageContainer';
import { Sun, Moon, Bell, CheckCircle, Settings as SettingsIcon, Layout, Palette } from 'lucide-react';
import { setupNotificationCron } from '@/utils/testNotifications';
import { getUserPreferences, saveUserPreferences } from '@/utils/widgetPreferences';

export default function Settings() {
  const { showSuccess, showError } = useToastHelper();
  const { language, theme, setTheme, setLanguage, toggleLanguage } = useTheme();
  
  // Notification setup state
  const [isSettingUpNotifications, setIsSettingUpNotifications] = useState(false);
  const [notificationSetupComplete, setNotificationSetupComplete] = useState(false);
  
  // Widget preferences state
  const [widgetPrefs, setWidgetPrefs] = useState({
    calendar: true,
    tr: true,
    maw3d: true,
    dailyQuote: true
  });

  useEffect(() => {
    // Check if notification setup was already completed
    const setupComplete = localStorage.getItem('wakti-notification-setup-complete');
    setNotificationSetupComplete(setupComplete === 'true');
    
    // Load widget preferences
    const prefs = getUserPreferences();
    setWidgetPrefs({
      calendar: prefs.calendar !== false,
      tr: prefs.tr !== false,
      maw3d: prefs.maw3d !== false,
      dailyQuote: prefs.dailyQuote !== false
    });
  }, []);

  const handleNotificationSetup = async () => {
    setIsSettingUpNotifications(true);
    try {
      const success = await setupNotificationCron();
      if (success) {
        showSuccess(t('notificationSystemSetupSuccess', language) || 'Notification system set up successfully!');
        setNotificationSetupComplete(true);
        localStorage.setItem('wakti-notification-setup-complete', 'true');
      } else {
        showError(t('notificationSystemSetupFailed', language) || 'Failed to set up notification system. Please try again.');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      showError(t('notificationSystemSetupError', language) || 'An error occurred while setting up notifications.');
    } finally {
      setIsSettingUpNotifications(false);
    }
  };

  const handleWidgetToggle = (widgetId: string, enabled: boolean) => {
    const newPrefs = { ...widgetPrefs, [widgetId]: enabled };
    setWidgetPrefs(newPrefs);
    saveUserPreferences(newPrefs);
    showSuccess(language === 'ar' ? 'تم تحديث تفضيلات الأدوات' : 'Widget preferences updated');
  };

  return (
    <PageContainer>
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('settings', language)}</h1>
          <p className="text-muted-foreground mt-2">
            {language === 'ar' ? 'إدارة إعدادات التطبيق وتفضيلاتك' : 'Manage your app settings and preferences'}
          </p>
        </div>

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t('appearance', language)}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t('notifications', language)}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6">
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
              <CardContent className="space-y-6">
                {/* Theme Selection */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{t('theme', language)}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'ar' ? 'اختر مظهر التطبيق' : 'Choose your app theme'}
                    </p>
                  </div>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-[180px]">
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
                    <p className="text-sm text-muted-foreground mt-1">
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
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            {/* Notification Setup */}
            {!notificationSetupComplete && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Bell className="h-5 w-5" />
                    {language === 'ar' ? 'إعداد نظام الإشعارات' : 'Setup Notification System'}
                  </CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400">
                    {language === 'ar' 
                      ? 'قم بإعداد نظام معالجة الإشعارات التلقائي لتلقي التنبيهات في الوقت الفعلي.'
                      : 'Set up the automatic notification processing system to receive real-time alerts.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleNotificationSetup}
                    disabled={isSettingUpNotifications}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSettingUpNotifications ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {language === 'ar' ? 'جاري الإعداد...' : 'Setting up...'}
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 h-4 w-4" />
                        {language === 'ar' ? 'إعداد نظام الإشعارات' : 'Setup Notification System'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {notificationSetupComplete && (
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">
                      {language === 'ar' 
                        ? 'نظام الإشعارات نشط ويعمل'
                        : 'Notification system is active and running'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notification Settings */}
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
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
                    checked={widgetPrefs.calendar}
                    onCheckedChange={(checked) => handleWidgetToggle('calendar', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      {language === 'ar' ? 'أداة المهام والتذكيرات' : 'Tasks & Reminders Widget'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عرض المهام والتذكيرات المعلقة' : 'Show pending tasks and reminders'}
                    </p>
                  </div>
                  <Switch
                    checked={widgetPrefs.tr}
                    onCheckedChange={(checked) => handleWidgetToggle('tr', checked)}
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
                    checked={widgetPrefs.maw3d}
                    onCheckedChange={(checked) => handleWidgetToggle('maw3d', checked)}
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
                    checked={widgetPrefs.dailyQuote}
                    onCheckedChange={(checked) => handleWidgetToggle('dailyQuote', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Quote Manager */}
            <CustomQuoteManager />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
