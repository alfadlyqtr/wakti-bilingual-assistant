
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { getQuotePreferences, saveQuotePreferences } from "@/utils/quoteService";
import { quotes } from "@/utils/dailyQuotes";
import { useToast } from "@/hooks/use-toast";
import { Check, Save, Settings, Upload, Camera, Image, Loader2 } from "lucide-react";
import { signOut, updateProfile, updateUserPassword, deleteUserAccount } from "@/utils/auth";
import { validateDisplayName } from "@/utils/validations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from "@/integrations/supabase/client";

export default function Account() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [quotePreferences, setQuotePreferences] = useState(getQuotePreferences());
  const [customQuoteDialogOpen, setCustomQuoteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const categories = Object.keys(quotes);
  const { toast, confirm } = useToast();
  const { showSuccess, showError } = useToastHelper();
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Account deletion states
  const [confirmDeleteInput, setConfirmDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  
  // Use real user data from auth context
  const [profile, setProfile] = useState({
    fullName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || "",
    username: user?.user_metadata?.username || user?.email?.split('@')[0] || "",
    email: user?.email || ""
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || "",
        username: user.user_metadata?.username || user.email?.split('@')[0] || "",
        email: user.email || ""
      });
      setDisplayName(user.user_metadata?.display_name || "");
      setAvatar(user.user_metadata?.avatar_url || "");
      if (user.user_metadata?.avatar_url) {
        setImagePreview(user.user_metadata?.avatar_url);
      }
    }
  }, [user]);

  // Handle quote category change
  const handleQuoteCategoryChange = (category: string) => {
    const newPreferences = { ...quotePreferences, category };
    setQuotePreferences(newPreferences);
    
    // Open dialog when custom is selected
    if (category === 'custom') {
      setCustomQuoteDialogOpen(true);
    }
  };

  const handleQuoteFrequencyChange = (frequency: string) => {
    setQuotePreferences(prev => ({ ...prev, frequency }));
  };

  const handleSaveSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ الإعدادات؟" : "Save settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ التغييرات؟" : "Are you sure you want to save changes?",
      onConfirm: () => {
        saveQuotePreferences(quotePreferences);
        // Store preferences in localStorage to ensure they're saved
        localStorage.setItem('quotePreferences', JSON.stringify(quotePreferences));
        
        // Show success toast
        toast({
          title: language === 'ar' ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully",
          description: "",
          variant: "default"
        });
      }
    });
  };

  const handleSaveAllSettings = () => {
    confirm({
      title: language === 'ar' ? "حفظ جميع الإعدادات؟" : "Save all settings?",
      description: language === 'ar' ? "هل أنت متأكد من أنك تريد حفظ جميع التغييرات؟" : "Are you sure you want to save all changes?",
      onConfirm: () => {
        // Save quote preferences
        saveQuotePreferences(quotePreferences);
        
        // Save widget settings and privacy settings to localStorage
        const widgetSettings = {
          calendarWidget: true,
          remindersWidget: true,
          quoteWidget: true,
          eventsWidget: true
        };
        
        const privacySettings = {
          autoApprove: false,
          activityStatus: true
        };
        
        localStorage.setItem('quotePreferences', JSON.stringify(quotePreferences));
        localStorage.setItem('widgetSettings', JSON.stringify(widgetSettings));
        localStorage.setItem('privacySettings', JSON.stringify(privacySettings));
        
        // Show success toast
        toast({
          title: language === 'ar' ? "تم حفظ جميع الإعدادات بنجاح" : "All settings saved successfully",
          description: "",
          variant: "default"
        });
      }
    });
  };

  // Enhanced profile changes with improved error handling
  const handleSaveProfile = async () => {
    if (!user) return;

    // Don't use confirm dialog for now, just proceed immediately
    setIsSaving(true);
    setUploadError(null);
    try {
      // Handle file upload if a new image was selected
      let avatarUrl = avatar;
      if (selectedFile) {
        try {
          // Generate a unique file name to prevent conflicts
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          
          console.log('Uploading avatar file:', fileName);
          
          // Create a storage object with the file
          const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, selectedFile, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (error) throw error;
          
          console.log('Avatar upload successful:', data);
          
          // Get the public URL for the uploaded file
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.path);
            
          console.log('Avatar public URL:', publicUrl);
          avatarUrl = publicUrl;
          
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          setUploadError((uploadError as Error).message || 'Failed to upload image');
          showError(language === 'ar' 
            ? 'فشل في تحميل الصورة' 
            : 'Failed to upload image');
          setIsSaving(false);
          return;
        }
      }
      
      console.log('Updating profile with data:', { 
        full_name: profile.fullName,
        avatar_url: avatarUrl
      });
      
      // Update user profile data with new avatar URL if available
      const { user: updatedUser, error } = await updateProfile({
        user_metadata: {
          full_name: profile.fullName,
          avatar_url: avatarUrl
        }
      });
      
      if (error) {
        throw error;
      }
      
      console.log('Profile update result:', updatedUser);
      
      if (updatedUser) {
        // Update local state with the new avatar URL
        setAvatar(avatarUrl);
        setImagePreview(avatarUrl);
        setSelectedFile(null);
        
        showSuccess(language === 'ar' 
          ? 'تم حفظ الملف الشخصي بنجاح' 
          : 'Profile saved successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showError((error as Error).message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle profile input changes
  const handleProfileChange = (field: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle profile picture upload with preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(language === 'ar' 
          ? 'يجب أن يكون حجم الملف أقل من 5 ميجابايت' 
          : 'File size must be less than 5MB');
        return;
      }
      
      // Validate file type
      const fileType = file.type.split('/')[0];
      if (fileType !== 'image') {
        setUploadError(language === 'ar' 
          ? 'يجب أن يكون الملف صورة' 
          : 'File must be an image');
        return;
      }
      
      setSelectedFile(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImagePreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Password Change Handling
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      setPasswordError(language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError(language === 'ar' ? 'كلمات المرور الجديدة غير متطابقة' : 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError(language === 'ar' ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' : 'New password must be at least 8 characters');
      return;
    }
    
    setIsChangingPassword(true);
    setPasswordError("");
    
    try {
      // First verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });
      
      if (signInError) {
        setPasswordError(language === 'ar' ? 'كلمة المرور الحالية غير صحيحة' : 'Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }
      
      // Now change the password
      const error = await updateUserPassword(newPassword);
      
      if (error) {
        setPasswordError(error.message);
      } else {
        showSuccess(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // Close the dialog by triggering the cancel button
        const cancelButton = document.querySelector('[data-password-cancel-button]') as HTMLButtonElement;
        if (cancelButton) cancelButton.click();
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError((error as Error).message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Account Deletion Handling
  const showDeleteAccountConfirmation = () => {
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Check if confirmation text matches email
    if (confirmDeleteInput.toLowerCase() !== user.email?.toLowerCase()) {
      showError(language === 'ar' ? 'البريد الإلكتروني غير متطابق' : 'Email does not match');
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const result = await deleteUserAccount();
      if (result.error) {
        showError(result.error.message);
      } else {
        // Show goodbye message and redirect to login
        showSuccess(language === 'ar' ? 'تم حذف الحساب بنجاح' : 'Account successfully deleted');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      showError((error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    confirm({
      title: language === 'ar' ? 'تسجيل الخروج' : 'Log Out',
      description: language === 'ar' ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to log out?',
      onConfirm: async () => {
        await signOut();
        navigate('/login');
      }
    });
  };

  // Get initials for avatar
  const getInitials = () => {
    if (!user) return "?";
    
    const name = user.user_metadata?.full_name || profile.fullName || user.email || "";
    if (!name) return "?";
    
    if (name.includes(' ')) {
      const [first, last] = name.split(' ');
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    
    return name.charAt(0).toUpperCase();
  };

  // File input reference for opening file dialog
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Function to trigger file upload dialog
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Check if there are changes to save - fixed version that properly detects changes
  const hasChanges = () => {
    // Check if a file has been selected for upload
    if (selectedFile) return true;
    
    // Check if fullName has changed
    if (user?.user_metadata?.full_name !== profile.fullName) return true;
    
    // No changes detected
    return false;
  };

  // Debug logging for button state
  const buttonDisabled = isSaving || !hasChanges();
  console.log('Save button state:', { 
    isSaving, 
    hasChanges: hasChanges(), 
    buttonDisabled,
    originalName: user?.user_metadata?.full_name,
    currentName: profile.fullName
  });

  return (
    <div className="p-4 pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-8">
          <TabsTrigger value="profile">
            {language === "ar" ? "الملف الشخصي" : "Profile"}
          </TabsTrigger>
          <TabsTrigger value="settings">
            {language === "ar" ? "الإعدادات" : "Settings"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Picture */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={handleUploadClick}>
                {imagePreview ? (
                  <AvatarImage src={imagePreview} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-secondary text-2xl font-bold">
                    {getInitials()}
                  </AvatarFallback>
                )}
              </Avatar>
              <Button
                size="sm"
                className="absolute -right-2 -bottom-1 rounded-full h-8 w-8 p-0"
                onClick={handleUploadClick}
                disabled={isSaving}
                aria-label="Upload profile picture"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
                aria-label="Upload profile picture"
              />
            </div>
          </div>
          
          {/* Display upload error if any */}
          {uploadError && (
            <div className="text-destructive text-sm text-center">
              {uploadError}
            </div>
          )}

          {/* Profile Form */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                {language === "ar" ? "الاسم الكامل" : "Full Name"}
              </label>
              <Input
                id="fullName"
                placeholder={
                  language === "ar" ? "أدخل اسمك الكامل" : "Enter your full name"
                }
                value={profile.fullName}
                onChange={(e) => handleProfileChange('fullName', e.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="username" className="text-sm font-medium">
                {t("username", language)}
              </label>
              <Input
                id="username"
                placeholder={
                  language === "ar"
                    ? "أدخل اسم المستخدم"
                    : "Enter your username"
                }
                value={profile.username}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                {language === "ar" 
                  ? "لا يمكن تغيير اسم المستخدم. يرجى التواصل مع الدعم إذا كنت بحاجة إلى تغييره." 
                  : "Username cannot be changed. Please contact support if you need to change it."}
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t("email", language)}
              </label>
              <Input
                id="email"
                type="email"
                placeholder={
                  language === "ar"
                    ? "أدخل بريدك الإلكتروني"
                    : "Enter your email"
                }
                value={profile.email}
                disabled
              />
            </div>

            <Button 
              className="w-full mt-4 flex items-center gap-2" 
              onClick={handleSaveProfile}
              disabled={buttonDisabled}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
            </Button>

            {/* Change Password Section */}
            <div className="grid gap-2 pt-4">
              <label className="text-sm font-medium">
                {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
              </label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {language === "ar" 
                        ? "أدخل كلمة المرور الحالية والجديدة أدناه." 
                        : "Enter your current and new password below."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    {passwordError && (
                      <div className="text-sm text-destructive mb-2">{passwordError}</div>
                    )}
                    <div className="grid gap-2">
                      <label htmlFor="currentPassword" className="text-sm font-medium">
                        {language === "ar" ? "كلمة المرور الحالية" : "Current Password"}
                      </label>
                      <Input 
                        id="currentPassword" 
                        type="password" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={isChangingPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="newPassword" className="text-sm font-medium">
                        {language === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                      </label>
                      <Input 
                        id="newPassword" 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isChangingPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="confirmPassword" className="text-sm font-medium">
                        {language === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
                      </label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isChangingPassword}
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-password-cancel-button>
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.preventDefault();
                        handlePasswordChange();
                      }}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {language === "ar" ? "تغيير" : "Change"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {/* Delete Account Button */}
            <div className="grid gap-2 pt-4">
              <label className="text-sm font-medium text-destructive">
                {language === "ar" ? "حذف الحساب" : "Delete Account"}
              </label>
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" onClick={showDeleteAccountConfirmation}>
                    {language === "ar" ? "حذف الحساب" : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {language === "ar" ? "حذف الحساب" : "Delete Account"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {language === "ar" 
                        ? "هذا الإجراء لا يمكن التراجع عنه. سيؤدي إلى حذف حسابك وجميع البيانات المرتبطة به بشكل دائم." 
                        : "This action cannot be undone. This will permanently delete your account and remove your data from our servers."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <label htmlFor="deleteReason" className="text-sm font-medium">
                        {language === "ar" ? "سبب الحذف (اختياري)" : "Reason for deletion (optional)"}
                      </label>
                      <Input 
                        id="deleteReason" 
                        placeholder={language === "ar" 
                          ? "يساعدنا هذا في تحسين خدماتنا" 
                          : "This helps us improve our services"
                        }
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        disabled={isDeleting}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <label htmlFor="confirmDelete" className="text-sm font-medium">
                        {language === "ar" 
                          ? `أدخل بريدك الإلكتروني (${user?.email}) للتأكيد` 
                          : `Type your email (${user?.email}) to confirm`
                        }
                      </label>
                      <Input 
                        id="confirmDelete" 
                        value={confirmDeleteInput}
                        onChange={(e) => setConfirmDeleteInput(e.target.value)}
                        disabled={isDeleting}
                        className="border-destructive focus:ring-destructive"
                      />
                    </div>
                  </div>
                  
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {language === "ar" ? "نعم، حذف الحساب" : "Yes, delete account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* Appearance Settings */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar" ? "ال��ظهر" : "Appearance"}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>{language === "ar" ? "اللغة" : "Language"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleLanguage}
                  className="h-9 px-3 rounded-full text-sm"
                >
                  {language === "en" ? "العربية" : "English"}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <span>{language === "ar" ? "السمة" : "Theme"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className="h-9 px-3 rounded-full text-sm"
                >
                  {theme === "dark"
                    ? (language === "ar" ? "الوضع الفاتح" : "Light Mode")
                    : (language === "ar" ? "الوضع الداكن" : "Dark Mode")}
                </Button>
              </div>
            </div>
          </Card>

          {/* Quote Widget Settings */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === 'ar' ? 'إعدادات الاقتباس اليومي' : 'Daily Quote Settings'}
            </h3>
            <div className="space-y-4">
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
                  {language === 'ar' ? 'تكرار تغيير الاقت��اس' : 'Quote Change Frequency'}
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
              
              <Button 
                className="w-full mt-4 flex items-center gap-2" 
                onClick={handleSaveSettings}
              >
                <Save className="h-4 w-4" />
                {language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
              </Button>

              {/* Button to manage custom quotes */}
              {quotePreferences.category === 'custom' && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setCustomQuoteDialogOpen(true)}
                >
                  {language === 'ar' ? 'إدارة الاقتباسات المخصصة' : 'Manage Custom Quotes'}
                </Button>
              )}
            </div>
          </Card>
          
          {/* Privacy Settings */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar" ? "إعدادات الخصوصية" : "Privacy Settings"}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {language === "ar"
                      ? "الموافقة التلقائية على الطلبات"
                      : "Auto-Approve Requests"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "قبول طلبات الاتصال تلقائيًا بدون مراجعة"
                      : "Accept connection requests automatically without review"}
                  </p>
                </div>
                <Switch id="auto-approve" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {language === "ar" ? "حالة النشاط" : "Activity Status"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "اعرض متى تكون نشطًا ع��ى التطبيق"
                      : "Show when you're active on the app"}
                  </p>
                </div>
                <Switch id="activity-status" defaultChecked />
              </div>
            </div>
          </Card>

          {/* Notification Settings */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar" ? "إعدادات الإشعارات" : "Notification Settings"}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>
                  {language === "ar" ? "إشعارات المهام" : "Task Notifications"}
                </span>
                <Switch id="task-notifications" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "إشعارات الفعاليات"
                    : "Event Notifications"}
                </span>
                <Switch id="event-notifications" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "إشعارات الرسائل"
                    : "Message Notifications"}
                </span>
                <Switch id="message-notifications" defaultChecked />
              </div>
            </div>
          </Card>

          {/* Widget Settings */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar"
                ? "إعدادات الأدوات المصغرة"
                : "Widget Settings"}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "أداة التقويم المصغرة"
                    : "Calendar Widget"}
                </span>
                <Switch id="calendar-widget" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "أداة التذكيرات المصغرة"
                    : "Reminders Widget"}
                </span>
                <Switch id="reminders-widget" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "أداة الاقتباس اليومي المصغرة"
                    : "Daily Quote Widget"}
                </span>
                <Switch id="quote-widget" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "أداة الفعاليات المصغرة"
                    : "Events Widget"}
                </span>
                <Switch id="events-widget" defaultChecked />
              </div>
            </div>
          </Card>

          {/* Billing Section */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar" ? "الفواتير والاشتراكات" : "Billing & Subscriptions"}
            </h3>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">
                    {language === "ar" ? "الخطة الحالية" : "Current Plan"}
                  </h4>
                  <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {language === "ar" ? "نشط" : "Active"}
                  </span>
                </div>
                <p className="text-xl font-bold mb-1">
                  {language === "ar" ? "الاشتراك السنوي" : "Annual Subscription"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "ar" ? "يتجدد في 15 يونيو 2025" : "Renews on June 15, 2025"}
                </p>
                <Button variant="outline" className="w-full">
                  {language === "ar" ? "إدارة الاشتراك" : "Manage Subscription"}
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>
                  {language === "ar" 
                    ? "يتم إدارة الاشتراكات من خلال Apple App Store أو Google Play Store." 
                    : "Subscriptions are managed through the Apple App Store or Google Play Store."}
                </p>
              </div>
            </div>
          </Card>

          {/* Blocked Users */}
          <Card className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {language === "ar" ? "المستخدمون المحظورون" : "Blocked Users"}
            </h3>
            <div className="text-center py-8 text-muted-foreground">
              <p>
                {language === "ar"
                  ? "لا يوجد مستخدمون محظورون"
                  : "No blocked users"}
              </p>
            </div>
            <Separator className="my-4" />
            <div className="hidden">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-secondary" />
                  <div>
                    <p className="font-medium">User Name</p>
                    <p className="text-sm text-muted-foreground">@username</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  {language === "ar" ? "إلغاء الحظر" : "Unblock"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Save All Settings Button */}
          <Button 
            className="w-full mt-6 flex items-center gap-2" 
            onClick={handleSaveAllSettings}
          >
            <Settings className="h-4 w-4" />
            {language === 'ar' ? 'حفظ جميع الإعدادات' : 'Save All Settings'}
          </Button>
        </TabsContent>
      </Tabs>

      {/* Custom Quote Manager Dialog */}
      <CustomQuoteManager 
        open={customQuoteDialogOpen} 
        onOpenChange={setCustomQuoteDialogOpen}
        onUpdate={() => {
          // Refresh the quotes if needed after changes
          const updatedPrefs = getQuotePreferences();
          setQuotePreferences(updatedPrefs);
        }}
      />
    </div>
  );
}
