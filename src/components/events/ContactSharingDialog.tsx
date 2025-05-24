
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { LoadingSpinner } from '@/components/ui/loading';

interface Contact {
  id: string;
  display_name: string;
  username: string;
  avatar_url?: string;
}

interface ContactSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export default function ContactSharingDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle
}: ContactSharingDialogProps) {
  const { language } = useTheme();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch user's contacts
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          contact_id,
          profiles!contacts_contact_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userData.user.id)
        .eq('status', 'approved');

      if (error) {
        console.error('Error fetching contacts:', error);
        return [];
      }

      return (data || []).map(contact => ({
        id: contact.contact_id,
        display_name: contact.profiles?.display_name || contact.profiles?.username || 'Unknown',
        username: contact.profiles?.username || '',
        avatar_url: contact.profiles?.avatar_url
      }));
    },
    enabled: open
  });

  // Send invitations mutation
  const sendInvitationsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const invitations = contactIds.map(contactId => ({
        event_id: eventId,
        inviter_id: userData.user.id,
        invitee_id: contactId,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('event_invitations')
        .insert(invitations);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invitations sent successfully');
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setSelectedContacts([]);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error sending invitations:', error);
      toast.error('Error sending invitations');
    }
  });

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSendInvitations = () => {
    if (selectedContacts.length === 0) {
      toast.error('Please select contacts to invite');
      return;
    }
    sendInvitationsMutation.mutate(selectedContacts);
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share with Contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select contacts to invite to "{eventTitle}"
          </p>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts found</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md">
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => handleContactToggle(contact.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar_url || ""} />
                    <AvatarFallback>{getInitials(contact.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{contact.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendInvitations}
              disabled={selectedContacts.length === 0 || sendInvitationsMutation.isPending}
              className="flex-1"
            >
              {sendInvitationsMutation.isPending && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Send Invitations ({selectedContacts.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
