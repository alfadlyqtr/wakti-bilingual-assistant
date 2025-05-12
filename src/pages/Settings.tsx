
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const navigate = useNavigate();
  
  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("settings", language)}</h1>
        </div>
        <UserMenu userName="John Doe" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Language & Theme Settings */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-medium">Appearance</h2>
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
              <span>Push Notifications</span>
              <Switch defaultChecked id="push-notifications" />
            </div>
            <div className="flex justify-between items-center">
              <span>Email Notifications</span>
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
              <span>Tasks Widget</span>
              <Switch defaultChecked id="tasks-widget" />
            </div>
            <div className="flex justify-between items-center">
              <span>Calendar Widget</span>
              <Switch defaultChecked id="calendar-widget" />
            </div>
            <div className="flex justify-between items-center">
              <span>Reminders Widget</span>
              <Switch defaultChecked id="reminders-widget" />
            </div>
            <div className="flex justify-between items-center">
              <span>Daily Quote Widget</span>
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
              <span>Profile Visibility</span>
              <Switch defaultChecked id="profile-visibility" />
            </div>
            <div className="flex justify-between items-center">
              <span>Activity Status</span>
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
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button variant="destructive">Delete My Account</Button>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
}
