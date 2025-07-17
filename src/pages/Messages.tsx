
import React, { useState, useEffect, useRef } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { Send, ArrowLeft, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  is_read: boolean;
}

interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  profile: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

const Messages = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showContactList, setShowContactList] = useState(true);
  const messageListRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { refetch } = useUnreadMessages();

  useEffect(() => {
    const checkIsMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
      setShowContactList(window.innerWidth >= 768);
    };

    checkIsMobileView();
    window.addEventListener('resize', checkIsMobileView);

    return () => {
      window.removeEventListener('resize', checkIsMobileView);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select(`
            id,
            user_id,
            contact_id,
            created_at,
            status,
            profiles!contacts_contact_id_fkey (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (contactsError) {
          throw new Error(contactsError.message);
        }

        if (contactsData) {
          // Fix the type mapping - profiles comes as an array but we expect an object
          const formattedContacts = contactsData.map(contact => ({
            ...contact,
            profile: contact.profiles as any
          }));
          setContacts(formattedContacts);
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedContact) return;

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch messages between current user and selected contact
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selectedContact.contact_id}),and(sender_id.eq.${selectedContact.contact_id},recipient_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (messagesError) {
          throw new Error(messagesError.message);
        }

        if (messagesData) {
          setMessages(messagesData as Message[]);
          // Mark messages as read
          await markMessagesAsRead(messagesData as Message[]);
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, selectedContact]);

  useEffect(() => {
    // Scroll to bottom on initial load and when new messages are added
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const markMessagesAsRead = async (messagesToMark: Message[]) => {
    if (!user) return;

    // Filter out messages that are already read
    const unreadMessages = messagesToMark.filter(msg => !msg.is_read && msg.recipient_id === user.id);

    if (unreadMessages.length === 0) {
      return; // No unread messages to mark
    }

    try {
      // Prepare the IDs of the messages to be marked as read
      const messageIds = unreadMessages.map(msg => msg.id);

      // Execute the update in Supabase
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds); // Use the 'in' operator to update multiple messages

      if (error) {
        console.error('Error marking messages as read:', error);
        toast.error('Failed to update message status.');
      } else {
        // Optimistically update the local state
        setMessages(currentMessages =>
          currentMessages.map(msg =>
            messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
          )
        );
        // Refresh unread messages count
        await refetch();
      }
    } catch (error: any) {
      console.error('Error during marking messages as read:', error);
      toast.error('Error marking messages as read.');
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    if (isMobileView) {
      setShowContactList(false);
    }
  };

  const handleGoBack = () => {
    setShowContactList(true);
    setSelectedContact(null);
  };

  const handleSendMessage = async () => {
    if (!user || !selectedContact) return;
    if (newMessage.trim() === '') return;

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert([{
          content: newMessage,
          sender_id: user.id,
          recipient_id: selectedContact.contact_id,
          is_read: false
        }])
        .select('*')
        .single();

      if (messageError) {
        throw new Error(messageError.message);
      }

      if (messageData) {
        setMessages(prevMessages => [...prevMessages, messageData as Message]);
        setNewMessage('');
        // Refresh unread messages count
        await refetch();
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const formatTimeAgo = (dateStr: string): string => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Recently';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4 flex h-full">
        {/* Contact List */}
        {(showContactList || !selectedContact) && (
          <div className="w-full md:w-1/3 lg:w-1/4 pr-4">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto h-full">
                {loading ? (
                  <p>Loading contacts...</p>
                ) : error ? (
                  <p>Error: {error}</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map(contact => (
                      <Button
                        key={contact.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleContactSelect(contact)}
                      >
                        <Avatar className="mr-2">
                          <AvatarImage src={contact.profile?.avatar_url || ''} alt={contact.profile?.full_name || 'Contact'} />
                          <AvatarFallback>{contact.profile?.full_name?.substring(0, 2) || 'CN'}</AvatarFallback>
                        </Avatar>
                        {contact.profile?.full_name || 'Unknown Contact'}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Message View */}
        {selectedContact && (
          <div className="w-full md:w-2/3 lg:w-3/4">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center">
                  {isMobileView && (
                    <Button variant="ghost" size="icon" onClick={handleGoBack} className="mr-2">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <Avatar className="mr-2">
                    <AvatarImage src={selectedContact.profile?.avatar_url || ''} alt={selectedContact.profile?.full_name || 'Contact'} />
                    <AvatarFallback>{selectedContact.profile?.full_name?.substring(0, 2) || 'CN'}</AvatarFallback>
                  </Avatar>
                  <CardTitle>{selectedContact.profile?.full_name || 'Unknown Contact'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div ref={messageListRef} className="space-y-2 p-4">
                    {loading ? (
                      <p>Loading messages...</p>
                    ) : error ? (
                      <p>Error: {error}</p>
                    ) : (
                      messages.map(message => (
                        <div
                          key={message.id}
                          className={`flex flex-col ${message.sender_id === user?.id ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center">
                            {message.sender_id !== user?.id && (
                              <Avatar className="mr-2 h-5 w-5">
                                <AvatarImage src={selectedContact.profile?.avatar_url || ''} alt={selectedContact.profile?.full_name || 'Contact'} />
                                <AvatarFallback>{selectedContact.profile?.full_name?.substring(0, 2) || 'CN'}</AvatarFallback>
                              </Avatar>
                            )}
                            <div
                              className={`rounded-xl px-3 py-2 text-sm ${message.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                                }`}
                            >
                              {message.content}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(message.created_at)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
