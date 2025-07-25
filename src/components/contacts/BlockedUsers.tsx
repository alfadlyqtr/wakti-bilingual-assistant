
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  blocked_at: string;
  blocked_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

export function BlockedUsers() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const t = {
    en: {
      blockedUsers: "Blocked Users",
      noBlockedUsers: "No blocked users",
      unblock: "Unblock",
      blockedAt: "Blocked at",
    },
    ar: {
      blockedUsers: "المستخدمون المحظورون",
      noBlockedUsers: "لا توجد مستخدمون محظورون",
      unblock: "إلغاء الحظر",
      blockedAt: "تم الحظر في",
    }
  }[language];

  useEffect(() => {
    if (user) {
      fetchBlockedUsers();
    }
  }, [user]);

  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocked_user:profiles!blocked_users_blocked_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      toast.error('Failed to fetch blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', user.id)
        .eq('blocked_user_id', blockedUserId);

      if (error) throw error;

      setBlockedUsers(prev => prev.filter(b => b.blocked_user_id !== blockedUserId));
      toast.success('User unblocked successfully');
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading blocked users...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t.blockedUsers}
        </CardTitle>
        <CardDescription>
          Manage users you have blocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blockedUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t.noBlockedUsers}
          </div>
        ) : (
          <div className="space-y-4">
            {blockedUsers.map((blockedUser) => (
              <div key={blockedUser.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={blockedUser.blocked_user.avatar_url} />
                    <AvatarFallback>
                      {blockedUser.blocked_user.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{blockedUser.blocked_user.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      @{blockedUser.blocked_user.username}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t.blockedAt} {new Date(blockedUser.blocked_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(blockedUser.blocked_user_id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.unblock}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
