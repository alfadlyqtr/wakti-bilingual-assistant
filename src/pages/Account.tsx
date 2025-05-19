
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

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  
  useEffect(() => {
    // Load user data
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
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    
    try {
      const data = { user_metadata: { full_name: name } };
      const { user: updatedUser, error } = await updateProfile(data);
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
  
  // Profile settings from the Settings page
  const profileSettings = [
    { 
      id: "notificationPrefs", 
      title: language === 'ar' ? "إشعارات" : "Notifications", 
      description: language === 'ar' ? "تفضيلات الإشعارات" : "Notification preferences" 
    },
    { 
      id: "privacySettings", 
      title: language === 'ar' ? "خصوصية" : "Privacy", 
      description: language === 'ar' ? "إعدادات الخصوصية" : "Privacy settings" 
    },
    { 
      id: "languagePrefs", 
      title: language === 'ar' ? "لغة" : "Language", 
      description: language === 'ar' ? "تفضيلات اللغة" : "Language preferences" 
    }
  ];
  
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
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? "إعدادات الحساب" : "Account Settings"}</CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? "إدارة تفضيلات وإعدادات حسابك."
                    : "Manage your account preferences and settings."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {profileSettings.map((setting) => (
                  <div key={setting.id} className="border-b border-border pb-4 last:border-0">
                    <h3 className="font-medium text-lg">{setting.title}</h3>
                    <p className="text-muted-foreground text-sm mb-3">{setting.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Button size="sm" variant="outline">
                          {language === 'ar' ? "تعديل" : "Edit"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? "الخصوصية والأمان" : "Privacy & Security"}</CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? "إدارة الخصوصية وإعدادات الأمان لحسابك."
                    : "Manage your account's privacy and security settings."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline">
                  {language === 'ar' ? "تغيير إعدادات الخصوصية" : "Change Privacy Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
