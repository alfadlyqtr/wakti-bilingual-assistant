
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
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import { t } from "@/utils/translations";

export default function Settings() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("appearance");
  const [displayName, setDisplayName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Widget visibility settings
  const [widgetSettings, setWidgetSettings] = useState({
    showTasksWidget: true,
    showCalendarWidget: true,
    showEventsWidget: true,
    showQuoteWidget: true,
    showMaw3dWidget: true,
    showTRWidget: true,
  });

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || "");
      loadWidgetSettings();
    }
  }, [user]);

  const loadWidgetSettings = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user?.id)
        .single();

      if (profile?.settings?.widgets) {
        setWidgetSettings(prev => ({
          ...prev,
          ...profile.settings.widgets
        }));
      }
    } catch (error) {
      console.error('Error loading widget settings:', error);
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

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
        },
      });

      if (error) {
        console.error("Error updating profile:", error);
        toast.error(t("errorUpdatingSettings", language));
        return;
      }

      toast.success(t("settingsUpdated", language));
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || t("errorUpdatingSettings", language));
    } finally {
      setIsUpdating(false);
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

      toast.success(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error updating widget setting:', error);
      toast.error(t("errorUpdatingSettings", language));
      // Revert the change
      setWidgetSettings(widgetSettings);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between space-y-2 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("settings", language)}
            </h2>
            <p className="text-muted-foreground">
              {language === "ar" ? "إدارة إعدادات التطبيق" : "Manage your app settings"}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="appearance">{t("appearance", language)}</TabsTrigger>
            <TabsTrigger value="notifications">{t("notifications", language)}</TabsTrigger>
            <TabsTrigger value="dashboard">
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
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {language === "ar" ? "الاسم المعروض" : "Display Name"}
                  </Label>
                  <Input
                    id="name"
                    placeholder={language === "ar" ? "أدخل اسمك المعروض" : "Enter your display name"}
                    value={displayName}
                    onChange={handleDisplayNameChange}
                  />
                </div>
                <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? (language === "ar" ? "جاري التحديث..." : "Updating...") : (language === "ar" ? "تحديث الملف الشخصي" : "Update Profile")}
                </Button>

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
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
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
                      {language === "ar" ? "أداة المهام" : "Tasks Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض المهام الأخيرة" : "Show recent tasks"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showTasksWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showTasksWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "أداة التقويم" : "Calendar Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض الأحداث القادمة" : "Show upcoming events"}
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
                      {language === "ar" ? "أداة الأحداث" : "Events Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض الأحداث المنشأة" : "Show created events"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showEventsWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showEventsWidget', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {language === "ar" ? "أداة الاقتباس" : "Quote Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض الاقتباس اليومي" : "Show daily quote"}
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
                      {language === "ar" ? "أداة مواعيد" : "Maw3d Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض أحداث مواعيد" : "Show Maw3d events"}
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
                      {language === "ar" ? "أداة المهام والتذكيرات" : "Tasks & Reminders Widget"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "عرض المهام والتذكيرات" : "Show tasks and reminders"}
                    </p>
                  </div>
                  <Switch 
                    checked={widgetSettings.showTRWidget}
                    onCheckedChange={(checked) => updateWidgetSetting('showTRWidget', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Privacy Settings Section */}
        <div className="mt-8">
          <PrivacySettings />
        </div>
      </div>
    </PageContainer>
  );
}
