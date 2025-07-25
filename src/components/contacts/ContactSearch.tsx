
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  relationship_status?: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
}

export function ContactSearch() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const t = {
    en: {
      findContacts: "Find Contacts",
      searchPlaceholder: "Search by username or display name",
      noResults: "No users found",
      connect: "Connect",
      pending: "Pending",
      connected: "Connected",
      blocked: "Blocked",
      cancel: "Cancel",
    },
    ar: {
      findContacts: "البحث عن جهات الاتصال",
      searchPlaceholder: "البحث بالاسم أو اسم المستخدم",
      noResults: "لم يتم العثور على مستخدمين",
      connect: "اتصال",
      pending: "معلق",
      connected: "متصل",
      blocked: "محظور",
      cancel: "إلغاء",
    }
  }[language];

  useEffect(() => {
    if (searchTerm.trim()) {
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    if (!user || !searchTerm.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', user.id)
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      // Check relationship status for each user
      const usersWithStatus = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: contactData } = await supabase
            .from('contacts')
            .select('status')
            .or(`and(user_id.eq.${user.id},contact_id.eq.${profile.id}),and(user_id.eq.${profile.id},contact_id.eq.${user.id})`)
            .single();

          const { data: blockedData } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('user_id', user.id)
            .eq('blocked_user_id', profile.id)
            .single();

          let relationshipStatus: UserProfile['relationship_status'] = 'none';
          
          if (blockedData) {
            relationshipStatus = 'blocked';
          } else if (contactData) {
            if (contactData.status === 'accepted') {
              relationshipStatus = 'accepted';
            } else if (contactData.status === 'pending') {
              relationshipStatus = 'pending_sent';
            }
          }

          return {
            ...profile,
            relationship_status: relationshipStatus
          };
        })
      );

      setSearchResults(usersWithStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (contactId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          contact_id: contactId,
          status: 'pending'
        });

      if (error) throw error;

      setSearchResults(prev => 
        prev.map(result => 
          result.id === contactId 
            ? { ...result, relationship_status: 'pending_sent' }
            : result
        )
      );
      toast.success('Contact request sent');
    } catch (error) {
      console.error('Error sending request:', error);
      toast.error('Failed to send request');
    }
  };

  const handleCancelRequest = async (contactId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_id', contactId)
        .eq('status', 'pending');

      if (error) throw error;

      setSearchResults(prev => 
        prev.map(result => 
          result.id === contactId 
            ? { ...result, relationship_status: 'none' }
            : result
        )
      );
      toast.success('Contact request cancelled');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          {t.findContacts}
        </CardTitle>
        <CardDescription>
          Search for users to connect with
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading && (
            <div className="text-center py-4">Searching...</div>
          )}

          {searchResults.length === 0 && searchTerm.trim() && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t.noResults}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={result.avatar_url} />
                      <AvatarFallback>
                        {result.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{result.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{result.username}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.relationship_status === 'none' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendRequest(result.id)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t.connect}
                      </Button>
                    )}
                    {result.relationship_status === 'pending_sent' && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{t.pending}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelRequest(result.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t.cancel}
                        </Button>
                      </div>
                    )}
                    {result.relationship_status === 'accepted' && (
                      <Badge variant="default" className="text-green-600">
                        <Check className="h-4 w-4 mr-1" />
                        {t.connected}
                      </Badge>
                    )}
                    {result.relationship_status === 'blocked' && (
                      <Badge variant="destructive">{t.blocked}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
