import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Ticket, MessageCircle, Clock, CheckCircle, X, 
  Loader2, Paperclip, Eye, RefreshCw, Search,
  AlertCircle, User, Mail, Calendar, Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupportTicket {
  id: string;
  user_id: string;
  type: string;
  status: string;
  subject: string;
  created_at: string;
  last_activity_at: string;
  updated_at: string;
  profiles?: {
    display_name: string;
    email: string;
  };
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

export function AdminSupportTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadTickets();
  }, []);

  const getAdminSessionToken = () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) return null;
    
    try {
      const session = JSON.parse(storedSession);
      return session.session_token;
    } catch {
      return null;
    }
  };

  const invokeAdminGateway = async (action: string, payload: any) => {
    const sessionToken = getAdminSessionToken();
    if (!sessionToken) {
      toast.error('Admin session not found');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('admin-support-gateway', {
      body: { action, ...payload, session_token: sessionToken },
      headers: { 'x-admin-session': sessionToken }
    });

    if (error) {
      console.error('Gateway error:', error);
      toast.error('Gateway error: ' + error.message);
      return null;
    }

    if (!data?.ok) {
      console.error('API error:', data?.error);
      toast.error('API error: ' + (data?.error?.message || 'Unknown error'));
      return null;
    }

    return data;
  };

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      
      const result = await invokeAdminGateway('list_tickets', { 
        status: filterStatus === 'all' ? undefined : filterStatus,
        type: filterType === 'all' ? undefined : filterType,
        page: 1,
        limit: 100
      });

      if (result) {
        setTickets(result.tickets || []);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const result = await invokeAdminGateway('get_ticket', { ticket_id: ticketId });
      if (result) {
        setMessages(result.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
    loadMessages(ticket.id);
  };

  const sendStaffReply = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const result = await invokeAdminGateway('reply_ticket', {
        ticket_id: selectedTicket.id,
        body: newMessage.trim(),
        attachments: []
      });

      if (result) {
        setNewMessage('');
        loadMessages(selectedTicket.id);
        loadTickets();
        toast.success('Reply sent successfully');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;

    if (!confirm('Are you sure you want to close this ticket? All messages and attachments will be permanently deleted.')) {
      return;
    }

    setIsClosing(true);
    try {
      const result = await invokeAdminGateway('close_ticket', {
        ticket_id: selectedTicket.id
      });

      if (result) {
        toast.success(`Ticket closed successfully. Deleted ${result.deletedFiles} file(s).`);
        setShowTicketModal(false);
        setSelectedTicket(null);
        loadTickets();
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error('Failed to close ticket');
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'support': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'feedback': return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
      case 'abuse': return 'bg-red-500/20 text-red-700 dark:text-red-300';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm || 
      ticket.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesType = filterType === 'all' || ticket.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const ticketCounts = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    solved: tickets.filter(t => t.status === 'solved').length,
    closed: tickets.filter(t => t.status === 'closed').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading support tickets...</span>
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards - Match Messages Tab Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Ticket className="h-4 w-4 mr-2 text-accent-blue" />
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-enhanced-heading">{ticketCounts.total}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <AlertCircle className="h-4 w-4 mr-2 text-accent-orange" />
              Unread
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-orange">{ticketCounts.open}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Eye className="h-4 w-4 mr-2 text-accent-green" />
              Read
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-green">{ticketCounts.pending}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <CheckCircle className="h-4 w-4 mr-2 text-accent-purple" />
              Responded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-purple">{ticketCounts.solved}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border/50 hover:border-red-500/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Shield className="h-4 w-4 mr-2 text-red-500" />
              Abuse Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{tickets.filter(t => t.type === 'abuse').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search and Filter Controls */}
      <Card className="bg-gradient-card border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="text-enhanced-heading">Support Ticket Management</CardTitle>
          <CardDescription>Contact forms, feedback, and support requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label>Search Tickets</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name, email, or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 mt-1 bg-background/50 border-border/50"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="solved">Solved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-48">
              <Label>Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="abuse">Abuse Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-auto">
              <Label>&nbsp;</Label>
              <Button onClick={loadTickets} variant="outline" className="w-full lg:w-auto mt-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Tickets List */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No support tickets found</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="bg-gradient-card/50 border-border/30 hover:border-border/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`text-xs ${getTypeColor(ticket.type)}`}>
                            {ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1)}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm mb-2">{ticket.subject}</h4>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{ticket.profiles?.display_name || 'Unknown User'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{ticket.profiles?.email || 'No email'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Last activity: {new Date(ticket.last_activity_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTicket(ticket)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Details Modal */}
      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">
                  {selectedTicket?.subject}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-xs ${selectedTicket && getTypeColor(selectedTicket.type)}`}>
                    {selectedTicket && selectedTicket.type.charAt(0).toUpperCase() + selectedTicket.type.slice(1)}
                  </Badge>
                  <Badge className={`text-xs ${selectedTicket && getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket && selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>{selectedTicket?.profiles?.display_name} ({selectedTicket?.profiles?.email})</p>
                  <p>Created: {selectedTicket && new Date(selectedTicket.created_at).toLocaleString()}</p>
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
                Close Ticket
              </Button>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-muted' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs">
                      {message.role === 'staff' ? 'WAKTI Staff' : (message.profiles?.display_name || 'User')}
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

          {/* Staff Reply Section */}
          <div className="border-t pt-4 space-y-3">
            <Label htmlFor="staff-reply">Staff Reply</Label>
            <Textarea
              id="staff-reply"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your reply to the user..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTicketModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={sendStaffReply}
                disabled={!newMessage.trim() || isSending}
              >
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <MessageCircle className="h-4 w-4 mr-2" />
                Send Reply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}