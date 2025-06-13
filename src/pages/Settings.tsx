import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToastHelper } from '@/components/ui/toast-helper';
import { signOut, updateProfile, updateUserPassword, deleteUserAccount } from '@/utils/auth';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bell } from 'lucide-react';
import NotificationSettings from '@/components/notifications/NotificationSettings';

export default function Settings() {
  const { language, theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState("account");
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { toast } = useToastHelper();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleProfileUpdate = async () => {
    setIsSavingProfile(true);
    try {
      const result = await updateProfile({
        user_metadata: {
          display_name: displayName,
          full_name: fullName,
          avatar_url: avatarUrl
        }
      });

      if (result.error) {
        toast({
          title: t('error', language),
          description: result.error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('success', language),
          description: t('profileUpdated', language)
        });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    setIsChangingPassword(true);
    if (newPassword !== confirmPassword) {
      toast({
        title: t('error', language),
        description: t('passwordsDoNotMatch', language),
        variant: 'destructive'
      });
      setIsChangingPassword(false);
      return;
    }

    try {
      const result = await updateUserPassword(currentPassword, newPassword);
      if (result.error) {
        toast({
          title: t('error', language),
          description: result.error.message || t('passwordUpdateFailed', language),
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('success', language),
          description: t('passwordUpdated', language)
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const result = await deleteUserAccount();
      if (result.error) {
        toast({
          title: t('error', language),
          description: result.error.message || t('accountDeletionFailed', language),
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('success', language),
          description: t('accountDeleted', language)
        });
        navigate('/register');
      }
    } catch (error: any) {
      toast({
        title: t('error', language),
        description: error.message || t('accountDeletionFailed', language),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 scrollbar-hide bg-gradient-background min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            {t('settingsTitle', language)}
          </h1>
          <p className="text-muted-foreground">{t('settingsDesc', language)}</p>
        </div>

        {/* Settings Sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-gradient-card/50 backdrop-blur-lg border border-border/50">
            <TabsTrigger value="account" className="text-xs">{t('account', language)}</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs">{t('appearance', language)}</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">{t('notifications', language)}</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs">{t('privacy', language)}</TabsTrigger>
            <TabsTrigger value="quotes" className="text-xs">{t('quotes', language)}</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs">{t('billing', language)}</TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('accountSettings', language)}</CardTitle>
                <CardDescription>{t('manageYourAccount', language)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="display_name">{t('displayName', language)}</Label>
                  <Input
                    id="display_name"
                    placeholder={t('displayName', language)}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="full_name">{t('fullName', language)}</Label>
                  <Input
                    id="full_name"
                    placeholder={t('fullName', language)}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="avatar_url">{t('avatarURL', language)}</Label>
                  <Input
                    id="avatar_url"
                    placeholder={t('avatarURL', language)}
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>
                <Button onClick={handleProfileUpdate} disabled={isSavingProfile}>
                  {isSavingProfile ? t('saving', language) + '...' : t('saveProfile', language)}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('changePassword', language)}</CardTitle>
                <CardDescription>{t('updateYourPassword', language)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="current_password">{t('currentPassword', language)}</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new_password">{t('newPassword', language)}</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm_password">{t('confirmPassword', language)}</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
                  {isChangingPassword ? t('changingPassword', language) + '...' : t('changePassword', language)}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle className="text-destructive">{t('deleteAccount', language)}</CardTitle>
                <CardDescription>{t('permanentlyDeleteAccount', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">{t('deleteAccount', language)}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('areYouSure', language)}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('accountDeletionWarning', language)}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel', language)}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount}>{t('delete', language)}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('signOut', language)}</CardTitle>
                <CardDescription>{t('signOutDescription', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleSignOut}>{t('signOut', language)}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
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

          {/* Notifications Tab - NEW */}
          <TabsContent value="notifications">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('notificationSettings', language)}
                </CardTitle>
                <CardDescription>
                  {t('notificationSettingsDesc', language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
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

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('quotesSettings', language)}</CardTitle>
                <CardDescription>{t('customizeYourQuotes', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Quotes settings content */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <Card className="bg-gradient-card/40 backdrop-blur-lg border-border/40">
              <CardHeader>
                <CardTitle>{t('billingSettings', language)}</CardTitle>
                <CardDescription>{t('manageYourBilling', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Billing settings content */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
