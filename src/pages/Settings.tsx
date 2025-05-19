
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
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { toast } from "@/components/ui/use-toast";
import { useToast } from "@/hooks/use-toast";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { quotes } from "@/utils/dailyQuotes";
import { Check, Save, Settings as SettingsIcon } from "lucide-react";
import { updateAutoApproveContacts, getCurrentUserProfile } from "@/services/contactsService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Interface for widget settings
interface WidgetSettings {
  tasksWidget: boolean;
  calendarWidget: boolean;
  remindersWidget: boolean;
  quoteWidget: boolean;
}

// Interface for notification settings
interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
}

// Interface for privacy settings
interface PrivacySettings {
  profileVisibility: boolean;
  activityStatus: boolean;
}

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const categories = Object.keys(quotes);
  const { confirm } = useToast();
  const queryClient = useQueryClient();
  
  // Get widget settings from localStorage or use defaults
  const getWidgetSettings = (): WidgetSettings => {
    try {
      const storedSettings = localStorage.getItem('widgetVisibility');
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Error loading widget settings:', error);
    }
    
    // Default settings if nothing is stored
    return {
      tasksWidget: true,
      calendarWidget: true,
      remindersWidget: true,
      quoteWidget: true
    };
  };
  
  // Get notification settings from localStorage or use defaults
  const getNotificationSettings = (): NotificationSettings => {
    try {
      const storedSettings = localStorage.getItem('notificationSettings');
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
    
    // Default settings if nothing is stored
    return {
      pushNotifications: true,
      emailNotifications: false
    };
  };
  
  // Get privacy settings from localStorage or use defaults
  const getPrivacySettings = (): PrivacySettings => {
    try {
      const storedSettings = localStorage.getItem('privacySettings');
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
    
    // Default settings if nothing is stored
    return {
      profileVisibility: true,
      activityStatus: true
    };
  };
  
  // Initialize state for all settings
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>(getWidgetSettings());
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(getPrivacySettings());
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    setWidgetSettings(getWidgetSettings());
    setNotificationSettings(getNotificationSettings());
    setPrivacySettings(getPrivacySettings());
  }, []);

  // Save widget settings to localStorage and broadcast change
  const saveWidgetSettings = (newSettings: WidgetSettings) => {
    localStorage.setItem('widgetVisibility', JSON.stringify(newSettings));
    // Dispatch storage event to notify other components
    window.dispatchEvent(new Event('storage'));
  };
  
  // Save notification settings to localStorage
  const saveNotificationSettings = (newSettings: NotificationSettings) => {
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('storage'));
  };
  
  // Save privacy settings to localStorage
  const savePrivacySettings = (newSettings: PrivacySettings) => {
    localStorage.setItem('privacySettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('storage'));
  };

  // Save all settings to Supabase
  const saveSettingsToSupabase = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          settings: {
            widgets: widgetSettings,
            notifications: notificationSettings,
            privacy: privacySettings,
            quotes: quotePreferences
          }
        })
        .eq('id', userProfile?.id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error saving settings to Supabase:', error);
      return false;
    }
  };

  const autoApproveMutation = useMutation({
    mutationFn: (autoApprove: boolean) => updateAutoApproveContacts(autoApprove),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast({
        title: t("settingsUpdated", language),
        description: t("contactSettingsUpdated", language)
      });
    },
    onError: (error) => {
      console.error("Error updating contact settings:", error);
      toast({
        title: t("error", language),
        description: t("errorUpdatingSettings", language),
        variant: "destructive"
      });
    }
  });

  // Widget setting handlers
  const handleWidgetToggle = (widgetKey: keyof WidgetSettings, checked: boolean) => {
    const updatedSettings = { ...widgetSettings, [widgetKey]: checked };
    setWidgetSettings(updatedSettings);
    saveWidgetSettings(updatedSettings);
    
    toast({
      title: checked 
        ? t("widgetEnabled", language) 
        : t("widgetDisabled", language),
      description: t(widgetKey as any, language),
      variant: "default"
    });
  };
  
  // Notification setting handlers
  const handleNotificationToggle = (settingKey: keyof NotificationSettings, checked: boolean) => {
    const updatedSettings = { ...notificationSettings, [settingKey]: checked };
    setNotificationSettings(updatedSettings);
    saveNotificationSettings(updatedSettings);
    
    toast({
      title: t("settingsUpdated", language),
      description: t("notificationSettingsUpdated", language),
      variant: "default"
    });
  };
  
  // Privacy setting handlers
  const handlePrivacyToggle = (settingKey: keyof PrivacySettings, checked: boolean) => {
    const updatedSettings = { ...privacySettings, [settingKey]: checked };
    setPrivacySettings(updatedSettings);
    savePrivacySettings(updatedSettings);
    
    toast({
      title: t("settingsUpdated", language),
      description: t("privacySettingsUpdated", language),
      variant: "default"
    });
  };

  const handleAutoApproveToggle = (checked: boolean) => {
    autoApproveMutation.mutate(checked);
  };

  const handleQuoteCategoryChange = (category: string) => {
    const newPreferences = { ...quotePreferences, category };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    // Open dialog when custom is selected
    if (category === 'custom') {
      setCustomQuoteDialogOpen(true);
    }
    
    toast({
      title: language === 'ar' ? "تم تحديث فئة الاقتباس" : "Quote category updated",
      variant: "default"
    });
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    toast({
      title: language === 'ar' ? "تم تحديث تردد الاقتباس" : "Quote frequency updated",
      variant: "default"
    });
  };
  
  // Save all settings
  const handleSaveAllSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ جميع الإعدادات؟" : "Save all settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ جميع التغييرات؟" : "Are you sure you want to save all changes?",
      onConfirm: async () => {
        setIsSettingsSaving(true);
        
        try {
          // Save all settings to localStorage
          saveWidgetSettings(widgetSettings);
          saveNotificationSettings(notificationSettings);
          savePrivacySettings(privacySettings);
          saveQuotePreferences(quotePreferences);
          
          // Save settings to Supabase if the user is logged in
          if (userProfile?.id) {
            await saveSettingsToSupabase();
          }
          
          toast({
            title: language === 'ar' ? "تم حفظ جميع الإعدادات" : "All settings saved",
            description: <Check className="h-4 w-4" />,
            variant: "success"
          });
        } catch (error) {
          console.error('Error saving settings:', error);
          toast({
            title: language === 'ar' ? "خطأ في حفظ الإعدادات" : "Error saving settings",
            description: language === 'ar' ? "حدث خطأ أثناء حفظ الإعدادات. يرجى المحاولة مرة أخرى." : "An error occurred while saving settings. Please try again.",
            variant: "destructive"
          });
        } finally {
          setIsSettingsSaving(false);
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
          <h2 className="text-lg font-medium">{language === 'ar' ? 'إعدادات الاقتبا�� اليومي' : 'Daily Quote Settings'}</h2>
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
        disabled={isSettingsSaving}
      >
        {isSettingsSaving ? (
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
        }}
      />
    </div>
  );
}
