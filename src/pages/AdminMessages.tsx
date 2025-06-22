
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ArrowLeft, Search, Filter, MoreHorizontal, Mail, MailOpen, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'replied';
  created_at: string;
}

export default function AdminMessages() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    filterMessages();
  }, [messages, searchTerm, filterStatus]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = messages;

    if (searchTerm) {
      filtered = filtered.filter(msg =>
        msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(msg => msg.status === filterStatus);
    }

    setFilteredMessages(filtered);
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status: 'read' })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'read' as const } : msg
      ));
      toast.success('Message marked as read');
    } catch (err) {
      console.error('Error marking message as read:', err);
      toast.error('Failed to update message status');
    }
  };

  const handleReply = async (messageId: string) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    try {
      // Update message status to replied
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status: 'replied' })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'replied' as const } : msg
      ));
      
      setSelectedMessage(null);
      setReplyText("");
      toast.success('Reply sent successfully');
    } catch (err) {
      console.error('Error sending reply:', err);
      toast.error('Failed to send reply');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admindash')}
              className="rounded-full hover:bg-accent/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <MessageSquare className="h-8 w-8 text-accent-orange" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">Support Messages</h1>
              <p className="text-sm text-muted-foreground">{filteredMessages.length} messages found</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages by name, email, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>
                  {filterStatus === "all" ? "All Messages" : 
                   filterStatus === "unread" ? "Unread" : 
                   filterStatus === "read" ? "Read" : "Replied"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Messages</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("unread")}>Unread</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("read")}>Read</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("replied")}>Replied</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages List */}
        <div className="grid gap-4">
          {filteredMessages.map((message) => (
            <Card key={message.id} className="enhanced-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {message.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-enhanced-heading">{message.name}</h3>
                        <p className="text-sm text-muted-foreground">{message.email}</p>
                      </div>
                      <Badge 
                        variant={message.status === 'unread' ? "destructive" : message.status === 'replied' ? "default" : "secondary"}
                        className={
                          message.status === 'unread' ? 'bg-accent-orange' :
                          message.status === 'replied' ? 'bg-accent-green' : ''
                        }
                      >
                        {message.status}
                      </Badge>
                    </div>
                    
                    <p className="text-sm mb-3 bg-gradient-secondary/10 p-3 rounded-lg">
                      {message.message}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      Received {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {message.status === 'unread' && (
                        <DropdownMenuItem onClick={() => markAsRead(message.id)}>
                          <MailOpen className="h-4 w-4 mr-2" />
                          Mark as Read
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setSelectedMessage(message)}>
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMessages.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No messages found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reply Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="enhanced-card w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Reply to {selectedMessage.name}</CardTitle>
              <CardDescription>Responding to: {selectedMessage.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-secondary/10 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Original Message:</p>
                <p className="text-sm">{selectedMessage.message}</p>
              </div>
              
              <Textarea
                placeholder="Type your reply here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={6}
                className="input-enhanced"
              />
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMessage(null);
                    setReplyText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReply(selectedMessage.id)}
                  className="btn-enhanced"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Send Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
