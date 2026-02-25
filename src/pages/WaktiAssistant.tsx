// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
const ChatbotDesigner = lazy(() => import('@/components/chatbot/ChatbotDesigner'));
const ChatbotAISettings = lazy(() => import('@/components/chatbot/ChatbotAISettings'));
import SharedInboxUI from '@/components/chatbot/SharedInboxUI';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChatbotBot,
  ChatbotService,
  NODE_TYPE_META,
  PURPOSE_TEMPLATES,
  FlowNodeType,
} from '@/services/chatbotService';

// ============================================
// CUSTOM FLOW NODE COMPONENT
// ============================================
function ChatFlowNode({ data, type: nodeType }: any) {
  const meta = NODE_TYPE_META[data.flowType as FlowNodeType];
  if (!meta) return null;

  const isStart = data.flowType === 'start';
  const isEnd = data.flowType === 'end';
  const isChoice = data.flowType === 'single_choice';

  return (
    <div
      className="relative rounded-xl border-2 shadow-lg min-w-[180px] max-w-[220px] bg-white dark:bg-zinc-900 overflow-hidden"
      style={{ borderColor: meta.color + '60' }}
    >
      {/* Delete button — hidden for start node */}
      {!isStart && data.onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete(data.nodeId); }}
          title="Delete node"
          className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center transition-colors duration-150"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-white text-xs font-bold pr-7"
        style={{ background: meta.color }}
      >
        <span className="text-sm">{meta.icon}</span>
        <span className="truncate">{data.label || meta.label}</span>
      </div>

      {/* Body — tap to edit */}
      <div
        className="px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
        onClick={() => data.onEdit && data.onEdit(data)}
      >
        <span>{data.text || data.prompt || meta.description}</span>
        {data.onEdit && !isStart && (
          <span className="ml-1 opacity-0 group-hover:opacity-60 transition-opacity text-[9px] font-medium text-zinc-400">✏️ tap to edit</span>
        )}
      </div>

      {/* Choice options preview */}
      {isChoice && data.options && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {(data.options as any[]).slice(0, 3).map((opt: any, i: number) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {typeof opt === 'string' ? opt : opt.en || opt.ar}
            </span>
          ))}
        </div>
      )}

      {/* Handles */}
      {!isStart && (
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-white dark:!border-zinc-900" />
      )}
      {!isEnd && (
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white dark:!border-zinc-900" style={{ background: meta.color }} />
      )}
      {/* Extra handles for choice nodes */}
      {isChoice && data.options && (data.options as any[]).map((_: any, i: number) => (
        <Handle
          key={`option-${i}`}
          type="source"
          position={Position.Right}
          id={`option-${i}`}
          className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-zinc-900"
          style={{ background: meta.color, top: `${40 + (i + 1) * 22}%` }}
        />
      ))}
    </div>
  );
}

const nodeTypes = { chatFlowNode: ChatFlowNode };

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
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [savingKB, setSavingKB] = useState(false);
  const [editingBotName, setEditingBotName] = useState(false);
  const [botNameDraft, setBotNameDraft] = useState('');
  const [builderRect, setBuilderRect] = useState<{top:number;left:number;right:number;bottom:number} | null>(null);

  // Instagram connect flow state (must live at top-level, not inside render function)
  const [igConnecting, setIgConnecting] = useState(false);
  const [igSubStep, setIgSubStep] = useState<'login' | 'select_page'>('login');
  const [igSelectedPage, setIgSelectedPage] = useState<string | null>(null);

  // When builder opens: measure the scroll container and lock its scroll
  useEffect(() => {
    const el = document.getElementById('projects-scroll');
    if (!el) return;
    if (step === 'builder' || step === 'designer') {
      el.classList.add('overflow-hidden');
    } else {
      el.classList.remove('overflow-hidden');
    }
    if (step === 'builder') {
      const rect = el.getBoundingClientRect();
      setBuilderRect({ top: rect.top, left: rect.left, right: window.innerWidth - rect.right, bottom: 0 });
    } else {
      setBuilderRect(null);
    }
  }, [step]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }, eds));
  }, [setEdges]);

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
      const rfNodes = flow.nodes.map(n => ({
        id: n.node_id,
        type: 'chatFlowNode',
        position: { x: n.position_x, y: n.position_y },
        data: { ...n.data, flowType: n.type, label: n.label, nodeId: n.node_id, onDelete: deleteNode, onEdit: editNode },
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
  }, []);

  const saveNodeEdit = (nodeId: string, updates: Record<string, any>) => {
    setNodes((nds) => nds.map((n: any) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    setEditingNode(null);
  };

  const addNode = (type: FlowNodeType) => {
    const meta = NODE_TYPE_META[type];
    const id = `${type}-${Date.now()}`;
    const newNode = {
      id,
      type: 'chatFlowNode',
      position: { x: Math.random() * 400 + 200, y: Math.random() * 300 },
      data: {
        flowType: type,
        label: meta.label,
        text: '',
        prompt: '',
        nodeId: id,
        onDelete: deleteNode,
        onEdit: editNode,
        options: type === 'single_choice' || type === 'multiple_choice'
          ? [{ en: 'Option 1', ar: 'خيار 1' }, { en: 'Option 2', ar: 'خيار 2' }]
          : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowAddMenu(false);
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
    const code = `<script src="https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/chatbot-widget?token=${token}" async></script>`;
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
        <button onClick={() => setStep('list')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:text-[#060541] dark:hover:text-white bg-white dark:bg-white/8 hover:bg-[#060541]/5 dark:hover:bg-white/12 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all duration-200">
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

        {/* Instagram - Coming Soon */}
        <div
          className="relative rounded-2xl border-2 text-left overflow-hidden bg-white dark:bg-card border-border/40 opacity-60 cursor-not-allowed"
        >
          {/* Coming Soon badge */}
          <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow">
            {isRTL ? 'قريباً' : 'Coming Soon'}
          </div>
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
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: INSTAGRAM CONNECT
  // ============================================
  const renderInstagramConnect = () => {
    const mockPages = [
      { id: '1', name: 'Wakti Official', handle: '@wakti.ai', followers: '12.4k' },
      { id: '2', name: 'My Personal Store', handle: '@mystore', followers: '840' },
    ];

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex mb-8">
          <button 
            onClick={() => {
              if (igSubStep === 'select_page') setIgSubStep('login');
              else setStep('platform');
            }} 
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:text-[#060541] dark:hover:text-white bg-white dark:bg-white/8 hover:bg-[#060541]/5 dark:hover:bg-white/12 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all duration-200"
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

              <Button
                onClick={() => {
                  setIgConnecting(true);
                  setTimeout(() => {
                    setIgConnecting(false);
                    setIgSubStep('select_page');
                  }, 1500);
                }}
                disabled={igConnecting}
                className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all gap-2"
              >
                {igConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Instagram className="h-5 w-5" />}
                {isRTL ? 'تسجيل الدخول' : 'Login'}
              </Button>
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

              <div className="space-y-3 mb-8">
                {mockPages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => setIgSelectedPage(page.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200",
                      igSelectedPage === page.id
                        ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10"
                        : "border-border/40 hover:border-border"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-0.5 shrink-0">
                      <div className="w-full h-full bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-foreground">
                        {page.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate">{page.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{page.handle}</span>
                        <span>·</span>
                        <span>{page.followers} {isRTL ? 'متابع' : 'followers'}</span>
                      </div>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      igSelectedPage === page.id ? "border-[#060541] dark:border-white bg-[#060541] dark:bg-white" : "border-muted-foreground/30"
                    )}>
                      {igSelectedPage === page.id && <Check className="h-3 w-3 text-white dark:text-[#060541]" />}
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={() => {
                  toast.success(isRTL ? 'تم ربط الحساب بنجاح!' : 'Account connected successfully!');
                  setStep('purpose');
                }}
                disabled={!igSelectedPage}
                className="w-full h-12 text-base font-semibold bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-[#060541] rounded-xl shadow-md transition-all"
              >
                {isRTL ? 'متابعة' : 'Continue'}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };
  const renderPurposeSelect = () => (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex mb-8">
        <button onClick={() => setStep('platform')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:text-[#060541] dark:hover:text-white bg-white dark:bg-white/8 hover:bg-[#060541]/5 dark:hover:bg-white/12 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all duration-200">
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

    const fixedStyle = builderRect
      ? { position: 'fixed' as const, top: builderRect.top, left: builderRect.left, right: builderRect.right, bottom: 0, zIndex: 1000 }
      : undefined;

    return (
      <div className="builder-fill" style={fixedStyle}>
        {/* Builder Header */}
        <div className="builder-header flex flex-col bg-white dark:bg-[#0c0f14]">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#060541] dark:text-white/80 bg-white dark:bg-white/8 hover:bg-[#060541]/5 border border-[#060541]/20 dark:border-white/15 px-3 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all duration-200 shrink-0"
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

            {/* Active toggle */}
            <Button
              size="sm"
              variant={activeBot.is_active ? "default" : "outline"}
              className={cn("gap-1.5 text-xs rounded-lg h-7 px-2.5 shrink-0", activeBot.is_active && "bg-emerald-600 hover:bg-emerald-700 text-white border-0")}
              onClick={() => toggleBotActive(activeBot)}
            >
              <Power className="h-3 w-3" />
              <span className="hidden sm:inline">{activeBot.is_active ? (isRTL ? 'نشط' : 'Live') : (isRTL ? 'متوقف' : 'Off')}</span>
            </Button>
          </div>

          {/* Save + Embed row */}
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-lg h-8 flex-1 bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-[#f2f2f2] dark:hover:bg-[#f2f2f2]/90 dark:text-[#0c0f14]"
              onClick={handleSaveFlow}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-lg h-8 flex-1"
              onClick={() => copyEmbedCode(activeBot.embed_token)}
            >
              {copiedEmbed ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {isRTL ? 'كود التضمين' : 'Embed'}
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="builder-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2 },
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
            <MiniMap
              className="!rounded-xl !border-border/50 !shadow-lg hidden sm:block"
              nodeColor={(n: any) => {
                const meta = NODE_TYPE_META[n.data?.flowType as FlowNodeType];
                return meta?.color || '#6366f1';
              }}
              maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
            />
          </ReactFlow>

          {/* Floating Add FAB — always visible on canvas */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white shadow-xl active:scale-95 transition-all duration-200"
                style={{ background: '#060541', boxShadow: '0 4px 20px rgba(6,5,65,0.4)' }}
              >
                <Plus className="h-4 w-4" />
                {isRTL ? 'إضافة مكوّن' : 'Add Component'}
              </button>

              {/* Add Component Menu — opens upward from FAB */}
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-72 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-border/50 flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {isRTL ? 'المكونات' : 'Components'}
                      </p>
                      <button onClick={() => setShowAddMenu(false)} className="p-1 rounded-lg hover:bg-muted">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto p-2">
                      {/* AI */}
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 mt-1">
                        {isRTL ? 'ذكاء اصطناعي' : 'AI'}
                      </p>
                      {(['ai_response'] as FlowNodeType[]).map(type => {
                        const meta = NODE_TYPE_META[type];
                        return (
                          <button key={type} onClick={() => addNode(type)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/80 transition-colors text-left">
                            <span className="text-xl w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: meta.color + '20' }}>{meta.icon}</span>
                            <div>
                              <p className="text-sm font-semibold">{isRTL ? meta.labelAr : meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{isRTL ? meta.descriptionAr : meta.description}</p>
                            </div>
                          </button>
                        );
                      })}
                      {/* Collect Info */}
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 mt-2">
                        {isRTL ? 'جمع المعلومات' : 'Collect Info'}
                      </p>
                      {(['name', 'email', 'phone', 'single_choice', 'multiple_choice'] as FlowNodeType[]).map(type => {
                        const meta = NODE_TYPE_META[type];
                        return (
                          <button key={type} onClick={() => addNode(type)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/80 transition-colors text-left">
                            <span className="text-xl w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: meta.color + '20' }}>{meta.icon}</span>
                            <div>
                              <p className="text-sm font-semibold">{isRTL ? meta.labelAr : meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{isRTL ? meta.descriptionAr : meta.description}</p>
                            </div>
                          </button>
                        );
                      })}
                      {/* Actions */}
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 mt-2">
                        {isRTL ? 'إجراءات' : 'Actions'}
                      </p>
                      {(['appointment', 'rating', 'live_chat', 'message', 'end'] as FlowNodeType[]).map(type => {
                        const meta = NODE_TYPE_META[type];
                        return (
                          <button key={type} onClick={() => addNode(type)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/80 transition-colors text-left">
                            <span className="text-xl w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: meta.color + '20' }}>{meta.icon}</span>
                            <div>
                              <p className="text-sm font-semibold">{isRTL ? meta.labelAr : meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{isRTL ? meta.descriptionAr : meta.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Node Edit Bottom Sheet */}
        {editingNode && (() => {
          const meta = NODE_TYPE_META[editingNode.flowType as FlowNodeType];
          const isChoice = editingNode.flowType === 'single_choice' || editingNode.flowType === 'multiple_choice';
          let localText = editingNode.text || editingNode.prompt || '';
          let localOptions: string[] = (editingNode.options || []).map((o: any) =>
            typeof o === 'string' ? o : o.en || ''
          );
          return (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditingNode(null)} />
              {/* Sheet */}
              <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-2xl border-t border-border/50 flex flex-col" style={{ maxHeight: '50vh' }}>
                {/* Handle + Header — pinned */}
                <div className="px-4 pt-3 pb-3 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm shrink-0" style={{ background: meta?.color }}>
                      {meta?.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{isRTL ? meta?.labelAr : meta?.label}</p>
                      <p className="text-[10px] text-muted-foreground">{isRTL ? 'اضغط حفظ بعد التعديل' : 'Edit then tap Save'}</p>
                    </div>
                    <button onClick={() => setEditingNode(null)} className="ml-auto p-1.5 rounded-lg hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 min-h-0">
                  {/* Message text field */}
                  {!isChoice && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        {isRTL ? 'نص الرسالة' : 'Message text'}
                      </label>
                      <textarea
                        defaultValue={localText}
                        onChange={(e) => { localText = e.target.value; }}
                        rows={3}
                        className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30 resize-none"
                        placeholder={isRTL ? 'اكتب الرسالة...' : 'Type the message...'}
                      />
                    </div>
                  )}

                  {/* Choice options */}
                  {isChoice && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        {isRTL ? 'الخيارات' : 'Options'}
                      </label>
                      <div className="space-y-2">
                        {localOptions.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              defaultValue={opt}
                              onChange={(e) => { localOptions[i] = e.target.value; }}
                              className="flex-1 border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30"
                              placeholder={`${isRTL ? 'خيار' : 'Option'} ${i + 1}`}
                            />
                            <button
                              onClick={() => { localOptions = localOptions.filter((_, j) => j !== i); }}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => { localOptions = [...localOptions, '']; }}
                          className="w-full py-2 rounded-xl border-2 border-dashed border-border/50 text-xs text-muted-foreground hover:border-[#060541]/30 transition-colors"
                        >
                          + {isRTL ? 'إضافة خيار' : 'Add option'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save button — always pinned at bottom */}
                <div className="px-4 py-3 shrink-0 border-t border-border/30">
                  <Button
                    className="w-full bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] rounded-xl h-11"
                    onClick={() => {
                      const updates: Record<string, any> = {};
                      if (isChoice) {
                        updates.options = localOptions.filter(Boolean).map(o => ({ en: o, ar: o }));
                      } else {
                        if (editingNode.flowType === 'ai_response') updates.prompt = localText;
                        else updates.text = localText;
                      }
                      saveNodeEdit(editingNode.nodeId, updates);
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </div>
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

    const SETUP_ITEMS = [
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
      {
        icon: '🚀',
        label: isRTL ? 'تثبيت البوت' : 'Install Your Chatbot',
        desc: isRTL ? 'ثبّت البوت على موقعك أو تطبيقك' : 'Install your chatbot on website, mobile app or as embedded chatbot.',
        action: () => copyEmbedCode(activeBot.embed_token),
        cta: isRTL ? 'نسخ كود التضمين' : 'Copy Embed Code',
        required: true,
        color: '#f59e0b',
      },
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:text-[#060541] dark:hover:text-white bg-white dark:bg-white/8 hover:bg-[#060541]/5 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all duration-200"
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
        <div className="mb-6 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            {isRTL ? '✅ مساحة البوت جاهزة. يمكنك البث المباشر بعد الإعداد.' : '✅ Your bot space is ready. You can go live once you configure your bot.'}
          </p>
        </div>

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
                  <textarea
                    value={knowledgeBase}
                    onChange={(e) => setKnowledgeBase(e.target.value)}
                    rows={4}
                    className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30 resize-none mb-2"
                    placeholder={isRTL ? 'أضف معلومات عن منتجاتك، الأسئلة الشائعة، ساعات العمل...' : 'Add info about your products, FAQs, business hours, policies...'}
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs rounded-lg bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541]"
                    onClick={saveKnowledgeBase}
                    disabled={savingKB}
                  >
                    {savingKB ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              ) : (
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left group"
                  onClick={item.action || undefined}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: item.color + '18' }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.cta && (
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#060541]/20 dark:border-white/20 text-[#060541] dark:text-white group-hover:bg-[#060541] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-[#060541] transition-colors">
                        {item.cta}
                      </span>
                    )}
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
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
