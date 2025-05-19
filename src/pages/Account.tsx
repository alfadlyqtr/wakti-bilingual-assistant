
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

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  const [name, setName] = useState("");
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
      setLoadingUserData(false);
    }
  }, [user]);
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    
    try {
      const data = { user_metadata: { full_name: name } };
      const { error } = await updateProfile(data);
      if (error) {
        toast.error(language === 'ar' ? "فشل تحديث الاسم" : "Failed to update name");
      } else {
        toast.success(language === 'ar' ? "تم تحديث الملف الشخصي" : "Profile updated successfully");
      }
    } catch (error) {
      toast.error(language === 'ar' ? "فشل تحديث الملف الشخصي" : "Failed to update profile");
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
        toast.error(language === 'ar' ? "فشل تحديث البريد الإلكتروني" : "Failed to update email");
      } else {
        toast.success(language === 'ar' ? "تم تحديث البريد الإلكتروني" : "Email updated successfully");
      }
    } catch (error) {
      toast.error(language === 'ar' ? "فشل تحديث البريد الإلكتروني" : "Failed to update email");
    } finally {
      setIsUpdatingEmail(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error(language === 'ar' ? "كلمات السر غير متطابقة" : "Passwords do not match");
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      const error = await updatePassword(password);
      if (error) {
        toast.error(language === 'ar' ? "فشل تحديث كلمة المرور" : "Failed to update password");
      } else {
        toast.success(language === 'ar' ? "تم تحديث كلمة المرور" : "Password updated successfully");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast.error(language === 'ar' ? "فشل تحديث كلمة المرور" : "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleSignout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast.error(language === 'ar' ? "فشل تسجيل الخروج" : "Failed to sign out");
    }
  };
  
  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? "حسابي" : "My Account"}</CardTitle>
          <CardDescription>{language === 'ar' ? "إدارة معلومات حسابك وتفضيلاتك." : "Manage your account information and preferences."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form onSubmit={handleUpdateProfile}>
            <div className="grid gap-2">
              <Label htmlFor="name">{language === 'ar' ? "الاسم" : "Name"}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loadingUserData}
              />
            </div>
            <CardFooter className="pt-4">
              <Button disabled={isUpdatingProfile} type="submit">
                {isUpdatingProfile
                  ? language === 'ar'
                    ? "جاري التحديث..."
                    : "Updating..."
                  : language === 'ar'
                    ? "تحديث الاسم"
                    : "Update Name"}
              </Button>
            </CardFooter>
          </form>
          <form onSubmit={handleUpdateEmail}>
            <div className="grid gap-2">
              <Label htmlFor="email">{language === 'ar' ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loadingUserData}
              />
            </div>
            <CardFooter className="pt-4">
              <Button disabled={isUpdatingEmail} type="submit">
                {isUpdatingEmail
                  ? language === 'ar'
                    ? "جاري التحديث..."
                    : "Updating..."
                  : language === 'ar'
                    ? "تحديث البريد الإلكتروني"
                    : "Update Email"}
              </Button>
            </CardFooter>
          </form>
          <form onSubmit={handleUpdatePassword}>
            <div className="grid gap-2">
              <Label htmlFor="password">{language === 'ar' ? "كلمة المرور" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">{language === 'ar' ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <CardFooter className="pt-4">
              <Button disabled={isUpdatingPassword} type="submit">
                {isUpdatingPassword
                  ? language === 'ar'
                    ? "جاري التحديث..."
                    : "Updating..."
                  : language === 'ar'
                    ? "تحديث كلمة المرور"
                    : "Update Password"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button variant="destructive" onClick={handleSignout}>
            {language === 'ar' ? "تسجيل الخروج" : "Sign Out"}
          </Button>
        </CardFooter>
      </Card>
    </PageContainer>
  );
}
