import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { PageContainer } from '@/components/PageContainer';
import { Sun, Moon, Bell, CheckCircle } from 'lucide-react';
import { setupNotificationCron } from '@/utils/testNotifications';

export default function Settings() {
  const { user, updateProfile, updatePassword, deleteAccount } = useAuth();
  const { showSuccess, showError } = useToastHelper();
  const { language, theme, setTheme, setLanguage } = useTheme();

  const [profileData, setProfileData] = useState({
    displayName: '',
    fullName: '',
    avatarUrl: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUpNotifications, setIsSettingUpNotifications] = useState(false);
  const [notificationSetupComplete, setNotificationSetupComplete] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      setProfileData({
        displayName: user.user_metadata.display_name || '',
        fullName: user.user_metadata.full_name || '',
        avatarUrl: user.user_metadata.avatar_url || ''
      });
    }
  }, [user]);

  useEffect(() => {
    // Check if notification setup was already completed
    const setupComplete = localStorage.getItem('wakti-notification-setup-complete');
    setNotificationSetupComplete(setupComplete === 'true');
  }, []);

  const handleNotificationSetup = async () => {
    setIsSettingUpNotifications(true);
    try {
      const success = await setupNotificationCron();
      if (success) {
        showSuccess('Notification system set up successfully!');
        setNotificationSetupComplete(true);
        localStorage.setItem('wakti-notification-setup-complete', 'true');
      } else {
        showError('Failed to set up notification system. Please try again.');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      showError('An error occurred while setting up notifications.');
    } finally {
      setIsSettingUpNotifications(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.displayName.trim()) {
      showError('Display name is required');
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({
        user_metadata: {
          display_name: profileData.displayName,
          full_name: profileData.fullName,
          avatar_url: profileData.avatarUrl
        }
      });
      showSuccess('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      showError('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(passwordData.newPassword);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      showSuccess('Password updated successfully');
    } catch (error) {
      console.error('Password update error:', error);
      showError('Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteAccount();
      showSuccess('Account deleted successfully');
    } catch (error) {
      console.error('Account deletion error:', error);
      showError('Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('settings', language)}</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="account">{t('account', language)}</TabsTrigger>
            <TabsTrigger value="appearance">{t('appearance', language)}</TabsTrigger>
            <TabsTrigger value="notifications">{t('notifications', language)}</TabsTrigger>
            <TabsTrigger value="privacy">{t('privacy', language)}</TabsTrigger>
            <TabsTrigger value="about">{t('about', language)}</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Update your account details and profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Display Name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Full Name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="avatarUrl">Avatar URL</Label>
                    <Input
                      id="avatarUrl"
                      value={profileData.avatarUrl}
                      onChange={(e) => setProfileData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder="Avatar URL"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Account</CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAccount}
                  disabled={isLoading}
                >
                  Are you sure? Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('appearanceSettings', language)}</CardTitle>
                <CardDescription>{t('customizeYourAppearance', language)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between font-medium">
                  <span>{t('theme', language)}</span>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <Sun className="mr-2 h-4 w-4" />
                        {t('light', language)}
                      </SelectItem>
                      <SelectItem value="dark">
                        <Moon className="mr-2 h-4 w-4" />
                        {t('dark', language)}
                      </SelectItem>
                      <SelectItem value="system">
                        <Sun className="mr-2 h-4 w-4" />
                        <Moon className="mr-2 h-4 w-4" />
                        {t('system', language)}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              {!notificationSetupComplete && (
                <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Bell className="h-5 w-5" />
                      Setup Notification System
                    </CardTitle>
                    <CardDescription className="text-blue-600 dark:text-blue-400">
                      Set up the automatic notification processing system to receive real-time alerts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleNotificationSetup}
                      disabled={isSettingUpNotifications}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSettingUpNotifications ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Setting up...
                        </>
                      ) : (
                        <>
                          <Bell className="mr-2 h-4 w-4" />
                          Setup Notification System
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {notificationSetupComplete && (
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Notification system is active and running</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <NotificationSettings />
            </div>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('privacySettings', language)}</CardTitle>
                <CardDescription>{t('manageYourPrivacy', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Privacy settings content */}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('about', language)}</CardTitle>
                <CardDescription>{t('aboutDescription', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* About section content */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
