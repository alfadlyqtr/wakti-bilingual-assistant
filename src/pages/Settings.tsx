
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQuotePreferences } from "@/utils/quoteService";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { quotes } from "@/utils/dailyQuotes";
import { Check, Save, Settings as SettingsIcon } from "lucide-react";
import { updateAutoApproveContacts, getCurrentUserProfile } from "@/services/contactsService";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSettings } from "@/hooks/useSettings";
import { LoadingSpinner } from "@/components/ui/loading";

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const categories = Object.keys(quotes);
  const { confirm } = useToast();
  
  // Use our new settings hook
  const { 
    settings, 
    isLoading, 
    isSaving, 
    updateSettings, 
    saveSettings 
  } = useSettings();

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  // Setting state hooks - these will all be synced with our settings hook
  const [widgetSettings, setWidgetSettings] = useState(settings.widgets);
  const [notificationSettings, setNotificationSettings] = useState(settings.notifications);
  const [privacySettings, setPrivacySettings] = useState(settings.privacy);

  // Initialize local state from settings when they load
  useEffect(() => {
    if (!isLoading) {
      setWidgetSettings(settings.widgets);
      setNotificationSettings(settings.notifications);
      setPrivacySettings(settings.privacy);
      setQuotePreferences(settings.quotes);
    }
  }, [isLoading, settings]);

  const autoApproveMutation = useMutation({
    mutationFn: (autoApprove: boolean) => updateAutoApproveContacts(autoApprove),
    onSuccess: () => {
      toast(t("settingsUpdated", language), {
        description: t("contactSettingsUpdated", language)
      });
    },
    onError: (error) => {
      console.error("Error updating contact settings:", error);
      toast(t("error", language), {
        description: t("errorUpdatingSettings", language),
        variant: "destructive"
      });
    }
  });

  // Widget setting handlers
  const handleWidgetToggle = (widgetKey: keyof typeof widgetSettings, checked: boolean) => {
    const updatedSettings = { ...widgetSettings, [widgetKey]: checked };
    setWidgetSettings(updatedSettings);
    updateSettings('widgets', updatedSettings);
    
    toast(checked 
      ? t("widgetEnabled", language) 
      : t("widgetDisabled", language), {
      description: t(widgetKey as any, language)
    });
  };
  
  // Notification setting handlers
  const handleNotificationToggle = (settingKey: keyof typeof notificationSettings, checked: boolean) => {
    const updatedSettings = { ...notificationSettings, [settingKey]: checked };
    setNotificationSettings(updatedSettings);
    updateSettings('notifications', updatedSettings);
    
    toast(t("settingsUpdated", language), {
      description: t("notificationSettingsUpdated", language)
    });
  };
  
  // Privacy setting handlers
  const handlePrivacyToggle = (settingKey: keyof typeof privacySettings, checked: boolean) => {
    const updatedSettings = { ...privacySettings, [settingKey]: checked };
    setPrivacySettings(updatedSettings);
    updateSettings('privacy', updatedSettings);
    
    toast(t("settingsUpdated", language), {
      description: t("privacySettingsUpdated", language)
    });
  };

  const handleAutoApproveToggle = (checked: boolean) => {
    autoApproveMutation.mutate(checked);
  };

  const handleQuoteCategoryChange = (category: string) => {
    const newPreferences = { ...quotePreferences, category };
    setQuotePreferences(newPreferences);
    updateSettings('quotes', newPreferences);
    
    // Open dialog when custom is selected
    if (category === 'custom') {
      setCustomQuoteDialogOpen(true);
    }
    
    toast(language === 'ar' ? "تم تحديث فئة الاقتباس" : "Quote category updated");
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    updateSettings('quotes', newPreferences);
    
    toast(language === 'ar' ? "تم تحديث تردد الاقتباس" : "Quote frequency updated");
  };
  
  // Save all settings
  const handleSaveAllSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ جميع الإعدادات؟" : "Save all settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ جميع التغييرات؟" : "Are you sure you want to save all changes?",
      onConfirm: async () => {
        const success = await saveSettings({
          widgets: widgetSettings,
          notifications: notificationSettings,
          privacy: privacySettings,
          quotes: quotePreferences
        });
        
        if (success) {
          toast(language === 'ar' ? "تم حفظ جميع الإعدادات" : "All settings saved", {
            description: <Check className="h-4 w-4" />,
          });
        }
      }
    });
  };
  
  // Watch for category changes to show dialog
  useEffect(() => {
    if (quotePreferences.category === 'custom') {
      setCustomQuoteDialogOpen(true);
    }
  }, []); // Only run once on component mount

  // Show loading state while settings are being fetched
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-y-auto py-6 pb-24 px-4">
      <h2 className="text-xl font-bold mb-4">{t("settings", language)}</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>{t("appearance", language)}</CardTitle>
          <CardDescription>{t("appearanceSettings", language)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language & Theme Settings */}
          <div className="flex justify-between items-center">
            <span>{language === "en" ? "Language" : "اللغة"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="h-9 px-3 rounded-full text-sm"
            >
              {t("language", language)}
            </Button>
          </div>
          
          {/* Theme Toggle */}
          <div className="flex justify-between items-center">
            <span>{language === "ar" ? "السمة" : "Theme"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="h-9 px-3 rounded-full text-sm"
            >
              {theme === "dark"
                ? t("lightMode", language)
                : t("darkMode", language)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("contactsSettings", language)}</CardTitle>
          <CardDescription>{t("contactsSettingsDescription", language)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-approve" className="mb-1 block font-medium">
                {t("autoApproveRequests", language)}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("autoApproveExplanation", language)}
              </p>
            </div>
            <Switch 
              id="auto-approve" 
              checked={userProfile?.auto_approve_contacts} 
              onCheckedChange={handleAutoApproveToggle}
              disabled={isLoadingProfile || autoApproveMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quote Settings */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{language === 'ar' ? 'إعدادات الاقتباس اليومي' : 'Daily Quote Settings'}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'فئة الاقتباس' : 'Quote Category'}
            </label>
            <Select 
              value={quotePreferences.category} 
              onValueChange={handleQuoteCategoryChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {language === 'ar' ? 
                      (
                        category === 'motivational' ? 'تحفيزي' : 
                        category === 'islamic' ? 'إسلامي' : 
                        category === 'positive' ? 'إيجابي' : 
                        category === 'health' ? 'صحي' : 
                        category === 'mixed' ? 'متنوع' : 
                        category === 'custom' ? 'مخصص' :
                        category === 'productivity' ? 'إنتاجية' :
                        category === 'discipline' ? 'انضباط' :
                        category === 'gratitude' ? 'امتنان' :
                        category === 'leadership' ? 'قيادة' :
                        category
                      ) : 
                      (
                        category.charAt(0).toUpperCase() + category.slice(1)
                      )
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'تكرار تغيير الاقتباس' : 'Quote Change Frequency'}
            </label>
            <Select 
              value={quotePreferences.frequency}
              onValueChange={handleQuoteFrequencyChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2xday">
                  {language === 'ar' ? 'مرتان في اليوم' : '2 times a day'}
                </SelectItem>
                <SelectItem value="4xday">
                  {language === 'ar' ? '4 مرات في اليوم' : '4 times a day'}
                </SelectItem>
                <SelectItem value="6xday">
                  {language === 'ar' ? '6 مرات في اليوم' : '6 times a day'}
                </SelectItem>
                <SelectItem value="appStart">
                  {language === 'ar' ? 'مع كل بدء تشغيل للتطبيق' : 'Every app start'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Button to manage custom quotes */}
          {quotePreferences.category === 'custom' && (
            <Button 
              variant="outline" 
              className="w-full mt-4" 
              onClick={() => setCustomQuoteDialogOpen(true)}
            >
              {language === 'ar' ? 'إدارة الاقتباسات المخصصة' : 'Manage Custom Quotes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{t("notificationPreferences", language)}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'إشعارات الدفع' : 'Push Notifications'}</span>
            <Switch 
              id="push-notifications" 
              checked={notificationSettings.pushNotifications}
              onCheckedChange={(checked) => handleNotificationToggle('pushNotifications', checked)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}</span>
            <Switch 
              id="email-notifications" 
              checked={notificationSettings.emailNotifications}
              onCheckedChange={(checked) => handleNotificationToggle('emailNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Widget Visibility */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{t("widgetVisibility", language)}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة المهام المصغرة' : 'Tasks Widget'}</span>
            <Switch 
              id="tasks-widget" 
              checked={widgetSettings.tasksWidget}
              onCheckedChange={(checked) => handleWidgetToggle('tasksWidget', checked)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة التقويم المصغرة' : 'Calendar Widget'}</span>
            <Switch 
              id="calendar-widget" 
              checked={widgetSettings.calendarWidget}
              onCheckedChange={(checked) => handleWidgetToggle('calendarWidget', checked)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة التذكيرات المصغرة' : 'Reminders Widget'}</span>
            <Switch 
              id="reminders-widget" 
              checked={widgetSettings.remindersWidget}
              onCheckedChange={(checked) => handleWidgetToggle('remindersWidget', checked)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة الاقتباس اليومي المصغرة' : 'Daily Quote Widget'}</span>
            <Switch 
              id="quote-widget" 
              checked={widgetSettings.quoteWidget}
              onCheckedChange={(checked) => handleWidgetToggle('quoteWidget', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Controls */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{t("privacyControls", language)}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'رؤية الملف الشخصي' : 'Profile Visibility'}</span>
            <Switch 
              id="profile-visibility" 
              checked={privacySettings.profileVisibility}
              onCheckedChange={(checked) => handlePrivacyToggle('profileVisibility', checked)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'حالة النشاط' : 'Activity Status'}</span>
            <Switch 
              id="activity-status" 
              checked={privacySettings.activityStatus}
              onCheckedChange={(checked) => handlePrivacyToggle('activityStatus', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{t("deleteAccount", language)}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'ar' 
              ? 'حذف حسابك وجميع البيانات المرتبطة به بشكل دائم. لا يمكن التراجع عن هذا الإجراء.'
              : 'Permanently delete your account and all associated data. This action cannot be undone.'}
          </p>
          <Button variant="destructive">
            {language === 'ar' ? 'حذف حسابي' : 'Delete My Account'}
          </Button>
        </CardContent>
      </Card>

      {/* Save All Settings Button */}
      <Button 
        className="w-full mt-6 flex items-center gap-2" 
        onClick={handleSaveAllSettings}
        disabled={isSaving}
      >
        {isSaving ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {language === 'ar' ? 'حفظ جميع الإعدادات' : 'Save All Settings'}
      </Button>
      
      {/* Custom Quote Manager Dialog */}
      <CustomQuoteManager 
        open={customQuoteDialogOpen} 
        onOpenChange={setCustomQuoteDialogOpen}
        onUpdate={() => {
          // Refresh any state if needed after quotes are updated
          const updatedPrefs = getQuotePreferences();
          setQuotePreferences(updatedPrefs);
          updateSettings('quotes', updatedPrefs);
        }}
      />
    </div>
  );
}
