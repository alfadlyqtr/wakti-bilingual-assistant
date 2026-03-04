// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
const ChatbotDesigner = lazy(() => import('@/components/chatbot/ChatbotDesigner'));
const ChatbotAISettings = lazy(() => import('@/components/chatbot/ChatbotAISettings'));
const ChatbotWidget = lazy(() => import('@/pages/ChatbotWidget'));
import SharedInboxUI from '@/components/chatbot/SharedInboxUI';
import KnowledgeBaseEditor from '@/components/chatbot/KnowledgeBaseEditor';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Bot,
  Globe,
  Instagram,
  Loader2,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Eye,
  Power,
  Copy,
  Check,
  X,
  Search,
  Pencil,
  MessageSquare,
  Users,
  ShoppingBag,
  CalendarCheck,
  HelpCircle,
  Code2,
  Inbox,
  Settings,
  Zap,
  Send,
  Clock,
  ChevronRight,
  Filter,
  RefreshCw,
  LayoutGrid,
  Eraser,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  ChatbotBot,
  ChatbotService,
  NODE_TYPE_META,
  PURPOSE_TEMPLATES,
  FlowNodeType,
} from '@/services/chatbotService';

// ============================================
// INSTAGRAM OAUTH CONFIG
// ============================================
const META_APP_ID = '933004952787021';
const IG_OAUTH_CALLBACK_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/instagram-oauth-callback';
const IG_OAUTH_SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';

function buildInstagramOAuthUrl(botId: string, origin: string): string {
  const state = btoa(JSON.stringify({ bot_id: botId, origin }));
  return `https://www.instagram.com/oauth/authorize?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(IG_OAUTH_CALLBACK_URL)}&scope=${encodeURIComponent(IG_OAUTH_SCOPES)}&state=${encodeURIComponent(state)}&response_type=code&enable_fb_login=0&force_authentication=0`;
}

// ============================================
// RATING OPTIONS (fixed, not editable)
// ============================================
const RATING_OPTIONS = [
  { label: 'Terrible', labelAr: 'سيء جداً', emoji: '😡' },
  { label: 'Bad',      labelAr: 'سيء',      emoji: '😞' },
  { label: 'OK OK',    labelAr: 'مقبول',    emoji: '😐' },
  { label: 'Good',     labelAr: 'جيد',      emoji: '😊' },
  { label: 'Awesome',  labelAr: 'رائع',     emoji: '😄' },
];

// ============================================
// CUSTOM FLOW NODE COMPONENT
// ============================================
function ChatFlowNode({ data }: any) {
  const meta = NODE_TYPE_META[data.flowType as FlowNodeType];
  if (!meta) return null;

  const isStart = data.flowType === 'start';
  const isEnd = data.flowType === 'end';
  const isChoice = data.flowType === 'single_choice' || data.flowType === 'multiple_choice';
  const isRating = data.flowType === 'rating';
  const options: any[] = isChoice && data.options ? data.options : [];

  return (
    <div
      className="relative rounded-2xl border-2 shadow-lg min-w-[220px] max-w-[260px] bg-white dark:bg-zinc-900"
      style={{ borderColor: meta.color + '60' }}
    >
      {/* Delete button */}
      {!isStart && data.onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete(data.nodeId); }}
          title="Delete node"
          className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors duration-150 shadow-sm"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 text-white font-bold pr-10 rounded-t-2xl"
        style={{ background: meta.color }}
      >
        <span className="text-base">{meta.icon}</span>
        <span className="text-sm truncate">{data.label || meta.label}</span>
      </div>

      {/* Body — tap to edit */}
      <div
        className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors active:bg-zinc-100 dark:active:bg-zinc-800 min-h-[36px]"
        onClick={() => data.onEdit && data.onEdit(data)}
      >
        <span>{data.text || data.prompt || meta.description}</span>
      </div>

      {/* Choice options — each row has its own source handle */}
      {isChoice && options.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          {options.map((opt: any, i: number) => {
            const label = typeof opt === 'string' ? opt : opt.en || opt.ar || `Option ${i + 1}`;
            return (
              <div
                key={i}
                className="relative flex items-center px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 last:rounded-b-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 pr-6"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2" style={{ background: meta.color }} />
                <span className="truncate">{label}</span>
                {/* Per-option source handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option-${i}`}
                  className="!w-3 !h-3 !border-2 !border-white dark:!border-zinc-900 !right-[-6px]"
                  style={{ background: meta.color, position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Rating options — fixed 5 rows */}
      {isRating && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          {RATING_OPTIONS.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 last:rounded-b-2xl"
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-base leading-none">{r.emoji}</span>
            </div>
          ))}
        </div>
      )}

      {/* Target handle (left) */}
      {!isStart && (
        <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-zinc-400 !border-2 !border-white dark:!border-zinc-900" />
      )}

      {/* Source handle (right) — for all non-choice, non-end nodes (including rating) */}
      {!isEnd && !isChoice && (
        <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-zinc-900" style={{ background: meta.color }} />
      )}

      {/* Quick-add + button — for all non-choice, non-end tail nodes (including rating) */}
      {!isEnd && !isChoice && data.onQuickAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onQuickAdd(data.nodeId); }}
          title="Add component after"
          className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md transition-all hover:scale-110 active:scale-95 z-20"
          style={{ background: meta.color }}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

const nodeTypes = { chatFlowNode: ChatFlowNode };

// Inner toolbar — must live inside ReactFlow context to use useReactFlow
function CanvasToolbar({ onAutoArrange, onClearFlow, isRTL }: { onAutoArrange: () => void; onClearFlow: () => void; isRTL: boolean }) {
  const { zoomIn, zoomOut, zoomTo, getZoom } = useReactFlow();
  const [zoom, setZoom] = React.useState(1);
  React.useEffect(() => { setZoom(getZoom()); }, [getZoom]);
  const handleZoom = (val: number) => { zoomTo(val); setZoom(val); };
  return (
    <Panel position="top-center">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-white/95 dark:bg-zinc-900/95 shadow-lg backdrop-blur-sm">
        {/* Zoom out */}
        <button onClick={() => { zoomOut(); setZoom(Math.max(0.2, zoom - 0.2)); }} title="Zoom out" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        {/* Zoom slider */}
        <input
          type="range" min={0.2} max={2} step={0.05}
          value={zoom}
          onChange={(e) => handleZoom(Number(e.target.value))}
          title={`Zoom: ${Math.round(zoom * 100)}%`}
          className="w-24 h-1.5 accent-[#060541] dark:accent-white cursor-pointer"
        />
        {/* Zoom in */}
        <button onClick={() => { zoomIn(); setZoom(Math.min(2, zoom + 0.2)); }} title="Zoom in" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-border/60 mx-0.5" />
        {/* Auto-arrange */}
        <button onClick={onAutoArrange} title={isRTL ? 'ترتيب تلقائي' : 'Auto Layout'} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isRTL ? 'ترتيب' : 'Auto Layout'}</span>
        </button>
        {/* Clear flow */}
        <button onClick={onClearFlow} title={isRTL ? 'مسح التدفق' : 'Clear Bot Flow'} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Eraser className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isRTL ? 'مسح' : 'Clear Flow'}</span>
        </button>
      </div>
    </Panel>
  );
}

// ============================================
// PURPOSE CARDS DATA
// ============================================
const PURPOSES = [
  {
    id: 'leads',
    icon: Users,
    label: 'Get More Leads',       labelAr: 'احصل على عملاء',
    desc: 'Collect visitor info and grow your list', descAr: 'اجمع بيانات الزوار ووسّع قائمتك',
    bannerGradient: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
    bannerEmojis: ['🧨', '⚡', '👥', '📊'],
    bannerBg: '#bfdbfe',
    bg: 'bg-[#060541] dark:bg-white', text: 'text-white dark:text-[#060541]',
  },
  {
    id: 'support',
    icon: HelpCircle,
    label: 'Customer Support',     labelAr: 'دعم العملاء',
    desc: 'Answer questions and resolve issues', descAr: 'أجب على الأسئلة وحل المشاكل',
    bannerGradient: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
    bannerEmojis: ['🤖', '💬', '✅', '🌟'],
    bannerBg: '#bbf7d0',
    bg: 'bg-[#060541] dark:bg-white', text: 'text-white dark:text-[#060541]',
  },
  {
    id: 'sales',
    icon: ShoppingBag,
    label: 'Sell Products',         labelAr: 'بيع المنتجات',
    desc: 'Showcase products and drive sales', descAr: 'اعرض المنتجات وزد المبيعات',
    bannerGradient: 'linear-gradient(135deg, #fef9c3 0%, #fefce8 100%)',
    bannerEmojis: ['🛍️', '💰', '🏷️', '🔥'],
    bannerBg: '#fde68a',
    bg: 'bg-[#060541] dark:bg-white', text: 'text-white dark:text-[#060541]',
  },
  {
    id: 'booking',
    icon: CalendarCheck,
    label: 'Appointment Booking',   labelAr: 'حجز مواعيد',
    desc: 'Let customers book appointments', descAr: 'دع العملاء يحجزون مواعيد',
    bannerGradient: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
    bannerEmojis: ['📅', '⏰', '📍', '🔔'],
    bannerBg: '#a7f3d0',
    bg: 'bg-[#060541] dark:bg-white', text: 'text-white dark:text-[#060541]',
  },
  {
    id: 'other',
    icon: Zap,
    label: 'Other',                 labelAr: 'أخرى',
    desc: 'Custom chatbot for any purpose', descAr: 'بوت مخصص لأي غرض',
    bannerGradient: 'linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)',
    bannerEmojis: ['✈️', '🎓', '🏥', '💊'],
    bannerBg: '#fbcfe8',
    bg: 'bg-[#060541] dark:bg-white', text: 'text-white dark:text-[#060541]',
  },
] as const;

// ============================================
// MAIN COMPONENT
// ============================================
type WizardStep = 'list' | 'platform' | 'instagram-connect' | 'purpose' | 'dashboard' | 'builder' | 'designer' | 'ai-settings';

export default function WaktiAssistant() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const isDark = theme === 'dark';

  // Wizard state
  const [innerTab, setInnerTab] = useState<'bots' | 'inbox' | 'bookings'>('bots');
  const [step, setStep] = useState<WizardStep>('list');
  const [selectedPlatform, setSelectedPlatform] = useState<'website' | 'instagram'>('website');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');

  // Bot list
  const [bots, setBots] = useState<ChatbotBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Active bot (builder mode)
  const [activeBot, setActiveBot] = useState<ChatbotBot | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addComponentSearch, setAddComponentSearch] = useState('');
  const [builderMode, setBuilderMode] = useState<'canvas' | 'classic'>('canvas');
// Classic mode states that are no longer needed
  const [classicSelectedId, setClassicSelectedId] = useState<string | null>(null);
  const [classicInsertAfterIdx, setClassicInsertAfterIdx] = useState<number | null>(null);
  const [classicDragIdx, setClassicDragIdx] = useState<number | null>(null);
  // classicShowMobilePanel removed
  const [showVarMenu, setShowVarMenu] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [editText, setEditText] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [ampLoading, setAmpLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [savingKB, setSavingKB] = useState(false);
  const [editingBotName, setEditingBotName] = useState(false);
  const [botNameDraft, setBotNameDraft] = useState('');
  const [builderRect, setBuilderRect] = useState<{top:number;left:number;right:number;bottom:number} | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Instagram connect flow state (must live at top-level, not inside render function)
  const [igConnecting, setIgConnecting] = useState(false);
  const [igSubStep, setIgSubStep] = useState<'login' | 'select_page'>('login');
  const [igSelectedPage, setIgSelectedPage] = useState<string | null>(null);
  const [igPages, setIgPages] = useState<any[]>([]);
  const [igLongLivedToken, setIgLongLivedToken] = useState<string>('');
  const [igPendingBotId, setIgPendingBotId] = useState<string>('');

  // ─── IG OAUTH RETURN HANDLER ───
  useEffect(() => {
    const handleIgAuthReturn = async () => {
      if (!user) return;
      
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('ig_code');
      const botId = searchParams.get('bot_id');
      const error = searchParams.get('ig_error');

      if (error) {
        toast.error(isRTL ? `حدث خطأ: ${error}` : `Error: ${error}`);
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (code && botId) {
        setIgConnecting(true);
        toast.loading(isRTL ? 'جاري الاتصال بانستقرام...' : 'Connecting Instagram...');
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/instagram-oauth-callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              action: 'exchange_code',
              code,
              bot_id: botId,
              redirect_uri: IG_OAUTH_CALLBACK_URL
            })
          });

          const data = await response.json();
          if (!response.ok || data.error) throw new Error(data.error || 'Failed to exchange token');

          if (data.pages && data.pages.length > 0) {
            setIgPages(data.pages);
            setIgLongLivedToken(data.long_lived_token);
            setIgPendingBotId(botId);
            setIgSubStep('select_page');
            
            // Find bot and set it active so we don't lose context
            const bot = bots.find(b => b.id === botId);
            if (bot) {
              setActiveBot(bot);
              // Wait for React state to update before fetching flow
              setTimeout(() => {
                openBotBuilder(bot).then(() => {
                  setStep('instagram-connect'); // Force back to IG connect view
                });
              }, 100);
            } else {
              setStep('instagram-connect');
            }
            
            toast.dismiss();
            toast.success(isRTL ? 'تم الاتصال! اختر حسابك' : 'Connected! Choose your account');
          } else {
            toast.dismiss();
            toast.error(isRTL ? 'لم يتم العثور على صفحات' : 'No pages found');
          }
        } catch (err: any) {
          console.error('IG Auth error:', err);
          toast.dismiss();
          toast.error(isRTL ? 'فشل الاتصال' : 'Connection failed');
        } finally {
          setIgConnecting(false);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };

    // Make sure we have bots loaded before running the handler
    if (bots.length > 0) {
      handleIgAuthReturn();
    }
  }, [user, bots, isRTL]);

  // When builder opens: measure the scroll container and lock its scroll
  useEffect(() => {
    const el = document.getElementById('projects-scroll');
    if (!el) return;
    const isBuilder = step === 'builder' || step === 'designer' || step === 'ai-settings';
    if (isBuilder) {
      el.classList.add('overflow-hidden');
      document.body.classList.add('chatbot-builder-page');
    } else {
      el.classList.remove('overflow-hidden');
      document.body.classList.remove('chatbot-builder-page');
    }
    if (step === 'builder') {
      const rect = el.getBoundingClientRect();
      setBuilderRect({ top: rect.top, left: rect.left, right: window.innerWidth - rect.right, bottom: 0 });
    } else {
      setBuilderRect(null);
    }
    return () => { document.body.classList.remove('chatbot-builder-page'); };
  }, [step]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }, eds));
  }, [setEdges]);

  // Track showAddMenu in a ref so the effect doesn't re-run when menu opens/closes
  const showAddMenuRef = useRef(false);
  showAddMenuRef.current = showAddMenu;

  // Reactively update onQuickAdd: only on nodes that have no outgoing edge and are not 'end'
  // Skip while add menu is open to prevent flicker
  useEffect(() => {
    if (showAddMenuRef.current) return;
    setNodes((nds: any[]) => nds.map((n: any) => {
      const isTail = n.data.flowType !== 'end' && !(edges as any[]).some((e: any) => e.source === n.id);
      return { ...n, data: { ...n.data, onQuickAdd: isTail ? quickAddAfter : undefined } };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges]);

  // ============================================
  // INSTAGRAM OAUTH RETURN HANDLER
  // ============================================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const igSuccess = params.get('ig_success');
    const igUsername = params.get('ig_username');
    const igError = params.get('ig_error');
    const botId = params.get('bot_id');

    // Clean URL params regardless
    if (igSuccess || igError) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    if (igError) {
      toast.error(isRTL ? 'فشل في ربط انستقرام' : `Instagram connect failed: ${igError}`);
      return;
    }

    if (igSuccess === '1') {
      // Token exchange already done server-side — just show success
      const displayName = igUsername || 'Instagram';
      toast.success(isRTL ? `تم ربط ${displayName} بنجاح! ✅` : `${displayName} connected! ✅`);
      (async () => {
        await fetchBots();
        if (botId) {
          setIgPendingBotId(botId);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    if (user) fetchBots();
  }, [user]);

  const fetchBots = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await ChatbotService.listBots(user.id);
      setBots(data);
    } catch (err) {
      console.error('Failed to fetch bots:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // BOT CREATION
  // ============================================
  const handleCreateBot = async () => {
    if (!user?.id || !selectedPurpose) return;
    setCreating(true);
    try {
      const bot = await ChatbotService.createBot({
        user_id: user.id,
        name: isRTL ? 'بوت جديد' : 'New Bot',
        platform: selectedPlatform,
        purpose: selectedPurpose as any,
      });

      // Save the template flow
      const template = PURPOSE_TEMPLATES[selectedPurpose] || PURPOSE_TEMPLATES.other;
      await ChatbotService.saveFlow(
        bot.id,
        template.nodes.map(n => ({ ...n, bot_id: bot.id })),
        template.edges.map(e => ({ ...e, bot_id: bot.id })),
      );

      setBots(prev => [bot, ...prev]);
      await openBotBuilder(bot);
      toast.success(isRTL ? 'تم إنشاء البوت!' : 'Bot created!');
    } catch (err) {
      console.error('Failed to create bot:', err);
      toast.error(isRTL ? 'فشل في الإنشاء' : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  // ============================================
  // OPEN BOT BUILDER
  // ============================================
  const openBotBuilder = async (bot: ChatbotBot) => {
    setActiveBot(bot);
    setStep('builder');

    try {
      const flow = await ChatbotService.getFlow(bot.id);
      
      // If no nodes returned, create a default start node (like BotPenguin)
      let nodesToRender = flow.nodes;
      if (!nodesToRender || nodesToRender.length === 0) {
        const startNodeId = `start-${Date.now()}`;
        nodesToRender = [{
          node_id: startNodeId,
          type: 'start',
          label: 'Start here',
          data: { text: 'Welcome! How can I help you today?', prompt: '' },
          position_x: 300,
          position_y: 200,
          bot_id: bot.id,
        }];
        // Auto-save this default flow
        await ChatbotService.saveFlow(bot.id, nodesToRender, []);
      }
      
      const rfNodes = nodesToRender.map(n => ({
        id: n.node_id,
        type: 'chatFlowNode',
        position: { x: n.position_x, y: n.position_y },
        data: { ...n.data, flowType: n.type, label: n.label, nodeId: n.node_id, onDelete: deleteNode, onEdit: editNode, onQuickAdd: quickAddAfter },
      }));
      const rfEdges = flow.edges.map(e => ({
        id: e.edge_id,
        source: e.source_node_id,
        target: e.target_node_id,
        sourceHandle: e.source_handle || undefined,
        label: e.label || undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      }));
      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (err) {
      console.error('Failed to load flow:', err);
      // Even on error, create a start node so user sees something
      const startNodeId = `start-${Date.now()}`;
      setNodes([{
        id: startNodeId,
        type: 'chatFlowNode',
        position: { x: 300, y: 200 },
        data: { flowType: 'start', label: 'Start here', text: 'Welcome! How can I help you today?', nodeId: startNodeId, onDelete: deleteNode, onEdit: editNode, onQuickAdd: quickAddAfter },
      }]);
      setEdges([]);
    }
  };

  // ============================================
  // SAVE FLOW
  // ============================================
  const handleSaveFlow = async () => {
    if (!activeBot) return;
    setSaving(true);
    try {
      const flowNodes = nodes.map((n: any) => ({
        bot_id: activeBot.id,
        node_id: n.id,
        type: n.data.flowType,
        label: n.data.label || null,
        data: n.data,
        position_x: n.position.x,
        position_y: n.position.y,
      }));
      const flowEdges = edges.map((e: any) => ({
        bot_id: activeBot.id,
        edge_id: e.id,
        source_node_id: e.source,
        target_node_id: e.target,
        source_handle: e.sourceHandle || null,
        label: e.label || null,
      }));
      await ChatbotService.saveFlow(activeBot.id, flowNodes, flowEdges);
      toast.success(isRTL ? 'تم الحفظ!' : 'Flow saved!');
    } catch (err) {
      console.error('Failed to save flow:', err);
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // ADD NODE
  // ============================================
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n: any) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e: any) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const editNode = useCallback((nodeData: any) => {
    setEditingNode(nodeData);
    setEditText(nodeData.text || nodeData.prompt || '');
    const opts = (nodeData.options || []).map((o: any) => typeof o === 'string' ? o : o.en || '');
    setEditOptions(opts);
  }, []);

  const [quickAddAfterId, setQuickAddAfterId] = useState<string | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(1);

  const quickAddAfter = useCallback((nodeId: string) => {
    setQuickAddAfterId(nodeId);
    setShowAddMenu(true);
    setAddComponentSearch('');
  }, []);

  const autoArrangeNodes = useCallback(() => {
    setNodes((nds: any[]) => {
      const startNode = nds.find((n: any) => n.data.flowType === 'start');
      if (!startNode) return nds;
      const positioned = new Map<string, { x: number; y: number }>();
      const visit = (id: string, x: number, y: number) => {
        if (positioned.has(id)) return;
        positioned.set(id, { x, y });
        const outEdges = (edges as any[]).filter((e: any) => e.source === id);
        outEdges.forEach((e: any, i: number) => visit(e.target, x + 320, y + i * 160));
      };
      visit(startNode.id, 80, 200);
      return nds.map((n: any) => positioned.has(n.id) ? { ...n, position: positioned.get(n.id) } : n);
    });
  }, [edges, setNodes]);

  const clearFlow = useCallback(() => {
    setNodes((nds: any[]) => nds.filter((n: any) => n.data.flowType === 'start'));
    setEdges([]);
  }, [setNodes, setEdges]);

  const saveNodeEdit = (nodeId: string, updates: Record<string, any>) => {
    setNodes((nds) => nds.map((n: any) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    setEditingNode(null);
  };

  const addNode = (type: FlowNodeType) => {
    const meta = NODE_TYPE_META[type];
    const id = `${type}-${Date.now()}`;

    if (builderMode === 'classic') {
      if (classicInsertAfterIdx !== null) {
        insertAtIdx(type, classicInsertAfterIdx);
        return;
      }

      setShowAddMenu(false);
      
      const currentNodes = nodes as any[];
      const currentEdges = edges as any[];

      const findTailId = (): string | null => {
        const startNode = currentNodes.find((n: any) => n.data.flowType === 'start');
        if (!startNode) return currentNodes.length > 0 ? currentNodes[currentNodes.length - 1].id : null;
        const visited = new Set<string>();
        let cur = startNode.id;
        while (cur && !visited.has(cur)) {
          visited.add(cur);
          const nextEdge = currentEdges.find((e: any) => e.source === cur);
          if (!nextEdge) return cur;
          cur = nextEdge.target;
        }
        return startNode.id;
      };

      const tailId = findTailId();
      const tailNode = tailId ? currentNodes.find((n: any) => n.id === tailId) : null;
      
      const newNode = {
        id,
        type: 'chatFlowNode',
        position: tailNode ? { x: tailNode.position.x, y: tailNode.position.y + 160 } : { x: 300, y: 160 },
        data: {
          flowType: type,
          label: meta.label,
          text: '',
          prompt: '',
          nodeId: id,
          onDelete: deleteNode,
          onEdit: editNode,
          onQuickAdd: quickAddAfter,
          options: type === 'single_choice' || type === 'multiple_choice'
            ? [{ en: 'Option 1', ar: 'خيار 1' }, { en: 'Option 2', ar: 'خيار 2' }]
            : undefined,
        },
      };

      setNodes((nds: any[]) => [...nds, newNode]);
      if (tailId) {
        setEdges((eds: any[]) => [...eds, {
          id: `e-${tailId}-${id}`,
          source: tailId,
          target: id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
        }]);
      }

      setTimeout(() => {
        setEditingNode({ nodeId: id, flowType: type, position: {x:0, y:0} });
        setEditText('');
        setEditOptions(type === 'single_choice' || type === 'multiple_choice' ? ['Option 1', 'Option 2'] : []);
      }, 50);
      return;
    }

    // Close menu FIRST to avoid flicker from subsequent setNodes calls
    setShowAddMenu(false);

    // Canvas mode: place after source node if quickAddAfterId set,
    // otherwise find the rightmost tail node automatically
    const currentNodes = nodes as any[];
    const currentEdges = edges as any[];

    let anchorId = quickAddAfterId;
    if (!anchorId) {
      // Find tail node: non-end node with no outgoing edge, pick the rightmost one
      const tailNodes = currentNodes.filter((n: any) =>
        n.data.flowType !== 'end' && !currentEdges.some((e: any) => e.source === n.id)
      );
      if (tailNodes.length > 0) {
        const rightmost = tailNodes.reduce((a: any, b: any) =>
          (b.position?.x ?? 0) > (a.position?.x ?? 0) ? b : a
        );
        anchorId = rightmost.id;
      }
    }

    const sourceNode = anchorId ? currentNodes.find((n: any) => n.id === anchorId) : null;
    const canvasPos = sourceNode
      ? { x: sourceNode.position.x + 320, y: sourceNode.position.y }
      : { x: 300, y: 200 };

    const newNode = {
      id,
      type: 'chatFlowNode',
      position: canvasPos,
      data: {
        flowType: type,
        label: meta.label,
        text: '',
        prompt: '',
        nodeId: id,
        onDelete: deleteNode,
        onEdit: editNode,
        onQuickAdd: quickAddAfter,
        options: type === 'single_choice' || type === 'multiple_choice'
          ? [{ en: 'Option 1', ar: 'خيار 1' }, { en: 'Option 2', ar: 'خيار 2' }]
          : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    // Auto-connect only when triggered from the node's quick-add + button
    if (quickAddAfterId) {
      setEdges((eds: any[]) => {
        if (eds.some((e: any) => e.source === quickAddAfterId && e.target === id)) return eds;
        return [...eds, { id: `e-${quickAddAfterId}-${id}`, source: quickAddAfterId, target: id, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }];
      });
    }
    setQuickAddAfterId(null);
  };

  // ============================================
  // DELETE BOT
  // ============================================
  const handleDeleteBot = async (botId: string) => {
    try {
      await ChatbotService.deleteBot(botId);
      setBots(prev => prev.filter(b => b.id !== botId));
      if (activeBot?.id === botId) {
        setActiveBot(null);
        setStep('list');
      }
      toast.success(isRTL ? 'تم الحذف' : 'Bot deleted');
    } catch (err) {
      toast.error(isRTL ? 'فشل في الحذف' : 'Failed to delete');
    }
  };

  // ============================================
  // TOGGLE BOT ACTIVE
  // ============================================
  const toggleBotActive = async (bot: ChatbotBot) => {
    try {
      await ChatbotService.updateBot(bot.id, { is_active: !bot.is_active });
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, is_active: !b.is_active } : b));
      if (activeBot?.id === bot.id) {
        setActiveBot(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
      }
      toast.success(bot.is_active
        ? (isRTL ? 'تم إيقاف البوت' : 'Bot deactivated')
        : (isRTL ? 'تم تفعيل البوت!' : 'Bot activated!'));
    } catch (err) {
      toast.error(isRTL ? 'حدث خطأ' : 'Something went wrong');
    }
  };

  // ============================================
  // COPY EMBED CODE
  // ============================================
  const copyEmbedCode = (token: string) => {
    const baseUrl = window.location.origin;
    const code = `<!-- Wakti AI Chatbot -->
<script>
(function(){
  var iframe=document.createElement('iframe');
  iframe.src='${baseUrl}/chat/${token}';
  iframe.style='position:fixed;bottom:0;right:0;width:380px;height:620px;max-width:100vw;max-height:100vh;border:none;z-index:99999;border-radius:16px 16px 0 0;box-shadow:0 8px 40px rgba(0,0,0,0.18)';
  iframe.allow='microphone';
  document.body.appendChild(iframe);
})();
</script>`;
    navigator.clipboard.writeText(code);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
    toast.success(isRTL ? 'تم النسخ!' : 'Embed code copied!');
  };

  // ============================================
  // RENDER: BOT LIST
  // ============================================
  const renderBotList = () => (
    <div className="container mx-auto p-3 max-w-4xl">

      {/* ── Tab Switcher — above header ── */}
      <div className="flex justify-center mb-4">
        <div
          className="relative inline-flex items-center p-1 rounded-full"
          style={{
            background: 'var(--muted)',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {([
            { key: 'bots',     label: isRTL ? 'البوتات'  : 'Bots'     },
            { key: 'inbox',    label: isRTL ? 'الوارد'   : 'Inbox'    },
            { key: 'bookings', label: isRTL ? 'الحجوزات' : 'Bookings' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setInnerTab(key)}
              className={cn(
                'relative z-10 px-6 py-2 text-[12px] font-bold tracking-wide transition-colors duration-300 rounded-full',
                innerTab === key
                  ? 'text-white dark:text-[#060541]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {innerTab === key && (
                <motion.div
                  layoutId="waktiInnerTab"
                  className="absolute inset-0 rounded-full bg-[#060541] dark:bg-white"
                  style={{
                    boxShadow: '0 4px 12px rgba(6,5,65,0.35), 0 2px 4px rgba(6,5,65,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Page Header — matches Wakti style ── */}
      <div className="glass-hero px-5 py-4 mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#060541]/10 dark:bg-white/10 text-[#060541] dark:text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {isRTL ? 'بوتات الذكاء الاصطناعي' : 'AI Chat Bots'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'أنشئ وأدر بوتاتك' : 'Build and manage your bots'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setStep('platform')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#060541] dark:bg-white text-white dark:text-[#060541] hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {isRTL ? 'بوت جديد' : 'New Bot'}
        </button>
      </div>

      {/* ══ CONTENT AREA ══ */}
      <div>

          {/* ── BOTS TAB ── */}
          {innerTab === 'bots' && (
            <motion.div key="bots" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }}>
              {loading ? (
                <div className="flex items-center justify-center py-32">
                  <Loader2 className="h-6 w-6 animate-spin text-[#060541]/30 dark:text-white/30" />
                </div>
              ) : bots.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[#060541]/8 dark:bg-white/8 mb-5">
                    <Bot className="h-8 w-8 text-[#060541] dark:text-white/70" />
                  </div>
                  <h2 className="text-lg font-semibold mb-1">
                    {isRTL ? 'لا توجد بوتات بعد' : 'No bots yet'}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                    {isRTL ? 'أنشئ أول بوت ذكاء اصطناعي لموقعك أو انستقرام' : 'Create your first AI chatbot for your website or Instagram'}
                  </p>
                  <button
                    onClick={() => setStep('platform')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#060541] dark:bg-white text-white dark:text-[#060541] hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    {isRTL ? 'إنشاء أول بوت' : 'Create Your First Bot'}
                  </button>
                  <div className="grid grid-cols-3 gap-3 mt-10 w-full max-w-sm">
                    {[
                      { icon: Globe,     label: isRTL ? 'موقعك'    : 'Website'   },
                      { icon: Instagram, label: 'Instagram'                       },
                      { icon: Zap,       label: isRTL ? 'بدون كود' : 'No Code'   },
                    ].map(({ icon: Icon, label }, i) => (
                      <div key={i} className="glass-hero rounded-xl p-3 flex flex-col items-center gap-1.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── BOT CARDS ── */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bots.map(bot => (
                    <div
                      key={bot.id}
                      className="group relative rounded-2xl bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/8 hover:border-[#060541]/20 dark:hover:border-white/15 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                      onClick={() => { setActiveBot(bot); setKnowledgeBase(bot.knowledge_base || ''); setStep('dashboard'); }}
                    >
                      <div 
                        className={cn("h-[3px]", bot.platform === 'instagram' ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600" : "")} 
                        style={bot.platform !== 'instagram' ? { background: bot.primary_color || '#060541' } : undefined} 
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm",
                              bot.platform === 'instagram' 
                                ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white" 
                                : "bg-[#060541]/6 dark:bg-white/10 text-[#060541] dark:text-white"
                            )}>
                              {bot.platform === 'instagram' ? <Instagram className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-[#060541] dark:text-white">{bot.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-zinc-400 capitalize">{bot.platform}</span>
                                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                                <span className="text-[10px] text-zinc-400 capitalize">{bot.purpose || 'general'}</span>
                              </div>
                            </div>
                          </div>
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                            bot.is_active ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-zinc-300")} />
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-white/8">
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 flex-1"
                            onClick={(e) => { e.stopPropagation(); toggleBotActive(bot); }}>
                            <Power className="h-3.5 w-3.5" />
                            {bot.is_active ? (isRTL ? 'إيقاف' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 flex-1"
                            onClick={(e) => { e.stopPropagation(); copyEmbedCode(bot.embed_token); }}>
                            {copiedEmbed ? <Check className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                            {isRTL ? 'تضمين' : 'Embed'}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBot(bot.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── INBOX TAB ── */}
          {innerTab === 'inbox' && (
            <motion.div key="inbox" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <SharedInboxUI bots={bots} isRTL={isRTL} />
            </motion.div>
          )}

          {/* ── BOOKINGS TAB ── */}
          {innerTab === 'bookings' && (
            <motion.div key="bookings" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex flex-col items-center py-16 text-center">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[#060541]/8 dark:bg-white/8 mb-5">
                  <CalendarCheck className="h-8 w-8 text-[#060541] dark:text-white/70" />
                </div>
                <h2 className="text-lg font-semibold mb-1">{isRTL ? 'الحجوزات والمواعيد' : 'Bookings & Appointments'}</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isRTL ? 'ستظهر هنا المواعيد التي يحجزها زوارك عبر بوتاتك' : 'Appointments booked by your visitors through your bots'}
                </p>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                  {isRTL ? 'قريباً' : 'Coming Soon'}
                </span>
              </div>
            </motion.div>
          )}

      </div>
    </div>
  );

  // ============================================
  // RENDER: PLATFORM SELECT
  // ============================================
  const renderPlatformSelect = () => (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex mb-8">
        <button onClick={() => setStep('list')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl active:scale-95 transition-all duration-200">
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Back'}
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-2 text-center">{isRTL ? 'اختر المنصة' : 'Select Platform'}</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center">{isRTL ? 'أين تريد نشر البوت؟' : 'Where do you want to deploy your bot?'}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
        {/* Website */}
        <button
          onClick={() => { setSelectedPlatform('website'); setStep('purpose'); }}
          className={cn(
            "relative rounded-2xl border-2 text-left overflow-hidden bg-white dark:bg-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
            selectedPlatform === 'website' ? "border-[#060541]/50 dark:border-white/40 shadow-md" : "border-border/40 hover:border-[#060541]/30"
          )}
        >
          {/* Preview banner */}
          <div className="h-40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[#060541]/20 dark:to-[#060541]/10 relative overflow-hidden flex items-center justify-center">
            {/* Mock chat widget preview */}
            <div className="w-44 bg-white dark:bg-zinc-800 rounded-xl shadow-lg overflow-hidden border border-black/5 text-left">
              <div className="bg-[#060541] px-3 py-2 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"><Bot className="w-3 h-3 text-white" /></div>
                <span className="text-white text-[10px] font-semibold">Wakti Bot</span>
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"></div>
              </div>
              <div className="p-2 space-y-1.5">
                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg rounded-tl-sm px-2 py-1 text-[9px] text-gray-600 dark:text-gray-300 max-w-[80%]">Hi! How can I help? 👋</div>
                <div className="bg-[#060541] rounded-lg rounded-tr-sm px-2 py-1 text-[9px] text-white ml-auto max-w-[70%]">I need support</div>
                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg rounded-tl-sm px-2 py-1 text-[9px] text-gray-600 dark:text-gray-300 max-w-[85%]">Sure! Let me help you.</div>
              </div>
            </div>
            {selectedPlatform === 'website' && (
              <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#060541] flex items-center justify-center shadow">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>
          {/* Info */}
          <div className="px-4 py-3 flex items-start gap-3">
            <Globe className="h-5 w-5 mt-0.5 text-[#060541] dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-foreground">{isRTL ? 'موقع إلكتروني / تطبيق' : 'Website / Mobile App'}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {isRTL ? 'أضف بوت لموقعك وتفاعل مع الزوار فوراً' : 'Add a chatbot to your website or app and engage visitors instantly.'}
              </p>
            </div>
          </div>
        </button>

        {/* Instagram */}
        <button
          onClick={() => { setSelectedPlatform('instagram'); setStep('instagram-connect'); setIgSubStep('login'); }}
          className={cn(
            "relative rounded-2xl border-2 text-left overflow-hidden bg-white dark:bg-card transition-all duration-200 hover:shadow-lg active:scale-[0.98]",
            selectedPlatform === 'instagram' ? "border-pink-500 shadow-lg" : "border-border/40 hover:border-pink-500/50"
          )}
        >
          {/* Preview banner */}
          <div className="h-40 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 relative overflow-hidden flex items-center justify-center">
            <div className="w-44 bg-white dark:bg-zinc-800 rounded-xl shadow-lg overflow-hidden border border-black/5 text-left">
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-white" />
                <span className="text-white text-[10px] font-semibold">Instagram DM</span>
              </div>
              <div className="p-2 space-y-1.5">
                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg rounded-tl-sm px-2 py-1 text-[9px] text-gray-600 dark:text-gray-300 max-w-[80%]">Hey! Love your post 🔥</div>
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg rounded-tr-sm px-2 py-1 text-[9px] text-white ml-auto max-w-[75%]">Thanks! Check this out 👇</div>
              </div>
            </div>
          </div>
          {/* Info */}
          <div className="px-4 py-3 flex items-start gap-3">
            <Instagram className="h-5 w-5 mt-0.5 text-pink-500 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-foreground">{isRTL ? 'انستقرام' : 'Instagram'}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {isRTL ? 'رد على الرسائل والتعليقات والقصص' : 'Reply to DMs, comments, and stories.'}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  // ============================================
  // RENDER: INSTAGRAM CONNECT
  // ============================================
  const renderInstagramConnect = () => {
    // Handle selecting a page and saving it to the bot
    const handleSelectPage = async () => {
      if (!igSelectedPage || !igPendingBotId) return;
      const selected = igPages.find((p: any) => p.page_id === igSelectedPage);
      if (!selected) return;

      setIgConnecting(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const res = await fetch(IG_OAUTH_CALLBACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'select_page',
            bot_id: igPendingBotId,
            page_id: selected.page_id,
            page_name: selected.page_name,
            page_access_token: selected.page_access_token,
            ig_account_id: selected.ig_account?.id || null,
            long_lived_token: igLongLivedToken,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to save');

        toast.success(isRTL ? 'تم ربط الحساب بنجاح!' : 'Account connected successfully!');
        // Refresh bots and proceed to purpose selection
        await fetchBots();
        setStep('purpose');
      } catch (err) {
        console.error('IG select page error:', err);
        toast.error(isRTL ? 'فشل في ربط الحساب' : 'Failed to connect account');
      } finally {
        setIgConnecting(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex mb-8">
          <button 
            onClick={() => {
              if (igSubStep === 'select_page') setIgSubStep('login');
              else setStep('platform');
            }} 
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl active:scale-95 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {isRTL ? 'رجوع' : 'Back'}
          </button>
        </div>

        <div className="max-w-md mx-auto text-center mt-12">
          {igSubStep === 'login' ? (
            <>
              <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 rounded-3xl p-0.5 shadow-xl mb-8">
                <div className="w-full h-full bg-white dark:bg-[#0c0f14] rounded-[22px] flex items-center justify-center">
                  <Instagram className="w-10 h-10 text-pink-500" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-4 text-foreground">
                {isRTL ? 'تسجيل الدخول باستخدام انستقرام' : 'Login with Instagram'}
              </h2>
              
              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                {isRTL 
                  ? 'سجل الدخول بحساب انستقرام الخاص بك لتفعيل البوت على حسابك. يُشترط أن يكون لديك صلاحية "مدير" أو أعلى للوصول إلى كافة الميزات.'
                  : 'Login to your Instagram account to enable the chatbot on your handle. Instagram bot owners are required to have at least a "manager" level of permissions or higher to access all of the features.'}
              </p>

              {igConnecting ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                  <p className="text-sm text-muted-foreground">{isRTL ? 'جارٍ الربط...' : 'Connecting...'}</p>
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    // First create the bot, then redirect to Meta OAuth
                    if (!user?.id) return;
                    setIgConnecting(true);
                    try {
                      const bot = await ChatbotService.createBot({
                        user_id: user.id,
                        name: isRTL ? 'بوت انستقرام' : 'Instagram Bot',
                        platform: 'instagram',
                      });
                      setIgPendingBotId(bot.id);
                      setBots(prev => [bot, ...prev]);
                      // Redirect to Meta OAuth — always use production origin so Meta doesn't reject localhost
                      const origin = window.location.hostname === 'localhost'
                        ? 'https://wakti.qa'
                        : window.location.origin;
                      window.location.href = buildInstagramOAuthUrl(bot.id, origin);
                    } catch (err) {
                      console.error('Failed to create IG bot:', err);
                      toast.error(isRTL ? 'فشل في الإنشاء' : 'Failed to create bot');
                      setIgConnecting(false);
                    }
                  }}
                  className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all gap-2"
                >
                  <Instagram className="h-5 w-5" />
                  {isRTL ? 'ربط حساب انستقرام' : 'Connect Instagram'}
                </Button>
              )}

              <p className="text-[11px] text-muted-foreground mt-4">
                {isRTL
                  ? 'ستتم إعادة توجيهك إلى فيسبوك لمنح الصلاحيات المطلوبة. يجب أن يكون حساب انستقرام الخاص بك حساب احترافي مرتبط بصفحة فيسبوك.'
                  : 'You will be redirected to Facebook to grant permissions. Your Instagram account must be a Professional account linked to a Facebook Page.'}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6">
                <Check className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>

              <h2 className="text-2xl font-bold mb-2 text-foreground">
                {isRTL ? 'اختر الحساب' : 'Select Instagram Page'}
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                {isRTL ? 'اختر الحساب الذي تريد ربط البوت به' : 'Choose the Instagram account you want to connect to this bot'}
              </p>

              {igPages.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    {isRTL ? 'لم يتم العثور على صفحات. تأكد من أن حسابك مرتبط بصفحة فيسبوك وحساب انستقرام احترافي.' : 'No pages found. Make sure your account is linked to a Facebook Page with a Professional Instagram account.'}
                  </p>
                  <Button variant="outline" onClick={() => setIgSubStep('login')}>
                    {isRTL ? 'حاول مرة أخرى' : 'Try Again'}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-8">
                    {igPages.map((page: any) => (
                      <button
                        key={page.page_id}
                        onClick={() => setIgSelectedPage(page.page_id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200",
                          igSelectedPage === page.page_id
                            ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10"
                            : "border-border/40 hover:border-border"
                        )}
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-0.5 shrink-0">
                          {page.ig_account?.profile_picture_url ? (
                            <img src={page.ig_account.profile_picture_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-foreground">
                              {(page.page_name || 'P').charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {page.ig_account?.name || page.page_name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {page.ig_account?.username && <span>@{page.ig_account.username}</span>}
                            {page.ig_account?.followers_count != null && (
                              <>
                                <span>·</span>
                                <span>{page.ig_account.followers_count.toLocaleString()} {isRTL ? 'متابع' : 'followers'}</span>
                              </>
                            )}
                            {!page.ig_account && <span className="text-amber-500">{isRTL ? 'لا يوجد حساب انستقرام مرتبط' : 'No IG account linked'}</span>}
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          igSelectedPage === page.page_id ? "border-[#060541] dark:border-white bg-[#060541] dark:bg-white" : "border-muted-foreground/30"
                        )}>
                          {igSelectedPage === page.page_id && <Check className="h-3 w-3 text-white dark:text-[#060541]" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleSelectPage}
                    disabled={!igSelectedPage || igConnecting}
                    className="w-full h-12 text-base font-semibold bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-[#060541] rounded-xl shadow-md transition-all"
                  >
                    {igConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : (isRTL ? 'متابعة' : 'Continue')}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  const renderPurposeSelect = () => (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex mb-8">
        <button onClick={() => setStep('platform')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl active:scale-95 transition-all duration-200">
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Back'}
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-2 text-center">{isRTL ? 'اختر الهدف' : 'Select Your Purpose'}</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center">
        {isRTL ? 'هذا يساعدنا في تخصيص تجربة البوت' : 'This helps us personalize your bot experience'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {PURPOSES.map(p => {
          const Icon = p.icon;
          const isSelected = selectedPurpose === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPurpose(p.id)}
              className={cn(
                "relative rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden bg-white dark:bg-card hover:shadow-lg hover:-translate-y-0.5",
                isSelected
                  ? "border-[#060541]/50 dark:border-white/40 shadow-md"
                  : "border-border/40 hover:border-[#060541]/30 dark:hover:border-white/20"
              )}
            >
              {/* Illustrated banner */}
              <div
                className="relative h-32 flex items-center justify-center overflow-hidden"
                style={{ background: p.bannerGradient }}
              >
                {/* Floating emoji decorations */}
                <span className="absolute top-3 left-4 text-3xl opacity-80 rotate-[-12deg]">{p.bannerEmojis[0]}</span>
                <span className="absolute bottom-3 right-5 text-2xl opacity-70 rotate-[8deg]">{p.bannerEmojis[1]}</span>
                <span className="absolute top-4 right-8 text-xl opacity-60">{p.bannerEmojis[2]}</span>
                <span className="absolute bottom-4 left-10 text-xl opacity-50 rotate-[-6deg]">{p.bannerEmojis[3]}</span>
                {/* Center icon circle */}
                <div
                  className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
                  style={{ background: p.bannerBg }}
                >
                  <Icon className="h-8 w-8 text-[#060541]" />
                </div>
                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#060541] flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
              {/* Text area */}
              <div className="px-4 py-3">
                <h3 className="font-bold text-sm text-foreground">{isRTL ? p.labelAr : p.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{isRTL ? p.descAr : p.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Button */}
      {selectedPurpose && (
        <Button
          onClick={handleCreateBot}
          disabled={creating}
          className="mt-8 gap-2 bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-[#f2f2f2] dark:hover:bg-[#f2f2f2]/90 dark:text-[#0c0f14] rounded-xl px-8 py-3 text-base shadow-lg"
        >
          {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
          {isRTL ? 'إنشاء البوت' : 'Create Bot'}
        </Button>
      )}
    </div>
  );

  // ============================================
  // RENDER: FLOW BUILDER
  // ============================================
  const renderBuilder = () => {
    if (!activeBot) return null;

    return (
      <div className="builder-fill">
        {/* Builder sub-header (bot identity + mode switcher) */}
        <div className="flex flex-col bg-white dark:bg-[#0c0f14] shrink-0 z-10" style={{ boxShadow: '0 1px 0 0 hsl(var(--border))' }}>
          {/* Colored accent bar — bot's brand color */}
          <div 
            className={cn("h-[3px] w-full", activeBot.platform === 'instagram' ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600" : "")} 
            style={activeBot.platform !== 'instagram' ? { background: activeBot.primary_color || '#060541' } : undefined} 
          />

          {/* Main header row */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            {/* Back button */}
            <button
              title="Back to dashboard"
              onClick={() => setStep('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#060541] dark:text-white border border-[#060541]/20 dark:border-white/30 px-3 py-1.5 rounded-xl active:scale-95 transition-all duration-200 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isRTL ? 'رجوع' : 'Back'}
            </button>

            {/* Bot identity — prominent */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-black/5" style={{ background: (activeBot.primary_color || '#060541') + '18' }}>
                <Bot className="h-4 w-4" style={{ color: activeBot.primary_color || '#060541' }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate text-foreground">{activeBot.name}</p>
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeBot.is_active ? "bg-emerald-500" : "bg-zinc-300")} />
                </div>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {activeBot.platform} · {isRTL ? 'محرر التدفق' : 'Flow Builder'}
                </p>
              </div>
            </div>

              {/* Action buttons — icon-only on mobile, labeled on desktop */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Live/Off pill */}
              <button
                onClick={() => toggleBotActive(activeBot)}
                title={activeBot.is_active ? 'Deactivate bot' : 'Activate bot'}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                  activeBot.is_active
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-muted/60 text-muted-foreground border border-border/40"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", activeBot.is_active ? "bg-emerald-500 animate-pulse" : "bg-zinc-400")} />
                <span className="hidden sm:inline">{activeBot.is_active ? (isRTL ? 'نشط' : 'Live') : (isRTL ? 'متوقف' : 'Off')}</span>
              </button>

              {/* Save */}
              <button
                onClick={handleSaveFlow}
                disabled={saving}
                title={isRTL ? 'حفظ' : 'Save'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-[#060541] transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isRTL ? 'حفظ' : 'Save'}</span>
              </button>

              {/* Embed */}
              <button
                onClick={() => copyEmbedCode(activeBot.embed_token)}
                title={isRTL ? 'كود التضمين' : 'Embed code'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border/50 bg-background hover:bg-muted/60 text-foreground transition-all active:scale-95 shrink-0"
              >
                {copiedEmbed ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isRTL ? 'تضمين' : 'Embed'}</span>
              </button>

              {/* Preview */}
              <button
                onClick={() => setShowPreview(true)}
                title={isRTL ? 'معاينة' : 'Preview'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all active:scale-95 shrink-0"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isRTL ? 'معاينة' : 'Preview'}</span>
              </button>
            </div>
          </div>

          {/* ── Mode switcher bar + Add Component ── */}
          <div className="flex items-center gap-2 px-3 pb-3 pt-1 bg-white dark:bg-[#0c0f14] border-b border-border/40">
            {/* Add Component — only visible in canvas mode */}
            {builderMode === 'canvas' && (
              <button
                onClick={() => { setShowAddMenu(true); setAddComponentSearch(''); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 border-[#060541] dark:border-white text-[#060541] dark:text-white bg-white dark:bg-transparent hover:bg-[#060541]/5 dark:hover:bg-white/10 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                {isRTL ? 'إضافة مكوّن' : 'Add Component'}
              </button>
            )}
            {/* Mode tabs */}
            <div className="flex flex-1 rounded-xl border border-border/50 bg-muted/60 dark:bg-white/5 p-1 gap-1 shadow-sm">
              <button
                onClick={() => setBuilderMode('canvas')}
                title="Canvas Builder"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98]",
                  builderMode === 'canvas'
                    ? "bg-[#060541] text-white dark:bg-white dark:text-[#060541] shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17 14v6m-3-3h6" /></svg>
                {isRTL ? 'رسم بياني' : 'Canvas'}
              </button>
              <button
                onClick={() => setBuilderMode('classic')}
                title="Classic Builder"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98]",
                  builderMode === 'classic'
                    ? "bg-[#060541] text-white dark:bg-white dark:text-[#060541] shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                {isRTL ? 'كلاسيك' : 'Classic'}
              </button>
            </div>
          </div>
        </div>


        {/* ── CLASSIC BUILDER ── */}
        {builderMode === 'classic' && (() => {
          // Build ordered node list following edge chain from start
          const getOrderedNodes = () => {
            const startNode = nodes.find((n: any) => n.data.flowType === 'start');
            if (!startNode) return nodes.filter((n: any) => n.data.flowType !== 'start');
            const ordered: any[] = [];
            const visited = new Set<string>();
            let current = startNode.id;
            while (current && !visited.has(current)) {
              visited.add(current);
              const node = nodes.find((n: any) => n.id === current);
              if (node && node.data.flowType !== 'start') ordered.push(node);
              const nextEdge = edges.find((e: any) => e.source === current);
              current = nextEdge?.target || '';
            }
            nodes.forEach((n: any) => { if (!visited.has(n.id) && n.data.flowType !== 'start') ordered.push(n); });
            return ordered;
          };

          // Rewire all edges for a given ordered list of nodes
          const rewireEdges = (orderedList: any[]) => {
            const startNode = nodes.find((n: any) => n.data.flowType === 'start');
            const nonChainEdges = (edges as any[]).filter((e: any) => {
              const srcInChain = orderedList.some((n: any) => n.id === e.source);
              const startSrc = startNode && e.source === startNode.id;
              return !srcInChain && !startSrc;
            });
            const newChainEdges: any[] = [];
            const allNodes = startNode ? [startNode, ...orderedList] : orderedList;
            for (let i = 0; i < allNodes.length - 1; i++) {
              newChainEdges.push({
                id: `e-${allNodes[i].id}-${allNodes[i + 1].id}`,
                source: allNodes[i].id,
                target: allNodes[i + 1].id,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { strokeWidth: 2 },
              });
            }
            setEdges([...nonChainEdges, ...newChainEdges]);
          };

          const orderedNodes = getOrderedNodes();
          const selectedNode = classicSelectedId ? nodes.find((n: any) => n.id === classicSelectedId) : null;
          const selData = selectedNode?.data;
          const selMeta = selData ? NODE_TYPE_META[selData.flowType as FlowNodeType] : null;
          const selIsChoice = selData?.flowType === 'single_choice' || selData?.flowType === 'multiple_choice';

          // Drag handlers for reorder
          const handleDragStart = (idx: number) => { setClassicDragIdx(idx); };
          const handleDragOver = (e: React.DragEvent, idx: number) => {
            e.preventDefault();
            if (classicDragIdx === null || classicDragIdx === idx) return;
          };
          const handleDrop = (e: React.DragEvent, dropIdx: number) => {
            e.preventDefault();
            if (classicDragIdx === null || classicDragIdx === dropIdx) { setClassicDragIdx(null); return; }
            const newOrder = [...orderedNodes];
            const [moved] = newOrder.splice(classicDragIdx, 1);
            newOrder.splice(dropIdx, 0, moved);
            setClassicDragIdx(null);
            rewireEdges(newOrder);
            // Update node positions
            setNodes((nds: any[]) => {
              const startNode = nds.find((n: any) => n.data.flowType === 'start');
              const baseX = startNode?.position?.x ?? 300;
              const baseY = (startNode?.position?.y ?? 0) + 160;
              return nds.map((n: any) => {
                const newIdx = newOrder.findIndex((o: any) => o.id === n.id);
                if (newIdx === -1) return n;
                return { ...n, position: { x: baseX, y: baseY + newIdx * 160 } };
              });
            });
          };

          // Insert at specific position
          const insertAtIdx = (type: FlowNodeType, afterIdx: number) => {
            const meta = NODE_TYPE_META[type];
            const id = `${type}-${Date.now()}`;
            const insertPos = afterIdx + 1;
            const refNode = orderedNodes[afterIdx];
            const newPos = refNode
              ? { x: refNode.position.x, y: refNode.position.y + 80 }
              : { x: 300, y: 160 };
            const newNode = {
              id,
              type: 'chatFlowNode',
              position: newPos,
              data: {
                flowType: type, label: meta.label, text: '', prompt: '',
                nodeId: id, onDelete: deleteNode, onEdit: editNode,
                options: type === 'single_choice' || type === 'multiple_choice'
                  ? [{ en: 'Option 1', ar: 'خيار 1' }, { en: 'Option 2', ar: 'خيار 2' }]
                  : undefined,
              },
            };
            const newOrder = [...orderedNodes];
            newOrder.splice(insertPos, 0, newNode);
            setNodes((nds: any[]) => [...nds, newNode]);
            setTimeout(() => {
              rewireEdges(newOrder);
              setClassicInsertAfterIdx(null);
              setEditingNode({ nodeId: id, flowType: type, position: {x:0, y:0} });
              setEditText('');
              setEditOptions(type === 'single_choice' || type === 'multiple_choice' ? ['Option 1', 'Option 2'] : []);
              setShowAddMenu(false);
            }, 50);
          };

          const COMP_SECTIONS = [
            { label: isRTL ? 'الأكثر استخداماً' : 'Frequently used', types: ['message', 'name', 'phone', 'email', 'single_choice', 'ai_response'] as FlowNodeType[] },
            { label: isRTL ? 'جمع المعلومات' : 'Collect Info', types: ['name', 'email', 'phone', 'single_choice', 'multiple_choice'] as FlowNodeType[] },
            { label: isRTL ? 'ذكاء اصطناعي' : 'AI', types: ['ai_response'] as FlowNodeType[] },
            { label: isRTL ? 'إجراءات' : 'Actions', types: ['appointment', 'rating', 'live_chat', 'end'] as FlowNodeType[] },
          ];

          // Find next node in chain for "THEN GO TO" section
          const getNextNode = (nodeId: string) => {
            const nextEdge = (edges as any[]).find((e: any) => e.source === nodeId);
            if (!nextEdge) return null;
            return (nodes as any[]).find((n: any) => n.id === nextEdge.target) || null;
          };

          // (CustomizePanel component removed — we now use the master editingNode modal for both Classic and Canvas views)

          return (
            <div className="flex flex-col flex-1 overflow-hidden min-h-0">

              {/* ── Desktop: 2-col. Mobile: full flow ── */}
              <div className="flex flex-1 overflow-hidden min-h-0">

                {/* ── LEFT: Component List (hidden on mobile) ── */}
                <div className="hidden sm:flex w-52 lg:w-56 shrink-0 border-r border-border/50 bg-background flex-col overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border/40 shrink-0">
                    <p className="text-xs font-bold text-foreground">{isRTL ? 'إضافة مكوّن' : 'Add Chat Component'}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
                    {COMP_SECTIONS.map((sec, si) => (
                      <div key={si} className="mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 py-1.5">{sec.label}</p>
                        {sec.types.map(type => {
                          const m = NODE_TYPE_META[type];
                          return (
                            <button key={type}
                              onClick={() => {
                                if (classicInsertAfterIdx !== null) {
                                  insertAtIdx(type, classicInsertAfterIdx);
                                } else {
                                  addNode(type);
                                }
                              }}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left mb-0.5 group",
                                classicInsertAfterIdx !== null
                                  ? "bg-[#060541]/5 dark:bg-white/5 hover:bg-[#060541]/10 dark:hover:bg-white/10 ring-1 ring-[#060541]/20"
                                  : "hover:bg-muted/70 active:bg-muted"
                              )}
                            >
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: m.color + '18' }}>{m.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground leading-tight truncate">{isRTL ? m.labelAr : m.label}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight truncate">{isRTL ? m.descriptionAr : m.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {classicInsertAfterIdx !== null && (
                    <div className="px-3 py-2 border-t border-border/40 bg-[#060541]/5 dark:bg-white/5 shrink-0">
                      <p className="text-[10px] text-[#060541] dark:text-blue-300 font-semibold text-center">
                        {isRTL ? '↑ اختر نوع المكوّن للإدراج' : '↑ Pick a type to insert here'}
                      </p>
                      <button onClick={() => setClassicInsertAfterIdx(null)} className="mt-1 w-full text-[10px] text-muted-foreground hover:text-foreground text-center">
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ── CENTER: Stacked Chat Flow ── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
                  <div className="px-4 py-2 border-b border-border/40 shrink-0 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">{isRTL ? 'تدفق المحادثة' : 'Create / Reorder Chat Flow'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground">{orderedNodes.length} {isRTL ? 'مكوّن' : 'components'}</p>
                      {/* Mobile: Add button */}
                      <button
                        onClick={() => { setClassicInsertAfterIdx(null); setShowAddMenu(true); setAddComponentSearch(''); }}
                        className="sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#060541] text-white text-xs font-bold active:scale-95 transition-all"
                        title="Add component"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isRTL ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 min-h-0">
                    {orderedNodes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                        <span className="text-4xl">💬</span>
                        <p className="text-sm font-semibold text-muted-foreground">{isRTL ? 'أضف مكوّنات من القائمة' : 'Add components from the left panel'}</p>
                        {/* Mobile add button when empty */}
                        <button
                          onClick={() => { setShowAddMenu(true); setAddComponentSearch(''); }}
                          className="sm:hidden mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#060541] text-white text-sm font-bold shadow-lg active:scale-95 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                          {isRTL ? 'إضافة مكوّن' : 'Add Component'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-0 max-w-lg mx-auto">
                        {orderedNodes.map((node: any, idx: number) => {
                          const m = NODE_TYPE_META[node.data.flowType as FlowNodeType];
                          if (!m) return null;
                          const isSelected = classicSelectedId === node.id;
                          const isChoice = node.data.flowType === 'single_choice' || node.data.flowType === 'multiple_choice';
                          const isDragging = classicDragIdx === idx;

                          return (
                            <div key={node.id} className="flex flex-col items-center">

                              {/* ── Connector line + insert ABOVE first card ── */}
                              {idx === 0 && (
                                <div className="flex flex-col items-center gap-0 group/ins0 w-full">
                                  <div className="w-0.5 h-4 bg-gradient-to-b from-transparent to-border/40" />
                                  <button
                                    onClick={() => { setClassicInsertAfterIdx(-1); setShowAddMenu(true); setAddComponentSearch(''); }}
                                    title="Insert before"
                                    className="w-6 h-6 rounded-full border-2 border-dashed border-border/40 hover:border-[#060541] dark:hover:border-white bg-background flex items-center justify-center opacity-0 group-hover/ins0:opacity-100 hover:!opacity-100 transition-all hover:scale-110 active:scale-95 shadow-sm"
                                  >
                                    <Plus className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                  <div className="w-0.5 h-3 bg-border/40" />
                                </div>
                              )}

                              {/* ── Node card ── */}
                              <div
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={(e) => handleDrop(e, idx)}
                                onDragEnd={() => setClassicDragIdx(null)}
                                onClick={() => {
                                  setEditingNode({ nodeId: node.id, flowType: node.data.flowType, position: {x:0, y:0} });
                                  setEditText(node.data.text || node.data.prompt || '');
                                  const opts = (node.data.options || []).map((o: any) => typeof o === 'string' ? o : o.en || '');
                                  setEditOptions(opts);
                                }}
                                className={cn(
                                  "relative w-full rounded-2xl transition-all cursor-pointer overflow-hidden select-none",
                                  "bg-white dark:bg-zinc-900",
                                  isSelected
                                    ? "shadow-lg ring-2 scale-[1.01]"
                                    : "shadow-sm hover:shadow-md hover:scale-[1.005]",
                                  isDragging ? "opacity-40 scale-[0.97]" : ""
                                )}
                                style={isSelected ? { ringColor: m.color, boxShadow: `0 4px 20px ${m.color}30, 0 1px 6px ${m.color}20` } : {}}
                              >
                                {/* Left color accent bar */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: m.color }} />

                                {/* Drag handle */}
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-25 hover:opacity-60 cursor-grab active:cursor-grabbing z-10 py-2">
                                  {[0,1,2].map(i => (
                                    <div key={i} className="flex gap-[3px]">
                                      <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                      <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                    </div>
                                  ))}
                                </div>

                                {/* Card content */}
                                <div className="pl-8 pr-10">
                                  {/* Header row */}
                                  <div className="flex items-center gap-2 py-2.5 border-b border-border/20">
                                    <span
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 text-white"
                                      style={{ background: m.color }}
                                    >
                                      {m.icon}
                                    </span>
                                    <span className="text-sm font-bold text-foreground truncate">{isRTL ? m.labelAr : m.label}</span>
                                    {isSelected && (
                                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: m.color }}>
                                        {isRTL ? 'محدد' : 'Selected'}
                                      </span>
                                    )}
                                  </div>
                                  {/* Body */}
                                  <div className="py-2.5">
                                    {isChoice ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {(node.data.options || []).slice(0, 4).map((opt: any, i: number) => (
                                          <span
                                            key={i}
                                            className="text-xs px-2.5 py-1 rounded-full font-medium"
                                            style={{ background: m.color + '15', color: m.color, border: `1px solid ${m.color}30` }}
                                          >
                                            {typeof opt === 'string' ? opt : opt.en || opt.ar}
                                          </span>
                                        ))}
                                        {(node.data.options || []).length === 0 && (
                                          <span className="text-xs italic text-muted-foreground/50">{isRTL ? 'لا توجد خيارات...' : 'No options yet...'}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                        {node.data.text || node.data.prompt || (
                                          <span className="italic opacity-40">{isRTL ? 'انقر للتعديل...' : 'Tap to edit...'}</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Delete btn */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id); if (editingNode?.nodeId === node.id) setEditingNode(null); }}
                                  title="Delete"
                                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all z-10 hover:scale-110 active:scale-95"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              {/* ── Connector line + insert BELOW each card ── */}
                              <div className="flex flex-col items-center gap-0 group/ins w-full">
                                <div className="w-0.5 h-3 bg-border/40" />
                                <button
                                  onClick={() => { setClassicInsertAfterIdx(idx); setShowAddMenu(true); setAddComponentSearch(''); }}
                                  title={isRTL ? 'إضافة مكوّن هنا' : 'Insert component here'}
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-125 active:scale-95 shadow-sm",
                                    classicInsertAfterIdx === idx
                                      ? "border-[#060541] dark:border-white bg-[#060541] dark:bg-white scale-110 shadow-md"
                                      : "border-border/50 bg-background hover:border-[#060541] dark:hover:border-white hover:bg-[#060541]/5"
                                  )}
                                >
                                  <Plus className={cn("w-3 h-3", classicInsertAfterIdx === idx ? "text-white dark:text-[#060541]" : "text-muted-foreground")} />
                                </button>
                                <div className="w-0.5 h-3 bg-border/40" />
                              </div>
                            </div>
                          );
                        })}

                        {/* Add at end button */}
                        <button
                          onClick={() => { setClassicInsertAfterIdx(null); setShowAddMenu(true); setAddComponentSearch(''); }}
                          className="sm:hidden w-full mt-2 py-3 rounded-xl border-2 border-dashed border-border/40 hover:border-[#060541]/40 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                        >
                          <Plus className="h-4 w-4" />
                          {isRTL ? 'إضافة مكوّن' : 'Add Component'}
                        </button>
                        {/* Right panel removed. Using master Canvas modal for editing. */}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* React Flow Canvas */}
        <div className={cn("flex-1 min-h-0 relative overflow-hidden", builderMode === 'classic' && "hidden")}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={(_evt, edge) => setEdges((eds: any[]) => eds.filter((e: any) => e.id !== edge.id))}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2, cursor: 'pointer' },
            }}
            panOnScroll
            zoomOnPinch
            zoomOnDoubleClick
            panOnDrag
            selectionOnDrag={false}
            className={isDark ? 'dark-flow' : ''}
          >
            <Background gap={20} size={1} color={isDark ? '#ffffff10' : '#00000010'} />
            <Controls className="!rounded-xl !border-border/50 !shadow-lg" />
            <CanvasToolbar onAutoArrange={autoArrangeNodes} onClearFlow={clearFlow} isRTL={isRTL} />
            <MiniMap
              className="!rounded-xl !border-border/50 !shadow-lg hidden sm:block"
              nodeColor={(n: any) => {
                const meta = NODE_TYPE_META[n.data?.flowType as FlowNodeType];
                return meta?.color || '#6366f1';
              }}
              maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
            />
          </ReactFlow>


          {/* Add Component modal moved outside — see below */}
          {false && (() => {
            const FREQ: FlowNodeType[] = ['message', 'name', 'phone', 'email', 'single_choice', 'ai_response'];
            const SECTIONS: { label: string; labelAr: string; types: FlowNodeType[] }[] = [
              { label: 'Messages', labelAr: 'الرسائل', types: ['message'] },
              { label: 'Collect Info', labelAr: 'جمع المعلومات', types: ['name', 'email', 'phone', 'single_choice', 'multiple_choice'] },
              { label: 'AI', labelAr: 'ذكاء اصطناعي', types: ['ai_response'] },
              { label: 'Actions', labelAr: 'إجراءات', types: ['appointment', 'rating', 'live_chat', 'end'] },
            ];
            const q = addComponentSearch.toLowerCase();
            const allTypes: FlowNodeType[] = ['message', 'name', 'email', 'phone', 'single_choice', 'multiple_choice', 'ai_response', 'appointment', 'rating', 'live_chat', 'end'];
            const filtered = q ? allTypes.filter(t => {
              const m = NODE_TYPE_META[t];
              return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
            }) : null;

            const NodeRow = ({ type }: { type: FlowNodeType }) => {
              const m = NODE_TYPE_META[type];
              return (
                <button
                  key={type}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Let addNode handle closing - it already does setShowAddMenu(false)
                    // Delay to let modal animation complete before canvas updates
                    setTimeout(() => addNode(type), 100);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-muted active:scale-[0.98] transition-transform text-left"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: m.color + '18' }}>{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{isRTL ? m.labelAr : m.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{isRTL ? m.descriptionAr : m.description}</p>
                  </div>
                </button>
              );
            };

            return (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => { setShowAddMenu(false); setAddComponentSearch(''); }}>
                <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-md flex flex-col" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                    <p className="font-bold text-base text-foreground">{isRTL ? 'إضافة مكوّن' : 'Add Component'}</p>
                    <button onClick={() => { setShowAddMenu(false); setAddComponentSearch(''); }} title="Close"
                      className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center active:scale-95 transition-all">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-4 pb-3 shrink-0">
                    <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border/40">
                      <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input
                        autoFocus
                        value={addComponentSearch}
                        onChange={e => setAddComponentSearch(e.target.value)}
                        placeholder={isRTL ? 'ابحث هنا...' : 'Search here...'}
                        className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                      />
                      {addComponentSearch && (
                        <button onClick={() => setAddComponentSearch('')} title="Clear search" className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
                    {filtered ? (
                      filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                      ) : (
                        filtered.map(t => <NodeRow key={t} type={t} />)
                      )
                    ) : (
                      <>
                        {/* Frequently used */}
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pt-1 pb-2">
                          {isRTL ? 'الأكثر استخداماً' : 'Frequently used'}
                        </p>
                        {FREQ.map(t => <NodeRow key={t} type={t} />)}
                        {/* Sections */}
                        {SECTIONS.map(sec => (
                          <React.Fragment key={sec.label}>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pt-3 pb-2">
                              {isRTL ? sec.labelAr : sec.label}
                            </p>
                            {sec.types.map(t => <NodeRow key={t} type={t} />)}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Add Component Modal — shared by Canvas + Classic ── */}
        {showAddMenu && (() => {
            const FREQ: FlowNodeType[] = ['message', 'name', 'phone', 'email', 'single_choice', 'ai_response'];
            const SECTIONS: { label: string; labelAr: string; types: FlowNodeType[] }[] = [
              { label: 'Messages', labelAr: 'الرسائل', types: ['message'] },
              { label: 'Collect Info', labelAr: 'جمع المعلومات', types: ['name', 'email', 'phone', 'single_choice', 'multiple_choice'] },
              { label: 'AI', labelAr: 'ذكاء اصطناعي', types: ['ai_response'] },
              { label: 'Actions', labelAr: 'إجراءات', types: ['appointment', 'rating', 'live_chat', 'end'] },
            ];
            const q = addComponentSearch.toLowerCase();
            const allTypes: FlowNodeType[] = ['message', 'name', 'email', 'phone', 'single_choice', 'multiple_choice', 'ai_response', 'appointment', 'rating', 'live_chat', 'end'];
            const filtered = q ? allTypes.filter(t => {
              const m = NODE_TYPE_META[t];
              return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
            }) : null;

            const NodeRow = ({ type }: { type: FlowNodeType }) => {
              const m = NODE_TYPE_META[type];
              return (
                <button
                  key={type}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addNode(type);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/70 active:bg-muted active:scale-[0.98] transition-transform text-left touch-manipulation"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: m.color + '18' }}>{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{isRTL ? m.labelAr : m.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{isRTL ? m.descriptionAr : m.description}</p>
                  </div>
                </button>
              );
            };

            return (
              <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" 
                   onClick={(e) => { if (e.target === e.currentTarget) { setShowAddMenu(false); setAddComponentSearch(''); setClassicInsertAfterIdx(null); } }}>
                <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-md flex flex-col" style={{ maxHeight: '80vh' }}>
                  <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                    <p className="font-bold text-base text-foreground">{isRTL ? 'إضافة مكوّن' : 'Add Component'}</p>
                    <button onClick={() => { setShowAddMenu(false); setAddComponentSearch(''); setClassicInsertAfterIdx(null); }} title="Close"
                      className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center active:scale-95 transition-all">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="px-4 pb-3 shrink-0">
                    <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border/40">
                      <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input
                        value={addComponentSearch}
                        onChange={e => setAddComponentSearch(e.target.value)}
                        placeholder={isRTL ? 'ابحث هنا...' : 'Search here...'}
                        className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                      />
                      {addComponentSearch && (
                        <button onClick={() => setAddComponentSearch('')} title="Clear search" className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
                    {filtered ? (
                      filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                      ) : (
                        filtered.map(t => <NodeRow key={t} type={t} />)
                      )
                    ) : (
                      <>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pt-1 pb-2">
                          {isRTL ? 'الأكثر استخداماً' : 'Frequently used'}
                        </p>
                        {FREQ.map(t => <NodeRow key={t} type={t} />)}
                        {SECTIONS.map(sec => (
                          <React.Fragment key={sec.label}>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pt-3 pb-2">
                              {isRTL ? sec.labelAr : sec.label}
                            </p>
                            {sec.types.map(t => <NodeRow key={t} type={t} />)}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── Node Editor — Right Side Panel (desktop) / Bottom Sheet (mobile) ── */}
        {editingNode && (() => {
          const meta = NODE_TYPE_META[editingNode.flowType as FlowNodeType];
          const isChoice = editingNode.flowType === 'single_choice' || editingNode.flowType === 'multiple_choice';
          const isRating = editingNode.flowType === 'rating';
          const isStart = editingNode.flowType === 'start';
          const isAppointment = editingNode.flowType === 'appointment';

          const handleSave = () => {
            const updates: Record<string, any> = {};
            if (isChoice) {
              updates.options = editOptions.filter(Boolean).map(o => ({ en: o, ar: o }));
              updates.text = editText;
            } else {
              if (editingNode.flowType === 'ai_response') {
                updates.prompt = editText;
                updates.aiMaxQueries = editingNode.aiMaxQueries ?? 10;
              } else {
                updates.text = editText;
              }
            }
            saveNodeEdit(editingNode.nodeId, updates);
          };

          return (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setEditingNode(null)} />

              {/* Panel: centered modal on desktop, full-screen bottom sheet on mobile */}
              <div className="fixed z-50 bg-card border-t border-border/50 shadow-2xl flex flex-col
                inset-x-0 bottom-0 rounded-t-3xl h-[92vh] sm:h-auto
                sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[80vh] sm:w-[420px] sm:border">

                {/* Mobile drag handle */}
                <div className="flex justify-center pt-3 pb-2 sm:hidden shrink-0">
                  <div className="w-12 h-1.5 rounded-full bg-border/60" />
                </div>

                {/* Header row */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 border-b border-border/40 shrink-0">
                  <button
                    onClick={() => setEditingNode(null)}
                    title="Close"
                    className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted active:scale-95 transition-all shrink-0"
                  >
                    <X className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-white text-base sm:text-sm shrink-0" style={{ background: meta?.color }}>
                      {meta?.icon}
                    </div>
                    <p className="font-bold text-base sm:text-sm text-foreground truncate">{isRTL ? meta?.labelAr : meta?.label}</p>
                  </div>
                  {!isStart && (
                    <button
                      onClick={() => { deleteNode(editingNode.nodeId); setEditingNode(null); }}
                      title="Delete"
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all shrink-0"
                    >
                      <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 sm:py-4 min-h-0 space-y-5 sm:space-y-4">

                  {isStart ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {isRTL ? 'هذا هو نقطة بداية البوت. لا يمكن تعديلها.' : 'This is the entry point of your chatbot. It cannot be edited.'}
                    </p>
                  ) : (
                    <>
                      {/* Message text */}
                      {(true) && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                            {isChoice
                              ? (isRTL ? 'رسالة البوت قبل الخيارات' : 'Bot message before choices')
                              : (isRTL ? 'الرسالة' : 'Message')}
                          </label>
                          <div className="relative">
                            <textarea
                              ref={editTextareaRef}
                              value={editText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditText(val);
                                const last = val[e.target.selectionStart - 1];
                                if (last === '/') setShowVarMenu(true);
                                else if (showVarMenu && !val.endsWith('/')) setShowVarMenu(false);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Escape') setShowVarMenu(false); }}
                              rows={4}
                              dir="auto"
                              className="w-full border border-border/60 rounded-xl px-4 py-3 text-base sm:text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#060541]/20 dark:focus:ring-white/20 focus:border-[#060541]/50 dark:focus:border-white/40 resize-none transition-all min-h-[100px]"
                              placeholder={isRTL ? 'اكتب الرسالة... اكتب / للمتغيرات' : 'What should the bot say... type / for variables'}
                            />
                            {/* Variable picker */}
                            {showVarMenu && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">{isRTL ? 'المتغيرات' : 'Default Attributes'}</p>
                                {[
                                  { label: isRTL ? 'الاسم' : 'Name', var: '{{name}}' },
                                  { label: isRTL ? 'البريد الإلكتروني' : 'Email', var: '{{email}}' },
                                  { label: isRTL ? 'رقم الهاتف' : 'Phone Number', var: '{{phone}}' },
                                ].map(v => (
                                  <button
                                    key={v.var}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/80 text-left transition-colors"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const ta = editTextareaRef.current;
                                      if (!ta) return;
                                      const pos = ta.selectionStart;
                                      const before = editText.slice(0, pos).replace(/\/$/, '');
                                      const after = editText.slice(pos);
                                      setEditText(before + v.var + after);
                                      setShowVarMenu(false);
                                      setTimeout(() => {
                                        ta.focus();
                                        const newPos = before.length + v.var.length;
                                        ta.setSelectionRange(newPos, newPos);
                                      }, 10);
                                    }}
                                  >
                                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-[#060541] dark:text-blue-400">{v.var}</span>
                                    <span className="text-sm text-foreground">{v.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* AMP enhance button */}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                              {isRTL ? "اكتب '/' لإدراج اسم أو إيميل الزائر" : "Type '/' to insert visitor's name, email or phone"}
                            </p>
                            <button
                              disabled={ampLoading || !editText.trim()}
                              title="Enhance with AI"
                              onClick={async () => {
                                if (!editText.trim()) return;
                                setAmpLoading(true);
                                try {
                                  const componentName = isRTL ? meta?.labelAr : meta?.label;
                                  const { data, error } = await supabase.functions.invoke('prompt-amp', {
                                    body: {
                                      text: `[Bot component: ${componentName}] ${editText}`,
                                      mode: 'bot-component',
                                    }
                                  });
                                  if (!error && data?.text) {
                                    setEditText(data.text.trim().replace(/^["']|["']$/g, ''));
                                  } else {
                                    toast.error(isRTL ? 'فشل التحسين' : 'Enhancement failed');
                                  }
                                } catch {
                                  toast.error(isRTL ? 'فشل التحسين' : 'Enhancement failed');
                                } finally {
                                  setAmpLoading(false);
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#060541] dark:bg-white text-white dark:text-[#060541] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
                            >
                              {ampLoading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Zap className="h-3 w-3" />
                              }
                              AMP
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Appointment — Bookings system link */}
                      {isAppointment && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            {isRTL ? 'نظام الحجز' : 'Bookings System'}
                          </label>
                          <div className="flex items-start gap-2 border border-blue-500/40 rounded-lg px-3 py-2.5 bg-blue-500/10">
                            <span className="text-blue-500 text-base leading-none mt-0.5">📅</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {isRTL ? 'متصل بنظام الحجوزات' : 'Connected to Bookings'}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {isRTL
                                  ? 'المواعيد التي يحجزها الزوار ستظهر في تبويب الحجوزات'
                                  : 'Appointments booked by visitors will appear in the Bookings tab'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Response — knowledge base + max queries + attributes */}
                      {editingNode.flowType === 'ai_response' && (() => {
                        // Count real KB entries by parsing the serialized string
                        // knowledgeBase state is always synced to THIS bot's KB
                        const kbRaw = knowledgeBase || activeBot?.knowledge_base || '';
                        const kbEntryCount = (() => {
                          if (!kbRaw.trim()) return 0;
                          const blocks = kbRaw.split(/\n---\n/);
                          let count = 0;
                          blocks.forEach(block => {
                            const body = block.replace(/^##[^\n]*\n?/, '');
                            const pairs = body.split(/\n\nQ:|\nQ:/).filter(Boolean);
                            pairs.forEach(p => {
                              const q = p.replace(/^:?\s*/, '').split('\nA:')[0].trim();
                              const aMatch = p.match(/\nA:\s*([\s\S]*)/);
                              const a = aMatch ? aMatch[1].trim() : '';
                              if (q || a) count++;
                            });
                          });
                          return count;
                        })();
                        const hasSystemPrompt = !!(activeBot?.system_prompt?.trim());
                        const hasRealKB = kbEntryCount > 0 || hasSystemPrompt;

                        return (
                        <div className="space-y-3">
                          {/* Knowledge base status */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                              {isRTL ? 'مصدر المعرفة' : 'Knowledge Base'}
                            </label>
                            {hasRealKB ? (
                              <div className="flex items-start gap-2 border border-green-500/40 rounded-lg px-3 py-2.5 bg-green-500/10">
                                <span className="text-green-500 text-base leading-none mt-0.5">✅</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-green-600 dark:text-green-400">{isRTL ? 'متصل بقاعدة المعرفة' : 'Connected to knowledge base'}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {kbEntryCount > 0
                                      ? `${kbEntryCount} ${isRTL ? 'إدخال' : kbEntryCount === 1 ? 'entry' : 'entries'}`
                                      : (isRTL ? 'تعليمات النظام مضبوطة' : 'System instructions configured')}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2 border border-amber-500/40 rounded-lg px-3 py-2.5 bg-amber-500/10">
                                <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{isRTL ? 'لا توجد قاعدة معرفة' : 'No knowledge base set'}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{isRTL ? 'اذهب إلى إعدادات الذكاء الاصطناعي لإضافة محتوى' : 'Go to AI Settings to add content'}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Max AI queries before human handoff */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                              {isRTL ? 'عدد ردود الذكاء الاصطناعي قبل التحويل للإنسان' : 'AI replies before human handoff'}
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={editingNode.aiMaxQueries ?? 10}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditingNode((prev: any) => ({ ...prev, aiMaxQueries: val }));
                                }}
                                className="w-20 border border-border/60 rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#060541]/20 dark:focus:ring-white/20 transition-all"
                              >
                                {[5, 10, 15, 20].map(num => (
                                  <option key={num} value={num}>{num}</option>
                                ))}
                              </select>
                              <p className="text-xs text-muted-foreground">{isRTL ? 'رسالة، ثم يتم التحويل لموظف بشري' : 'messages, then transfer to human agent'}</p>
                            </div>
                          </div>

                          {/* Allow immediate human handoff checkbox */}
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                            <input
                              type="checkbox"
                              id="immediate-handoff"
                              checked={editingNode.allowImmediateHandoff ?? false}
                              onChange={(e) => {
                                setEditingNode((prev: any) => ({ ...prev, allowImmediateHandoff: e.target.checked }));
                              }}
                              className="w-5 h-5 rounded border-border/60 text-[#060541] focus:ring-[#060541]/20"
                            />
                            <label htmlFor="immediate-handoff" className="text-sm text-foreground cursor-pointer flex-1">
                              {isRTL ? 'السماح للزائر بطلب التواصل مع إنسان فوراً' : 'Allow visitor to request human agent immediately'}
                            </label>
                          </div>

                          {/* Default attributes */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                              {isRTL ? 'المتغيرات المتاحة' : 'Default Attributes'}
                            </label>
                            <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                              {[
                                { var: '{{name}}', label: isRTL ? 'الاسم' : 'Name' },
                                { var: '{{email}}', label: isRTL ? 'البريد الإلكتروني' : 'Email' },
                                { var: '{{phone}}', label: isRTL ? 'رقم الهاتف' : 'Phone Number' },
                              ].map(a => (
                                <div key={a.var} className="flex items-center gap-3 px-3 py-2 bg-muted/20">
                                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-[#060541] dark:text-blue-400 shrink-0">{a.var}</span>
                                  <span className="text-sm text-foreground">{a.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Rating options — read-only */}
                      {isRating && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            {isRTL ? 'خيارات التقييم' : 'Rating Options'}
                          </label>
                          <div className="rounded-xl border border-border/60 overflow-hidden">
                            {RATING_OPTIONS.map((r, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-muted/20"
                              >
                                <span className="text-sm text-foreground font-medium">{isRTL ? r.labelAr : r.label}</span>
                                <span className="text-lg leading-none">{r.emoji}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Choice options */}
                      {isChoice && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            {isRTL ? 'الخيارات' : 'Options'}
                          </label>
                          <div className="space-y-2">
                            {editOptions.map((opt, i) => (
                              <div key={i} className="flex gap-1.5">
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...editOptions];
                                    newOpts[i] = e.target.value;
                                    setEditOptions(newOpts);
                                  }}
                                  className="flex-1 border border-border/60 rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#060541]/20 dark:focus:ring-white/20 focus:border-[#060541]/50 dark:focus:border-white/40 transition-all"
                                  placeholder={`${isRTL ? 'خيار' : 'Option'} ${i + 1}`}
                                />
                                <button
                                  onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))}
                                  title="Remove"
                                  className="w-9 h-9 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => setEditOptions([...editOptions, ''])}
                              className="w-full py-2 rounded-lg border border-dashed border-border/50 text-xs font-semibold text-muted-foreground hover:border-[#060541]/30 hover:text-foreground transition-colors active:scale-[0.98]"
                            >
                              + {isRTL ? 'إضافة خيار' : 'Add option'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Go to next message - Mobile-optimized visual flow */}
                      <div className="space-y-3">
                        {/* Visual connection path */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-0.5 bg-gradient-to-r from-[#060541] to-transparent" />
                          <span className="text-xs font-semibold text-[#060541] dark:text-white/80 uppercase tracking-wider">
                            {isRTL ? 'بعد ذلك انتقل إلى' : 'Then go to'}
                          </span>
                        </div>
                        {isChoice ? (
                          /* Per-option routing for choice nodes */
                          <div className="space-y-3">
                            {editOptions.map((opt, i) => {
                              const edge = (edges as any[]).find((e: any) => e.source === editingNode.nodeId && e.sourceHandle === `option-${i}`);
                              const connectedNode = edge ? (nodes as any[]).find((n: any) => n.id === edge.target) : null;
                              const connectedMeta = connectedNode ? NODE_TYPE_META[connectedNode.data?.flowType as FlowNodeType] : null;
                              const nodesWithIncoming = new Set((edges as any[]).map((e: any) => e.target));
                              const freeNodes = (nodes as any[]).filter((n: any) =>
                                n.id !== editingNode.nodeId &&
                                n.data?.flowType !== 'start' &&
                                !nodesWithIncoming.has(n.id)
                              );
                              return (
                                <div key={i} className="border border-border/60 rounded-lg p-2.5 bg-muted/20 space-y-2">
                                  <p className="text-xs font-semibold text-foreground truncate">{opt || `Option ${i + 1}`}</p>
                                  {/* Currently connected */}
                                  <div className="flex items-center gap-2 bg-muted/40 rounded-md px-2 py-1.5">
                                    <span className="text-xs flex-1 truncate text-muted-foreground">
                                      {connectedNode && connectedMeta
                                        ? `${connectedMeta.icon} ${connectedNode.data?.label || (isRTL ? connectedMeta.labelAr : connectedMeta.label)}`
                                        : (isRTL ? '🔚 نهاية المحادثة' : '🔚 End chat')}
                                    </span>
                                    {edge && (
                                      <button
                                        title={isRTL ? 'قطع الاتصال' : 'Disconnect'}
                                        onClick={() => setEdges((eds: any[]) => eds.filter((ed: any) => ed.id !== edge.id))}
                                        className="text-red-400 hover:text-red-500 text-[10px] px-1 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                  {/* Connect to free */}
                                  {freeNodes.length > 0 && (
                                    <select
                                      title={isRTL ? 'توصيل بمكوّن حر' : 'Connect to free component'}
                                      defaultValue=""
                                      onChange={(e) => {
                                        const chosen = e.target.value;
                                        if (!chosen) return;
                                        setEdges((eds: any[]) => {
                                          const filtered = eds.filter((ed: any) => !(ed.source === editingNode.nodeId && ed.sourceHandle === `option-${i}`));
                                          return [...filtered, {
                                            id: `e-${editingNode.nodeId}-opt${i}-${chosen}`,
                                            source: editingNode.nodeId,
                                            sourceHandle: `option-${i}`,
                                            target: chosen,
                                            markerEnd: { type: MarkerType.ArrowClosed },
                                            style: { strokeWidth: 2, cursor: 'pointer' },
                                          }];
                                        });
                                        e.target.value = '';
                                      }}
                                      className="w-full text-xs rounded-md border border-border/60 bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="">{isRTL ? '— توصيل بمكوّن حر —' : '— Connect to free component —'}</option>
                                      {freeNodes.map((n: any) => {
                                        const nm = NODE_TYPE_META[n.data?.flowType as FlowNodeType];
                                        return (
                                          <option key={n.id} value={n.id}>
                                            {nm?.icon} {n.data?.label || (isRTL ? nm?.labelAr : nm?.label) || n.id}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const outEdge = (edges as any[]).find((e: any) => e.source === editingNode.nodeId);
                              const connectedNode = outEdge ? (nodes as any[]).find((n: any) => n.id === outEdge.target) : null;
                              const connectedMeta = connectedNode ? NODE_TYPE_META[connectedNode.data?.flowType as FlowNodeType] : null;
                              const nodesWithIncoming = new Set((edges as any[]).map((e: any) => e.target));
                              const freeNodes = (nodes as any[]).filter((n: any) =>
                                n.id !== editingNode.nodeId &&
                                n.data?.flowType !== 'start' &&
                                !nodesWithIncoming.has(n.id)
                              );
                              return (
                                <div className="space-y-3">
                                  {/* Connected component - Visual card with icon */}
                                  <div className="relative">
                                    {/* Connection line */}
                                    <div className="absolute left-5 -top-3 w-0.5 h-3 bg-[#060541]/30" />
                                    
                                    <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-[#060541]/20 bg-[#060541]/5 dark:bg-white/5">
                                      <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm"
                                        style={{ background: connectedMeta?.color || '#ef4444' }}
                                      >
                                        <span className="text-white">{connectedMeta?.icon || '🔚'}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground">
                                          {connectedNode && connectedMeta
                                            ? (connectedNode.data?.label || (isRTL ? connectedMeta.labelAr : connectedMeta.label))
                                            : (isRTL ? 'نهاية المحادثة' : 'End Conversation')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {connectedNode ? (isRTL ? 'متصل' : 'Connected') : (isRTL ? 'توقف هنا' : 'Stop here')}
                                        </p>
                                      </div>
                                      {outEdge && (
                                        <button
                                          onClick={() => setEdges((eds: any[]) => eds.filter((ed: any) => ed.id !== outEdge.id))}
                                          className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all shrink-0 border border-red-200 dark:border-red-900/30"
                                          title={isRTL ? 'فصل الاتصال' : 'Disconnect'}
                                        >
                                          <X className="h-5 w-5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {/* Available components - Horizontal scroll or grid */}
                                  {freeNodes.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs text-muted-foreground font-medium">
                                        {isRTL ? 'أو اختر مكوّناً للربط:' : 'Or connect to:'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {freeNodes.slice(0, 4).map((n: any) => {
                                          const nm = NODE_TYPE_META[n.data?.flowType as FlowNodeType];
                                          return (
                                            <button
                                              key={n.id}
                                              onClick={() => {
                                                setEdges((eds: any[]) => {
                                                  const filtered = eds.filter((ed: any) => ed.source !== editingNode.nodeId);
                                                  return [...filtered, {
                                                    id: `e-${editingNode.nodeId}-${n.id}`,
                                                    source: editingNode.nodeId,
                                                    target: n.id,
                                                    markerEnd: { type: MarkerType.ArrowClosed },
                                                    style: { strokeWidth: 2, cursor: 'pointer' },
                                                  }];
                                                });
                                              }}
                                              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-border/50 bg-background hover:border-[#060541]/40 hover:bg-[#060541]/5 active:scale-[0.98] transition-all"
                                            >
                                              <span 
                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                                                style={{ background: nm?.color || '#f0f0f0' }}
                                              >
                                                <span className="text-white">{nm?.icon || '•'}</span>
                                              </span>
                                              <span className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2">
                                                {n.data?.label || (isRTL ? nm?.labelAr : nm?.label) || 'Component'}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {freeNodes.length > 4 && (
                                        <p className="text-xs text-muted-foreground text-center">
                                          +{freeNodes.length - 4} {isRTL ? 'المزيد' : 'more'}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Empty state - Quick add button */}
                                  {freeNodes.length === 0 && !outEdge && (
                                    <button
                                      onClick={() => { setShowAddMenu(true); setAddComponentSearch(''); }}
                                      className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[#060541]/30 text-[#060541] dark:text-white/80 hover:border-[#060541] hover:bg-[#060541]/5 transition-all active:scale-[0.98]"
                                    >
                                      <Plus className="h-5 w-5" />
                                      <span className="text-sm font-semibold">
                                        {isRTL ? 'إضافة مكوّن جديد' : 'Add new component'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Save button */}
                {!isStart && (
                  <div className="px-4 sm:px-5 py-4 sm:py-3 border-t border-border/40 shrink-0 bg-card" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                    <Button
                      className="w-full bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] rounded-xl h-12 sm:h-10 text-base sm:text-sm font-bold active:scale-[0.98] transition-all shadow-lg"
                      onClick={handleSave}
                    >
                      <Save className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                      {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>
    );
  };

  // ============================================
  // RENDER: FLOW NODE CHIP (for dashboard strip)
  // ============================================
  const renderFlowNode = (n: any, i: number, total: number) => {
    const meta = NODE_TYPE_META[n.data?.flowType as FlowNodeType];
    if (!meta) return null;
    const isLast = i === total - 1;
    return (
      <React.Fragment key={n.id}>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold shrink-0 border"
          style={{ background: meta.color + '15', borderColor: meta.color + '40', color: meta.color }}
        >
          <span style={{ fontSize: '12px', lineHeight: 1 }}>{meta.icon}</span>
          <span className="whitespace-nowrap" style={{ color: 'inherit' }}>{n.data?.label || meta.label}</span>
        </div>
        {!isLast && (
          <div className="flex items-center shrink-0">
            <div className="w-4 h-px bg-border/50" />
            <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px]" style={{ borderLeftColor: 'hsl(var(--border))' }} />
          </div>
        )}
      </React.Fragment>
    );
  };

  // ============================================
  // RENDER: BOT DASHBOARD
  // ============================================
  const renderDashboard = () => {
    if (!activeBot) return null;
    const accentColor = activeBot.primary_color || '#060541';

    const saveKnowledgeBase = async () => {
      setSavingKB(true);
      try {
        await ChatbotService.updateBot(activeBot.id, { knowledge_base: knowledgeBase });
        setActiveBot(prev => prev ? { ...prev, knowledge_base: knowledgeBase } : null);
        setBots(prev => prev.map(b => b.id === activeBot.id ? { ...b, knowledge_base: knowledgeBase } : b));
        toast.success(isRTL ? 'تم الحفظ!' : 'Knowledge base saved!');
      } catch { toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save'); }
      finally { setSavingKB(false); }
    };

    const isIgConnected = !!(activeBot?.instagram_business_account_id);
    const igHandle = activeBot?.instagram_page_name ? `@${activeBot.instagram_page_name}` : null;

    const SETUP_ITEMS = [
      ...(activeBot?.platform === 'instagram' ? [{
        icon: <Instagram className="h-5 w-5" />,
        label: isRTL ? 'ربط حساب انستقرام' : 'Connect Instagram Account',
        desc: isIgConnected
          ? (isRTL ? `متصل: ${igHandle || activeBot.instagram_business_account_id}` : `Connected: ${igHandle || activeBot.instagram_business_account_id}`)
          : (isRTL ? 'اربط حساب انستقرام البروفيشنال الخاص بك حتى يستقبل البوت الرسائل' : 'Connect your Instagram Professional account so the bot can receive DMs.'),
        action: () => {
          const origin = window.location.hostname === 'localhost' ? 'https://wakti.qa' : window.location.origin;
          window.location.href = buildInstagramOAuthUrl(activeBot.id, origin);
        },
        cta: isIgConnected ? (isRTL ? '✅ متصل' : '✅ Connected') : (isRTL ? 'ربط انستقرام' : 'Connect Instagram'),
        reconnectCta: isIgConnected ? (isRTL ? '🔄 إعادة ربط' : '🔄 Reconnect') : null,
        required: true,
        color: isIgConnected ? '#10b981' : '#e1306c',
        connected: isIgConnected,
      }] : []),
      {
        icon: '🔀',
        label: isRTL ? 'تعديل تدفق المحادثة' : 'Edit Your Chat Flow',
        desc: isRTL ? 'ابنِ تدفقات محادثة جذابة لمستخدمي البوت' : 'Build engaging conversation flows for your bot users.',
        action: () => openBotBuilder(activeBot),
        cta: isRTL ? 'فتح المحرر' : 'Open Builder',
        required: true,
        color: '#3b82f6',
      },
      {
        icon: '📚',
        label: isRTL ? 'قاعدة المعرفة' : 'Train Your AI (Knowledge Base)',
        desc: isRTL ? 'أضف معلومات لتدريب الذكاء الاصطناعي على الإجابة بدقة' : 'Add info to train AI on your products, FAQs, and more.',
        action: null,
        cta: null,
        required: true,
        color: '#8b5cf6',
        expandable: true,
      },
      {
        icon: '🎨',
        label: isRTL ? 'تصميم البوت' : 'Design Your Chatbot',
        desc: isRTL ? 'خصص مظهر وألوان البوت' : 'Manage the look and feel of your chatbot.',
        action: () => setStep('designer'),
        cta: isRTL ? 'تخصيص' : 'Customize',
        required: true,
        color: '#10b981',
      },
      ...(activeBot?.platform !== 'instagram' ? [{
        icon: '🚀',
        label: isRTL ? 'تثبيت البوت' : 'Install Your Chatbot',
        desc: isRTL ? 'ثبّت البوت على موقعك أو تطبيقك' : 'Install your chatbot on website, mobile app or as embedded chatbot.',
        action: () => copyEmbedCode(activeBot.embed_token),
        cta: isRTL ? 'نسخ كود التضمين' : 'Copy Embed Code',
        required: true,
        color: '#f59e0b',
      }] : []),
    ];

    const ENHANCEMENT_ITEMS = [
      {
        icon: '⚡',
        label: isRTL ? 'إعدادات الذكاء الاصطناعي' : 'AI Settings',
        desc: isRTL ? 'خصص شخصية البوت وإعداداته' : "Configure bot's personality and ChatGPT model.",
        action: () => setStep('ai-settings'),
        color: '#0ea5e9',
      },
      {
        icon: '⚙️',
        label: isRTL ? 'إعدادات البوت' : "Configure Bot's Settings",
        desc: isRTL ? 'إعدادات متقدمة للبوت' : 'Advanced settings for your bot.',
        action: () => openBotBuilder(activeBot),
        color: '#64748b',
      },
    ];

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <div className="flex mb-6">
          <button
            onClick={() => { setActiveBot(null); setStep('list'); }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl active:scale-95 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {isRTL ? 'رجوع' : 'Back'}
          </button>
        </div>

        {/* Bot header */}
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            activeBot.platform === 'instagram'
              ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white"
              : ""
          )} style={activeBot.platform !== 'instagram' ? { background: accentColor + '20' } : undefined}>
            {activeBot.platform === 'instagram' ? <Instagram className="h-5 w-5" /> : <Bot className="h-5 w-5" style={{ color: accentColor }} />}
          </div>
          <div className="flex-1 min-w-0">
            {editingBotName ? (
              <input
                autoFocus
                value={botNameDraft}
                onChange={(e) => setBotNameDraft(e.target.value)}
                onBlur={async () => {
                  const name = botNameDraft.trim();
                  if (name && name !== activeBot.name) {
                    await ChatbotService.updateBot(activeBot.id, { name });
                    setActiveBot(prev => prev ? { ...prev, name } : null);
                    setBots(prev => prev.map(b => b.id === activeBot.id ? { ...b, name } : b));
                    toast.success(isRTL ? 'تم تغيير الاسم' : 'Name updated!');
                  }
                  setEditingBotName(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingBotName(false); }}
                className="text-xl font-bold bg-transparent border-b-2 border-[#060541] dark:border-white outline-none w-full text-foreground"
              />
            ) : (
              <button
                className="flex items-center gap-2 group"
                onClick={() => { setBotNameDraft(activeBot.name); setEditingBotName(true); }}
              >
                <h1 className="text-xl font-bold text-foreground">{activeBot.name}</h1>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground capitalize">{activeBot.platform} · {activeBot.purpose || 'general'}</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", activeBot.is_active ? "bg-emerald-500" : "bg-zinc-300")} />
              <span className="text-xs text-muted-foreground">{activeBot.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'متوقف' : 'Inactive')}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant={activeBot.is_active ? 'default' : 'outline'}
              className={cn("h-8 text-xs rounded-lg gap-1.5", activeBot.is_active && "bg-emerald-600 hover:bg-emerald-700 text-white")}
              onClick={() => toggleBotActive(activeBot)}
            >
              <Power className="h-3.5 w-3.5" />
              {activeBot.is_active ? (isRTL ? 'إيقاف' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}
            </Button>
          </div>
        </div>

        {/* Status banner */}
        <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            {isRTL ? '✅ مساحة البوت جاهزة. يمكنك البث المباشر بعد الإعداد.' : '✅ Your bot space is ready. You can go live once you configure your bot.'}
          </p>
        </div>

        {/* ── Flow Visualization ── */}
        {nodes.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {isRTL ? 'تدفق المحادثة الحالي' : 'Current Chat Flow'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  {isRTL ? 'اختبر البوت' : 'Test Bot'}
                </button>
                <button
                  onClick={() => openBotBuilder(activeBot)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-[#060541] dark:text-white/80 bg-muted/60 hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  {isRTL ? 'تعديل' : 'Edit'}
                </button>
              </div>
            </div>
            {/* Scrollable node strip */}
            <div className="rounded-xl border border-border/40 bg-muted/30 dark:bg-muted/20 px-3 py-2.5 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 min-w-max">
                {(() => {
                  // Build ordered node list by following edges from start
                  const nodeMap: Record<string, any> = {};
                  nodes.forEach((n: any) => { nodeMap[n.id] = n; });
                  const edgeMap: Record<string, string[]> = {};
                  edges.forEach((e: any) => {
                    if (!edgeMap[e.source]) edgeMap[e.source] = [];
                    edgeMap[e.source].push(e.target);
                  });
                  const startNode = nodes.find((n: any) => n.data?.flowType === 'start');
                  if (!startNode) return nodes.slice(0, 8).map((n: any, i: number) => renderFlowNode(n, i, nodes.length));

                  const ordered: any[] = [];
                  const visited = new Set<string>();
                  const walk = (id: string) => {
                    if (visited.has(id) || ordered.length > 12) return;
                    visited.add(id);
                    const node = nodeMap[id];
                    if (node) ordered.push(node);
                    (edgeMap[id] || []).forEach(walk);
                  };
                  walk(startNode.id);
                  // Add any orphan nodes not visited
                  nodes.forEach((n: any) => { if (!visited.has(n.id) && ordered.length < 12) ordered.push(n); });
                  return ordered.map((n: any, i: number) => renderFlowNode(n, i, ordered.length));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Required Setup */}
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          {isRTL ? 'الإعداد المطلوب' : 'Required Setup'} <span className="text-red-500">*</span>
        </p>
        <div className="rounded-2xl border border-border/50 bg-white dark:bg-card overflow-hidden mb-6 divide-y divide-border/40">
          {SETUP_ITEMS.map((item, i) => (
            <div key={i}>
              {/* Knowledge base expandable */}
              {item.expandable ? (
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: item.color + '18' }}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <KnowledgeBaseEditor
                    value={knowledgeBase}
                    onChange={setKnowledgeBase}
                    onSave={saveKnowledgeBase}
                    saving={savingKB}
                    isRTL={isRTL}
                  />
                </div>
              ) : (
                <button
                  className="w-full flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors text-left group"
                  onClick={item.action || undefined}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5" style={{ background: item.color + '18' }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm text-foreground leading-snug">{item.label}</p>
                      <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    {item.cta && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                          (item as any).connected
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'border border-[#060541]/20 dark:border-white/20 text-[#060541] dark:text-white group-hover:bg-[#060541] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-[#060541]'
                        }`}>
                          {item.cta}
                        </span>
                        {(item as any).reconnectCta && (
                          <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg border border-orange-400/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors cursor-pointer">
                            {(item as any).reconnectCta}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Recommended Enhancements */}
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          {isRTL ? 'تحسينات مقترحة' : 'Recommended Enhancements'}
        </p>
        <div className="rounded-2xl border border-border/50 bg-white dark:bg-card overflow-hidden divide-y divide-border/40">
          {ENHANCEMENT_ITEMS.map((item, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left group opacity-70 hover:opacity-100"
              onClick={item.action}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: item.color + '18' }}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("relative h-full min-h-[calc(100vh-64px)]", isRTL && "rtl")}>

      {/* ── Global Flow Preview Modal ── works from any step */}
      {showPreview && activeBot && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
            title="Close preview"
            style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-2xl active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
            {isRTL ? 'إغلاق' : 'Close'}
          </button>
          <div
            className="relative w-[390px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ height: 'min(660px, calc(100vh - 96px))', marginTop: 56 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-zinc-900 h-8 flex items-center justify-center shrink-0 rounded-t-2xl">
              <div className="w-16 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex-1 min-h-0">
              <Suspense fallback={<div className="flex items-center justify-center h-full bg-white"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>}>
                <ChatbotWidget
                  token=""
                  isPreview
                  previewBot={activeBot}
                  previewNodes={nodes.map((n: any) => ({ node_id: n.id, type: n.data.flowType, label: n.data.label, data: n.data }))}
                  previewEdges={edges.map((e: any) => ({ edge_id: e.id, source_node_id: e.source, target_node_id: e.target, source_handle: e.sourceHandle || null, label: e.label || null }))}
                />
              </Suspense>
            </div>
            <div className="bg-zinc-900 h-6 flex items-center justify-center rounded-b-2xl shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>
          </div>
        </div>
      )}

      {step === 'list' && renderBotList()}
      {step === 'platform' && renderPlatformSelect()}
      {step === 'instagram-connect' && renderInstagramConnect()}
      {step === 'purpose' && renderPurposeSelect()}
      {step === 'dashboard' && renderDashboard()}
      {step === 'builder' && renderBuilder()}
      {step === 'designer' && activeBot && (
        <div className="builder-fill">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <ChatbotDesigner
              bot={activeBot}
              isRTL={isRTL}
              onBack={() => setStep('dashboard')}
              onSave={(updated) => {
                setActiveBot(updated);
                setBots(prev => prev.map(b => b.id === updated.id ? updated : b));
                setStep('dashboard');
              }}
            />
          </Suspense>
        </div>
      )}
      {step === 'ai-settings' && activeBot && (
        <Suspense fallback={<div className="flex items-center justify-center h-full py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <ChatbotAISettings
            bot={activeBot}
            isRTL={isRTL}
            onBack={() => setStep('dashboard')}
            onSave={(updated) => {
              setActiveBot(updated);
              setBots(prev => prev.map(b => b.id === updated.id ? updated : b));
              setStep('dashboard');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
