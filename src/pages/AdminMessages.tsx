
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, MessageSquare, RefreshCw, Eye, CheckCircle, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminMessageModal } from "@/components/admin/AdminMessageModal";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: string;
  submission_type: string;
  created_at: string;
  updated_at: string;
  admin_response?: string;
  responded_at?: string;
  responded_by?: string;
}

export default function AdminMessages() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactSubmission | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    validateAdminSession();
    loadMessages();
  }, []);

  const validateAdminSession = async () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      navigate('/mqtr');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        navigate('/mqtr');
        return;
      }
    } catch (err) {
      navigate('/mqtr');
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMessage = (message: ContactSubmission) => {
    setSelectedMessage(message);
    setShowMessageModal(true);
  };

  const handleMessageResponded = () => {
    loadMessages();
    setShowMessageModal(false);
    setSelectedMessage(null);
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchTerm || 
      message.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.message?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || 
      (filterStatus === "unread" && message.status === 'unread') ||
      (filterStatus === "read" && message.status === 'read') ||
      (filterStatus === "responded" && message.status === 'responded');
    
    const matchesType = filterType === "all" || 
      message.submission_type === filterType;
    
    return matchesSearch && matchesFilter && matchesType;
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-background min-h-screen p-4 flex items-center justify-center">
        <div className="text-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Header */}
      <AdminHeader
        title="Support Messages"
        subtitle={`${messages.filter(m => m.status === 'unread').length} unread messages`}
        icon={<MessageSquare className="h-5 w-5 text-accent-orange" />}
      >
        <Button onClick={loadMessages} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <MessageSquare className="h-4 w-4 mr-2 text-accent-blue" />
                Total Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">{messages.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-accent-orange" />
                Unread
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-orange">
                {messages.filter(m => m.status === 'unread').length}
              </div>
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
              <div className="text-2xl font-bold text-accent-green">
                {messages.filter(m => m.status === 'read').length}
              </div>
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
              <div className="text-2xl font-bold text-accent-purple">
                {messages.filter(m => m.status === 'responded').length}
              </div>
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
              <div className="text-2xl font-bold text-red-500">
                {messages.filter(m => m.submission_type === 'abuse').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filter Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">Message Management</CardTitle>
            <CardDescription>Contact forms, feedback, and support requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Label htmlFor="search">Search Messages</Label>
                <Input
                  id="search"
                  placeholder="Search by name, email, subject, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 bg-background/50 border-border/50 focus:border-accent-blue/50"
                />
              </div>
              <div className="w-full lg:w-48">
                <Label>Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="responded">Responded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full lg:w-48">
                <Label>Filter by Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="abuse">Abuse Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Enhanced Messages List */}
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <div key={message.id} className="bg-gradient-card border border-border/30 rounded-xl p-6 hover:border-border/50 transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-enhanced-heading">
                            {message.name}
                          </div>
                          <div className="text-sm text-muted-foreground break-all">
                            {message.email}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge 
                            variant={
                              message.submission_type === 'abuse' ? 'destructive' :
                              message.submission_type === 'feedback' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {message.submission_type === 'contact' ? 'Contact' : 
                             message.submission_type === 'feedback' ? 'Feedback' : 
                             'Abuse Report'}
                          </Badge>
                          <Badge 
                            variant={
                              message.status === 'unread' ? 'destructive' :
                              message.status === 'responded' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {message.status}
                          </Badge>
                        </div>
                      </div>
                      
                      {message.subject && (
                        <div className="font-medium text-accent-blue">
                          {message.subject}
                        </div>
                      )}
                      
                      <div className="text-muted-foreground line-clamp-2">
                        {message.message}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        size="sm" 
                        onClick={() => handleViewMessage(message)}
                        className="btn-enhanced hover:shadow-glow"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View & Respond
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Modal */}
      <AdminMessageModal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false);
          setSelectedMessage(null);
        }}
        message={selectedMessage}
        onResponded={handleMessageResponded}
      />

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
