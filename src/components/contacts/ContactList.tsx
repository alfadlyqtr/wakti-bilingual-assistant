
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, UserMinus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ChatPopup } from './ChatPopup';
import { ContactRelationshipIndicator } from './ContactRelationshipIndicator';
import { useTheme } from '@/providers/ThemeProvider';

interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  contact: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

export function ContactList() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const t = {
    en: {
      myContacts: "My Contacts",
      noContacts: "No contacts yet",
      message: "Message",
      remove: "Remove",
      block: "Block",
      accepted: "Connected",
      pending: "Pending",
      blocked: "Blocked",
    },
    ar: {
      myContacts: "جهات الاتصال",
      noContacts: "لا توجد جهات اتصال بعد",
      message: "رسالة",
      remove: "إزالة",
      block: "حظر",
      accepted: "متصل",
      pending: "معلق",
      blocked: "محظور",
    }
  }[language];

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact:profiles!contacts_contact_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_id', contactId);

      if (error) throw error;

      setContacts(prev => prev.filter(c => c.contact_id !== contactId));
      toast.success('Contact removed successfully');
    } catch (error) {
      console.error('Error removing contact:', error);
      toast.error('Failed to remove contact');
    }
  };

  const handleBlockContact = async (contactId: string) => {
    if (!user) return;

    try {
      // Remove from contacts and add to blocked users
      const { error: removeError } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_id', contactId);

      if (removeError) throw removeError;

      const { error: blockError } = await supabase
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: contactId
        });

      if (blockError) throw blockError;

      setContacts(prev => prev.filter(c => c.contact_id !== contactId));
      toast.success('Contact blocked successfully');
    } catch (error) {
      console.error('Error blocking contact:', error);
      toast.error('Failed to block contact');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading contacts...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t.myContacts}</CardTitle>
          <CardDescription>
            Your connected contacts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.noContacts}
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={contact.contact.avatar_url} />
                      <AvatarFallback>
                        {contact.contact.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{contact.contact.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{contact.contact.username}
                      </div>
                      <ContactRelationshipIndicator
                        userId={user.id}
                        contactId={contact.contact_id}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContact(contact)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {t.message}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveContact(contact.contact_id)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      {t.remove}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBlockContact(contact.contact_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {t.block}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedContact && (
        <ChatPopup
          contact={selectedContact.contact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </>
  );
}
