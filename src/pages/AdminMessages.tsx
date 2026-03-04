import { useEffect, useState } from "react";
import { Shield, MessageSquare, RefreshCw, Eye, CheckCircle, Clock, Trash2, Mail, Loader2, FolderKanban, Briefcase, FileText, Plus, Edit, Image as ImageIcon, Sparkles, ArrowLeft, Globe, BookOpen, Wand2, UploadCloud, X as XIcon } from "lucide-react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
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
import { ProjectInquiryModal } from "@/components/admin/ProjectInquiryModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface ProjectInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  project_type: 'website' | 'mobile' | 'saas' | 'other';
  project_subtype?: string;
  features: string[];
  budget?: string;
  timeline?: string;
  details?: string;
  other_description?: string;
  status: 'new' | 'read' | 'responded' | 'archived';
  language: 'en' | 'ar';
  created_at: string;
  updated_at: string;
}

function mdToHtml(md: string): string {
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-4 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-5 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-6 mb-2'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\* (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class='my-2 space-y-1'>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p class='mb-3'>")
    .replace(/\n/g, "<br/>");
  return `<p class='mb-3'>${html}</p>`;
}

export default function AdminMessages() {
  // Contact messages state
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactSubmission | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Project inquiries state
  const [projectInquiries, setProjectInquiries] = useState<ProjectInquiry[]>([]);
  const [filterInquiryStatus, setFilterInquiryStatus] = useState("all");
  const [selectedInquiry, setSelectedInquiry] = useState<ProjectInquiry | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  // Blog state
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogView, setBlogView] = useState<"list" | "edit">("list");
  const [editingPost, setEditingPost] = useState<any>({
    title: "", title_ar: "", slug: "", excerpt: "", excerpt_ar: "",
    content: "", content_ar: "", cover_image_url: "", published: false, author_name: ""
  });
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [aiLength, setAiLength] = useState("medium");
  const [aiLang, setAiLang] = useState("en");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<"en" | "ar">("en");
  const [editorMode, setEditorMode] = useState<"preview" | "edit">("preview");
  const [activeBlogField, setActiveBlogField] = useState<
    "title" | "excerpt" | "content" | "title_ar" | "excerpt_ar" | "content_ar" | "slug" | "author_name"
  >("content");
  const [emojiPickerValue, setEmojiPickerValue] = useState<string>("");

  // Shared state
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"messages" | "inquiries" | "blog">("messages");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactSubmission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
    loadProjectInquiries();
  }, []);

  useEffect(() => {
    if (activeTab === "blog") loadBlogPosts();
  }, [activeTab]);

  const BLANK_POST = { title: "", title_ar: "", slug: "", excerpt: "", excerpt_ar: "", content: "", content_ar: "", cover_image_url: "", published: false, author_name: "" };

  const openNewPost = () => {
    setEditingPost({ ...BLANK_POST });
    setIsCreatingPost(true);
    setAiTopic("");
    setBlogView("edit");
    setEditorMode("preview");
    setActiveBlogField("content");
  };

  const openEditPost = (post: any) => {
    setEditingPost({ ...post });
    setIsCreatingPost(false);
    setBlogView("edit");
    setEditorMode("preview");
    setActiveBlogField("content");
  };

  const insertEmoji = (emoji: string) => {
    const field = activeBlogField;
    setEditingPost((p: any) => {
      const current = (p?.[field] ?? "") as string;
      return { ...p, [field]: `${current}${emoji}` };
    });
  };

  const closeEditor = () => {
    setBlogView("list");
    setEditingPost({ ...BLANK_POST });
    setIsCreatingPost(false);
  };

  const loadBlogPosts = async () => {
    setBlogLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBlogPosts(data || []);
    } catch (error: any) {
      toast.error("Failed to load blog posts: " + error.message);
    } finally {
      setBlogLoading(false);
    }
  };

  const handleSaveBlogPost = async () => {
    const post = editingPost;
    if (!post.title && !post.title_ar) { toast.error("Please add a title"); return; }
    if (!post.slug) { toast.error("Please add a slug (URL)"); return; }
    try {
      if (isCreatingPost) {
        const { id: _id, ...insertData } = post;
        const { error } = await supabase.from("blog_posts").insert([insertData]);
        if (error) throw error;
        toast.success("Post published! ");
      } else {
        const { error } = await supabase.from("blog_posts").update(post).eq("id", post.id);
        if (error) throw error;
        toast.success("Post updated!");
      }
      closeEditor();
      loadBlogPosts();
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    }
  };

  const handleDeleteBlogPost = async (id: string) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Post deleted!");
      loadBlogPosts();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const handleTogglePublish = async (post: any) => {
    try {
      const { error } = await supabase.from("blog_posts").update({ published: !post.published, published_at: !post.published ? new Date().toISOString() : null }).eq("id", post.id);
      if (error) throw error;
      toast.success(!post.published ? "Post published! " : "Post moved to drafts");
      loadBlogPosts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBlogImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `blog-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("project-assets").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("project-assets").getPublicUrl(fileName);
      setEditingPost((prev: any) => ({ ...prev, cover_image_url: data.publicUrl }));
      toast.success("Cover image uploaded!");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) { toast.error("Enter a topic first"); return; }
    setAiGenerating(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/blog-ai-writer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          topic: aiTopic,
          imageDescription: editingPost.cover_image_url ? "User provided a cover image" : undefined,
          tone: aiTone,
          length: aiLength,
          language: aiLang,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const { title, slug, excerpt, content } = json.data;
      if (aiLang === "ar") {
        setEditingPost((p: any) => ({ ...p, title_ar: title || p.title_ar, slug: slug || p.slug, excerpt_ar: excerpt || p.excerpt_ar, content_ar: content || p.content_ar }));
        setActiveEditorTab("ar");
      } else {
        setEditingPost((p: any) => ({ ...p, title: title || p.title, slug: slug || p.slug, excerpt: excerpt || p.excerpt, content: content || p.content }));
        setActiveEditorTab("en");
      }
      toast.success("AI content generated! ");
    } catch (error: any) {
      toast.error("AI generation failed: " + error.message);
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => {
    const messagesChannel = supabase
      .channel('admin-messages-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_submissions' },
        () => loadMessages()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_submissions' },
        () => loadMessages()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'contact_submissions' },
        () => loadMessages()
      )
      .subscribe();

    const inquiriesChannel = supabase
      .channel('admin-inquiries-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_inquiries' },
        () => loadProjectInquiries()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_inquiries' },
        () => loadProjectInquiries()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'project_inquiries' },
        () => loadProjectInquiries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(inquiriesChannel);
    };
  }, []);

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

  const loadProjectInquiries = async () => {
    try {
      const { data, error } = await supabase
        .from('project_inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjectInquiries(data || []);
    } catch (error) {
      console.error('Error loading project inquiries:', error);
      toast.error('Failed to load project inquiries');
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

  const handleDeleteClick = (message: ContactSubmission) => {
    setDeleteTarget(message);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const prev = messages;
    setDeletingId(id);
    // Optimistic UI: remove immediately
    setMessages((msgs) => msgs.filter((m) => m.id !== id));

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Message deleted successfully');
    } catch (error: any) {
      console.error('Error deleting message:', error);
      // Rollback optimistic change
      setMessages(prev);
      toast.error(`Failed to delete message: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleViewInquiry = async (inquiry: ProjectInquiry) => {
    if (inquiry.status === 'new') {
      try {
        await supabase
          .from('project_inquiries')
          .update({ status: 'read', updated_at: new Date().toISOString() })
          .eq('id', inquiry.id);
        loadProjectInquiries();
      } catch (error) {
        console.error('Error marking inquiry as read:', error);
      }
    }
    setSelectedInquiry(inquiry);
    setShowInquiryModal(true);
  };

  const handleInquiryResponded = () => {
    loadProjectInquiries();
    setShowInquiryModal(false);
    setSelectedInquiry(null);
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

  const filteredInquiries = projectInquiries.filter(inquiry => {
    const matchesSearch = !searchTerm || 
      inquiry.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.details?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterInquiryStatus === "all" || 
      inquiry.status === filterInquiryStatus;
    
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-background p-4 flex items-center justify-center">
        <div className="text-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background text-foreground min-h-screen">
      {/* Header */}
      <AdminHeader
        title="Admin Messages"
        subtitle="Manage contact forms and support tickets"
        icon={<MessageSquare className="h-5 w-5 text-accent-orange" />}
      >
        <Button onClick={loadMessages} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 pb-24 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "messages" | "inquiries" | "blog")}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="messages" className="flex items-center gap-1 text-xs sm:text-sm">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Contact </span>Messages
              {messages.filter(m => m.status === 'unread').length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                  {messages.filter(m => m.status === 'unread').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inquiries" className="flex items-center gap-1 text-xs sm:text-sm">
              <FolderKanban className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Project </span>Inquiries
              {projectInquiries.filter(i => i.status === 'new').length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                  {projectInquiries.filter(i => i.status === 'new').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center gap-1 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              Blog
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Stats Cards - Messages */}
        {activeTab === "messages" && (
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

            <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm">
                  <Shield className="h-4 w-4 mr-2 text-accent-purple" />
                  Account Deletion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-purple">
                  {messages.filter(m => m.submission_type === 'account_delete').length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Cards - Project Inquiries */}
        {activeTab === "inquiries" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm">
                  <FolderKanban className="h-4 w-4 mr-2 text-accent-blue" />
                  Total Inquiries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-enhanced-heading">{projectInquiries.length}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 text-accent-orange" />
                  New
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-orange">
                  {projectInquiries.filter(i => i.status === 'new').length}
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
                  {projectInquiries.filter(i => i.status === 'read').length}
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
                  {projectInquiries.filter(i => i.status === 'responded').length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">
              {activeTab === "messages" ? "Message Management" : activeTab === "inquiries" ? "Project Inquiry Management" : "Blog Management"}
            </CardTitle>
            <CardDescription>
              {activeTab === "messages" 
                ? "Contact forms, feedback, and support requests" 
                : activeTab === "inquiries"
                ? "Project inquiries from wakti.ai/start-project"
                : "Create and manage blog posts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Messages Content */}
            {activeTab === "messages" && (
              <>
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
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="abuse">Abuse Report</SelectItem>
                        <SelectItem value="account_delete">Account Delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Messages List */}
                <div className="space-y-4">
                  {filteredMessages.map((message) => (
                    <Card key={message.id} className="bg-gradient-card border-border/50 hover:border-border/70 transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-semibold text-lg">
                              {message.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-enhanced-heading font-semibold text-base mb-1">
                                  {message.name}
                                </h3>
                                <a 
                                  href={`mailto:${message.email}`}
                                  className="text-accent-blue text-sm hover:underline flex items-center gap-1"
                                >
                                  <Mail className="h-3 w-3" />
                                  {message.email}
                                </a>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Badge 
                                  variant={
                                    message.submission_type === 'abuse' ? 'destructive' :
                                    message.submission_type === 'feedback' ? 'secondary' :
                                    message.submission_type === 'account_delete' ? 'default' :
                                    'outline'
                                  }
                                  className="text-xs"
                                >
                                  {message.submission_type === 'contact' ? 'Contact' : 
                                   message.submission_type === 'feedback' ? 'Feedback' : 
                                   message.submission_type === 'support' ? 'Support' :
                                   message.submission_type === 'account_delete' ? 'Account Delete' :
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
                              <div className="mb-2">
                                <span className="text-sm text-muted-foreground">Subject: </span>
                                <span className="text-sm font-medium text-enhanced-heading">{message.subject}</span>
                              </div>
                            )}
                            
                            <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {message.message}
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleString()}
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleDeleteClick(message)}
                                  disabled={deletingId === message.id}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50/10"
                                >
                                  {deletingId === message.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
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
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Project Inquiries Content */}
            {activeTab === "inquiries" && (
              <>
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <Label htmlFor="search-inquiries">Search Inquiries</Label>
                    <Input
                      id="search-inquiries"
                      placeholder="Search by name, email, company, or project details..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1 bg-background/50 border-border/50 focus:border-accent-blue/50"
                    />
                  </div>
                  <div className="w-full lg:w-48">
                    <Label>Filter by Status</Label>
                    <Select value={filterInquiryStatus} onValueChange={setFilterInquiryStatus}>
                      <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="responded">Responded</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Project Inquiries List */}
                <div className="space-y-4">
                  {filteredInquiries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No project inquiries found</p>
                    </div>
                  ) : (
                    filteredInquiries.map((inquiry) => (
                      <Card key={inquiry.id} className="bg-gradient-card border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-orange to-accent-purple flex items-center justify-center text-white font-semibold text-lg">
                                {inquiry.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="text-enhanced-heading font-semibold text-base mb-1">
                                    {inquiry.name}
                                    {inquiry.company && (
                                      <span className="text-muted-foreground font-normal text-sm ml-2">
                                        @ {inquiry.company}
                                      </span>
                                    )}
                                  </h3>
                                  <a 
                                    href={`mailto:${inquiry.email}`}
                                    className="text-accent-blue text-sm hover:underline flex items-center gap-1"
                                  >
                                    <Mail className="h-3 w-3" />
                                    {inquiry.email}
                                  </a>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    {inquiry.project_type}
                                  </Badge>
                                  <Badge 
                                    variant={
                                      inquiry.status === 'new' ? 'destructive' :
                                      inquiry.status === 'responded' ? 'default' : 'secondary'
                                    }
                                    className="text-xs capitalize"
                                  >
                                    {inquiry.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Project Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
                                {inquiry.project_subtype && (
                                  <div className="text-muted-foreground">
                                    <span className="text-xs">Type:</span>{' '}
                                    <span className="text-foreground">{inquiry.project_subtype}</span>
                                  </div>
                                )}
                                {inquiry.budget && (
                                  <div className="text-muted-foreground">
                                    <span className="text-xs">Budget:</span>{' '}
                                    <span className="text-foreground">{inquiry.budget}</span>
                                  </div>
                                )}
                                {inquiry.timeline && (
                                  <div className="text-muted-foreground">
                                    <span className="text-xs">Timeline:</span>{' '}
                                    <span className="text-foreground">{inquiry.timeline}</span>
                                  </div>
                                )}
                                {inquiry.features && inquiry.features.length > 0 && (
                                  <div className="text-muted-foreground">
                                    <span className="text-xs">Features:</span>{' '}
                                    <span className="text-foreground">{inquiry.features.length}</span>
                                  </div>
                                )}
                              </div>
                              
                              {inquiry.details && (
                                <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                  {inquiry.details}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {new Date(inquiry.created_at).toLocaleString()}
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleViewInquiry(inquiry)}
                                    className="btn-enhanced hover:shadow-glow"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Blog Content */}
            {activeTab === "blog" && (
              blogView === "edit" ? (
                /* ─── EDITOR VIEW ─── */
                <div className="space-y-0 -mx-6 -mt-6">
                  {/* Editor sticky header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur border-b border-border/40">
                    <button onClick={closeEditor} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Posts</span>
                    </button>
                    <span className="text-sm font-semibold text-enhanced-heading">
                      {isCreatingPost ? "New Post" : "Edit Post"}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={editingPost.published || false}
                          onCheckedChange={checked => setEditingPost((p: any) => ({ ...p, published: checked }))}
                          className="scale-90"
                        />
                        <span className="text-xs text-muted-foreground">{editingPost.published ? "Live" : "Draft"}</span>
                      </div>
                      <Button size="sm" className="btn-enhanced h-8 text-xs px-3" onClick={handleSaveBlogPost}>
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="px-4 pt-4 space-y-5 pb-6">

                    {/* ── AI WRITER PANEL ── */}
                    <div className="rounded-xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/10 to-accent-blue/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-accent-purple" />
                        <span className="text-sm font-semibold text-enhanced-heading">AI Writer — GPT-4o mini</span>
                        <Badge className="text-[10px] bg-accent-green/20 text-accent-green border-accent-green/30 ml-auto">Powered by OpenAI</Badge>
                      </div>

                      <Textarea
                        placeholder="Describe what you want to write about... e.g. 'How Wakti AI saves 2 hours a day for busy professionals'"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        className="bg-background/60 border-border/50 text-sm resize-none focus:border-accent-purple/50"
                        rows={2}
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tone</Label>
                          <Select value={aiTone} onValueChange={setAiTone}>
                            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="inspirational">Inspirational</SelectItem>
                              <SelectItem value="educational">Educational</SelectItem>
                              <SelectItem value="storytelling">Storytelling</SelectItem>
                              <SelectItem value="witty">Witty</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Length</Label>
                          <Select value={aiLength} onValueChange={setAiLength}>
                            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="short">Short (~400w)</SelectItem>
                              <SelectItem value="medium">Medium (~700w)</SelectItem>
                              <SelectItem value="long">Long (~1200w)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Language</Label>
                          <Select value={aiLang} onValueChange={setAiLang}>
                            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="ar">Arabic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button
                        className="w-full h-10 bg-gradient-to-r from-accent-purple to-accent-blue hover:opacity-90 text-white font-medium gap-2"
                        onClick={handleAIGenerate}
                        disabled={aiGenerating || !aiTopic.trim()}
                      >
                        {aiGenerating ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <><Wand2 className="w-4 h-4" /> Generate Article</>
                        )}
                      </Button>
                    </div>

                    {/* ── COVER IMAGE ── */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cover Image</Label>
                      {editingPost.cover_image_url ? (
                        <div className="relative rounded-lg overflow-hidden">
                          <img src={editingPost.cover_image_url} alt="Cover" className="w-full h-40 object-cover" />
                          <button
                            aria-label="Remove cover image"
                            onClick={() => setEditingPost((p: any) => ({ ...p, cover_image_url: "" }))}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <XIcon className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-border/50 hover:border-accent-blue/50 bg-background/30 cursor-pointer transition-colors group">
                          {imageUploading ? (
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                          ) : (
                            <>
                              <UploadCloud className="w-6 h-6 text-muted-foreground group-hover:text-accent-blue transition-colors mb-1" />
                              <span className="text-xs text-muted-foreground group-hover:text-accent-blue transition-colors">Tap to upload cover image</span>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleBlogImageUpload} disabled={imageUploading} />
                        </label>
                      )}
                    </div>

                    {/* ── POST META ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Author Name</Label>
                        <Input
                          value={editingPost.author_name || ""}
                          onChange={e => setEditingPost((p: any) => ({ ...p, author_name: e.target.value }))}
                          onFocus={() => setActiveBlogField("author_name")}
                          className="bg-background/50 border-border/50 h-9 text-sm"
                          placeholder="Wakti Team"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">URL Slug</Label>
                        <Input
                          value={editingPost.slug || ""}
                          onChange={e => setEditingPost((p: any) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }))}
                          onFocus={() => setActiveBlogField("slug")}
                          className="bg-background/50 border-border/50 h-9 text-sm font-mono"
                          placeholder="my-post-url"
                        />
                      </div>
                    </div>

                    {/* ── LANGUAGE TABS ── */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex rounded-lg overflow-hidden border border-border/50 flex-1">
                          <button
                            onClick={() => setActiveEditorTab("en")}
                            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${activeEditorTab === "en" ? "bg-accent-blue text-white" : "bg-background/30 text-muted-foreground hover:text-foreground"}`}
                          >
                            <Globe className="w-3.5 h-3.5" /> English
                          </button>
                          <button
                            onClick={() => setActiveEditorTab("ar")}
                            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${activeEditorTab === "ar" ? "bg-accent-purple text-white" : "bg-background/30 text-muted-foreground hover:text-foreground"}`}
                          >
                            <BookOpen className="w-3.5 h-3.5" /> العربية
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={emojiPickerValue}
                            onValueChange={(v) => {
                              insertEmoji(v);
                              setEmojiPickerValue("");
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs bg-background/60 border-border/50 w-[120px]">
                              <SelectValue placeholder="Emojis" />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="✨">✨ Sparkle</SelectItem>
                              <SelectItem value="🚀">🚀 Launch</SelectItem>
                              <SelectItem value="✅">✅ Check</SelectItem>
                              <SelectItem value="🔥">🔥 Fire</SelectItem>
                              <SelectItem value="💡">💡 Idea</SelectItem>
                              <SelectItem value="📌">📌 Pin</SelectItem>
                              <SelectItem value="🧠">🧠 Smart</SelectItem>
                              <SelectItem value="🎯">🎯 Target</SelectItem>
                              <SelectItem value="⚠️">⚠️ Warning</SelectItem>
                              <SelectItem value="📝">📝 Note</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex rounded-lg overflow-hidden border border-border/50">
                            <button
                              type="button"
                              onClick={() => setEditorMode("preview")}
                              className={`px-3 h-9 text-xs font-medium transition-colors ${editorMode === "preview" ? "bg-accent-green text-white" : "bg-background/30 text-muted-foreground hover:text-foreground"}`}
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditorMode("edit")}
                              className={`px-3 h-9 text-xs font-medium transition-colors ${editorMode === "edit" ? "bg-accent-blue text-white" : "bg-background/30 text-muted-foreground hover:text-foreground"}`}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>

                      {activeEditorTab === "en" ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Title (English)</Label>
                            <Input
                              value={editingPost.title || ""}
                              onChange={e => setEditingPost((p: any) => ({ ...p, title: e.target.value }))}
                              onFocus={() => setActiveBlogField("title")}
                              className="bg-background/50 border-border/50 text-sm font-medium"
                              placeholder="Your compelling title..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Excerpt (English)</Label>
                            <Textarea
                              value={editingPost.excerpt || ""}
                              onChange={e => setEditingPost((p: any) => ({ ...p, excerpt: e.target.value }))}
                              onFocus={() => setActiveBlogField("excerpt")}
                              className="bg-background/50 border-border/50 text-sm resize-none"
                              placeholder="Brief summary shown in post previews..."
                              rows={2}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-xs text-muted-foreground">Content (English)</Label>
                              <div className="flex rounded-lg overflow-hidden border border-border/50">
                                <button type="button" onClick={() => setEditorMode("preview")}
                                  className={`px-3 h-7 text-xs font-medium transition-colors ${editorMode === "preview" ? "bg-accent-green text-white" : "bg-background/30 text-muted-foreground"}`}>
                                  Preview
                                </button>
                                <button type="button" onClick={() => setEditorMode("edit")}
                                  className={`px-3 h-7 text-xs font-medium transition-colors ${editorMode === "edit" ? "bg-accent-blue text-white" : "bg-background/30 text-muted-foreground"}`}>
                                  Edit
                                </button>
                              </div>
                            </div>
                            {editorMode === "preview" ? (
                              <div
                                className="min-h-[200px] rounded-xl border border-border/40 bg-background/50 p-4 text-sm leading-relaxed text-foreground"
                                dangerouslySetInnerHTML={{ __html: mdToHtml(editingPost.content || "") }}
                              />
                            ) : (
                              <Textarea
                                value={editingPost.content || ""}
                                onChange={e => setEditingPost((p: any) => ({ ...p, content: e.target.value }))}
                                onFocus={() => setActiveBlogField("content")}
                                className="bg-background/50 border-border/50 text-sm resize-none min-h-[200px] leading-relaxed"
                                placeholder="Start writing your article here..."
                                rows={12}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">العنوان بالعربية</Label>
                            <Input
                              value={editingPost.title_ar || ""}
                              onChange={e => setEditingPost((p: any) => ({ ...p, title_ar: e.target.value }))}
                              onFocus={() => setActiveBlogField("title_ar")}
                              className="bg-background/50 border-border/50 text-sm font-medium text-right"
                              dir="rtl"
                              placeholder="العنوان هنا..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">المقتطف بالعربية</Label>
                            <Textarea
                              value={editingPost.excerpt_ar || ""}
                              onChange={e => setEditingPost((p: any) => ({ ...p, excerpt_ar: e.target.value }))}
                              onFocus={() => setActiveBlogField("excerpt_ar")}
                              className="bg-background/50 border-border/50 text-sm resize-none text-right"
                              dir="rtl"
                              placeholder="ملخص قصير..."
                              rows={2}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-xs text-muted-foreground">المحتوى بالعربية</Label>
                              <div className="flex rounded-lg overflow-hidden border border-border/50">
                                <button type="button" onClick={() => setEditorMode("preview")}
                                  className={`px-3 h-7 text-xs font-medium transition-colors ${editorMode === "preview" ? "bg-accent-green text-white" : "bg-background/30 text-muted-foreground"}`}>
                                  معاينة
                                </button>
                                <button type="button" onClick={() => setEditorMode("edit")}
                                  className={`px-3 h-7 text-xs font-medium transition-colors ${editorMode === "edit" ? "bg-accent-blue text-white" : "bg-background/30 text-muted-foreground"}`}>
                                  تعديل
                                </button>
                              </div>
                            </div>
                            {editorMode === "preview" ? (
                              <div
                                dir="rtl"
                                className="min-h-[200px] rounded-xl border border-border/40 bg-background/50 p-4 text-sm leading-relaxed text-foreground text-right"
                                dangerouslySetInnerHTML={{ __html: mdToHtml(editingPost.content_ar || "") }}
                              />
                            ) : (
                              <Textarea
                                value={editingPost.content_ar || ""}
                                onChange={e => setEditingPost((p: any) => ({ ...p, content_ar: e.target.value }))}
                                onFocus={() => setActiveBlogField("content_ar")}
                                className="bg-background/50 border-border/50 text-sm resize-none min-h-[200px] leading-relaxed text-right"
                                dir="rtl"
                                placeholder="اكتب المحتوى هنا..."
                                rows={12}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1" onClick={closeEditor}>Cancel</Button>
                      <Button className="flex-1 btn-enhanced" onClick={handleSaveBlogPost}>
                        {isCreatingPost ? "Publish Post" : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── LIST VIEW ─── */
                <div className="space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3 text-center">
                      <div className="text-xl font-bold text-enhanced-heading">{blogPosts.length}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Total Posts</div>
                    </div>
                    <div className="rounded-lg bg-accent-green/10 border border-accent-green/20 p-3 text-center">
                      <div className="text-xl font-bold text-accent-green">{blogPosts.filter(p => p.published).length}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Published</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3 text-center">
                      <div className="text-xl font-bold text-muted-foreground">{blogPosts.filter(p => !p.published).length}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Drafts</div>
                    </div>
                  </div>

                  {/* New Post button */}
                  <Button className="w-full btn-enhanced h-11 gap-2 text-sm" onClick={openNewPost}>
                    <Plus className="w-4 h-4" />
                    New Blog Post
                  </Button>

                  {/* Posts list */}
                  {blogLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading posts...</span>
                    </div>
                  ) : blogPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-accent-purple" />
                      </div>
                      <div>
                        <p className="font-medium text-enhanced-heading">No posts yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Create your first AI-powered blog article</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blogPosts.map(post => (
                        <div key={post.id} className="rounded-xl border border-border/50 bg-gradient-card overflow-hidden hover:border-border/80 transition-all duration-200">
                          <div className="flex gap-3 p-3">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-background/50 flex items-center justify-center">
                              {post.cover_image_url ? (
                                <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
                              ) : (
                                <FileText className="w-6 h-6 text-muted-foreground/40" />
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="text-sm font-semibold text-enhanced-heading line-clamp-2 leading-snug flex-1">
                                  {post.title || post.title_ar || "(no title)"}
                                </h3>
                                <Badge
                                  className={`text-[10px] flex-shrink-0 cursor-pointer ${post.published ? "bg-accent-green/20 text-accent-green border-accent-green/30 hover:bg-accent-green/30" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"}`}
                                  onClick={() => handleTogglePublish(post)}
                                >
                                  {post.published ? "Published" : "Draft"}
                                </Badge>
                              </div>
                              {post.excerpt && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5">{post.excerpt}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground/70">
                                  {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {post.author_name && ` · ${post.author_name}`}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-accent-blue hover:bg-accent-blue/10"
                                    onClick={() => openEditPost(post)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-400 hover:bg-red-400/10"
                                    onClick={() => handleDeleteBlogPost(post.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
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

      {/* Project Inquiry Modal */}
      <ProjectInquiryModal
        isOpen={showInquiryModal}
        onClose={() => {
          setShowInquiryModal(false);
          setSelectedInquiry(null);
        }}
        inquiry={selectedInquiry}
        onResponded={handleInquiryResponded}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the conversation and all chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}