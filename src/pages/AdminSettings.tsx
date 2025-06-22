import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Sun, Moon, Languages, Save, Palette, Bell, Database, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage } = useTheme();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    autoBackup: true,
    maintenanceMode: false,
    debugMode: false,
    dataRetention: '90',
    sessionTimeout: '60'
  });

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    localStorage.setItem('admin_settings', JSON.stringify(settings));
    toast.success('Settings saved successfully');
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const handleLanguageToggle = () => {
    const newLanguage = language === 'en' ? 'ar' : 'en';
    setLanguage(newLanguage);
    toast.success(`Language switched to ${newLanguage === 'en' ? 'English' : 'العربية'}`);
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem('admin_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  return (
    <div className="bg-gradient-background text-foreground">
      <AdminHeader
        title="Admin Settings"
        subtitle="Configure admin panel preferences"
        icon={<Shield className="h-6 w-6 sm:h-8 sm:w-8 text-accent-blue" />}
      >
        <Button
          onClick={handleSaveSettings}
          className="btn-enhanced"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </AdminHeader>

      {/* Settings Content */}
      <div className="p-3 sm:p-6 max-w-4xl mx-auto pb-24 space-y-4 sm:space-y-6">
        {/* Appearance Settings */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading flex items-center">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-purple" />
              Appearance & Language
            </CardTitle>
            <CardDescription>Customize the look and feel of the admin panel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Theme Mode</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Choose between light and dark mode</div>
              </div>
              <div className="flex items-center space-x-3">
                <Sun className="h-4 w-4 text-accent-orange" />
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={handleThemeToggle}
                />
                <Moon className="h-4 w-4 text-accent-purple" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Language</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Admin panel interface language</div>
              </div>
              <div className="flex items-center space-x-3">
                <Languages className="h-4 w-4 text-accent-green" />
                <Button
                  variant="outline"
                  onClick={handleLanguageToggle}
                  className="min-w-24"
                >
                  {language === 'en' ? 'English' : 'العربية'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading flex items-center">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-orange" />
              Notifications
            </CardTitle>
            <CardDescription>Configure how you receive admin notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Email Notifications</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Receive admin alerts via email</div>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Push Notifications</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Browser push notifications for urgent alerts</div>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading flex items-center">
              <Database className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-blue" />
              System Configuration
            </CardTitle>
            <CardDescription>Manage system-wide admin settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Auto Backup</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Automatically backup admin data</div>
              </div>
              <Switch
                checked={settings.autoBackup}
                onCheckedChange={(checked) => handleSettingChange('autoBackup', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Maintenance Mode</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Put the app in maintenance mode</div>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Debug Mode</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Enable debug logging</div>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => handleSettingChange('debugMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Data Retention</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">How long to keep admin logs</div>
              </div>
              <Select 
                value={settings.dataRetention} 
                onValueChange={(value) => handleSettingChange('dataRetention', value)}
              >
                <SelectTrigger className="w-24 sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm sm:text-base font-medium">Session Timeout</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Admin session duration</div>
              </div>
              <Select 
                value={settings.sessionTimeout} 
                onValueChange={(value) => handleSettingChange('sessionTimeout', value)}
              >
                <SelectTrigger className="w-24 sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading flex items-center">
              <Key className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-green" />
              Security
            </CardTitle>
            <CardDescription>Admin security and access controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              <Key className="h-4 w-4 mr-2" />
              Change Admin Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              View Login History
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Database className="h-4 w-4 mr-2" />
              Export Admin Logs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
