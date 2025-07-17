import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { UserPlus, MessageCircle, Search, Check, X, Heart, Users, Mail, Star, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface Contact {
  id: string;
  created_at: string;
  user_id: string;
  contact_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  profile: {
    id: string;
    username: string;
    avatar_url: string;
    email: string;
  };
}

interface Profile {
  id: string;
  updated_at: string;
  username: string;
  avatar_url: string;
  email: string;
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactNote, setNewContactNote] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadPerContact } = useUnreadMessages();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchContacts = async () => {
      setLoading(true);
      try {
        // Fetch accepted contacts
        const { data: acceptedContacts, error: acceptedError } = await supabase
          .from('contacts')
          .select(`
            id, created_at, user_id, contact_id, status,
            profile:profiles!inner(id, username, avatar_url, email)
          `)
          .eq('user_id', user.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (acceptedError) {
          throw acceptedError;
        }

        // Fetch contacts where current user is the contact_id (accepted)
        const { data: acceptedContactsAsContact, error: acceptedContactsAsContactError } = await supabase
          .from('contacts')
          .select(`
            id, created_at, user_id, contact_id, status,
            profile:profiles!inner(id, username, avatar_url, email)
          `)
          .eq('contact_id', user.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (acceptedContactsAsContactError) {
          throw acceptedContactsAsContactError;
        }

        // Fetch pending contact requests
        const { data: pendingContacts, error: pendingError } = await supabase
          .from('contacts')
          .select(`
            id, created_at, user_id, contact_id, status,
            profile:profiles!inner(id, username, avatar_url, email)
          `)
          .eq('contact_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pendingError) {
          throw pendingError;
        }

        // Fetch all profiles for adding contacts
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id);

        if (profilesError) {
          throw profilesError;
        }

        const allContacts = [
          ...(acceptedContacts || []),
          ...(acceptedContactsAsContact || []),
          ...(pendingContacts || [])
        ];

        setContacts(allContacts);
        setProfiles(profilesData || []);
      } catch (error: any) {
        console.error('Error fetching contacts:', error);
        toast.error(`Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [user, navigate]);

  const filteredContacts = contacts.filter(contact => {
    const username = contact.profile?.username || '';
    return username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddContact = async () => {
    setIsAddingContact(true);
  };

  const handleSendContactRequest = async () => {
    if (!user) {
      toast.error('Please log in to send contact requests.');
      return;
    }

    try {
      // Validate email
      if (!newContactEmail) {
        throw new Error('Email is required.');
      }

      // Check if the email exists in profiles
      const profile = profiles.find(p => p.email === newContactEmail);
      if (!profile) {
        throw new Error('No user found with this email.');
      }

      // Check if the contact request already exists
      const { data: existingRequest } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('contact_id', profile.id)
        .single();

      if (existingRequest) {
        throw new Error('Contact request already sent.');
      }

      // Send contact request
      const { error } = await supabase
        .from('contacts')
        .insert([
          { user_id: user.id, contact_id: profile.id, status: 'pending', note: newContactNote }
        ]);

      if (error) {
        throw error;
      }

      toast.success('Contact request sent successfully!');
      setContacts(prevContacts => [
        ...prevContacts,
        {
          id: 'temp-' + Date.now(),
          created_at: new Date().toISOString(),
          user_id: user.id,
          contact_id: profile.id,
          status: 'pending',
          profile: profile as any
        }
      ]);
    } catch (error: any) {
      console.error('Error sending contact request:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsAddingContact(false);
      setNewContactEmail('');
      setNewContactNote('');
    }
  };

  const handleAcceptRequest = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'accepted' })
        .eq('id', contactId);

      if (error) {
        throw error;
      }

      // Optimistically update the UI
      setContacts(prevContacts =>
        prevContacts.map(contact =>
          contact.id === contactId ? { ...contact, status: 'accepted' } : contact
        )
      );

      toast.success('Contact request accepted!');
    } catch (error: any) {
      console.error('Error accepting contact request:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleRejectRequest = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) {
        throw error;
      }

      // Optimistically update the UI
      setContacts(prevContacts => prevContacts.filter(contact => contact.id !== contactId));

      toast.success('Contact request rejected.');
    } catch (error: any) {
      console.error('Error rejecting contact request:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <Button onClick={handleAddContact}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>

        <Input
          type="search"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />

        {loading ? (
          <p>Loading contacts...</p>
        ) : (
          <div className="space-y-4">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <Card key={contact.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Avatar>
                        <AvatarImage src={contact.profile?.avatar_url} alt={contact.profile?.username} />
                        <AvatarFallback>{contact.profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {contact.profile?.username}
                      {contact.status === 'pending' && (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      <Mail className="mr-2 inline-block h-4 w-4" />
                      {contact.profile?.email}
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      {contact.status === 'pending' && contact.contact_id === user?.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAcceptRequest(contact.id)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectRequest(contact.id)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/messages/${contact.profile.id}`)}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Message
                          {unreadPerContact[contact.profile.id] > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              {unreadPerContact[contact.profile.id]}
                            </Badge>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent>No contacts found.</CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={isAddingContact} onOpenChange={() => setIsAddingContact(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="note" className="text-right">
                  Note
                </Label>
                <Textarea
                  id="note"
                  value={newContactNote}
                  onChange={(e) => setNewContactNote(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <Button onClick={handleSendContactRequest}>Send Contact Request</Button>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Contacts;
