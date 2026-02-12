import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useDebugContext } from '@/hooks/useDebugContext';
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
  ChevronDown,
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
  Paperclip,
  Copy,
  Edit2,
  Lock,
  Server,
  Hammer,
  Lightbulb,
  Circle,
  FileText,
  Square,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';

// Import shared types from centralized type definitions
import type { 
  Project, 
  ProjectFile, 
  GeneratedFiles, 
  BackendContext,
  UploadedAsset 
} from './ProjectDetail/types';

// Import hook interfaces for future integration
// These hooks encapsulate common patterns and can be gradually adopted
import { 
  useProjectData,
  useChatMessages,
  useSandpackFiles,
  useVisualEditMode,
  useConversationMemory,
  useEditHistory
} from './ProjectDetail/hooks';

// Import Agent Mode components
import { AgentTaskPanel } from './ProjectDetail/components/AgentTaskPanel';
import type { AgentStep } from './ProjectDetail/components/AgentTaskPanel';

// Lazy load Sandpack Studio for full control over layout
const SandpackStudio = lazy(() => import('@/components/projects/SandpackStudio'));
import { MatrixOverlay } from '@/components/projects/MatrixOverlay';
import { TraceFlowLoader } from '@/components/projects/TraceFlowLoader';
import { BackendDashboard } from '@/components/projects/backend/BackendDashboard';
import { StockPhotoSelector } from '@/components/projects/StockPhotoSelector';
import { ImageSourceButtons, ImageSourceChoice } from '@/components/projects/ImageSourceButtons';
import { BookingFormWizard, BookingFormConfig, BookingService } from '@/components/projects/BookingFormWizard';
import { ContactFormWizard, ContactFormConfig } from '@/components/projects/ContactFormWizard';
import { ProductWizard, Product, ProductDisplayConfig } from '@/components/projects/ProductWizard';
import { AuthWizard, AuthConfig } from '@/components/projects/AuthWizard';
import { MediaWizard, MediaConfig } from '@/components/projects/MediaWizard';
import { SmartMediaManager } from '@/components/projects/SmartMediaManager';
import { detectWizardType, detectWizardTypeAdvanced, isDataAdditionRequest, WizardType } from '@/components/projects/wizards';
import { ProductFormCard } from '@/components/projects/ProductFormCard';
import { FeatureSummaryCard } from '@/components/projects/FeatureSummaryCard';
import { BackendConnectionsSummary } from '@/components/projects/BackendConnectionsSummary';
import { 
  analyzeRequest, 
  AnalyzedRequest, 
  DetectedFeature, 
  FeatureType,
  getNextWizardFeature,
  getNonWizardFeatures,
  generateStructuredPrompt,
  createFeatureSummary,
  featureToWizardType
} from '@/utils/requestAnalyzer';
import {
  detectChatIntent,
  ChatIntent
} from '@/utils/chatIntents';
import {
  analyzeIntent,
  IntentResult,
  requiresWizard,
  requiresModal,
  requiresNavigation,
  shouldCallAI,
  getWizardType,
  getModalType,
  getResponse
} from '@/utils/IntentManager';
import { FreepikService } from '@/services/FreepikService';

// Lovable-style components
import { QuickActionButtons } from '@/components/projects/QuickActionButtons';
import { ClarifyingQuestionsModal, ClarifyingQuestion } from '@/components/projects/ClarifyingQuestionsModal';
import { MigrationApprovalDialog } from '@/components/projects/MigrationApprovalDialog';
import { ElementEditPopover } from '@/components/projects/ElementEditPopover';
import { ToolUsageIndicator } from '@/components/wakti-ai-v2/ToolUsageIndicator';
import { ErrorExplanationCard } from '@/components/wakti-ai-v2/ErrorExplanationCard';
import { AutoFixCard, parseAutoFixMessage } from '@/components/projects/AutoFixCard';

// Direct style editor for FREE visual edits (no AI prompts needed)
import { applyDirectEdits, validateJSX } from '@/utils/directStyleEditor';

// Note: Project, ProjectFile, GeneratedFiles, BackendContext, UploadedAsset 
// are now imported from './ProjectDetail/types' above

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
type MainTab = 'builder' | 'server';

// Lovable-style Thinking Timer Component - Amber/Gold badge style
const ThinkingTimerDisplay: React.FC<{ startTime: number; isRTL: boolean }> = ({ startTime, isRTL }) => {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    setElapsedSeconds(initialElapsed);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const label = isRTL ? `فكّر لمدة ${elapsedSeconds} ث` : `Thought for ${elapsedSeconds}s`;

  return (
    <div className={cn(
      "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 animate-in fade-in slide-in-from-left-2 duration-500 shadow-sm",
      isRTL ? "flex-row-reverse" : ""
    )}>
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500/40 rounded-full animate-ping" />
        <Lightbulb className="h-3.5 w-3.5 text-amber-500 relative z-10" />
      </div>
      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        {label}
      </span>
    </div>
  );
};

export default function ProjectDetail() {
  console.log('[ProjectDetail] Component mounting...');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useTheme();
  const { user, session } = useAuth();
  const debugContext = useDebugContext();
  console.log('[ProjectDetail] Hooks initialized, id:', id);
  const isRTL = language === 'ar';
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const thinkingStartTimeRef = useRef<number | null>(null);

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
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string; pdfDataUrl?: string }>>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const autoCaptureTimeoutRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<{ label: string, status: 'pending' | 'loading' | 'completed' | 'error' }[]>([]);
  
  // Lovable-style thinking timer and edited files tracking
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [editedFilesTracking, setEditedFilesTracking] = useState<Array<{ id: string; fileName: string; status: 'editing' | 'edited' }>>([]);
  const [showAllEditedFiles, setShowAllEditedFiles] = useState(false);
  
  // Tool Usage Indicator state
  const [toolsUsedCount, setToolsUsedCount] = useState(0);
  const [lastThinkingDuration, setLastThinkingDuration] = useState<number | null>(null); // Persist after completion
  
  // Error Explanation state
  const [aiError, setAiError] = useState<{
    title: string;
    titleAr?: string;
    message: string;
    messageAr?: string;
    severity: 'error' | 'warning' | 'info';
    technicalDetails?: string;
    suggestedAction?: string;
    suggestedActionAr?: string;
  } | null>(null);
  
  // Stock photo selector state
  const [showStockPhotoSelector, setShowStockPhotoSelector] = useState(false);
  const [photoSearchTerm, setPhotoSearchTerm] = useState('');
  const [photoSelectorInitialTab, setPhotoSelectorInitialTab] = useState<'stock' | 'user'>('stock');
  const [photoSelectorMultiSelect, setPhotoSelectorMultiSelect] = useState(false);
  const [isChangingCarouselImages, setIsChangingCarouselImages] = useState(false);
  const [savedPromptForPhotos, setSavedPromptForPhotos] = useState('');
  const [photoSelectorShowOnlyUserPhotos, setPhotoSelectorShowOnlyUserPhotos] = useState(false);
  const [isUploadingAttachedImages, setIsUploadingAttachedImages] = useState(false);
  
  // Image Source Dialog state - shown when AI detects image-related requests
  const [showImageSourceDialog, setShowImageSourceDialog] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState('');
  const [isAIGeneratingImages, setIsAIGeneratingImages] = useState(false);
  
  // Pending element image edit (for AI Edit image requests)
  const [pendingElementImageEdit, setPendingElementImageEdit] = useState<{
    elementInfo: typeof selectedElementInfo;
    originalPrompt: string;
  } | null>(null);

  // Booking/Contact Form Wizard state
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [showContactWizard, setShowContactWizard] = useState(false);
  const [showProductWizard, setShowProductWizard] = useState(false);
  const [showAuthWizard, setShowAuthWizard] = useState(false);
  const [showMediaWizard, setShowMediaWizard] = useState(false);
  const [showSmartMediaManager, setShowSmartMediaManager] = useState(false);
  const [smartMediaInitialTab, setSmartMediaInitialTab] = useState<'site' | 'stock' | 'upload'>('site');
  const [showProductFormCard, setShowProductFormCard] = useState(false);
  const [activeProductCardId, setActiveProductCardId] = useState<string | null>(null);
  const [pendingFormPrompt, setPendingFormPrompt] = useState('');
  const skipFormWizardRef = useRef(false);
  const skipUserMessageSaveRef = useRef(false);
  
  // Multi-feature request analyzer state
  const [analyzedRequest, setAnalyzedRequest] = useState<AnalyzedRequest | null>(null);
  const [wizardConfigs, setWizardConfigs] = useState<Record<string, any>>({});
  const [showFeatureSummary, setShowFeatureSummary] = useState(false);

  // Clarifying questions modal state
  const [showClarifyingQuestions, setShowClarifyingQuestions] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState('');

  // Migration approval dialog state
  const [showMigrationApproval, setShowMigrationApproval] = useState(false);
  const [pendingMigration, setPendingMigration] = useState<{
    title: string;
    titleAr?: string;
    sqlPreview: string;
    description?: string;
    descriptionAr?: string;
  } | null>(null);
  const [alwaysAllowMigrations, setAlwaysAllowMigrations] = useState(false);

  // Context-aware guidance state - shows helpful hints based on project state
  const [contextHintDismissed, setContextHintDismissed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wakti_coder_hints_dismissed');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const dismissContextHint = useCallback((hintId: string) => {
    const updated = [...contextHintDismissed, hintId];
    setContextHintDismissed(updated);
    localStorage.setItem('wakti_coder_hints_dismissed', JSON.stringify(updated));
  }, [contextHintDismissed]);

  // Visual Edit Mode undo/redo history
  const visualEditHistory = useEditHistory({ maxHistory: 30 });

  // Helper to build prompt with clarifying question answers
  const buildPromptWithAnswers = useCallback((basePrompt: string, answers: Record<string, string | string[]>) => {
    const answerText = Object.entries(answers)
      .map(([question, answer]) => {
        const answerStr = Array.isArray(answer) ? answer.join(', ') : answer;
        return `- ${question}: ${answerStr}`;
      })
      .join('\n');
    return `${basePrompt}\n\nUser preferences:\n${answerText}`;
  }, []);
  
  // Helper to advance to next wizard in multi-feature queue
  const advanceToNextWizard = useCallback((completedFeatureType: FeatureType, config: any) => {
    if (!analyzedRequest) return false;
    
    // Store the completed wizard config
    setWizardConfigs(prev => ({ ...prev, [completedFeatureType]: config }));
    
    // Find the next wizard feature
    const wizardFeatures = analyzedRequest.features.filter(f => f.requiresWizard);
    const currentIdx = wizardFeatures.findIndex(f => f.type === completedFeatureType);
    const nextIdx = currentIdx + 1;
    
    if (nextIdx < wizardFeatures.length) {
      const nextFeature = wizardFeatures[nextIdx];
      const wizardType = featureToWizardType(nextFeature.type);
      
      console.log('[ProjectDetail] Advancing to next wizard:', nextFeature.type, wizardType);
      
      // Update the analyzed request index
      setAnalyzedRequest(prev => prev ? {
        ...prev,
        currentFeatureIndex: prev.currentFeatureIndex + 1
      } : null);
      
      // Trigger the next wizard
      if (wizardType === 'booking') setShowBookingWizard(true);
      else if (wizardType === 'product') setShowProductWizard(true);
      else if (wizardType === 'auth') setShowAuthWizard(true);
      else if (wizardType === 'media') setShowMediaWizard(true);
      else if (wizardType === 'contact') setShowContactWizard(true);
      
      // Add wizard message to chat
      // Note: booking/contact need "_form_wizard" suffix, others just "_wizard"
      const wizardTypeKey = (wizardType === 'booking' || wizardType === 'contact') 
        ? `${wizardType}_form_wizard` 
        : `${wizardType}_wizard`;
      const wizardContent = JSON.stringify({
        type: wizardTypeKey,
        prompt: pendingFormPrompt
      });
      setChatMessages(prev => [...prev, {
        id: `${wizardType}-wizard-${Date.now()}`,
        role: 'assistant',
        content: wizardContent
      }]);
      
      return true; // More wizards to go
    }
    
    return false; // All wizards completed
  }, [analyzedRequest, pendingFormPrompt]);
  
  // Helper to generate final prompt after all wizards complete
  const generateFinalMultiFeaturePrompt = useCallback((allConfigs: Record<string, any>) => {
    if (!analyzedRequest) return pendingFormPrompt;
    
    const lines: string[] = [
      `Create a complete ${analyzedRequest.businessType} website with the following configured features:`,
      ''
    ];
    
    for (const feature of analyzedRequest.features) {
      const config = allConfigs[feature.type];
      lines.push(`## ${feature.description}`);
      if (config) {
        lines.push('Configuration:');
        lines.push(JSON.stringify(config, null, 2));
      } else {
        lines.push('(Auto-generate with sensible defaults)');
      }
      lines.push('');
    }
    
    lines.push('## Additional Requirements:');
    lines.push('- Use consistent styling across all pages');
    lines.push('- Implement proper navigation between all sections');
    lines.push('- Use the Midnight dark theme');
    lines.push('- Make it fully responsive');
    
    return lines.join('\n');
  }, [analyzedRequest, pendingFormPrompt]);

  useEffect(() => {
    return () => {
      if (autoCaptureTimeoutRef.current) {
        window.clearTimeout(autoCaptureTimeoutRef.current);
        autoCaptureTimeoutRef.current = null;
      }
    };
  }, []);

  // Resizable left panel state (desktop/tablet only)
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wakti-coder-leftPanelWidth');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 320 && parsed <= 720) return parsed;
      }
      // Default responsive width
      return window.innerWidth >= 1024 ? 480 : 420;
    }
    return 420;
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Persist left panel width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wakti-coder-leftPanelWidth', String(leftPanelWidth));
    }
  }, [leftPanelWidth]);

  const dividerDragRef = useRef({ active: false, startX: 0, startWidth: 0 });

  // Divider drag handlers (desktop/tablet only)
  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dividerDragRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: leftPanelWidth,
    };
    setIsDraggingDivider(true);
    const divider = e.currentTarget as HTMLElement;
    divider.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftPanelWidth]);

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dividerDragRef.current.active) return;
    const deltaX = e.clientX - dividerDragRef.current.startX;
    let newWidth = dividerDragRef.current.startWidth + deltaX;
    newWidth = Math.max(320, Math.min(720, newWidth));
    setLeftPanelWidth(newWidth);
  }, []);

  const handleDividerPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dividerDragRef.current.active) return;
    dividerDragRef.current.active = false;
    setIsDraggingDivider(false);
    const divider = e.currentTarget as HTMLElement;
    if (divider.hasPointerCapture(e.pointerId)) {
      divider.releasePointerCapture(e.pointerId);
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
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
  
  // Main tab state - Builder vs Server
  const [mainTab, setMainTab] = useState<MainTab>('builder');
  const [backendInitialTab, setBackendInitialTab] = useState<string | undefined>(undefined);
  const [backendInitialShopTab, setBackendInitialShopTab] = useState<'orders' | 'inventory' | 'categories' | 'discounts' | 'settings' | undefined>(undefined);
  const [backendRefreshKey, setBackendRefreshKey] = useState(0);
  
  // Uploaded assets from backend (for AI context)
  const [uploadedAssets, setUploadedAssets] = useState<Array<{ filename: string; url: string; file_type: string | null }>>([]);
  
  // Backend context for AI coder awareness - EXPANDED for full backend integration
  const [backendContext, setBackendContext] = useState<{
    enabled: boolean;
    collections: Array<{ name: string; itemCount: number; schema?: any }>;
    formSubmissionsCount: number;
    uploadsCount: number;
    siteUsersCount: number;
    // NEW: E-commerce data
    products: Array<{ name: string; price: number; image?: string; category?: string }>;
    productsCount: number;
    ordersCount: number;
    hasShopSetup: boolean;
    // NEW: Booking data  
    services: Array<{ name: string; duration: number; price: number }>;
    servicesCount: number;
    bookingsCount: number;
    hasBookingsSetup: boolean;
    // NEW: Chat & Comments
    chatRoomsCount: number;
    commentsCount: number;
  } | null>(null);

  // Calculate project health/completion score
  const getProjectHealth = useCallback(() => {
    if (!project) return { score: 0, items: [] };
    
    const items: Array<{ label: string; labelAr: string; done: boolean; priority: 'high' | 'medium' | 'low' }> = [];
    
    // Check if code exists
    const hasCode = codeContent && codeContent.length > 200;
    items.push({ label: 'Code generated', labelAr: 'تم إنشاء الكود', done: hasCode, priority: 'high' });
    
    // Check if project has a name (not default)
    const hasCustomName = project.name && !project.name.includes('Generating') && project.name.length > 3;
    items.push({ label: 'Project named', labelAr: 'تم تسمية المشروع', done: hasCustomName, priority: 'low' });
    
    // Check if backend is enabled
    const hasBackend = backendContext?.enabled;
    items.push({ label: 'Backend enabled', labelAr: 'الخادم مفعل', done: !!hasBackend, priority: 'medium' });
    
    // Check if shop has products (if it's a shop project)
    const isShopProject = /shop|store|e-?commerce|product|متجر|منتج/i.test(project.description || codeContent || '');
    if (isShopProject) {
      const hasProducts = (backendContext?.productsCount || 0) > 0;
      items.push({ label: 'Products added', labelAr: 'تم إضافة المنتجات', done: hasProducts, priority: 'high' });
    }
    
    // Check if published
    const isPublished = project.status === 'published';
    items.push({ label: 'Published live', labelAr: 'منشور', done: isPublished, priority: 'medium' });
    
    // Calculate score
    const completedCount = items.filter(i => i.done).length;
    const score = Math.round((completedCount / items.length) * 100);
    
    return { score, items };
  }, [project, codeContent, backendContext]);

  // Determine which context hint to show based on project state
  const getContextHint = useCallback(() => {
    if (!project) return null;
    
    // First-time user with no code yet
    if (!codeContent || codeContent.length < 100) {
      if (contextHintDismissed.includes('first-project')) return null;
      return {
        id: 'first-project',
        icon: '💡',
        title: isRTL ? 'نصيحة' : 'Tip',
        message: isRTL 
          ? 'صف ما تريد بناءه بالتفصيل للحصول على أفضل نتيجة. مثال: "متجر لبيع العبايات مع سلة شراء وصفحة دفع"'
          : 'Describe what you want to build in detail for best results. Example: "An abaya store with shopping cart and checkout page"',
        action: null
      };
    }
    
    // Shop project without products in backend
    const isShopProject = /shop|store|e-?commerce|product|متجر|منتج/i.test(project.description || '');
    if (isShopProject && backendContext?.products?.length === 0) {
      if (contextHintDismissed.includes('add-products')) return null;
      return {
        id: 'add-products',
        icon: '🛍️',
        title: isRTL ? 'أضف منتجاتك' : 'Add Your Products',
        message: isRTL 
          ? 'متجرك جاهز! أضف منتجاتك الحقيقية من الخادم ← المتجر ← المخزون'
          : 'Your store is ready! Add your real products in Backend → Shop → Inventory',
        action: {
          label: isRTL ? 'إضافة منتجات' : 'Add Products',
          onClick: () => {
            setMainTab('server');
            setBackendInitialTab('shop');
            setBackendInitialShopTab('inventory');
          }
        }
      };
    }
    
    // Project ready but not published
    if (project.status === 'draft' && codeContent && codeContent.length > 500) {
      if (contextHintDismissed.includes('publish-ready')) return null;
      return {
        id: 'publish-ready',
        icon: '🚀',
        title: isRTL ? 'جاهز للنشر' : 'Ready to Publish',
        message: isRTL 
          ? 'مشروعك جاهز! انشره ليحصل على رابط عام يمكنك مشاركته'
          : 'Your project is ready! Publish it to get a public URL you can share',
        action: null
      };
    }
    
    return null;
  }, [project, codeContent, backendContext, contextHintDismissed, isRTL]);
  
  // Self-healing: Runtime error detection with smart auto-fix
  const [crashReport, setCrashReport] = useState<string | null>(null);
  const [autoFixCountdown, setAutoFixCountdown] = useState<number | null>(null);
  const [autoFixExhausted, setAutoFixExhausted] = useState<boolean>(false); // Show recovery UI when all attempts fail
  const [fixerInProgress, setFixerInProgress] = useState<boolean>(false); // Track when The Fixer is running
  const autoFixTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoFixTriggeredRef = useRef<boolean>(false);
  const autoFixAttemptsRef = useRef<Map<string, number>>(new Map()); // Track fix attempts per error
  const autoFixCooldownRef = useRef<number>(0); // Cooldown timestamp - no auto-fix until this time
  const MAX_GEMINI_ATTEMPTS = 3; // Attempts 1-3 use Gemini
  const FIXER_ATTEMPT = 4; // Attempt 4 uses Claude Opus 4 (The Fixer)
  
  // ========================================================================
  // 🔍 ERROR CLASSIFICATION SYSTEM (from Open Lovable)
  // Classifies errors for smarter auto-fix strategies
  // ========================================================================
  type ErrorType = 'missing-package' | 'syntax-error' | 'jsx-error' | 'undefined-error' | 'type-error' | 'not-rendered' | 'react-router-error' | 'unknown';
  
  const classifyError = useCallback((error: string): { type: ErrorType; packages?: string[]; hint?: string } => {
    const message = error.toLowerCase();
    
    // 🚨 REACT ROUTER ERRORS - Must wrap App in BrowserRouter
    // Common error: "Cannot destructure property 'basename' of 'React.useContext(...)' as it is null"
    if ((message.includes('basename') && message.includes('usecontext')) ||
        (message.includes('usenavigate') && message.includes('context')) ||
        (message.includes('uselocation') && message.includes('null')) ||
        (message.includes('useparams') && message.includes('null')) ||
        (message.includes('link') && message.includes('router') && message.includes('context'))) {
      return {
        type: 'react-router-error',
        hint: 'CRITICAL: App uses react-router-dom (Link, useNavigate, etc.) but is NOT wrapped in <BrowserRouter>. ' +
              'Fix index.js: import { BrowserRouter } from "react-router-dom"; then wrap <App /> in <BrowserRouter><App /></BrowserRouter>'
      };
    }
    
    // Missing package/module errors
    if (message.includes('failed to resolve import') || 
        message.includes('cannot find module') || 
        message.includes('module not found') ||
        message.includes('is not installed')) {
      // Extract package names
      const packages: string[] = [];
      const importMatches = error.matchAll(/(?:failed to resolve import|cannot find module|module not found)[^'"]*['"]([^'"]+)['"]/gi);
      for (const match of importMatches) packages.push(match[1]);
      return { 
        type: 'missing-package', 
        packages,
        hint: packages.length > 0 ? `Install or import: ${packages.join(', ')}` : 'Check import statements'
      };
    }
    
    // JSX/closing tag errors
    if (message.includes('expected corresponding jsx closing tag') ||
        message.includes('unterminated jsx') ||
        message.includes('adjacent jsx elements')) {
      return { 
        type: 'jsx-error',
        hint: 'Check JSX tags are properly opened and closed. Wrap multiple elements in a fragment <></>'
      };
    }
    
    // Syntax errors
    if (message.includes('syntax error') || 
        message.includes('unexpected token') || 
        message.includes('parsing error') ||
        message.includes('unexpected identifier')) {
      return { 
        type: 'syntax-error',
        hint: 'Check for missing brackets, commas, or semicolons'
      };
    }
    
    // Undefined/null errors (common AI mistake)
    if (message.includes('cannot read properties of undefined') ||
        message.includes('cannot read property') ||
        message.includes('is not defined') ||
        message.includes('is undefined')) {
      const propMatch = error.match(/reading '([^']+)'/i) || error.match(/property '([^']+)'/i);
      return { 
        type: 'undefined-error',
        hint: propMatch ? `Check if "${propMatch[1]}" exists before accessing it` : 'Check for null/undefined values'
      };
    }
    
    // Type errors
    if (message.includes('type error') || 
        message.includes('is not a function') ||
        message.includes('is not assignable')) {
      return { 
        type: 'type-error',
        hint: 'Check data types and function calls'
      };
    }
    
    // Not rendered (sandbox showing default page)
    if (message.includes('not rendered') || 
        message.includes('sandbox ready') ||
        message.includes('default page')) {
      return { 
        type: 'not-rendered',
        hint: 'App failed to render - check App.js exports and imports'
      };
    }
    
    return { type: 'unknown', hint: 'Unknown error - read the file and fix the issue' };
  }, []);
  
  // ========================================================================
  // 🔒 SINGLE-AGENT LOCK SYSTEM - Prevents race conditions
  // Only ONE agent operation can run at a time. When one starts, others are blocked.
  // ========================================================================
  type AgentType = 'user-chat' | 'auto-fix' | 'fixer' | 'revert' | null;
  const activeAgentRef = useRef<AgentType>(null);
  const activeAgentAbortRef = useRef<AbortController | null>(null);
  
  const acquireAgentLock = useCallback((agentType: AgentType): boolean => {
    if (activeAgentRef.current && activeAgentRef.current !== agentType) {
      console.log(`[Agent Lock] ❌ BLOCKED: ${agentType} cannot start - ${activeAgentRef.current} is running`);
      return false;
    }
    console.log(`[Agent Lock] ✅ ACQUIRED: ${agentType}`);
    activeAgentRef.current = agentType;
    return true;
  }, []);
  
  const releaseAgentLock = useCallback((agentType: AgentType) => {
    if (activeAgentRef.current === agentType) {
      console.log(`[Agent Lock] 🔓 RELEASED: ${agentType}`);
      activeAgentRef.current = null;
      activeAgentAbortRef.current = null;
    }
  }, []);
  
  const forceReleaseAllLocks = useCallback(() => {
    console.log(`[Agent Lock] ⚠️ FORCE RELEASE ALL - was: ${activeAgentRef.current}`);
    if (activeAgentAbortRef.current) {
      activeAgentAbortRef.current.abort();
    }
    activeAgentRef.current = null;
    activeAgentAbortRef.current = null;
    setAiEditing(false);
    setIsGenerating(false);
    setFixerInProgress(false);
    setAutoFixCountdown(null);
    autoFixTriggeredRef.current = false;
  }, []);
  
  // Stop generation functionality
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStopping(true);
    
    // 🔒 Release all agent locks and reset all states
    forceReleaseAllLocks();
    setThinkingStartTime(null);
    setGenerationSteps([]);
    
    // Add a message indicating generation was stopped
    setChatMessages(prev => [...prev, {
      id: `stopped-${Date.now()}`,
      role: 'assistant',
      content: isRTL ? '⏹️ تم إيقاف التوليد بواسطة المستخدم' : '⏹️ Generation stopped by user'
    }]);
    
    // Reset stopping state after a moment
    setTimeout(() => setIsStopping(false), 500);
  }, [isRTL, forceReleaseAllLocks]);

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
  
  // Celebratory modal for project completion
  const [showProjectCompleteModal, setShowProjectCompleteModal] = useState(false);

  // Element selection mode - for "Send Element" feature (Visual Inspector)
  const [elementSelectMode, setElementSelectMode] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<{
    tagName: string;
    className: string;
    id: string;
    innerText: string;
    openingTag: string;
    computedStyle?: {
      color: string;
      backgroundColor: string;
      fontSize: string;
    };
  } | null>(null);
  
  // Visual Edit Popover state
  const [showElementEditPopover, setShowElementEditPopover] = useState(false);
  
  // Force Sandpack re-render key (incremented on revert, starts with timestamp to force fresh mount)
  const [sandpackKey, setSandpackKey] = useState(() => Date.now());

  // Visual Edit Mode keyboard shortcuts (Ctrl+Z undo, Ctrl+Shift+Z redo)
  useEffect(() => {
    if (!showElementEditPopover) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const previousFiles = visualEditHistory.undo();
        if (previousFiles) {
          setGeneratedFiles(previousFiles);
          setCodeContent(previousFiles['/App.js'] || '');
          toast.info(isRTL ? 'تم التراجع' : 'Undone');
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for Redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const nextFiles = visualEditHistory.redo();
        if (nextFiles) {
          setGeneratedFiles(nextFiles);
          setCodeContent(nextFiles['/App.js'] || '');
          toast.info(isRTL ? 'تم الإعادة' : 'Redone');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showElementEditPopover, visualEditHistory, isRTL]);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  // Track if we've already started generation to prevent double-runs
  const generationStartedRef = useRef(false);

  // Apply body class for full-height layout (CSS in index.css handles the rest)
  useEffect(() => {
    document.body.classList.add('project-detail-page');
    return () => {
      document.body.classList.remove('project-detail-page');
    };
  }, []);

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
        const typedData = data as unknown as Array<{ id: string; role: string; content: string; snapshot?: string }>;
        const latestCard = [...typedData].reverse().find((msg) => {
          try {
            const parsed = JSON.parse(msg.content);
            return parsed?.type === 'product_form_card';
          } catch {
            return false;
          }
        });
        if (latestCard?.id) {
          setActiveProductCardId(latestCard.id);
          setShowProductFormCard(true);
        }
        
        // Force scroll to bottom after chat history loads with longer delays
        // This ensures scroll happens AFTER React renders the messages
        const forceScrollToBottom = () => {
          if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
          }
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        };
        setTimeout(forceScrollToBottom, 200);
        setTimeout(forceScrollToBottom, 500);
        setTimeout(forceScrollToBottom, 1000);
        setTimeout(forceScrollToBottom, 1500);
      } else {
        console.log('[ProjectDetail] No chat messages found for project', id);
      }
    } catch (err) {
      console.error('Exception fetching chat history:', err);
    }
  };

  // Fetch uploaded assets from project backend storage
  const fetchUploadedAssets = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('project_uploads')
        .select('filename, storage_path, file_type, bucket_id')
        .eq('project_id', id);
      
      if (error) {
        console.error('Error fetching uploaded assets:', error);
        return;
      }

      if (data && data.length > 0) {
        const assets = data.map((upload: any) => {
          const bucket = upload.bucket_id || 'project-assets';
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(upload.storage_path);
          return {
            filename: upload.filename,
            url: urlData.publicUrl,
            file_type: upload.file_type
          };
        });
        setUploadedAssets(assets);
        console.log('[ProjectDetail] Loaded', assets.length, 'uploaded assets for AI context');
      }
    } catch (err) {
      console.error('Exception fetching uploaded assets:', err);
    }
  };

  // Fetch backend context for AI coder awareness - EXPANDED with shop, bookings, chat
  const fetchBackendContext = async () => {
    if (!id) return null;
    try {
      // Check if backend is enabled
      const { data: backendData } = await supabase
        .from('project_backends')
        .select('enabled')
        .eq('project_id', id)
        .maybeSingle();
      
      const defaultContext = {
        enabled: false,
        collections: [],
        formSubmissionsCount: 0,
        uploadsCount: 0,
        siteUsersCount: 0,
        products: [],
        productsCount: 0,
        ordersCount: 0,
        hasShopSetup: false,
        services: [],
        servicesCount: 0,
        bookingsCount: 0,
        hasBookingsSetup: false,
        chatRoomsCount: 0,
        commentsCount: 0,
      };
      
      if (!backendData?.enabled) {
        setBackendContext(defaultContext);
        return defaultContext;
      }

      // Fetch collections with counts
      const { data: collectionsData } = await supabase
        .from('project_collections')
        .select('collection_name, data')
        .eq('project_id', id);
      
      const collectionCounts: Record<string, number> = {};
      (collectionsData || []).forEach((item: any) => {
        collectionCounts[item.collection_name] = (collectionCounts[item.collection_name] || 0) + 1;
      });
      
      const collections = Object.entries(collectionCounts).map(([name, itemCount]) => ({ name, itemCount }));

      // Fetch form submissions count
      const { count: formSubmissionsCount } = await supabase
        .from('project_form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // Fetch uploads count
      const { count: uploadsCount } = await supabase
        .from('project_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // Fetch site users count
      const { count: siteUsersCount } = await supabase
        .from('project_site_users')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // NEW: Fetch products (from inventory collection)
      const { data: productsData } = await supabase
        .from('project_collections')
        .select('data')
        .eq('project_id', id)
        .eq('collection_name', 'products')
        .limit(10);
      
      const products = (productsData || []).map((p: any) => ({
        name: p.data?.name || p.data?.title || 'Unnamed Product',
        price: p.data?.price || 0,
        image: p.data?.image || p.data?.imageUrl,
        category: p.data?.category,
      }));

      // Use inventory as source of truth for product count (matches backend UI)
      const { count: inventoryCount } = await supabase
        .from('project_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .eq('collection_name', 'products');

      // NEW: Fetch orders count
      const { count: ordersCount } = await supabase
        .from('project_orders')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // NEW: Fetch services (from services collection or bookings setup)
      const { data: servicesData } = await supabase
        .from('project_collections')
        .select('data')
        .eq('project_id', id)
        .eq('collection_name', 'booking_services')
        .limit(10);
      
      const services = (servicesData || []).map((s: any) => ({
        name: s.data?.name || s.data?.title || 'Unnamed Service',
        duration: s.data?.duration || 30,
        price: s.data?.price || 0,
      }));

      // NEW: Fetch bookings count
      const { count: bookingsCount } = await supabase
        .from('project_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // NEW: Fetch chat rooms count
      const { count: chatRoomsCount } = await supabase
        .from('project_chat_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      // NEW: Fetch comments count
      const { count: commentsCount } = await supabase
        .from('project_comments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      const nextContext = {
        enabled: true,
        collections,
        formSubmissionsCount: formSubmissionsCount || 0,
        uploadsCount: uploadsCount || 0,
        siteUsersCount: siteUsersCount || 0,
        products,
        productsCount: inventoryCount ?? products.length,
        ordersCount: ordersCount || 0,
        hasShopSetup: (inventoryCount ?? products.length) > 0,
        services,
        servicesCount: services.length,
        bookingsCount: bookingsCount || 0,
        hasBookingsSetup: services.length > 0,
        chatRoomsCount: chatRoomsCount || 0,
        commentsCount: commentsCount || 0,
      };
      setBackendContext(nextContext);
      
      console.log('[ProjectDetail] Backend context loaded:', { 
        enabled: true, 
        collections: collections.length, 
        products: products.length,
        services: services.length,
        ordersCount,
        bookingsCount,
      });
      return nextContext;
    } catch (err) {
      console.error('Exception fetching backend context:', err);
      return null;
    }
  };

  // Fetch uploaded assets and backend context when project loads
  useEffect(() => {
    if (id && user) {
      fetchUploadedAssets();
      fetchBackendContext();
    }
  }, [id, user]);

  const handleRevert = async (messageId: string) => {
    const targetMessage = chatMessages.find(m => m.id === messageId);
    console.log('[Revert] Target message:', messageId, targetMessage);
    console.log('[Revert] Snapshot:', targetMessage?.snapshot);
    console.log('[Revert] Snapshot keys:', targetMessage?.snapshot ? Object.keys(targetMessage.snapshot) : 'none');
    
    if (!targetMessage || !targetMessage.snapshot) {
      toast.error(isRTL ? 'لا توجد نسخة احتياطية متاحة' : 'No snapshot available for this point');
      return;
    }
    
    // 🔒 CRITICAL: Force release all locks and STOP all auto-fix activity
    forceReleaseAllLocks();
    
    // 🔒 CRITICAL: Clear ALL auto-fix state to prevent re-triggering
    setCrashReport(null);
    setAutoFixExhausted(false);
    setAutoFixCountdown(null);
    autoFixTriggeredRef.current = false;
    autoFixAttemptsRef.current.clear(); // Clear all attempt tracking
    autoFixCooldownRef.current = Date.now() + 10000; // 🔒 10 second cooldown after revert
    if (autoFixTimerRef.current) {
      clearInterval(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    
    // 🔒 Acquire revert lock
    if (!acquireAgentLock('revert')) {
      toast.error(isRTL ? 'يرجى الانتظار حتى ينتهي العمل الحالي' : 'Please wait for current operation to finish');
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
      releaseAgentLock('revert'); // 🔒 Release revert lock
    }
  };

  // Scroll to bottom when messages or generation state changes
  const scrollToBottom = useCallback(() => {
    // Use requestAnimationFrame to ensure DOM is painted before scrolling
    requestAnimationFrame(() => {
      // Method 1: Use scrollIntoView on the end ref (more reliable)
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
      }
      // Method 2: Fallback to scrollTop
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  }, []);

  // Use useLayoutEffect for synchronous scroll after DOM updates (more reliable)
  useLayoutEffect(() => {
    // Scroll to bottom when messages change (including initial load)
    // Skip auto-scroll when ProductFormCard is shown - let it scroll to top instead
    if (showProductFormCard) return;
    
    // Immediate scroll after DOM update
    scrollToBottom();
  }, [chatMessages, showProductFormCard, scrollToBottom]);

  useEffect(() => {
    // Additional delayed scrolls for async content that renders after initial paint
    if (showProductFormCard) return;
    
    const timer1 = setTimeout(scrollToBottom, 150);
    const timer2 = setTimeout(scrollToBottom, 400);
    const timer3 = setTimeout(scrollToBottom, 800);
    const timer4 = setTimeout(scrollToBottom, 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [chatMessages, showProductFormCard, scrollToBottom]);

  // AGGRESSIVE SCROLL FIX: Scroll to bottom on initial mount and when chat panel becomes visible
  useEffect(() => {
    if (leftPanelMode === 'chat' && chatMessages.length > 0 && !showProductFormCard) {
      // Multiple aggressive scroll attempts when switching to chat mode
      const scrollAggressively = () => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      };
      
      scrollAggressively();
      setTimeout(scrollAggressively, 50);
      setTimeout(scrollAggressively, 150);
      setTimeout(scrollAggressively, 300);
      setTimeout(scrollAggressively, 500);
      setTimeout(scrollAggressively, 1000);
    }
  }, [leftPanelMode, chatMessages.length, showProductFormCard]);

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

      const backendContextForCreate = backendContext || await fetchBackendContext();

      // FIX: Fetch uploaded assets (PDFs, images, docs) so the backend can extract text
      // Previously, only plain URL strings were sent as `assets` but the PDF extraction
      // engine requires `uploadedAssets` objects with {filename, url, file_type}.
      let uploadedAssetsForCreate: Array<{ filename: string; url: string; file_type: string | null }> = [];
      try {
        const { data: uploads } = await supabase
          .from('project_uploads')
          .select('filename, storage_path, file_type, bucket_id')
          .eq('project_id', id);
        
        if (uploads && uploads.length > 0) {
          uploadedAssetsForCreate = uploads.map((upload: any) => {
            const bucket = upload.bucket_id || 'project-assets';
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(upload.storage_path);
            return {
              filename: upload.filename,
              url: urlData.publicUrl,
              file_type: upload.file_type
            };
          });
          console.log('[ProjectDetail] Loaded', uploadedAssetsForCreate.length, 'uploaded assets for initial creation');
        }
      } catch (err) {
        console.error('[ProjectDetail] Error fetching uploads for creation:', err);
      }

      // Option A: start job then poll
      // NOTE: Complex multi-feature projects may cause 504 Gateway Timeout
      // The job still runs in the background, so we poll for the latest job status
      let jobId: string | undefined;
      
      // Prepare attached images/PDFs for the backend
      const imagesForBackend = attachedImages.map((img) => {
        if (img?.pdfDataUrl) {
          return `[PDF:${img.file.name}]${img.pdfDataUrl}`;
        }
        return img.preview;
      });
      
      try {
        const startRes = await supabase.functions.invoke('projects-generate', {
          body: {
            action: 'start',
            projectId: id,
            mode: 'create',
            prompt: finalPrompt,
            theme,
            assets,
            images: imagesForBackend,
            uploadedAssets: uploadedAssetsForCreate, // PDFs/docs/images with filename+url+file_type for extraction
            userInstructions: customThemeInstructions,
            backendContext: backendContextForCreate || undefined,
            debugContext: debugContext?.getDebugContextForAgent?.(),
            lang: searchParams.get('lang') || language,
          },
        });

        if (startRes.error) {
          // Check if it's a gateway timeout - job may still be running
          const isTimeout = startRes.error.message?.includes('504') || 
                           startRes.error.message?.includes('timeout') ||
                           startRes.error.message?.includes('Gateway');
          if (!isTimeout) {
            throw new Error(startRes.error.message || 'Failed to start generation');
          }
          console.log('[Create Mode] Gateway timeout detected, will poll for job status...');
        } else {
          const startData: any = startRes.data;
          if (!startData?.ok && !startData?.jobId) {
            throw new Error(startData?.error || 'Failed to start generation');
          }
          jobId = startData?.jobId as string | undefined;
        }
      } catch (fetchErr: any) {
        // Network errors or timeouts - job may still be running in background
        // Be very lenient here - any network error during a long generation should trigger polling
        const errMsg = fetchErr?.message || '';
        const isNetworkOrTimeout = errMsg.includes('504') || 
                                   errMsg.includes('timeout') || 
                                   errMsg.includes('Gateway') || 
                                   errMsg.includes('Failed to fetch') ||
                                   errMsg.includes('ERR_FAILED') ||
                                   errMsg.includes('network') ||
                                   errMsg.includes('CORS') ||
                                   errMsg.includes('aborted');
        if (!isNetworkOrTimeout) {
          throw fetchErr;
        }
        console.log('[Create Mode] Request failed (likely timeout/network), will poll for job status...', errMsg);
      }

      // If we didn't get a jobId, poll for the latest job for this project
      if (!jobId) {
        console.log('[Create Mode] No jobId received, polling for latest job...');
        // Wait a moment for the job to be created in DB
        await delay(2000);
        
        // Query for the latest job for this project
        const { data: latestJobs } = await supabase
          .from('project_generation_jobs')
          .select('id, status')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (latestJobs && latestJobs.length > 0) {
          jobId = latestJobs[0].id;
          console.log(`[Create Mode] Found latest job: ${jobId}, status: ${latestJobs[0].status}`);
        } else {
          throw new Error('No job found after timeout - generation may have failed to start');
        }
      }

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

      const backendCtaLines: string[] = [];
      if (backendContextForCreate?.enabled) {
        if (!backendContextForCreate.hasShopSetup) {
          backendCtaLines.push(
            isRTL
              ? 'لا توجد منتجات بعد — أضف أول منتج من لوحة الخلفية ← المتجر ← المخزون.'
              : 'No products yet — add your first product in Backend → Shop → Inventory.'
          );
        }
        if (!backendContextForCreate.hasBookingsSetup) {
          backendCtaLines.push(
            isRTL
              ? 'لا توجد خدمات بعد — أضف خدماتك من لوحة الخلفية ← الحجوزات ← الخدمات.'
              : 'No services yet — add your services in Backend → Bookings → Services.'
          );
        }
      }
      const backendCta = backendCtaLines.length > 0 ? `\n\n${backendCtaLines.join('\n')}` : '';

      // Save assistant message to DB with snapshot
      const assistantMsg = isRTL 
        ? `لقد انتهيت من بناء مشروعك! ألقِ نظرة على المعاينة. ✨ يمكنك الآن تعديله أو نشره.${backendCta}` 
        : `I've finished building your project! Take a look at the preview. ✨ You can now edit or publish it.${backendCta}`;
      
      // Show celebratory modal with confetti
      setShowProjectCompleteModal(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setShowProjectCompleteModal(false);
      }, 3000);
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
      
      // Check if this was a shop/store request to show appropriate CTA
      const isShopProject = /shop|store|e-?commerce|product|متجر|منتج/i.test(prompt);
      const readyMsg = isShopProject
        ? (isRTL 
            ? 'تم إنشاء متجرك! ✓\n\n**الخطوة التالية:** أضف منتجاتك من **الخادم ← المتجر ← المخزون**'
            : 'Your store is ready! ✓\n\n**Next step:** Add your products in **Backend → Shop → Inventory**')
        : (isRTL ? 'تم إنشاء مشروعك! ✓ يمكنك الآن تعديله أو نشره.' : 'Your project is ready! ✓ You can now edit or publish it.');
      
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
      
      // For shop projects, also show a toast with CTA
      if (isShopProject) {
        toast.success(isRTL ? 'تم إنشاء المتجر! أضف منتجاتك من الخادم' : 'Store created! Add products in Backend tab', {
          duration: 5000,
          action: {
            label: isRTL ? 'إضافة منتجات' : 'Add Products',
            onClick: () => {
              setMainTab('server');
              setBackendInitialTab('shop');
              setBackendInitialShopTab('inventory');
            }
          }
        });
      } else {
        toast.success(isRTL ? 'تم إنشاء المشروع!' : 'Project created!');
      }
      
    } catch (err: any) {
      console.error('Generation error:', err);
      
      // Mark all steps as error so the task card shows failure state
      setGenerationSteps(prev => prev.map(s => 
        s.status === 'loading' || s.status === 'pending' 
          ? { ...s, status: 'error' as const } 
          : s
      ));
      
      // Build a more helpful error message based on the error type
      let errorMsg: string;
      const errorCode = err.message || '';
      
      if (errorCode.includes('MISSING_APP_JS')) {
        errorMsg = isRTL 
          ? 'عذرًا، لم يتمكن الذكاء الاصطناعي من إنشاء الكود بشكل صحيح. حاول مرة أخرى بطلب أبسط.'
          : 'Sorry, the AI couldn\'t generate valid code. Try again with a simpler request.';
      } else if (errorCode.includes('timed out')) {
        errorMsg = isRTL
          ? 'انتهت المهلة. المشروع معقد جدًا - حاول بطلب أبسط.'
          : 'Generation timed out. The project may be too complex - try a simpler request.';
      } else {
        errorMsg = isRTL ? 'عذرًا، حدث خطأ. حاول مرة أخرى.' : 'Sorry, an error occurred. Please try again.';
      }
      
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
      
      // Keep the error steps visible for 5 seconds before clearing
      setTimeout(() => {
        setGenerationSteps([]);
      }, 5000);
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
      
      // CRITICAL: Verify ownership to prevent cross-user access
      // RLS allows viewing published projects, but editing should be owner-only
      if (projectData.user_id !== user?.id) {
        console.error('Access denied: Project belongs to another user');
        toast.error(isRTL ? 'ليس لديك صلاحية للوصول لهذا المشروع' : 'You do not have permission to access this project');
        navigate('/projects');
        return;
      }
      
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

  const pollJobUntilDone = async (jobId: string, timeoutMs: number = 600000): Promise<GenerationJob> => {
    // Increased timeout to 10 minutes (600s) for complex multi-feature projects with detailed prompts
    const start = Date.now();
    let pollCount = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10; // Only fail after 10 consecutive errors
    
    // Progress messages to show user while waiting
    const progressMessages = isRTL 
      ? ['جاري التحليل...', 'جاري بناء الهيكل...', 'جاري إنشاء المكونات...', 'جاري تطبيق الأنماط...', 'جاري التحسين...', 'اللمسات الأخيرة...']
      : ['Analyzing request...', 'Building structure...', 'Creating components...', 'Applying styles...', 'Optimizing...', 'Final touches...'];
    
    while (Date.now() - start < timeoutMs) {
      pollCount++;
      
      // Update progress message periodically
      if (pollCount % 5 === 0) {
        const msgIndex = Math.min(Math.floor(pollCount / 10), progressMessages.length - 1);
        setGenerationSteps(prev => prev.map((s, i) => 
          i === 2 ? { ...s, label: progressMessages[msgIndex] } : s
        ));
      }
      
      try {
        const res = await supabase.functions.invoke('projects-generate', {
          body: { action: 'status', jobId }
        });

        if (res.error) {
          // Don't fail immediately on status check errors - may be transient
          consecutiveErrors++;
          console.warn(`[Poll ${pollCount}] Status check error (${consecutiveErrors}/${maxConsecutiveErrors}): ${res.error.message}`);
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Too many consecutive errors: ${res.error.message}`);
          }
          await delay(3000); // Wait longer on errors
          continue;
        }
        
        // Reset error counter on successful response
        consecutiveErrors = 0;

        const job = (res.data?.job || null) as GenerationJob | null;
        if (!job) {
          console.warn(`[Poll ${pollCount}] Job not found yet, retrying...`);
          await delay(2000);
          continue;
        }

        if (job.status === 'succeeded') {
          console.log(`[Poll ${pollCount}] Job succeeded!`);
          return job;
        }
        if (job.status === 'failed') throw new Error(job.error || 'Generation failed');

        // Job still running - this is normal, keep polling
        // Use slower polling to avoid rate limiting (429 errors)
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`[Poll ${pollCount}] Job status: ${job.status}, elapsed: ${elapsed}s, waiting...`);
        await delay(5000); // Poll every 5 seconds (reduced from 2s to avoid rate limiting)
      } catch (pollErr: any) {
        // Network errors during polling - retry unless too many
        consecutiveErrors++;
        console.warn(`[Poll ${pollCount}] Poll error (${consecutiveErrors}/${maxConsecutiveErrors}): ${pollErr.message}`);
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw pollErr;
        }
        await delay(8000); // Wait longer on errors (increased from 3s)
      }
    }

    throw new Error(isRTL ? 'انتهت مهلة الإنشاء بعد 10 دقائق' : 'Generation timed out after 10 minutes');
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
    // Force Sandpack to fully re-mount (picks up new inspector code, etc.)
    setSandpackKey(prev => prev + 1);
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
      let projectFiles: Record<string, string> = 
        Object.keys(generatedFiles).length > 0 
          ? { ...generatedFiles } 
          : { "/App.js": codeContent };
      
      // Ensure /App.js has latest editor content
      if (codeContent) {
        projectFiles["/App.js"] = codeContent;
      }
      
      // CRITICAL: Replace {{PROJECT_ID}} placeholder with actual project ID
      // This ensures forms work correctly on published sites
      for (const [path, content] of Object.entries(projectFiles)) {
        projectFiles[path] = content.replace(/\{\{PROJECT_ID\}\}/g, id || '');
      }
      console.log('[Publish] Replaced PROJECT_ID placeholders in', Object.keys(projectFiles).length, 'files');

      const finalSubdomain = subdomainInput.toLowerCase();

      // ============================================
      // PROPER BUNDLING: Use project-build edge function with esbuild
      // ============================================
      console.log('Bundling project with esbuild via project-build...');
      console.log('Project files:', Object.keys(projectFiles));
      
      // Step 1: Call project-build to bundle the files properly
      const { data: buildResult, error: buildError } = await supabase.functions.invoke('project-build', {
        body: {
          files: projectFiles,
          entryPoint: '/App.js'
        }
      });

      if (buildError) {
        console.error('Build error:', buildError);
        throw new Error(buildError.message || 'Failed to bundle project');
      }

      if (!buildResult?.success || !buildResult?.bundle) {
        console.error('Build failed:', buildResult);
        throw new Error(buildResult?.error || 'Project bundling failed');
      }

      const { js: bundledJs, css: bundledCss } = buildResult.bundle;
      console.log(`Bundle successful: ${bundledJs.length} bytes JS, ${bundledCss.length} bytes CSS`);

      // Step 2: Generate index.html with bundled code
      const projectName = project.name || 'Wakti Project';
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <!-- React 18 -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Framer Motion v6 UMD build (creates window.Motion global - v11+ is ESM-only and won't work) -->
  <script src="https://unpkg.com/framer-motion@6.5.1/dist/framer-motion.js" crossorigin></script>
  <!-- Lucide Icons for all 1500+ icons -->
  <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js" crossorigin></script>
  <!-- Recharts for data visualization -->
  <script src="https://unpkg.com/recharts@2.10.3/umd/Recharts.min.js" crossorigin></script>
  <!-- Tailwind CSS v3 (JIT) for all color shades -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts: Extended set for various themes -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&family=Oswald:wght@400;500;600;700&family=Cairo:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    // Configure Tailwind with extended theme
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
            tajawal: ['Tajawal', 'sans-serif'],
            oswald: ['Oswald', 'sans-serif'],
            cairo: ['Cairo', 'sans-serif'],
            playfair: ['Playfair Display', 'serif'],
            roboto: ['Roboto', 'sans-serif'],
            poppins: ['Poppins', 'sans-serif'],
          },
          colors: {
            // Extended palette for all shades - ensures all text colors work
            gray: {
              50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
              500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
            },
            zinc: {
              50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
              500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
            },
            slate: {
              50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
              500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
            },
            purple: {
              50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
              500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
            },
            pink: {
              50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
              500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
            },
            rose: {
              50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
              500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
            },
            amber: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
              500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
            },
          },
        },
      },
    };
  </script>
  <style>
    /* Base Reset - Minimal safe defaults */
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; min-height: 100vh; font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    #root { min-height: 100vh; }
    
    /* Gradient text support */
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    
    /* User's custom CSS (ONLY imported CSS from the project) */
    ${bundledCss}
  </style>
</head>
<body>
  <div id="root">
    <!-- Initial loading state - replaced when app renders -->
    <div id="wakti-boot-status" style="padding:40px;text-align:center;font-family:Inter,system-ui,sans-serif;">
      <div style="font-size:24px;margin-bottom:16px;">⏳</div>
      <div style="color:#666;">Loading app...</div>
    </div>
  </div>
  <script>
    // ===== BOOT DIAGNOSTICS =====
    window.__waktiBootLog = [];
    function waktiLog(msg) {
      window.__waktiBootLog.push('[' + new Date().toISOString() + '] ' + msg);
      console.log('[Wakti Boot]', msg);
    }
    
    // Catch any uncaught errors
    window.onerror = function(msg, url, line, col, error) {
      waktiLog('UNCAUGHT ERROR: ' + msg + ' at ' + url + ':' + line);
      var bootDiv = document.getElementById('wakti-boot-status');
      if (bootDiv) {
        bootDiv.innerHTML = '<div style="color:#f87171;font-size:18px;margin-bottom:16px;">❌ Error</div>' +
          '<pre style="background:#1e1e1e;padding:16px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;color:#f87171;">' + 
          msg + '\\n' + (error?.stack || '') + '</pre>' +
          '<div style="color:#9ca3af;margin-top:16px;font-size:12px;">Check console for details</div>';
      }
      return false;
    };
    window.onunhandledrejection = function(e) {
      waktiLog('UNHANDLED PROMISE: ' + (e.reason?.message || e.reason || 'Unknown'));
    };
    
    waktiLog('Script block starting');
    waktiLog('React available: ' + (typeof React !== 'undefined'));
    waktiLog('ReactDOM available: ' + (typeof ReactDOM !== 'undefined'));
    
    // Expose framer-motion globally for the bundled shim
    // IMPORTANT: unpkg UMD build registers as window.Motion
    const FM = window.FramerMotion || window.Motion;
    waktiLog('Framer Motion (FM) available: ' + (!!FM) + ' (FramerMotion=' + (!!window.FramerMotion) + ', Motion=' + (!!window.Motion) + ')');
    if (typeof FM !== 'undefined' && FM) {
      window.FramerMotion = FM;
      window.motion = FM.motion;
      window.AnimatePresence = FM.AnimatePresence;
      window.useAnimation = FM.useAnimation;
      window.useInView = FM.useInView;
      window.useScroll = FM.useScroll;
      window.useTransform = FM.useTransform;
      window.useMotionValue = FM.useMotionValue;
    } else {
      waktiLog('WARNING: Framer Motion not available on window');
    }
    
    // Expose lucide icons globally for the bundled shim
    waktiLog('Lucide available: ' + (typeof window.lucide !== 'undefined'));
    if (typeof window.lucide !== 'undefined' && window.lucide) {
      window.__lucideIcons = window.lucide;
    } else {
      waktiLog('WARNING: Lucide not available on window');
    }
    
    waktiLog('About to execute bundled code...');
    
    // Bundled app code with all shims included
    ${bundledJs}
    
    waktiLog('Bundled code executed');
    waktiLog('window.App type: ' + (typeof window.App));
    waktiLog('window.AppBundle type: ' + (typeof window.AppBundle));
    if (typeof window.AppBundle !== 'undefined') {
      waktiLog('AppBundle keys: ' + Object.keys(window.AppBundle || {}).join(', '));
    }
    
    // Render the app with retry guard (wait for window.App)
    function renderApp(retries) {
      retries = retries || 0;
      try {
        waktiLog('renderApp attempt ' + (retries + 1) + ', window.App=' + (typeof window.App));
        
        if (typeof window.App === 'undefined' || window.App === null) {
          if (retries < 20) {
            setTimeout(function() { renderApp(retries + 1); }, 100);
            return;
          }
          throw new Error('App component not found after ' + retries + ' attempts. window.App = ' + typeof window.App + '. Boot log: ' + window.__waktiBootLog.join(' | '));
        }
        var rootElement = document.getElementById('root');
        var root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(window.App));
        waktiLog('App rendered successfully!');
      } catch (err) {
        waktiLog('RENDER ERROR: ' + (err.message || err));
        console.error('[Wakti] Render error:', err);
        document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;font-family:Inter,sans-serif;"><h2>Error loading app</h2><pre style="background:#1e1e1e;padding:20px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;">' + (err.message || err) + '</pre><details style="margin-top:20px;text-align:left;"><summary style="cursor:pointer;color:#9ca3af;">Boot Log</summary><pre style="background:#1e1e1e;padding:12px;border-radius:4px;font-size:10px;margin-top:8px;">' + (window.__waktiBootLog || []).join('\\n') + '</pre></details></div>';
      }
    }
    // Start render on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { renderApp(0); });
    } else {
      renderApp(0);
    }
  </script>
</body>
</html>`;

      console.log('Generated index.html size:', indexHtml.length);

      const subdomainUrl = `https://${finalSubdomain}.wakti.ai`;
      console.log('Published (wildcard routing) to:', subdomainUrl);

      // Update project in database with the published URL
      const { error: updateError } = await supabase
        .from('projects' as any)
        .update({
          status: 'published',
          published_url: subdomainUrl,
          subdomain: finalSubdomain,
          deployment_id: null,
          bundled_code: JSON.stringify(projectFiles),
          published_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      
      if (updateError) {
        const pgCode = (updateError as any)?.code;
        const msg = (updateError as any)?.message || '';
        if (pgCode === '23505' || msg.toLowerCase().includes('projects_unique_published_subdomain')) {
          const takenMsg = isRTL ? 'هذا الاسم مستخدم بالفعل' : 'This name is already taken';
          setSubdomainError(takenMsg);
          toast.error(takenMsg);
          return;
        }
        console.error('Error updating project:', updateError);
        // Don't throw - the site is already deployed, just log the DB error
      }

      setProject(prev => prev ? {
        ...prev,
        status: 'published',
        published_url: subdomainUrl,
        subdomain: finalSubdomain,
        deployment_id: null,
      } : null);

      setShowPublishModal(false);
      
      // 🎉 Celebration confetti animation!
      const duration = 2000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
      
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      
      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#a855f7', '#ec4899', '#6366f1', '#22c55e', '#eab308'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#a855f7', '#ec4899', '#6366f1', '#22c55e', '#eab308'],
        });
      }, 250);
      
      toast.success(isRTL ? '🎉 تم النشر بنجاح!' : '🎉 Published successfully!');
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
    // Collect all component/file paths (excluding App entry which we handle specially)
    // Support both .js and .jsx extensions
    const jsFiles = Object.keys(files).filter(f => 
      (f.endsWith('.js') || f.endsWith('.jsx')) && 
      f !== '/App.js' && 
      f !== '/App.jsx'
    );
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
      // Remove both .js and .jsx extensions when extracting component name
      const componentName = filePath.replace(/^\//, '').replace(/\.(js|jsx)$/, '').split('/').pop() || 'Component';
      // Wrap each component file content
      return `
// --- ${filePath} ---
${convertToGlobalComponent(content, componentName)}
`;
    }).join('\n');

    // Get App entry content (support both .js and .jsx)
    const appJsContent = files['/App.js'] || files['/App.jsx'] || '';
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
  <!-- Debug overlay for published sites - shows runtime errors on screen -->
  <script>
    window.__PUBLISH_VERSION__ = '${new Date().toISOString()}';
    console.log('Published HTML Version:', window.__PUBLISH_VERSION__);
    window.__PUBLISH_DEBUG__ = [];
    window.onerror = function(msg, url, line, col, err) {
      var errDiv = document.getElementById('__debug_overlay__');
      if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = '__debug_overlay__';
        errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:#fff;padding:12px;font-size:14px;z-index:99999;font-family:monospace;white-space:pre-wrap;max-height:50vh;overflow:auto;';
        document.body.appendChild(errDiv);
      }
      errDiv.innerHTML += '❌ ' + msg + '\\n   at line ' + line + ':' + col + '\\n';
      window.__PUBLISH_DEBUG__.push({msg:msg,line:line,col:col,err:err});
      return false;
    };
    window.onunhandledrejection = function(e) {
      var errDiv = document.getElementById('__debug_overlay__');
      if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = '__debug_overlay__';
        errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:#fff;padding:12px;font-size:14px;z-index:99999;font-family:monospace;white-space:pre-wrap;max-height:50vh;overflow:auto;';
        document.body.appendChild(errDiv);
      }
      errDiv.innerHTML += '❌ Promise: ' + (e.reason?.message || e.reason || 'Unknown') + '\\n';
    };
  </script>
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
      Languages: createIcon('<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'),
      Sparkles: createIcon('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
      Smile: createIcon('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
      BookOpen: createIcon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
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
      Feather: createIcon('<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>'),
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
      // Additional commonly used icons
      Angry: createIcon('<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M7.5 8 10 9"/><path d="m14 9 2.5-1"/><path d="M9 10h0"/><path d="M15 10h0"/>'),
      Laugh: createIcon('<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
      Frown: createIcon('<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
      Meh: createIcon('<circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
      HeartCrack: createIcon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="m12 13-1-1 2-2-3-2.5 2-2"/>'),
      Crown: createIcon('<path d="M12 6l4 6 5-4-2 10H5L3 8l5 4 4-6z"/>'),
      Medal: createIcon('<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>'),
      Trophy: createIcon('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
      Flame: createIcon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
      Flower: createIcon('<path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 0 4.5 4.5M7.5 12H9m7.5 0a4.5 4.5 0 1 1-4.5 4.5m4.5-4.5H15m-3 4.5V15"/><circle cx="12" cy="12" r="3"/><path d="m8 16 1.5-1.5"/><path d="M14.5 9.5 16 8"/><path d="m8 8 1.5 1.5"/><path d="M14.5 14.5 16 16"/>'),
      Flower2: createIcon('<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>'),
      Leaf: createIcon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
      TreePine: createIcon('<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>'),
      Mountain: createIcon('<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>'),
      Waves: createIcon('<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>'),
      Snowflake: createIcon('<line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>'),
      Umbrella: createIcon('<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>'),
      Rainbow: createIcon('<path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/>'),
      Sunrise: createIcon('<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
      Sunset: createIcon('<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
      CloudRain: createIcon('<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>'),
      CloudSun: createIcon('<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>'),
      Wind: createIcon('<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>'),
      Thermometer: createIcon('<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>'),
      Music: createIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
      Music2: createIcon('<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>'),
      Mic: createIcon('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),
      Headphones: createIcon('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
      Radio: createIcon('<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>'),
      Volume: createIcon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'),
      VolumeX: createIcon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>'),
      Tv: createIcon('<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>'),
      Monitor: createIcon('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      Laptop: createIcon('<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>'),
      Tablet: createIcon('<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
      Smartphone: createIcon('<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
      Watch: createIcon('<circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13 13"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>'),
      Gamepad2: createIcon('<line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>'),
      Coffee: createIcon('<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>'),
      Wine: createIcon('<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>'),
      Pizza: createIcon('<path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/>'),
      Cake: createIcon('<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>'),
      Cookie: createIcon('<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>'),
      Banana: createIcon('<path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/><path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z"/>'),
      Apple: createIcon('<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>'),
      Cherry: createIcon('<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>'),
      Carrot: createIcon('<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>'),
      Egg: createIcon('<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>'),
      Fish: createIcon('<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1-3 .07"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.07"/>'),
      Bird: createIcon('<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>'),
      Cat: createIcon('<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>'),
      Dog: createIcon('<path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/>'),
      Rabbit: createIcon('<path d="M20 8.54V4a2 2 0 1 0-4 0v3"/><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1.93 1.93 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a1 1 0 0 1-1 1h-1a1 1 0 0 0-1 1"/><path d="M7.61 12.53a3 3 0 1 0-1.6 4.3"/><path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h.01"/>'),
      Squirrel: createIcon('<path d="M15.236 22a3 3 0 0 0-2.2-5"/><path d="M16 20a3 3 0 0 1 3-3h1a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4V4"/><path d="M18 13h.01"/><path d="M18 6a4 4 0 0 0-4 4 7 7 0 0 0-7 7c0-5 4-5 4-10.5a4.5 4.5 0 1 0-9 0 2.5 2.5 0 0 0 5 0C7 10 3 11 3 17c0 2.8 2.2 5 5 5h10"/>'),
      Bug: createIcon('<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>'),
      Butterfly: createIcon('<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1V17l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2C18.7 20 18.9 19.6 17.8 19.2Z"/>'),
      Sparkle: createIcon('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/>'),
      Gem: createIcon('<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>'),
      Diamond: createIcon('<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"/>'),
      Key: createIcon('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
      KeyRound: createIcon('<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>'),
      Pencil: createIcon('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>'),
      PenTool: createIcon('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
      Highlighter: createIcon('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
      Eraser: createIcon('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
      Palette: createIcon('<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>'),
      Brush: createIcon('<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>'),
      PaintBucket: createIcon('<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>'),
      Scissors: createIcon('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
      Hammer: createIcon('<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>'),
      Wrench: createIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
      Screwdriver: createIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
      Lightbulb: createIcon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
      Megaphone: createIcon('<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
      Quote: createIcon('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'),
      Type: createIcon('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
      Bold: createIcon('<path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/>'),
      Italic: createIcon('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>'),
      Underline: createIcon('<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>'),
      AlignLeft: createIcon('<line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/>'),
      AlignCenter: createIcon('<line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/>'),
      AlignRight: createIcon('<line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/>'),
      AlignJustify: createIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
      Undo: createIcon('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
      Redo: createIcon('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>'),
      CircleDot: createIcon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>'),
      CircleCheck: createIcon('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
      CircleX: createIcon('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
      CirclePlus: createIcon('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>'),
      CircleMinus: createIcon('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>'),
      CircleArrowUp: createIcon('<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>'),
      CircleArrowDown: createIcon('<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/>'),
      SquareCheck: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="m9 12 2 2 4-4"/>'),
      SquareX: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
      SquarePlus: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 12h8"/><path d="M12 8v8"/>'),
      SquareMinus: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 12h8"/>'),
      ArrowUp: createIcon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
      ArrowDown: createIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
      ArrowUpRight: createIcon('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>'),
      ArrowDownLeft: createIcon('<path d="M17 7 7 17"/><path d="M17 17H7V7"/>'),
      ArrowUpLeft: createIcon('<path d="M7 7v10"/><path d="M7 7h10"/><path d="M17 17 7 7"/>'),
      ArrowDownRight: createIcon('<path d="m7 7 10 10"/><path d="M17 7v10H7"/>'),
      MoveUp: createIcon('<path d="M8 6L12 2L16 6"/><path d="M12 2V22"/>'),
      MoveDown: createIcon('<path d="M8 18L12 22L16 18"/><path d="M12 2V22"/>'),
      MoveLeft: createIcon('<path d="M6 8L2 12L6 16"/><path d="M2 12H22"/>'),
      MoveRight: createIcon('<path d="M18 8L22 12L18 16"/><path d="M2 12H22"/>'),
      Expand: createIcon('<path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/><path d="M3 16.2V21m0 0h4.8M3 21l6-6"/><path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/><path d="M3 7.8V3m0 0h4.8M3 3l6 6"/>'),
      Shrink: createIcon('<path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8"/><path d="M9 19.8V15m0 0H4.2M9 15l-6 6"/><path d="M15 4.2V9m0 0h4.8M15 9l6-6"/><path d="M9 4.2V9m0 0H4.2M9 9 3 3"/>'),
      Maximize: createIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
      Minimize: createIcon('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
      MoreHorizontal: createIcon('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
      MoreVertical: createIcon('<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'),
      GripVertical: createIcon('<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>'),
      GripHorizontal: createIcon('<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/>'),
      Move: createIcon('<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>'),
      RotateCcw: createIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
      Repeat: createIcon('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
      Shuffle: createIcon('<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>'),
      FastForward: createIcon('<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>'),
      Rewind: createIcon('<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>'),
      SkipForward: createIcon('<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>'),
      SkipBack: createIcon('<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>'),
      PlayCircle: createIcon('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
      PauseCircle: createIcon('<circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>'),
      StopCircle: createIcon('<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>'),
      Video: createIcon('<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/>'),
      VideoOff: createIcon('<path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z"/><line x1="2" y1="2" x2="22" y2="22"/>'),
      CameraOff: createIcon('<line x1="2" y1="2" x2="22" y2="22"/><path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16"/><path d="M9.5 4h5L17 7h4a2 2 0 0 1 2 2v7.5"/><path d="M14.121 15.121A3 3 0 1 1 9.88 10.88"/>'),
      MicOff: createIcon('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),
      Wifi: createIcon('<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
      WifiOff: createIcon('<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
      Bluetooth: createIcon('<path d="m7 7 10 10-5 5V2l5 5L7 17"/>'),
      Battery: createIcon('<rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/>'),
      BatteryLow: createIcon('<rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/><line x1="6" y1="11" x2="6" y2="13"/>'),
      BatteryFull: createIcon('<rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="10" y1="11" x2="10" y2="13"/><line x1="14" y1="11" x2="14" y2="13"/>'),
      Signal: createIcon('<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>'),
      Fingerprint: createIcon('<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>'),
      Scan: createIcon('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>'),
      ScanLine: createIcon('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>'),
      QrCode: createIcon('<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>'),
      Print: createIcon('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
      Printer: createIcon('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
      FileText: createIcon('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>'),
      FilePlus: createIcon('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
      FileX: createIcon('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="9.5" y1="12.5" x2="14.5" y2="17.5"/><line x1="14.5" y1="12.5" x2="9.5" y2="17.5"/>'),
      FolderOpen: createIcon('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
      FolderPlus: createIcon('<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
      FolderMinus: createIcon('<path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
      Archive: createIcon('<rect x="2" y="4" width="20" height="5" rx="2"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>'),
      Inbox: createIcon('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
      Trash2: createIcon('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
      Clipboard: createIcon('<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
      ClipboardCheck: createIcon('<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'),
      ClipboardList: createIcon('<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
      StickyNote: createIcon('<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>'),
      Pin: createIcon('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>'),
      PinOff: createIcon('<line x1="2" y1="2" x2="22" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/>'),
      Paperclip: createIcon('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
      AtSign: createIcon('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
      Hash: createIcon('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'),
      Percent: createIcon('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
      DollarSign: createIcon('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      Euro: createIcon('<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>'),
      CreditCard: createIcon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
      Wallet: createIcon('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
      Receipt: createIcon('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17V7"/>'),
      ShoppingBag: createIcon('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
      Package: createIcon('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
      Truck: createIcon('<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
      Car: createIcon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
      Bike: createIcon('<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'),
      Train: createIcon('<rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>'),
      Anchor: createIcon('<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>'),
      Rocket: createIcon('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'),
      Building: createIcon('<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'),
      Building2: createIcon('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>'),
      Factory: createIcon('<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>'),
      Church: createIcon('<path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 22V5l-6-3-6 3v17"/><path d="M12 7v5"/><path d="M10 9h4"/>'),
      Hospital: createIcon('<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>'),
      Hotel: createIcon('<path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><path d="m9 16 .348-.24c1.465-1.013 3.84-1.013 5.304 0L15 16"/><path d="M8 7h.01"/><path d="M16 7h.01"/><path d="M12 7h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/><path d="M10 22v-6.5m4 0V22"/>'),
      School: createIcon('<path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/>'),
      Store: createIcon('<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>'),
      Warehouse: createIcon('<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect x="6" y="10" width="12" height="12"/>'),
      House: createIcon('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
      HousePlus: createIcon('<path d="M13.22 2.416a2 2 0 0 0-2.511.057l-7 5.999A2 2 0 0 0 3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7.354"/><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M15 6h6"/><path d="M18 3v6"/>'),
      Tent: createIcon('<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>'),
      Flag: createIcon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
      FlagTriangleRight: createIcon('<path d="M7 22V2l10 10"/>'),
      Milestone: createIcon('<path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"/><path d="M12 13v9"/><path d="M12 2v4"/>'),
      Signpost: createIcon('<path d="M12 3v3"/><path d="M18.5 13h-13L2 9.5 5.5 6h13L22 9.5Z"/><path d="M12 13v8"/>'),
      Construction: createIcon('<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>'),
      Baby: createIcon('<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>'),
      PersonStanding: createIcon('<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>'),
      Accessibility: createIcon('<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-5.87.94"/><path d="m5 8 3-3 5.5 3-2.21 3.1"/><path d="M4.24 14.48a5 5 0 0 0 6.88 6.88"/><path d="M13.76 17.52a5 5 0 0 0-6.88-6.88"/>'),
      Glasses: createIcon('<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>'),
      Footprints: createIcon('<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>'),
      Bone: createIcon('<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/>'),
      Skull: createIcon('<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>'),
      Ghost: createIcon('<path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>'),
      Flame2: createIcon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
      PartyPopper: createIcon('<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>'),
      Confetti: createIcon('<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>'),
      Candy: createIcon('<path d="m9.5 7.5-2 2a4.95 4.95 0 1 0 7 7l2-2a4.95 4.95 0 1 0-7-7Z"/><path d="M14 6.5v10"/><path d="M10 7.5v10"/><path d="m16 7 1-5 1.37.68A3 3 0 0 0 19.7 3H21v1.3c0 .46.1.92.32 1.33L22 7l-5 1"/><path d="m8 17-1 5-1.37-.68A3 3 0 0 0 4.3 21H3v-1.3a3 3 0 0 0-.32-1.33L2 17l5-1"/>'),
      Dice1: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M12 12h.01"/>'),
      Dice2: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M15 9h.01"/><path d="M9 15h.01"/>'),
      Dice3: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/>'),
      Dice4: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/>'),
      Dice5: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>'),
      Dice6: createIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M16 12h.01"/><path d="M16 16h.01"/><path d="M8 8h.01"/><path d="M8 12h.01"/><path d="M8 16h.01"/>'),
      Gamepad: createIcon('<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>'),
      Puzzle: createIcon('<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>'),
      Timer: createIcon('<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="12" y2="8"/><circle cx="12" cy="14" r="8"/>'),
      TimerReset: createIcon('<path d="M10 2h4"/><path d="M12 14v-4"/><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6"/><path d="M9 17H4v5"/>'),
      Hourglass: createIcon('<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'),
      AlarmClock: createIcon('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>'),
      Watch2: createIcon('<circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13 13"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>'),
      Eye2: createIcon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
      EyeOff: createIcon('<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'),
      LockOpen: createIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
      Unlock: createIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
      ShieldCheck: createIcon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
      ShieldX: createIcon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m14.5 9-5 5"/><path d="m9.5 9 5 5"/>'),
      ShieldAlert: createIcon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
      ShieldOff: createIcon('<path d="M19.7 14a6.9 6.9 0 0 0 .3-2V5l-8-3-3.2 1.2"/><path d="m2 2 20 20"/><path d="M4.7 4.7 4 5v7c0 6 8 10 8 10a20.3 20.3 0 0 0 5.62-4.38"/>'),
      Verified: createIcon('<path d="M12 2 9.87 4.13l-3.21.15-.15 3.21L4.13 9.87 6.26 12l-2.13 2.13 2.38 2.38-.15 3.21 3.21.15 2.38 2.38 2.13-2.13 2.13 2.13 2.38-2.38 3.21-.15-.15-3.21 2.38-2.38L19.74 12l2.13-2.13-2.38-2.38.15-3.21-3.21-.15L14.05 1.75 12 4 9.87 1.87 7.49 4.25l-3.21-.15.15 3.21L2.05 9.69 4.18 12l-2.13 2.13L2 14.18"/><path d="m9 12 2 2 4-4"/>'),
      Award2: createIcon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
      BadgeCheck: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>'),
      BadgeX: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
      BadgePlus: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'),
      BadgeMinus: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="8" y1="12" x2="16" y2="12"/>'),
      BadgeInfo: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
      BadgeAlert: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
      BadgeHelp: createIcon('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
      HelpCircle: createIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
      CircleHelp: createIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
      MessageSquare: createIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      MessagesSquare: createIcon('<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>'),
      Reply: createIcon('<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>'),
      ReplyAll: createIcon('<polyline points="7 17 2 12 7 7"/><polyline points="12 17 7 12 12 7"/><path d="M22 18v-2a4 4 0 0 0-4-4H7"/>'),
      Forward: createIcon('<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>'),
      MailOpen: createIcon('<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>'),
      Inbox2: createIcon('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
      Send2: createIcon('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
      Contact: createIcon('<path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"/><rect x="3" y="4" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="2"/><line x1="8" y1="2" x2="8" y2="4"/><line x1="16" y1="2" x2="16" y2="4"/>'),
      UserPlus: createIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>'),
      UserMinus: createIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>'),
      UserX: createIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/>'),
      UserCheck: createIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>'),
      UserCog: createIcon('<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m21.7 16.4-.9-.3"/><path d="m15.2 13.9-.9-.3"/><path d="m16.6 18.7.3-.9"/><path d="m19.1 12.2.3-.9"/><path d="m19.6 18.7-.4-1"/><path d="m16.8 12.3-.4-1"/><path d="m14.3 16.6 1-.4"/><path d="m20.7 13.8 1-.4"/>'),
      Users2: createIcon('<path d="M14 19a6 6 0 0 0-12 0"/><circle cx="8" cy="9" r="4"/><path d="M22 19a6 6 0 0 0-6-6 4 4 0 1 0 0-8"/>'),
      UsersRound: createIcon('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>'),
      UserRound: createIcon('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
      CircleUserRound: createIcon('<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/>'),
      IdCard: createIcon('<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>'),
      Cake2: createIcon('<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>'),
    };
    
    // Make icons available globally
    Object.assign(window, LucideIcons);
    
    // Destructure all icons for use in components
    const iconNames = Object.keys(LucideIcons);
    iconNames.forEach(name => { window[name] = LucideIcons[name]; });

    // LanguageDetector shim for i18next-browser-languagedetector
    const LanguageDetector = {
      type: 'languageDetector',
      detect: () => 'en',
      init: () => {},
      cacheUserLanguage: () => {}
    };
    window.LanguageDetector = LanguageDetector;

    // initReactI18next shim for react-i18next
    const initReactI18next = {
      type: '3rdParty',
      init: () => {}
    };
    window.initReactI18next = initReactI18next;

    // i18n / react-i18next shim - provides useTranslation hook for published sites
    const i18n = { 
      language: 'en', 
      changeLanguage: (lng) => { i18n.language = lng; return Promise.resolve(); },
      t: (key) => key,
      use: function(plugin) { return this; },
      init: function(options) { return Promise.resolve(); }
    };
    const useTranslation = () => ({
      t: (key, defaultValue) => defaultValue || key,
      i18n: i18n,
      ready: true
    });
    window.i18n = i18n;
    window.useTranslation = useTranslation;

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
  const handleRuntimeCrash = useCallback((errorMsg: string) => {
    // 🔒 Skip if any agent is currently running (prevents auto-fix during revert)
    if (activeAgentRef.current) {
      console.log(`[Auto-Fix] ⏸️ Skipping - agent "${activeAgentRef.current}" is running`);
      return;
    }
    
    // 🔒 Skip if in cooldown period (after revert)
    if (Date.now() < autoFixCooldownRef.current) {
      console.log(`[Auto-Fix] ⏸️ Skipping - in cooldown period (${Math.ceil((autoFixCooldownRef.current - Date.now()) / 1000)}s remaining)`);
      return;
    }
    
    // Skip if already processing or same error
    if (autoFixTriggeredRef.current || crashReport === errorMsg) return;
    
    // Normalize error for tracking (remove line numbers, timestamps, etc.)
    const errorKey = errorMsg.replace(/:\d+:\d+/g, '').replace(/line \d+/gi, '').trim().substring(0, 200);
    
    // Check if we've already tried to fix this error too many times
    // Attempts 1-3: Gemini, Attempt 4: The Fixer (Claude), Attempt 5+: Show recovery UI
    const attempts = autoFixAttemptsRef.current.get(errorKey) || 0;
    if (attempts > FIXER_ATTEMPT) {
      console.log('[Auto-Fix] All attempts exhausted (including The Fixer), showing recovery UI');
      setAutoFixExhausted(true);
      setCrashReport(errorMsg);
      return;
    }
    
    // If currently generating, queue the error to be processed after generation completes
    if (isGenerating) {
      // Store error and check again after a delay
      setTimeout(() => {
        if (!autoFixTriggeredRef.current && !isGenerating) {
          const currentAttempts = autoFixAttemptsRef.current.get(errorKey) || 0;
          if (currentAttempts > FIXER_ATTEMPT) return; // Double-check attempts
          
          autoFixAttemptsRef.current.set(errorKey, currentAttempts + 1);
          setCrashReport(errorMsg);
          setAutoFixCountdown(3);
          let count = 3;
          autoFixTimerRef.current = setInterval(() => {
            count--;
            if (count <= 0) {
              clearInterval(autoFixTimerRef.current!);
              autoFixTimerRef.current = null;
              setAutoFixCountdown(null);
              triggerAutoFix(errorMsg);
            } else {
              setAutoFixCountdown(count);
            }
          }, 1000);
        }
      }, 2000); // Wait 2 seconds after generation might complete
      return;
    }
    
    // Track this fix attempt
    autoFixAttemptsRef.current.set(errorKey, attempts + 1);
    
    setCrashReport(errorMsg);
    
    // Start auto-fix countdown (3 seconds)
    setAutoFixCountdown(3);
    
    // Clear any existing timer
    if (autoFixTimerRef.current) {
      clearInterval(autoFixTimerRef.current);
    }
    
    // Countdown timer
    let count = 3;
    autoFixTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(autoFixTimerRef.current!);
        autoFixTimerRef.current = null;
        setAutoFixCountdown(null);
        // Auto-trigger fix
        triggerAutoFix(errorMsg);
      } else {
        setAutoFixCountdown(count);
      }
    }, 1000);
  }, [crashReport, isGenerating]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) {
        clearInterval(autoFixTimerRef.current);
      }
    };
  }, []);

  // Self-healing: Auto-fix the crash (can be triggered automatically or manually)
  const triggerAutoFix = useCallback(async (errorToFix?: string) => {
    const error = errorToFix || crashReport;
    if (!error) return;
    
    // 🔓 Force release any existing lock if we're in a critical auto-fix state
    forceReleaseAllLocks();
    
    // 🔒 AGENT LOCK: Try to acquire lock for auto-fix
    const agentType = 'auto-fix';
    if (!acquireAgentLock(agentType)) {
      console.log('[Auto-Fix] ❌ Cannot start - another agent is running');
      return; // Another agent is running, don't start auto-fix
    }
    
    // Normalize error for tracking
    const errorKey = error.replace(/:\d+:\d+/g, '').replace(/line \d+/gi, '').trim().substring(0, 200);
    const attemptNumber = (autoFixAttemptsRef.current.get(errorKey) || 0) + 1;
    autoFixAttemptsRef.current.set(errorKey, attemptNumber);
    
    console.log(`[Auto-Fix] Attempt #${attemptNumber} for error: ${errorKey.substring(0, 50)}...`);
    
    // Check if all attempts exhausted (including The Fixer)
    if (attemptNumber > FIXER_ATTEMPT) {
      console.log('[Auto-Fix] All attempts exhausted, showing recovery UI');
      setAutoFixExhausted(true);
      setCrashReport(error);
      autoFixTriggeredRef.current = false;
      releaseAgentLock(agentType); // 🔒 Release lock
      return;
    }

    // Mark as triggered to prevent loops
    autoFixTriggeredRef.current = true;
    
    // Clear countdown
    if (autoFixTimerRef.current) {
      clearInterval(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    setAutoFixCountdown(null);
    
    // ========================================================================
    // ATTEMPT 4: THE FIXER (Claude Opus 4) - Final attempt before recovery UI
    // ========================================================================
    if (attemptNumber === FIXER_ATTEMPT) {
      // 🔒 Switch lock to fixer
      releaseAgentLock(agentType);
      if (!acquireAgentLock('fixer')) {
        console.log('[Auto-Fix] ❌ Cannot start Fixer - another agent is running');
        return;
      }
      
      console.log('[Auto-Fix] 🔧 Calling THE FIXER (Claude Opus 4) - Final attempt');
      setFixerInProgress(true);
      setCrashReport(null);
      
      // Add a message to chat showing The Fixer is working
      setChatMessages(prev => [...prev, {
        id: `fixer-${Date.now()}`,
        role: 'assistant',
        content: isRTL 
          ? '🔧 **المُصلح (Claude Opus 4)** يعمل على إصلاح الخطأ...\n\nالمحاولات السابقة فشلت. هذه المحاولة الأخيرة قبل عرض خيارات الاستعادة.'
          : '🔧 **THE FIXER (Claude Opus 4)** is working on the error...\n\nPrevious attempts failed. This is the final attempt before showing recovery options.'
      }]);
      
      try {
        // Get recent chat history for context
        const recentHistory = chatMessages.slice(-5).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n');
        
        // Call the backend with fixerMode
        const response = await supabase.functions.invoke('projects-generate', {
          body: {
            mode: 'agent',
            projectId: id,
            prompt: `Fix this error: ${error}`,
            currentFiles: generatedFiles,
            fixerMode: true,
            fixerContext: {
              errorMessage: error,
              previousAttempts: attemptNumber - 1,
              recentEdits: [...(editedFilesTracking || [])].map(f => f.fileName),
              chatHistory: recentHistory
            }
          }
        });
        
        setFixerInProgress(false);
        
        if (response.data?.ok) {
          // Fixer succeeded!
          console.log('[Auto-Fix] 🔧 THE FIXER succeeded!', response.data.result?.summary);
          
          setChatMessages(prev => [...prev, {
            id: `fixer-success-${Date.now()}`,
            role: 'assistant',
            content: isRTL
              ? `✅ **المُصلح نجح!**\n\n${response.data.result?.summary || 'تم إصلاح الخطأ.'}`
              : `✅ **THE FIXER succeeded!**\n\n${response.data.result?.summary || 'Error fixed.'}`
          }]);
          
          // Refresh files to show the fix
          if (response.data.result?.filesChanged?.length > 0) {
            toast.success(isRTL ? 'تم إصلاح الخطأ بواسطة المُصلح!' : 'Error fixed by The Fixer!');
            // Trigger a refresh of the preview
            window.location.reload();
          }
        } else if (response.data?.fixerFailed) {
          // Fixer also failed - show recovery UI
          console.log('[Auto-Fix] 🔧 THE FIXER failed, showing recovery UI');
          setAutoFixExhausted(true);
          setCrashReport(error);
          
          setChatMessages(prev => [...prev, {
            id: `fixer-failed-${Date.now()}`,
            role: 'assistant',
            content: isRTL
              ? '❌ **المُصلح لم يتمكن من إصلاح الخطأ.**\n\nجميع المحاولات التلقائية فشلت. يرجى استخدام خيارات الاستعادة أدناه.'
              : '❌ **THE FIXER was unable to fix the error.**\n\nAll automatic attempts failed. Please use the recovery options below.'
          }]);
        } else {
          // API error
          console.error('[Auto-Fix] Fixer API error:', response.error);
          setAutoFixExhausted(true);
          setCrashReport(error);
        }
      } catch (err) {
        console.error('[Auto-Fix] Fixer exception:', err);
        setFixerInProgress(false);
        setAutoFixExhausted(true);
        setCrashReport(error);
      }
      
      autoFixTriggeredRef.current = false;
      releaseAgentLock('fixer'); // 🔒 Release fixer lock
      return;
    }
    
    // ========================================================================
    // ATTEMPTS 1-3: Gemini auto-fix (existing logic)
    // ========================================================================
    const isRetry = attemptNumber > 1;
    
    // 🔍 Use error classification system for smarter fix prompts
    const errorClassification = classifyError(error);
    console.log(`[Auto-Fix] Error classified as: ${errorClassification.type}`, errorClassification);
    
    // Generate fix instructions based on error type
    let fixInstructions = '';
    
    switch (errorClassification.type) {
      case 'missing-package':
        const packages = errorClassification.packages?.join(', ') || 'the module';
        fixInstructions = `
**ERROR TYPE: Missing Module/Package** 🔴
**Hint:** ${errorClassification.hint}

The import "${packages}" failed - file doesn't exist or path is wrong.

**FIX STEPS:**
1. Use list_files to see what files exist
2. Use read_file to check the import statement
3. Either CREATE the missing file or FIX the import path
4. Make sure the component is exported correctly (export default)`;
        break;
        
      case 'jsx-error':
        fixInstructions = `
**ERROR TYPE: JSX Syntax Error** 🔴
**Hint:** ${errorClassification.hint}

JSX tags are not properly matched or closed.

**FIX STEPS:**
1. Use read_file to see the file with the error
2. Find the unclosed or mismatched JSX tag
3. Make sure every <Tag> has a matching </Tag> or is self-closing <Tag />
4. Wrap multiple adjacent elements in a fragment: <> ... </>`;
        break;
        
      case 'syntax-error':
        fixInstructions = `
**ERROR TYPE: Syntax Error** 🔴
**Hint:** ${errorClassification.hint}

There's invalid JavaScript/JSX syntax.

**FIX STEPS:**
1. Use read_file to see the file with the error
2. Look for missing closing brackets }, braces ], or parentheses )
3. Check for missing commas in objects/arrays
4. Check for missing semicolons or extra characters`;
        break;
        
      case 'undefined-error':
        fixInstructions = `
**ERROR TYPE: Undefined Property/Variable** 🔴
**Hint:** ${errorClassification.hint}

Code is trying to access a property on undefined/null.

**FIX STEPS:**
1. Use read_file to see the code around the error
2. Add optional chaining: obj?.property instead of obj.property
3. Add null checks: if (obj) { ... }
4. Make sure data is initialized before use`;
        break;
        
      case 'type-error':
        fixInstructions = `
**ERROR TYPE: Type Error** 🔴
**Hint:** ${errorClassification.hint}

Wrong data type or calling non-function as function.

**FIX STEPS:**
1. Use read_file to see the code
2. Check if you're calling a function that doesn't exist
3. Verify the data structure matches what you expect
4. Add type checks if needed`;
        break;
        
      case 'not-rendered':
        fixInstructions = `
**ERROR TYPE: App Not Rendering** 🔴
**Hint:** ${errorClassification.hint}

The app failed to render - likely an export or import issue.

**FIX STEPS:**
1. Use read_file on /App.js to check the export
2. Make sure it has: export default App;
3. Check all imports are valid
4. Verify the component returns valid JSX`;
        break;
        
      case 'react-router-error':
        fixInstructions = `
**ERROR TYPE: React Router Context Missing** 🔴🔴🔴
**Hint:** ${errorClassification.hint}

The app uses react-router-dom components (Link, useNavigate, Route, etc.) but the App is NOT wrapped in <BrowserRouter>.

**THIS IS A CRITICAL ERROR - FIX IMMEDIATELY:**

1. Use read_file on /index.js (or /src/index.js)
2. Add this import at the top: import { BrowserRouter } from "react-router-dom";
3. Wrap <App /> like this:
   
   root.render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );

**DO NOT** try to remove Link/Route from App.js - that breaks navigation!
**DO** wrap the entire app in BrowserRouter in index.js.`;
        break;
        
      default:
        fixInstructions = `
**ERROR TYPE: Runtime Error** 🔴
**Hint:** ${errorClassification.hint || 'Read the file and fix the issue'}

**FIX STEPS:**
1. Use read_file to see the file causing the error
2. Find the exact line causing the issue
3. Fix the root cause, not just the symptom`;
    }
    
    // Add retry-specific instructions
    let retryWarning = '';
    if (isRetry) {
      retryWarning = `
⚠️ **THIS IS ATTEMPT #${attemptNumber} - PREVIOUS FIX FAILED**

The previous fix did NOT work. You MUST:
1. READ the file(s) again to see current state
2. UNDERSTAND why the previous fix failed
3. Try a DIFFERENT approach this time
4. State your new plan before making changes

DO NOT repeat the same fix that already failed.
`;
    }
    
    const fixPrompt = `🔧 **AUTO-FIX: Fix this error NOW** (Attempt ${attemptNumber}/${MAX_GEMINI_ATTEMPTS})
${retryWarning}
\`\`\`
${error}
\`\`\`
${fixInstructions}

**MANDATORY WORKFLOW:**
1. First, use read_file to see the current code
2. State your fix plan
3. Make the fix using search_replace
4. Call task_complete when done

**ACTION REQUIRED:** Edit the file(s) to fix this error. Do NOT just explain - actually make the code changes.`;
    
    // Clear error state
    setCrashReport(null);
    
    // Send fix request
    setChatInput(fixPrompt);
    
    // 🔓 Release lock immediately so the user/system can submit the form
    // The form submission itself will re-acquire the 'user-chat' lock
    releaseAgentLock('auto-fix');

    // Trigger submit
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
      // Reset trigger flag after a delay to allow new errors
      setTimeout(() => {
        autoFixTriggeredRef.current = false;
      }, 5000);
    }, 100);
  }, [crashReport]);

  // Manual auto-fix handler (for button click)
  const handleAutoFix = () => {
    triggerAutoFix();
  };
  
  // Cancel auto-fix countdown
  const cancelAutoFix = () => {
    if (autoFixTimerRef.current) {
      clearInterval(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    setAutoFixCountdown(null);
    setCrashReport(null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Handle PDF files - extract text and add as context
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          // For PDFs, we'll read as data URL and add a special marker
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;

            const svg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                <rect width="200" height="200" fill="#1e293b" rx="8"/>
                <text x="100" y="90" text-anchor="middle" fill="#f8fafc" font-size="14" font-family="system-ui">📄 PDF</text>
                <text x="100" y="120" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="system-ui">${file.name.slice(0, 20)}${file.name.length > 20 ? '...' : ''}</text>
              </svg>
            `.trim();

            // Avoid btoa() (breaks on non‑Latin1 characters). Use UTF‑8-safe SVG data URI.
            const pdfPreview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            
            // Store PDF data with special type marker
            setAttachedImages(prev => [...prev, { 
              file: new File([file], file.name, { type: 'application/pdf' }), 
              preview: pdfPreview,
              pdfDataUrl: dataUrl // Store actual PDF data
            } as any]);
            
            toast.success(isRTL ? `تم إضافة ${file.name}` : `Added ${file.name}`);
          };
          reader.readAsDataURL(file);
        } catch (err) {
          console.error('Error processing PDF:', err);
          toast.error(isRTL ? 'فشل في معالجة PDF' : 'Failed to process PDF');
        }
        continue;
      }
      
      // Handle image files
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
  
  // Helper: Find and replace image URL across ALL generatedFiles (not just App.js)
  const replaceImageInAllFiles = (
    files: Record<string, string>,
    elementInfo: { openingTag?: string; className?: string; tagName?: string } | null,
    newUrl: string
  ): { success: boolean; updatedFiles: Record<string, string>; targetFile: string | null } => {
    if (!elementInfo) return { success: false, updatedFiles: files, targetFile: null };
    
    const className = elementInfo.className?.split(' ')[0] || '';
    const tag = elementInfo.tagName?.toLowerCase() || '';
    
    // Extract old src from opening tag
    let oldSrc = '';
    if (elementInfo.openingTag) {
      const srcMatch = elementInfo.openingTag.match(/src=["']([^"']+)["']/);
      if (srcMatch) oldSrc = srcMatch[1];
    }
    
    // Priority order of files to check
    const fileKeys = Object.keys(files).sort((a, b) => {
      // Prioritize files likely to contain component code
      const priorityPatterns = [/carousel/i, /slider/i, /image/i, /gallery/i, /hero/i, /banner/i];
      const aScore = priorityPatterns.some(p => p.test(a)) ? 0 : 1;
      const bScore = priorityPatterns.some(p => p.test(b)) ? 0 : 1;
      return aScore - bScore;
    });
    
    // Strategy 1: Find file containing the exact oldSrc
    if (oldSrc) {
      for (const filePath of fileKeys) {
        const content = files[filePath];
        if (!content || typeof content !== 'string') continue;
        
        if (content.includes(oldSrc)) {
          const escapedSrc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const srcPattern = new RegExp(`(["'])${escapedSrc}\\1`, 'g');
          const newContent = content.replace(srcPattern, `$1${newUrl}$1`);
          
          if (newContent !== content) {
            console.log(`Image replaced in ${filePath} using oldSrc match`);
            return { 
              success: true, 
              updatedFiles: { ...files, [filePath]: newContent },
              targetFile: filePath
            };
          }
        }
      }
    }
    
    // Strategy 2: Match by className across all files
    if (className) {
      const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [
        new RegExp(`(<img[^>]*?src=)(["'])([^"']+)(\\2)([^>]*?(?:className|class)=["'][^"']*${escapedClass}[^"']*["'])`, 'g'),
        new RegExp(`(<img[^>]*?(?:className|class)=["'][^"']*${escapedClass}[^"']*["'][^>]*?src=)(["'])([^"']+)(\\2)`, 'g')
      ];
      
      for (const filePath of fileKeys) {
        const content = files[filePath];
        if (!content || typeof content !== 'string') continue;
        
        for (const pattern of patterns) {
          let replaced = false;
          const newContent = content.replace(pattern, (match, ...groups) => {
            replaced = true;
            if (groups.length === 5) {
              return `${groups[0]}${groups[1]}${newUrl}${groups[3]}${groups[4]}`;
            } else {
              return `${groups[0]}${groups[1]}${newUrl}${groups[3]}`;
            }
          });
          
          if (replaced) {
            console.log(`Image replaced in ${filePath} using className match`);
            return { 
              success: true, 
              updatedFiles: { ...files, [filePath]: newContent },
              targetFile: filePath
            };
          }
        }
      }
    }
    
    // Strategy 3: Single img tag replacement (last resort)
    if (tag === 'img') {
      for (const filePath of fileKeys) {
        const content = files[filePath];
        if (!content || typeof content !== 'string') continue;
        
        const imgCount = (content.match(/<img\s/g) || []).length;
        if (imgCount === 1) {
          const singleImgPattern = /(<img[^>]*?src=)(["'])([^"']+)(\2)/;
          const newContent = content.replace(singleImgPattern, `$1$2${newUrl}$4`);
          
          if (newContent !== content) {
            console.log(`Image replaced in ${filePath} using single img match`);
            return { 
              success: true, 
              updatedFiles: { ...files, [filePath]: newContent },
              targetFile: filePath
            };
          }
        }
      }
    }
    
    return { success: false, updatedFiles: files, targetFile: null };
  };

  // Helper: Check if URL is already from Supabase storage
  const isSupabaseStorageUrl = (url: string): boolean => {
    // Match Supabase storage URLs (both signed and public)
    return url.includes('supabase.co/storage') || 
           url.includes('/storage/v1/object/') ||
           url.includes('project-uploads');
  };

  // Helper: Import external image to Supabase storage (skips if already stored)
  const importExternalImage = async (sourceUrl: string, filenameHint?: string): Promise<string> => {
    if (!id) return sourceUrl;
    
    // Skip import if already a Supabase storage URL
    if (isSupabaseStorageUrl(sourceUrl)) {
      console.log('Image already in Supabase storage, using directly:', sourceUrl);
      return sourceUrl;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('import-external-image', {
        body: { projectId: id, sourceUrl, filenameHint },
      });
      
      if (error) {
        console.warn('Failed to import image to storage:', error);
        return sourceUrl; // Fallback to original URL
      }
      
      if (data?.url) {
        console.log('Image imported to storage:', data.url);
        return data.url;
      }
      
      if (data?.fallbackUrl) {
        return data.fallbackUrl;
      }
      
      return sourceUrl;
    } catch (err) {
      console.warn('Import error:', err);
      return sourceUrl;
    }
  };

  // Handle stock photo selection
  const handleStockPhotoSelect = async (photo: { url: string; title: string }) => {
    // Check if this is for an element image edit (from Image tab or AI Edit)
    if (pendingElementImageEdit) {
      const { elementInfo } = pendingElementImageEdit;
      
      // Show loading toast
      const loadingToast = toast.loading(isRTL ? 'جاري استيراد الصورة...' : 'Importing image...');
      
      try {
        // Import the image to Supabase storage first (skips if already stored)
        const storedUrl = await importExternalImage(photo.url, photo.title);
        
        // Now replace in code across ALL files
        const { success, updatedFiles, targetFile } = replaceImageInAllFiles(
          generatedFiles,
          elementInfo,
          storedUrl
        );
        
        toast.dismiss(loadingToast);
        
        if (success && targetFile) {
          setGeneratedFiles(updatedFiles);
          // Update codeContent if the target file is the current active file
          if (targetFile === '/App.js' || Object.keys(updatedFiles).length === 1) {
            setCodeContent(updatedFiles[targetFile] || updatedFiles['/App.js'] || '');
          }
          toast.success(isRTL ? 'تم تحديث الصورة!' : 'Image updated!');
        } else {
          // Fallback: Use AI prompt with the stored URL
          const contextInfo = elementInfo?.className 
            ? `the ${elementInfo.tagName} element with class "${elementInfo.className.split(' ')[0]}"`
            : elementInfo?.tagName 
              ? `the ${elementInfo.tagName} element`
              : 'the selected image';
          
          const promptText = isRTL
            ? `قم بتحديث صورة ${contextInfo} إلى هذا الرابط: ${storedUrl}`
            : `Update the image source for ${contextInfo} to this URL: ${storedUrl}`;
          
          setChatInput(promptText);
          toast.info(isRTL ? 'جاري تطبيق التغيير...' : 'Applying change...');
          
          // Auto-submit with slight delay
          requestAnimationFrame(() => {
            const formEl = document.querySelector('form[class*="chat"]') as HTMLFormElement;
            if (formEl) {
              formEl.requestSubmit?.();
            }
          });
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(isRTL ? 'فشل في استيراد الصورة' : 'Failed to import image');
        console.error('Error importing image:', err);
      }
      
      setPendingElementImageEdit(null);
      setSelectedElementInfo(null);
      setShowStockPhotoSelector(false);
      return;
    }
    
    // Default behavior: attach image to chat
    fetch(photo.url)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], photo.title, { type: blob.type || 'image/jpeg' });
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          setAttachedImages(prev => [...prev, { file, preview }]);
        };
        reader.readAsDataURL(file);
      })
      .catch(err => {
        console.error('Error fetching stock photo:', err);
        toast.error(isRTL ? 'فشل في تحميل الصورة' : 'Failed to load image');
      });
  };
  
  // Open stock photo selector - always starts fresh (empty search)
  // Now also saves the current prompt so it can be restored after photo selection
  const openStockPhotoSelector = (initialTab: 'stock' | 'user' = 'stock', multiSelect: boolean = true, promptToSave?: string, options?: { showOnlyUserPhotos?: boolean }) => {
    // Save the prompt if provided (from handleChatSubmit when photo request detected)
    if (promptToSave) {
      setSavedPromptForPhotos(promptToSave);
    }
    setPhotoSearchTerm(''); // Always empty - user types their own search
    setPhotoSelectorInitialTab(initialTab);
    setPhotoSelectorMultiSelect(multiSelect);
    setPhotoSelectorShowOnlyUserPhotos(options?.showOnlyUserPhotos ?? false);
    setShowStockPhotoSelector(true);
  };

  // Handle Image Source Dialog selection
  // Ref to track if we're skipping image dialog (for auto-generate flow)
  const skipImageDialogRef = useRef(false);
  
  const handleImageSourceSelect = async (choice: ImageSourceChoice) => {
    setShowImageSourceDialog(false);
    const prompt = pendingImagePrompt;
    setPendingImagePrompt('');
    
    switch (choice) {
      case 'stock':
        // Open stock photo selector
        openStockPhotoSelector('stock', true, prompt);
        break;
        
      case 'uploads':
        // Open user uploads tab
        openStockPhotoSelector('user', true, prompt, { showOnlyUserPhotos: true });
        break;
        
      case 'generate':
        // Let AI generate images - set flag to skip dialog and re-submit
        skipImageDialogRef.current = true;
        setIsAIGeneratingImages(true);
        setChatInput(prompt);
        
        // Use requestAnimationFrame to ensure state is updated before submit
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const formEl = document.querySelector('form') as HTMLFormElement;
            if (formEl) {
              formEl.requestSubmit?.();
            }
            setTimeout(() => {
              skipImageDialogRef.current = false;
              setIsAIGeneratingImages(false);
            }, 500);
          });
        });
        break;
        
      case 'urls':
        // Ask user to provide URLs - add a helper message
        const urlPromptMsg = isRTL 
          ? `✏️ يرجى لصق روابط الصور:\n\n_طلبك: "${prompt}"_`
          : `✏️ Please paste image URLs:\n\n_Your request: "${prompt}"_`;
        
        setChatMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: urlPromptMsg
        }]);
        
        setSavedPromptForPhotos(prompt);
        break;
    }
  };

  // Upload attached images to storage and return public URLs
  const uploadAttachedImagesToStorage = async (
    images: Array<{ file: File; preview: string; pdfDataUrl?: string }>,
    skipDbInsert = false
  ): Promise<string[]> => {
    if (!id || !user?.id) return images.map(i => i.preview); // Fallback to base64
    
    setIsUploadingAttachedImages(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const img of images) {
        // Skip PDFs for now - keep as base64
        if (img.pdfDataUrl || img.file.type.includes('pdf')) {
          uploadedUrls.push(img.pdfDataUrl || img.preview);
          continue;
        }
        
        try {
          const timestamp = Date.now();
          const safeFilename = img.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storagePath = `${user.id}/${id}/chat-${timestamp}-${safeFilename}`;
          
          // Upload to storage
          const { error: uploadError, data } = await supabase.storage
            .from('project-uploads')
            .upload(storagePath, img.file, { cacheControl: '3600', upsert: false });
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            uploadedUrls.push(img.preview); // Fallback
            continue;
          }
          
          // Get public URL
          const { data: urlData } = supabase.storage.from('project-uploads').getPublicUrl(storagePath);
          const publicUrl = urlData?.publicUrl;
          
          if (publicUrl) {
            // ONLY Save to project_uploads table if NOT a chat attachment (screenshot/context)
            if (!skipDbInsert) {
              await supabase.from('project_uploads').insert({
                project_id: id,
                user_id: user.id,
                bucket_id: 'project-uploads',
                filename: safeFilename,
                storage_path: storagePath,
                file_type: img.file.type,
                size_bytes: img.file.size
              });
            }
            
            uploadedUrls.push(publicUrl);
            console.log(`[Auto-Upload] Uploaded image (${skipDbInsert ? 'context only' : 'saved to media'}):`, publicUrl);
          } else {
            uploadedUrls.push(img.preview); // Fallback
          }
        } catch (err) {
          console.error('Auto-upload error:', err);
          uploadedUrls.push(img.preview); // Fallback
        }
      }
    } finally {
      setIsUploadingAttachedImages(false);
    }
    
    return uploadedUrls;
  };
  
  // Helper: Replace carousel/slider image array directly in code
  const replaceCarouselImagesInFiles = (
    files: Record<string, string>,
    newUrls: string[]
  ): { success: boolean; updatedFiles: Record<string, string> } => {
    // Look for image array patterns in files
    const arrayPatterns = [
      // const images = ["url1", "url2"]
      /(const\s+(?:images?|photos?|slides?|pictures?)\s*=\s*)\[([\s\S]*?)\]/gi,
      // images: ["url1", "url2"]
      /((?:images?|photos?|slides?|pictures?|items?)\s*:\s*)\[([\s\S]*?)\]/gi,
    ];
    
    const fileKeys = Object.keys(files).sort((a, b) => {
      // Prioritize component files likely to contain carousel
      const priorityPatterns = [/carousel/i, /slider/i, /embla/i, /swiper/i, /gallery/i];
      const aScore = priorityPatterns.some(p => p.test(a)) ? 0 : 1;
      const bScore = priorityPatterns.some(p => p.test(b)) ? 0 : 1;
      return aScore - bScore;
    });
    
    for (const filePath of fileKeys) {
      const content = files[filePath];
      if (!content || typeof content !== 'string') continue;
      
      for (const pattern of arrayPatterns) {
        // Reset regex lastIndex
        pattern.lastIndex = 0;
        
        const match = pattern.exec(content);
        if (match && match[2]) {
          // Check if array contains URL-like strings
          const arrayContent = match[2];
          if (arrayContent.includes('http') || arrayContent.includes('/') || arrayContent.includes('.jpg') || arrayContent.includes('.png')) {
            // Build new array string
            const newArrayContent = newUrls.map(url => `\n    "${url}"`).join(',') + '\n  ';
            const newContent = content.replace(match[0], `${match[1]}[${newArrayContent}]`);
            
            if (newContent !== content) {
              console.log(`Carousel images replaced in ${filePath}`);
              return { success: true, updatedFiles: { ...files, [filePath]: newContent } };
            }
          }
        }
      }
    }
    
    return { success: false, updatedFiles: files };
  };

  // Handler for multi-select photos
  const handleStockPhotosSelect = async (photos: { url: string; title: string }[]) => {
    if (photos.length === 0) return;

    // Check if this is for an element image edit (single photo case)
    if (pendingElementImageEdit && photos.length === 1) {
      handleStockPhotoSelect(photos[0]);
      return;
    }

    // Special case: Carousel image replacement flow
    if (isChangingCarouselImages) {
      console.log('[Carousel] handleStockPhotosSelect called with', photos.length, 'photos');
      setIsChangingCarouselImages(false);
      
      const loadingToast = toast.loading(
        language === 'ar' ? 'جاري استيراد الصور...' : 'Importing images...'
      );

      try {
        // Import all images to storage in parallel (skips if already stored)
        const storedUrls = await Promise.all(
          photos.map(p => importExternalImage(p.url, p.title))
        );
        
        // Try direct code replacement first
        const { success, updatedFiles } = replaceCarouselImagesInFiles(generatedFiles, storedUrls);
        
        toast.dismiss(loadingToast);
        
        if (success) {
          setGeneratedFiles(updatedFiles);
          toast.success(
            language === 'ar' 
              ? `تم تحديث ${storedUrls.length} صور في الكاروسيل` 
              : `Updated ${storedUrls.length} carousel images`
          );
        } else {
          // Fallback: Use AI prompt (but with stored URLs and safe wording)
          const promptText = language === 'ar'
            ? `قم بتحديث روابط الصور في الكاروسيل/المعرض إلى هذه الروابط بالضبط:\n${storedUrls.join('\n')}`
            : `Update the carousel/gallery slide sources to exactly these URLs:\n${storedUrls.join('\n')}`;
          
          setChatInput(promptText);
          requestAnimationFrame(() => {
            const formEl = document.querySelector('form[class*="chat"]') as HTMLFormElement;
            if (formEl) formEl.requestSubmit?.();
          });
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(language === 'ar' ? 'فشل في استيراد الصور' : 'Failed to import images');
        console.error('Carousel import error:', err);
      }
      
      return;
    }

    // Default behavior: fetch selected photos and attach them to chat
    const photoCount = photos.length;
    const loadingToast = toast.loading(
      language === 'ar'
        ? `جاري تحميل ${photoCount} ${photoCount === 1 ? 'صورة' : 'صور'}...`
        : `Loading ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}...`
    );

    try {
      // Fetch and attach all photos
      const newAttachments: { file: File; preview: string }[] = [];

      for (const photo of photos) {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const file = new File([blob], photo.title || `photo-${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg'
          });

          // Convert to base64 for preview
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });

          newAttachments.push({ file, preview });
        } catch (err) {
          console.error(`Failed to fetch photo: ${photo.title}`, err);
        }
      }

      if (newAttachments.length > 0) {
        setAttachedImages(prev => [...prev, ...newAttachments]);
        
        // Restore the saved prompt if there was one
        if (savedPromptForPhotos) {
          setChatInput(savedPromptForPhotos);
          setSavedPromptForPhotos(''); // Clear after restoring
        }
        
        toast.dismiss(loadingToast);

        const successCount = newAttachments.length;
        toast.success(
          language === 'ar'
            ? `تم إرفاق ${successCount} ${successCount === 1 ? 'صورة' : 'صور'}`
            : `${successCount} ${successCount === 1 ? 'photo' : 'photos'} attached`
        );
      } else {
        toast.dismiss(loadingToast);
        toast.error(language === 'ar' ? 'فشل في تحميل الصور' : 'Failed to load photos');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تحميل الصور' : 'Error loading photos');
    }
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

  // Ref to store wizard prompt for direct submission
  const wizardPromptRef = useRef<string | null>(null);

  const getBackendAnswer = (
    message: string,
    context: typeof backendContext,
    isRTL: boolean
  ): string | null => {
    if (!context) return null;
    if (!context.enabled) {
      return isRTL
        ? 'لوحة الخلفية غير مفعّلة لهذا المشروع بعد.'
        : 'The backend is not enabled for this project yet.';
    }

    const text = message.toLowerCase();
    const asksCount = /(how many|count|عدد|كم)/i.test(message);

    const listNames = (items: Array<{ name: string }>) =>
      items.length > 0
        ? items.map(item => item.name).slice(0, 6).join(', ')
        : isRTL
          ? 'لا توجد عناصر بعد.'
          : 'No items yet.';

    if (/(products?|منتجات)/i.test(message)) {
      if (asksCount) {
        return isRTL
          ? `لديك ${context.productsCount} منتجًا.`
          : `You have ${context.productsCount} products.`;
      }
      return isRTL
        ? `المنتجات الحالية: ${listNames(context.products)}.`
        : `Current products: ${listNames(context.products)}.`;
    }

    if (/(services?|خدمات)/i.test(message)) {
      if (asksCount) {
        return isRTL
          ? `لديك ${context.servicesCount} خدمة.`
          : `You have ${context.servicesCount} services.`;
      }
      return isRTL
        ? `الخدمات الحالية: ${listNames(context.services)}.`
        : `Current services: ${listNames(context.services)}.`;
    }

    if (/(orders?|طلبات)/i.test(message)) {
      return isRTL
        ? `لديك ${context.ordersCount} طلبًا.`
        : `You have ${context.ordersCount} orders.`;
    }

    if (/(bookings?|حجوزات)/i.test(message)) {
      return isRTL
        ? `لديك ${context.bookingsCount} حجزًا.`
        : `You have ${context.bookingsCount} bookings.`;
    }

    if (/(uploads?|ملفات|مرفوعات)/i.test(message)) {
      return isRTL
        ? `لديك ${context.uploadsCount} ملفًا مرفوعًا.`
        : `You have ${context.uploadsCount} uploads.`;
    }

    if (/(forms?|submissions?|نماذج|إرسالات)/i.test(message)) {
      return isRTL
        ? `لديك ${context.formSubmissionsCount} إرسالًا للنماذج.`
        : `You have ${context.formSubmissionsCount} form submissions.`;
    }

    if (/(users?|عملاء|مستخدمين)/i.test(message)) {
      return isRTL
        ? `لديك ${context.siteUsersCount} مستخدمًا في الموقع.`
        : `You have ${context.siteUsersCount} site users.`;
    }

    if (/(collections?|مجموعات|داتا|بيانات)/i.test(message)) {
      return isRTL
        ? `عدد المجموعات: ${context.collections.length}.`
        : `Collections count: ${context.collections.length}.`;
    }

    if (/(chat rooms?|غرف المحادثة)/i.test(message)) {
      return isRTL
        ? `لديك ${context.chatRoomsCount} غرفة محادثة.`
        : `You have ${context.chatRoomsCount} chat rooms.`;
    }

    if (/(comments?|تعليقات)/i.test(message)) {
      return isRTL
        ? `لديك ${context.commentsCount} تعليقًا.`
        : `You have ${context.commentsCount} comments.`;
    }

    return null;
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there's a wizard prompt to use instead of chatInput
    const wizardPrompt = wizardPromptRef.current;
    wizardPromptRef.current = null; // Clear after reading
    
    const userMessage = wizardPrompt || chatInput.trim();
    if (!userMessage && attachedImages.length === 0 || aiEditing) return;
    
    // 🔒 AGENT LOCK: Try to acquire lock for user chat
    // SPECIAL CASE: Auto-Fix prompts act as a "skeleton key" and always bypass locks
    const isAutoFixPrompt = userMessage.includes('🔧 **AUTO-FIX');
    
    if (!acquireAgentLock('user-chat')) {
      if (isAutoFixPrompt) {
          console.log('[Chat] ⚠️ Auto-Fix prompt detected - FORCE RELEASING LOCK');
          forceReleaseAllLocks();
          // Retry acquisition
          if (!acquireAgentLock('user-chat')) {
             console.error('[Chat] Failed to acquire lock even after force release');
             return;
          }
      } else {
        // STALE LOCK DETECTION: If blocked but NOT processing anything, force-break lock
        // Relaxed check: Only check isGenerating (aiEditing might be stuck true)
        if (!isGenerating) {
            console.log(`[Chat] ⚠️ Detected STALE lock "${activeAgentRef.current}" - FORCE RELEASING`);
            forceReleaseAllLocks();
            if (!acquireAgentLock('user-chat')) {
                toast.error(isRTL ? 'يرجى الانتظار حتى ينتهي العمل الحالي' : 'Please wait for current operation to finish');
                return;
            }
        } else {
            console.log('[Chat] ❌ Cannot start - another agent is running');
            toast.error(isRTL ? 'يرجى الانتظار حتى ينتهي العمل الحالي' : 'Please wait for current operation to finish');
            return;
        }
      }
    }
    
    if (!wizardPrompt) setChatInput('');
    
    const skipFormWizardDetection = skipFormWizardRef.current;
    skipFormWizardRef.current = false;
    const skipUserMessageSave = skipUserMessageSaveRef.current;
    skipUserMessageSaveRef.current = false;
    
    if (!skipFormWizardDetection) {
      // ===== UNIFIED INTENT DETECTION (IntentManager) =====
      // Single source of truth for all intent detection
      const intentResult = analyzeIntent(userMessage);
      console.log('[ProjectDetail] IntentManager result:', {
        category: intentResult.category,
        intent: intentResult.intent,
        action: intentResult.action,
        confidence: intentResult.confidence
      });

      // Handle VIEW intents (show images, products, etc.)
      if (intentResult.category === 'VIEW') {
        // Add user message
        setChatMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage
        }]);

        // Handle modal actions (SmartMediaManager)
        if (requiresModal(intentResult)) {
          const modalType = getModalType(intentResult);
          if (modalType === 'SmartMediaManager') {
            setSmartMediaInitialTab(intentResult.payload.modalProps?.initialTab || 'site');
            setShowSmartMediaManager(true);
          }
        }

        // Handle navigation actions
        if (requiresNavigation(intentResult)) {
          // Navigation would be handled here if needed
          console.log('[ProjectDetail] Navigate to:', intentResult.payload.navigateTo);
        }

        // Add response message
        const response = getResponse(intentResult, isRTL);
        if (response) {
          setChatMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response
          }]);
        }
        return;
      }

      // Handle CUSTOMIZE intents (styling changes) - let AI handle but skip wizards
      if (intentResult.category === 'CUSTOMIZE') {
        console.log('[ProjectDetail] Customize request - passing to AI without wizard');
        // Don't return - let it fall through to AI processing
        // But skip all wizard detection below
      }

      // Handle BUILD intents (show wizards)
      if (intentResult.category === 'BUILD' && requiresWizard(intentResult)) {
        const wizardType = getWizardType(intentResult);
        console.log('[ProjectDetail] Build request - showing wizard:', wizardType);
        
        // Add user message
        setChatMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage
        }]);

        // Show appropriate wizard
        setPendingFormPrompt(userMessage);
        if (wizardType === 'booking') setShowBookingWizard(true);
        else if (wizardType === 'contact') setShowContactWizard(true);
        else if (wizardType === 'product') setShowProductWizard(true);
        else if (wizardType === 'auth') setShowAuthWizard(true);
        else if (wizardType === 'media') setShowMediaWizard(true);

        // Save wizard message to DB
        // Note: booking/contact need "_form_wizard" suffix, others just "_wizard"
        const wizardTypeKey = (wizardType === 'booking' || wizardType === 'contact') 
          ? `${wizardType}_form_wizard` 
          : `${wizardType}_wizard`;
        const wizardContent = JSON.stringify({
          type: wizardTypeKey,
          prompt: userMessage
        });
        const { data: wizardMsg } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: wizardContent } as any)
          .select()
          .single();
        
        if (wizardMsg) {
          setChatMessages(prev => [...prev, wizardMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `${wizardType}-wizard-${Date.now()}`,
            role: 'assistant',
            content: wizardContent
          }]);
        }
        return;
      }

      // Skip old scattered pattern detection if IntentManager already handled it
      // For CUSTOMIZE requests, skip wizard detection and let AI handle
      const skipLegacyWizardDetection = intentResult.category === 'CUSTOMIZE';

      // ===== STEP 1: MULTI-FEATURE REQUEST ANALYSIS =====
      // If not a chat request, analyze it as a build/edit request
      const analysis = analyzeRequest(userMessage);
      
      if (!skipLegacyWizardDetection && analysis.isMultiFeature && analysis.features.length >= 2) {
        // This is a complex multi-feature request - handle it intelligently
        console.log('[ProjectDetail] Multi-feature request detected:', analysis);
        
        // Save the analysis for sequential wizard processing
        setAnalyzedRequest(analysis);
        setPendingFormPrompt(userMessage);
        setWizardConfigs({});
        
        // Save user message to DB
        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();
        
        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }
        
        // Create feature summary message
        const featureSummaryContent = JSON.stringify({
          type: 'feature_summary',
          analysis: analysis,
          summary: createFeatureSummary(analysis)
        });
        
        const { data: summaryMsg, error: summaryErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: featureSummaryContent } as any)
          .select()
          .single();
        
        if (summaryErr) console.error('Error saving feature summary:', summaryErr);
        if (summaryMsg) {
          setChatMessages(prev => [...prev, summaryMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `feature-summary-${Date.now()}`,
            role: 'assistant',
            content: featureSummaryContent
          }]);
        }
        
        setShowFeatureSummary(true);
        return;
      }
      
      // ===== STEP 1: FORM WIZARD DETECTION (ALWAYS FIRST - before any image logic) =====
      // BOOKING FORM DETECTION - Show wizard instead of direct AI call
      // Broader pattern to catch more variations
      const bookingFormPatterns = /\b(add|create|build|make|need|want|show|display).*(booking|appointment|schedule|reservation|calendar)\s*(form|page|system|popup|modal|button)?/i;
      const bookingFormAltPatterns = /\b(booking|appointment|reservation|schedule)\s*(form|page|system|popup|modal)\b/i;
      const isBookingStyleOrEditRequest = /\b(enhance|improve|redesign|refactor|polish|restyle|ui|ux|look|design|layout|colors?|theme|style|better|clean|modern|update|change)\b|\b(تحسين|تعديل|تطوير|تصميم|شكل|واجهة|مظهر|الوان|ألوان|تخطيط)\b/i.test(userMessage);
      const isBookingSetupRequest = (bookingFormPatterns.test(userMessage) || bookingFormAltPatterns.test(userMessage)) && !isBookingStyleOrEditRequest;
      const hasBookingsAlreadySetup = !!backendContext?.hasBookingsSetup;
      
      // Option A: only trigger wizard for setup/create requests (not styling/edit)
      // Option C: never trigger booking wizard if bookings are already configured
      if (!skipLegacyWizardDetection && isBookingSetupRequest && !hasBookingsAlreadySetup) {
        setPendingFormPrompt(userMessage);
        setShowBookingWizard(true);
        
        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();
        
        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }
        
        // Save wizard assistant message to DB so it persists on refresh
        const wizardAssistantContent = JSON.stringify({
          type: 'booking_form_wizard',
          prompt: userMessage
        });
        const { data: wizardAssistantMsg, error: wizardAssistantErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: wizardAssistantContent } as any)
          .select()
          .single();
        
        if (wizardAssistantErr) console.error('Error saving wizard assistant message:', wizardAssistantErr);
        if (wizardAssistantMsg) {
          setChatMessages(prev => [...prev, wizardAssistantMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `booking-wizard-${Date.now()}`,
            role: 'assistant',
            content: wizardAssistantContent
          }]);
        }
        return;
      }
      
      // CONTACT FORM DETECTION - Show wizard instead of direct AI call
      // Broader pattern to catch more variations like "button with contact form", "popup contact", etc.
      const contactFormPatterns = /\b(add|create|build|make|need|want|show|display|popup|pop.?up).*(contact|inquiry|message\s*me|feedback|get.?in.?touch)\s*(form|page|popup|modal|button)?/i;
      const contactFormAltPatterns = /\b(contact|inquiry|message|feedback)\s*(form|page|popup|modal)\b/i;
      const hasContactFormRequest = contactFormPatterns.test(userMessage) || contactFormAltPatterns.test(userMessage);
      
      if (!skipLegacyWizardDetection && hasContactFormRequest) {
        setPendingFormPrompt(userMessage);
        setShowContactWizard(true);
        
        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();
        
        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }
        
        // Save wizard assistant message to DB so it persists on refresh
        const contactWizardContent = JSON.stringify({
          type: 'contact_form_wizard',
          prompt: userMessage
        });
        const { data: contactAssistantMsg, error: contactAssistantErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: contactWizardContent } as any)
          .select()
          .single();
        
        if (contactAssistantErr) console.error('Error saving wizard assistant message:', contactAssistantErr);
        if (contactAssistantMsg) {
          setChatMessages(prev => [...prev, contactAssistantMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `contact-wizard-${Date.now()}`,
            role: 'assistant',
            content: contactWizardContent
          }]);
        }
        return;
      }

      // PRODUCT/SHOP DETECTION - NO LONGER BLOCKS CREATION
      // Wizard moved to Backend tab - AI generates the store, user adds products in Backend → Shop
      // We just detect it to pass context to AI for smarter generation
      const productWizardPatterns = /\b(add|create|build|make|need|want|show|display).*(shop|store|e-?commerce|product\s*(page|grid|list|catalog)|catalog|inventory)\b/i;
      const productWizardAltPatterns = /\b(shop|store|e-?commerce|product\s*catalog)\b/i;
      const isShopRequest = productWizardPatterns.test(userMessage) || productWizardAltPatterns.test(userMessage);
      
      // Flag for AI context - will be used to show "Add products in Backend" CTA after generation
      if (isShopRequest) {
        console.log('[ProductWizard] Shop request detected - AI will generate, user adds products in Backend tab');
      }
      
      // NOTE: ProductWizard is now available in Backend → Shop → Inventory tab
      // User can add products there after their store is generated

      // AUTH WIZARD DETECTION - Show wizard for login/signup requests
      const authWizardPatterns = /\b(add|create|build|make|need|want|show|display).*(login|signup|sign.?up|sign.?in|register|auth|authentication)\s*(page|form|screen)?/i;
      const authWizardAltPatterns = /\b(login|signup|sign.?up|sign.?in|register|authentication)\s*(page|form|screen)\b/i;
      const hasAuthWizardRequest = authWizardPatterns.test(userMessage) || authWizardAltPatterns.test(userMessage);

      if (!skipLegacyWizardDetection && hasAuthWizardRequest) {
        setPendingFormPrompt(userMessage);
        setShowAuthWizard(true);

        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();

        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }

        const authWizardContent = JSON.stringify({
          type: 'auth_wizard',
          prompt: userMessage
        });
        const { data: authAssistantMsg, error: authAssistantErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: authWizardContent } as any)
          .select()
          .single();

        if (authAssistantErr) console.error('Error saving auth wizard message:', authAssistantErr);
        if (authAssistantMsg) {
          setChatMessages(prev => [...prev, authAssistantMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `auth-wizard-${Date.now()}`,
            role: 'assistant',
            content: authWizardContent
          }]);
        }
        return;
      }

      // 🎯 SMART MEDIA DETECTION - Show images, don't try to edit code
      const showGalleryPattern = /\b(show|see|view|what|which|list)\s*(all\s*)?(the\s*)?(images?|photos?|pictures?|gallery)\b/i;
      const galleryAltPattern = /\b(images?|photos?|pictures?|gallery)\s*(on|in|of)\s*(the|this)?\s*(site|page|website)\b/i;
      const stockPhotoPattern = /\b(search|find|browse|get|freepik|stock)\s*(images?|photos?|pictures?)\b/i;
      
      // Intent 3: User wants to upload → Show SmartMediaManager with "upload" tab
      const uploadPatterns = /\b(upload|add\s*my|my\s*own)\s*(images?|photos?|pictures?|files?)/i;
      
      // Intent 4: User wants to BUILD an upload component → Show old MediaWizard
      const buildUploadComponent = /\b(add|create|build|make)\s*(upload|file.?upload|dropzone)\s*(component|section|area|form)\b/i;

      const isGalleryQuery = showGalleryPattern.test(userMessage) || galleryAltPattern.test(userMessage);
      const isStockSearch = stockPhotoPattern.test(userMessage);
      const isUploadRequest = uploadPatterns.test(userMessage);
      const isBuildUploadComponent = buildUploadComponent.test(userMessage);

      // Show SmartMediaManager for gallery/stock/upload requests (NOT the old wizard)
      if (isGalleryQuery || isStockSearch || isUploadRequest) {
        // Determine which tab to open
        let initialTab: 'site' | 'stock' | 'upload' = 'site';
        if (isStockSearch) initialTab = 'stock';
        else if (isUploadRequest) initialTab = 'upload';
        
        setSmartMediaInitialTab(initialTab);
        setShowSmartMediaManager(true);
        
        // Add user message to chat
        setChatMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage
        }]);
        
        // Add friendly response based on intent
        const responseContent = isRTL 
          ? isGalleryQuery
            ? `🖼️ **إليك جميع الصور في موقعك!**\n\nيمكنك:\n• عرض الصور\n• تحميل الصور\n• نسخ روابط الصور`
            : isStockSearch
            ? `🔍 **جاري البحث عن صور مجانية...**\n\nيمكنك:\n• البحث عن صور Freepik\n• معاينة النتائج\n• إدراج الصور في موقعك`
            : `⬆️ **جاهز لرفع الصور!**\n\nيمكنك:\n• رفع الصور من جهازك\n• عرض الصور المرفوعة\n• إدارة الصور المرفوعة`
          : isGalleryQuery
            ? `🖼️ **Here are all images on your site!**\n\nYou can:\n• View all images\n• Download images\n• Copy image URLs`
            : isStockSearch
            ? `🔍 **Searching free stock photos...**\n\nYou can:\n• Search Freepik photos\n• Preview results\n• Insert into your site`
            : `⬆️ **Ready to upload!**\n\nYou can:\n• Upload from your device\n• View uploaded images\n• Manage your uploads`;
        
        setChatMessages(prev => [...prev, {
          id: `assistant-media-${Date.now()}`,
          role: 'assistant',
          content: responseContent
        }]);
        return;
      }

      // Show old MediaWizard ONLY for building upload components
      if (isBuildUploadComponent) {
        setPendingFormPrompt(userMessage);
        setShowMediaWizard(true);

        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();

        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }

        const mediaWizardContent = JSON.stringify({
          type: 'media_wizard',
          prompt: userMessage
        });
        const { data: mediaAssistantMsg, error: mediaAssistantErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: mediaWizardContent } as any)
          .select()
          .single();

        if (mediaAssistantErr) console.error('Error saving media wizard message:', mediaAssistantErr);
        if (mediaAssistantMsg) {
          setChatMessages(prev => [...prev, mediaAssistantMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `media-wizard-${Date.now()}`,
            role: 'assistant',
            content: mediaWizardContent
          }]);
        }
        return;
      }

      // PRODUCT FORM DETECTION - Show add-product card for single product add
      const productFormPatterns = /\b(add|create|new)\s+(product|item)\b/i;
      const productFormAltPatterns = /\b(add|create)\s+(inventory|product)\b/i;
      const hasProductFormRequest = productFormPatterns.test(userMessage) || productFormAltPatterns.test(userMessage);

      if (hasProductFormRequest) {
        setPendingFormPrompt(userMessage);
        setShowProductFormCard(true);

        const { data: wizardUserMsg, error: wizardUserErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'user', content: userMessage } as any)
          .select()
          .single();

        if (wizardUserErr) console.error('Error saving user message:', wizardUserErr);
        if (wizardUserMsg) {
          setChatMessages(prev => [...prev, wizardUserMsg as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage
          }]);
        }

        const productCardContent = JSON.stringify({
          type: 'product_form_card',
          prompt: userMessage
        });
        const { data: productAssistantMsg, error: productAssistantErr } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: productCardContent } as any)
          .select()
          .single();

        if (productAssistantMsg) {
          const typedMsg = productAssistantMsg as unknown as { id: string };
          setChatMessages(prev => [...prev, productAssistantMsg as any]);
          setActiveProductCardId(typedMsg.id);
        } else {
          const fallbackId = `product-card-${Date.now()}`;
          setChatMessages(prev => [...prev, {
            id: fallbackId,
            role: 'assistant',
            content: productCardContent
          }]);
          setActiveProductCardId(fallbackId);
        }
        return;
      }
    }

    const isBackendQuestion = /\b(how many|count|what|which|list|كم|عدد|ما|كم عدد)\b/i.test(userMessage) &&
      /(products?|services?|orders?|bookings?|uploads?|forms?|submissions?|users?|collections?|data|chat rooms?|comments?|منتجات|خدمات|طلبات|حجوزات|مرفوعات|نماذج|إرسالات|مستخدمين|مجموعات|بيانات|تعليقات|غرف المحادثة)/i.test(userMessage);

    if (!attachedImages.length && isBackendQuestion) {
      const freshContext = backendContext || await fetchBackendContext();
      const backendAnswer = getBackendAnswer(userMessage, freshContext, isRTL);
      if (backendAnswer) {
        if (!skipUserMessageSave) {
          const { data: userMsg, error: msgError } = await supabase
            .from('project_chat_messages' as any)
            .insert({ project_id: id, role: 'user', content: userMessage } as any)
            .select()
            .single();

          if (msgError) console.error('Error saving user message:', msgError);
          if (userMsg) {
            setChatMessages(prev => [...prev, userMsg as any]);
          } else {
            setChatMessages(prev => [...prev, {
              id: `user-${Date.now()}`,
              role: 'user',
              content: userMessage
            }]);
          }
        }

        const { data: assistantMsgData, error: assistError } = await supabase
          .from('project_chat_messages' as any)
          .insert({ project_id: id, role: 'assistant', content: backendAnswer } as any)
          .select()
          .single();

        if (assistError) console.error('Error saving assistant message:', assistError);
        if (assistantMsgData) {
          setChatMessages(prev => [...prev, assistantMsgData as any]);
        } else {
          setChatMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: backendAnswer
          }]);
        }
        return;
      }
    }
    
    // ===== STEP 2: IMAGE-RELATED LOGIC (only if no form wizard triggered) =====
    // CRITICAL FIX: If images are already attached, skip ALL photo selector patterns
    // and proceed directly to AI submission - prevents the selector from reopening in a loop
    const hasAttachedImages = attachedImages.length > 0;
    
    // Smart intent detection patterns
    const useAttachedPattern = /\b(use|insert|add|put|place|استخدم|ضع|أضف)\s+(this|these|the|attached|this|those|هذه|هذا|المرفقة?)\s*(image|photo|picture|صور)?/i;
    const askAboutImagesPattern = /^(what|how|why|when|can|does|is|are|ما|كيف|لماذا|متى|هل)\b.*\b(image|photo|picture|صور)/i;
    
    // If images are attached AND user is giving instructions (not asking a question), skip photo picker entirely
    if (hasAttachedImages) {
      const isQuestion = askAboutImagesPattern.test(userMessage);
      const isUsingAttached = useAttachedPattern.test(userMessage) || 
                              userMessage.includes('carousel') || 
                              userMessage.includes('gallery') ||
                              userMessage.includes('slider') ||
                              userMessage.includes('background');
      
      if (!isQuestion || isUsingAttached) {
        // User has images AND wants to use them - proceed directly to AI
        console.log('[Smart Image] User has attached images, skipping photo picker');
        // Don't return - let it fall through to AI submission
      }
    }
    
    // Only check photo patterns if NO images are currently attached
    // AND we're not coming from the "Auto-Generate" selection
    if (!hasAttachedImages && !isAIGeneratingImages && !skipImageDialogRef.current) {
      
      // Patterns that indicate user wants to work with images
      // IMPORTANT: Exclude questions (show me, what, which) and style changes (shadow, effect, color)
      const isQuestionAboutImages = /\b(show|what|which|list|tell|see|display)\s+(me\s+)?(the\s+)?(images?|photos?|pictures?)/i.test(userMessage);
      const isStyleChange = /\b(shadow|effect|animation|color|border|style|size|opacity|blur|gradient|round|filter)/i.test(userMessage);
      
      const imageRelatedPatterns = [
        /\b(add|insert|put|place|use)\s+\d+\s*(images?|photos?|pictures?)/i,
        /\b(add|insert|put|place)\s+(new\s+)?(images?|photos?|pictures?)\s+(to|in|for)/i,
        /\b(change|replace|swap|update)\s+(the\s+)?(images?|photos?|pictures?)\s+(to|with|in)/i,
        /\b(create|make|build)\s+.*(carousel|gallery|slider)\s+with\s+(images?|photos?|pictures?)/i,
        /\b(love|heart|romance|nature|business|food|travel|technology|abstract)\s+(photos?|images?|pictures?)\b/i,
      ];
      
      // Only trigger image picker if it's clearly an image ADD/CHANGE request, not a question or style change
      const needsImageSourceConfirmation = !isQuestionAboutImages && !isStyleChange && 
        imageRelatedPatterns.some(pattern => pattern.test(userMessage));
      
      if (needsImageSourceConfirmation) {
        // Add inline chat message with image source buttons (Lovable style)
        setPendingImagePrompt(userMessage);
        setShowImageSourceDialog(true); // Used to track if buttons are active
        
        // Add user message first
        setChatMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage
        }]);
        
        // Add assistant message with image source type
        setChatMessages(prev => [...prev, {
          id: `image-source-${Date.now()}`,
          role: 'assistant',
          content: JSON.stringify({
            type: 'image_source_picker',
            prompt: userMessage
          })
        }]);
        return;
      }
      
      // Explicit "my photos" request - still skip dialog and go directly to uploads
      const myPhotosOnlyRegex = /\b(use|show|get|open|فتح)\s+(my|uploaded|user|صوري)\s*(photos?|images?|pictures?|صور)?\s*(only)?/i;
      const myPhotosRegex = /\b(my|uploaded|user)\s+(photos?|images?|pictures?)\b/i;
      
      if (myPhotosOnlyRegex.test(userMessage)) {
        openStockPhotoSelector('user', true, userMessage, { showOnlyUserPhotos: true });
        return;
      }
      
      if (myPhotosRegex.test(userMessage)) {
        try {
          const { success, count } = await FreepikService.checkUserUploads(user?.id || '');
          
          if (success && count > 0) {
            openStockPhotoSelector('user', true, userMessage);
            return;
          } else {
            const noPhotosMsg = isRTL 
              ? 'لم يتم العثور على صور مرفوعة. يرجى تحميل الصور أولاً.' 
              : 'No uploaded photos found. Please upload photos first.';
            
            setChatMessages(prev => [...prev, {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: noPhotosMsg
            }]);
            
            await supabase
              .from('project_chat_messages' as any)
              .insert({ 
                project_id: id, 
                role: 'assistant', 
                content: noPhotosMsg
              } as any);
            
            return;
          }
        } catch (err) {
          console.error('Error checking user photos:', err);
        }
      }
    } // End of: if (!hasAttachedImages) - skip photo patterns when images already attached
    
    setAiEditing(true);
    const thinkingStart = Date.now();
    setThinkingStartTime(thinkingStart);
    thinkingStartTimeRef.current = thinkingStart;
    setEditedFilesTracking([]); // Reset edited files
    setToolsUsedCount(0); // Reset tool count for new request
    setLastThinkingDuration(null); // Reset last thinking duration
    setAiError(null); // Clear any previous errors
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
    // Capture images BEFORE clearing them (for AI, not DB - DB has no images column)
    // Capture images and PDFs BEFORE clearing them
    // For PDFs, we send the actual data URL, not the preview SVG
    
    // SMART UPLOAD: Only save to storage if image will actually be USED in the project
    // Don't save for "inspiration only" requests (colors, style reference, etc.)
    const isInspirationOnly = /\b(color|colors|colour|colours|palette|scheme|inspiration|inspired|match|style|reference|للإلهام|الألوان|لون|ألوان)\s*(only|for|from)?/i.test(userMessage) ||
      /\b(use|get|extract)\s+(the\s+)?(colors?|colours?|palette)\s*(from|of|only)?/i.test(userMessage) ||
      /\b(for\s+)?(inspiration|reference)\s*only/i.test(userMessage);
    
    let userImages: string[] = [];
    if (attachedImages.length > 0) {
      if (isInspirationOnly) {
        // DON'T upload to storage - just send base64 to AI for analysis
        // This saves storage space and keeps uploads clean
        console.log('[Smart Upload] Inspiration-only detected, using base64 instead of storage');
        userImages = attachedImages.map((img, idx) => {
          if (img?.pdfDataUrl) {
            return `[PDF:${img.file.name}]${img.pdfDataUrl}`;
          }
          // Return base64 preview (no storage upload)
          return img.preview;
        });
      } else {
        // Auto-upload images to get permanent URLs (for use in the project)
        // 🔒 FIX: Skip DB insert for chat attachments (screenshots/context) so Media tab stays clean
        const uploadedUrls = await uploadAttachedImagesToStorage(attachedImages, true);
        userImages = uploadedUrls.map((url, idx) => {
          const img = attachedImages[idx];
          if (img?.pdfDataUrl) {
            // For PDFs, return the actual PDF data with a prefix marker
            return `[PDF:${img.file.name}]${img.pdfDataUrl}`;
          }
          // Return the permanent URL (or base64 fallback)
          return url;
        });
      }
    }
    
    // Store attachment count in content as metadata marker for persistence
    // Format: [ATTACHMENTS:N] at the start of content (hidden in display)
    if (!skipUserMessageSave) {
      const attachmentMarker = userImages.length > 0 ? `[ATTACHMENTS:${userImages.length}]` : '';
      const contentToStore = attachmentMarker + userMessage;
      
      const { data: userMsg, error: msgError } = await supabase
        .from('project_chat_messages' as any)
        .insert({ 
          project_id: id, 
          role: 'user', 
          content: contentToStore
        } as any)
        .select()
        .single();
      
      if (msgError) console.error('Error saving user message:', msgError);
      
      // Add to local state (with images for display)
      if (userMsg) {
        setChatMessages(prev => [...prev, { ...(userMsg as object), images: userImages } as any]);
      } else {
        // Fallback local state if DB insert fails
        setChatMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: contentToStore,
          images: userImages
        }]);
      }
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
      const beforeSnapshot: Record<string, string> = Object.keys(generatedFiles).length > 0 ? { ...generatedFiles } : {};

      if (leftPanelMode === 'chat') {
        // Chat mode: Smart AI that answers questions OR returns plans for code changes
        // Use userImages captured earlier (before clearing)
        setAttachedImages([]); // Clear after capturing

        // CRITICAL: Always send the LATEST code to the AI (merge generatedFiles with current editor content)
        const latestFiles = { ...generatedFiles };
        if (codeContent) {
          latestFiles['/App.js'] = codeContent;
        }

        const response = await supabase.functions.invoke('projects-generate', {
          body: {
            mode: 'chat',
            projectId: id,
            prompt: userMessage,
            currentFiles: latestFiles,
            images: userImages.length > 0 ? userImages : undefined,
            uploadedAssets: uploadedAssets.length > 0 ? uploadedAssets : undefined,
            backendContext: backendContext || undefined,
            debugContext: debugContext?.getDebugContextForAgent?.(),
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

        // Smart response: either a plan (JSON), asset_picker, or regular message
        if (response.data.mode === 'asset_picker' && response.data.assetPicker) {
          // AI wants user to pick which asset to use - show Asset Picker Card
          assistantMsg = JSON.stringify(response.data.assetPicker);
        } else if (response.data.mode === 'plan' && response.data.plan) {
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

        // Capture images BEFORE clearing (same as chat mode)
        const codeImages = userImages.length > 0 ? userImages : undefined;
        
        // Clear attached images in Code mode too
        if (attachedImages.length > 0) {
          setAttachedImages([]);
        }

        // SAFEGUARD: If user mentions "my photo/image" and has 2+ uploads without specifying filename,
        // show asset picker instead of running edit immediately
        const photoKeywords = /\b(my photo|my image|uploaded image|صورتي|الصورة)\b/i;
        const hasSpecificFile = uploadedAssets.some(a => userMessage.includes(a.filename));
        
        if (uploadedAssets.length >= 2 && photoKeywords.test(userMessage) && !hasSpecificFile) {
          // Build asset picker response manually and skip edit
          assistantMsg = JSON.stringify({
            type: 'asset_picker',
            message: isRTL ? 'أي صورة تريد استخدامها؟' : 'Which image would you like me to use?',
            originalRequest: userMessage,
            assets: uploadedAssets.map(a => ({ filename: a.filename, url: a.url, file_type: a.file_type }))
          });
          
          setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          await delay(250);
          
          // Save assistant message to DB
          const { data: assistantMsgData, error: assistError } = await supabase
            .from('project_chat_messages' as any)
            .insert({ 
              project_id: id, 
              role: 'assistant', 
              content: assistantMsg,
              snapshot: null
            } as any)
            .select()
            .single();
          
          if (assistError) console.error('Error saving assistant message:', assistError);
          if (assistantMsgData) {
            setChatMessages(prev => [...prev, assistantMsgData as any]);
          }
          
          setAiEditing(false);
          setThinkingStartTime(null);
          setGenerationSteps([]);
          return; // Exit early - don't run edit
        }

        // Using AGENT mode for targeted, intelligent edits (not full file rewrites)
        // FIX: Send currentFiles so agent can see the file list (not content, just paths)
        const startRes = await supabase.functions.invoke('projects-generate', {
          body: {
            action: 'start',
            projectId: id,
            mode: 'agent',
            prompt: userMessage,
            userInstructions: userInstructions,
            images: codeImages, // NOW SENDING IMAGES TO AI
            uploadedAssets: uploadedAssets.length > 0 ? uploadedAssets : undefined,
            backendContext: backendContext || undefined,
            debugContext: debugContext?.getDebugContextForAgent?.(),
            currentFiles: generatedFiles, // CRITICAL: Send files so agent knows what exists
          },
        });

        if (startRes.error) {
          throw new Error(startRes.error.message || 'Failed to start agent');
        }

        // AGENT MODE: Returns results directly (no job polling needed!)
        const agentResult = startRes.data;
        
        // 🔧 DEBUG: Log what we received from the edge function
        console.log('[AI Coder] Agent result received:', JSON.stringify({
          ok: agentResult?.ok,
          mode: agentResult?.mode,
          hasResult: !!agentResult?.result,
          resultSuccess: agentResult?.result?.success,
          hasMessage: !!agentResult?.message,
          hasJobId: !!agentResult?.jobId,
          error: agentResult?.error
        }));
        
        // 🔧 FIX: Handle ok: false responses from the edge function
        if (agentResult?.ok === false) {
          throw new Error(agentResult.error || 'Agent request failed');
        }
        
        // 🔧 FIX: Handle result.success: false (agent explored but couldn't complete)
        if (agentResult?.mode === 'agent' && agentResult?.result?.success === false) {
          const errorMsg = agentResult.result.error || agentResult.result.summary || 'Agent could not complete the request';
          throw new Error(errorMsg);
        }

        // 🔒 HARD-BLOCK: If smoke tests fail, auto-fix immediately (no bad output shown)
        if (agentResult?.mode === 'agent' && agentResult?.result?.smokeTestResult && !agentResult.result.smokeTestResult.passed) {
          const criticalErrors = agentResult.result.smokeTestResult.criticalErrors || [];
          const smokeError = criticalErrors.length > 0
            ? `Smoke test failed: ${criticalErrors.join(' | ')}`
            : 'Smoke test failed: Fix required before showing output.';
          toast.error(isRTL ? 'تم اكتشاف خطأ تلقائيًا - جاري الإصلاح' : 'Auto-detected issue - fixing now');
          setCrashReport(smokeError);
          triggerAutoFix(smokeError);
          return;
        }
        
        if (agentResult?.mode === 'agent' && agentResult?.result) {
          // Agent mode completed synchronously - load updated files
          setGenerationSteps(prev => prev.map((s, i) => 
            i === 0 ? { ...s, status: 'completed' } : 
            i === 1 ? { ...s, status: 'completed' } : 
            i === 2 ? { ...s, status: 'loading' } : s
          ));
          await delay(250);

          const newFiles = await loadFilesFromDb(id);
          const newCode = newFiles["/App.js"] || Object.values(newFiles)[0] || "";

          snapshotToSave = beforeSnapshot;
          setGeneratedFiles(newFiles);
          setCodeContent(newCode);
          
          // 🔒 FIX: Force Sandpack to fully re-mount after agent edits to ensure preview updates
          setSandpackKey(prev => prev + 1);

          // Get files changed from agent result
          const changedFilesList: string[] = agentResult.result.filesChanged || [];
          
          // If no files reported, compare with snapshot
          if (changedFilesList.length === 0) {
            for (const [path, content] of Object.entries(newFiles)) {
              const oldContent = beforeSnapshot[path];
              if (!oldContent || oldContent !== content) {
                changedFilesList.push(path);
              }
            }
          }
          
          // Update edited files tracking for Lovable-style UI
          setEditedFilesTracking(changedFilesList.map((filePath, idx) => ({
            id: `file-${idx}-${Date.now()}`,
            fileName: filePath.replace(/^\//, ''),
            status: 'edited' as const
          })));
          
          const summaryText = agentResult.result.summary || (isRTL ? 'تم تطبيق التعديلات!' : 'Changes applied!');
          
          // Store as structured JSON so the UI can parse it properly
          // FIX: Do NOT force /App.js when no files changed - be honest about changes
          const actualChangedFiles = changedFilesList.length > 0 ? changedFilesList : [];
          const hasActualChanges = actualChangedFiles.length > 0;
          
          // Generate a friendly response message based on what was done
          const generateFriendlyResponse = (summary: string, files: string[], userMsg: string) => {
            const msgLower = userMsg.toLowerCase();
            if (files.length === 0) return isRTL ? 'لم أجد ما يمكن تغييره.' : "I couldn't find anything to change.";
            
            // Try to make it conversational based on the action
            if (msgLower.includes('remove') || msgLower.includes('delete') || msgLower.includes('احذف') || msgLower.includes('أزل')) {
              return isRTL ? `تم! أزلت ما طلبته من ${files.join(', ')}.` : `Done! I removed what you asked from ${files.join(', ')}.`;
            }
            if (msgLower.includes('add') || msgLower.includes('أضف')) {
              return isRTL ? `تم! أضفت التغييرات إلى ${files.join(', ')}.` : `Done! I added the changes to ${files.join(', ')}.`;
            }
            if (msgLower.includes('change') || msgLower.includes('update') || msgLower.includes('غيّر') || msgLower.includes('عدّل')) {
              return isRTL ? `تم! عدّلت ${files.join(', ')}.` : `Done! I updated ${files.join(', ')}.`;
            }
            if (msgLower.includes('fix') || msgLower.includes('أصلح')) {
              return isRTL ? `تم الإصلاح في ${files.join(', ')}.` : `Fixed! Changes made to ${files.join(', ')}.`;
            }
            // Default
            return isRTL ? `تم تطبيق التغييرات على ${files.join(', ')}.` : `Changes applied to ${files.join(', ')}.`;
          };
          
          assistantMsg = JSON.stringify({
            type: 'execution_result',
            title: hasActualChanges ? (isRTL ? 'تم التطبيق' : 'Applied') : (isRTL ? 'لم يتم التغيير' : 'No changes made'),
            response: hasActualChanges ? generateFriendlyResponse(summaryText, actualChangedFiles, userMessage) : undefined,
            summary: hasActualChanges ? summaryText : (isRTL ? 'لم يتم إجراء تغييرات على الملفات' : 'No file changes were made. The AI may have misunderstood the request.'),
            files: actualChangedFiles,
            noChanges: !hasActualChanges
          });
          
          // 🎯 Generate dynamic suggestions for code mode too (not just chat mode)
          const generateCodeModeSuggestions = (files: string[], userMsg: string) => {
            const msgLower = userMsg.toLowerCase();
            const suggestions: string[] = [];
            
            if (msgLower.includes('header') || msgLower.includes('nav') || msgLower.includes('رأس')) {
              suggestions.push(isRTL ? 'غيّر لون الهيدر' : 'Change header color');
              suggestions.push(isRTL ? 'أضف رابط جديد' : 'Add a new link');
            } else if (msgLower.includes('button') || msgLower.includes('زر')) {
              suggestions.push(isRTL ? 'غيّر لون الزر' : 'Change button color');
              suggestions.push(isRTL ? 'أضف تأثير hover' : 'Add hover effect');
            } else if (msgLower.includes('image') || msgLower.includes('صورة')) {
              suggestions.push(isRTL ? 'غيّر حجم الصورة' : 'Resize the image');
              suggestions.push(isRTL ? 'أضف صورة أخرى' : 'Add another image');
            } else if (msgLower.includes('color') || msgLower.includes('لون')) {
              suggestions.push(isRTL ? 'غيّر لون آخر' : 'Change another color');
              suggestions.push(isRTL ? 'أضف تدرج' : 'Add a gradient');
            } else if (msgLower.includes('remove') || msgLower.includes('delete') || msgLower.includes('احذف')) {
              suggestions.push(isRTL ? 'أزل شيء آخر' : 'Remove something else');
              suggestions.push(isRTL ? 'تراجع عن التغيير' : 'Undo this change');
            } else {
              // Default suggestions
              suggestions.push(isRTL ? 'أضف ميزة جديدة' : 'Add a new feature');
              suggestions.push(isRTL ? 'حسّن التصميم' : 'Improve the design');
            }
            return suggestions;
          };
          
          if (hasActualChanges) {
            setDynamicSuggestions(generateCodeModeSuggestions(actualChangedFiles, userMessage));
          }
          
          // Update tool usage count for Lovable-style indicator
          setToolsUsedCount(prev => prev + (changedFilesList.length || 1));
          
          setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          await delay(250);
        } else if (agentResult?.message) {
          // 🔧 FIX: Agent returned a chat response (question/info) instead of making edits
          // This happens when user asks a question like "do we have a products page?"
          assistantMsg = agentResult.message;
          setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          await delay(250);
          
          // 🎯 Generate context-aware suggestions based on AI's RESPONSE, not user's message
          const generateChatResponseSuggestions = (aiResponse: string, userMsg: string) => {
            const responseLower = aiResponse.toLowerCase();
            const msgLower = userMsg.toLowerCase();
            const suggestions: string[] = [];
            
            // If AI confirmed something exists, suggest using/editing it
            if (responseLower.includes('yes') || responseLower.includes('you have') || responseLower.includes('located at')) {
              if (responseLower.includes('product') || msgLower.includes('product')) {
                suggestions.push(isRTL ? 'افتح صفحة المنتجات' : 'Open the products page');
                suggestions.push(isRTL ? 'عدّل صفحة المنتجات' : 'Edit the products page');
              } else if (responseLower.includes('page') || responseLower.includes('.js')) {
                suggestions.push(isRTL ? 'افتح هذه الصفحة' : 'Open this page');
                suggestions.push(isRTL ? 'عدّل هذه الصفحة' : 'Edit this page');
              }
            }
            // If AI said something doesn't exist, suggest creating it
            else if (responseLower.includes('no') || responseLower.includes("don't have") || responseLower.includes('not found')) {
              if (msgLower.includes('product')) {
                suggestions.push(isRTL ? 'أنشئ صفحة منتجات' : 'Create a products page');
              } else if (msgLower.includes('page')) {
                suggestions.push(isRTL ? 'أنشئ هذه الصفحة' : 'Create this page');
              }
            }
            
            // Default follow-ups for informational responses
            if (suggestions.length === 0) {
              suggestions.push(isRTL ? 'أخبرني المزيد' : 'Tell me more');
              suggestions.push(isRTL ? 'ساعدني في تعديله' : 'Help me edit it');
            }
            
            return suggestions;
          };
          
          setDynamicSuggestions(generateChatResponseSuggestions(agentResult.message, userMessage));
        } else if (agentResult?.jobId) {
          // Fallback: If there's a jobId, use the old polling method
          const jobId = agentResult.jobId as string;

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
          
          // 🔒 FIX: Force Sandpack to fully re-mount after async agent edits to ensure preview updates
          setSandpackKey(prev => prev + 1);

          const changedFilesList: string[] = [];
          for (const [path, content] of Object.entries(newFiles)) {
            const oldContent = beforeSnapshot[path];
            if (!oldContent || oldContent !== content) {
              changedFilesList.push(path);
            }
          }
          
          // Update edited files tracking for Lovable-style UI
          setEditedFilesTracking(changedFilesList.map((filePath, idx) => ({
            id: `file-${idx}-${Date.now()}`,
            fileName: filePath.replace(/^\//, ''),
            status: 'edited' as const
          })));
          
          const summaryText = job.result_summary || (isRTL ? 'تم تطبيق التعديلات!' : 'Changes applied!');
          
          // FIX: Same as above - be honest about changes
          const actualChangedFilesJob = changedFilesList.length > 0 ? changedFilesList : [];
          const hasActualChangesJob = actualChangedFilesJob.length > 0;
          
          assistantMsg = JSON.stringify({
            type: 'execution_result',
            title: hasActualChangesJob ? (isRTL ? 'تم التطبيق' : 'Applied') : (isRTL ? 'لم يتم التغيير' : 'No changes made'),
            summary: hasActualChangesJob ? summaryText : (isRTL ? 'لم يتم إجراء تغييرات' : 'No changes were applied'),
            files: actualChangedFilesJob,
            noChanges: !hasActualChangesJob
          });
          
          // Update tool usage count for Lovable-style indicator (polling path)
          setToolsUsedCount(prev => prev + (changedFilesList.length || 1));
          
          setGenerationSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          await delay(250);
        } else {
          // No result, no message, no jobId - this is a real error
          throw new Error('Agent mode failed - no result returned');
        }
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
        
        // 🚀 NEW: Check if this is a project creation completion message
        if (msgLower.includes('project is ready') || 
            msgLower.includes('finished building') || 
            msgLower.includes('all files have been created') ||
            msgLower.includes('successfully created') ||
            (msgLower.includes('ready') && msgLower.includes('publish'))) {
          
          console.log('[Contextual Chips] Detected project creation completion');
          
          // Get file paths to detect what was created
          const fileList = Object.keys(generatedFiles || {});
          const fileContent = Object.values(generatedFiles || {}).join(' ').toLowerCase();
          
          // Check for barber shop specific content
          const isBarberShop = fileContent.includes('barber') || 
                             fileContent.includes('haircut') || 
                             fileContent.includes('salon');
                             
          // Check for specific page types
          const hasBookingPage = fileList.some(f => /booking|appointment|schedule/i.test(f)) || 
                              fileContent.includes('book') || 
                              fileContent.includes('appointment');
                              
          const hasContactPage = fileList.some(f => /contact|inquiry/i.test(f)) || 
                             fileContent.includes('contact us') || 
                             fileContent.includes('get in touch');
                             
          const hasProductsPage = fileList.some(f => /product|shop|store/i.test(f)) || 
                              fileContent.includes('product') || 
                              fileContent.includes('shop') ||
                              fileContent.includes('service');
          
          // Build activation chips based on detected content
          const activationChips: string[] = [];
          
          // Barber shop specific suggestions
          if (isBarberShop) {
            if (hasBookingPage) {
              activationChips.push('✨ Configure booking system');
            }
            
            if (hasProductsPage) {
              activationChips.push('💈 Set up barber services');
            }
          } else {
            // Generic suggestions
            if (hasBookingPage) {
              activationChips.push('✨ Configure booking system');
            }
            
            if (hasProductsPage) {
              activationChips.push('🛍️ Set up product inventory');
            }
          }
          
          if (hasContactPage) {
            activationChips.push('📧 Configure contact form');
          }
          
          // Always add these general suggestions
          if (activationChips.length < 3) {
            activationChips.push('How do I customize the styles?');
          }
          
          if (activationChips.length > 0) {
            console.log('[Contextual Chips] Adding activation chips:', activationChips);
            return activationChips;
          }
        }
        
        // 🎯 PRIORITY 1: Check if AI asked a question with options (emoji-prefixed lines)
        // Pattern: Lines starting with emoji like 🔍, 🔗, 📝, ✨, etc. followed by text
        const optionPatterns = [
          /[🔍🔗📝✨🎨💡🔧⚡🚀📦🎯✅❌🔄📋🛠️]\s*([^\n?]+)\??/g,
          /[-•]\s*([^\n?]+)\??/g, // Bullet points
        ];
        
        const extractedOptions: string[] = [];
        for (const pattern of optionPatterns) {
          const matches = msg.matchAll(pattern);
          for (const match of matches) {
            const option = match[1].trim();
            // Clean up the option text - remove trailing punctuation and "?" 
            const cleanOption = option.replace(/[?？]$/, '').trim();
            if (cleanOption.length > 3 && cleanOption.length < 60 && !extractedOptions.includes(cleanOption)) {
              extractedOptions.push(cleanOption);
            }
          }
        }
        
        // If we found question options, use them as chips (max 3)
        if (extractedOptions.length >= 2) {
          console.log('[Contextual Chips] Found AI question options:', extractedOptions);
          return extractedOptions.slice(0, 3);
        }
        
        // 🎯 PRIORITY 2: Check for "Would you like me to..." patterns
        const wouldYouLikeMatch = msg.match(/would you like (?:me to |to )?(.+?)\?/i);
        if (wouldYouLikeMatch) {
          const action = wouldYouLikeMatch[1].trim();
          return [
            `Yes, ${action}`,
            isRTL ? 'لا، شكراً' : 'No, thanks'
          ];
        }
        
        // 🎯 PRIORITY 3: Parse the AI response to find what was changed and suggest relevant follow-ups
        
        // Products/Shop page mentioned
        if (msgLower.includes('product') || msgLower.includes('shop') || msgLower.includes('منتج')) {
          return [
            isRTL ? 'أضف المنتجات للهيدر' : 'Add products link to header',
            isRTL ? 'اعرض صفحة المنتجات' : 'Show me the products page'
          ];
        }
        // Page/file mentioned
        if (msgLower.includes('page') || msgLower.includes('.js') || msgLower.includes('.jsx') || msgLower.includes('صفحة')) {
          return [
            isRTL ? 'أضف رابط للصفحة' : 'Add link to this page',
            isRTL ? 'افتح الصفحة' : 'Open this page'
          ];
        }
        // Navigation/routing mentioned
        if (msgLower.includes('route') || msgLower.includes('navigation') || msgLower.includes('link') || msgLower.includes('رابط')) {
          return [
            isRTL ? 'أضف رابط جديد' : 'Add a new link',
            isRTL ? 'أصلح الروابط' : 'Fix the links'
          ];
        }
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
      const errorMessage = err.message || (isRTL ? 'حدث خطأ' : 'An error occurred');
      
      // Set error explanation card
      setAiError({
        title: 'AI Request Failed',
        titleAr: 'فشل طلب الذكاء الاصطناعي',
        message: 'The AI couldn\'t complete your request. This may be due to a temporary service issue or a complex request.',
        messageAr: 'تعذر على الذكاء الاصطناعي إكمال طلبك. قد يكون ذلك بسبب مشكلة مؤقتة في الخدمة أو طلب معقد.',
        severity: 'error',
        technicalDetails: errorMessage,
        suggestedAction: 'Try rephrasing your request or wait a moment and try again.',
        suggestedActionAr: 'حاول إعادة صياغة طلبك أو انتظر لحظة وحاول مرة أخرى.',
      });
      
      const errorMsg = isRTL ? 'عذرًا، حدث خطأ. حاول مرة أخرى.' : 'Sorry, an error occurred. Please try again.';
      setChatMessages(prev => [...prev, { 
        id: `error-${Date.now()}`,
        role: 'assistant', 
        content: errorMsg 
      }]);
      toast.error(errorMessage);
    } finally {
      // Save final thinking duration before clearing (use ref to avoid stale state)
      const start = thinkingStartTimeRef.current;
      if (start) {
        setLastThinkingDuration(Math.floor((Date.now() - start) / 1000));
      }
      thinkingStartTimeRef.current = null;
      setAiEditing(false);
      setThinkingStartTime(null);
      releaseAgentLock('user-chat'); // 🔒 Release lock when chat completes
      releaseAgentLock('auto-fix'); // 🔒 Also release auto-fix lock (in case this was triggered by auto-fix)
    }
  };

  // Enhanced device preview with specific device dimensions
  const DEVICE_PRESETS = {
    desktop: { width: '100%', height: '100%', name: 'Desktop', nameAr: 'سطح المكتب' },
    tablet: { width: '768px', height: '1024px', name: 'iPad', nameAr: 'آيباد' },
    mobile: { width: '375px', height: '812px', name: 'iPhone', nameAr: 'آيفون' },
    // Additional presets for more specific testing
    iphoneSE: { width: '375px', height: '667px', name: 'iPhone SE', nameAr: 'آيفون SE' },
    iphone14: { width: '390px', height: '844px', name: 'iPhone 14', nameAr: 'آيفون 14' },
    iphone14Pro: { width: '393px', height: '852px', name: 'iPhone 14 Pro', nameAr: 'آيفون 14 برو' },
    pixel7: { width: '412px', height: '915px', name: 'Pixel 7', nameAr: 'بيكسل 7' },
    galaxyS23: { width: '360px', height: '780px', name: 'Galaxy S23', nameAr: 'جالاكسي S23' },
    ipadMini: { width: '744px', height: '1133px', name: 'iPad Mini', nameAr: 'آيباد ميني' },
    ipadPro: { width: '1024px', height: '1366px', name: 'iPad Pro', nameAr: 'آيباد برو' },
  };

  const getDeviceWidth = () => {
    const preset = DEVICE_PRESETS[deviceView as keyof typeof DEVICE_PRESETS];
    return preset?.width || '100%';
  };

  const getDeviceHeight = () => {
    const preset = DEVICE_PRESETS[deviceView as keyof typeof DEVICE_PRESETS];
    return preset?.height || '100%';
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
    <div 
      className={cn("h-full w-full flex flex-col bg-background overflow-hidden", isRTL && "rtl")}
      style={{ height: 'calc(100vh - 84px)', maxHeight: 'calc(100vh - 84px)' }}
    >

      {/* Celebratory Modal for Project Completion */}
      {showProjectCompleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 shadow-2xl shadow-indigo-500/30 animate-in zoom-in-95 duration-500 max-w-sm mx-4 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isRTL ? '🎉 مشروعك جاهز!' : '🎉 Project Ready!'}
            </h2>
            <p className="text-white/80 text-sm">
              {isRTL ? 'يمكنك الآن تعديله أو نشره' : 'You can now edit or publish it'}
            </p>
          </div>
        </div>
      )}

      {/* Server Tab Content */}
      {mainTab === 'server' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <BackendDashboard
            projectId={id || ''}
            isRTL={isRTL}
            initialTab={backendInitialTab}
            initialShopInnerTab={backendInitialShopTab}
            refreshKey={backendRefreshKey}
            onBack={() => { setMainTab('builder'); fetchBackendContext(); }}
          />
        </div>
      ) : (
      <>
      {/* Builder Tab Content - Mobile Chat/Preview Toggle */}
      <div className="md:hidden px-4 py-2 bg-background/95 dark:bg-[#0c0f14]/95 backdrop-blur-sm border-b border-border/40 shrink-0 z-20">
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
      <div className="flex-1 min-h-0 flex overflow-hidden relative h-full">
        {/* Left Panel - Cascade-style Control Center */}
        <div className={cn(
          "flex flex-col border-r transition-all duration-300 relative",
          "bg-background dark:bg-[#0c0f14]",
          "shrink-0",
          mobileTab === 'preview' ? "hidden md:flex" : "flex w-full",
          "h-full max-h-full overflow-hidden"
        )}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${leftPanelWidth}px` : undefined,
        }}
        >
          {/* Mode Toggle: Chat / Code / Server - FIXED at top */}
          <div className="flex items-center justify-between border-b border-border/50 dark:border-white/10 px-3 py-0 h-[56px] shrink-0 absolute top-0 left-0 right-0 z-[100] bg-background dark:bg-[#0c0f14]">
            <div className="flex items-center gap-2">
              {/* Back Button */}
              <button
                onClick={() => navigate('/projects')}
                className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 via-blue-400/20 to-blue-300/20 border border-blue-500/30 hover:border-blue-500/50 hover:from-blue-500/30 hover:via-blue-400/30 hover:to-blue-300/30 transition-all active:scale-95 group"
                title={isRTL ? 'رجوع' : 'Back'}
              >
                <ArrowLeft className="h-4 w-4 text-blue-500 group-hover:text-blue-400 transition-colors" />
              </button>
              
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
                  onClick={() => { setMainTab('builder'); setLeftPanelMode('chat'); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    mainTab === 'builder' && leftPanelMode === 'chat' 
                      ? "bg-emerald-500 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? 'وضع المحادثة' : 'Chat mode'}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {isRTL ? 'محادثة' : 'Chat'}
                </button>
                <button
                  onClick={() => { setMainTab('builder'); setLeftPanelMode('code'); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    mainTab === 'builder' && leftPanelMode === 'code' 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isRTL ? 'وضع الكود' : 'Code mode'}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {isRTL ? 'كود' : 'Code'}
                </button>
                <button
                  onClick={() => setMainTab('server')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-muted-foreground hover:text-foreground"
                  title={isRTL ? 'السيرفر' : 'Server'}
                >
                  <Server className="h-3.5 w-3.5" />
                  {isRTL ? 'سيرفر' : 'Server'}
                </button>
              </div>
            </div>
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
              {/* Chat Messages Area - Clean bubbles, no avatars - SCROLLABLE */}
              <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 pt-[64px] md:pt-[72px] space-y-3 scrollbar-thin">

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
                  
                  // ASSET PICKER DETECTION
                  let assetPicker: {
                    type: string;
                    message: string;
                    originalRequest: string;
                    assets: Array<{ filename: string; url: string; file_type: string }>;
                  } | null = null;
                  
                  // IMAGE SOURCE PICKER DETECTION
                  let imageSourcePicker: {
                    type: string;
                    prompt: string;
                  } | null = null;
                  
                  if (msg.role === 'assistant') {
                    // Try to extract JSON plan from content (may be mixed with text)
                    const content = msg.content;
                    
                    // Method 1: Try direct JSON parse
                    try {
                      const parsed = JSON.parse(content);
                      if (parsed.type === 'image_source_picker' && parsed.prompt) {
                        imageSourcePicker = parsed;
                      } else if (parsed.type === 'booking_form_wizard' && parsed.prompt) {
                        // Handled separately below
                      } else if (parsed.type === 'contact_form_wizard' && parsed.prompt) {
                        // Handled separately below
                      } else if (parsed.type === 'asset_picker' && parsed.assets) {
                        assetPicker = parsed;
                      } else if (parsed.type === 'plan' || (parsed.title && (parsed.steps || parsed.codeChanges))) {
                        parsedPlan = parsed;
                        isPlanCard = true;
                      } else if (parsed.type === 'product_form_card' && parsed.prompt) {
                        // Handled below as ProductFormCard
                      }
                    } catch {
                      // Method 2: Extract JSON object from mixed content
                      // First check for asset_picker
                      const assetPickerMatch = content.match(/\{[\s\S]*"type"\s*:\s*"asset_picker"[\s\S]*\}/);
                      if (assetPickerMatch) {
                        try {
                          const extracted = JSON.parse(assetPickerMatch[0]);
                          if (extracted.type === 'asset_picker' && extracted.assets) {
                            assetPicker = extracted;
                          }
                        } catch {
                          // Not valid JSON
                        }
                      }
                      
                      // Then check for plan
                      if (!assetPicker) {
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
                    
                    // PRODUCT FORM CARD - Inline card in chat
                    let productCardData: { type: string; prompt: string } | null = null;
                    try {
                      const parsedProduct = JSON.parse(msg.content);
                      if (parsedProduct.type === 'product_form_card') {
                        productCardData = parsedProduct;
                      }
                    } catch {}

                    if (productCardData && showProductFormCard && msg.id === activeProductCardId) {
                      return (
                        <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                          <ProductFormCard
                            projectId={id || ''}
                            isRTL={isRTL}
                            onCancel={() => {
                              setShowProductFormCard(false);
                              setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            }}
                            onSaved={async (productName) => {
                              setShowProductFormCard(false);
                              setChatMessages(prev => prev.filter(m => m.id !== msg.id));

                              setBackendInitialTab('shop');
                              setBackendInitialShopTab('inventory');
                              setBackendRefreshKey(prev => prev + 1);
                              setMainTab('server');

                              const successMsg = isRTL
                                ? `✓ تم حفظ المنتج: ${productName}`
                                : `✓ Product saved: ${productName}`;
                              const { data: aiMsgData, error: aiMsgErr } = await supabase
                                .from('project_chat_messages' as any)
                                .insert({ project_id: id, role: 'assistant', content: successMsg } as any)
                                .select()
                                .single();

                              if (aiMsgErr) console.error('Error saving product success message:', aiMsgErr);
                              if (aiMsgData) {
                                setChatMessages(prev => [...prev, aiMsgData as any]);
                              } else {
                                setChatMessages(prev => [...prev, {
                                  id: `product-saved-${Date.now()}`,
                                  role: 'assistant',
                                  content: successMsg
                                }]);
                              }
                              fetchBackendContext();
                            }}
                            onOpenInventory={() => {
                              setBackendInitialTab('shop');
                              setBackendInitialShopTab('inventory');
                              setMainTab('server');
                            }}
                          />
                        </div>
                      );
                    }
                  }
                  
                  // ASSET PICKER CARD UI (Interactive selection grid)
                  if (assetPicker && assetPicker.assets?.length > 0) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <div className="w-full bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/30 rounded-xl overflow-hidden backdrop-blur-sm">
                          {/* Header */}
                          <div className="px-4 py-3 border-b border-indigo-500/20 flex items-center gap-2">
                            <Upload className="h-4 w-4 text-indigo-500" />
                            <span className="text-[13px] font-semibold text-foreground">
                              {isRTL ? 'اختر صورة' : 'Select an Image'}
                            </span>
                          </div>
                          
                          {/* Message */}
                          <div className="px-4 py-3 border-b border-indigo-500/10">
                            <p className="text-[13px] text-foreground/80">
                              {assetPicker.message || (isRTL ? 'أي صورة تريد استخدامها؟' : 'Which image would you like me to use?')}
                            </p>
                          </div>
                          
                          {/* Asset Grid */}
                          <div className="p-4 grid grid-cols-3 gap-3">
                            {assetPicker.assets.map((asset, assetIdx) => {
                              const isImage = asset.file_type?.startsWith('image/') || 
                                /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.filename);
                              
                              return (
                                <button
                                  key={assetIdx}
                                  onClick={async () => {
                                    // Send a follow-up message with the selected asset
                                    const selectionMsg = `Use ${asset.filename} (${asset.url}) for: ${assetPicker.originalRequest || 'my request'}`;
                                    
                                    // Add user message
                                    const { data: userMsgData } = await supabase
                                      .from('project_chat_messages' as any)
                                      .insert({ 
                                        project_id: id, 
                                        role: 'user', 
                                        content: selectionMsg 
                                      } as any)
                                      .select()
                                      .single();
                                    
                                    if (userMsgData) {
                                      setChatMessages(prev => [...prev, userMsgData as any]);
                                    }
                                    
                                    // Now trigger the chat/edit flow with the specific file
                                    setChatInput('');
                                    setAiEditing(true);
                                    setThinkingStartTime(Date.now());
                                    setEditedFilesTracking([]);
                                    try {
                                      // Using AGENT mode for targeted edits
                                      const response = await supabase.functions.invoke('projects-generate', {
                                        body: {
                                          action: 'start',
                                          projectId: id,
                                          mode: 'agent',
                                          prompt: selectionMsg,
                                          currentFiles: generatedFiles,
                                          uploadedAssets,
                                          backendContext,
                                        },
                                      });
                                      
                                      if (response.error) throw new Error(response.error.message);
                                      
                                      // AGENT MODE: Returns results directly
                                      const agentResult = response.data;
                                      
                                      if (agentResult?.mode === 'agent' && agentResult?.result) {
                                        // Agent completed synchronously
                                        const newFiles = await loadFilesFromDb(id!);
                                        
                                        setGeneratedFiles(newFiles);
                                        setCodeContent(newFiles["/App.js"] || Object.values(newFiles)[0] || "");
                                        setSandpackKey(prev => prev + 1);
                                        
                                        // Add success message
                                        const successMsg = isRTL 
                                          ? `✓ تم استخدام ${asset.filename} بنجاح!`
                                          : `✓ Successfully used ${asset.filename}!`;
                                        
                                        const { data: aiMsgData } = await supabase
                                          .from('project_chat_messages' as any)
                                          .insert({ 
                                            project_id: id, 
                                            role: 'assistant', 
                                            content: successMsg,
                                            snapshot: newFiles
                                          } as any)
                                          .select()
                                          .single();
                                        
                                        if (aiMsgData) {
                                          setChatMessages(prev => [...prev, aiMsgData as any]);
                                        }
                                        
                                        toast.success(isRTL ? 'تم تطبيق الصورة!' : 'Image applied!');
                                      } else if (agentResult?.jobId) {
                                        // Fallback: job-based polling
                                        const job = await pollJobUntilDone(agentResult.jobId);
                                        const newFiles = await loadFilesFromDb(id!);
                                        
                                        setGeneratedFiles(newFiles);
                                        setCodeContent(newFiles["/App.js"] || Object.values(newFiles)[0] || "");
                                        setSandpackKey(prev => prev + 1);
                                        
                                        const successMsg = isRTL 
                                          ? `✓ تم استخدام ${asset.filename} بنجاح!`
                                          : `✓ Successfully used ${asset.filename}!`;
                                        
                                        const { data: aiMsgData } = await supabase
                                          .from('project_chat_messages' as any)
                                          .insert({ 
                                            project_id: id, 
                                            role: 'assistant', 
                                            content: successMsg,
                                            snapshot: newFiles
                                          } as any)
                                          .select()
                                          .single();
                                        
                                        if (aiMsgData) {
                                          setChatMessages(prev => [...prev, aiMsgData as any]);
                                        }
                                        
                                        toast.success(isRTL ? 'تم تطبيق الصورة!' : 'Image applied!');
                                      }
                                    } catch (err: any) {
                                      console.error('Asset selection error:', err);
                                      toast.error(isRTL ? 'فشل في تطبيق الصورة' : 'Failed to apply image');
                                    } finally {
                                      setAiEditing(false);
                                      setThinkingStartTime(null);
                                    }
                                  }}
                                  disabled={aiEditing}
                                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 dark:bg-zinc-900/50 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-200 group disabled:opacity-50"
                                >
                                  {/* Thumbnail */}
                                  {isImage ? (
                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
                                      <img 
                                        src={asset.url} 
                                        alt={asset.filename}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center">
                                      <FileCode className="h-6 w-6 text-zinc-500" />
                                    </div>
                                  )}
                                  
                                  {/* Filename */}
                                  <span className="text-[11px] text-foreground/70 text-center truncate max-w-full group-hover:text-indigo-400 transition-colors">
                                    {asset.filename.length > 12 
                                      ? asset.filename.substring(0, 10) + '...' 
                                      : asset.filename}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // IMAGE SOURCE PICKER - Inline buttons in chat (Lovable style)
                  if (imageSourcePicker && showImageSourceDialog) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <ImageSourceButtons 
                          prompt={imageSourcePicker.prompt}
                          onSelect={(choice) => {
                            handleImageSourceSelect(choice);
                            // Remove this message from chat after selection
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // BOOKING FORM WIZARD - Inline wizard in chat
                  let bookingWizardData: { type: string; prompt: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'booking_form_wizard') bookingWizardData = parsed;
                  } catch {}
                  
                  if (bookingWizardData && showBookingWizard) {
                    const services: BookingService[] = (backendContext?.services || []).map((s, idx) => ({
                      id: `service-${idx}`,
                      name: s.name,
                      duration: s.duration,
                      price: s.price
                    }));
                    
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <BookingFormWizard
                          services={services}
                          originalPrompt={pendingFormPrompt}
                          onComplete={async (config, structuredPrompt) => {
                            setShowBookingWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // Check if this is part of a multi-feature request
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('booking', config);
                              if (hasMoreWizards) {
                                // Don't trigger generation yet - more wizards to configure
                                return;
                              }
                              // All wizards done - generate final prompt with all configs
                              const allConfigs = { ...wizardConfigs, booking: config };
                              const finalPrompt = generateFinalMultiFeaturePrompt(allConfigs);
                              
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) {
                                  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                                }
                              });
                              return;
                            }
                            
                            // Single feature request - original behavior
                            setPendingFormPrompt('');
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            
                            const { data: wizardAssistantMsg, error: wizardAssistantErr } = await supabase
                              .from('project_chat_messages' as any)
                              .insert({ project_id: id, role: 'assistant', content: structuredPrompt } as any)
                              .select()
                              .single();
                            
                            if (wizardAssistantErr) console.error('Error saving assistant message:', wizardAssistantErr);
                            if (wizardAssistantMsg) {
                              setChatMessages(prev => [...prev, wizardAssistantMsg as any]);
                            } else {
                              setChatMessages(prev => [...prev, {
                                id: `assistant-${Date.now()}`,
                                role: 'assistant',
                                content: structuredPrompt
                              }]);
                            }
                            
                            wizardPromptRef.current = structuredPrompt;
                            
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              }
                            });
                          }}
                          onCancel={() => {
                            setShowBookingWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (analyzedRequest) {
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                            }
                          }}
                          onSkipWizard={async () => {
                            setShowBookingWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // Check if this is part of a multi-feature request
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('booking', null);
                              if (hasMoreWizards) return;
                              
                              // All wizards done
                              const finalPrompt = generateFinalMultiFeaturePrompt(wizardConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) {
                                  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                                }
                              });
                              return;
                            }
                            
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            
                            const prompt = pendingFormPrompt || 'Create a booking form';
                            setPendingFormPrompt('');
                            wizardPromptRef.current = prompt;
                            
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              }
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // CONTACT FORM WIZARD - Inline wizard in chat
                  let contactWizardData: { type: string; prompt: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'contact_form_wizard') contactWizardData = parsed;
                  } catch {}
                  
                  if (contactWizardData && showContactWizard) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <ContactFormWizard
                          originalPrompt={pendingFormPrompt}
                          onComplete={async (config, structuredPrompt) => {
                            setShowContactWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // Multi-feature queue handling
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('contact', config);
                              if (hasMoreWizards) return;
                              
                              const allConfigs = { ...wizardConfigs, contact: config };
                              const finalPrompt = generateFinalMultiFeaturePrompt(allConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            setPendingFormPrompt('');
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            wizardPromptRef.current = structuredPrompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                          onCancel={() => {
                            setShowContactWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (analyzedRequest) { setAnalyzedRequest(null); setWizardConfigs({}); }
                          }}
                          onSkipWizard={async () => {
                            setShowContactWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('contact', null);
                              if (hasMoreWizards) return;
                              const finalPrompt = generateFinalMultiFeaturePrompt(wizardConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            const prompt = pendingFormPrompt || 'Create a contact form';
                            setPendingFormPrompt('');
                            wizardPromptRef.current = prompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // PRODUCT WIZARD - Inline wizard in chat
                  let productWizardData: { type: string; prompt: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'product_wizard') productWizardData = parsed;
                  } catch {}
                  
                  if (productWizardData && showProductWizard) {
                    const existingProducts: Product[] = (backendContext?.products || []).map((p: any, idx: number) => ({
                      id: `product-${idx}`,
                      name: p.name,
                      price: p.price,
                      description: p.description || '',
                      category: p.category || 'Featured',
                      inStock: p.inStock ?? true
                    }));
                    
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <ProductWizard
                          existingProducts={existingProducts}
                          originalPrompt={pendingFormPrompt}
                          projectId={id}
                          onComplete={async (config, structuredPrompt, newProducts) => {
                            setShowProductWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // 🚀 OPTION C: Save new products directly to backend
                            if (newProducts && newProducts.length > 0 && id) {
                              console.log(`[ProductWizard] Saving ${newProducts.length} new products to backend...`);
                              for (const product of newProducts) {
                                try {
                                  const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      projectId: id,
                                      action: 'collection/products',
                                      data: {
                                        name: product.name,
                                        price: product.price,
                                        description: product.description,
                                        category: product.category,
                                        inStock: product.inStock
                                      }
                                    })
                                  });
                                  if (response.ok) {
                                    console.log(`[ProductWizard] ✅ Saved product: ${product.name}`);
                                  } else {
                                    console.error(`[ProductWizard] ❌ Failed to save product: ${product.name}`);
                                  }
                                } catch (err) {
                                  console.error(`[ProductWizard] Error saving product:`, err);
                                }
                              }
                              // Refresh backend context to show new products
                              await fetchBackendContext();
                            }
                            
                            // Multi-feature queue handling
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('products', config);
                              if (hasMoreWizards) return;
                              
                              const allConfigs = { ...wizardConfigs, products: config };
                              const finalPrompt = generateFinalMultiFeaturePrompt(allConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            setPendingFormPrompt('');
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            wizardPromptRef.current = structuredPrompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                          onCancel={() => {
                            setShowProductWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (analyzedRequest) { setAnalyzedRequest(null); setWizardConfigs({}); }
                          }}
                          onSkipWizard={async () => {
                            setShowProductWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('products', null);
                              if (hasMoreWizards) return;
                              const finalPrompt = generateFinalMultiFeaturePrompt(wizardConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            const prompt = pendingFormPrompt || 'Create a product catalog';
                            setPendingFormPrompt('');
                            wizardPromptRef.current = prompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // AUTH WIZARD - Inline wizard in chat
                  let authWizardData: { type: string; prompt: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'auth_wizard') authWizardData = parsed;
                  } catch {}
                  
                  if (authWizardData && showAuthWizard) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <AuthWizard
                          originalPrompt={pendingFormPrompt}
                          onComplete={async (config, structuredPrompt) => {
                            setShowAuthWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // Multi-feature queue handling
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('auth', config);
                              if (hasMoreWizards) return;
                              
                              const allConfigs = { ...wizardConfigs, auth: config };
                              const finalPrompt = generateFinalMultiFeaturePrompt(allConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            setPendingFormPrompt('');
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            wizardPromptRef.current = structuredPrompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                          onCancel={() => {
                            setShowAuthWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (analyzedRequest) { setAnalyzedRequest(null); setWizardConfigs({}); }
                          }}
                          onSkipWizard={async () => {
                            setShowAuthWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('auth', null);
                              if (hasMoreWizards) return;
                              const finalPrompt = generateFinalMultiFeaturePrompt(wizardConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            const prompt = pendingFormPrompt || 'Create a login page';
                            setPendingFormPrompt('');
                            wizardPromptRef.current = prompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // MEDIA WIZARD - Inline wizard in chat
                  let mediaWizardData: { type: string; prompt: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'media_wizard') mediaWizardData = parsed;
                  } catch {}
                  
                  if (mediaWizardData && showMediaWizard) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <MediaWizard
                          originalPrompt={pendingFormPrompt}
                          onComplete={async (config, structuredPrompt) => {
                            setShowMediaWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            // Multi-feature queue handling
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('media', config);
                              if (hasMoreWizards) return;
                              
                              const allConfigs = { ...wizardConfigs, media: config };
                              const finalPrompt = generateFinalMultiFeaturePrompt(allConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            setPendingFormPrompt('');
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            wizardPromptRef.current = structuredPrompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                          onCancel={() => {
                            setShowMediaWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (analyzedRequest) { setAnalyzedRequest(null); setWizardConfigs({}); }
                          }}
                          onSkipWizard={async () => {
                            setShowMediaWizard(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            if (analyzedRequest && analyzedRequest.isMultiFeature) {
                              const hasMoreWizards = advanceToNextWizard('media', null);
                              if (hasMoreWizards) return;
                              const finalPrompt = generateFinalMultiFeaturePrompt(wizardConfigs);
                              setPendingFormPrompt('');
                              setAnalyzedRequest(null);
                              setWizardConfigs({});
                              skipFormWizardRef.current = true;
                              skipUserMessageSaveRef.current = true;
                              wizardPromptRef.current = finalPrompt;
                              requestAnimationFrame(() => {
                                const form = document.querySelector('form[class*="flex items-end gap-2"]');
                                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              });
                              return;
                            }
                            
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            const prompt = pendingFormPrompt || 'Create a file upload component';
                            setPendingFormPrompt('');
                            wizardPromptRef.current = prompt;
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // FEATURE SUMMARY CARD - Multi-feature request analysis
                  let featureSummaryData: { type: string; analysis: AnalyzedRequest; summary: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'feature_summary') featureSummaryData = parsed;
                  } catch {}
                  
                  if (featureSummaryData && showFeatureSummary) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <FeatureSummaryCard
                          analysis={featureSummaryData.analysis}
                          currentFeatureIndex={analyzedRequest?.currentFeatureIndex || 0}
                          isRTL={isRTL}
                          onStartConfiguration={() => {
                            // Start with the first wizard that needs configuration
                            setShowFeatureSummary(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            
                            if (analyzedRequest) {
                              const nextFeature = getNextWizardFeature(analyzedRequest);
                              if (nextFeature) {
                                const wizardType = featureToWizardType(nextFeature.type);
                                console.log('[ProjectDetail] Starting wizard for:', nextFeature.type, wizardType);
                                
                                // Trigger the appropriate wizard
                                if (wizardType === 'booking') setShowBookingWizard(true);
                                else if (wizardType === 'product') setShowProductWizard(true);
                                else if (wizardType === 'auth') setShowAuthWizard(true);
                                else if (wizardType === 'media') setShowMediaWizard(true);
                                else if (wizardType === 'contact') setShowContactWizard(true);
                                
                                // Save wizard message to chat
                                // Note: booking/contact need "_form_wizard" suffix, others just "_wizard"
                                const wizardTypeKey = (wizardType === 'booking' || wizardType === 'contact') 
                                  ? `${wizardType}_form_wizard` 
                                  : `${wizardType}_wizard`;
                                const wizardContent = JSON.stringify({
                                  type: wizardTypeKey,
                                  prompt: pendingFormPrompt
                                });
                                setChatMessages(prev => [...prev, {
                                  id: `${wizardType}-wizard-${Date.now()}`,
                                  role: 'assistant',
                                  content: wizardContent
                                }]);
                              }
                            }
                          }}
                          onSkipWizards={async () => {
                            // Skip all wizards and let AI generate everything
                            setShowFeatureSummary(false);
                            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                            setAnalyzedRequest(null);
                            
                            // Trigger AI generation with original prompt
                            skipFormWizardRef.current = true;
                            skipUserMessageSaveRef.current = true;
                            wizardPromptRef.current = pendingFormPrompt;
                            
                            requestAnimationFrame(() => {
                              const form = document.querySelector('form[class*="flex items-end gap-2"]');
                              if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                              }
                            });
                          }}
                        />
                      </div>
                    );
                  }
                  
                  // PLAN CARD UI (Lovable-style - clean, minimal, professional)
                  if (isPlanCard && parsedPlan) {
                    return (
                      <div key={i} className="flex flex-col items-start w-full max-w-full overflow-hidden">
                        <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden max-w-full">
                          {/* Plan Header */}
                          <div className="px-4 py-2.5 border-b border-[#2a2a2a]">
                            <span className="text-[13px] text-zinc-500">Plan</span>
                          </div>
                          
                          {/* Plan Content */}
                          <div className="px-4 py-4 space-y-4 overflow-hidden max-w-full">
                            {/* Title */}
                            <h3 className="text-[15px] font-semibold text-white">
                              Plan: {parsedPlan.title}
                            </h3>
                            
                            {/* File Reference */}
                            {parsedPlan.file && (
                              <p className="text-[13px] text-zinc-400 break-words">
                                <span className="font-medium text-zinc-300">Changes to</span>{' '}
                                <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-xs break-all inline-block max-w-full">
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
                                        <li className="text-[13px] text-zinc-400 flex flex-wrap items-start gap-1.5">
                                          <span className="text-zinc-600 shrink-0">•</span>
                                          <span className="shrink-0">Current:</span>
                                          <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs break-all max-w-full">
                                            {step.current}
                                          </code>
                                        </li>
                                      )}
                                      {step.changeTo && (
                                        <li className="text-[13px] text-zinc-400 flex flex-wrap items-start gap-1.5">
                                          <span className="text-zinc-600 shrink-0">•</span>
                                          <span className="shrink-0">Change to:</span>
                                          <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono text-xs break-all max-w-full">
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
                              <div className="space-y-2 overflow-hidden max-w-full">
                                <h4 className="text-[13px] font-semibold text-white">Code Changes:</h4>
                                {parsedPlan.codeChanges.map((change, changeIdx) => (
                                  <div key={changeIdx} className="bg-[#0d0d0d] border border-[#252525] rounded-lg overflow-hidden max-w-full">
                                    {/* File header */}
                                    <div className="px-3 py-1.5 bg-[#151515] border-b border-[#252525] flex items-center justify-between gap-2 min-w-0">
                                      <span className="text-[11px] text-zinc-500 font-mono truncate min-w-0 flex-1">
                                        // {change.file}{change.line ? ` (line ${change.line})` : ''}
                                      </span>
                                      <button 
                                        onClick={() => navigator.clipboard.writeText(change.code)}
                                        className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                                        title="Copy code"
                                        aria-label="Copy code"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </div>
                                    {/* Code */}
                                    <pre className="px-3 py-2.5 text-[12px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-words max-w-full">
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
                                const thinkingStart = Date.now();
                                setThinkingStartTime(thinkingStart);
                                thinkingStartTimeRef.current = thinkingStart;
                                setEditedFilesTracking([]);
                                setToolsUsedCount(0);
                                setLastThinkingDuration(null);
                                setAiError(null);
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

                                    // Update edited files tracking + tool usage for the indicator
                                    const filesForTracking = uniqueChangedFiles.length > 0 ? uniqueChangedFiles : ['/App.js'];
                                    setEditedFilesTracking(filesForTracking.map((filePath, idx) => ({
                                      id: `file-${idx}-${Date.now()}`,
                                      fileName: String(filePath).replace(/^\//, ''),
                                      status: 'edited' as const,
                                    })));
                                    setToolsUsedCount(prev => prev + (filesForTracking.length || 1));
                                    
                                    // Create a structured Lovable-style message with conversational response
                                    // Generate a friendly conversational response based on what was done
                                    const friendlyResponse = isRTL 
                                      ? `تم! ${planTitle ? `قمت بـ ${planTitle.toLowerCase()}` : 'تم تطبيق التغييرات المطلوبة'}. ${stepsSummary ? stepsSummary : 'تم تحديث الكود بنجاح.'}`
                                      : `Done! ${planTitle ? `I've ${planTitle.toLowerCase().replace(/^add\s+/i, 'added ').replace(/^remove\s+/i, 'removed ').replace(/^update\s+/i, 'updated ').replace(/^create\s+/i, 'created ').replace(/^fix\s+/i, 'fixed ')}` : 'I\'ve applied the requested changes'}. ${stepsSummary ? stepsSummary : 'The code has been updated successfully.'}`;
                                    
                                    const successMsg = JSON.stringify({
                                      type: 'execution_result',
                                      title: planTitle,
                                      response: friendlyResponse,
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
                                  const errorMessage = err.message || (isRTL ? 'فشل غير معروف' : 'Unknown failure');
                                  
                                  // Set error explanation card
                                  setAiError({
                                    title: 'Plan Execution Failed',
                                    titleAr: 'فشل تنفيذ الخطة',
                                    message: 'The plan couldn\'t be applied to your code. There may be a conflict or syntax issue.',
                                    messageAr: 'تعذر تطبيق الخطة على الكود الخاص بك. قد يكون هناك تعارض أو مشكلة في الصياغة.',
                                    severity: 'error',
                                    technicalDetails: errorMessage,
                                    suggestedAction: 'Review the plan and try again, or ask the AI to modify the approach.',
                                    suggestedActionAr: 'راجع الخطة وحاول مرة أخرى، أو اطلب من الذكاء الاصطناعي تعديل النهج.',
                                  });
                                  
                                  toast.error(isRTL ? 'فشل في تنفيذ الخطة' : 'Failed to apply changes');
                                  setGenerationSteps([]);
                                } finally {
                                  // Save final thinking duration before clearing (use ref to avoid stale state)
                                  const start = thinkingStartTimeRef.current;
                                  if (start) {
                                    setLastThinkingDuration(Math.floor((Date.now() - start) / 1000));
                                  }
                                  thinkingStartTimeRef.current = null;
                                  setAiEditing(false);
                                  setThinkingStartTime(null);
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
                  // Detect structured execution_result OR clarification_needed OR feature_summary OR verbose execution response
                  let executionResult: { type: string; title: string; response?: string; summary: string; files: string[] } | null = null;
                  let clarificationResult: { type: string; title: string; message: string; candidates: Array<{ file: string; preview: string; line?: number }>; suggestion: string } | null = null;
                  let featureSummaryForDisplay: { type: string; analysis: any; summary: string } | null = null;
                  try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed.type === 'execution_result') {
                      executionResult = parsed;
                    } else if (parsed.type === 'clarification_needed') {
                      clarificationResult = parsed;
                    } else if (parsed.type === 'feature_summary') {
                      // Convert feature_summary JSON to friendly message
                      featureSummaryForDisplay = parsed;
                      const features = parsed.analysis?.features || [];
                      const featureList = features.map((f: any) => `• ${f.description}`).join('\n');
                      displayContent = isRTL 
                        ? `🔍 **تحليل طلبك:**\n\n${featureList || parsed.summary || 'جاري تحليل الطلب...'}\n\n_جاري العمل على ذلك..._`
                        : `🔍 **Analyzing your request:**\n\n${featureList || parsed.summary || 'Processing your request...'}\n\n_Working on it..._`;
                    }
                  } catch { /* not JSON */ }
                  
                  // 🎯 OPTION D: CLARIFICATION CARD - When agent needs user to specify which element
                  if (clarificationResult) {
                    return (
                      <div key={i} className={cn(
                        "flex flex-col group animate-in fade-in slide-in-from-bottom-1 duration-300",
                        "items-start w-full"
                      )}>
                        <div className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
                          {/* Header with question mark */}
                          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-amber-500" />
                            <span className="text-[13px] text-amber-500 font-semibold flex-1">
                              {isRTL ? 'أي عنصر تقصد؟' : clarificationResult.title || 'Which element do you mean?'}
                            </span>
                          </div>
                          
                          {/* Message */}
                          <div className="px-4 py-3 space-y-3">
                            <p className="text-[13px] text-foreground/80 leading-relaxed">
                              {isRTL ? 'وجدت عدة عناصر تطابق طلبك. الرجاء تحديد أي واحد تريد تغييره:' : clarificationResult.message}
                            </p>
                            
                            {/* Candidate options */}
                            {clarificationResult.candidates && clarificationResult.candidates.length > 0 && (
                              <div className="space-y-2">
                                {clarificationResult.candidates.map((candidate, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      // Send a follow-up message specifying this candidate
                                      const clarifyMsg = `I mean the one in ${candidate.file}${candidate.line ? ` at line ${candidate.line}` : ''}: "${candidate.preview.substring(0, 50)}..."`;
                                      setChatInput(clarifyMsg);
                                    }}
                                    className="w-full text-left p-3 rounded-lg border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group/candidate"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <FileCode className="h-3 w-3 text-amber-500" />
                                      <code className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                                        {candidate.file}{candidate.line ? `:${candidate.line}` : ''}
                                      </code>
                                    </div>
                                    <p className="text-[12px] text-foreground/60 truncate group-hover/candidate:text-foreground/80">
                                      {candidate.preview || 'Click to select this element'}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* Suggestion */}
                            {clarificationResult.suggestion && (
                              <p className="text-[11px] text-foreground/50 italic">
                                💡 {isRTL ? 'نصيحة: يمكنك النقر على العنصر في المعاينة لتحديده بدقة' : clarificationResult.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
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
                    
                    const hasSnapshotForApplied = msg.snapshot && Object.keys(msg.snapshot).length > 0;
                    
                    return (
                      <div key={i} className={cn(
                        "flex flex-col group animate-in fade-in slide-in-from-bottom-1 duration-300",
                        "items-start w-full"
                      )}>
                        <div className="w-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
                          {/* Header with checkmark */}
                          <div className="px-4 py-3 border-b border-indigo-500/20 flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <span className="text-[13px] text-emerald-500 font-semibold flex-1">{isRTL ? 'تم التطبيق' : 'Applied'}</span>
                            <button
                              onClick={() => {
                                const text = `${summary}${uniqueFiles.length ? `\n\nFiles:\n- ${uniqueFiles.join('\n- ')}` : ''}`;
                                navigator.clipboard.writeText(text);
                                toast.success(isRTL ? 'تم النسخ!' : 'Copied!');
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 transition-all active:scale-95"
                              title={isRTL ? 'نسخ' : 'Copy'}
                              aria-label={isRTL ? 'نسخ' : 'Copy'}
                            >
                              <Copy className="h-3 w-3" />
                              <span>{isRTL ? 'نسخ' : 'Copy'}</span>
                            </button>
                          </div>
                          
                          {/* Response Section - Conversational message like Lovable */}
                          <div className="px-4 py-3 space-y-3">
                            {/* Friendly conversational response */}
                            {executionResult?.response && (
                              <p className="text-[14px] text-foreground font-medium leading-relaxed">
                                {executionResult.response}
                              </p>
                            )}
                            
                            {/* Technical summary - smaller, secondary */}
                            {summary && (!executionResult?.response || summary !== executionResult.response) && (
                              <p className="text-[12px] text-foreground/60 leading-relaxed">
                                {summary}
                              </p>
                            )}
                            
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
                        
                        {/* Restore Button for Applied messages */}
                        <button
                          onClick={() => handleRevert(msg.id)}
                          disabled={!hasSnapshotForApplied}
                          className={cn(
                            "mt-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all active:scale-95",
                            hasSnapshotForApplied 
                              ? "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                              : "text-muted-foreground/50 cursor-not-allowed"
                          )}
                          title={hasSnapshotForApplied 
                            ? (isRTL ? 'الرجوع لهذه النقطة' : 'Revert to this point')
                            : (isRTL ? 'لا توجد نقطة استعادة' : 'No restore point available')
                          }
                        >
                          <RefreshCw className="h-3 w-3" />
                          {isRTL ? 'استعادة' : 'Restore'}
                        </button>
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
                        {/* Timestamp - Lovable Style */}
                        <div className={cn(
                          "flex items-center justify-between mb-2 text-[10px]",
                          msg.role === 'user' ? "text-white/60" : "text-muted-foreground"
                        )}>
                          <span>
                            {(msg as any).timestamp ? new Date((msg as any).timestamp).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false 
                            }) : new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                          {/* Copy button - inline with timestamp */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content || '');
                              toast.success(isRTL ? 'تم النسخ!' : 'Copied!');
                            }}
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
                              msg.role === 'user' 
                                ? "hover:bg-white/10 text-white/60 hover:text-white"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )}
                            title={isRTL ? 'نسخ' : 'Copy'}
                          >
                            <Copy className="h-3 w-3" />
                            <span className="hidden sm:inline">{isRTL ? 'نسخ' : 'Copy'}</span>
                          </button>
                        </div>
                        
                        {isAssistant ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-3 prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border prose-th:border-border prose-td:px-3 prose-td:py-2 prose-td:text-xs prose-td:border prose-td:border-border prose-pre:my-2 prose-pre:bg-zinc-900 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-code:text-[12px] prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:prose-code:bg-transparent prose-pre:prose-code:p-0 prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r prose-a:text-primary prose-a:no-underline hover:prose-a:underline text-[13px] leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {displayContent}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Show attached images/PDFs if any */}
                            {(msg as any).images && Array.isArray((msg as any).images) && (msg as any).images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(msg as any).images.map((imgSrc: string, imgIdx: number) => {
                                  // Check if it's a PDF (has [PDF:filename] marker)
                                  if (typeof imgSrc === 'string' && imgSrc.startsWith('[PDF:')) {
                                    const endMarker = imgSrc.indexOf(']');
                                    const pdfName = endMarker > 0 ? imgSrc.substring(5, endMarker) : 'PDF';
                                    return (
                                      <div 
                                        key={imgIdx}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-indigo-500/30"
                                      >
                                        <span className="text-lg">📄</span>
                                        <span className="text-xs text-slate-300 max-w-[100px] truncate">{pdfName}</span>
                                      </div>
                                    );
                                  }
                                  // Regular image
                                  return (
                                    <img 
                                      key={imgIdx}
                                      src={imgSrc}
                                      alt={`Attached ${imgIdx + 1}`}
                                      className="max-w-[120px] max-h-[80px] rounded-lg object-cover border border-white/20"
                                    />
                                  );
                                })}
                              </div>
                            )}
                            {/* Show attachment indicator if no images but marker exists (after reload) */}
                            {(!(msg as any).images || (msg as any).images.length === 0) && msg.content?.startsWith('[ATTACHMENTS:') && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-indigo-500/20 mb-2">
                                <span className="text-sm">📎</span>
                                <span className="text-xs text-slate-400">
                                  {(() => {
                                    const match = msg.content.match(/^\[ATTACHMENTS:(\d+)\]/);
                                    const count = match ? parseInt(match[1]) : 0;
                                    return isRTL ? `${count} مرفق` : `${count} attachment${count > 1 ? 's' : ''} included`;
                                  })()}
                                </span>
                              </div>
                            )}
                            {/* Check if this is an auto-fix request message */}
                            {(() => {
                              const cleanedContent = msg.content?.replace(/^\[ATTACHMENTS:\d+\]/, '') || '';
                              const { isAutoFix, errorMessage } = parseAutoFixMessage(cleanedContent);
                              
                              if (isAutoFix) {
                                return (
                                  <AutoFixCard
                                    errorMessage={errorMessage}
                                    language={isRTL ? 'ar' : 'en'}
                                    className="w-full max-w-[320px]"
                                  />
                                );
                              }
                              
                              return (
                                <div className="text-[13px] leading-relaxed">
                                  {cleanedContent}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      
                      {/* Revert Button - Right below the AI message for execution results */}
                      {msg.role === 'assistant' && (
                        (() => {
                          // Check if this is an execution result message (has snapshot OR is execution_result type)
                          let isExecutionResult = false;
                          try {
                            const parsed = JSON.parse(msg.content);
                            isExecutionResult = parsed?.type === 'execution_result';
                          } catch { /* not JSON */ }
                          
                          const hasSnapshot = msg.snapshot && Object.keys(msg.snapshot).length > 0;
                          
                          if (hasSnapshot || isExecutionResult) {
                            return (
                              <button
                                onClick={() => handleRevert(msg.id)}
                                disabled={!hasSnapshot}
                                className={cn(
                                  "mt-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all active:scale-95",
                                  hasSnapshot 
                                    ? "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                                    : "text-muted-foreground/50 cursor-not-allowed"
                                )}
                                title={hasSnapshot 
                                  ? (isRTL ? 'الرجوع لهذه النقطة' : 'Revert to this point')
                                  : (isRTL ? 'لا توجد نقطة استعادة' : 'No restore point available')
                                }
                              >
                                <RefreshCw className="h-3 w-3" />
                                {isRTL ? 'استعادة' : 'Restore'}
                              </button>
                            );
                          }
                          return null;
                        })()
                      )}
                      
                      {/* Backend Connections Summary - Show after "project is ready" messages */}
                      {msg.role === 'assistant' && generatedFiles && Object.keys(generatedFiles).length > 0 && (
                        (() => {
                          const msgLower = (msg.content || '').toLowerCase();
                          const isProjectReady = msgLower.includes('project is ready') || 
                                                msgLower.includes('your project is ready') ||
                                                msgLower.includes('تم إنشاء مشروعك') ||
                                                (msgLower.includes('ready') && msgLower.includes('publish'));
                          
                          if (isProjectReady) {
                            return (
                              <BackendConnectionsSummary
                                generatedFiles={generatedFiles}
                                isRTL={isRTL}
                                onConfigureClick={(connectionId) => {
                                  // Trigger the appropriate wizard based on connection type
                                  if (connectionId === 'booking') setShowBookingWizard(true);
                                  else if (connectionId === 'products') setShowProductWizard(true);
                                  else if (connectionId === 'auth') setShowAuthWizard(true);
                                  else if (connectionId === 'media') setShowMediaWizard(true);
                                  else if (connectionId === 'contact') setShowContactWizard(true);
                                }}
                                className="mt-3 w-full"
                              />
                            );
                          }
                          return null;
                        })()
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
                  
                  {/* AI Working Indicator - Lovable Style */}
                  {(isGenerating || aiEditing) && (
                    <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-[100] w-full max-w-full">
                      {/* Thinking Timer - Lovable Style */}
                      {thinkingStartTime && (
                        <ThinkingTimerDisplay startTime={thinkingStartTime} isRTL={isRTL} />
                      )}
                      
                      {/* Main Content Area */}
                      <div 
                        ref={thinkingBoxRef}
                        className="w-full space-y-4"
                      >
                        {/* Trace Flow Loader - Browser animation (Chat mode only) */}
                        {leftPanelMode === 'chat' && (
                          <div className="w-full h-[140px] rounded-lg overflow-hidden bg-zinc-950/50">
                            <TraceFlowLoader />
                          </div>
                        )}

                        {/* Header Text */}
                        <p className="text-sm text-foreground">
                          {isGenerating 
                            ? (isRTL ? 'جاري إنشاء مشروعك...' : 'Building your project...') 
                            : leftPanelMode === 'chat'
                              ? (isRTL ? 'جاري التفكير...' : 'Thinking...')
                              : (isRTL ? 'جاري تطبيق التعديلات...' : 'Applying your changes...')}
                        </p>
                        
                        {isGenerating && (
                          <p className="text-xs text-muted-foreground animate-pulse">
                            {isRTL ? 'قد يستغرق هذا ما يصل إلى 3 دقائق لضمان أفضل جودة' : 'This may take up to 3 minutes for premium quality'}
                          </p>
                        )}
                        
                        {/* Tasks Panel - Lovable Dark Card Style */}
                        {(isGenerating || aiEditing) && generationSteps.length > 0 && (
                          <AgentTaskPanel
                            steps={generationSteps.map((step, idx) => ({
                              id: `step-${idx}`,
                              title: step.label,
                              status: step.status === 'loading' ? 'in_progress' : 
                                      step.status === 'error' ? 'failed' : 
                                      step.status as 'pending' | 'completed',
                              tool: idx === 0 ? 'read_file' : 
                                    idx === 1 ? 'search_replace' : 
                                    idx === 2 ? 'write_file' : undefined
                            }))}
                            isActive={aiEditing || isGenerating}
                            currentGoal={chatInput || undefined}
                            isRTL={isRTL}
                            onCancel={() => {
                              setAiEditing(false);
                              setIsGenerating(false);
                              setGenerationSteps([]);
                              toast.info(isRTL ? 'تم إلغاء العملية' : 'Operation cancelled');
                            }}
                          />
                        )}
                        
                        {/* Tool Usage Indicator - Lovable Style */}
                        {(toolsUsedCount > 0 || editedFilesTracking.length > 0) && (
                          <ToolUsageIndicator
                            toolsUsed={toolsUsedCount}
                            toolCalls={editedFilesTracking.map(f => ({
                              id: f.id,
                              name: f.fileName,
                              nameAr: f.fileName,
                              icon: undefined,
                              status: f.status === 'edited' ? 'completed' as const : 'running' as const
                            }))}
                            thinkingDuration={thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : lastThinkingDuration || undefined}
                            isComplete={!aiEditing && !isGenerating}
                          />
                        )}
                        
                        {(isGenerating || aiEditing) && generationSteps.length === 0 && toolsUsedCount === 0 && (
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-5 h-5 border-2 border-t-transparent rounded-full animate-spin",
                              leftPanelMode === 'chat' ? "border-emerald-500" : "border-blue-500"
                            )} />
                            <span className="text-sm text-foreground">
                              {isRTL ? 'معالجة...' : 'Processing...'}
                            </span>
                          </div>
                        )}

                        {/* Edited Files Panel - Lovable Style */}
                        {editedFilesTracking.length > 0 && (
                          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            {(showAllEditedFiles ? editedFilesTracking : editedFilesTracking.slice(0, 4)).map((file) => (
                              <div
                                key={file.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
                              >
                                <FileText className={cn(
                                  "h-3.5 w-3.5 flex-shrink-0",
                                  file.status === 'editing' ? "text-primary animate-pulse" : "text-zinc-400"
                                )} />
                                <span className={file.status === 'editing' ? 'text-primary' : 'text-zinc-400'}>
                                  {isRTL 
                                    ? (file.status === 'editing' ? 'يعدل' : 'تم') 
                                    : (file.status === 'editing' ? 'Editing' : 'Edited')}
                                </span>
                                <span className="text-zinc-300 font-medium" title={file.fileName}>
                                  {file.fileName.length > 18 ? `${file.fileName.slice(0, 15)}...` : file.fileName}
                                </span>
                              </div>
                            ))}

                            {editedFilesTracking.length > 4 && (
                              <button
                                onClick={() => setShowAllEditedFiles(!showAllEditedFiles)}
                                className="h-7 px-3 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex items-center gap-1"
                              >
                                {showAllEditedFiles 
                                  ? (isRTL ? 'إخفاء' : 'Hide') 
                                  : (isRTL ? 'عرض الكل' : 'Show all')}
                                {showAllEditedFiles ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Persist ToolUsageIndicator after completion (so it doesn't disappear) */}
                  {!aiEditing && !isGenerating && (lastThinkingDuration || toolsUsedCount > 0 || editedFilesTracking.length > 0) && (
                    <div className="flex flex-col items-start w-full max-w-full">
                      <ToolUsageIndicator
                        toolsUsed={toolsUsedCount}
                        toolCalls={editedFilesTracking.map(f => ({
                          id: f.id,
                          name: f.fileName,
                          nameAr: f.fileName,
                          icon: undefined,
                          status: 'completed' as const,
                        }))}
                        thinkingDuration={lastThinkingDuration || undefined}
                        isComplete={true}
                      />
                    </div>
                  )}

                  <div ref={chatEndRef} className="h-2" />
                </div>

                {/* AI Error Explanation Card - Lovable Style */}
                {aiError && (
                  <div className="mx-3 mb-2">
                    <ErrorExplanationCard
                      title={aiError.title}
                      titleAr={aiError.titleAr}
                      message={aiError.message}
                      messageAr={aiError.messageAr}
                      severity={aiError.severity}
                      technicalDetails={aiError.technicalDetails}
                      suggestedAction={aiError.suggestedAction}
                      suggestedActionAr={aiError.suggestedActionAr}
                      onRetry={() => {
                        setAiError(null);
                        // Re-send last user message
                        const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
                        if (lastUserMsg) {
                          setChatInput(lastUserMsg.content || '');
                        }
                      }}
                      onDismiss={() => setAiError(null)}
                    />
                  </div>
                )}

                {/* Self-Healing: Smart Auto-Fix Error Banner */}
                {crashReport && (
                  <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 backdrop-blur-sm shadow-lg shadow-red-500/10 animate-in slide-in-from-bottom-3 duration-300">
                    {/* Progress bar for auto-fix countdown */}
                    {autoFixCountdown !== null && !autoFixExhausted && (
                      <div className="h-1 bg-red-950">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-1000 ease-linear"
                          style={{ width: `${(autoFixCountdown / 3) * 100}%` }}
                        />
                      </div>
                    )}
                    
                    {/* RECOVERY UI - When all auto-fix attempts exhausted */}
                    {autoFixExhausted ? (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-full border border-red-500/30">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-red-100">
                              {isRTL ? 'فشل الإصلاح التلقائي' : 'Auto-Fix Failed'}
                            </h4>
                            <p className="text-xs text-red-300/70">
                              {isRTL 
                                ? 'تمت محاولة الإصلاح 4 مرات (بما في ذلك المُصلح). يرجى اختيار خيار الاستعادة.'
                                : 'Attempted 4 fixes (including The Fixer). Please choose a recovery option.'}
                            </p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-red-300/60 font-mono bg-red-950/50 p-2 rounded-lg overflow-hidden">
                          {crashReport.length > 100 ? crashReport.substring(0, 100) + '...' : crashReport}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {/* Revert to last working version */}
                          <button 
                            onClick={() => {
                              const lastWorkingMsg = [...chatMessages].reverse().find(m => m.snapshot && Object.keys(m.snapshot).length > 0);
                              if (lastWorkingMsg) {
                                handleRevert(lastWorkingMsg.id);
                                setAutoFixExhausted(false);
                                setCrashReport(null);
                                autoFixAttemptsRef.current.clear();
                              } else {
                                toast.error(isRTL ? 'لا توجد نسخة سابقة للاستعادة' : 'No previous version to revert to');
                              }
                            }}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {isRTL ? 'استعادة النسخة السابقة' : 'Revert to Last Working'}
                          </button>
                          
                          {/* Dismiss and edit manually */}
                          <button 
                            onClick={() => {
                              setAutoFixExhausted(false);
                              setCrashReport(null);
                              autoFixAttemptsRef.current.clear();
                              setLeftPanelMode('code');
                              toast.info(isRTL ? 'يمكنك الآن تعديل الكود يدوياً' : 'You can now edit the code manually');
                            }}
                            className="px-4 py-2.5 bg-gray-600/50 hover:bg-gray-500/50 text-gray-200 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                          >
                            <Code2 className="w-4 h-4" />
                            {isRTL ? 'تعديل يدوي' : 'Edit Manually'}
                          </button>
                        </div>
                      </div>
                    ) : fixerInProgress ? (
                      /* The Fixer is working */
                      <div className="p-3 flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-full border border-purple-500/30">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-purple-100">
                              {isRTL ? '🔧 المُصلح يعمل...' : '🔧 The Fixer Working...'}
                            </h4>
                            <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] font-medium text-purple-300">
                              Claude Opus 4
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/80 mt-0.5">
                            {isRTL ? 'المحاولة الأخيرة قبل خيارات الاستعادة' : 'Final attempt before recovery options'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Normal auto-fix UI */
                      <div className="p-3 flex items-center gap-3">
                        {/* Animated error icon */}
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping" />
                          <div className="relative p-2 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full border border-red-500/30">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          </div>
                        </div>
                        
                        {/* Error info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-red-100">
                              {isRTL ? 'تم اكتشاف خطأ' : 'Error Detected'}
                            </h4>
                            {autoFixCountdown !== null && (
                              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-medium text-amber-300">
                                {isRTL ? `إصلاح تلقائي في ${autoFixCountdown}` : `Auto-fixing in ${autoFixCountdown}s`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-red-300/80 truncate mt-0.5 font-mono">
                            {crashReport.length > 60 ? crashReport.substring(0, 60) + '...' : crashReport}
                          </p>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Cancel button */}
                          <button 
                            onClick={cancelAutoFix}
                            className="p-2 text-red-400/70 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title={isRTL ? 'إلغاء' : 'Dismiss'}
                          >
                            <X className="w-4 h-4" />
                          </button>
                          
                          {/* Fix Now button */}
                          <button 
                            onClick={handleAutoFix}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            {autoFixCountdown !== null 
                              ? (isRTL ? 'إصلاح الآن' : 'Fix Now') 
                              : (isRTL ? 'إصلاح تلقائي' : 'Auto-Fix')
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Input Area - FIXED at bottom */}
                <div className="p-2 border-t border-border/30 dark:border-white/10 shrink-0 space-y-1.5 bg-background/95 dark:bg-[#0c0f14]/95 backdrop-blur-sm">
                  {/* Context-Aware Quick Action Buttons + Jump to Bottom */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex flex-wrap gap-2 flex-1">
                      {(() => {
                        // Don't show quick actions during wizard display or AI editing
                        if (showBookingWizard || showContactWizard || aiEditing) {
                          return null;
                        }
                        
                        const lastAiMessage = [...chatMessages].reverse().find(m => m.role === 'assistant');
                        const raw = lastAiMessage?.content || '';
                        let responseContent = raw;
                        try {
                          const parsed = JSON.parse(raw);
                          // Skip wizard messages - don't show chips for them
                          if (parsed?.type === 'booking_form_wizard' || parsed?.type === 'contact_form_wizard' || parsed?.type === 'product_form_card') {
                            return null;
                          }
                          // 🎯 HIDE chips when there's a plan card with "Implement Plan" button
                          if (parsed?.type === 'plan') {
                            return null;
                          }
                          if (parsed?.type === 'execution_result' && typeof parsed.summary === 'string') {
                            responseContent = parsed.summary;
                          }
                        } catch {
                          // not JSON
                        }

                        return (
                          <QuickActionButtons
                            responseContent={responseContent}
                            isRTL={isRTL}
                            dynamicSuggestions={dynamicSuggestions}
                            onActionClick={async (prompt) => {
                              // Handle activation chips for configuration wizards
                              if (prompt.includes('✨ Configure booking')) {
                                // Show the booking wizard
                                setShowBookingWizard(true);
                                return;
                              } else if (prompt.includes('💈 Set up barber services') || prompt.includes('🛍️ Set up product')) {
                                // Show the product form card
                                setShowProductFormCard(true);
                                return;
                              } else if (prompt.includes('📧 Configure contact')) {
                                // Show the contact form wizard
                                setShowContactWizard(true);
                                return;
                              } else if (prompt.includes('Change the images') || prompt.includes('غير الصور')) {
                                setIsChangingCarouselImages(true);
                                openStockPhotoSelector('stock', true);
                              } else {
                                // 🎯 Auto-switch to Code mode and execute immediately
                                setLeftPanelMode('code');
                                setChatInput(prompt);
                                // Small delay to let state update, then submit
                                setTimeout(() => {
                                  const form = document.querySelector('form[data-chat-form]') as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 100);
                              }
                            }}
                          />
                        );
                      })()}
                    </div>

                    {/* Action buttons row */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Visual Edits Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const newMode = !elementSelectMode;
                          setElementSelectMode(newMode);
                          if (newMode) {
                            setSandpackKey(prev => prev + 1);
                            // Auto-switch to preview on mobile when enabling Visual Editor
                            // Mobile is defined as < 768px (md breakpoint)
                            if (window.innerWidth < 768 && mobileTab !== 'preview') {
                              setMobileTab('preview');
                            }
                            toast.info(isRTL ? 'انقر على أي عنصر في المعاينة لتحريره' : 'Click any element in preview to edit it');
                          }
                        }}
                        className={cn(
                          "p-2 rounded-full border flex items-center justify-center transition-all active:scale-95",
                          elementSelectMode
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/50"
                        )}
                        title={isRTL ? 'تحريرات مرئية' : 'Visual edits'}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      
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
                  </div>
                  
                  <div className="relative flex flex-col gap-2">
                    {/* Attached Images Preview */}
                    {attachedImages.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 px-2">
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
                        {/* Smart "Images ready" indicator */}
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all",
                          isUploadingAttachedImages 
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        )}>
                          {isUploadingAttachedImages ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>{isRTL ? 'جاري الرفع...' : 'Uploading...'}</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              <span>
                                {attachedImages.length} {isRTL 
                                  ? (attachedImages.length === 1 ? 'صورة جاهزة' : 'صور جاهزة') 
                                  : (attachedImages.length === 1 ? 'image ready' : 'images ready')
                                }
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <form data-chat-form onSubmit={handleChatSubmit} className={cn(
                      "flex items-end gap-2 bg-muted/30 dark:bg-white/5 border rounded-2xl p-1.5 transition-all",
                      leftPanelMode === 'chat'
                        ? "border-emerald-500/40 dark:border-emerald-500/30 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20"
                        : "border-blue-600/40 dark:border-blue-600/30 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600/20"
                    )}>
                      <Textarea
                        data-chat-input
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
                          {/* Upload Files Button (Images + PDFs) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (imageInputRef.current) {
                                imageInputRef.current.value = '';
                                imageInputRef.current.click();
                              }
                            }}
                            className={cn(
                              "h-6 w-6 rounded-md border flex items-center justify-center transition-all active:scale-90",
                              attachedImages.length > 0
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-500 hover:bg-indigo-500/30"
                                : "bg-muted/50 dark:bg-white/5 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title={isRTL ? 'رفع صور أو PDF' : 'Upload images or PDF'}
                          >
                            <Paperclip className="h-3 w-3" />
                          </button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            multiple
                            onChange={handleImageSelect}
                            className="hidden"
                            aria-label={isRTL ? 'رفع صور أو PDF' : 'Upload images or PDF'}
                          />
                          
                          {/* AMP Button - Amplify/Enhance prompt with project context */}
                          <button
                            type="button"
                            disabled={!chatInput.trim() || isAmplifying || aiEditing}
                            onClick={async () => {
                              if (!chatInput.trim()) return;
                              setIsAmplifying(true);
                              try {
                                // Send files to AMP so it can find LIKELY FILES
                                const response = await supabase.functions.invoke('projects-amp-prompt', {
                                  body: { 
                                    prompt: chatInput, 
                                    mode: leftPanelMode,
                                    files: leftPanelMode === 'code' ? generatedFiles : undefined
                                  }
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
                          type={aiEditing || isGenerating ? "button" : "submit"}
                          data-chat-submit
                          disabled={!chatInput.trim() && !aiEditing && !isGenerating}
                          onClick={aiEditing || isGenerating ? stopGeneration : undefined}
                          size="icon"
                          className={cn(
                            "h-[40px] w-[40px] rounded-xl transition-all shrink-0 shadow-sm text-white",
                            aiEditing || isGenerating
                              ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                              : chatInput.trim() 
                                ? (leftPanelMode === 'chat' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20")
                                : "bg-muted dark:bg-white/10 text-muted-foreground"
                          )}
                          title={aiEditing || isGenerating ? (isRTL ? 'إيقاف التوليد' : 'Stop generation') : (isRTL ? 'إرسال' : 'Send')}
                        >
                          {aiEditing || isGenerating ? (
                            <Square className="h-4 w-4 fill-current" />
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

        {/* Divider - Draggable (desktop/tablet only) */}
        {typeof window !== 'undefined' && window.innerWidth >= 768 && (
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1.5 bg-border/40 hover:bg-indigo-500/60 transition-all duration-200 z-[60] cursor-col-resize",
              isDraggingDivider && "bg-indigo-500/80 shadow-lg shadow-indigo-500/40"
            )}
            style={{ left: `${leftPanelWidth}px` }}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onPointerCancel={handleDividerPointerUp}
            title={isRTL ? 'اسحب لتغيير العرض' : 'Drag to resize'}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="w-5 h-5 bg-indigo-500/60 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M7 16l4-4-4-4M17 16l-4-4 4-4" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Right Panel - Studio Canvas */}
        <div className={cn(
          "flex-1 flex flex-col bg-[#0c0f14] relative",
          mobileTab === 'chat' ? "hidden md:flex" : "flex w-full",
          "h-full max-h-full overflow-hidden"
        )}>
          {/* Project Info Bar - Back, Name, Status - STICKY at top */}
          <div className="flex items-center gap-3 px-4 py-0 h-[56px] bg-gradient-to-r from-zinc-900 to-zinc-900/90 border-b border-white/10 shrink-0 sticky top-0 z-[100]">
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

          {/* Preview/Code Content - Full Height - ONLY IFRAME SCROLLS */}
          <div className="flex-1 min-h-0 sandpack-preview-container relative overflow-hidden">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              </div>
            }>
              {(codeContent || Object.keys(generatedFiles).length > 0) ? (
                <div className="w-full h-full relative">
                  <MatrixOverlay isVisible={aiEditing} />
                  <div className={cn(
                    "h-full w-full transition-all flex flex-col overflow-hidden mx-auto",
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
                      isRTL={isRTL}
                      onElementSelect={(ref, elementInfo) => {
                        if (elementInfo) {
                          setSelectedElementInfo(elementInfo);
                          setShowElementEditPopover(true); // Show edit popover immediately
                        }
                        setElementSelectMode(false);
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
            
            {/* Visual Edit Mode Active Banner - thin top bar, no gradient fill */}
            {elementSelectMode && (
              <div className="absolute top-[56px] left-0 right-0 h-10 bg-indigo-600/90 backdrop-blur-sm text-white px-4 text-xs flex items-center justify-between z-50 shadow-md pointer-events-none">
                <span className="flex items-center gap-2 font-medium">
                  <MousePointer2 className="h-3.5 w-3.5 animate-pulse" />
                  {isRTL ? 'وضع التحرير المرئي - انقر على عنصر لتحريره' : 'Visual Edit Mode - Click an element to edit'}
                </span>
                <button 
                  onClick={() => setElementSelectMode(false)}
                  className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            
            {/* Selected Element Floating Bar - Only show when not in popover mode */}
            {selectedElementInfo && !showElementEditPopover && (
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
                  onClick={() => setShowElementEditPopover(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {isRTL ? 'تحرير' : 'Edit'}
                </button>
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
                {project?.subdomain 
                  ? (isRTL ? 'تحديث المشروع' : 'Update Project')
                  : (isRTL ? 'نشر المشروع' : 'Publish Project')
                }
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {project?.subdomain 
                  ? (isRTL ? 'سيتم تحديث موقعك الحالي' : 'Your existing site will be updated')
                  : (isRTL ? 'اختر اسم موقعك الفريد' : 'Choose your unique site name')
                }
              </p>
            </div>

            {/* Subdomain Input */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                {isRTL ? 'اسم الموقع' : 'Site Name'}
                {project?.subdomain && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    ({isRTL ? 'مُقفل' : 'Locked'})
                  </span>
                )}
              </label>
              <div className={`flex items-center gap-0 rounded-xl border overflow-hidden ${
                project?.subdomain 
                  ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50' 
                  : 'border-zinc-300 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-indigo-500/50'
              }`}>
                <input
                  type="text"
                  value={subdomainInput}
                  onChange={(e) => !project?.subdomain && handleSubdomainChange(e.target.value)}
                  placeholder={isRTL ? 'my-app' : 'my-app'}
                  className={`flex-1 px-4 py-3 text-base focus:outline-none ${
                    project?.subdomain 
                      ? 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 cursor-not-allowed' 
                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400'
                  }`}
                  autoFocus={!project?.subdomain}
                  maxLength={30}
                  readOnly={!!project?.subdomain}
                  disabled={!!project?.subdomain}
                />
                <span className="px-3 py-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium border-l border-zinc-300 dark:border-zinc-600">
                  .wakti.ai
                </span>
              </div>
              
              {/* Locked notice for existing subdomain */}
              {project?.subdomain && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 flex-shrink-0" />
                    {isRTL 
                      ? 'لا يمكن تغيير اسم الموقع بعد النشر الأول'
                      : 'Site name cannot be changed after first publish'
                    }
                  </p>
                </div>
              )}
              
              {/* First-time warning */}
              {!project?.subdomain && subdomainInput && !subdomainError && (
                <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    {isRTL 
                      ? 'تنبيه: لا يمكن تغيير اسم الموقع بعد النشر الأول'
                      : 'Note: You can only choose the site name once. It cannot be changed later.'
                    }
                  </p>
                </div>
              )}
              
              {/* Error message */}
              {subdomainError && !project?.subdomain && (
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
                    {project?.subdomain 
                      ? (isRTL ? 'تحديث' : 'Update')
                      : (isRTL ? 'نشر' : 'Publish')
                    }
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stock Photo Selector Modal */}
      {showStockPhotoSelector && (
        <StockPhotoSelector
          userId={user?.id || ''}
          projectId={id}
          onSelectPhoto={handleStockPhotoSelect}
          onSelectPhotos={handleStockPhotosSelect}
          multiSelect={photoSelectorMultiSelect || isChangingCarouselImages}
          onClose={() => setShowStockPhotoSelector(false)}
          searchTerm={photoSearchTerm}
          initialTab={photoSelectorInitialTab}
          showOnlyUserPhotos={photoSelectorShowOnlyUserPhotos}
        />
      )}

      {/* Smart Media Manager Modal */}
      {showSmartMediaManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <SmartMediaManager
            projectId={id || ''}
            generatedFiles={generatedFiles}
            initialTab={smartMediaInitialTab}
            isRTL={isRTL}
            onInsertImage={(url, alt) => {
              // Insert image into the site code - auto-send the prompt
              const insertPrompt = isRTL 
                ? `أضف هذه الصورة إلى الموقع: ${url}\nوصف الصورة: ${alt || 'صورة'}`
                : `Add this image to the site: ${url}\nImage description: ${alt || 'Image'}`;
              setShowSmartMediaManager(false);
              // Auto-send the message to trigger AI insertion
              setChatInput(insertPrompt);
              requestAnimationFrame(() => {
                const form = document.querySelector('form[class*="flex items-end gap-2"]') as HTMLFormElement;
                if (form) {
                  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
              });
            }}
            onClose={() => setShowSmartMediaManager(false)}
          />
        </div>
      )}

      {/* Image Source Buttons are now rendered inline in chat messages */}

      {/* Clarifying Questions Modal */}
      <ClarifyingQuestionsModal
        isOpen={showClarifyingQuestions}
        onClose={() => setShowClarifyingQuestions(false)}
        questions={clarifyingQuestions}
        onComplete={(answers) => {
          const enhancedPrompt = buildPromptWithAnswers(pendingPrompt, answers);
          setChatInput(enhancedPrompt);
          setShowClarifyingQuestions(false);
          setPendingPrompt('');
          setClarifyingQuestions([]);
        }}
        onSkip={() => {
          setChatInput(pendingPrompt);
          setShowClarifyingQuestions(false);
          setPendingPrompt('');
          setClarifyingQuestions([]);
        }}
        isRTL={isRTL}
      />

      {/* Migration Approval Dialog */}
      <MigrationApprovalDialog
        isOpen={showMigrationApproval}
        onClose={() => setShowMigrationApproval(false)}
        onApprove={() => {
          // Execute the pending migration
          if (pendingMigration) {
            toast.success(isRTL ? 'تم الموافقة على الترحيل' : 'Migration approved');
          }
          setShowMigrationApproval(false);
          setPendingMigration(null);
        }}
        onCancel={() => {
          setShowMigrationApproval(false);
          setPendingMigration(null);
        }}
        migrationTitle={pendingMigration?.title || ''}
        migrationTitleAr={pendingMigration?.titleAr}
        sqlPreview={pendingMigration?.sqlPreview || ''}
        description={pendingMigration?.description}
        descriptionAr={pendingMigration?.descriptionAr}
        onAlwaysAllowChange={(value) => setAlwaysAllowMigrations(value)}
        isRTL={isRTL}
      />

      {/* Element Edit Popover - Visual Edits */}
      {showElementEditPopover && selectedElementInfo && (
        <ElementEditPopover
          element={selectedElementInfo}
          onClose={() => {
            setShowElementEditPopover(false);
            setSelectedElementInfo(null);
          }}
          onDirectEdit={(changes) => {
            // Handle direct image URL change - NO AI needed!
            if (changes.imageUrl) {
              const currentCode = generatedFiles['/App.js'] || '';
              const className = selectedElementInfo.className?.split(' ')[0];
              const tag = selectedElementInfo.tagName.toLowerCase();
              
              // Pattern to find and replace img src
              let newCode = currentCode;
              let replaced = false;
              
              // Try to find img element with matching class
              if (className) {
                const imgClassPattern = new RegExp(
                  `(<img[^>]*?(?:className|class)=["'][^"']*${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["'][^>]*?src=)(["'])([^"']+)(\\2)`,
                  'g'
                );
                newCode = newCode.replace(imgClassPattern, (match, prefix, quote, oldUrl, endQuote) => {
                  replaced = true;
                  return `${prefix}${quote}${changes.imageUrl}${endQuote}`;
                });
              }
              
              // Fallback: try simple img src replacement based on context
              if (!replaced && tag === 'img') {
                // If we have the opening tag, try to find it
                const openingTag = selectedElementInfo.openingTag;
                if (openingTag && openingTag.includes('src=')) {
                  const srcMatch = openingTag.match(/src=["']([^"']+)["']/);
                  if (srcMatch) {
                    const oldSrc = srcMatch[1];
                    newCode = newCode.replace(
                      new RegExp(`src=["']${oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
                      `src="${changes.imageUrl}"`
                    );
                    replaced = newCode !== currentCode;
                  }
                }
              }
              
              if (replaced) {
                // Push current state to history before applying changes
                visualEditHistory.pushState(generatedFiles, isRTL ? 'تحديث الصورة' : 'Image update');
                setGeneratedFiles(prev => ({ ...prev, '/App.js': newCode }));
                setCodeContent(newCode);
                toast.success(isRTL ? 'تم تحديث الصورة!' : 'Image updated!');
              } else {
                // Fallback: send to AI if direct replacement fails
                const contextPrompt = `Change the image src in the ${selectedElementInfo.tagName} element${className ? ` with class "${className}"` : ''} to: ${changes.imageUrl}`;
                setChatInput(contextPrompt);
                toast.info(isRTL ? 'اضغط إرسال للتطبيق' : 'Press send to apply');
              }
              
              setShowElementEditPopover(false);
              setSelectedElementInfo(null);
              return;
            }
            
            // Apply direct edits to the code - NO AI PROMPTS, NO CREDITS!
            // FIX A: Try ALL code files (multi-file projects), not just /App.js
            const candidatePaths = Object.keys(generatedFiles).filter((p) =>
              /\.(jsx?|tsx?)$/.test(p)
            );
            // Prefer /App.js first if it exists, then the rest
            candidatePaths.sort((a, b) => (a === '/App.js' ? -1 : b === '/App.js' ? 1 : 0));

            let applied = false;
            let appliedPath: string | null = null;
            let result: { success: boolean; code: string; message: string } | null = null;

            for (const path of candidatePaths) {
              const currentCode = generatedFiles[path] || '';
              const attempt = applyDirectEdits(currentCode, selectedElementInfo, changes);

              if (attempt.success && validateJSX(attempt.code)) {
                applied = true;
                appliedPath = path;
                result = attempt;
                console.log('[Visual Edit] Found element in:', path);
                break;
              }
            }

            if (applied && appliedPath && result) {
              visualEditHistory.pushState(generatedFiles, result.message);

              const newFiles = {
                ...generatedFiles,
                [appliedPath]: result.code,
              };

              setGeneratedFiles(newFiles);

              // Keep editor content in sync ONLY if we edited /App.js
              if (appliedPath === '/App.js') {
                setCodeContent(result.code);
              }

              // AUTO-SAVE: Persist changes immediately to database
              const finalResult = result; // capture for async
              (async () => {
                try {
                  const rows = Object.entries(newFiles).map(([path, content]) => ({
                    project_id: id,
                    path,
                    content,
                  }));

                  await (supabase
                    .from('project_files' as any)
                    .upsert(rows, { onConflict: 'project_id,path' }) as any);

                  toast.success(
                    isRTL
                      ? `✓ تم الحفظ: ${finalResult.message}`
                      : `✓ Saved: ${finalResult.message}`
                  );
                } catch (err) {
                  console.error('[Visual Edit] Auto-save failed:', err);
                  toast.warning(
                    isRTL
                      ? `تم التطبيق: ${finalResult.message} (اضغط حفظ يدوياً)`
                      : `Applied: ${finalResult.message} (click Save to persist)`
                  );
                }
              })();
            } else {
              // Direct edit failed on ALL files: do NOT auto-generate an AI prompt.
              console.warn('[Visual Edit] Could not find element in any file. Tried:', candidatePaths);
              toast.error(
                isRTL
                  ? 'تعذر تطبيق التعديل مباشرة. جرّب اختيار عنصر آخر أو استخدم "تعديل بالذكاء الاصطناعي".'
                  : 'Could not apply this direct edit. Try selecting a different element or use "Edit with AI".'
              );
            }
            
            setShowElementEditPopover(false);
            setSelectedElementInfo(null);
          }}
          onImageChange={() => {
            // Detect if this is a carousel/gallery (multi-image) context
            const className = selectedElementInfo?.className || '';
            const openingTag = selectedElementInfo?.openingTag || '';
            const isMultiImageContext = /carousel|slider|swiper|slick|embla|gallery|grid.*image|photo.*grid/i.test(className + ' ' + openingTag);
            
            if (isMultiImageContext) {
              // Carousel/Gallery: enable multi-select
              setIsChangingCarouselImages(true);
              setPhotoSelectorMultiSelect(true);
            } else {
              // Single image replacement
              setPendingElementImageEdit({
                elementInfo: selectedElementInfo,
                originalPrompt: 'Replace image'
              });
              setPhotoSelectorMultiSelect(false);
            }
            
            setPhotoSelectorInitialTab('stock');
            setShowStockPhotoSelector(true);
            setShowElementEditPopover(false);
            // Don't clear selectedElementInfo - we need it for the image replacement
          }}
          onAIEdit={(prompt) => {
            // Detect image-related requests
            const imageKeywords = /\b(image|photo|picture|background|img|صورة|صور|خلفية)\b/i;
            const changeToPattern = /\b(change|replace|swap|switch|update|set|make|add|use|غير|غيّر|بدل|استبدل|استخدم)\b.*?\b(to|with|of|into|as|إلى|ب)\b\s*(.+)/i;
            const imageOfPattern = /\b(image|photo|picture|صورة|صور)\s*(of|about|for|عن|من)\s*(.+)/i;

            const isImageRequest = imageKeywords.test(prompt);
            const changeMatch = prompt.match(changeToPattern);
            const imageOfMatch = prompt.match(imageOfPattern);

            // If user is editing a carousel/gallery and asks to change images (plural), enable multi-select
            const selClass = selectedElementInfo?.className || '';
            const selTag = selectedElementInfo?.openingTag || '';
            const isMultiImageContext = /carousel|slider|swiper|slick|embla|gallery|grid.*image|photo.*grid/i.test(selClass + ' ' + selTag);
            const wantsMultiFromPrompt = /\b(images|photos|pictures|slides)\b/i.test(prompt) || /(?:غير\s*الصور|تغيير\s*الصور|صور)/i.test(prompt);

            if (isMultiImageContext && wantsMultiFromPrompt) {
              setIsChangingCarouselImages(true);
              setPhotoSearchTerm(''); // Start fresh - user searches manually
              setPhotoSelectorInitialTab('stock');
              setPhotoSelectorMultiSelect(true);
              setShowStockPhotoSelector(true);
              setShowElementEditPopover(false);
              return;
            }

            // Extract search term from the prompt
            let searchTerm = '';
            if (changeMatch && changeMatch[3]) {
              searchTerm = changeMatch[3].trim().replace(/[.!?]+$/, '');
            } else if (imageOfMatch && imageOfMatch[3]) {
              searchTerm = imageOfMatch[3].trim().replace(/[.!?]+$/, '');
            } else if (isImageRequest) {
              // Try to extract subject from prompt
              const words = prompt.split(/\s+/).filter(w => 
                !['change', 'replace', 'image', 'photo', 'picture', 'to', 'with', 'the', 'a', 'an', 'of', 'add', 'use', 'set', 'make'].includes(w.toLowerCase())
              );
              searchTerm = words.slice(0, 3).join(' ');
            }

            if (isImageRequest && searchTerm) {
              // Store the element info and open Freepik selector (single-image replacement)
              setPendingElementImageEdit({
                elementInfo: selectedElementInfo,
                originalPrompt: prompt
              });
              setPhotoSearchTerm(''); // Start fresh - user searches manually
              setPhotoSelectorInitialTab('stock');
              setPhotoSelectorMultiSelect(false); // Single select for element replacement
              setShowStockPhotoSelector(true);
              setShowElementEditPopover(false);
              // Don't clear selectedElementInfo yet - we need it for the image replacement
              return;
            }

            // Non-image request: proceed with AI edit as before
            const contextPrompt = `For the ${selectedElementInfo.tagName} element ${selectedElementInfo.className ? `with class "${selectedElementInfo.className.split(' ')[0]}"` : ''} containing "${selectedElementInfo.innerText.substring(0, 50)}...": ${prompt}`;
            setChatInput(contextPrompt);
            setShowElementEditPopover(false);
            setSelectedElementInfo(null);
          }}
          isRTL={isRTL}
          canUndo={visualEditHistory.canUndo}
          canRedo={visualEditHistory.canRedo}
          onUndo={() => {
            const previousFiles = visualEditHistory.undo();
            if (previousFiles) {
              setGeneratedFiles(previousFiles);
              setCodeContent(previousFiles['/App.js'] || '');
              toast.info(isRTL ? 'تم التراجع' : 'Undone');
            }
          }}
          onRedo={() => {
            const nextFiles = visualEditHistory.redo();
            if (nextFiles) {
              setGeneratedFiles(nextFiles);
              setCodeContent(nextFiles['/App.js'] || '');
              toast.info(isRTL ? 'تم الإعادة' : 'Redone');
            }
          }}
        />
      )}
      </>
      )}
    </div>
  );
}
