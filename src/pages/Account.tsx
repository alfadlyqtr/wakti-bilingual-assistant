
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '@/services/contactsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Calendar, MapPin, Shield, Trash2, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileImageUpload } from '@/components/ProfileImageUpload';
import { AccountCountrySection } from '@/components/AccountCountrySection';
import { useTheme } from '@/providers/ThemeProvider';

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword } = useAuth();
  const { language } = useTheme();
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    display_name: '',
    username: '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);

  const t = {
    en: {
      account: "Account",
      profile: "Profile Information",
      displayName: "Display Name",
      username: "Username",
      email: "Email",
      joinedOn: "Joined on",
      security: "Security",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      updateProfile: "Update Profile",
      updatePassword: "Update Password",
      deleteAccount: "Delete Account",
      danger: "Danger Zone",
      subscription: "Subscription",
      active: "Active",
      inactive: "Inactive",
      country: "Country",
    },
    ar: {
      account: "الحساب",
      profile: "معلومات الملف الشخصي",
      displayName: "الاسم المعروض",
      username: "اسم المستخدم",
      email: "البريد الإلكتروني",
      joinedOn: "انضم في",
      security: "الأمان",
      changePassword: "تغيير كلمة المرور",
      currentPassword: "كلمة المرور الحالية",
      newPassword: "كلمة المرور الجديدة",
      confirmPassword: "تأكيد كلمة المرور",
      save: "حفظ",
      cancel: "إلغاء",
      edit: "تحرير",
      updateProfile: "تحديث الملف الشخصي",
      updatePassword: "تحديث كلمة المرور",
      deleteAccount: "حذف الحساب",
      danger: "منطقة الخطر",
      subscription: "الاشتراك",
      active: "نشط",
      inactive: "غير نشط",
      country: "البلد",
    }
  }[language];

  // Fix the React Query usage
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      return await contactsService.getProfile(user.id);
    },
    enabled: !!user?.id,
  });

  React.useEffect(() => {
    if (profile) {
      setProfileData({
        display_name: profile.display_name || '',
        username: profile.username || '',
        email: profile.email || user?.email || '',
      });
    }
  }, [profile, user]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await updateProfile({
        full_name: profileData.display_name,
      });

      if (error) throw error;

      // Update the profile in the database
      await contactsService.updateProfile(user.id, {
        display_name: profileData.display_name,
        username: profileData.username,
      });

      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { error } = await updatePassword(passwordData.new);

      if (error) throw error;

      setPasswordData({ current: '', new: '', confirm: '' });
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Loading account...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t.account}</h1>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t.profile}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => editing ? setEditing(false) : setEditing(true)}
            >
              {editing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <ProfileImageUpload />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={profile?.is_subscribed ? "default" : "secondary"}>
                  {profile?.is_subscribed ? t.active : t.inactive}
                </Badge>
                <Badge variant="outline">{profile?.subscription_status || 'none'}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {t.joinedOn} {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">{t.displayName}</Label>
              <Input
                id="display_name"
                value={profileData.display_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t.username}</Label>
              <Input
                id="username"
                value={profileData.username}
                onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              disabled
              className="bg-muted"
            />
          </div>

          <AccountCountrySection />

          {editing && (
            <div className="flex gap-2">
              <Button onClick={handleUpdateProfile} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {t.save}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                {t.cancel}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t.security}
          </CardTitle>
          <CardDescription>{t.changePassword}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">{t.currentPassword}</Label>
            <Input
              id="current_password"
              type="password"
              value={passwordData.current}
              onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_password">{t.newPassword}</Label>
            <Input
              id="new_password"
              type="password"
              value={passwordData.new}
              onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">{t.confirmPassword}</Label>
            <Input
              id="confirm_password"
              type="password"
              value={passwordData.confirm}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
            />
          </div>
          <Button onClick={handleUpdatePassword} disabled={loading}>
            <Shield className="h-4 w-4 mr-2" />
            {t.updatePassword}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
