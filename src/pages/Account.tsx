import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Save, Check, AlertTriangle } from "lucide-react";
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { useToast } from "@/hooks/use-toast";
import { quotes } from "@/utils/dailyQuotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateAutoApproveContacts, getCurrentUserProfile } from "@/services/contactsService";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { deleteUserAccount } from "@/utils/auth";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const { confirm } = useToast();
  const queryClient = useQueryClient();
  
  // Account tab states
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  
  // Delete account states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  
  // Settings tab states
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const categories = Object.keys(quotes);
  
  // Fetch user profile data
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  // Auto approve contacts mutation
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

  // Load user data
  useEffect(() => {
    if (user) {
      if (user.user_metadata?.full_name) {
        setName(user.user_metadata.full_name);
      }
      if (user.email) {
        setEmail(user.email);
      }
      // Set username from metadata or user id
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
      setLoadingUserData(false);
    }
  }, [user]);
  
  // Account Form Handlers
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    
    try {
      const { user: updatedUser, error } = await updateProfile({
        user_metadata: { full_name: name }
      });
      if (error) {
        toast(t("errorUpdatingName", language));
      } else {
        toast.success(t("profileUpdated", language));
      }
    } catch (error) {
      toast(t("errorUpdatingProfile", language));
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);
    
    try {
      const error = await updateEmail(email);
      if (error) {
        toast(t("errorUpdatingEmail", language));
      } else {
        toast.success(t("emailUpdated", language));
      }
    } catch (error) {
      toast(t("errorUpdatingEmail", language));
    } finally {
      setIsUpdatingEmail(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast(t("passwordsDoNotMatch", language));
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      const error = await updatePassword(password);
      if (error) {
        toast(t("errorUpdatingPassword", language));
      } else {
        toast.success(t("passwordUpdated", language));
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast(t("errorUpdatingPassword", language));
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleSignout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast(t("errorSigningOut", language));
    }
  };
  
  // Settings tab handlers
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
    
    toast.success(t("quotePreferencesUpdated", language));
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    toast.success(t("quotePreferencesUpdated", language));
  };
  
  const handleSaveAllSettings = () => {
    confirm({
      title: t("saveAllSettingsQuestion", language),
      description: t("saveAllSettingsConfirmation", language),
      onConfirm: () => {
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
  
  // Delete Account handlers
  const openDeleteDialog = () => {
    setConfirmationEmail("");
    setIsDeleteDialogOpen(true);
  };
  
  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };
  
  const handleConfirmEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmationEmail(e.target.value);
  };
  
  const isEmailMatch = () => {
    return confirmationEmail === user?.email;
  };
  
  const openDeleteConfirmDialog = () => {
    if (isEmailMatch()) {
      setDeleteConfirmDialogOpen(true);
    } else {
      toast.error(t("error", language), {
        description: "Email does not match your account email."
      });
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!isEmailMatch()) {
      toast.error(t("error", language), {
        description: "Email does not match your account email."
      });
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const { error } = await deleteUserAccount();
      
      if (error) {
        toast.error(t("error", language), {
          description: error.message || "Failed to delete account"
        });
      } else {
        toast.success("Account deleted successfully");
        // Signout will be automatic since the account is deleted
        navigate("/login");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(t("error", language), {
        description: "An unexpected error occurred"
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmDialogOpen(false);
      setIsDeleteDialogOpen(false);
    }
  };
  
  return (
    <PageContainer showHeader={false}>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {t("account", language)}
        </h1>
        
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="account">
              {t("account", language)}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {t("settings", language)}
            </TabsTrigger>
          </TabsList>
          
          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("profile", language)}</CardTitle>
                <CardDescription>
                  {t("profileManagement", language)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProfileImageUpload />
                
                {/* Username - Read-only */}
                <div className="grid gap-2">
                  <Label htmlFor="username">{t("username", language)}</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("usernameHelpText", language)}
                  </p>
                </div>
                
                {/* Name */}
                <form onSubmit={handleUpdateProfile}>
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t("name", language)}</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loadingUserData || isUpdatingProfile}
                    />
                  </div>
                  <div className="mt-4">
                    <Button 
                      disabled={isUpdatingProfile || loadingUserData} 
                      type="submit"
                    >
                      {isUpdatingProfile
                        ? t("updating", language)
                        : t("updateName", language)}
                    </Button>
                  </div>
                </form>

                {/* Email */}
                <form onSubmit={handleUpdateEmail} className="pt-4 border-t border-border">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t("email", language)}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loadingUserData || isUpdatingEmail}
                    />
                  </div>
                  <div className="mt-4">
                    <Button 
                      disabled={isUpdatingEmail || loadingUserData} 
                      type="submit"
                    >
                      {isUpdatingEmail
                        ? t("updating", language)
                        : t("updateEmail", language)}
                    </Button>
                  </div>
                </form>

                {/* Password */}
                <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-border">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="password">{t("password", language)}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">{t("confirmPassword", language)}</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isUpdatingPassword}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button 
                      disabled={isUpdatingPassword}
                      type="submit"
                    >
                      {isUpdatingPassword
                        ? t("updating", language)
                        : t("updatePassword", language)}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t("accountOptions", language)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="destructive" 
                  onClick={handleSignout}
                >
                  {t("logout", language)}
                </Button>
              </CardContent>
            </Card>
            
            {/* Delete Account Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t("deleteAccount", language)}
                </CardTitle>
                <CardDescription>
                  {t("deleteAccountDescription", language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={openDeleteDialog}
                  className="w-full sm:w-auto"
                >
                  {t("deleteMyAccount", language)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Settings Tab - Integrated from Settings.tsx */}
          <TabsContent value="settings" className="space-y-6">
            {/* Appearance Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t("appearance", language)}</CardTitle>
                <CardDescription>{t("appearanceSettings", language)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme & Language Toggles */}
                <div className="flex justify-between items-center">
                  <span>{t("language", language)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLanguage}
                    className="h-9 px-3 rounded-full text-sm"
                  >
                    {language === "en" ? t("arabic", language) : t("english", language)}
                  </Button>
                </div>
                
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

            {/* Contact Settings */}
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("dailyQuoteSettings", language)}</CardTitle>
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
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("notificationPreferences", language)}</CardTitle>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("widgetVisibility", language)}</CardTitle>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("privacyControls", language)}</CardTitle>
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
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Delete Account Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("deleteAccount", language)}
            </DialogTitle>
            <DialogDescription>
              {t("deleteAccountDescription", language)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium">
              To confirm deletion, please type your email address:
            </p>
            <Input
              value={confirmationEmail}
              onChange={handleConfirmEmailChange}
              placeholder={user?.email || "Your email address"}
              className="w-full"
            />
            
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. All your data, including profile information, tasks, events, and messages will be permanently deleted.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              {t("cancel", language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={openDeleteConfirmDialog}
              disabled={!isEmailMatch() || isDeleting}
            >
              {t("deleteMyAccount", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Final Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete your account? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmDialogOpen(false)}
              disabled={isDeleting}
            >
              {t("cancel", language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
