import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useLocation } from "react-router-dom";
import { t } from "@/utils/translations";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { quotes } from "@/utils/dailyQuotes";
import { Check, Save, Settings as SettingsIcon, Info } from "lucide-react";
import { updateAutoApproveContacts, getCurrentUserProfile } from "@/services/contactsService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TranslationKey } from "@/utils/translationTypes";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const location = useLocation();
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const categories = Object.keys(quotes);
  const { confirm } = useToast();
  const queryClient = useQueryClient();

  // Check if we came from Wakti AI page or are currently on it
  const isFromWaktiAI = location.pathname === '/wakti-ai' || 
                       (location.state as any)?.from === '/wakti-ai' ||
                       document.referrer.includes('/wakti-ai');

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  const autoApproveMutation = useMutation({
    mutationFn: (autoApprove: boolean) => updateAutoApproveContacts(autoApprove),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success(t("settingsUpdated", language), {
        description: t("contactSettingsUpdated", language)
      });
    },
    onError: (error) => {
      console.error("Error updating contact settings:", error);
      toast.error(t("error", language), {
        description: t("errorUpdatingSettings", language)
      });
    }
  });

  const handleAutoApproveToggle = (checked: boolean) => {
    console.log("Toggle auto-approve to:", checked);
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
    
    toast.success(t("quotePreferencesUpdated", language));
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    toast.success(t("quotePreferencesUpdated", language));
  };
  
  // Update the handleSaveAllSettings function to use the new confirm syntax
  const handleSaveAllSettings = () => {
    confirm({
      title: t("saveAllSettingsQuestion", language),
      description: t("saveAllSettingsConfirmation", language),
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
        
        toast.success(t("allSettingsSaved", language), {
          description: <Check className="h-4 w-4" />
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
    <div className="flex-1 overflow-y-auto py-6 pb-24 px-4">
      <h2 className="text-xl font-bold mb-4">{t("settings", language)}</h2>
      
      {/* Notice for Wakti AI restrictions - only for language */}
      {isFromWaktiAI && (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4" />
              <p className="text-sm">
                {language === 'ar' 
                  ? 'تغيير اللغة معطل أثناء استخدام WAKTI AI لضمان الاستقرار'
                  : 'Language changes are disabled while using WAKTI AI for stability'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Appearance Card */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("appearance", language)}</CardTitle>
          <CardDescription>{t("appearanceSettings", language)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language Settings - disabled on Wakti AI page */}
          <div className="flex justify-between items-center">
            <span>{t("language", language)}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isFromWaktiAI ? undefined : toggleLanguage}
                    className={cn(
                      "h-9 px-3 rounded-full text-sm",
                      isFromWaktiAI && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={isFromWaktiAI}
                  >
                    {language === "en" ? t("arabic", language) : t("english", language)}
                  </Button>
                </TooltipTrigger>
                {isFromWaktiAI && (
                  <TooltipContent>
                    <p>{language === 'ar' ? 'معطل أثناء استخدام WAKTI AI' : 'Disabled while using WAKTI AI'}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Theme Toggle - always functional */}
          <div className="flex justify-between items-center">
            <span>{t("theme", language)}</span>
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

      {/* Contacts Settings Card */}
      <Card className="mb-4">
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
              checked={userProfile?.auto_approve_contacts || false}
              onCheckedChange={handleAutoApproveToggle}
              disabled={isLoadingProfile || autoApproveMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quote Settings */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-medium">{t("dailyQuoteSettings", language)}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              {t("quoteCategory", language)}
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
                    {t(category as TranslationKey, language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              {t("quoteChangeFrequency", language)}
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
                  {t("twiceDaily", language)}
                </SelectItem>
                <SelectItem value="4xday">
                  {t("fourTimesDaily", language)}
                </SelectItem>
                <SelectItem value="6xday">
                  {t("sixTimesDaily", language)}
                </SelectItem>
                <SelectItem value="appStart">
                  {t("everyAppStart", language)}
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
              {t("manageCustomQuotes", language)}
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
            <span>{t("pushNotifications", language)}</span>
            <Switch defaultChecked id="push-notifications" />
          </div>
          <div className="flex justify-between items-center">
            <span>{t("emailNotifications", language)}</span>
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
            <span>{t("tasksWidget", language)}</span>
            <Switch defaultChecked id="tasks-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{t("calendarWidget", language)}</span>
            <Switch defaultChecked id="calendar-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{t("remindersWidget", language)}</span>
            <Switch defaultChecked id="reminders-widget" />
          </div>
          <div className="flex justify-between items-center">
            <span>{t("dailyQuoteWidget", language)}</span>
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
            <span>{t("profileVisibility", language)}</span>
            <Switch defaultChecked id="profile-visibility" />
          </div>
          <div className="flex justify-between items-center">
            <span>{t("activityStatus", language)}</span>
            <Switch defaultChecked id="activity-status" />
          </div>
        </CardContent>
      </Card>

      {/* Save All Settings Button */}
      <Button 
        className="w-full mt-6 flex items-center gap-2" 
        onClick={handleSaveAllSettings}
      >
        <Save className="h-4 w-4" />
        {t("saveAllSettings", language)}
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
