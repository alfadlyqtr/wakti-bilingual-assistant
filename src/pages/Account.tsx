
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
import { Save, Check } from "lucide-react";
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { useToast } from "@/hooks/use-toast";
import { quotes } from "@/utils/dailyQuotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateAutoApproveContacts, getCurrentUserProfile } from "@/services/contactsService";
import { t } from "@/utils/translations";

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
        toast(language === 'ar' ? "فشل تحديث الاسم" : "Failed to update name");
      } else {
        toast.success(language === 'ar' ? "تم تحديث الملف الشخصي" : "Profile updated successfully");
      }
    } catch (error) {
      toast(language === 'ar' ? "فشل تحديث الملف الشخصي" : "Failed to update profile");
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
        toast(language === 'ar' ? "فشل تحديث البريد الإلكتروني" : "Failed to update email");
      } else {
        toast.success(language === 'ar' ? "تم تحديث البريد الإلكتروني" : "Email updated successfully");
      }
    } catch (error) {
      toast(language === 'ar' ? "فشل تحديث البريد الإلكتروني" : "Failed to update email");
    } finally {
      setIsUpdatingEmail(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast(language === 'ar' ? "كلمات السر غير متطابقة" : "Passwords do not match");
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      const error = await updatePassword(password);
      if (error) {
        toast(language === 'ar' ? "فشل تحديث كلمة المرور" : "Failed to update password");
      } else {
        toast.success(language === 'ar' ? "تم تحديث كلمة المرور" : "Password updated successfully");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast(language === 'ar' ? "فشل تحديث كلمة المرور" : "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleSignout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast(language === 'ar' ? "فشل تسجيل الخروج" : "Failed to sign out");
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
    
    toast.success(language === 'ar' ? "تم تحديث فئة الاقتباس" : "Quote category updated");
  };
  
  const handleQuoteFrequencyChange = (frequency: string) => {
    const newPreferences = { ...quotePreferences, frequency };
    setQuotePreferences(newPreferences);
    saveQuotePreferences(newPreferences);
    
    toast.success(language === 'ar' ? "تم تحديث تردد الاقتباس" : "Quote frequency updated");
  };
  
  const handleSaveAllSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ جميع الإعدادات؟" : "Save all settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ جميع التغييرات؟" : "Are you sure you want to save all changes?",
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
        
        toast.success(language === 'ar' ? "تم حفظ جميع الإعدادات" : "All settings saved", {
          description: <Check className="h-4 w-4" />
        });
      }
    });
  };
  
  return (
    <PageContainer showHeader={false}>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {language === 'ar' ? "حسابي" : "My Account"}
        </h1>
        
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="account">
              {language === 'ar' ? "الحساب" : "Account"}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {language === 'ar' ? "الإعدادات" : "Settings"}
            </TabsTrigger>
          </TabsList>
          
          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? "الملف الشخصي" : "Profile"}</CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? "إدارة معلومات الملف الشخصي الخاص بك."
                    : "Manage your profile information."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProfileImageUpload />
                
                {/* Username - Read-only */}
                <div className="grid gap-2">
                  <Label htmlFor="username">{language === 'ar' ? "اسم المستخدم" : "Username"}</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' 
                      ? "اسم المستخدم للحساب الخاص بك. لا يمكن تغييره."
                      : "Your account username. Cannot be changed."}
                  </p>
                </div>
                
                {/* Name */}
                <form onSubmit={handleUpdateProfile}>
                  <div className="grid gap-2">
                    <Label htmlFor="name">{language === 'ar' ? "الاسم" : "Name"}</Label>
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
                        ? language === 'ar'
                          ? "جاري التحديث..."
                          : "Updating..."
                        : language === 'ar'
                          ? "تحديث الاسم"
                          : "Update Name"}
                    </Button>
                  </div>
                </form>

                {/* Email */}
                <form onSubmit={handleUpdateEmail} className="pt-4 border-t border-border">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{language === 'ar' ? "البريد الإلكتروني" : "Email"}</Label>
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
                        ? language === 'ar'
                          ? "جاري التحديث..."
                          : "Updating..."
                        : language === 'ar'
                          ? "تحديث البريد الإلكتروني"
                          : "Update Email"}
                    </Button>
                  </div>
                </form>

                {/* Password */}
                <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-border">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="password">{language === 'ar' ? "كلمة المرور" : "Password"}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">{language === 'ar' ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
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
                        ? language === 'ar'
                          ? "جاري التحديث..."
                          : "Updating..."
                        : language === 'ar'
                          ? "تحديث كلمة المرور"
                          : "Update Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? "خيارات الحساب" : "Account Options"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleSignout}
                >
                  {language === 'ar' ? "تسجيل الخروج" : "Sign Out"}
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
                  <span>{language === "en" ? "Language" : "اللغة"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLanguage}
                    className="h-9 px-3 rounded-full text-sm"
                  >
                    {language === "en" ? "العربية" : "English"}
                  </Button>
                </div>
                
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
                <CardTitle>{language === 'ar' ? 'إعدادات الاقتباس اليومي' : 'Daily Quote Settings'}</CardTitle>
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
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {language === 'ar' ? 
                            (
                              category === 'motivational' ? 'تحفيزي' : 
                              category === 'islamic' ? 'إسلامي' : 
                              category === 'positive' ? 'إيجابي' : 
                              category === 'health' ? 'صحي' : 
                              category === 'mixed' ? 'متنوع' : 
                              category === 'custom' ? 'مخصص' :
                              category === 'productivity' ? 'إنتاجية' :
                              category === 'discipline' ? 'انضباط' :
                              category === 'gratitude' ? 'امتنان' :
                              category === 'leadership' ? 'قيادة' :
                              category
                            ) : 
                            (
                              category.charAt(0).toUpperCase() + category.slice(1)
                            )
                          }
                        </SelectItem>
                      ))}
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

            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("notificationPreferences", language)}</CardTitle>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("widgetVisibility", language)}</CardTitle>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("privacyControls", language)}</CardTitle>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("deleteAccount", language)}</CardTitle>
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

            {/* Save All Settings Button */}
            <Button 
              className="w-full mt-6 flex items-center gap-2" 
              onClick={handleSaveAllSettings}
            >
              <Save className="h-4 w-4" />
              {language === 'ar' ? 'حفظ جميع الإعدادات' : 'Save All Settings'}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
