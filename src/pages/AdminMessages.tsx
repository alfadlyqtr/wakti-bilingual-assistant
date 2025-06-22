import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, Filter, MoreHorizontal, Mail, MailOpen, Reply, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'unread' | 'read' | 'replied';
  submission_type: 'contact' | 'feedback' | 'abuse';
  created_at: string;
}

export default function AdminMessages() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    filterMessages();
  }, [messages, searchTerm, filterStatus, filterType]);

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
        msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (msg.subject && msg.subject.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(msg => msg.status === filterStatus);
    }

    if (filterType !== "all") {
      filtered = filtered.filter(msg => msg.submission_type === filterType);
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'contact':
        return 'bg-blue-100 text-blue-800';
      case 'feedback':
        return 'bg-green-100 text-green-800';
      case 'abuse':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread':
        return 'bg-accent-orange text-white';
      case 'replied':
        return 'bg-accent-green text-white';
      case 'read':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-background flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background text-foreground">
      <AdminHeader
        title="Support Messages"
        subtitle={`${filteredMessages.length} messages found`}
        icon={<MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-accent-orange" />}
      >
        {/* Mobile Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="sm:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </AdminHeader>

      {/* Search and Filters */}
      <div className={`p-3 sm:p-6 bg-gradient-background border-b border-border/30 ${mobileFiltersOpen ? 'block' : 'hidden'} sm:block`}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {filterStatus === "all" ? "All Status" : 
                     filterStatus === "unread" ? "Unread" : 
                     filterStatus === "read" ? "Read" : "Replied"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("unread")}>Unread</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("read")}>Read</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("replied")}>Replied</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {filterType === "all" ? "All Types" : 
                     filterType === "contact" ? "Contact" : 
                     filterType === "feedback" ? "Feedback" : "Abuse"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterType("all")}>All Types</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("contact")}>Contact</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("feedback")}>Feedback</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("abuse")}>Abuse</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages List with Natural Scrolling */}
      <div className="p-3 sm:p-6 pb-32 space-y-3 sm:space-y-4">
        {filteredMessages.map((message) => (
          <Card key={message.id} className="enhanced-card">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-3 mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {message.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-enhanced-heading text-sm sm:text-base truncate">{message.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{message.email}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 flex-shrink-0">
                      <Badge className={getTypeColor(message.submission_type)} variant="outline">
                        {message.submission_type}
                      </Badge>
                      <Badge className={getStatusColor(message.status)}>
                        {message.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {message.subject && (
                    <h4 className="font-medium text-sm mb-2 text-enhanced-heading">{message.subject}</h4>
                  )}
                  
                  <p className="text-xs sm:text-sm mb-3 bg-gradient-secondary/10 p-3 rounded-lg line-clamp-3">
                    {message.message}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 ml-2">
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

        {filteredMessages.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-8 sm:p-12 text-center">
              <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-enhanced-heading mb-2">No messages found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting your search or filter criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
