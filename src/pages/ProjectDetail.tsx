import React, { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Download, 
  ExternalLink, 
  Loader2, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Upload, 
  Save, 
  MessageSquare, 
  Code2, 
  Check, 
  ChevronUp, 
  RefreshCw, 
  Sparkles, 
  Brain, 
  FileCode, 
  Zap, 
  Plus, 
  SendHorizontal, 
  ArrowDown, 
  Send, 
  AlertTriangle, 
  Wand2, 
  MousePointer2, 
  X,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

// Lazy load Sandpack Studio for full control over layout
const SandpackStudio = lazy(() => import('@/components/projects/SandpackStudio'));
import { MatrixOverlay } from '@/components/projects/MatrixOverlay';
import { TraceFlowLoader } from '@/components/projects/TraceFlowLoader';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string | null;
  status: string;
  published_url: string | null;
  deployment_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  snapshot?: any; // To store project files snapshot for reverting
}

type DeviceView = 'desktop' | 'tablet' | 'mobile';
type LeftPanelMode = 'chat' | 'code';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useTheme();
  const { user, session } = useAuth();
  const isRTL = language === 'ar';
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  
  // Multi-file support (like Google AI Studio)
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  
  // Left panel state
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiEditing, setAiEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<{ label: string, status: 'pending' | 'loading' | 'completed' | 'error' }[]>([]);
  
  // Preview state - default to mobile if on mobile device
  const [deviceView, setDeviceView] = useState<DeviceView>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile';
    }
    return 'desktop';
  });
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'code' | 'both'>('preview');
  
  // Mobile view state - for switching between chat/code and preview on mobile
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('preview');
  
  // Self-healing: Runtime error detection
  const [crashReport, setCrashReport] = useState<string | null>(null);

  // Pagination for chat messages - show last N messages, then "Show More"
  const MESSAGES_PER_PAGE = 10;
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(MESSAGES_PER_PAGE);

  // Dynamic suggestion chips based on last AI response context
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  // Instructions drawer state
  const [instructionsDrawerOpen, setInstructionsDrawerOpen] = useState(false);
  const [userInstructions, setUserInstructions] = useState('');
  const [tempInstructions, setTempInstructions] = useState('');
  
  // AMP (Amplify) state
  const [isAmplifying, setIsAmplifying] = useState(false);

  // Element selection mode - for "Send Element" feature (Visual Inspector)
  const [elementSelectMode, setElementSelectMode] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<{
    tagName: string;
    className: string;
    id: string;
    innerText: string;
    openingTag: string;
  } | null>(null);
  
  // Force Sandpack re-render key (incremented on revert)
  const [sandpackKey, setSandpackKey] = useState(0);

  // Track if we've already started generation to prevent double-runs
  const generationStartedRef = useRef(false);

  // Check if we need to generate on mount
  useEffect(() => {
    if (user && id) {
      // Check for generation params
      const generating = searchParams.get('generating');
      const prompt = searchParams.get('prompt');
      const theme = searchParams.get('theme');
      const assetsParam = searchParams.get('assets');
      
      fetchProject(); // Always fetch project files
      fetchChatHistory(); // Always fetch chat history
      
      if (generating === 'true' && prompt && !generationStartedRef.current) {
        generationStartedRef.current = true;
        // Set loading to false immediately so we show the full UI during generation
        setLoading(false);
        setIsGenerating(true);
        console.log('[ProjectDetail] Starting generation for prompt:', prompt.substring(0, 50));
        
        let assets: string[] = [];
        try {
          if (assetsParam) assets = JSON.parse(decodeURIComponent(assetsParam));
        } catch (e) {
          console.error('Failed to parse assets:', e);
        }
        
        setSearchParams({}, { replace: true });
        runGeneration(prompt, theme || 'wakti-dark', assets);
      }
    }
  }, [user, id]);
  
  const fetchChatHistory = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('project_chat_messages' as any)
        .select('id, role, content, snapshot')
        .eq('project_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching chat history:', error);
      } else if (data && data.length > 0) {
        console.log('[ProjectDetail] Loaded', data.length, 'chat messages');
        setChatMessages(data as any);
      } else {
        console.log('[ProjectDetail] No chat messages found for project', id);
      }
    } catch (err) {
      console.error('Exception fetching chat history:', err);
    }
  };

  const handleRevert = async (messageId: string) => {
    const targetMessage = chatMessages.find(m => m.id === messageId);
    console.log('[Revert] Target message:', messageId, targetMessage);
    console.log('[Revert] Snapshot:', targetMessage?.snapshot);
    console.log('[Revert] Snapshot keys:', targetMessage?.snapshot ? Object.keys(targetMessage.snapshot) : 'none');
    
    if (!targetMessage || !targetMessage.snapshot) {
      toast.error(isRTL ? 'لا توجد نسخة احتياطية متاحة' : 'No snapshot available for this point');
      return;
    }

    try {
      setIsGenerating(true);
      
      // Parse snapshot if it's a string (from DB)
      let snapshot = targetMessage.snapshot;
      if (typeof snapshot === 'string') {
        try {
          snapshot = JSON.parse(snapshot);
        } catch (e) {
          console.error('[Revert] Failed to parse snapshot string:', e);
        }
      }
      
      console.log('[Revert] Final snapshot to apply:', snapshot);
      console.log('[Revert] HeroSection content preview:', snapshot['/components/HeroSection.js']?.substring(0, 200));
      
      // Update local state and force Sandpack re-render
      setGeneratedFiles(snapshot);
      setCodeContent(snapshot["/App.js"] || Object.values(snapshot)[0] || "");
      setSandpackKey(prev => prev + 1); // Force Sandpack to re-mount with new files

      // Save to database
      const filesJson = JSON.stringify(snapshot);
      await (supabase
        .from('project_files' as any)
        .update({ content: filesJson })
        .eq('project_id', id)
        .eq('path', 'index.html') as any);

      // Add a system message about the revert (WITHOUT copying the snapshot - it's the restored state now)
      const revertMsg = isRTL 
        ? `تم استعادة المشروع إلى نقطة سابقة. ✓` 
        : `Project restored to this point. ✓`;

      const { data: newMsg, error: msgError } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'assistant', 
          content: revertMsg
          // NO snapshot here - this is just a status message
        } as any)
        .select()
        .single();

      if (!msgError && newMsg) {
        setChatMessages(prev => [...prev, newMsg as any]);
      }

      toast.success(isRTL ? 'تم استعادة الحالة بنجاح!' : 'Successfully restored state!');
    } catch (err) {
      console.error('Revert error:', err);
      toast.error(isRTL ? 'فشل في استعادة الحالة' : 'Failed to restore state');
    } finally {
      setIsGenerating(false);
    }
  };

  // Scroll to bottom when messages or generation state changes
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages change (including initial load)
    // Use a small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 150);
    return () => clearTimeout(timer);
  }, [chatMessages]);

  const thinkingBoxRef = useRef<HTMLDivElement>(null);

  const runGeneration = async (prompt: string, theme: string, assets: string[] = []) => {
    setIsGenerating(true);
    setLeftPanelMode('chat');
    
    // Reset steps
    const steps: { label: string, status: 'pending' | 'loading' | 'completed' | 'error' }[] = [
      { label: isRTL ? 'تحليل الطلب...' : 'Analyzing prompt...', status: 'loading' },
      { label: isRTL ? 'تخطيط هيكل المشروع...' : 'Planning project structure...', status: 'pending' },
      { label: isRTL ? 'إنشاء المكونات والأنماط...' : 'Generating components & styles...', status: 'pending' },
      { label: isRTL ? 'تجميع الملفات النهائية...' : 'Assembling final files...', status: 'pending' },
    ];
    setGenerationSteps(steps);

    // Save user message to DB
    const { data: newMsg, error: msgError } = await supabase
      .from('project_chat_messages' as any)
      .insert({ project_id: id, role: 'user', content: prompt } as any)
      .select()
      .single();
    
    if (msgError) console.error('Error saving user message:', msgError);
    if (newMsg) setChatMessages(prev => [...prev, newMsg as any]);
    else {
      // Fallback local state if DB insert fails
      setChatMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: prompt
      }]);
    }
    
    try {
      // Step 2: Planning
      setGenerationSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'completed' } : i === 1 ? { ...s, status: 'loading' } : s));
      
      const themeColors: Record<string, string[]> = {
        'wakti-dark': ['#0c0f14', '#060541', '#858384'],
        'wakti-light': ['#fcfefd', '#060541', '#e9ceb0'],
        'vibrant': ['hsl(210,100%,65%)', 'hsl(280,70%,65%)', 'hsl(25,95%,60%)'],
        'emerald': ['hsl(160,80%,55%)', 'hsl(142,76%,55%)', '#0c0f14'],
      };
      
      const colors = themeColors[theme] || themeColors['wakti-dark'];
      const fullPrompt = `${prompt}. Style: Use these colors: ${colors.join(', ')}.`;
      
      // Step 3: Generating
      setGenerationSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'completed' } : i === 2 ? { ...s, status: 'loading' } : s));

      const generateResponse = await supabase.functions.invoke('projects-generate', {
        body: {
          mode: 'create',
          prompt: fullPrompt,
          theme: theme,
          assets: assets,
        },
      });
      
      if (generateResponse.error || !generateResponse.data?.ok) {
        throw new Error(generateResponse.data?.error || 'Failed to generate');
      }
      
      // Multi-file mode - Lovable-style generation
      const generatedFilesData = generateResponse.data.files || {};
      const generatedCode = generateResponse.data.code || generatedFilesData["/App.js"] || "";
      
      // Step 4: Finalizing
      setGenerationSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'completed' } : i === 3 ? { ...s, status: 'loading' } : s));

      if (!generatedCode && Object.keys(generatedFilesData).length === 0) {
        throw new Error('No code returned from AI');
      }
      
      // Set files for SandpackStudio
      setGeneratedFiles(generatedFilesData);
      setCodeContent(generatedCode);
      
      // Update file in database
      const filesJson = JSON.stringify(generatedFilesData);
      await (supabase
        .from('project_files' as any)
        .update({ content: filesJson })
        .eq('project_id', id)
        .eq('path', 'index.html') as any);
      
      // Save assistant message to DB with snapshot
      const assistantMsg = isRTL ? 'لقد انتهيت من بناء مشروعك! ألقِ نظرة على المعاينة.' : "I've finished building your project! Take a look at the preview.";
      const { data: assistantMsgData, error: assistError } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'assistant', 
          content: assistantMsg,
          snapshot: generatedFilesData 
        } as any)
        .select()
        .single();
      
      if (assistError) console.error('Error saving assistant message:', assistError);
      if (assistantMsgData) setChatMessages(prev => [...prev, assistantMsgData as any]);
      else {
        setChatMessages(prev => [...prev, {
          id: `assist-${Date.now()}`,
          role: 'assistant',
          content: assistantMsg,
          snapshot: generatedFilesData
        }]);
      }

      // Complete all steps
      setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
      
      // Update project status
      const { error: statusError } = await (supabase
        .from('projects' as any)
        .update({ status: 'draft' })
        .eq('id', id) as any);
      
      if (statusError) {
        console.error('Failed to update status:', statusError);
      }
      
      setProject(prev => prev ? { ...prev, status: 'draft' } : null);
      
      // Sandpack auto-updates when codeContent changes
      console.log('Code updated - Sandpack will refresh automatically');
      
      const readyMsg = isRTL ? 'تم إنشاء مشروعك! ✓ يمكنك الآن تعديله أو نشره.' : 'Your project is ready! ✓ You can now edit or publish it.';
      const { data: readyMsgData } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'assistant', 
          content: readyMsg,
          snapshot: generatedFilesData 
        } as any)
        .select()
        .single();
        
      if (readyMsgData) setChatMessages(prev => [...prev, readyMsgData as any]);
      else {
        setChatMessages(prev => [...prev, {
          id: `ready-${Date.now()}`,
          role: 'assistant',
          content: readyMsg,
          snapshot: generatedFilesData
        }]);
      }
      toast.success(isRTL ? 'تم إنشاء المشروع!' : 'Project created!');
      
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMsg = isRTL ? 'عذرًا، حدث خطأ. حاول مرة أخرى.' : 'Sorry, an error occurred. Please try again.';
      
      const { data: errorMsgData } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'assistant', 
          content: errorMsg 
        } as any)
        .select()
        .single();
        
      if (errorMsgData) {
        setChatMessages(prev => [...prev, errorMsgData as any]);
      } else {
        // Fallback if DB save fails
        setChatMessages(prev => [...prev, { 
          id: `error-${Date.now()}`,
          role: 'assistant', 
          content: errorMsg 
        }]);
      }
      toast.error(err.message || (isRTL ? 'فشل في الإنشاء' : 'Failed to generate'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch only project info (used during generation to avoid overwriting generated code)
  const fetchProjectInfoOnly = async () => {
    try {
      const { data: projectData, error: projectError } = await (supabase
        .from('projects' as any)
        .select('*')
        .eq('id', id)
        .single() as any);

      if (projectError) throw projectError;
      setProject(projectData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching project info:', err);
    }
  };

  const fetchProject = async () => {
    try {
      setLoading(true);
      
      const { data: projectData, error: projectError } = await (supabase
        .from('projects' as any)
        .select('*')
        .eq('id', id)
        .single() as any);

      if (projectError) throw projectError;
      setProject(projectData);

      const { data: filesData, error: filesError } = await (supabase
        .from('project_files' as any)
        .select('*')
        .eq('project_id', id) as any);

      if (filesError) throw filesError;
      setFiles(filesData || []);
      
      const indexFile = filesData?.find((f: ProjectFile) => f.path === 'index.html');
      if (indexFile) {
        // Try to parse as JSON (multi-file format) or use as single file
        try {
          const parsed = JSON.parse(indexFile.content);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Multi-file format
            setGeneratedFiles(parsed);
            setCodeContent(parsed["/App.js"] || Object.values(parsed)[0] || "");
          } else {
            // Single file format
            setCodeContent(indexFile.content);
          }
        } catch {
          // Not JSON, use as single file
          setCodeContent(indexFile.content);
        }
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      toast.error(isRTL ? 'فشل في تحميل المشروع' : 'Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const saveCode = async () => {
    const file = files.find(f => f.path === 'index.html');
    if (!file) return;

    try {
      setSaving(true);
      const { error } = await (supabase
        .from('project_files' as any)
        .update({ content: codeContent })
        .eq('id', file.id) as any);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, content: codeContent } : f
      ));
      
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!');
      refreshPreview();
    } catch (err) {
      console.error('Error saving:', err);
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const refreshPreview = () => {
    // Sandpack auto-refreshes when code changes
    // Force a re-render by toggling the code
    setCodeContent(prev => prev + ' ');
    setTimeout(() => setCodeContent(prev => prev.trim()), 10);
  };

  const publishProject = async () => {
    if (!project || !session?.access_token) return;

    try {
      setPublishing(true);
      
      const response = await supabase.functions.invoke('projects-publish', {
        body: {
          projectName: project.name,
          projectSlug: project.slug,
          files: [{ path: 'index.html', content: codeContent }],
        },
      });

      if (response.error) throw response.error;

      const { url, deploymentId } = response.data;

      await (supabase
        .from('projects' as any)
        .update({
          status: 'published',
          published_url: url,
          deployment_id: deploymentId,
          published_at: new Date().toISOString(),
        })
        .eq('id', project.id) as any);

      setProject(prev => prev ? {
        ...prev,
        status: 'published',
        published_url: url,
        deployment_id: deploymentId,
      } : null);

      toast.success(isRTL ? 'تم النشر بنجاح!' : 'Published successfully!');
    } catch (err: any) {
      console.error('Error publishing:', err);
      toast.error(isRTL ? 'فشل في النشر' : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const downloadProject = () => {
    const blob = new Blob([codeContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.slug || 'project'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم التحميل!' : 'Downloaded!');
  };

  // Capture screenshot of the preview and save as thumbnail
  const captureScreenshot = async () => {
    if (!project) return;
    
    try {
      // Find the Sandpack preview iframe
      const previewContainer = document.querySelector('.sandpack-preview-container');
      if (!previewContainer) {
        toast.error(isRTL ? 'لا يوجد معاينة للتصوير' : 'No preview to capture');
        return;
      }

      toast.loading(isRTL ? 'جاري التقاط الصورة...' : 'Capturing screenshot...');
      
      // Use html2canvas to capture
      const canvas = await html2canvas(previewContainer as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        scale: 0.5, // Lower scale for smaller file size
        backgroundColor: '#0c0f14',
      });
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8);
      });
      
      // Upload to Supabase storage
      const fileName = `${project.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-thumbnails')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        // If bucket doesn't exist, just save locally for now
        toast.dismiss();
        toast.error(isRTL ? 'فشل في رفع الصورة' : 'Failed to upload screenshot');
        return;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-thumbnails')
        .getPublicUrl(fileName);
      
      // Update project with thumbnail URL
      await (supabase
        .from('projects' as any)
        .update({ thumbnail_url: publicUrl })
        .eq('id', project.id) as any);
      
      toast.dismiss();
      toast.success(isRTL ? 'تم حفظ الصورة المصغرة!' : 'Thumbnail saved!');
    } catch (err) {
      console.error('Screenshot error:', err);
      toast.dismiss();
      toast.error(isRTL ? 'فشل في التقاط الصورة' : 'Failed to capture screenshot');
    }
  };

  // Helper for delays
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Self-healing: Handle runtime crash detection from Sandpack
  const handleRuntimeCrash = (errorMsg: string) => {
    // Only set if we haven't already noticed it (prevent loops)
    if (crashReport !== errorMsg) {
      setCrashReport(errorMsg);
      toast.error(isRTL ? 'تم اكتشاف خطأ في المعاينة' : 'Preview error detected');
    }
  };

  // Self-healing: Auto-fix the crash
  const handleAutoFix = () => {
    if (!crashReport) return;
    
    const fixPrompt = `The preview crashed with this error: "${crashReport}". 
Analyze the code, find the root cause (usually a missing import, undefined variable, or unavailable dependency like react-router-dom), and fix it immediately. 
Remember: Do NOT use react-router-dom - use state-based navigation instead.`;
    
    // Clear error so we don't loop
    setCrashReport(null);
    
    // Switch to Code mode and send fix request
    setLeftPanelMode('code');
    setChatInput(fixPrompt);
    
    // Trigger submit after setting input
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    }, 100);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiEditing) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setAiEditing(true);
    
    // Set initial progress steps based on mode
    if (leftPanelMode === 'code') {
      setGenerationSteps([
        { label: isRTL ? 'تحليل الطلب...' : 'Analyzing request...', status: 'loading' },
        { label: isRTL ? 'تخطيط التغييرات...' : 'Planning changes...', status: 'pending' },
        { label: isRTL ? 'تطبيق التعديلات...' : 'Applying edits...', status: 'pending' },
      ]);
    } else {
      // Chat mode - different steps for Q&A
      setGenerationSteps([
        { label: isRTL ? 'قراءة المشروع...' : 'Reading project...', status: 'loading' },
        { label: isRTL ? 'التفكير...' : 'Thinking...', status: 'pending' },
        { label: isRTL ? 'صياغة الإجابة...' : 'Formulating answer...', status: 'pending' },
      ]);
    }

    // Save user message to DB
    const { data: userMsg, error: msgError } = await supabase
      .from('project_chat_messages' as any)
      .insert({ project_id: id, role: 'user', content: userMessage } as any)
      .select()
      .single();
    
    if (msgError) console.error('Error saving user message:', msgError);
    if (userMsg) setChatMessages(prev => [...prev, userMsg as any]);
    else {
      // Fallback local state if DB insert fails
      setChatMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage
      }]);
    }
    
    try {
      // Small delay to show first step
      await delay(800);
      // Step 1 complete, Step 2 loading
      setGenerationSteps(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'completed' } : 
        i === 1 ? { ...s, status: 'loading' } : s
      ));

      // Route based on leftPanelMode: 'chat' = Q&A (read-only), 'code' = edit files
      const requestMode = leftPanelMode === 'chat' ? 'chat' : 'edit';
      
      // Build conversation history for context (last 15 messages)
      const recentHistory = chatMessages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await supabase.functions.invoke('projects-generate', {
        body: {
          mode: requestMode,
          prompt: userMessage,
          currentFiles: generatedFiles,
          currentCode: codeContent,
          history: recentHistory, // Pass conversation history for context
          userInstructions: userInstructions, // Custom user instructions (appended to system prompt)
        },
      });
      
      if (response.error || !response.data?.ok) {
        throw new Error(response.data?.error || (leftPanelMode === 'chat' ? 'Failed to get answer' : 'Failed to edit project'));
      }

      // Step 2 complete, Step 3 loading
      setGenerationSteps(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'completed' } : 
        i === 1 ? { ...s, status: 'completed' } : 
        i === 2 ? { ...s, status: 'loading' } : s
      ));
      await delay(400);
      
      let assistantMsg: string;
      let snapshotToSave: any = null;
      
      // IMPORTANT: Save snapshot of CURRENT state BEFORE applying changes (for revert)
      const beforeSnapshot = Object.keys(generatedFiles).length > 0 ? { ...generatedFiles } : null;
      
      if (leftPanelMode === 'chat') {
        // Chat mode: AI returns a message (no file changes)
        assistantMsg = response.data.message || (isRTL ? 'لم أتمكن من الإجابة.' : 'I could not generate an answer.');
        // Complete all steps for chat mode
        setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
        await delay(300);
      } else {
        // Code mode: AI returns updated files AND a summary of what changed
        const newFiles = response.data.files || {};
        const newCode = response.data.code || newFiles["/App.js"] || "";
        
        // Save the BEFORE state as snapshot (so user can revert to it)
        snapshotToSave = beforeSnapshot;
        
        // Update state with NEW files
        setGeneratedFiles(newFiles);
        setCodeContent(newCode);
        
        // Save to database
        const filesJson = JSON.stringify(newFiles);
        await (supabase
          .from('project_files' as any)
          .update({ content: filesJson })
          .eq('project_id', id)
          .eq('path', 'index.html') as any);
        
        // Use the AI's summary of what changed (like Cascade does)
        assistantMsg = response.data.message || (isRTL ? 'تم تطبيق التعديلات! ✓' : 'Changes applied! ✓');
        
        // All steps complete
        setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
        await delay(300);
      }
      
      // Save assistant message to DB with snapshot
      const { data: assistantMsgData, error: assistError } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'assistant', 
          content: assistantMsg,
          snapshot: snapshotToSave 
        } as any)
        .select()
        .single();

      if (assistError) console.error('Error saving assistant message:', assistError);
      if (assistantMsgData) setChatMessages(prev => [...prev, assistantMsgData as any]);
      else {
        setChatMessages(prev => [...prev, {
          id: `edit-${Date.now()}`,
          role: 'assistant',
          content: assistantMsg,
          snapshot: snapshotToSave
        }]);
      }

      // Generate dynamic suggestions based on what was just done - ALWAYS parse the message content
      const generateContextualSuggestions = (msg: string): string[] => {
        const msgLower = msg.toLowerCase();
        
        // Parse the AI response to find what was changed and suggest relevant follow-ups
        if (msgLower.includes('gradient') || msgLower.includes('color') || msgLower.includes('لون')) {
          return [
            isRTL ? 'أضف تأثير ظل' : 'Add shadow effect',
            isRTL ? 'غيّر الخط' : 'Change the font'
          ];
        }
        if (msgLower.includes('title') || msgLower.includes('heading') || msgLower.includes('عنوان')) {
          return [
            isRTL ? 'غيّر حجم العنوان' : 'Change title size',
            isRTL ? 'أضف عنوان فرعي' : 'Add a subtitle'
          ];
        }
        if (msgLower.includes('button') || msgLower.includes('زر')) {
          return [
            isRTL ? 'أضف تأثير hover' : 'Add hover effect',
            isRTL ? 'غيّر حجم الزر' : 'Resize the button'
          ];
        }
        if (msgLower.includes('section') || msgLower.includes('قسم')) {
          return [
            isRTL ? 'أضف قسم آخر' : 'Add another section',
            isRTL ? 'حسّن التباعد' : 'Improve spacing'
          ];
        }
        if (msgLower.includes('image') || msgLower.includes('صورة') || msgLower.includes('photo')) {
          return [
            isRTL ? 'أضف صورة أخرى' : 'Add another image',
            isRTL ? 'غيّر حجم الصورة' : 'Resize the image'
          ];
        }
        if (msgLower.includes('fix') || msgLower.includes('error') || msgLower.includes('إصلاح') || msgLower.includes('bug')) {
          return [
            isRTL ? 'تحقق من الأخطاء الأخرى' : 'Check for other issues',
            isRTL ? 'حسّن الأداء' : 'Improve performance'
          ];
        }
        if (msgLower.includes('font') || msgLower.includes('text') || msgLower.includes('خط')) {
          return [
            isRTL ? 'غيّر اللون' : 'Change the color',
            isRTL ? 'أضف تأثير' : 'Add an effect'
          ];
        }
        if (msgLower.includes('animation') || msgLower.includes('effect') || msgLower.includes('تأثير')) {
          return [
            isRTL ? 'أضف تأثير آخر' : 'Add another effect',
            isRTL ? 'غيّر السرعة' : 'Change the speed'
          ];
        }
        if (msgLower.includes('layout') || msgLower.includes('تخطيط') || msgLower.includes('spacing')) {
          return [
            isRTL ? 'حسّن التباعد' : 'Improve spacing',
            isRTL ? 'غيّر المحاذاة' : 'Change alignment'
          ];
        }
        
        // Default suggestions
        return [
          isRTL ? 'أضف ميزة جديدة' : 'Add a new feature',
          isRTL ? 'حسّن التصميم' : 'Improve the design'
        ];
      };
      
      setDynamicSuggestions(generateContextualSuggestions(assistantMsg));
    } catch (err: any) {
      console.error('AI error:', err);
      const errorMsg = isRTL ? 'عذرًا، حدث خطأ. حاول مرة أخرى.' : 'Sorry, an error occurred. Please try again.';
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMsg 
      }]);
      toast.error(err.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setAiEditing(false);
    }
  };

  const getDeviceWidth = () => {
    switch (deviceView) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
    }
  };

  const deviceOptions = [
    { id: 'desktop' as DeviceView, icon: Monitor, label: isRTL ? 'سطح المكتب' : 'Desktop' },
    { id: 'tablet' as DeviceView, icon: Tablet, label: isRTL ? 'تابلت' : 'Tablet' },
    { id: 'mobile' as DeviceView, icon: Smartphone, label: isRTL ? 'موبايل' : 'Mobile' },
  ];

  // Only show loading spinner if NOT generating - during generation we show the full UI
  if (loading && !isGenerating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // During generation, use a placeholder project if not loaded yet
  const displayProject = project || (isGenerating ? {
    id: id || '',
    name: isRTL ? 'جاري الإنشاء...' : 'Generating...',
    slug: 'generating',
    description: '',
    template_type: 'ai-generated',
    status: 'generating',
    published_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : null);

  if (!displayProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{isRTL ? 'المشروع غير موجود' : 'Project not found'}</p>
        <Button variant="link" onClick={() => navigate('/projects')}>
          {isRTL ? 'العودة للمشاريع' : 'Back to Projects'}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[calc(100vh-64px)] bg-background overflow-hidden", isRTL && "rtl")}>
      {/* Enhanced Top Header Bar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border/50 bg-gradient-to-r from-background via-background to-indigo-500/5 dark:to-indigo-500/10 backdrop-blur-xl shrink-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          {/* Back button and Status Badge stacked */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <button 
              onClick={() => navigate('/projects')} 
              className="p-1.5 md:p-2 rounded-xl bg-muted/50 dark:bg-white/5 border border-border/50 hover:border-indigo-500/30 hover:bg-indigo-500/10 text-muted-foreground hover:text-indigo-500 transition-all active:scale-95"
              title={isRTL ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            <span className={cn(
              "px-1 md:px-1.5 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold uppercase tracking-wider",
              displayProject.status === 'published' 
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                : displayProject.status === 'generating'
                ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 animate-pulse"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            )}>
              {displayProject.status === 'published' ? (isRTL ? 'منشور' : 'Live') : 
               displayProject.status === 'generating' ? (isRTL ? 'بناء' : 'Building') :
               (isRTL ? 'مسودة' : 'Draft')}
            </span>
          </div>
          
          {/* Project name only - Truncated for mobile */}
          <h1 className="font-semibold text-xs md:text-sm leading-tight line-clamp-1 min-w-0 max-w-[120px] xs:max-w-[150px] sm:max-w-[200px] md:max-w-[350px]">
            {displayProject.name}
          </h1>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-1">
          {/* Action buttons - icon only on mobile for better fit */}
          <div className="flex items-center gap-1 md:gap-1.5">
            {displayProject.published_url && (
              <button 
                onClick={() => window.open(displayProject.published_url!, '_blank')}
                className="p-1.5 md:p-2 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/50 text-muted-foreground hover:text-foreground hover:border-indigo-500/30 transition-all active:scale-95"
                title={isRTL ? 'عرض' : 'View Live'}
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button 
              onClick={downloadProject} 
              className="p-1.5 md:p-2 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/50 text-muted-foreground hover:text-foreground hover:border-indigo-500/30 transition-all active:scale-95"
              title={isRTL ? 'تحميل' : 'Download'}
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              onClick={publishProject}
              disabled={publishing}
              className={cn(
                "h-8 md:h-10 px-2.5 md:px-4 rounded-xl font-semibold text-[10px] md:text-xs flex items-center gap-1.5 md:gap-2 transition-all active:scale-95 shrink-0",
                "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30",
                "hover:shadow-xl hover:shadow-indigo-500/40 hover:from-indigo-600 hover:to-purple-700",
                publishing && "opacity-70 pointer-events-none"
              )}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              <span className="hidden xs:inline">{isRTL ? 'نشر' : 'Publish'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Mobile Navigation Segmented Toggle */}
      <div className="md:hidden px-4 py-2 bg-background/50 backdrop-blur-sm border-b border-border/40 shrink-0">
        <div className="relative flex p-1 bg-muted/30 dark:bg-white/5 rounded-2xl border border-border/50">
          {/* Animated sliding background pill */}
          <div 
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-800 rounded-xl shadow-lg transition-all duration-300 ease-out z-0",
              mobileTab === 'chat' ? "left-1" : "left-[calc(50%+1px)]"
            )}
          />
          
          <button
            onClick={() => setMobileTab('chat')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all relative z-10",
              mobileTab === 'chat' 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className={cn("h-4 w-4 transition-transform duration-300", mobileTab === 'chat' && "scale-110")} />
            {isRTL ? 'دردشة' : 'Chat'}
          </button>
          
          <button
            onClick={() => setMobileTab('preview')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all relative z-10",
              mobileTab === 'preview' 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className={cn("h-4 w-4 transition-transform duration-300", mobileTab === 'preview' && "scale-110")} />
            {isRTL ? 'معاينة' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Main Studio Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Panel - Cascade-style Control Center */}
        <div className={cn(
          "flex flex-col border-r transition-all duration-300",
          "bg-background dark:bg-[#0c0f14]",
          "md:w-[420px] lg:w-[480px] shrink-0",
          mobileTab === 'preview' ? "hidden md:flex" : "flex w-full",
          "max-h-full"
        )}>
          {/* Mode Toggle: Chat / Code - Like Cascade */}
          <div className="flex items-center justify-between border-b border-border/50 dark:border-white/10 px-3 py-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Brain Icon - Opens Instructions Drawer */}
              <button
                onClick={() => {
                  setTempInstructions(userInstructions);
                  setInstructionsDrawerOpen(true);
                }}
                className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/30 hover:via-pink-500/30 hover:to-orange-500/30 transition-all active:scale-95 group"
                title={isRTL ? 'تعليمات المشروع' : 'Project Instructions'}
              >
                <Brain className="h-4 w-4 text-purple-500 group-hover:text-purple-400 transition-colors" />
              </button>

              <div className="flex bg-muted/50 dark:bg-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setLeftPanelMode('chat')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    leftPanelMode === 'chat' 
                      ? "bg-emerald-500 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? 'وضع المحادثة - اسأل أسئلة، ناقش، احصل على مساعدة' : 'Chat mode - Ask questions, discuss, get help'}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {isRTL ? 'محادثة' : 'Chat'}
                </button>
                <button
                  onClick={() => setLeftPanelMode('code')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    leftPanelMode === 'code' 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? 'وضع الكود - AI يعدل الكود مباشرة' : 'Code mode - AI edits code directly'}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {isRTL ? 'كود' : 'Code'}
                </button>
              </div>
            </div>
            
            {leftPanelMode === 'code' && (
              <Button size="sm" variant="ghost" onClick={saveCode} disabled={saving} className="h-7 text-[10px] uppercase font-bold tracking-tight">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            )}
          </div>

          {/* Generated Files - Compact at top */}
          {false && Object.keys(generatedFiles).length > 0 && leftPanelMode === 'chat' && (
            <div className="border-b border-border/50 dark:border-white/10 px-3 py-2 shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileCode className="h-3 w-3 text-indigo-500" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {isRTL ? 'الملفات' : 'Files'}
                </span>
                <span className="text-[10px] ml-auto font-medium text-indigo-500">
                  {Object.keys(generatedFiles).length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(generatedFiles).slice(0, 6).map((filePath) => (
                  <button 
                    key={filePath}
                    className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors text-[10px] bg-indigo-500/10 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                    onClick={() => setRightPanelMode('code')}
                  >
                    <Check className="h-2.5 w-2.5" />
                    {filePath.replace(/^\//, '').split('/').pop()}
                  </button>
                ))}
                {Object.keys(generatedFiles).length > 6 && (
                  <span className="text-[10px] text-muted-foreground px-2 py-0.5">
                    +{Object.keys(generatedFiles).length - 6} {isRTL ? 'أخرى' : 'more'}
                  </span>
                )}
              </div>
            </div>
          )}

          {(leftPanelMode === 'chat' || leftPanelMode === 'code') && (
            <>
              {/* Chat Messages Area - Clean bubbles, no avatars */}
              <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {/* Show More Button - at top if there are hidden messages */}
                {chatMessages.length > visibleMessagesCount && (
                  <button
                    onClick={() => setVisibleMessagesCount(prev => prev + MESSAGES_PER_PAGE)}
                    className="w-full py-2 px-4 mb-2 flex items-center justify-center gap-2 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/5 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-all"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    {isRTL ? `عرض ${Math.min(MESSAGES_PER_PAGE, chatMessages.length - visibleMessagesCount)} رسائل أقدم` : `Show ${Math.min(MESSAGES_PER_PAGE, chatMessages.length - visibleMessagesCount)} older messages`}
                  </button>
                )}
                
                {/* Only show the last N messages (paginated from the end) */}
                {chatMessages.slice(-visibleMessagesCount).map((msg, i) => {
                  // Check if this is an AI message with an actionable plan (more flexible detection)
                  const suggestsSwitchToCode = msg.role === 'assistant' && leftPanelMode === 'chat' &&
                    (msg.content.includes('Ready to implement') || 
                     msg.content.includes('Switch to Code mode') ||
                     msg.content.includes('switch to Code mode') ||
                     msg.content.includes('Proposed Plan') ||
                     msg.content.includes('### Proposed') ||
                     msg.content.includes('steps to') ||
                     msg.content.includes('Here\'s how') ||
                     msg.content.includes('To apply') ||
                     msg.content.includes('Ready to apply') ||
                     msg.content.includes('Ready to discuss how to apply'));
                  
                  return (
                    <div key={i} className={cn(
                      "flex flex-col group",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "max-w-[90%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                        msg.role === 'user' 
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-muted/60 dark:bg-white/5 text-foreground rounded-bl-md border border-border/30 dark:border-white/10"
                      )}>
                        {msg.content}
                      </div>
                      
                      {/* Revert Button - Right below the AI message */}
                      {msg.role === 'assistant' && msg.snapshot && (
                        <button
                          onClick={() => handleRevert(msg.id)}
                          className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 transition-all active:scale-95"
                          title={isRTL ? 'الرجوع لهذه النقطة' : 'Revert to this point'}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {isRTL ? 'استعادة' : 'Restore'}
                        </button>
                      )}
                      
                      {/* Show "Implement Plan" chip if AI suggests it - clicking executes the plan */}
                      {suggestsSwitchToCode && leftPanelMode === 'chat' && (
                        <button
                          onClick={() => {
                            // Switch to Code mode and auto-send "Proceed" to implement the plan
                            setLeftPanelMode('code');
                            // Small delay to let mode switch, then trigger implementation
                            setTimeout(() => {
                              const proceedMessage = isRTL ? 'نفذ الخطة' : 'Proceed with the plan';
                              setChatInput(proceedMessage);
                              // Trigger submit after setting input
                              setTimeout(() => {
                                const form = document.querySelector('form');
                                if (form) form.requestSubmit();
                              }, 100);
                            }, 200);
                          }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-95"
                        >
                          <Sparkles className="h-3 w-3" />
                          {isRTL ? 'تنفيذ الخطة' : 'Implement Plan'}
                        </button>
                      )}
                    </div>
                  );
                })}
                  
                  {/* AI Working Indicator */}
                  {(isGenerating || aiEditing) && (
                    <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-[100]">
                      <div 
                        ref={thinkingBoxRef}
                        className="bg-muted/60 dark:bg-zinc-900/80 border border-border/30 dark:border-white/10 rounded-2xl rounded-bl-md px-4 py-3 space-y-3 max-w-[95%] shadow-sm relative z-10 overflow-visible ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      >
                        {/* Trace Flow Loader - Browser animation (Chat mode only) */}
                        {leftPanelMode === 'chat' && (
                          <div className="w-full h-[140px] rounded-lg overflow-hidden bg-zinc-950/50 mb-2">
                            <TraceFlowLoader />
                          </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center gap-2 relative z-20">
                          <Sparkles className={cn(
                            "h-4 w-4 animate-pulse",
                            leftPanelMode === 'chat' ? "text-emerald-500" : "text-blue-500"
                          )} />
                          <p className="text-[13px] text-foreground font-medium">
                            {isGenerating 
                              ? (isRTL ? 'جاري إنشاء مشروعك...' : 'Building your project...') 
                              : leftPanelMode === 'chat'
                                ? (isRTL ? 'جاري التفكير...' : 'Thinking...')
                                : (isRTL ? 'جاري تطبيق التعديلات...' : 'Applying your changes...')}
                          </p>
                        </div>
                        
                        {/* Progress Steps */}
                        {(isGenerating || aiEditing) && generationSteps.length > 0 && (
                          <div className="space-y-1.5 pl-6">
                            {generationSteps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                {step.status === 'completed' ? (
                                  <div className={cn(
                                    "w-4 h-4 rounded-full flex items-center justify-center",
                                    leftPanelMode === 'chat' ? "bg-emerald-500" : "bg-blue-500"
                                  )}>
                                    <Check className="h-2.5 w-2.5 text-white" />
                                  </div>
                                ) : step.status === 'loading' ? (
                                  <div className={cn(
                                    "w-5 h-5 rounded-full border-[3px] border-t-transparent animate-spin",
                                    leftPanelMode === 'chat' ? "border-emerald-500" : "border-blue-500"
                                  )} />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />
                                )}
                                <span className={cn(
                                  "text-[11px]",
                                  step.status === 'completed' ? (leftPanelMode === 'chat' ? "text-emerald-500" : "text-blue-500") :
                                  step.status === 'loading' ? "text-foreground font-medium" :
                                  "text-muted-foreground"
                                )}>
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {(isGenerating || aiEditing) && generationSteps.length === 0 && (
                          <div className="flex items-center gap-2 pl-6">
                            <div className={cn(
                              "w-5 h-5 border-[3px] border-t-transparent rounded-full animate-spin",
                              leftPanelMode === 'chat' ? "border-emerald-500" : "border-blue-500"
                            )} />
                            <span className="text-[11px] text-foreground">
                              {isRTL ? 'معالجة...' : 'Processing...'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} className="h-2" />
                </div>

                {/* Self-Healing: Runtime Error Alert */}
                {crashReport && (
                  <div className="mx-4 mb-2 p-3 bg-red-900/20 border border-red-500/40 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-red-200">{isRTL ? 'تم اكتشاف خطأ' : 'Runtime Error Detected'}</h4>
                        <p className="text-[10px] text-red-300/70 truncate max-w-[200px]">{crashReport}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleAutoFix}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 active:scale-95"
                    >
                      <Wand2 className="w-3 h-3" />
                      {isRTL ? 'إصلاح تلقائي' : 'Auto-Fix'}
                    </button>
                  </div>
                )}

                {/* Chat Input Area - Clean with inline suggestions */}
                <div className="p-2 border-t border-border/30 dark:border-white/10 shrink-0 space-y-1.5 bg-background/50 backdrop-blur-sm">
                  {/* Inline Suggestions + Jump to Bottom Button */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {/* Dynamic suggestions (2 chips) - update based on last AI response */}
                      {(dynamicSuggestions.length > 0 
                        ? dynamicSuggestions 
                        : [
                            isRTL ? 'أضف ميزة جديدة' : 'Add a new feature',
                            isRTL ? 'حسّن التصميم' : 'Improve the design',
                          ]
                      ).slice(0, 2).map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setChatInput(suggestion)}
                          className={cn(
                            "px-3 py-1 text-[11px] font-medium border rounded-full transition-all",
                            "bg-indigo-500/10 dark:bg-indigo-500/5 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40"
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    
                    {/* Jump to Bottom Button */}
                    <button
                      onClick={() => {
                        if (chatContainerRef.current) {
                          chatContainerRef.current.scrollTo({
                            top: chatContainerRef.current.scrollHeight,
                            behavior: 'smooth'
                          });
                        }
                      }}
                      className="p-2 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all active:scale-95 shrink-0"
                      title={isRTL ? 'انتقل للأسفل' : 'Jump to bottom'}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="relative flex flex-col gap-2">
                    <form onSubmit={handleChatSubmit} className={cn(
                      "flex items-end gap-2 bg-muted/30 dark:bg-white/5 border rounded-2xl p-1.5 transition-all",
                      leftPanelMode === 'chat'
                        ? "border-emerald-500/40 dark:border-emerald-500/30 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20"
                        : "border-blue-600/40 dark:border-blue-600/30 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600/20"
                    )}>
                      <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={leftPanelMode === 'code' 
                          ? (isRTL ? 'وضع الكود مفعل: لدي الصلاحية لتعديل ملفات المشروع مباشرة...' : 'Code Mode Active: I have permission to modify project files directly...') 
                          : (isRTL ? 'اكتب رسالتك...' : 'Type your message...')}
                        className={cn(
                          "flex-1 min-h-[44px] max-h-[160px] bg-transparent border-0 focus-visible:ring-0 rounded-xl resize-none py-2.5 px-3 text-[13px] placeholder:opacity-60",
                          aiEditing && "opacity-50 pointer-events-none"
                        )}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                          }
                        }}
                      />
                      
                      {/* Send Button with action buttons above */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {/* Action buttons - smaller, above send */}
                        <div className="flex flex-col gap-1">
                          {/* Upload Button */}
                          <button
                            type="button"
                            onClick={() => toast.info(isRTL ? 'قريباً: رفع الملفات' : 'Coming soon: File upload')}
                            className="h-6 w-6 rounded-md bg-muted/50 dark:bg-white/5 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-90"
                            title={isRTL ? 'رفع ملف' : 'Upload file'}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          
                          {/* AMP Button - Amplify/Enhance prompt */}
                          <button
                            type="button"
                            disabled={!chatInput.trim() || isAmplifying || aiEditing}
                            onClick={async () => {
                              if (!chatInput.trim()) return;
                              setIsAmplifying(true);
                              try {
                                const response = await supabase.functions.invoke('projects-amp-prompt', {
                                  body: { prompt: chatInput, mode: leftPanelMode }
                                });
                                if (response.data?.amplified) {
                                  setChatInput(response.data.amplified);
                                  toast.success(isRTL ? 'تم تحسين الطلب!' : 'Prompt amplified!');
                                } else {
                                  toast.error(isRTL ? 'فشل في التحسين' : 'Failed to amplify');
                                }
                              } catch (err) {
                                console.error('AMP error:', err);
                                toast.error(isRTL ? 'خطأ في التحسين' : 'Amplify error');
                              } finally {
                                setIsAmplifying(false);
                              }
                            }}
                            className={cn(
                              "h-6 w-6 rounded-md border flex items-center justify-center transition-all active:scale-90",
                              chatInput.trim() && !isAmplifying
                                ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-500 hover:from-amber-500/30 hover:to-orange-500/30"
                                : "bg-muted/30 border-border/30 text-muted-foreground/50"
                            )}
                            title={isRTL ? 'تحسين الطلب' : 'Amplify prompt'}
                          >
                            {isAmplifying ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        
                        {/* Send Button */}
                        <Button 
                          type="submit"
                          disabled={!chatInput.trim() || aiEditing || isGenerating}
                          size="icon"
                          className={cn(
                            "h-[40px] w-[40px] rounded-xl transition-all shrink-0 shadow-sm text-white",
                            chatInput.trim() 
                              ? (leftPanelMode === 'chat' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20")
                              : "bg-muted dark:bg-white/10 text-muted-foreground"
                          )}
                        >
                          {aiEditing || isGenerating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Send className={cn("h-5 w-5", isRTL && "rotate-180")} />
                          )}
                        </Button>
                      </div>
                    </form>
                    
                    <div className="flex items-center justify-center gap-2 opacity-60">
                      <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-500/30" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                        {isRTL ? 'مدعوم بواسطة وقتي AI' : 'Powered by Wakti AI'}
                      </span>
                      <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-500/30" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        {/* Right Panel - Studio Canvas */}
        <div className={cn(
          "flex-1 flex flex-col bg-[#0c0f14] relative h-full",
          mobileTab === 'chat' ? "hidden md:flex" : "flex w-full h-full"
        )}>
          {/* Preview Header - Compact */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              {/* Device Switcher - visible on all screens */}
              <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-white/5">
                {deviceOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setDeviceView(option.id)}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      deviceView === option.id 
                        ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30" 
                        : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                    )}
                    title={option.label}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              
              <div className="h-4 w-px bg-white/10 hidden xs:block" />
              
              <button 
                onClick={() => {
                  const el = document.querySelector('.sandpack-preview-container');
                  if (el) el.requestFullscreen?.();
                }}
                className="p-1.5 text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                title={isRTL ? 'ملء الشاشة' : 'Fullscreen'}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-bold hidden sm:inline">{isRTL ? 'كامل الشاشة' : 'Fullscreen'}</span>
              </button>
              
              <button 
                onClick={captureScreenshot}
                className="p-1.5 text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors border border-indigo-500/20 rounded-md bg-indigo-500/5"
                title={isRTL ? 'لقطة شاشة' : 'Screenshot'}
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-bold hidden sm:inline">{isRTL ? 'لقطة' : 'Screenshot'}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={refreshPreview}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Preview/Code Content - Full Height */}
          <div className="flex-1 sandpack-preview-container relative min-h-0">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              </div>
            }>
              {(codeContent || Object.keys(generatedFiles).length > 0) ? (
                <div className="w-full h-full flex items-center justify-center relative">
                  <MatrixOverlay isVisible={aiEditing && leftPanelMode === 'code'} />
                  <div className={cn(
                    "h-full w-full transition-all flex flex-col",
                    deviceView === 'desktop' && "max-w-full",
                    deviceView === 'tablet' && "max-w-[768px]",
                    deviceView === 'mobile' && "max-w-[390px]"
                  )}>
                    <SandpackStudio 
                      key={`sandpack-studio-${sandpackKey}`}
                      files={Object.keys(generatedFiles).length > 0 ? generatedFiles : { "/App.js": codeContent || "" }}
                      onRuntimeError={handleRuntimeCrash}
                      elementSelectMode={elementSelectMode}
                      onElementSelect={(ref, elementInfo) => {
                        if (elementInfo) setSelectedElementInfo(elementInfo);
                        setChatInput(prev => prev + (prev ? ' ' : '') + ref + ' ');
                        setElementSelectMode(false);
                        toast.success(isRTL ? 'تم تحديد العنصر!' : 'Element selected!');
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white">
                  <div className="text-center space-y-4">
                    <Sparkles className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                    <p className="text-sm text-zinc-400">Enter a prompt to generate your project</p>
                  </div>
                </div>
              )}
            </Suspense>
            
            {/* Selected Element Floating Bar */}
            {selectedElementInfo && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-indigo-500/50 p-3 rounded-xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5 max-w-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 text-xs font-mono bg-indigo-500/20 px-2 py-0.5 rounded font-bold">
                      {selectedElementInfo.tagName}
                    </span>
                    <span className="text-zinc-400 text-xs">selected</span>
                  </div>
                  <p className="text-white text-sm truncate mt-1">
                    "{selectedElementInfo.innerText.substring(0, 40)}..."
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedElementInfo(null)}
                  className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                  title={isRTL ? 'إغلاق' : 'Dismiss'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions Drawer - Slides from Left */}
      <div 
        className={cn(
          "fixed inset-0 z-[1000] transition-all duration-300",
          instructionsDrawerOpen ? "visible" : "invisible"
        )}
      >
        <div 
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            instructionsDrawerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setInstructionsDrawerOpen(false)}
        />
        
        <div 
          className={cn(
            "absolute top-0 left-0 h-full w-full max-w-xl bg-background dark:bg-[#0c0f14] border-r border-border/50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
            instructionsDrawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-purple-500/30">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isRTL ? 'التعليمات' : 'Instructions'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'أضف تعليمات مخصصة لمشروعك' : 'Add custom instructions for your project'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setInstructionsDrawerOpen(false)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <Textarea
              value={tempInstructions}
              onChange={(e) => setTempInstructions(e.target.value)}
              placeholder={isRTL ? 'أضف تعليمات هنا...' : 'Add instructions here...'}
              className="min-h-[300px] bg-muted/30 dark:bg-white/5 border-border/50 dark:border-white/10 text-sm font-mono resize-none focus-visible:ring-purple-500/50"
            />
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border/50 dark:border-white/10 shrink-0 bg-muted/20 dark:bg-white/5">
            <Button variant="ghost" onClick={() => setInstructionsDrawerOpen(false)} className="text-muted-foreground">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                setUserInstructions(tempInstructions);
                setInstructionsDrawerOpen(false);
                toast.success(isRTL ? 'تم حفظ التعليمات!' : 'Instructions saved!');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isRTL ? 'حفظ التعليمات' : 'Save Instructions'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
