
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

interface ContactRequest {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

export function ContactRequests() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const t = {
    en: {
      contactRequests: "Contact Requests",
      noRequests: "No pending requests",
      accept: "Accept",
      reject: "Reject",
      from: "From",
      requestedAt: "Requested",
    },
    ar: {
      contactRequests: "طلبات الاتصال",
      noRequests: "لا توجد طلبات معلقة",
      accept: "قبول",
      reject: "رفض",
      from: "من",
      requestedAt: "طُلب في",
    }
  }[language];

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          user:profiles!contacts_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to fetch contact requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    if (!user) return;

    try {
      // Update the request status
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create the reverse relationship
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          contact_id: userId,
          status: 'accepted'
        });

      if (insertError) throw insertError;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Contact request accepted');
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Contact request rejected');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {t.contactRequests}
        </CardTitle>
        <CardDescription>
          Pending contact requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t.noRequests}
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={request.user.avatar_url} />
                    <AvatarFallback>
                      {request.user.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{request.user.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      @{request.user.username}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t.requestedAt} {new Date(request.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcceptRequest(request.id, request.user_id)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t.accept}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectRequest(request.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t.reject}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
