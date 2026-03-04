import { useEffect, useState } from "react";
import { FileText, Plus, Edit2, Trash2, Globe, Calendar, Eye, RefreshCw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  title_ar: string;
  excerpt: string;
  excerpt_ar: string;
  content: string;
  content_ar: string;
  cover_image_url: string | null;
  author_name: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    title_ar: "",
    excerpt: "",
    excerpt_ar: "",
    content: "",
    content_ar: "",
    cover_image_url: "",
    author_name: "Wakti Team",
    published: false,
  });

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      toast.error('Failed to load blog posts');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm ||
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.title_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.slug?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filter === "all" ||
      (filter === "published" && post.published) ||
      (filter === "draft" && !post.published);

    return matchesSearch && matchesFilter;
  });

  const handleCreate = () => {
    setEditingPost(null);
    setFormData({
      slug: "",
      title: "",
      title_ar: "",
      excerpt: "",
      excerpt_ar: "",
      content: "",
      content_ar: "",
      cover_image_url: "",
      author_name: "Wakti Team",
      published: false,
    });
    setShowModal(true);
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      slug: post.slug,
      title: post.title,
      title_ar: post.title_ar,
      excerpt: post.excerpt,
      excerpt_ar: post.excerpt_ar,
      content: post.content,
      content_ar: post.content_ar,
      cover_image_url: post.cover_image_url || "",
      author_name: post.author_name,
      published: post.published,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.slug || !formData.title) {
      toast.error('Slug and English title are required');
      return;
    }

    try {
      setIsSaving(true);

      const postData = {
        ...formData,
        published_at: formData.published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (editingPost) {
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', editingPost.id);

        if (error) throw error;
        toast.success('Blog post updated successfully');
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert({ ...postData, created_at: new Date().toISOString() });

        if (error) throw error;
        toast.success('Blog post created successfully');
      }

      setShowModal(false);
      loadPosts();
    } catch (error: any) {
      console.error('Error saving blog post:', error);
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;
      toast.success('Blog post deleted successfully');
      loadPosts();
    } catch (error: any) {
      console.error('Error deleting blog post:', error);
      toast.error(`Failed to delete: ${error?.message || 'Unknown error'}`);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-background p-4 flex items-center justify-center min-h-[400px]">
        <div className="text-foreground">Loading blog posts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <FileText className="h-4 w-4 mr-2 text-accent-blue" />
              Total Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-enhanced-heading">{posts.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Eye className="h-4 w-4 mr-2 text-accent-green" />
              Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-green">
              {posts.filter(p => p.published).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Calendar className="h-4 w-4 mr-2 text-accent-orange" />
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-orange">
              {posts.filter(p => !p.published).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Globe className="h-4 w-4 mr-2 text-accent-purple" />
              Bilingual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-purple">
              {posts.filter(p => p.title_ar && p.content_ar).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-enhanced-heading">Blog Management</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage bilingual blog posts
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadPosts} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button onClick={handleCreate} size="sm" className="btn-enhanced">
                <Plus className="h-4 w-4 mr-1" />
                New Post
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by title or slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "published" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("published")}
              >
                Published
              </Button>
              <Button
                variant={filter === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("draft")}
              >
                Drafts
              </Button>
            </div>
          </div>

          {/* Posts List */}
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No blog posts found</p>
                <p className="text-sm mt-1">Create your first post to get started</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <Card key={post.id} className="bg-background/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-enhanced-heading truncate">
                            {post.title}
                          </h3>
                          {post.published ? (
                            <Badge className="status-success">Published</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                          {post.title_ar && <Badge variant="outline">AR</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          /blog/{post.slug}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.excerpt || post.content?.substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>By {post.author_name}</span>
                          <span>•</span>
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          {post.published_at && (
                            <>
                              <span>•</span>
                              <span className="text-accent-green">
                                Published {new Date(post.published_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(post)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(post)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-enhanced-heading">
              {editingPost ? 'Edit Blog Post' : 'Create Blog Post'}
            </DialogTitle>
            <DialogDescription>
              Fill in the details below. Both English and Arabic content are supported.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="english" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="english">English Content</TabsTrigger>
              <TabsTrigger value="arabic">Arabic Content</TabsTrigger>
            </TabsList>

            <TabsContent value="english" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title">Title (English) *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (!editingPost && !formData.slug) {
                      setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
                    }
                  }}
                  placeholder="Enter post title in English"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="excerpt">Excerpt (English)</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Short description for previews..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="content">Content (English) *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your blog post content in Markdown..."
                  className="mt-1 font-mono text-sm"
                  rows={12}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports Markdown formatting
                </p>
              </div>
            </TabsContent>

            <TabsContent value="arabic" className="space-y-4 mt-4" dir="rtl">
              <div>
                <Label htmlFor="title_ar">Title (Arabic)</Label>
                <Input
                  id="title_ar"
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="أدخل عنوان المنشور بالعربية"
                  className="mt-1 text-right"
                  dir="rtl"
                />
              </div>

              <div>
                <Label htmlFor="excerpt_ar">Excerpt (Arabic)</Label>
                <Textarea
                  id="excerpt_ar"
                  value={formData.excerpt_ar}
                  onChange={(e) => setFormData({ ...formData, excerpt_ar: e.target.value })}
                  placeholder="وصف قصير للمعاينات..."
                  className="mt-1 text-right"
                  rows={2}
                  dir="rtl"
                />
              </div>

              <div>
                <Label htmlFor="content_ar">Content (Arabic)</Label>
                <Textarea
                  id="content_ar"
                  value={formData.content_ar}
                  onChange={(e) => setFormData({ ...formData, content_ar: e.target.value })}
                  placeholder="اكتب محتوى منشورك بالعربية..."
                  className="mt-1 font-mono text-sm text-right"
                  rows={12}
                  dir="rtl"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Settings */}
          <div className="space-y-4 pt-4 border-t mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="my-blog-post"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  /blog/{formData.slug || '...'}
                </p>
              </div>

              <div>
                <Label htmlFor="author_name">Author</Label>
                <Input
                  id="author_name"
                  value={formData.author_name}
                  onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                  placeholder="Author name"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cover_image_url">Cover Image URL</Label>
              <Input
                id="cover_image_url"
                value={formData.cover_image_url}
                onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label htmlFor="published" className="cursor-pointer">
                  {formData.published ? 'Published (live on site)' : 'Draft (not visible)'}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="btn-enhanced">
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : editingPost ? 'Update Post' : 'Create Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
