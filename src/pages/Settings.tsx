import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { PageContainer } from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
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
import { Languages } from "@/integrations/i18n/settings";
import { supabase } from "@/integrations/supabase/client";
import { BillingTab } from "@/components/BillingTab";
import { FawranPaymentStatus } from "@/components/FawranPaymentStatus";

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user, updateUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [displayName, setDisplayName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || "");
    }
  }, [user]);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
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
        toast({
          title: "Error",
          description: "Failed to update profile",
          variant: "destructive",
        });
        return;
      }

      await updateUserProfile();

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between space-y-2 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t.settings.title}
            </h2>
            <p className="text-muted-foreground">{t.settings.description}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="account">{t.settings.account}</TabsTrigger>
            <TabsTrigger value="billing">{t.settings.billing}</TabsTrigger>
            <TabsTrigger value="preferences">{t.settings.preferences}</TabsTrigger>
            <TabsTrigger value="notifications">{t.settings.notifications}</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.accountSettings}</CardTitle>
                <CardDescription>
                  {t.settings.manageAccountSettings}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.settings.displayName}</Label>
                  <Input
                    id="name"
                    placeholder={t.settings.displayNamePlaceholder}
                    value={displayName}
                    onChange={handleDisplayNameChange}
                  />
                </div>
                <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? t.common.updating : t.settings.updateProfile}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.preferences}</CardTitle>
                <CardDescription>
                  {t.settings.managePreferences}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t.settings.theme}</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder={t.settings.selectTheme} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t.settings.light}</SelectItem>
                      <SelectItem value="dark">{t.settings.dark}</SelectItem>
                      <SelectItem value="system">{t.settings.system}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">{t.settings.language}</Label>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder={t.settings.selectLanguage} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(Languages).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.notifications}</CardTitle>
                <CardDescription>
                  {t.settings.manageNotifications}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t.settings.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.emailDescription}
                    </p>
                  </div>
                  <Switch id="email-notifications" defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t.settings.push}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.pushDescription}
                    </p>
                  </div>
                  <Switch id="push-notifications" defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingTab />
            
            {/* Add Payment Status Section */}
            <div className="mt-8">
              <FawranPaymentStatus />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
