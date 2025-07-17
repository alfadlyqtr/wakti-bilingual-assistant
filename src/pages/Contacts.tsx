
import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { toast } from 'sonner';
import { UserPlus, MessageSquare, Check, X, Search, Users } from 'lucide-react';

interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  profile: {
    id: string;
    username: string;
    avatar_url: string;
    email: string;
  };
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Contact[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetchContacts();
    fetchPendingRequests();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          user_id,
          contact_id,
          created_at,
          status,
          profiles!contacts_contact_id_fkey (
            id,
            username,
            avatar_url,
            email
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;

      // Fix the type mapping - profiles comes as an array but we expect an object
      const formattedContacts = data?.map(contact => ({
        ...contact,
        profile: contact.profiles as any
      })) || [];

      setContacts(formattedContacts);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          user_id,
          contact_id,
          created_at,
          status,
          profiles!contacts_user_id_fkey (
            id,
            username,
            avatar_url,
            email
          )
        `)
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Fix the type mapping - profiles comes as an array but we expect an object
      const formattedRequests = data?.map(request => ({
        ...request,
        profile: request.profiles as any
      })) || [];

      setPendingRequests(formattedRequests);
    } catch (error: any) {
      console.error('Error fetching pending requests:', error);
      toast.error('Failed to load pending requests');
    }
  };

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .ilike('email', `%${searchEmail}%`)
        .neq('id', user?.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const sendContactRequest = async (contactId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .insert([
          {
            user_id: user.id,
            contact_id: contactId,
            status: 'pending'
          }
        ]);

      if (error) throw error;
      
      toast.success('Contact request sent!');
      setSearchResults([]);
      setSearchEmail('');
    } catch (error: any) {
      console.error('Error sending contact request:', error);
      toast.error('Failed to send contact request');
    }
  };

  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;
      
      if (status === 'accepted') {
        toast.success('Contact request accepted!');
        fetchContacts();
      } else {
        toast.success('Contact request rejected');
      }
      
      fetchPendingRequests();
    } catch (error: any) {
      console.error('Error responding to request:', error);
      toast.error('Failed to respond to request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="container mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Contacts</h1>
          <p className="text-muted-foreground">Manage your contacts and connection requests.</p>
        </div>

        <Tabs defaultValue="contacts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              My Contacts ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Add Contact
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            {contacts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No contacts yet. Start by adding some!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {contacts.map((contact) => (
                  <Card key={contact.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={contact.profile?.avatar_url} />
                            <AvatarFallback>
                              {contact.profile?.username?.charAt(0) || contact.profile?.email?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{contact.profile?.username || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{contact.profile?.email}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={request.profile?.avatar_url} />
                            <AvatarFallback>
                              {request.profile?.username?.charAt(0) || request.profile?.email?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{request.profile?.username || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{request.profile?.email}</p>
                            <Badge variant="outline">Pending Request</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => respondToRequest(request.id, 'accepted')}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => respondToRequest(request.id, 'rejected')}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Contact</CardTitle>
                <CardDescription>Search for users by email address to send connection requests.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  />
                  <Button onClick={searchUsers} disabled={searchLoading}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Search Results</h3>
                    {searchResults.map((result) => (
                      <Card key={result.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={result.avatar_url} />
                                <AvatarFallback>
                                  {result.username?.charAt(0) || result.email?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{result.username || 'Unknown User'}</p>
                                <p className="text-sm text-muted-foreground">{result.email}</p>
                              </div>
                            </div>
                            <Button size="sm" onClick={() => sendContactRequest(result.id)}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Add Contact
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Contacts;
