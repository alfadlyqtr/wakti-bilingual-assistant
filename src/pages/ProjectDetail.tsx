import React, { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Palette, 
  Send, 
  AlertTriangle, 
  Wand2, 
  MousePointer2, 
  X,
  Camera,
  Copy,
  Edit2
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
  thumbnail_url?: string | null;
  subdomain?: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
}

type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

type GenerationJob = {
  id: string;
  project_id: string;
  status: GenerationJobStatus;
  mode: 'create' | 'edit';
  error: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
};


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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // Multi-file support (like Google AI Studio)
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  
  // Left panel state
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiEditing, setAiEditing] = useState(false);
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string }>>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const autoCaptureTimeoutRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<{ label: string, status: 'pending' | 'loading' | 'completed' | 'error' }[]>([]);

  useEffect(() => {
    return () => {
      if (autoCaptureTimeoutRef.current) {
        window.clearTimeout(autoCaptureTimeoutRef.current);
        autoCaptureTimeoutRef.current = null;
      }
    };
  }, []);
  
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

  const [creationPromptInfo, setCreationPromptInfo] = useState<{
    userPrompt: string;
    themeId: string;
    themeInstructions: string;
    finalPrompt: string;
  } | null>(null);
  
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

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

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
      const themeInstructionsParam = searchParams.get('themeInstructions');
      
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
        
        // Decode custom theme instructions if provided
        let customInstructions = '';
        if (themeInstructionsParam) {
          try {
            customInstructions = decodeURIComponent(themeInstructionsParam);
            // Also save to userInstructions state so it persists
            setUserInstructions(customInstructions);
          } catch (e) {
            console.error('Failed to parse theme instructions:', e);
          }
        }

        const themeId = theme || 'wakti-dark';
        const injectedThemeBlock = customInstructions
          ? `\n\n--- THEME (selected by user: ${themeId}) ---\n${customInstructions}`
          : `\n\n--- THEME (selected by user: ${themeId}) ---`;
        const finalPrompt = `${prompt}${injectedThemeBlock}`;
        setCreationPromptInfo({
          userPrompt: prompt,
          themeId,
          themeInstructions: customInstructions,
          finalPrompt,
        });
        
        setSearchParams({}, { replace: true });
        runGeneration(prompt, themeId, assets, customInstructions);
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

      // Save to database - delete old files and insert new ones from snapshot
      // First delete all existing files for this project
      await (supabase
        .from('project_files' as any)
        .delete()
        .eq('project_id', id) as any);
      
      // Then insert all files from the snapshot
      const fileRows = Object.entries(snapshot).map(([path, content]) => ({
        project_id: id,
        path: path.startsWith('/') ? path : `/${path}`,
        content: content as string,
      }));
      
      if (fileRows.length > 0) {
        await (supabase
          .from('project_files' as any)
          .insert(fileRows) as any);
      }

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

  const runGeneration = async (prompt: string, theme: string, assets: string[] = [], customThemeInstructions: string = '') => {
    setIsGenerating(true);
    setLeftPanelMode('code'); // Start in Code mode so user sees the preview building
    
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

      const injectedThemeBlock = customThemeInstructions
        ? `\n\n--- THEME (selected by user: ${theme}) ---\n${customThemeInstructions}`
        : `\n\n--- THEME (selected by user: ${theme}) ---`;
      const finalPrompt = `${prompt}${injectedThemeBlock}`;
      setCreationPromptInfo({
        userPrompt: prompt,
        themeId: theme,
        themeInstructions: customThemeInstructions,
        finalPrompt,
      });
      
      // Step 3: Generating
      setGenerationSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'completed' } : i === 2 ? { ...s, status: 'loading' } : s));

      // Option A: start job then poll
      const startRes = await supabase.functions.invoke('projects-generate', {
        body: {
          action: 'start',
          projectId: id,
          mode: 'create',
          prompt: finalPrompt,
          theme,
          assets,
          userInstructions: customThemeInstructions,
        },
      });

      if (startRes.error) {
        throw new Error(startRes.error.message || 'Failed to start generation');
      }

      const jobId = startRes.data?.jobId as string | undefined;
      if (!jobId) throw new Error('Missing jobId');

      await pollJobUntilDone(jobId);

      // Step 4: Finalizing
      setGenerationSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'completed' } : i === 3 ? { ...s, status: 'loading' } : s));

      const generatedFilesData = await loadFilesFromDb(id as string);
      const generatedCode = generatedFilesData["/App.js"] || Object.values(generatedFilesData)[0] || "";

      if (!generatedCode || Object.keys(generatedFilesData).length === 0) {
        throw new Error('No code returned from AI');
      }

      setGeneratedFiles(generatedFilesData);
      setCodeContent(generatedCode);

      // Save assistant message to DB with snapshot (remind user to save thumbnail)
      const assistantMsg = isRTL 
        ? 'لقد انتهيت من بناء مشروعك! ألقِ نظرة على المعاينة. 📸 اضغط على زر "حفظ صورة" لحفظ صورة مصغرة.' 
        : "I've finished building your project! Take a look at the preview. 📸 Click 'Save Thumbnail' to save a thumbnail.";
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

      // Preferred (Option A): one row per file
      const mapFromRows: Record<string, string> = {};
      for (const row of (filesData || []) as ProjectFile[]) {
        const p = row.path?.startsWith('/') ? row.path : `/${row.path}`;
        mapFromRows[p] = row.content;
      }

      // Legacy support: projects used to store a JSON blob inside path='index.html'
      if (Object.keys(mapFromRows).length === 0) {
        const legacyIndexFile = (filesData || []).find((f: ProjectFile) => f.path === 'index.html');
        if (legacyIndexFile?.content) {
          try {
            const parsed = JSON.parse(legacyIndexFile.content);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setGeneratedFiles(parsed);
              setCodeContent(parsed["/App.js"] || Object.values(parsed)[0] || "");
            } else {
              setCodeContent(legacyIndexFile.content);
            }
          } catch {
            setCodeContent(legacyIndexFile.content);
          }
        }
      } else {
        setGeneratedFiles(mapFromRows);
        setCodeContent(mapFromRows["/App.js"] || Object.values(mapFromRows)[0] || "");
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
    try {
      setSaving(true);

      const filesToSave: Record<string, string> =
        Object.keys(generatedFiles).length > 0
          ? { ...generatedFiles }
          : { "/App.js": codeContent };

      // Ensure /App.js reflects editor text
      filesToSave["/App.js"] = codeContent;

      const rows = Object.entries(filesToSave).map(([path, content]) => ({
        project_id: id,
        path,
        content,
      }));

      const { error } = await (supabase
        .from('project_files' as any)
        .upsert(rows, { onConflict: 'project_id,path' }) as any);

      if (error) throw error;

      // Refresh local rows list
      setFiles(prev => {
        const byPath = new Map<string, ProjectFile>();
        for (const f of prev) byPath.set(f.path, f);
        for (const [path, content] of Object.entries(filesToSave)) {
          const existing = byPath.get(path);
          if (existing) byPath.set(path, { ...existing, content });
          else byPath.set(path, { id: `local-${Date.now()}-${path}`, project_id: id as string, path, content });
        }
        return Array.from(byPath.values());
      });
      
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!');
      refreshPreview();
    } catch (err) {
      console.error('Error saving:', err);
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const pollJobUntilDone = async (jobId: string, timeoutMs: number = 180000): Promise<GenerationJob> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await supabase.functions.invoke('projects-generate', {
        body: { action: 'status', jobId }
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to check job status');
      }

      const job = (res.data?.job || null) as GenerationJob | null;
      if (!job) throw new Error('Job not found');

      if (job.status === 'succeeded') return job;
      if (job.status === 'failed') throw new Error(job.error || 'Generation failed');

      await delay(900);
    }

    throw new Error('Generation timed out');
  };

  const loadFilesFromDb = async (projectId: string): Promise<Record<string, string>> => {
    const res = await supabase.functions.invoke('projects-generate', {
      body: { action: 'get_files', projectId }
    });
    if (res.error) throw new Error(res.error.message || 'Failed to load files');
    const filesMap = (res.data?.files || {}) as Record<string, string>;
    return filesMap;
  };

  const refreshPreview = () => {
    // Sandpack auto-refreshes when code changes
    // Force a re-render by toggling the code
    setCodeContent(prev => prev + ' ');
    setTimeout(() => setCodeContent(prev => prev.trim()), 10);
  };

  // ============================================
  // FLATTENER/BUNDLER: BRUTE FORCE - Include EVERYTHING
  // ============================================
  const flattenProjectFiles = (files: Record<string, string>): string => {
    const allCss: string[] = [];
    const allJs: string[] = [];
    const processedFiles = new Set<string>();
    
    // ============================================
    // STEP 1: BRUTE FORCE CSS - Collect ALL .css files
    // ============================================
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath.endsWith('.css')) {
        let css = content;
        // Remove @tailwind directives (we use Tailwind CDN)
        css = css.replace(/@tailwind\s+[^;]+;/g, '');
        // Remove @import for external fonts (loaded via link tags)
        css = css.replace(/@import\s+url\([^)]+\);?/g, '');
        allCss.push(`/* ===== ${filePath} ===== */\n${css}`);
        processedFiles.add(filePath);
      }
    }
    
    // ============================================
    // STEP 2: BRUTE FORCE JSON - Convert ALL .json to JS objects
    // ============================================
    const jsonVars: string[] = [];
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath.endsWith('.json')) {
        try {
          // Create a variable name from the file path
          // e.g., /locales/en.json -> locales_en_json
          const varName = filePath
            .replace(/^\//, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_');
          jsonVars.push(`// JSON: ${filePath}\nconst ${varName} = ${content};`);
          processedFiles.add(filePath);
        } catch (e) {
          console.error(`Failed to process JSON ${filePath}:`, e);
        }
      }
    }
    
    // ============================================
    // Helper: Resolve import path to actual file
    // ============================================
    const resolveImportPath = (importPath: string, currentFile: string): string | null => {
      let cleanPath = importPath.replace(/['"`;]/g, '').trim();
      
      // Handle relative paths
      if (cleanPath.startsWith('./') || cleanPath.startsWith('../')) {
        const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/')) || '';
        const parts = cleanPath.split('/');
        let resolvedParts = currentDir.split('/').filter(p => p);
        
        for (const part of parts) {
          if (part === '.') continue;
          if (part === '..') resolvedParts.pop();
          else resolvedParts.push(part);
        }
        cleanPath = '/' + resolvedParts.join('/');
      }
      
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      
      // Try exact match first
      if (files[cleanPath]) return cleanPath;
      
      // Try with extensions
      for (const ext of ['', '.js', '.jsx', '.ts', '.tsx', '.json']) {
        if (files[cleanPath + ext]) return cleanPath + ext;
      }
      
      // Try index files
      for (const idx of ['/index.js', '/index.jsx', '/index.ts', '/index.tsx']) {
        if (files[cleanPath + idx]) return cleanPath + idx;
      }
      
      return null;
    };
    
    // ============================================
    // Helper: Strip imports/exports from JS content
    // ============================================
    const stripImportsExports = (content: string, filePath: string): string => {
      let result = content;
      const fileName = filePath.split('/').pop()?.replace(/\.(js|jsx|ts|tsx)$/, '') || 'Component';
      
      // Remove ALL import statements (both 'from' and side-effect imports)
      result = result.replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '');
      result = result.replace(/^import\s+['"][^'"]*['"];?\s*$/gm, '');
      
      // Handle exports
      result = result.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
      result = result.replace(/export\s+default\s+function\s*\(/g, `function ${fileName}(`);
      result = result.replace(/export\s+default\s+\(\s*\)\s*=>/g, `const ${fileName} = () =>`);
      result = result.replace(/export\s+default\s+\(([^)]*)\)\s*=>/g, `const ${fileName} = ($1) =>`);
      result = result.replace(/export\s+default\s+(\w+)\s*;?/g, '');
      result = result.replace(/export\s+function\s+/g, 'function ');
      result = result.replace(/export\s+const\s+/g, 'const ');
      result = result.replace(/export\s+(let|var)\s+/g, '$1 ');
      result = result.replace(/export\s+\{[^}]*\}\s*;?/g, '');
      
      // Clean up blank lines
      result = result.replace(/\n{3,}/g, '\n\n');
      
      return result.trim();
    };
    
    // ============================================
    // STEP 3: Process JS files with dependency ordering
    // ============================================
    const jsOrder: string[] = [];
    
    const processJsFile = (filePath: string) => {
      if (processedFiles.has(filePath)) return;
      if (!files[filePath]) return;
      if (!filePath.match(/\.(js|jsx|ts|tsx)$/)) return;
      
      processedFiles.add(filePath);
      const content = files[filePath];
      
      // Find ALL imports (including side-effect imports like `import './i18n'`)
      // Pattern 1: import X from 'path' or import { X } from 'path'
      const fromImports = content.matchAll(/import\s+(?:[\s\S]*?)\s*from\s+['"]([^'"]+)['"]/g);
      // Pattern 2: import 'path' (side-effect imports)
      const sideEffectImports = content.matchAll(/import\s+['"]([^'"]+)['"]\s*;?/g);
      
      const allImportPaths = new Set<string>();
      
      for (const match of fromImports) {
        const importPath = match[1];
        // Only process local imports
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          allImportPaths.add(importPath);
        }
      }
      
      for (const match of sideEffectImports) {
        const importPath = match[1];
        // Only process local imports
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          allImportPaths.add(importPath);
        }
      }
      
      // Process dependencies first (depth-first)
      for (const importPath of allImportPaths) {
        const resolved = resolveImportPath(importPath, filePath);
        if (resolved && !processedFiles.has(resolved)) {
          processJsFile(resolved);
        }
      }
      
      // Add this file to the order
      jsOrder.push(filePath);
    };
    
    // Start from App.js/App.jsx
    const appFile = files['/App.js'] ? '/App.js' : files['/App.jsx'] ? '/App.jsx' : null;
    if (appFile) {
      processJsFile(appFile);
    }
    
    // ============================================
    // STEP 4: BRUTE FORCE - Include ANY remaining JS files
    // ============================================
    for (const filePath of Object.keys(files)) {
      if (filePath.match(/\.(js|jsx|ts|tsx)$/) && !processedFiles.has(filePath)) {
        processJsFile(filePath);
      }
    }
    
    // ============================================
    // STEP 5: Build final JS bundle in correct order
    // ============================================
    // First: JSON variables
    if (jsonVars.length > 0) {
      allJs.push('// ========== JSON DATA ==========');
      allJs.push(...jsonVars);
    }
    
    // Then: All JS files in dependency order
    for (const filePath of jsOrder) {
      const content = files[filePath];
      if (content) {
        const processed = stripImportsExports(content, filePath);
        allJs.push(`// ========== ${filePath} ==========\n${processed}`);
      }
    }
    
    // ============================================
    // STEP 6: Build CSS injection script
    // ============================================
    const bundledCss = allCss.join('\n\n');
    const cssInjectionScript = bundledCss.length > 0 
      ? `// ========== CSS INJECTION ==========
(function() {
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(bundledCss)};
  document.head.appendChild(style);
})();`
      : '';
    
    // Final bundle: CSS injection first, then all JS
    const finalJs = cssInjectionScript + '\n\n' + allJs.join('\n\n');
    
    console.log('Bundler stats:', {
      cssFiles: allCss.length,
      jsonFiles: jsonVars.length,
      jsFiles: jsOrder.length,
      totalFiles: Object.keys(files).length
    });
    
    return JSON.stringify({ css: '', js: finalJs });
  };

  // Validate subdomain format
  const validateSubdomain = (value: string): string | null => {
    if (!value) return isRTL ? 'أدخل اسم الموقع' : 'Enter a site name';
    if (value.length < 3) return isRTL ? 'الاسم قصير جداً (3 أحرف على الأقل)' : 'Name too short (min 3 characters)';
    if (value.length > 30) return isRTL ? 'الاسم طويل جداً (30 حرف كحد أقصى)' : 'Name too long (max 30 characters)';
    if (!/^[a-z0-9-]+$/.test(value)) return isRTL ? 'استخدم أحرف صغيرة وأرقام وشرطات فقط' : 'Use only lowercase letters, numbers, and hyphens';
    if (value.startsWith('-') || value.endsWith('-')) return isRTL ? 'لا يمكن أن يبدأ أو ينتهي بشرطة' : 'Cannot start or end with a hyphen';
    if (['www', 'api', 'app', 'admin', 'mail', 'ftp', 'cdn', 'static'].includes(value)) {
      return isRTL ? 'هذا الاسم محجوز' : 'This name is reserved';
    }
    return null;
  };

  // Check if subdomain is available
  const checkSubdomainAvailability = async (value: string): Promise<boolean> => {
    try {
      setCheckingSubdomain(true);
      const { data, error } = await supabase
        .from('projects' as any)
        .select('id')
        .eq('subdomain', value.toLowerCase())
        .neq('id', project?.id || '')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking subdomain:', error);
        return false;
      }
      return !data; // Available if no data returned
    } finally {
      setCheckingSubdomain(false);
    }
  };

  // Open publish modal
  const openPublishModal = () => {
    // Pre-fill with existing subdomain or generate from project name
    const defaultSubdomain = project?.subdomain || 
      project?.name?.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 30) || '';
    setSubdomainInput(defaultSubdomain);
    setSubdomainError(null);
    setShowPublishModal(true);
  };

  // Handle subdomain input change
  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomainInput(cleaned);
    setSubdomainError(validateSubdomain(cleaned));
  };

  const publishProject = async () => {
    if (!project || !session?.access_token) return;

    // Validate subdomain
    const validationError = validateSubdomain(subdomainInput);
    if (validationError) {
      setSubdomainError(validationError);
      return;
    }

    // Check availability
    const isAvailable = await checkSubdomainAvailability(subdomainInput);
    if (!isAvailable) {
      setSubdomainError(isRTL ? 'هذا الاسم مستخدم بالفعل' : 'This name is already taken');
      return;
    }

    try {
      setPublishing(true);
      
      // Build the files to publish from generatedFiles (multi-file project)
      const projectFiles: Record<string, string> = 
        Object.keys(generatedFiles).length > 0 
          ? { ...generatedFiles } 
          : { "/App.js": codeContent };
      
      // Ensure /App.js has latest editor content
      if (codeContent) {
        projectFiles["/App.js"] = codeContent;
      }

      const finalSubdomain = subdomainInput.toLowerCase();

      // ============================================
      // REAL VERCEL DEPLOYMENT: Deploy as static site
      // ============================================
      console.log('Generating publishable HTML for Vercel deployment...');
      
      // Generate a self-contained index.html that runs the React app
      const indexHtml = generatePublishableIndexHtml(projectFiles, project.name || 'Wakti Project');
      console.log('Generated index.html size:', indexHtml.length);

      // Call the Edge Function to deploy to Vercel
      console.log('Deploying to Vercel via projects-publish...');
      const { data: publishResult, error: publishError } = await supabase.functions.invoke('projects-publish', {
        body: {
          projectName: project.name || 'Wakti Project',
          projectSlug: finalSubdomain,
          files: [
            { path: 'index.html', content: indexHtml }
          ]
        }
      });

      if (publishError) {
        console.error('Edge function error:', publishError);
        throw new Error(publishError.message || 'Failed to deploy');
      }

      if (!publishResult?.ok) {
        console.error('Publish failed:', publishResult);
        throw new Error(publishResult?.error || 'Deployment failed');
      }

      const subdomainUrl = publishResult.url || `https://${finalSubdomain}.wakti.ai`;
      console.log('Deployed successfully to:', subdomainUrl);

      // Update project in database with the published URL
      const { error: updateError } = await supabase
        .from('projects' as any)
        .update({
          status: 'published',
          published_url: subdomainUrl,
          subdomain: finalSubdomain,
          published_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      
      if (updateError) {
        console.error('Error updating project:', updateError);
        // Don't throw - the site is already deployed, just log the DB error
      }

      setProject(prev => prev ? {
        ...prev,
        status: 'published',
        published_url: subdomainUrl,
        subdomain: finalSubdomain,
      } : null);

      setShowPublishModal(false);
      toast.success(isRTL ? 'تم النشر بنجاح!' : 'Published successfully!');
    } catch (err: any) {
      console.error('Error publishing:', err);
      const errorMessage = err?.message || (isRTL ? 'فشل في النشر' : 'Failed to publish');
      toast.error(errorMessage);
    } finally {
      setPublishing(false);
    }
  };

  // Generate a proper index.html that loads React from CDN and runs the multi-file project
  const generatePublishableIndexHtml = (files: Record<string, string>, projectName: string): string => {
    // Collect all component/file paths (excluding App.js which we handle specially)
    const jsFiles = Object.keys(files).filter(f => f.endsWith('.js') && f !== '/App.js');
    const cssFiles = Object.keys(files).filter(f => f.endsWith('.css'));
    
    // Build inline CSS
    const inlineCss = cssFiles.map(f => files[f]).join('\n');
    
    // Sort JS files: data/utils/mock files first (they define data used by components)
    const sortedJsFiles = [...jsFiles].sort((a, b) => {
      const aIsData = a.includes('data') || a.includes('utils') || a.includes('mock') || a.includes('config') || a.includes('constants');
      const bIsData = b.includes('data') || b.includes('utils') || b.includes('mock') || b.includes('config') || b.includes('constants');
      if (aIsData && !bIsData) return -1;
      if (!aIsData && bIsData) return 1;
      return 0;
    });
    
    // Build component definitions - convert ES module syntax to browser-compatible
    const componentScripts = sortedJsFiles.map(filePath => {
      const content = files[filePath];
      const componentName = filePath.replace(/^\//, '').replace(/\.js$/, '').split('/').pop() || 'Component';
      // Wrap each component file content
      return `
// --- ${filePath} ---
${convertToGlobalComponent(content, componentName)}
`;
    }).join('\n');

    // Get App.js content and convert it
    const appJsContent = files['/App.js'] || '';
    const appComponent = convertToGlobalComponent(appJsContent, 'App');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    body { margin: 0; padding: 0; min-height: 100vh; background: #fff; }
    #root { min-height: 100vh; }
    ${inlineCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, Fragment } = React;
    
    // Framer Motion shim - renders as regular HTML elements (motion.div -> div, etc.)
    const motion = new Proxy({}, {
      get: (_, tag) => (props) => {
        const { initial, animate, exit, transition, whileHover, whileTap, whileInView, variants, ...rest } = props;
        return React.createElement(tag, rest);
      }
    });
    const AnimatePresence = ({ children }) => children;
    
    // Lucide icons as simple SVG components with default size
    // Using dangerouslySetInnerHTML to avoid JSX fragment issues with Babel standalone
    const createIcon = (pathsHtml) => (props = {}) => {
      const { size = 24, className = '', ...rest } = props;
      return React.createElement('svg', {
        width: size,
        height: size,
        className: className,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        dangerouslySetInnerHTML: { __html: pathsHtml },
        ...rest
      });
    };
    const LucideIcons = {
      Menu: createIcon('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>'),
      X: createIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
      ChevronRight: createIcon('<polyline points="9,18 15,12 9,6"/>'),
      ChevronLeft: createIcon('<polyline points="15,18 9,12 15,6"/>'),
      ChevronDown: createIcon('<polyline points="6,9 12,15 18,9"/>'),
      Check: createIcon('<polyline points="20,6 9,17 4,12"/>'),
      Star: createIcon('<polygon points="12,2 15,8.5 22,9.3 17,14 18.2,21 12,17.8 5.8,21 7,14 2,9.3 9,8.5"/>'),
      Heart: createIcon('<path d="M20.84,4.61a5.5,5.5,0,0,0-7.78,0L12,5.67l-1.06-1.06a5.5,5.5,0,0,0-7.78,7.78L12,21.23l8.84-8.84a5.5,5.5,0,0,0,0-7.78Z"/>'),
      Search: createIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
      User: createIcon('<path d="M20,21v-2a4,4,0,0,0-4-4H8a4,4,0,0,0-4,4v2"/><circle cx="12" cy="7" r="4"/>'),
      Mail: createIcon('<path d="M4,4H20a2,2,0,0,1,2,2V18a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V6A2,2,0,0,1,4,4Z"/><polyline points="22,6 12,13 2,6"/>'),
      Phone: createIcon('<path d="M22,16.92v3a2,2,0,0,1-2.18,2,19.79,19.79,0,0,1-8.63-3.07,19.5,19.5,0,0,1-6-6,19.79,19.79,0,0,1-3.07-8.67A2,2,0,0,1,4.11,2h3a2,2,0,0,1,2,1.72,12.84,12.84,0,0,0,.7,2.81,2,2,0,0,1-.45,2.11L8.09,9.91a16,16,0,0,0,6,6l1.27-1.27a2,2,0,0,1,2.11-.45,12.84,12.84,0,0,0,2.81.7A2,2,0,0,1,22,16.92Z"/>'),
      MapPin: createIcon('<path d="M21,10c0,7-9,13-9,13s-9-6-9-13a9,9,0,0,1,18,0Z"/><circle cx="12" cy="10" r="3"/>'),
      Calendar: createIcon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
      Clock: createIcon('<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>'),
      Settings: createIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1,0,2.83,2,2,0,0,1-2.83,0l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-4,0v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83,0,2,2,0,0,1,0-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1,0-4h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06a2,2,0,0,1,0-2.83,2,2,0,0,1,2.83,0l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,4,0v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,0,2,2,0,0,1,0,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,0,4h-.09A1.65,1.65,0,0,0,19.4,15Z"/>'),
      Home: createIcon('<path d="M3,9l9-7,9,7v11a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2Z"/><polyline points="9,22 9,12 15,12 15,22"/>'),
      ShoppingCart: createIcon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1,1H5l2.68,13.39a2,2,0,0,0,2,1.61H19.4a2,2,0,0,0,2-1.61L23,6H6"/>'),
      Plus: createIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
      Minus: createIcon('<line x1="5" y1="12" x2="19" y2="12"/>'),
      Trash: createIcon('<polyline points="3,6 5,6 21,6"/><path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>'),
      Edit: createIcon('<path d="M11,4H4A2,2,0,0,0,2,6V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V13"/><path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15,8,16l1-4Z"/>'),
      ExternalLink: createIcon('<path d="M18,13v6a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V8A2,2,0,0,1,5,6h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
      ArrowRight: createIcon('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>'),
      ArrowLeft: createIcon('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>'),
      Send: createIcon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>'),
      Image: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>'),
      Play: createIcon('<polygon points="5,3 19,12 5,21"/>'),
      Pause: createIcon('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),
      Volume2: createIcon('<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07,4.93a10,10,0,0,1,0,14.14M15.54,8.46a5,5,0,0,1,0,7.07"/>'),
      Globe: createIcon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12,2a15.3,15.3,0,0,1,4,10,15.3,15.3,0,0,1-4,10,15.3,15.3,0,0,1-4-10A15.3,15.3,0,0,1,12,2Z"/>'),
      Facebook: createIcon('<path d="M18,2H15a5,5,0,0,0-5,5v3H7v4h3v8h4V14h3l1-4H14V7a1,1,0,0,1,1-1h3Z"/>'),
      Twitter: createIcon('<path d="M23,3a10.9,10.9,0,0,1-3.14,1.53,4.48,4.48,0,0,0-7.86,3v1A10.66,10.66,0,0,1,3,4s-4,9,5,13a11.64,11.64,0,0,1-7,2c9,5,20,0,20-11.5a4.5,4.5,0,0,0-.08-.83A7.72,7.72,0,0,0,23,3Z"/>'),
      Instagram: createIcon('<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16,11.37A4,4,0,1,1,12.63,8,4,4,0,0,1,16,11.37Z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>'),
      Linkedin: createIcon('<path d="M16,8a6,6,0,0,1,6,6v7H18V14a2,2,0,0,0-4,0v7H10V14a6,6,0,0,1,6-6Z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'),
      Youtube: createIcon('<path d="M22.54,6.42a2.78,2.78,0,0,0-1.94-2C18.88,4,12,4,12,4s-6.88,0-8.6.46a2.78,2.78,0,0,0-1.94,2A29,29,0,0,0,1,11.75a29,29,0,0,0,.46,5.33A2.78,2.78,0,0,0,3.4,19c1.72.46,8.6.46,8.6.46s6.88,0,8.6-.46a2.78,2.78,0,0,0,1.94-2,29,29,0,0,0,.46-5.25A29,29,0,0,0,22.54,6.42Z"/><polygon points="9.75,15.02 15.5,11.75 9.75,8.48"/>'),
      Award: createIcon('<circle cx="12" cy="8" r="7"/><polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88"/>'),
      Briefcase: createIcon('<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16,21V5a2,2,0,0,0-2-2H10A2,2,0,0,0,8,5V21"/>'),
      GraduationCap: createIcon('<path d="M22,10v6M2,10l10-5,10,5-10,5Z"/><path d="M6,12v5c3,3,9,3,12,0V12"/>'),
      Camera: createIcon('<path d="M23,19a2,2,0,0,1-2,2H3a2,2,0,0,1-2-2V8A2,2,0,0,1,3,6H7l2-3h6l2,3h4a2,2,0,0,1,2,2Z"/><circle cx="12" cy="13" r="4"/>'),
      Book: createIcon('<path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"/><path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5v-15A2.5,2.5,0,0,1,6.5,2Z"/>'),
      Plane: createIcon('<path d="M17.8,19.2,16,11l3.5-3.5C21,6,21.5,4,21,3c-1-.5-3,0-4.5,1.5L13,8,4.8,6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1,1,.3,1.3L9,12l-2,3H4l-1,1,3,2,2,3,1-1V17l3-2,3.5,5.3c.3.4.8.5,1.3.3l.5-.2C18.7,20,18.9,19.6,17.8,19.2Z"/>'),
      Users: createIcon('<path d="M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2"/><circle cx="9" cy="7" r="4"/><path d="M23,21v-2a4,4,0,0,0-3-3.87"/><path d="M16,3.13a4,4,0,0,1,0,7.75"/>'),
      Download: createIcon('<path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V15"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
      Upload: createIcon('<path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V15"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
      File: createIcon('<path d="M13,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V9Z"/><polyline points="13,2 13,9 20,9"/>'),
      Folder: createIcon('<path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5A2,2,0,0,1,4,3H9l2,3h9a2,2,0,0,1,2,2Z"/>'),
      Lock: createIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7,11V7a5,5,0,0,1,10,0v4"/>'),
      Eye: createIcon('<path d="M1,12s4-8,11-8,11,8,11,8-4,8-11,8S1,12,1,12Z"/><circle cx="12" cy="12" r="3"/>'),
      Bell: createIcon('<path d="M18,8A6,6,0,0,0,6,8c0,7-3,9-3,9H21s-3-2-3-9"/><path d="M13.73,21a2,2,0,0,1-3.46,0"/>'),
      Info: createIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
      Zap: createIcon('<polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>'),
      Target: createIcon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
      Gift: createIcon('<polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12,7H7.5a2.5,2.5,0,0,1,0-5C11,2,12,7,12,7Z"/><path d="M12,7h4.5a2.5,2.5,0,0,0,0-5C13,2,12,7,12,7Z"/>'),
      Code: createIcon('<polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>'),
      Terminal: createIcon('<polyline points="4,17 10,11 4,5"/><line x1="12" y1="19" x2="20" y2="19"/>'),
      Database: createIcon('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21,12c0,1.66-4,3-9,3s-9-1.34-9-3"/><path d="M3,5V19c0,1.66,4,3,9,3s9-1.34,9-3V5"/>'),
      Server: createIcon('<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'),
      Shield: createIcon('<path d="M12,22s8-4,8-10V5l-8-3-8,3v7C4,18,12,22,12,22Z"/>'),
      Activity: createIcon('<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>'),
      BarChart: createIcon('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'),
      TrendingUp: createIcon('<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>'),
      MessageCircle: createIcon('<path d="M21,11.5a8.38,8.38,0,0,1-.9,3.8,8.5,8.5,0,0,1-7.6,4.7,8.38,8.38,0,0,1-3.8-.9L3,21l1.9-5.7a8.38,8.38,0,0,1-.9-3.8,8.5,8.5,0,0,1,4.7-7.6,8.38,8.38,0,0,1,3.8-.9h.5a8.48,8.48,0,0,1,8,8Z"/>'),
      Share2: createIcon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
      Bookmark: createIcon('<path d="M19,21l-7-5-7,5V5a2,2,0,0,1,2-2H17a2,2,0,0,1,2,2Z"/>'),
      Tag: createIcon('<path d="M20.59,13.41l-7.17,7.17a2,2,0,0,1-2.83,0L2,12V2H12l8.59,8.59A2,2,0,0,1,20.59,13.41Z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
      Filter: createIcon('<polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>'),
      Layers: createIcon('<polygon points="12,2 2,7 12,12 22,7 12,2"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/>'),
      Layout: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
      Grid: createIcon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
      List: createIcon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
      Link: createIcon('<path d="M10,13a5,5,0,0,0,7.54.54l3-3a5,5,0,0,0-7.07-7.07l-1.72,1.71"/><path d="M14,11a5,5,0,0,0-7.54-.54l-3,3a5,5,0,0,0,7.07,7.07l1.71-1.71"/>'),
      Sun: createIcon('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
      Moon: createIcon('<path d="M21,12.79A9,9,0,1,1,11.21,3,7,7,0,0,0,21,12.79Z"/>'),
      Cloud: createIcon('<path d="M18,10h-1.26A8,8,0,1,0,9,20h9a5,5,0,0,0,0-10Z"/>'),
      Compass: createIcon('<circle cx="12" cy="12" r="10"/><polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88 16.24,7.76"/>'),
      Map: createIcon('<polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
      Navigation: createIcon('<polygon points="3,11 22,2 13,21 11,13 3,11"/>'),
      Copy: createIcon('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H13a2,2,0,0,1,2,2V5"/>'),
      Save: createIcon('<path d="M19,21H5a2,2,0,0,1-2-2V5A2,2,0,0,1,5,3H16l5,5V19A2,2,0,0,1,19,21Z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>'),
      LogIn: createIcon('<path d="M15,3h4a2,2,0,0,1,2,2V19a2,2,0,0,1-2,2H15"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/>'),
      LogOut: createIcon('<path d="M9,21H5a2,2,0,0,1-2-2V5A2,2,0,0,1,5,3H9"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
      Power: createIcon('<path d="M18.36,6.64a9,9,0,1,1-12.73,0"/><line x1="12" y1="2" x2="12" y2="12"/>'),
      RefreshCw: createIcon('<polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51,9a9,9,0,0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9,0,0,0,20.49,15"/>'),
      RotateCw: createIcon('<polyline points="23,4 23,10 17,10"/><path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"/>'),
      ChevronUp: createIcon('<polyline points="18,15 12,9 6,15"/>'),
      AlertCircle: createIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
      CheckCircle: createIcon('<path d="M22,11.08V12a10,10,0,1,1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>'),
      XCircle: createIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
    };
    
    // Make icons available globally
    Object.assign(window, LucideIcons);
    const { Menu, X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Check, Star, Heart, Search, User, Users, Mail, Phone, MapPin, Calendar, Clock, Settings, Home, ShoppingCart, Plus, Minus, Trash, Edit, ExternalLink, ArrowRight, ArrowLeft, Send, Image, Play, Pause, Volume2, Globe, Facebook, Twitter, Instagram, Linkedin, Youtube, Award, Briefcase, GraduationCap, Camera, Book, Plane, Download, Upload, File, Folder, Lock, Eye, Bell, Info, Zap, Target, Gift, Code, Terminal, Database, Server, Shield, Activity, BarChart, TrendingUp, MessageCircle, Share2, Bookmark, Tag, Filter, Layers, Layout, Grid, List, Link, Sun, Moon, Cloud, Compass, Map, Navigation, Copy, Save, LogIn, LogOut, Power, RefreshCw, RotateCw, AlertCircle, CheckCircle, XCircle } = LucideIcons;

    // Component definitions
    ${componentScripts}

    // Main App component
    ${appComponent}

    // Render the app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
  };

  // Convert ES module component to global browser-compatible code
  const convertToGlobalComponent = (code: string, defaultName: string): string => {
    let result = code;
    
    // Remove import statements (React is loaded globally, local imports become globals)
    result = result.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    result = result.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
    
    // Convert "export const X = ..." to "const X = ..." (will be global in script scope)
    result = result.replace(/export\s+const\s+/g, 'const ');
    result = result.replace(/export\s+let\s+/g, 'let ');
    result = result.replace(/export\s+var\s+/g, 'var ');
    result = result.replace(/export\s+function\s+/g, 'function ');
    result = result.replace(/export\s+class\s+/g, 'class ');
    
    // Remove export default and capture component
    result = result.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    result = result.replace(/export\s+default\s+(\w+);?\s*$/gm, '');
    result = result.replace(/export\s+default\s+/g, `const ${defaultName} = `);
    
    // Remove named export statements like "export { X, Y };"
    result = result.replace(/export\s+\{[^}]*\};?\s*$/gm, '');
    
    return result.trim();
  };

  // Escape HTML for safe insertion
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
  const captureScreenshotInternal = async ({ silent }: { silent: boolean }) => {
    if (!project) return;

    try {
      // Sandpack preview is rendered inside an iframe. We capture the container that holds it.
      const previewContainer =
        document.querySelector('.sp-preview-container') ||
        document.querySelector('.sandpack-preview-container') ||
        (document.querySelector('.sp-preview-iframe') as HTMLIFrameElement | null)?.parentElement;

      if (!previewContainer) {
        if (!silent) toast.error(isRTL ? 'لا يوجد معاينة للتصوير' : 'No preview to capture');
        return;
      }

      if (!silent) toast.loading(isRTL ? 'جاري التقاط الصورة...' : 'Capturing screenshot...');

      const canvas = await html2canvas(previewContainer as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        scale: 0.5,
        backgroundColor: '#0c0f14',
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) return reject(new Error('Failed to create screenshot blob'));
          resolve(b);
        }, 'image/jpeg', 0.8);
      });

      const fileName = `${project.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('project-thumbnails')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (!silent) {
          toast.dismiss();
          toast.error(isRTL ? 'فشل في رفع الصورة' : 'Failed to upload screenshot');
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('project-thumbnails')
        .getPublicUrl(fileName);

      await (supabase
        .from('projects' as any)
        .update({ thumbnail_url: publicUrl })
        .eq('id', project.id) as any);

      setProject(prev => prev ? { ...prev, thumbnail_url: publicUrl } : prev);

      if (!silent) {
        toast.dismiss();
        toast.success(isRTL ? 'تم حفظ الصورة المصغرة!' : 'Thumbnail saved!');
      }
    } catch (err) {
      console.error('Screenshot error:', err);
      if (!silent) {
        toast.dismiss();
        toast.error(isRTL ? 'فشل في التقاط الصورة' : 'Failed to capture screenshot');
      }
    }
  };

  const captureScreenshot = async () => {
    await captureScreenshotInternal({ silent: false });
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        setAttachedImages(prev => [...prev, { file, preview }]);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          setAttachedImages(prev => [...prev, { file, preview }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && attachedImages.length === 0 || aiEditing) return;
    
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
    // Capture images BEFORE clearing them
    const userImages = attachedImages.length > 0 ? attachedImages.map(img => img.preview) : [];
    
    const { data: userMsg, error: msgError } = await supabase
      .from('project_chat_messages' as any)
      .insert({ 
        project_id: id, 
        role: 'user', 
        content: userMessage,
        images: userImages.length > 0 ? userImages : null
      } as any)
      .select()
      .single();
    
    if (msgError) console.error('Error saving user message:', msgError);
    if (userMsg) setChatMessages(prev => [...prev, { ...(userMsg as object), images: userImages } as any]);
    else {
      // Fallback local state if DB insert fails
      setChatMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        images: userImages
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

      let assistantMsg: string;
      let snapshotToSave: any = null;

      // IMPORTANT: Save snapshot of CURRENT state BEFORE applying changes (for revert)
      const beforeSnapshot = Object.keys(generatedFiles).length > 0 ? { ...generatedFiles } : null;

      if (leftPanelMode === 'chat') {
        // Chat mode: Smart AI that answers questions OR returns plans for code changes
        // Use userImages captured earlier (before clearing)
        setAttachedImages([]); // Clear after capturing

        const response = await supabase.functions.invoke('projects-generate', {
          body: {
            mode: 'chat',
            projectId: id,
            prompt: userMessage,
            currentFiles: generatedFiles,
            images: userImages.length > 0 ? userImages : undefined,
          },
        });

        if (response.error || !response.data?.ok) {
          throw new Error(response.data?.error || 'Failed to get response');
        }

        // Step 2 complete, Step 3 loading
        setGenerationSteps(prev => prev.map((s, i) => 
          i === 0 ? { ...s, status: 'completed' } : 
          i === 1 ? { ...s, status: 'completed' } : 
          i === 2 ? { ...s, status: 'loading' } : s
        ));
        await delay(250);

        // Smart response: either a plan (JSON) or a regular message
        if (response.data.mode === 'plan' && response.data.plan) {
          // AI detected a code change request - show Plan Card
          assistantMsg = response.data.plan;
        } else {
          // AI answered a question - show regular message
          assistantMsg = response.data.message || (isRTL ? 'لم أتمكن من الإجابة.' : 'Could not generate a response.');
        }
        setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
        await delay(250);
      } else {
        // Code mode: Option A job flow (start -> poll -> get_files)
        if (!id) throw new Error('Missing projectId');

        // Clear attached images in Code mode too
        if (attachedImages.length > 0) {
          setAttachedImages([]);
        }

        const startRes = await supabase.functions.invoke('projects-generate', {
          body: {
            action: 'start',
            projectId: id,
            mode: 'edit',
            prompt: userMessage,
            userInstructions: userInstructions,
          },
        });

        if (startRes.error) {
          throw new Error(startRes.error.message || 'Failed to start edit');
        }

        const jobId = startRes.data?.jobId as string | undefined;
        if (!jobId) throw new Error('Missing jobId');

        // Step 2 complete, Step 3 loading
        setGenerationSteps(prev => prev.map((s, i) => 
          i === 0 ? { ...s, status: 'completed' } : 
          i === 1 ? { ...s, status: 'completed' } : 
          i === 2 ? { ...s, status: 'loading' } : s
        ));
        await delay(250);

        const job = await pollJobUntilDone(jobId);
        const newFiles = await loadFilesFromDb(id);
        const newCode = newFiles["/App.js"] || Object.values(newFiles)[0] || "";

        snapshotToSave = beforeSnapshot;
        setGeneratedFiles(newFiles);
        setCodeContent(newCode);

        assistantMsg = job.result_summary || (isRTL ? 'تم تطبيق التعديلات! ✓' : 'Changes applied! ✓');
        setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
        await delay(250);
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
        id: `error-${Date.now()}`,
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
                  // PLAN DETECTION: Try to parse as structured JSON plan
                  let parsedPlan: { 
                    title?: string; 
                    file?: string;
                    line?: number;
                    steps?: Array<{ title: string; current?: string; changeTo?: string }>;
                    codeChanges?: Array<{ file: string; line?: number; code: string }>;
                  } | null = null;
                  let isPlanCard = false;
                  
                  if (msg.role === 'assistant') {
                    // Try to extract JSON plan from content (may be mixed with text)
                    const content = msg.content;
                    
                    // Method 1: Try direct JSON parse
                    try {
                      const parsed = JSON.parse(content);
                      if (parsed.type === 'plan' || (parsed.title && (parsed.steps || parsed.codeChanges))) {
                        parsedPlan = parsed;
                        isPlanCard = true;
                      }
                    } catch {
                      // Method 2: Extract JSON object from mixed content
                      const jsonMatch = content.match(/\{[\s\S]*"type"\s*:\s*"plan"[\s\S]*\}/);
                      if (jsonMatch) {
                        try {
                          const extracted = JSON.parse(jsonMatch[0]);
                          if (extracted.title && (extracted.steps || extracted.codeChanges)) {
                            parsedPlan = extracted;
                            isPlanCard = true;
                          }
                        } catch {
                          // Still not valid JSON
                        }
                      }
                      
                      // Method 3: Look for any JSON with title + steps/codeChanges
                      if (!isPlanCard) {
                        const anyJsonMatch = content.match(/\{[\s\S]*"title"[\s\S]*("steps"|"codeChanges")[\s\S]*\}/);
                        if (anyJsonMatch) {
                          try {
                            const extracted = JSON.parse(anyJsonMatch[0]);
                            if (extracted.title && (extracted.steps || extracted.codeChanges)) {
                              parsedPlan = extracted;
                              isPlanCard = true;
                            }
                          } catch {
                            // Not valid JSON
                          }
                        }
                      }
                    }
                  }
                  
                  // PLAN CARD UI (Lovable-style - clean, minimal, professional)
                  if (isPlanCard && parsedPlan) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full">
                        <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                          {/* Plan Header */}
                          <div className="px-4 py-2.5 border-b border-[#2a2a2a]">
                            <span className="text-[13px] text-zinc-500">Plan</span>
                          </div>
                          
                          {/* Plan Content */}
                          <div className="px-4 py-4 space-y-4">
                            {/* Title */}
                            <h3 className="text-[15px] font-semibold text-white">
                              Plan: {parsedPlan.title}
                            </h3>
                            
                            {/* File Reference */}
                            {parsedPlan.file && (
                              <p className="text-[13px] text-zinc-400">
                                <span className="font-medium text-zinc-300">Changes to</span>{' '}
                                <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-xs">
                                  {parsedPlan.file}
                                </code>
                                {parsedPlan.line && <span className="text-zinc-500"> :</span>}
                              </p>
                            )}
                            
                            {/* Steps */}
                            {parsedPlan.steps && parsedPlan.steps.length > 0 && (
                              <div className="space-y-3">
                                {parsedPlan.steps.map((step, stepIdx) => (
                                  <div key={stepIdx}>
                                    {/* Step Title */}
                                    <h4 className="text-[13px] font-semibold text-white mb-1.5">
                                      {stepIdx + 1}. {step.title}
                                    </h4>
                                    
                                    {/* Current / Change To */}
                                    <ul className="space-y-1 ml-3">
                                      {step.current && (
                                        <li className="text-[13px] text-zinc-400 flex items-center gap-2">
                                          <span className="text-zinc-600">•</span>
                                          <span>Current:</span>
                                          <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs">
                                            {step.current}
                                          </code>
                                        </li>
                                      )}
                                      {step.changeTo && (
                                        <li className="text-[13px] text-zinc-400 flex items-center gap-2">
                                          <span className="text-zinc-600">•</span>
                                          <span>Change to:</span>
                                          <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono text-xs">
                                            {step.changeTo}
                                          </code>
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Code Changes */}
                            {parsedPlan.codeChanges && parsedPlan.codeChanges.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[13px] font-semibold text-white">Code Changes:</h4>
                                {parsedPlan.codeChanges.map((change, changeIdx) => (
                                  <div key={changeIdx} className="bg-[#0d0d0d] border border-[#252525] rounded-lg overflow-hidden">
                                    {/* File header */}
                                    <div className="px-3 py-1.5 bg-[#151515] border-b border-[#252525] flex items-center justify-between">
                                      <span className="text-[11px] text-zinc-500 font-mono">
                                        // {change.file}{change.line ? ` (line ${change.line})` : ''}
                                      </span>
                                      <button 
                                        onClick={() => navigator.clipboard.writeText(change.code)}
                                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                                        title="Copy code"
                                        aria-label="Copy code"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </div>
                                    {/* Code */}
                                    <pre className="px-3 py-2.5 text-[12px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                                      {change.code}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Action Button */}
                          <div className="px-4 py-3 border-t border-[#2a2a2a]">
                            <button
                              onClick={async () => {
                                // Switch to Code mode immediately
                                setLeftPanelMode('code');
                                
                                setAiEditing(true);
                                setGenerationSteps([
                                  { label: isRTL ? 'تنفيذ الخطة...' : 'Applying changes...', status: 'loading' },
                                  { label: isRTL ? 'كتابة الكود...' : 'Writing code...', status: 'pending' },
                                  { label: isRTL ? 'حفظ الملفات...' : 'Saving files...', status: 'pending' },
                                ]);
                                
                                try {
                                  const response = await supabase.functions.invoke('projects-generate', {
                                    body: {
                                      action: 'start',
                                      projectId: id,
                                      mode: 'execute',
                                      planToExecute: msg.content,
                                      userInstructions: userInstructions,
                                    },
                                  });
                                  
                                  if (response.error) throw new Error(response.error.message);
                                  
                                  const jobId = response.data?.jobId;
                                  if (jobId) {
                                    setGenerationSteps(prev => prev.map((s, idx) => 
                                      idx === 0 ? { ...s, status: 'completed' } : 
                                      idx === 1 ? { ...s, status: 'loading' } : s
                                    ));
                                    
                                    const job = await pollJobUntilDone(jobId);
                                    const newFiles = await loadFilesFromDb(id!);
                                    
                                    setGenerationSteps(prev => prev.map((s, idx) => 
                                      idx <= 1 ? { ...s, status: 'completed' } : 
                                      idx === 2 ? { ...s, status: 'loading' } : s
                                    ));
                                    
                                    setGeneratedFiles(newFiles);
                                    setCodeContent(newFiles["/App.js"] || Object.values(newFiles)[0] || "");
                                    
                                    // Build Lovable-style response with plan summary
                                    const planTitle = parsedPlan.title || 'Changes';
                                    const changedFiles = parsedPlan.codeChanges?.map((c: any) => c.file).filter(Boolean) || [parsedPlan.file].filter(Boolean);
                                    const uniqueChangedFiles = [...new Set(changedFiles)];
                                    const stepsSummary = parsedPlan.steps?.map((s: any) => s.title).join('. ') || '';
                                    
                                    // Create a structured Lovable-style message
                                    const successMsg = JSON.stringify({
                                      type: 'execution_result',
                                      title: planTitle,
                                      summary: stepsSummary || (isRTL ? 'تم تطبيق التغييرات بنجاح' : 'Successfully applied the requested changes'),
                                      files: uniqueChangedFiles
                                    });
                                    
                                    const { data: msgData } = await supabase
                                      .from('project_chat_messages' as any)
                                      .insert({ 
                                        project_id: id, 
                                        role: 'assistant', 
                                        content: successMsg,
                                        snapshot: newFiles 
                                      } as any)
                                      .select()
                                      .single();
                                    
                                    if (msgData) setChatMessages(prev => [...prev, msgData as any]);
                                    toast.success(isRTL ? 'تم تنفيذ الخطة بنجاح!' : 'Plan executed successfully!');
                                  }
                                  
                                  setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
                                } catch (err: any) {
                                  console.error('Execute plan error:', err);
                                  toast.error(isRTL ? 'فشل في تنفيذ الخطة' : 'Failed to apply changes');
                                  setGenerationSteps([]);
                                } finally {
                                  setAiEditing(false);
                                }
                              }}
                              disabled={aiEditing}
                              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-black text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {isRTL ? 'تنفيذ الخطة' : 'Implement Plan'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
      // Regular message bubble with Markdown support (Lovable-style)
                  const isAssistant = msg.role === 'assistant';
                  
                  // Helper to filter out plan JSON from display content
                  let displayContent = msg.content;
                  if (isAssistant && isPlanCard) {
                    // Strip the JSON plan object from the chat bubble text so it doesn't look messy
                    displayContent = msg.content.replace(/\{[\s\S]*"type"\s*:\s*"plan"[\s\S]*\}/g, '').trim();
                    // If stripping left us with nothing, or just punctuation, use a default summary
                    if (displayContent.length < 5) displayContent = isRTL ? 'إليك خطة العمل المقترحة:' : 'Here is the proposed plan:';
                  }

                  // EXECUTION RESPONSE FORMAT: Clean Lovable-style format
                  // Detect structured execution_result OR verbose execution response
                  let executionResult: { type: string; title: string; summary: string; files: string[] } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'execution_result') {
                      executionResult = parsed;
                    }
                  } catch { /* not JSON */ }
                  
                  const isExecutionResponse = executionResult || (isAssistant && msg.content && msg.content.length > 150 && 
                    (msg.content.includes('implement') || msg.content.includes('add') || msg.content.includes('update') || 
                     msg.content.includes('تم') || msg.content.includes('أضفت') || msg.content.includes('عدلت')));
                  
                  if (isExecutionResponse && !isPlanCard) {
                    // Use structured data if available, otherwise extract from verbose text
                    let summary: string;
                    let uniqueFiles: string[];
                    
                    if (executionResult) {
                      summary = executionResult.summary;
                      uniqueFiles = executionResult.files || [];
                    } else {
                      // Extract summary from verbose response - get first 2-3 sentences
                      const sentences = msg.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
                      summary = sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '.' : '');
                      // Extract files mentioned in the response
                      const fileMatches = msg.content.match(/(?:\/\w+(?:\.tsx?|\.jsx?|\.css)?|App\.js|App\.tsx|index\.js)/g) || [];
                      uniqueFiles = [...new Set(fileMatches)].slice(0, 3) as string[];
                    }
                    
                    return (
                      <div key={i} className={cn(
                        "flex flex-col group animate-in fade-in slide-in-from-bottom-1 duration-300",
                        "items-start w-full"
                      )}>
                        <div className="w-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
                          {/* Header with checkmark */}
                          <div className="px-4 py-3 border-b border-indigo-500/20 flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <span className="text-[13px] text-emerald-500 font-semibold">{isRTL ? 'تم التطبيق' : 'Applied'}</span>
                          </div>
                          
                          {/* Summary Section */}
                          <div className="px-4 py-3 space-y-3">
                            {/* Main summary */}
                            <p className="text-[13px] text-foreground/85 leading-relaxed">
                              {summary}
                            </p>
                            
                            {/* Files edited section */}
                            {uniqueFiles.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[11px] text-foreground/60 font-semibold uppercase tracking-wide">
                                  {isRTL ? 'الملفات المعدلة' : 'Files Modified'}
                                </p>
                                <div className="space-y-1 ml-2">
                                  {uniqueFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-[12px] text-foreground/70">
                                      <FileCode className="h-3 w-3 text-indigo-500" />
                                      <code className="font-mono text-indigo-600 dark:text-indigo-400">{file}</code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className={cn(
                      "flex flex-col group animate-in fade-in slide-in-from-bottom-1 duration-300",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "max-w-[90%] px-4 py-3 rounded-2xl shadow-sm transition-all",
                        msg.role === 'user' 
                          ? "bg-indigo-600 text-white rounded-br-md text-[13px] leading-relaxed"
                          : "bg-[#fafafa] dark:bg-[#1a1a1a] text-foreground rounded-bl-md border border-[#e5e5e5] dark:border-[#2a2a2a]"
                      )}>
                        {isAssistant ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-2 prose-pre:my-2 prose-code:text-[12px] prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none text-[13px] leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {displayContent}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Show attached images if any */}
                            {(msg as any).images && Array.isArray((msg as any).images) && (msg as any).images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(msg as any).images.map((imgSrc: string, imgIdx: number) => (
                                  <img 
                                    key={imgIdx}
                                    src={imgSrc}
                                    alt={`Attached ${imgIdx + 1}`}
                                    className="max-w-[120px] max-h-[80px] rounded-lg object-cover border border-white/20"
                                  />
                                ))}
                              </div>
                            )}
                            <div className="text-[13px] leading-relaxed">{msg.content}</div>
                          </div>
                        )}
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
                      
                      {/* Theme Info Card - Show AFTER user messages only, and keep it visible */}
                      {msg.role === 'user' && creationPromptInfo && (
                        <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden mt-2">
                          <div className="px-4 py-2.5 border-b border-[#2a2a2a] flex items-center justify-between">
                            <span className="text-[13px] text-zinc-500">{isRTL ? 'تم إرسال هذا للذكاء الاصطناعي' : 'Sent to AI'}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(creationPromptInfo.finalPrompt)}
                              className="text-zinc-600 hover:text-zinc-400 transition-colors"
                              title={isRTL ? 'نسخ الكل' : 'Copy all'}
                              aria-label={isRTL ? 'نسخ الكل' : 'Copy all'}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="px-4 py-4 space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                                  {isRTL ? 'طلب المستخدم' : 'User Prompt'}
                                </span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(creationPromptInfo.userPrompt)}
                                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                                  title={isRTL ? 'نسخ' : 'Copy'}
                                  aria-label={isRTL ? 'نسخ' : 'Copy'}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <pre className="px-3 py-2 bg-[#0d0d0d] border border-[#252525] rounded-lg text-[12px] font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap">{creationPromptInfo.userPrompt}</pre>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                                  {isRTL ? 'الثيم المختار (محقون)' : 'Selected Theme (Injected)'}
                                </span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(creationPromptInfo.themeInstructions || `THEME: ${creationPromptInfo.themeId}`)}
                                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                                  title={isRTL ? 'نسخ' : 'Copy'}
                                  aria-label={isRTL ? 'نسخ' : 'Copy'}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <pre className="px-3 py-2 bg-[#0d0d0d] border border-[#252525] rounded-lg text-[12px] font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">{creationPromptInfo.themeInstructions ? creationPromptInfo.themeInstructions : `THEME: ${creationPromptInfo.themeId}`}</pre>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                                  {isRTL ? 'البرومبت النهائي' : 'Final Prompt'}
                                </span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(creationPromptInfo.finalPrompt)}
                                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                                  title={isRTL ? 'نسخ' : 'Copy'}
                                  aria-label={isRTL ? 'نسخ' : 'Copy'}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <pre className="px-3 py-2 bg-[#0d0d0d] border border-[#252525] rounded-lg text-[12px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">{creationPromptInfo.finalPrompt}</pre>
                            </div>
                          </div>
                        </div>
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
                        
                        {isGenerating && (
                          <p className="text-[11px] text-muted-foreground pl-6 animate-pulse">
                            {isRTL ? 'قد يستغرق هذا ما يصل إلى 3 دقائق لضمان أفضل جودة' : 'This may take up to 3 minutes for premium quality'}
                          </p>
                        )}
                        
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
                    {/* Attached Images Preview */}
                    {attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-2">
                        {attachedImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={img.preview} 
                              alt={`Attached ${idx + 1}`}
                              className="h-16 w-16 rounded-lg object-cover border border-indigo-500/30 bg-muted"
                            />
                            <button
                              type="button"
                              onClick={() => removeAttachedImage(idx)}
                              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={isRTL ? 'إزالة' : 'Remove'}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

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
                        onPaste={(e) => handlePaste(e as any)}
                      />
                      
                      {/* Send Button with action buttons above */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {/* Action buttons - smaller, above send */}
                        <div className="flex flex-col gap-1">
                          {/* Upload Screenshot Button */}
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className={cn(
                              "h-6 w-6 rounded-md border flex items-center justify-center transition-all active:scale-90",
                              attachedImages.length > 0
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-500 hover:bg-indigo-500/30"
                                : "bg-muted/50 dark:bg-white/5 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title={isRTL ? 'رفع لقطة شاشة' : 'Upload screenshot'}
                          >
                            <Camera className="h-3 w-3" />
                          </button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageSelect}
                            className="hidden"
                            aria-label={isRTL ? 'رفع صورة' : 'Upload image'}
                          />
                          
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
          {/* Project Info Bar - Back, Name, Status */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 border-b border-white/10 shrink-0">
            {/* Back button - Enhanced */}
            <button 
              onClick={() => navigate('/projects')} 
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0 group"
              title={isRTL ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </button>
            
            {/* Project name - Editable with Edit/Save Toggle */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <input 
                type="text"
                disabled={!isEditingName}
                value={isEditingName ? editedName : (project?.name || displayProject.name)}
                onChange={(e) => {
                  setEditedName(e.target.value);
                }}
                className={cn(
                  "flex-1 min-w-0 text-base md:text-lg font-bold text-white placeholder-zinc-500 border-b-2 transition-colors px-1 py-1",
                  isEditingName 
                    ? "bg-transparent border-indigo-500 focus:border-indigo-500 focus:outline-none" 
                    : "bg-transparent border-transparent cursor-default"
                )}
                placeholder={isRTL ? 'اسم المشروع' : 'Project name'}
              />
              <button
                onClick={async () => {
                  if (isEditingName) {
                    // Save mode - save to database
                    if (editedName.trim() && project) {
                      try {
                        setSaving(true);
                        const { error } = await supabase
                          .from('projects' as any)
                          .update({ name: editedName.trim() })
                          .eq('id', project.id);
                        if (error) throw error;
                        setProject(prev => prev ? { ...prev, name: editedName.trim() } : null);
                        setIsEditingName(false);
                        setEditedName('');
                        toast.success(isRTL ? 'تم حفظ الاسم' : 'Name saved');
                      } catch (err) {
                        toast.error(isRTL ? 'خطأ في الحفظ' : 'Failed to save');
                      } finally {
                        setSaving(false);
                      }
                    }
                  } else {
                    // Edit mode - activate input
                    setIsEditingName(true);
                    setEditedName(project?.name || displayProject.name);
                  }
                }}
                disabled={saving}
                className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded-lg transition-all shrink-0 disabled:opacity-50"
                title={isEditingName ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'تعديل' : 'Edit')}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEditingName ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Edit2 className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {/* Status Badge - Enhanced */}
            <div className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider shrink-0 backdrop-blur-sm border",
              displayProject.status === 'published' 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-lg shadow-emerald-500/10" 
                : displayProject.status === 'generating'
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-lg shadow-indigo-500/10 animate-pulse"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-lg shadow-amber-500/10"
            )}>
              {displayProject.status === 'published' ? (isRTL ? 'منشور' : 'Live') : 
               displayProject.status === 'generating' ? (isRTL ? 'بناء' : 'Building') :
               (isRTL ? 'مسودة' : 'Draft')}
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
                      isLoading={isGenerating}
                      deviceView={deviceView}
                      onDeviceViewChange={setDeviceView}
                      onRefresh={refreshPreview}
                      onDownload={downloadProject}
                      onPublish={openPublishModal}
                      isPublishing={publishing}
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

      {/* Instructions Drawer - Full Screen on Mobile */}
      <div 
        className={cn(
          "fixed inset-0 z-[1000] transition-all duration-300",
          instructionsDrawerOpen ? "visible" : "invisible"
        )}
      >
        <div 
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300",
            instructionsDrawerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setInstructionsDrawerOpen(false)}
        />
        
        <div 
          className={cn(
            "absolute inset-x-0 bottom-0 top-auto h-[85vh] md:inset-0 md:top-0 md:left-0 md:right-auto md:bottom-auto md:h-full md:w-full md:max-w-md",
            "bg-background dark:bg-[#0c0f14] shadow-2xl transition-transform duration-300 ease-out flex flex-col rounded-t-3xl md:rounded-none",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            instructionsDrawerOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:-translate-x-full"
          )}
        >
          {/* Mobile drag handle */}
          <div className="md:hidden flex justify-center py-2 shrink-0">
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-purple-500/30">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isRTL ? 'التعليمات' : 'Instructions'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL ? 'أضف تعليمات مخصصة للذكاء الاصطناعي' : 'Custom instructions for AI'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setInstructionsDrawerOpen(false)}
              className="p-2.5 rounded-xl bg-muted/50 dark:bg-white/10 hover:bg-muted dark:hover:bg-white/20 transition-colors"
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Theme Instructions Badge - shows if theme instructions are loaded */}
          {tempInstructions && tempInstructions.includes('CUSTOM THEME INSTRUCTIONS:') && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                  {isRTL ? '🎨 تم تحميل إعدادات الثيم' : '🎨 Theme settings loaded'}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {isRTL 
                  ? 'تعليمات الثيم المخصصة ستُطبق على جميع التعديلات.'
                  : 'Custom theme instructions will be applied to all edits.'}
              </p>
            </div>
          )}

          {/* Tip Box */}
          <div className="mx-4 mt-4 p-3 bg-indigo-500/10 dark:bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              <span className="font-bold">💡 {isRTL ? 'نصيحة:' : 'Tip:'}</span>{' '}
              {isRTL 
                ? 'أضف تعليمات مثل "استخدم ألوان داكنة" أو "اجعل التصميم بسيط" لتوجيه الذكاء الاصطناعي.'
                : 'Add instructions like "Use dark colors" or "Keep the design minimal" to guide the AI.'}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <Textarea
              value={tempInstructions}
              onChange={(e) => setTempInstructions(e.target.value)}
              placeholder={isRTL 
                ? 'مثال:\n- استخدم ألوان زاهية\n- اجعل الأزرار كبيرة\n- أضف رسوم متحركة...' 
                : 'Example:\n- Use vibrant colors\n- Make buttons large\n- Add smooth animations...'}
              className="min-h-[180px] w-full bg-muted/30 dark:bg-white/5 border-border/50 dark:border-white/10 text-sm resize-none focus-visible:ring-purple-500/50 rounded-xl placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-border/50 dark:border-white/10 shrink-0 bg-muted/20 dark:bg-white/5">
            <Button 
              variant="outline" 
              onClick={() => setInstructionsDrawerOpen(false)} 
              className="flex-1 h-12 text-muted-foreground border-border/50 dark:border-white/10 rounded-xl font-medium"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                setUserInstructions(tempInstructions);
                setInstructionsDrawerOpen(false);
                toast.success(isRTL ? 'تم حفظ التعليمات!' : 'Instructions saved!');
              }}
              className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              {isRTL ? 'حفظ التعليمات' : 'Save Instructions'}
            </Button>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-5">
            {/* Header */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <ExternalLink className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {isRTL ? 'نشر المشروع' : 'Publish Project'}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {isRTL ? 'اختر اسم موقعك الفريد' : 'Choose your unique site name'}
              </p>
            </div>

            {/* Subdomain Input */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                {isRTL ? 'اسم الموقع' : 'Site Name'}
              </label>
              <div className="flex items-center gap-0 rounded-xl border border-zinc-300 dark:border-zinc-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50">
                <input
                  type="text"
                  value={subdomainInput}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  placeholder={isRTL ? 'my-app' : 'my-app'}
                  className="flex-1 px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none text-base"
                  autoFocus
                  maxLength={30}
                />
                <span className="px-3 py-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium border-l border-zinc-300 dark:border-zinc-600">
                  .wakti.ai
                </span>
              </div>
              
              {/* Error message */}
              {subdomainError && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {subdomainError}
                </p>
              )}
              
              {/* Preview URL */}
              {subdomainInput && !subdomainError && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                  {isRTL ? 'رابط موقعك: ' : 'Your site URL: '}
                  <span className="font-mono font-semibold">https://{subdomainInput}.wakti.ai</span>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={publishing}
                className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium disabled:opacity-50"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={publishProject}
                disabled={publishing || checkingSubdomain || !!subdomainError || !subdomainInput}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-zinc-400 disabled:to-zinc-500 disabled:cursor-not-allowed text-white transition-colors font-semibold flex items-center justify-center gap-2"
              >
                {publishing || checkingSubdomain ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isRTL ? 'جاري النشر...' : 'Publishing...'}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    {isRTL ? 'نشر' : 'Publish'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
