
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  
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
              <span>{theme === "dark" ? "Theme" : "السمة"}</span>
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
