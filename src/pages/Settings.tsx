
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

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const categories = Object.keys(quotes);
  const { confirm } = useToast();
  const queryClient = useQueryClient();

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

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
      variant: "success"
    });
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    toast({
      title: language === 'ar' ? "تم تحديث تردد الاقتباس" : "Quote frequency updated",
      variant: "success"
    });
  };
  
  // Update the handleSaveAllSettings function to use the new confirm syntax
  const handleSaveAllSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ جميع الإعدادات؟" : "Save all settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ جميع التغييرات؟" : "Are you sure you want to save all changes?",
      onConfirm: () => {
        // Already saving on change, but we can add additional save logic here
        // Save widget visibility settings
        const widgetSettings = {
          tasksWidget: true,
          calendarWidget: true,
          remindersWidget: true,
          quoteWidget: true
        };
        
        localStorage.setItem('widgetSettings', JSON.stringify(widgetSettings));
        localStorage.setItem('quotePreferences', JSON.stringify(quotePreferences));
        
        toast({
          title: language === 'ar' ? "تم حفظ جميع الإعدادات" : "All settings saved",
          description: <Check className="h-4 w-4" />, // Use description to show the icon
          variant: "success"
        });
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
    <div className="container py-6 pb-24 space-y-6">
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
            <Switch defaultChecked id="push-notifications" />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}</span>
            <Switch id="email-notifications" />
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
            <Switch defaultChecked id="tasks-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة التقويم المصغرة' : 'Calendar Widget'}</span>
            <Switch defaultChecked id="calendar-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة التذكيرات المصغرة' : 'Reminders Widget'}</span>
            <Switch defaultChecked id="reminders-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'أداة الاقتباس اليومي المصغرة' : 'Daily Quote Widget'}</span>
            <Switch defaultChecked id="quote-widget" />
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
            <Switch defaultChecked id="profile-visibility" />
          </div>
          <div className="flex justify-between items-center">
            <span>{language === 'ar' ? 'حالة النشاط' : 'Activity Status'}</span>
            <Switch defaultChecked id="activity-status" />
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
      >
        <Save className="h-4 w-4" />
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
