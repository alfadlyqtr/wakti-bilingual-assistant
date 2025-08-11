import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Eye, MessageCircle, Clock, CheckCircle, X, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

interface SupportTicket {
  id: string;
  type: string;
  status: string;
  subject: string;
  created_at: string;
  last_activity_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  sender_id: string;
  role: string;
  body: string;
  attachments: any[];
  created_at: string;
  profiles?: {
    display_name: string;
  };
}

export function UserTicketList() {
  const { language } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل التذاكر' : 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          *,
          profiles (display_name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل الرسائل' : 'Failed to load messages');
    }
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
    loadMessages(ticket.id);
  };

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          role: 'user',
          body: newMessage.trim(),
          attachments: []
        });

      if (error) throw error;

      // Update ticket activity
      await supabase
        .from('support_tickets')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      setNewMessage('');
      loadMessages(selectedTicket.id);
      loadTickets();
      toast.success(language === 'ar' ? 'تم إرسال الرسالة' : 'Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;

    const confirmMessage = language === 'ar' 
      ? 'هل أنت متأكد من إغلاق هذه التذكرة؟ سيتم حذف جميع الرسائل والمرفقات نهائياً.'
      : 'Are you sure you want to close this ticket? All messages and attachments will be permanently deleted.';
    
    if (!confirm(confirmMessage)) return;

    setIsClosing(true);
    try {
      const { error } = await supabase.functions.invoke('support-ticket-maintenance', {
        body: {
          action: 'close_now',
          ticket_id: selectedTicket.id
        }
      });

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم إغلاق التذكرة' : 'Ticket closed');
      setShowTicketModal(false);
      setSelectedTicket(null);
      loadTickets();
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error(language === 'ar' ? 'فشل في إغلاق التذكرة' : 'Failed to close ticket');
    } finally {
      setIsClosing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
      case 'solved': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'closed': return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'open': language === 'ar' ? 'مفتوحة' : 'Open',
      'pending': language === 'ar' ? 'معلقة' : 'Pending',
      'solved': language === 'ar' ? 'محلولة' : 'Solved',
      'closed': language === 'ar' ? 'مغلقة' : 'Closed'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const getTypeText = (type: string) => {
    const typeMap = {
      'support': language === 'ar' ? 'دعم' : 'Support',
      'feedback': language === 'ar' ? 'ملاحظات' : 'Feedback',
      'abuse': language === 'ar' ? 'إبلاغ عن إساءة' : 'Report Abuse'
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
        <CardHeader>
          <CardTitle>
            {language === 'ar' ? 'تذاكر الدعم الخاصة بك' : 'Your Support Tickets'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {language === 'ar' ? 'لا توجد تذاكر دعم حتى الآن' : 'No support tickets yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="bg-gradient-card/20 border-border/30 hover:border-border/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {getTypeText(ticket.type)}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                            {getStatusText(ticket.status)}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm mb-1">{ticket.subject}</h4>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'آخر نشاط:' : 'Last activity:'} {new Date(ticket.last_activity_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTicket(ticket)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'عرض' : 'View'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Details Modal */}
      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg">
                  {selectedTicket?.subject}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedTicket && getTypeText(selectedTicket.type)}
                  </Badge>
                  <Badge className={`text-xs ${selectedTicket && getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket && getStatusText(selectedTicket.status)}
                  </Badge>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={closeTicket}
                disabled={isClosing}
              >
                {isClosing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <X className="h-3 w-3 mr-1" />
                {language === 'ar' ? 'إغلاق التذكرة' : 'Close Ticket'}
              </Button>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs">
                      {message.role === 'staff' ? 'WAKTI Support' : (message.profiles?.display_name || 'You')}
                    </span>
                    <span className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{message.body}</p>
                  {message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((attachment: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <Paperclip className="h-3 w-3" />
                          <span>{attachment.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Reply Section */}
          {selectedTicket && ['open', 'pending'].includes(selectedTicket.status) && (
            <div className="border-t pt-4 space-y-3">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب ردك هنا...' : 'Type your reply here...'}
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                >
                  {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'إرسال رد' : 'Send Reply'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}