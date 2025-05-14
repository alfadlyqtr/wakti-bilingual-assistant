
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { toast } from "sonner";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  
  const handleQuoteCategoryChange = (category: string) => {
    const newPreferences = { ...quotePreferences, category };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    toast.success(language === 'ar' ? "تم تحديث فئة الاقتباس" : "Quote category updated");
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    toast.success(language === 'ar' ? "تم تحديث تردد الاقتباس" : "Quote frequency updated");
  };
  
  return (
    <PageContainer title={t("settings", language)} showBackButton={true}>
      <div className="p-4 pb-20">
        {/* Language & Theme Settings */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-medium">{language === 'ar' ? 'المظهر' : 'Appearance'}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Language Toggle */}
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
                  <SelectItem value="motivational">
                    {language === 'ar' ? 'تحفيزي' : 'Motivational'}
                  </SelectItem>
                  <SelectItem value="islamic">
                    {language === 'ar' ? 'إسلامي' : 'Islamic'}
                  </SelectItem>
                  <SelectItem value="positive">
                    {language === 'ar' ? 'إيجابي' : 'Positive'}
                  </SelectItem>
                  <SelectItem value="health">
                    {language === 'ar' ? 'صحي' : 'Health'}
                  </SelectItem>
                  <SelectItem value="mixed">
                    {language === 'ar' ? 'متنوع' : 'Mixed'}
                  </SelectItem>
                  <SelectItem value="custom">
                    {language === 'ar' ? 'مخصص' : 'Custom'}
                  </SelectItem>
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
          </CardContent>
        </Card>

        {/* Custom Quotes Manager (show only when custom category is selected) */}
        {quotePreferences.category === 'custom' && (
          <CustomQuoteManager />
        )}

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
      </div>
    </PageContainer>
  );
}
