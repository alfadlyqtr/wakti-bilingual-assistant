
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer } from '@/components/PageContainer';

export default function Account() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    display_name: '',
    username: '',
    first_name: '',
    last_name: ''
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, username, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setProfileData({
          display_name: profile.display_name || '',
          username: profile.username || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error(t('errorLoadingProfile', language));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileData.display_name,
          username: profileData.username,
          first_name: profileData.first_name,
          last_name: profileData.last_name
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(t('profileUpdated', language));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('errorUpdatingProfile', language));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(t('confirmDeleteAccount', language))) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.admin.deleteUser(user?.id || '');
      
      if (error) throw error;

      toast.success(t('accountDeleted', language));
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(t('errorDeletingAccount', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="display_name">{t('displayName', language)}</Label>
                <Input
                  id="display_name"
                  value={profileData.display_name}
                  onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                  placeholder={t('enterDisplayName', language)}
                />
              </div>

              <div>
                <Label htmlFor="username">{t('username', language)}</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  placeholder={t('enterUsername', language)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">{t('firstName', language)}</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                    placeholder={t('enterFirstName', language)}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">{t('lastName', language)}</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                    placeholder={t('enterLastName', language)}
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? t('updating', language) : t('updateProfile', language)}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">{t('dangerZone', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('deleteAccountWarning', language)}
            </p>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={loading}
            >
              {t('deleteAccount', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
