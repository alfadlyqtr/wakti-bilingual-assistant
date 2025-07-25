
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserProfile } from '@/services/contactsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { ProfileImageUpload } from '@/components/ProfileImageUpload';
import { AccountCountrySection } from '@/components/AccountCountrySection';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

export default function Account() {
  const { user, signOut } = useAuth();
  const { language } = useTheme();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    email: '',
    first_name: '',
    last_name: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profileData = await getCurrentUserProfile(user.id);
      setProfile(profileData);
      setFormData({
        display_name: profileData?.display_name || '',
        username: profileData?.username || '',
        email: profileData?.email || user.email || '',
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: t('error', language),
        description: t('errorLoadingProfile', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: t('success', language),
        description: t('profileUpdated', language)
      });

      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('error', language),
        description: t('errorUpdatingProfile', language),
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = window.confirm(t('confirmDeleteAccount', language));
    if (!confirmed) return;

    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id }
      });

      if (error) throw error;

      toast({
        title: t('success', language),
        description: t('accountDeleted', language)
      });

      signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingAccount', language),
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t('loading', language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('account', language)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfileImageUpload currentImageUrl={profile?.avatar_url} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display_name">{t('displayName', language)}</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder={t('enterDisplayName', language)}
              />
            </div>
            <div>
              <Label htmlFor="username">{t('username', language)}</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={t('enterUsername', language)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">{t('email', language)}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">{t('firstName', language)}</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder={t('enterFirstName', language)}
              />
            </div>
            <div>
              <Label htmlFor="last_name">{t('lastName', language)}</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder={t('enterLastName', language)}
              />
            </div>
          </div>

          <AccountCountrySection />

          <div className="flex gap-4">
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? t('updating', language) : t('updateProfile', language)}
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-destructive">
              {t('dangerZone', language)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('deleteAccountWarning', language)}
            </p>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              {t('deleteAccount', language)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
