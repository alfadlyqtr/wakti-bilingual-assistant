import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Code2, 
  Trash2, 
  ExternalLink, 
  Loader2, 
  Paperclip,
  Send,
  MessageSquare,
  Image as ImageIcon,
  ChevronDown,
  Sparkles,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string | null;
  status: string;
  published_url: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  files?: Record<string, string>;
}

const MAX_PROJECTS = 2;

// Project Preview Thumbnail Component - simple image thumbnail
const ProjectPreviewThumbnail = ({ project }: { project: Project }) => {
  // If project has a thumbnail, show it
  if (project.thumbnail_url) {
    return (
      <div className="aspect-video relative overflow-hidden bg-zinc-900">
        <img 
          src={project.thumbnail_url} 
          alt={project.name}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }
  
  // Fallback: show project name in a styled card
  return (
    <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-indigo-600/30 via-purple-600/30 to-pink-600/30">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <Code2 className="h-8 w-8 text-white/40 mb-2" />
        <span className="text-white/60 text-xs font-medium truncate max-w-full">{project.name}</span>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <Eye className="h-6 w-6 text-white drop-shadow-lg" />
      </div>
    </div>
  );
};

// Wakti brand color themes
const THEMES = [
  { id: 'wakti-dark', name: 'Wakti Dark', nameAr: 'وقتي داكن', colors: ['#0c0f14', '#060541', '#858384'] },
  { id: 'wakti-light', name: 'Wakti Light', nameAr: 'وقتي فاتح', colors: ['#fcfefd', '#060541', '#e9ceb0'] },
  { id: 'vibrant', name: 'Vibrant', nameAr: 'حيوي', colors: ['hsl(210,100%,65%)', 'hsl(280,70%,65%)', 'hsl(25,95%,60%)'] },
  { id: 'emerald', name: 'Emerald', nameAr: 'زمردي', colors: ['hsl(160,80%,55%)', 'hsl(142,76%,55%)', '#0c0f14'] },
];

// Animated placeholder examples
const PLACEHOLDER_EXAMPLES = [
  { en: 'a gym landing page with pricing...', ar: 'صفحة نادي رياضي مع الأسعار...' },
  { en: 'a Ramadan countdown timer...', ar: 'عداد تنازلي لرمضان...' },
  { en: 'a restaurant menu with ordering...', ar: 'قائمة مطعم مع الطلب...' },
  { en: 'a portfolio for a photographer...', ar: 'معرض أعمال مصور...' },
  { en: 'a math quiz for kids...', ar: 'اختبار رياضيات للأطفال...' },
];

export default function Projects() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('wakti-dark');
  const [showThemes, setShowThemes] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Get username from profile
  const userName = user?.user_metadata?.username || 
                   user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 
                   'there';

  // Animated typing effect for placeholder
  useEffect(() => {
    const example = PLACEHOLDER_EXAMPLES[placeholderIndex];
    const fullText = isRTL ? example.ar : example.en;
    
    if (isTyping) {
      if (displayedPlaceholder.length < fullText.length) {
        const timeout = setTimeout(() => {
          setDisplayedPlaceholder(fullText.slice(0, displayedPlaceholder.length + 1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      if (displayedPlaceholder.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayedPlaceholder(displayedPlaceholder.slice(0, -1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
        setIsTyping(true);
      }
    }
  }, [displayedPlaceholder, isTyping, placeholderIndex, isRTL]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('projects' as any)
        .select('*')
        .order('updated_at', { ascending: false }) as any);

      if (error) throw error;
      
      // Fetch files for each project to enable preview
      const projectsWithFiles = await Promise.all((data || []).map(async (project: Project) => {
        try {
          const { data: filesData, error: filesError } = await (supabase
            .from('project_files' as any)
            .select('path, content')
            .eq('project_id', project.id) as any);
          
          if (filesData && filesData.length > 0) {
            let files: Record<string, string> = {};
            
            filesData.forEach((f: { path: string; content: string }) => {
              // Check if content is JSON (contains all files as JSON object)
              if (f.content && f.content.startsWith('{"/')) {
                try {
                  const parsed = JSON.parse(f.content);
                  files = { ...files, ...parsed };
                } catch (e) {
                  // Not JSON, treat as regular file
                  const path = f.path.startsWith('/') ? f.path : `/${f.path}`;
                  files[path] = f.content;
                }
              } else {
                const path = f.path.startsWith('/') ? f.path : `/${f.path}`;
                files[path] = f.content;
              }
            });
            
            if (Object.keys(files).length > 0) {
              return { ...project, files };
            }
          }
        } catch (e) {
          console.error('[Projects] Error fetching files for project:', project.id, e);
        }
        return project;
      }));
      
      setProjects(projectsWithFiles);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
      toast.success(isRTL ? `تم إرفاق ${files.length} ملف` : `${files.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // EMP - Enhance My Prompt using GPT-4o-mini
  const enhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error(isRTL ? 'اكتب شيئًا أولاً' : 'Write something first');
      return;
    }
    
    setIsEnhancing(true);
    try {
      const response = await supabase.functions.invoke('projects-enhance-prompt', {
        body: {
          prompt: prompt,
          theme: selectedTheme,
          hasAssets: attachedFiles.length > 0,
        },
      });
      
      if (response.error || !response.data?.ok) {
        throw new Error(response.data?.error || 'Failed to enhance');
      }
      
      const enhanced = response.data.enhancedPrompt;
      if (enhanced && enhanced !== prompt) {
        setPrompt(enhanced);
        toast.success(isRTL ? 'تم تحسين الطلب!' : 'Prompt enhanced!');
      } else {
        toast.info(isRTL ? 'الطلب جيد كما هو' : 'Prompt is already good');
      }
    } catch (err: any) {
      console.error('EMP error:', err);
      toast.error(isRTL ? 'فشل في التحسين' : 'Failed to enhance');
    } finally {
      setIsEnhancing(false);
    }
  };

  const createProject = async () => {
    if (!prompt.trim()) {
      toast.error(isRTL ? 'صف ما تريد بناءه' : 'Describe what you want to build');
      return;
    }
    
    if (!user?.id) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول' : 'Please log in first');
      return;
    }

    if (projects.length >= MAX_PROJECTS) {
      toast.error(
        isRTL
          ? `الحد الأقصى ${MAX_PROJECTS} مشاريع. احذف مشروعًا لإنشاء جديد.`
          : `Maximum ${MAX_PROJECTS} projects. Delete one to create a new one.`
      );
      return;
    }

    try {
      setGenerating(true);
      
      // Step 0: Upload assets if any
      let assetUrls: string[] = [];
      if (attachedFiles.length > 0) {
        setIsUploading(true);
        for (const file of attachedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;
          const filePath = `${user?.id}/${fileName}`;

          const { data, error: uploadError } = await supabase.storage
            .from('project-assets')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('project-assets')
            .getPublicUrl(filePath);
          
          assetUrls.push(publicUrl);
        }
        setIsUploading(false);
      }

      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isRTL ? 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' : 'Session expired, please log in again');
        setGenerating(false);
        return;
      }

      // Step 1: Create project immediately with placeholder
      const projectName = prompt.slice(0, 30).trim() || 'My Project';
      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'my-project';

      console.log('Creating project for user:', user.id, 'session user:', session.user.id);
      
      const { data: projectData, error: projectError } = await (supabase
        .from('projects' as any)
        .insert({
          user_id: session.user.id,
          name: projectName,
          slug: `${slug}-${Date.now().toString(36)}`,
          description: prompt,
          template_type: 'ai-generated',
          status: 'generating',
        })
        .select()
        .single() as any);

      console.log('Project creation result:', { projectData, projectError });
      
      if (projectError) {
        console.error('Project creation failed:', projectError);
        throw projectError;
      }

      // Step 2: Create placeholder file
      const placeholderHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generating...</title>
  <style>
    body { 
      margin: 0; 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 50%, hsl(25,95%,60%) 100%);
      font-family: system-ui, sans-serif;
    }
    .loader {
      text-align: center;
      color: white;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h2>AI is creating your project...</h2>
    <p>${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}</p>
  </div>
</body>
</html>`;

      const { error: fileError } = await (supabase
        .from('project_files' as any)
        .insert({
          project_id: projectData.id,
          path: 'index.html',
          content: placeholderHtml,
        }) as any);

      if (fileError) {
        console.error('File creation failed:', fileError);
        throw fileError;
      }
      
      console.log('File created, navigating to:', `/projects/${projectData.id}`);

      // Step 3: Navigate to editor immediately
      const assetParams = assetUrls.length > 0 ? `&assets=${encodeURIComponent(JSON.stringify(assetUrls))}` : '';
      navigate(`/projects/${projectData.id}?generating=true&prompt=${encodeURIComponent(prompt)}&theme=${selectedTheme}${assetParams}`);

    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || (isRTL ? 'فشل في الإنشاء' : 'Failed to create'));
      setGenerating(false);
    }
  };

  const deleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      setDeleting(projectId);
      await (supabase.from('project_files' as any).delete().eq('project_id', projectId) as any);
      await (supabase.from('projects' as any).delete().eq('id', projectId) as any);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(isRTL ? 'فشل في الحذف' : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className={cn("min-h-[calc(100vh-64px)] flex flex-col", isRTL && "rtl")}>
      {/* Hero Section with Wakti Vibrant Gradient */}
      <div className="relative flex-1 flex flex-col min-h-[400px]">
        {/* Wakti Vibrant Gradient Background */}
        <div 
          className="absolute inset-0"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 50%, hsl(25,95%,60%) 100%)'
              : 'linear-gradient(135deg, hsl(210,100%,75%) 0%, hsl(280,60%,75%) 50%, hsl(25,95%,70%) 100%)'
          }}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10" />
        
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
          {/* Greeting with username */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-10 drop-shadow-lg">
            {isRTL ? `جاهز للبناء، ${userName}؟` : `Ready to build, ${userName}?`}
          </h1>

          {/* Main Input Card */}
          <div className="w-full max-w-2xl bg-white dark:bg-[#0c0f14] rounded-2xl shadow-2xl border border-white/20">
            {/* Input Area - Scrollable Textarea */}
            <div className="p-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !generating) {
                    e.preventDefault();
                    createProject();
                  }
                }}
                placeholder={`${isRTL ? 'اطلب من Wakti إنشاء ' : 'Ask Wakti to create '}${displayedPlaceholder}`}
                className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50 resize-none min-h-[60px] max-h-[150px] overflow-y-auto"
                disabled={generating}
                rows={2}
              />
            </div>

            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-xs">
                    <ImageIcon className="h-3 w-3" />
                    <span className="max-w-[100px] truncate">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-red-500 hover:text-red-600">×</button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Action Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30 relative z-50">
              <div className="flex items-center gap-1">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {/* Attach Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleAttachClick}
                  disabled={generating}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">{isRTL ? 'إرفاق' : 'Attach'}</span>
                </Button>

                {/* EMP - Enhance My Prompt Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-purple-500/10"
                  onClick={enhancePrompt}
                  disabled={generating || isEnhancing || !prompt.trim()}
                  title={isRTL ? 'تحسين الطلب' : 'Enhance My Prompt'}
                >
                  {isEnhancing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  )}
                  <span className="text-xs hidden sm:inline">{isRTL ? 'تحسين' : 'EMP'}</span>
                </Button>

                {/* Theme Selector with Color Previews */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowThemes(!showThemes)}
                    disabled={generating}
                  >
                    {/* Color preview dots */}
                    <div className="flex -space-x-1">
                      {THEMES.find(t => t.id === selectedTheme)?.colors.slice(0, 3).map((color, i) => (
                        <div 
                          key={i} 
                          className="w-3 h-3 rounded-full border border-white/50"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs hidden sm:inline">{isRTL ? 'ثيم' : 'Theme'}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  
                  {showThemes && (
                    <div className="fixed inset-0 z-[9999]" onClick={() => setShowThemes(false)}>
                      <div 
                        className="absolute bg-white dark:bg-[#0c0f14] rounded-xl shadow-2xl border p-2 min-w-[180px]"
                        style={{ 
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs text-muted-foreground px-3 py-2 border-b mb-2">
                          {isRTL ? 'اختر ثيم' : 'Choose Theme'}
                        </p>
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelectedTheme(t.id);
                              setShowThemes(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors",
                              selectedTheme === t.id && "bg-muted"
                            )}
                          >
                            {/* Color preview */}
                            <div className="flex -space-x-1">
                              {t.colors.map((color, i) => (
                                <div 
                                  key={i} 
                                  className="w-4 h-4 rounded-full border-2 border-white dark:border-[#0c0f14]"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <span>{isRTL ? t.nameAr : t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Chat Toggle */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 text-xs"
                  disabled={generating}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isRTL ? 'محادثة' : 'Chat'}</span>
                </Button>

                {/* Generate Button */}
                <Button
                  size="sm"
                  onClick={createProject}
                  disabled={generating || !prompt.trim()}
                  className="bg-[#060541] hover:bg-[#060541]/90 text-white gap-1.5"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Limit Info */}
          {projects.length >= MAX_PROJECTS && (
            <p className="mt-4 text-sm text-white/80">
              {isRTL 
                ? 'وصلت للحد الأقصى. احذف مشروعًا لإنشاء جديد.'
                : 'You\'ve reached the limit. Delete a project to create a new one.'}
            </p>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{isRTL ? 'مشاريعي' : 'My projects'}</h2>
            <span className="text-sm text-muted-foreground">
              {projects.length} / {MAX_PROJECTS}
            </span>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">{isRTL ? 'لا توجد مشاريع بعد' : 'No projects yet'}</p>
              <p className="text-sm mt-2 opacity-70">
                {isRTL ? 'ابدأ بوصف ما تريد بناءه أعلاه' : 'Start by describing what you want to build above'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group relative bg-card rounded-2xl overflow-hidden cursor-pointer border hover:border-[#060541] dark:hover:border-blue-500 transition-all hover:shadow-lg"
                >
                  {/* Project Preview Thumbnail */}
                  <ProjectPreviewThumbnail project={project} />
                  
                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {project.description || (isRTL ? 'مشروع AI' : 'AI Project')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 px-2 py-1 text-xs rounded-full font-medium",
                          project.status === 'published'
                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {project.status === 'published' ? (isRTL ? 'منشور' : 'Live') : (isRTL ? 'مسودة' : 'Draft')}
                      </span>
                    </div>
                  </div>

                  {/* Actions - Always visible for mobile-friendliness */}
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    {project.published_url && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(project.published_url!, '_blank');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:bg-red-500/10"
                      onClick={(e) => deleteProject(e, project.id)}
                      disabled={deleting === project.id}
                    >
                      {deleting === project.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
