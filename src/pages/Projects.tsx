import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import ShareButton from '@/components/ui/ShareButton';
import { 
  Code2, 
  Trash2, 
  Loader2, 
  Paperclip,
  Send,
  MessageSquare,
  Image as ImageIcon,
  ChevronDown,
  Sparkles,
  Eye,
  Plus,
  X,
  Palette,
  Type,
  Layers,
  Square,
  Sun,
  Moon,
  Settings2,
  Share2,
  Copy,
  Check,
  Globe,
  Server,
  Bot
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
  subdomain: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  files?: Record<string, string>;
}

const MAX_PROJECTS = 2;

// Project Preview Thumbnail Component - premium fallback card
const ProjectPreviewThumbnail = ({ project, isRTL }: { project: Project; isRTL: boolean }) => {
  return (
    <div className="aspect-video relative overflow-hidden bg-[#0c0f14]">
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-85"
        />
      ) : null}

      <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(210_100%_60%)_0%,hsl(280_70%_65%)_50%,hsl(25_95%_60%)_100%)] opacity-35" />
      <div className="absolute -inset-10 bg-[radial-gradient(closest-side,hsla(210,100%,65%,0.35),transparent)]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur px-2 py-1">
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
          <Code2 className="h-3.5 w-3.5 text-white/80" />
        </div>
        <div className="text-[11px] font-semibold text-white/90">
          {isRTL ? 'وقتي' : 'Wakti'}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-11 h-11 rounded-full bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
          <Eye className="h-6 w-6 text-white drop-shadow" />
        </div>
      </div>
    </div>
  );
};

// Theme settings type
type ThemeSettings = {
  fontStyle: 'modern' | 'classic' | 'playful' | 'minimal' | 'bold';
  shadowStyle: 'none' | 'soft' | 'hard' | 'glow' | 'neon';
  borderRadius: 'none' | 'subtle' | 'rounded' | 'pill';
  layoutStyle: 'cards' | 'minimal' | 'bento' | 'magazine';
  mood: 'professional' | 'playful' | 'elegant' | 'bold' | 'calm';
};

// Expanded theme collection with full settings (Lovable-style)
const THEMES: Array<{
  id: string;
  name: string;
  nameAr: string;
  colors: string[];
  settings?: ThemeSettings;
  isDefault?: boolean;
}> = [
  // Add User Prompt as first option and set as default - no colors or settings since they come from prompt
  { id: 'user_prompt', name: 'User Prompt', nameAr: 'من الطلب', colors: [], isDefault: true },
  // Default - let AI decide
  { id: 'none', name: 'Default', nameAr: 'افتراضي', colors: ['#6b7280', '#d1d5db'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'professional' } },
  // Cool tones
  { id: 'glacier', name: 'Glacier', nameAr: 'جليدي', colors: ['#60a5fa', '#a5b4fc', '#c4b5fd', '#e0e7ff'], settings: { fontStyle: 'minimal', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'minimal', mood: 'calm' } },
  { id: 'ocean', name: 'Ocean', nameAr: 'محيطي', colors: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'professional' } },
  { id: 'lavender', name: 'Lavender', nameAr: 'لافندر', colors: ['#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Warm tones
  { id: 'harvest', name: 'Harvest', nameAr: 'حصاد', colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'], settings: { fontStyle: 'bold', shadowStyle: 'hard', borderRadius: 'subtle', layoutStyle: 'magazine', mood: 'bold' } },
  { id: 'sunset', name: 'Sunset', nameAr: 'غروب', colors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'playful' } },
  { id: 'orchid', name: 'Orchid', nameAr: 'أوركيد', colors: ['#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8'], settings: { fontStyle: 'playful', shadowStyle: 'soft', borderRadius: 'pill', layoutStyle: 'cards', mood: 'playful' } },
  { id: 'coral', name: 'Coral', nameAr: 'مرجاني', colors: ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3'], settings: { fontStyle: 'bold', shadowStyle: 'hard', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'bold' } },
  // Nature
  { id: 'emerald', name: 'Emerald', nameAr: 'زمردي', colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'calm' } },
  { id: 'forest', name: 'Forest', nameAr: 'غابة', colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'subtle', layoutStyle: 'minimal', mood: 'calm' } },
  { id: 'solar', name: 'Solar', nameAr: 'شمسي', colors: ['#eab308', '#facc15', '#fde047', '#fef08a'], settings: { fontStyle: 'bold', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'bold' } },
  // Dark & Bold
  { id: 'obsidian', name: 'Obsidian', nameAr: 'أوبسيديان', colors: ['#1e293b', '#334155', '#475569', '#64748b'], settings: { fontStyle: 'minimal', shadowStyle: 'none', borderRadius: 'subtle', layoutStyle: 'minimal', mood: 'professional' } },
  { id: 'brutalist', name: 'Brutalist', nameAr: 'بروتالي', colors: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e'], settings: { fontStyle: 'bold', shadowStyle: 'neon', borderRadius: 'none', layoutStyle: 'bento', mood: 'bold' } },
  { id: 'midnight', name: 'Midnight', nameAr: 'منتصف الليل', colors: ['#1e1b4b', '#312e81', '#4338ca', '#6366f1'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Wakti brand
  { id: 'wakti-dark', name: 'Wakti Dark', nameAr: 'وقتي داكن', colors: ['#0c0f14', '#060541', '#858384', '#f2f2f2'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  { id: 'wakti-light', name: 'Wakti Light', nameAr: 'وقتي فاتح', colors: ['#fcfefd', '#060541', '#e9ceb0', '#f2f2f2'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Vibrant
  { id: 'vibrant', name: 'Vibrant', nameAr: 'حيوي', colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'], settings: { fontStyle: 'bold', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'playful' } },
  { id: 'neon', name: 'Neon', nameAr: 'نيون', colors: ['#22d3ee', '#a3e635', '#facc15', '#f472b6'], settings: { fontStyle: 'bold', shadowStyle: 'neon', borderRadius: 'pill', layoutStyle: 'bento', mood: 'bold' } },
];

// Animated placeholder examples
const PLACEHOLDER_EXAMPLES = [
  { en: 'a gym landing page with pricing...', ar: 'صفحة نادي رياضي مع الأسعار...' },
  { en: 'a Ramadan countdown timer...', ar: 'عداد تنازلي لرمضان...' },
  { en: 'a restaurant menu with ordering...', ar: 'قائمة مطعم مع الطلب...' },
  { en: 'a portfolio for a photographer...', ar: 'معرض أعمال مصور...' },
  { en: 'a math quiz for kids...', ar: 'اختبار رياضيات للأطفال...' },
];

// Onboarding Gallery - Visual examples of what can be built
// Each template has customizable options for the business/product type
const PROJECT_EXAMPLES = [
  { 
    id: 'ecommerce', 
    icon: '🛍️', 
    title: { en: 'Online Store', ar: 'متجر إلكتروني' },
    desc: { en: 'Sell products with cart & checkout', ar: 'بيع منتجات مع سلة وشراء' },
    // Template with {PRODUCT} placeholder that gets replaced
    promptTemplate: { 
      en: 'Create a modern online store for selling {PRODUCT}. Include: beautiful product grid with images and prices, shopping cart, checkout page, and a clean homepage with featured products section.',
      ar: 'أنشئ متجر إلكتروني عصري لبيع {PRODUCT}. يشمل: عرض منتجات جميل مع صور وأسعار، سلة تسوق، صفحة دفع، وصفحة رئيسية مع قسم المنتجات المميزة.'
    },
    options: [
      { en: 'Abayas & Fashion', ar: 'عبايات وأزياء' },
      { en: 'Perfumes & Oud', ar: 'عطور وعود' },
      { en: 'Jewelry & Gold', ar: 'مجوهرات وذهب' },
      { en: 'Electronics', ar: 'إلكترونيات' },
      { en: 'Dates & Sweets', ar: 'تمور وحلويات' },
      { en: 'Handmade Crafts', ar: 'حرف يدوية' },
    ],
    defaultOption: { en: 'Abayas & Fashion', ar: 'عبايات وأزياء' },
    color: 'from-pink-500 to-rose-500'
  },
  { 
    id: 'restaurant', 
    icon: '🍽️', 
    title: { en: 'Restaurant Menu', ar: 'قائمة مطعم' },
    desc: { en: 'Digital menu with ordering', ar: 'قائمة رقمية مع الطلب' },
    promptTemplate: { 
      en: 'Build a {PRODUCT} website with: digital menu organized by categories, beautiful food photos, prices, online ordering system, and contact/location section.',
      ar: 'أنشئ موقع {PRODUCT} مع: قائمة رقمية منظمة بالفئات، صور طعام جميلة، أسعار، نظام طلب أونلاين، وقسم التواصل والموقع.'
    },
    options: [
      { en: 'Restaurant', ar: 'مطعم' },
      { en: 'Cafe & Coffee Shop', ar: 'كافيه ومقهى' },
      { en: 'Bakery', ar: 'مخبز' },
      { en: 'Food Truck', ar: 'عربة طعام' },
      { en: 'Catering Service', ar: 'خدمة تموين' },
    ],
    defaultOption: { en: 'Restaurant', ar: 'مطعم' },
    color: 'from-amber-500 to-orange-500'
  },
  { 
    id: 'portfolio', 
    icon: '📸', 
    title: { en: 'Portfolio', ar: 'معرض أعمال' },
    desc: { en: 'Showcase your work beautifully', ar: 'اعرض أعمالك بشكل جميل' },
    promptTemplate: { 
      en: 'Create a professional {PRODUCT} portfolio website with: stunning gallery/work showcase, about me section, services offered, testimonials, and contact form.',
      ar: 'أنشئ موقع معرض أعمال احترافي لـ{PRODUCT} مع: معرض أعمال مذهل، قسم عني، الخدمات المقدمة، آراء العملاء، ونموذج تواصل.'
    },
    options: [
      { en: 'Photography', ar: 'تصوير فوتوغرافي' },
      { en: 'Graphic Design', ar: 'تصميم جرافيك' },
      { en: 'Web Development', ar: 'تطوير مواقع' },
      { en: 'Interior Design', ar: 'تصميم داخلي' },
      { en: 'Art & Illustration', ar: 'فن ورسم' },
      { en: 'Video Production', ar: 'إنتاج فيديو' },
    ],
    defaultOption: { en: 'Photography', ar: 'تصوير فوتوغرافي' },
    color: 'from-violet-500 to-purple-500'
  },
  { 
    id: 'booking', 
    icon: '📅', 
    title: { en: 'Booking System', ar: 'نظام حجز' },
    desc: { en: 'Appointments & reservations', ar: 'مواعيد وحجوزات' },
    promptTemplate: { 
      en: 'Build a {PRODUCT} booking website with: list of services with prices and duration, appointment scheduling calendar, staff/team section, and contact information.',
      ar: 'أنشئ موقع حجز لـ{PRODUCT} مع: قائمة الخدمات بالأسعار والمدة، تقويم جدولة المواعيد، قسم الفريق، ومعلومات التواصل.'
    },
    options: [
      { en: 'Beauty Salon', ar: 'صالون تجميل' },
      { en: 'Barbershop', ar: 'صالون حلاقة' },
      { en: 'Spa & Wellness', ar: 'سبا وعافية' },
      { en: 'Medical Clinic', ar: 'عيادة طبية' },
      { en: 'Fitness Studio', ar: 'استوديو لياقة' },
      { en: 'Consulting', ar: 'استشارات' },
    ],
    defaultOption: { en: 'Beauty Salon', ar: 'صالون تجميل' },
    color: 'from-emerald-500 to-green-500'
  },
  { 
    id: 'landing', 
    icon: '🚀', 
    title: { en: 'Landing Page', ar: 'صفحة هبوط' },
    desc: { en: 'Convert visitors to customers', ar: 'حوّل الزوار لعملاء' },
    promptTemplate: { 
      en: 'Create a high-converting landing page for a {PRODUCT} with: hero section with call-to-action, features/benefits list, pricing plans, testimonials, FAQ section, and signup/contact form.',
      ar: 'أنشئ صفحة هبوط عالية التحويل لـ{PRODUCT} مع: قسم رئيسي مع زر إجراء، قائمة المميزات والفوائد، خطط الأسعار، آراء العملاء، الأسئلة الشائعة، ونموذج تسجيل/تواصل.'
    },
    options: [
      { en: 'Mobile App', ar: 'تطبيق موبايل' },
      { en: 'SaaS Product', ar: 'منتج SaaS' },
      { en: 'Online Course', ar: 'دورة أونلاين' },
      { en: 'Fitness Program', ar: 'برنامج لياقة' },
      { en: 'E-book', ar: 'كتاب إلكتروني' },
      { en: 'Agency Services', ar: 'خدمات وكالة' },
    ],
    defaultOption: { en: 'Mobile App', ar: 'تطبيق موبايل' },
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'event', 
    icon: '🎉', 
    title: { en: 'Event Page', ar: 'صفحة فعالية' },
    desc: { en: 'Weddings, parties, conferences', ar: 'أعراس، حفلات، مؤتمرات' },
    promptTemplate: { 
      en: 'Build a beautiful {PRODUCT} page with: event details and countdown timer, venue/location with map, RSVP form, photo gallery, schedule/agenda, and contact information.',
      ar: 'أنشئ صفحة {PRODUCT} جميلة مع: تفاصيل الفعالية وعداد تنازلي، الموقع مع خريطة، نموذج تأكيد الحضور، معرض صور، الجدول الزمني، ومعلومات التواصل.'
    },
    options: [
      { en: 'Wedding Invitation', ar: 'دعوة زفاف' },
      { en: 'Birthday Party', ar: 'حفلة عيد ميلاد' },
      { en: 'Conference', ar: 'مؤتمر' },
      { en: 'Workshop', ar: 'ورشة عمل' },
      { en: 'Product Launch', ar: 'إطلاق منتج' },
      { en: 'Graduation', ar: 'حفل تخرج' },
    ],
    defaultOption: { en: 'Wedding Invitation', ar: 'دعوة زفاف' },
    color: 'from-fuchsia-500 to-pink-500'
  },
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('user_prompt');
  const [backendStatus, setBackendStatus] = useState<Record<string, boolean>>({});
  const [togglingBackend, setTogglingBackend] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [themeSearch, setThemeSearch] = useState('');
  
  // Template selector state - for customizable project type dropdowns
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateSelections, setTemplateSelections] = useState<Record<string, string>>({});
  const [customTemplateInput, setCustomTemplateInput] = useState('');
  
  // Custom theme creator state
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [customThemes, setCustomThemes] = useState<typeof THEMES>(() => {
    try {
      const saved = localStorage.getItem('wakti_custom_themes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newTheme, setNewTheme] = useState({
    name: '',
    colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
    fontStyle: 'modern' as 'modern' | 'classic' | 'playful' | 'minimal' | 'bold',
    shadowStyle: 'soft' as 'none' | 'soft' | 'hard' | 'glow' | 'neon',
    borderRadius: 'rounded' as 'none' | 'subtle' | 'rounded' | 'pill',
    layoutStyle: 'cards' as 'cards' | 'minimal' | 'bento' | 'magazine',
    mood: 'professional' as 'professional' | 'playful' | 'elegant' | 'bold' | 'calm',
  });
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEmpTooltip, setShowEmpTooltip] = useState(() => {
    // Show tooltip only on first visit (check localStorage)
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('wakti_emp_tooltip_seen');
    }
    return false;
  });

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
      
      // CRITICAL: Filter by user_id to prevent cross-user visibility
      // RLS allows viewing published projects, but "My Projects" should only show own projects
      if (!user?.id) {
        setProjects([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await (supabase
        .from('projects' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }) as any);

      if (error) throw error;
      
      // Fetch backend status for all projects
      if (data && data.length > 0) {
        const projectIds = data.map((p: Project) => p.id);
        const { data: backends } = await (supabase
          .from('project_backends' as any)
          .select('project_id, enabled')
          .in('project_id', projectIds) as any);
        
        if (backends && Array.isArray(backends)) {
          const statusMap: Record<string, boolean> = {};
          (backends as Array<{ project_id: string; enabled: boolean }>).forEach((b) => {
            statusMap[b.project_id] = b.enabled;
          });
          setBackendStatus(statusMap);
        }
      }
      
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

  // Toggle backend for a project
  const toggleBackend = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    setTogglingBackend(projectId);
    try {
      const isEnabled = backendStatus[projectId] || false;
      
      if (isEnabled) {
        // Disable backend
        await supabase
          .from('project_backends' as any)
          .update({ enabled: false })
          .eq('project_id', projectId);
        
        setBackendStatus(prev => ({ ...prev, [projectId]: false }));
        toast.success(isRTL ? 'تم إيقاف الخادم' : 'Server disabled');
      } else {
        // Enable backend - upsert to create if not exists
        const { error } = await supabase
          .from('project_backends' as any)
          .upsert({
            project_id: projectId,
            user_id: user.id,
            enabled: true,
            enabled_at: new Date().toISOString(),
            allowed_origins: ['*'], // Allow all origins by default
          }, { onConflict: 'project_id' });
        
        if (error) throw error;
        
        setBackendStatus(prev => ({ ...prev, [projectId]: true }));
        toast.success(isRTL ? 'تم تفعيل الخادم!' : 'Server enabled!');
      }
    } catch (err) {
      console.error('Error toggling backend:', err);
      toast.error(isRTL ? 'حدث خطأ' : 'Something went wrong');
    } finally {
      setTogglingBackend(null);
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

  // Generate AI instructions from custom theme settings
  const generateThemeInstructions = (theme: typeof newTheme): string => {
    const fontDescriptions = {
      modern: 'Use modern sans-serif fonts like Inter, SF Pro, or system-ui. Clean, geometric letterforms.',
      classic: 'Use elegant serif fonts like Playfair Display, Georgia, or Times. Traditional, refined typography.',
      playful: 'Use rounded, friendly fonts like Nunito, Quicksand, or Comic Neue. Fun, approachable feel.',
      minimal: 'Use thin, light-weight fonts like Roboto Light, Helvetica Neue Thin. Minimalist, airy typography.',
      bold: 'Use heavy, impactful fonts like Montserrat Black, Oswald, or Impact. Strong, attention-grabbing headlines.',
    };
    
    const shadowDescriptions = {
      none: 'No shadows. Flat design with clean edges.',
      soft: 'Soft, diffused shadows (shadow-lg, shadow-xl). Subtle depth and elevation.',
      hard: 'Hard, defined shadows with clear edges. Bold, graphic look.',
      glow: 'Glowing shadows using the theme colors. Futuristic, premium feel.',
      neon: 'Neon glow effects with bright, vibrant shadows. Electric, cyberpunk aesthetic.',
    };
    
    const radiusDescriptions = {
      none: 'Sharp corners (rounded-none). Angular, brutalist design.',
      subtle: 'Subtle rounding (rounded-md). Professional, clean edges.',
      rounded: 'Rounded corners (rounded-xl, rounded-2xl). Friendly, modern feel.',
      pill: 'Fully rounded pill shapes (rounded-full). Playful, soft design.',
    };
    
    const layoutDescriptions = {
      cards: 'Card-based layout with distinct sections. Each element in its own container.',
      minimal: 'Minimal layout with lots of whitespace. Content-focused, clean.',
      bento: 'Bento box grid layout with varying card sizes. Modern, Apple-style.',
      magazine: 'Magazine-style layout with mixed content sizes. Editorial, dynamic.',
    };
    
    const moodDescriptions = {
      professional: 'Professional, corporate feel. Trust-building, serious.',
      playful: 'Playful, fun atmosphere. Energetic, youthful.',
      elegant: 'Elegant, luxurious feel. Premium, sophisticated.',
      bold: 'Bold, impactful design. Attention-grabbing, confident.',
      calm: 'Calm, peaceful atmosphere. Relaxing, zen-like.',
    };

    return `CUSTOM THEME INSTRUCTIONS:
- Primary Color: ${theme.colors[0]} (use for buttons, links, accents)
- Secondary Color: ${theme.colors[1]} (use for highlights, secondary elements)
- Accent Color: ${theme.colors[2]} (use for hover states, decorations)
- Background Accent: ${theme.colors[3]} (use for subtle backgrounds, cards)

TYPOGRAPHY: ${fontDescriptions[theme.fontStyle]}

SHADOWS: ${shadowDescriptions[theme.shadowStyle]}

BORDER RADIUS: ${radiusDescriptions[theme.borderRadius]}

LAYOUT: ${layoutDescriptions[theme.layoutStyle]}

MOOD: ${moodDescriptions[theme.mood]}

Apply these styles consistently throughout the entire design.`;
  };

  // Save custom theme
  const saveCustomTheme = () => {
    if (!newTheme.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم الثيم' : 'Enter a theme name');
      return;
    }
    
    const themeId = `custom-${Date.now()}`;
    const customTheme = {
      id: themeId,
      name: newTheme.name,
      nameAr: newTheme.name, // User can name it in any language
      colors: newTheme.colors,
      // Store full settings for instructions generation
      settings: {
        fontStyle: newTheme.fontStyle,
        shadowStyle: newTheme.shadowStyle,
        borderRadius: newTheme.borderRadius,
        layoutStyle: newTheme.layoutStyle,
        mood: newTheme.mood,
      },
      instructions: generateThemeInstructions(newTheme),
    };
    
    const updatedThemes = [...customThemes, customTheme];
    setCustomThemes(updatedThemes);
    localStorage.setItem('wakti_custom_themes', JSON.stringify(updatedThemes));
    
    // Auto-select the new theme
    setSelectedTheme(themeId);
    setShowThemeCreator(false);
    setShowThemes(false);
    
    // Reset form
    setNewTheme({
      name: '',
      colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
      fontStyle: 'modern',
      shadowStyle: 'soft',
      borderRadius: 'rounded',
      layoutStyle: 'cards',
      mood: 'professional',
    });
    
    toast.success(isRTL ? 'تم حفظ الثيم!' : 'Theme saved!');
  };

  // Delete custom theme
  const deleteCustomTheme = (themeId: string) => {
    const updatedThemes = customThemes.filter((t: any) => t.id !== themeId);
    setCustomThemes(updatedThemes);
    localStorage.setItem('wakti_custom_themes', JSON.stringify(updatedThemes));
    if (selectedTheme === themeId) {
      setSelectedTheme('none');
    }
    toast.success(isRTL ? 'تم حذف الثيم' : 'Theme deleted');
  };

  // Get theme instructions for selected theme (works for both custom and preset themes)
  const getSelectedThemeInstructions = (): string => {
    // First check custom themes
    const customTheme = customThemes.find((t: any) => t.id === selectedTheme);
    if (customTheme && (customTheme as any).instructions) {
      return (customTheme as any).instructions;
    }
    
    // Then check preset themes with settings
    const presetTheme = THEMES.find(t => t.id === selectedTheme);
    if (presetTheme && presetTheme.settings && selectedTheme !== 'none') {
      // Generate instructions from preset theme settings
      return generateThemeInstructions({
        name: presetTheme.name,
        colors: presetTheme.colors.length >= 4 
          ? presetTheme.colors.slice(0, 4) as [string, string, string, string]
          : [...presetTheme.colors, ...Array(4 - presetTheme.colors.length).fill(presetTheme.colors[0])] as [string, string, string, string],
        ...presetTheme.settings
      });
    }
    
    return '';
  };

  // EMP - Enhance My Prompt using GPT-4o-mini
  const enhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error(isRTL ? 'اكتب شيئًا أولاً' : 'Write something first');
      return;
    }
    
    setIsEnhancing(true);
    try {
      const themeInstructions = getSelectedThemeInstructions();
      const response = await supabase.functions.invoke('projects-enhance-prompt', {
        body: {
          prompt: prompt,
          theme: selectedTheme,
          themeInstructions: themeInstructions || undefined,
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

  const generateProjectTitle = (rawPrompt: string) => {
    const p = (rawPrompt || '').replace(/\s+/g, ' ').trim();
    console.log('[generateProjectTitle] Input:', p);
    if (!p) {
      console.log('[generateProjectTitle] Empty prompt, returning default');
      return isRTL ? 'مشروعي' : 'My Project';
    }

    const lower = p.toLowerCase();
    const leadingPatterns: RegExp[] = [
      /^build\s+(a|an|the)?\s*/i,
      /^create\s+(a|an|the)?\s*/i,
      /^make\s+(a|an|the)?\s*/i,
      /^generate\s+(a|an|the)?\s*/i,
      /^design\s+(a|an|the)?\s*/i,
      /^develop\s+(a|an|the)?\s*/i,
      /^i\s+want\s+(a|an|the)?\s*/i,
      /^i\s+need\s+(a|an|the)?\s*/i,
      /^please\s+(build|create|make|generate|design|develop)\s+(a|an|the)?\s*/i,
      /^you\s+to\s+(build|create|make|generate|design|develop)\s+(a|an|the)?\s*/i,
    ];

    let cleaned = p;
    for (const re of leadingPatterns) {
      if (re.test(cleaned)) {
        console.log('[generateProjectTitle] Matched pattern, removing:', re);
        cleaned = cleaned.replace(re, '').trim();
        break;
      }
    }

    cleaned = cleaned
      .replace(/[\s\-–—:;,.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('[generateProjectTitle] After cleanup:', cleaned);

    if (!cleaned) {
      console.log('[generateProjectTitle] Empty after cleanup, returning default');
      return isRTL ? 'مشروعي' : 'My Project';
    }

    const words = cleaned.split(' ').filter(Boolean);
    const maxWords = 7;
    const short = words.slice(0, maxWords).join(' ');
    const result = short.length > 48 ? `${short.slice(0, 48).trim()}…` : short;
    console.log('[generateProjectTitle] Final result:', result);

    return result;
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

      // Step 0: Assets are uploaded AFTER project creation so we can scope them to {userId}/{projectId}
      let assetUrls: string[] = [];

      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isRTL ? 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' : 'Session expired, please log in again');
        setGenerating(false);
        return;
      }

      // Step 1: Create project immediately with placeholder
      const projectName = generateProjectTitle(prompt);
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

      // Upload assets (scoped to this project) and track them in project_uploads for hard-delete
      if (attachedFiles.length > 0) {
        setIsUploading(true);
        for (const file of attachedFiles) {
          try {
            const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `${user.id}/${projectData.id}/${Date.now()}-${safeFilename}`;

            const { error: uploadError } = await supabase.storage
              .from('project-assets')
              .upload(storagePath, file);

            if (uploadError) {
              console.error('Upload error:', uploadError);
              continue;
            }

            await supabase
              .from('project_uploads' as any)
              .insert({
                project_id: projectData.id,
                user_id: user.id,
                bucket_id: 'project-assets',
                filename: safeFilename,
                storage_path: storagePath,
                file_type: file.type,
                size_bytes: file.size,
              });

            const { data: { publicUrl } } = supabase.storage
              .from('project-assets')
              .getPublicUrl(storagePath);

            assetUrls.push(publicUrl);
          } catch (err) {
            console.error('Asset upload error:', err);
          }
        }
        setIsUploading(false);
      }

      // Step 2: Create placeholder file
      const placeholderHtml = `<!DOCTYPE html>
<html ${language === 'ar' ? 'dir="rtl" lang="ar"' : 'lang="en"'}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isRTL ? 'جاري الإنشاء...' : 'Generating...'}</title>
  <style>
    body { 
      margin: 0; 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 50%, hsl(25,95%,60%) 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans Arabic', sans-serif;
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
    <h2>${isRTL ? 'الذكاء الاصطناعي يقوم بإنشاء مشروعك...' : 'AI is creating your project...'}</h2>
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
      const themeInstructions = getSelectedThemeInstructions();
      const instructionsParam = themeInstructions ? `&themeInstructions=${encodeURIComponent(themeInstructions)}` : '';
      // Pass language to ensure generated content matches user's language preference
      const langParam = `&lang=${language}`;
      navigate(`/projects/${projectData.id}?generating=true&prompt=${encodeURIComponent(prompt)}&theme=${selectedTheme}${assetParams}${instructionsParam}${langParam}`);

    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || (isRTL ? 'فشل في الإنشاء' : 'Failed to create'));
      setGenerating(false);
    }
  };

  const deleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    
    if (deleteConfirmId !== projectId) {
      // First click - show confirmation dialog
      setDeleteConfirmId(projectId);
      setDeleteConfirmText('');
      return;
    }
    
    // Second click - verify text and delete
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      toast.error(isRTL ? 'اكتب "delete" للتأكيد' : 'Type "delete" to confirm');
      return;
    }
    
    try {
      setDeleting(projectId);

      const { data: result, error: hardDeleteError } = await supabase.functions.invoke('projects-hard-delete', {
        body: { projectId },
      });

      if (hardDeleteError) throw hardDeleteError;
      if (!result?.ok) throw new Error(result?.error || 'Hard delete failed');
      
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setDeleteConfirmId(null);
      setDeleteConfirmText('');
      toast.success(isRTL ? 'تم الحذف' : 'Project deleted');
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
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-10 drop-shadow-lg">
            {isRTL ? `جاهز للبناء، ${userName}؟` : `Ready to build, ${userName}?`}
          </h1>

          <div className="w-full max-w-2xl bg-white dark:bg-[#0c0f14] rounded-2xl shadow-2xl border border-white/20 relative">
            {/* Limit Reached Overlay */}
            {projects.length >= MAX_PROJECTS && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl z-20 flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border-2 border-amber-500/50 rounded-full mb-3">
                    <span className="text-2xl">🔒</span>
                    <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                      {isRTL ? 'وصلت للحد الأقصى' : 'Limit Reached'}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">
                    {isRTL 
                      ? 'لديك مشروعان نشطان. احذف مشروعًا لإنشاء جديد.'
                      : 'You have 2 active projects. Delete one to create a new one.'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="p-4">
                <textarea
                  id="projectPrompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !generating) {
                      e.preventDefault();
                      createProject();
                    }
                  }}
                  placeholder={`${isRTL ? 'اطلب من Wakti إنشاء ' : 'Ask Wakti to create '}${displayedPlaceholder}`}
                  className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50 resize-none min-h-[100px] max-h-[300px] overflow-y-auto"
                  disabled={generating || projects.length >= MAX_PROJECTS}
                  rows={4}
                  title={isRTL ? 'صف ما تريد بناءه' : 'Describe what you want to build'}
                />
                
                {/* Theme Injection Preview - INSIDE the prompt area */}
                {selectedTheme && selectedTheme !== 'none' && (() => {
                  const theme = THEMES.find(t => t.id === selectedTheme);
                  const customTheme = customThemes.find((t: any) => t.id === selectedTheme);
                  const themeInstructions = getSelectedThemeInstructions();
                  const themeName = theme ? (isRTL ? theme.nameAr : theme.name) : (customTheme as any)?.name || selectedTheme;
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                          {isRTL ? '🎨 الثيم:' : '🎨 Theme:'}
                        </span>
                        <div className="flex-1">
                          <span className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {themeName}
                          </span>
                          {themeInstructions && (
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                              {themeInstructions.slice(0, 150)}{themeInstructions.length > 150 ? '...' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                  id="projectAssetUpload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  title={isRTL ? 'رفع ملفات المشروع' : 'Upload project assets'}
                />
                
                {/* Attach Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleAttachClick}
                  disabled={generating || projects.length >= MAX_PROJECTS}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">{isRTL ? 'إرفاق' : 'Attach'}</span>
                </Button>

                {/* EMP - Enhance My Prompt Button with Pulsing Dot & Tooltip */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-purple-500/10 relative"
                    onClick={() => {
                      // Dismiss tooltip on first click
                      if (showEmpTooltip) {
                        setShowEmpTooltip(false);
                        localStorage.setItem('wakti_emp_tooltip_seen', 'true');
                      }
                      enhancePrompt();
                    }}
                    disabled={generating || isEnhancing || !prompt.trim() || projects.length >= MAX_PROJECTS}
                    title={isRTL ? 'تحسين الطلب' : 'Enhance My Prompt'}
                  >
                    {isEnhancing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        {/* Pulsing dot indicator */}
                        {prompt.trim() && !generating && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-xs hidden sm:inline">{isRTL ? 'تحسين' : 'EMP'}</span>
                  </Button>
                  
                  {/* One-time tooltip for first-time users */}
                  {showEmpTooltip && prompt.trim() && !generating && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap relative">
                        <span>{isRTL ? '✨ اضغط لتحسين طلبك!' : '✨ Click to enhance your prompt!'}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEmpTooltip(false);
                            localStorage.setItem('wakti_emp_tooltip_seen', 'true');
                          }}
                          className="ml-2 text-white/70 hover:text-white"
                        >
                          ×
                        </button>
                        {/* Arrow pointing down */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-purple-600"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Theme Selector - Lovable Style */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowThemes(!showThemes)}
                    disabled={generating || projects.length >= MAX_PROJECTS}
                  >
                    {/* Color preview dots */}
                    <div className="flex -space-x-0.5">
                      {THEMES.find(t => t.id === selectedTheme)?.colors.slice(0, 4).map((color, i) => (
                        <div 
                          key={i} 
                          className="w-2.5 h-2.5 rounded-full first:rounded-l-full last:rounded-r-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs hidden sm:inline">{isRTL ? 'ثيم' : 'Theme'}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  
                  {showThemes && (
                    <div className="fixed inset-0 z-[9999]" onClick={() => { setShowThemes(false); setThemeSearch(''); }}>
                      <div 
                        className="absolute bg-white dark:bg-[#0c0f14] rounded-2xl shadow-2xl border border-border/50 overflow-hidden w-[280px]"
                        style={{ 
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search Input */}
                        <div className="p-3 border-b border-border/50">
                          <div className="relative">
                            <input
                              type="text"
                              value={themeSearch}
                              onChange={(e) => setThemeSearch(e.target.value)}
                              placeholder={isRTL ? 'بحث عن ثيم...' : 'Search themes...'}
                              className="w-full bg-muted/50 dark:bg-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-muted-foreground/50"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Theme List - Scrollable */}
                        <div className="max-h-[280px] overflow-y-auto p-2">
                          {/* Custom Themes Section */}
                          {customThemes.length > 0 && (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-semibold">
                                {isRTL ? 'ثيماتي' : 'My themes'}
                              </p>
                              {customThemes
                                .filter((t: any) => {
                                  if (!themeSearch) return true;
                                  const search = themeSearch.toLowerCase();
                                  return t.name.toLowerCase().includes(search);
                                })
                                .map((t: any) => (
                                <div key={t.id} className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedTheme(t.id);
                                      setShowThemes(false);
                                      setThemeSearch('');
                                    }}
                                    className={cn(
                                      "flex-1 flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors",
                                      selectedTheme === t.id && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                    )}
                                  >
                                    <span className="font-medium">{t.name}</span>
                                    <div className="flex -space-x-0.5">
                                      {t.colors.map((color: string, i: number) => (
                                        <div 
                                          key={i} 
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCustomTheme(t.id);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                    title={isRTL ? 'حذف' : 'Delete'}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="h-px bg-border/50 my-2" />
                            </>
                          )}
                          
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-semibold">
                            {isRTL ? 'الثيمات' : 'Default themes'}
                          </p>
                          {THEMES
                            .filter(t => {
                              if (!themeSearch) return true;
                              const search = themeSearch.toLowerCase();
                              return t.name.toLowerCase().includes(search) || t.nameAr.includes(themeSearch);
                            })
                            .map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTheme(t.id);
                                setShowThemes(false);
                                setThemeSearch('');
                              }}
                              className={cn(
                                "w-full px-2 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors cursor-pointer",
                                selectedTheme === t.id && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{isRTL ? t.nameAr : t.name}</span>
                                {/* Color pills - only show for non-user-prompt themes */}
                                {t.id !== 'user_prompt' && (
                                  <div className="flex -space-x-0.5">
                                    {t.colors.map((color, i) => (
                                      <div 
                                        key={i} 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              {/* Style preview - shows font, shadow, layout, mood */}
                              {t.settings && t.id !== 'none' && t.id !== 'user_prompt' && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.fontStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.shadowStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.layoutStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.mood}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {/* No results */}
                          {THEMES.filter(t => {
                            if (!themeSearch) return true;
                            const search = themeSearch.toLowerCase();
                            return t.name.toLowerCase().includes(search) || t.nameAr.includes(themeSearch);
                          }).length === 0 && customThemes.filter((t: any) => {
                            if (!themeSearch) return true;
                            return t.name.toLowerCase().includes(themeSearch.toLowerCase());
                          }).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {isRTL ? 'لا توجد نتائج' : 'No themes found'}
                            </p>
                          )}
                        </div>
                        
                        {/* Create New Button - Footer */}
                        <div className="p-2 border-t border-border/50">
                          <button
                            onClick={() => {
                              setShowThemes(false);
                              setShowThemeCreator(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إنشاء ثيم جديد' : 'Create new'}
                          </button>
                        </div>
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
                  disabled={generating || projects.length >= MAX_PROJECTS}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isRTL ? 'محادثة' : 'Chat'}</span>
                </Button>

                {/* Generate Button */}
                <Button
                  size="sm"
                  onClick={createProject}
                  disabled={generating || !prompt.trim() || projects.length >= MAX_PROJECTS}
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

          {/* Onboarding Gallery - What can you build? */}
          {projects.length < MAX_PROJECTS && !generating && (
            <div className="mt-8">
              <p className="text-sm text-white/70 mb-4 text-center">
                {isRTL ? '✨ أو اختر نوع المشروع للبدء سريعاً' : '✨ Or pick a project type to get started quickly'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROJECT_EXAMPLES.map((example) => {
                  const isActive = activeTemplateId === example.id;
                  const selectedOption = templateSelections[example.id] || (isRTL ? example.defaultOption.ar : example.defaultOption.en);
                  
                  return (
                    <div key={example.id} className="relative">
                      <button
                        onClick={() => {
                          if (isActive) {
                            // Already open - close it
                            setActiveTemplateId(null);
                          } else {
                            // Open this template's options
                            setActiveTemplateId(example.id);
                            setCustomTemplateInput('');
                          }
                        }}
                        className={cn(
                          "w-full group relative p-4 rounded-2xl border bg-white/5 backdrop-blur-sm",
                          "hover:bg-white/10 hover:scale-[1.02] transition-all duration-200",
                          "text-left",
                          isActive ? "border-white/50 bg-white/10" : "border-white/20 hover:border-white/40"
                        )}
                      >
                        <div className={cn(
                          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity",
                          `bg-gradient-to-br ${example.color}`
                        )} />
                        <div className="relative z-10">
                          <span className="text-2xl mb-2 block">{example.icon}</span>
                          <h3 className="font-semibold text-white text-sm mb-1">
                            {isRTL ? example.title.ar : example.title.en}
                          </h3>
                          <p className="text-[11px] text-white/60 leading-tight">
                            {isRTL ? example.desc.ar : example.desc.en}
                          </p>
                          {/* Show selected option as a pill */}
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-[10px] text-white/80">
                            <span className="truncate max-w-[100px]">{selectedOption}</span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          </div>
                        </div>
                      </button>
                      
                      {/* Dropdown for selecting product/business type */}
                      {isActive && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2 border-b border-white/10">
                            <p className="text-[10px] text-white/50 uppercase tracking-wider px-2 mb-1">
                              {isRTL ? 'اختر النوع' : 'Select type'}
                            </p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {example.options.map((option, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const optionText = isRTL ? option.ar : option.en;
                                  setTemplateSelections(prev => ({ ...prev, [example.id]: optionText }));
                                  // Build the prompt with the selected option
                                  const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                  const finalPrompt = template.replace('{PRODUCT}', optionText);
                                  setPrompt(finalPrompt);
                                  setActiveTemplateId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                              >
                                {isRTL ? option.ar : option.en}
                              </button>
                            ))}
                            {/* Custom option */}
                            <div className="p-2 border-t border-white/10">
                              <p className="text-[10px] text-white/50 uppercase tracking-wider px-1 mb-1">
                                {isRTL ? 'أو اكتب نوعك' : 'Or type your own'}
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={customTemplateInput}
                                  onChange={(e) => setCustomTemplateInput(e.target.value)}
                                  placeholder={isRTL ? 'مثال: ساعات فاخرة' : 'e.g., Luxury Watches'}
                                  className="flex-1 px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customTemplateInput.trim()) {
                                      setTemplateSelections(prev => ({ ...prev, [example.id]: customTemplateInput.trim() }));
                                      const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                      const finalPrompt = template.replace('{PRODUCT}', customTemplateInput.trim());
                                      setPrompt(finalPrompt);
                                      setActiveTemplateId(null);
                                      setCustomTemplateInput('');
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (customTemplateInput.trim()) {
                                      setTemplateSelections(prev => ({ ...prev, [example.id]: customTemplateInput.trim() }));
                                      const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                      const finalPrompt = template.replace('{PRODUCT}', customTemplateInput.trim());
                                      setPrompt(finalPrompt);
                                      setActiveTemplateId(null);
                                      setCustomTemplateInput('');
                                    }
                                  }}
                                  disabled={!customTemplateInput.trim()}
                                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  {isRTL ? 'تم' : 'Go'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Click outside to close dropdown */}
              {activeTemplateId && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setActiveTemplateId(null)}
                />
              )}
            </div>
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
                <div key={project.id}>
                  <div
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(17,24,39,0.95) 0%, rgba(31,41,55,0.85) 50%, rgba(55,65,81,0.7) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.95) 100%)',
                      borderRadius: '24px',
                      border: isDark 
                        ? '1px solid rgba(99,102,241,0.3)' 
                        : '1px solid rgba(229,231,235,0.9)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: isDark
                        ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 12px 24px -8px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(99,102,241,0.1)'
                        : '0 25px 50px -12px rgba(0,0,0,0.15), 0 12px 24px -8px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(99,102,241,0.05)',
                      transform: 'perspective(1000px) rotateX(0deg)',
                    }}
                  >
                    {/* 3D Shine Effect on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[24px]" />
                    
                    {/* Luxury Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none rounded-[24px]" />
                    
                    {/* Project Preview Thumbnail */}
                    <div className="relative overflow-hidden rounded-t-[24px]">
                      <ProjectPreviewThumbnail project={project} isRTL={isRTL} />
                    </div>
                    
                    {/* Luxury Info Section */}
                    <div className="p-5 relative z-10">
                      {/* Title and Status Row */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="font-bold text-lg truncate text-zinc-900 dark:text-white tracking-tight">{project.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              "shrink-0 px-3 py-1.5 text-[10px] rounded-full font-bold uppercase tracking-widest",
                              project.status === 'published'
                                ? "bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/20"
                                : project.status === 'generating'
                                ? "bg-indigo-500/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 animate-pulse"
                                : "bg-amber-500/30 text-amber-600 dark:text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/20"
                            )}
                          >
                            {project.status === 'published' ? (isRTL ? 'منشور' : 'Live') : project.status === 'generating' ? (isRTL ? 'بناء' : 'Building') : (isRTL ? 'مسودة' : 'Draft')}
                          </span>
                          {/* Server Status Badge */}
                          <span
                            className={cn(
                              "shrink-0 px-2 py-0.5 text-[9px] rounded-full font-semibold uppercase tracking-wider",
                              backendStatus[project.id]
                                ? "bg-green-500/30 text-green-600 dark:text-green-300 border border-green-500/50"
                                : "bg-red-500/30 text-red-600 dark:text-red-300 border border-red-500/50"
                            )}
                          >
                            {backendStatus[project.id] 
                              ? (isRTL ? 'الخادم نشط' : 'Server Live')
                              : (isRTL ? 'الخادم متوقف' : 'Server Off')
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Site URL - Show subdomain if published */}
                      {project.subdomain && project.status === 'published' ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          <Globe className="h-3 w-3" />
                          <span className="font-mono truncate">{project.subdomain}.wakti.ai</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? 'غير منشور بعد' : 'Not published yet'}
                        </p>
                      )}
                    </div>

                    {/* Actions - Top right */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                      {/* Share Button */}
                      {project.status === 'published' && project.subdomain && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ShareButton
                            shareUrl={`https://${project.subdomain}.wakti.ai`}
                            shareTitle={project.name}
                            shareDescription={isRTL ? `شاهد موقعي: ${project.name}` : `Check out my site: ${project.name}`}
                            size="sm"
                          />
                        </div>
                      )}
                      
                      {/* Server/Backend Button */}
                      <Button
                        size="icon"
                        className={cn(
                          "h-9 w-9 rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl transition-all bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-700",
                          backendStatus[project.id]
                            ? "text-green-600 dark:text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] hover:shadow-[0_0_25px_rgba(34,197,94,0.8)]"
                            : "text-red-600 dark:text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:shadow-[0_0_25px_rgba(239,68,68,0.8)]"
                        )}
                        onClick={(e) => toggleBackend(e, project.id)}
                        disabled={togglingBackend === project.id}
                        title={backendStatus[project.id] 
                          ? (isRTL ? 'الخادم مفعل' : 'Server enabled') 
                          : (isRTL ? 'تفعيل الخادم' : 'Enable server')}
                      >
                        {togglingBackend === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:shadow-xl transition-all"
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

                  {/* Delete Confirmation Dialog */}
                  {deleteConfirmId === project.id && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full p-6 space-y-4">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {isRTL ? 'حذف المشروع؟' : 'Delete Project?'}
                          </h3>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            {isRTL 
                              ? 'هذا سيحذف المشروع وكل محتوياته - الكود والتصميم والخادم والرابط المنشور. لا يمكن التراجع عن هذا.'
                              : 'This will permanently delete your project, including all code, design, backend, and its public URL. This cannot be undone.'}
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                            {isRTL ? 'اكتب "delete" للتأكيد:' : 'Type "delete" to confirm:'}
                          </label>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && deleteConfirmText.toLowerCase() === 'delete') {
                                deleteProject(e as any, project.id);
                              }
                            }}
                            placeholder="delete"
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                            autoFocus
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => {
                              setDeleteConfirmId(null);
                              setDeleteConfirmText('');
                            }}
                            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
                          >
                            {isRTL ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            onClick={(e) => deleteProject(e, project.id)}
                            disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleting === project.id}
                            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            {deleting === project.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isRTL ? 'جاري الحذف...' : 'Deleting...'}
                              </>
                            ) : (
                              isRTL ? 'حذف المشروع' : 'Delete Project'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Theme Creator Modal - Mobile Optimized */}
      {showThemeCreator && (
        <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center" onClick={() => setShowThemeCreator(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            className="relative bg-white dark:bg-[#0c0f14] rounded-t-3xl md:rounded-2xl shadow-2xl border border-border/50 w-full md:max-w-lg max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col md:m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center py-2 shrink-0">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30">
                  <Palette className="h-4 w-4 md:h-5 md:w-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-bold">{isRTL ? 'إنشاء ثيم جديد' : 'Create New Theme'}</h2>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground">{isRTL ? 'خصص ألوانك وأنماطك' : 'Customize colors & styles'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowThemeCreator(false)}
                className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                title={isRTL ? 'إغلاق' : 'Close'}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-5">
              {/* Theme Name */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 block">
                  {isRTL ? 'اسم الثيم' : 'Theme Name'}
                </label>
                <input
                  type="text"
                  value={newTheme.name}
                  onChange={(e) => setNewTheme(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={isRTL ? 'مثال: ثيمي المميز' : 'e.g., My Awesome Theme'}
                  className="w-full bg-muted/50 dark:bg-white/5 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 border border-border/50"
                />
              </div>

              {/* Colors */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Palette className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'الألوان (4)' : 'Colors (4)'}
                </label>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {newTheme.colors.map((color, i) => (
                    <div key={i} className="relative">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...newTheme.colors];
                          newColors[i] = e.target.value;
                          setNewTheme(prev => ({ ...prev, colors: newColors }));
                        }}
                        className="w-full h-10 md:h-12 rounded-lg md:rounded-xl cursor-pointer border-2 border-white dark:border-zinc-800 shadow-md"
                        title={i === 0 ? 'Primary' : i === 1 ? 'Secondary' : i === 2 ? 'Accent' : 'Background'}
                      />
                      <span className="absolute -bottom-4 md:-bottom-5 left-0 right-0 text-[8px] md:text-[9px] text-center text-muted-foreground">
                        {i === 0 ? (isRTL ? 'رئيسي' : 'Primary') : 
                         i === 1 ? (isRTL ? 'ثانوي' : 'Secondary') :
                         i === 2 ? (isRTL ? 'تمييز' : 'Accent') : (isRTL ? 'خلفية' : 'BG')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font Style */}
              <div className="mt-5 md:mt-6">
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Type className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط الخط' : 'Font Style'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['modern', 'classic', 'playful', 'minimal', 'bold'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, fontStyle: style }))}
                      className={cn(
                        "px-2 py-2 rounded-lg text-[11px] font-medium border transition-all",
                        newTheme.fontStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'modern' ? (isRTL ? 'عصري' : 'Modern') :
                       style === 'classic' ? (isRTL ? 'كلاسيك' : 'Classic') :
                       style === 'playful' ? (isRTL ? 'مرح' : 'Playful') :
                       style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') : (isRTL ? 'جريء' : 'Bold')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Style */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Layers className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط الظل' : 'Shadow Style'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['none', 'soft', 'hard', 'glow', 'neon'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, shadowStyle: style }))}
                      className={cn(
                        "px-1.5 md:px-2 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.shadowStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'none' ? (isRTL ? 'بدون' : 'None') :
                       style === 'soft' ? (isRTL ? 'ناعم' : 'Soft') :
                       style === 'hard' ? (isRTL ? 'حاد' : 'Hard') :
                       style === 'glow' ? (isRTL ? 'توهج' : 'Glow') : (isRTL ? 'نيون' : 'Neon')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Square className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'الحواف' : 'Border Radius'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  {(['none', 'subtle', 'rounded', 'pill'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, borderRadius: style }))}
                      className={cn(
                        "px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.borderRadius === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'none' ? (isRTL ? 'حاد' : 'Sharp') :
                       style === 'subtle' ? (isRTL ? 'خفيف' : 'Subtle') :
                       style === 'rounded' ? (isRTL ? 'دائري' : 'Rounded') : (isRTL ? 'كبسولة' : 'Pill')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Style */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Settings2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط التخطيط' : 'Layout Style'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  {(['cards', 'minimal', 'bento', 'magazine'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, layoutStyle: style }))}
                      className={cn(
                        "px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.layoutStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'cards' ? (isRTL ? 'بطاقات' : 'Cards') :
                       style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') :
                       style === 'bento' ? (isRTL ? 'بينتو' : 'Bento') : (isRTL ? 'مجلة' : 'Magazine')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Sun className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'المزاج العام' : 'Overall Mood'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['professional', 'playful', 'elegant', 'bold', 'calm'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, mood: style }))}
                      className={cn(
                        "px-1.5 md:px-2 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.mood === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'professional' ? (isRTL ? 'مهني' : 'Pro') :
                       style === 'playful' ? (isRTL ? 'مرح' : 'Fun') :
                       style === 'elegant' ? (isRTL ? 'أنيق' : 'Elegant') :
                       style === 'bold' ? (isRTL ? 'جريء' : 'Bold') : (isRTL ? 'هادئ' : 'Calm')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="mt-3 md:mt-4 p-3 md:p-4 rounded-xl border border-border/50 bg-muted/30">
                <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-2 md:mb-3 font-semibold">
                  {isRTL ? 'معاينة' : 'Preview'}
                </p>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex -space-x-1">
                    {newTheme.colors.map((color, i) => (
                      <div 
                        key={i}
                        className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white dark:border-zinc-800"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs md:text-sm truncate">{newTheme.name || (isRTL ? 'ثيم جديد' : 'New Theme')}</p>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                      {newTheme.fontStyle} • {newTheme.shadowStyle} • {newTheme.layoutStyle}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 md:py-4 border-t border-border/50 shrink-0 bg-muted/20">
              <Button 
                variant="outline" 
                onClick={() => setShowThemeCreator(false)}
                className="flex-1 h-10 md:h-11 rounded-xl text-sm"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={saveCustomTheme}
                className="flex-1 h-10 md:h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
              >
                {isRTL ? 'حفظ الثيم' : 'Save Theme'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
