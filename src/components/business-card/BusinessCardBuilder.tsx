import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Share2,
  User,
  Link2,
  Palette,
  QrCode,
  Mail,
  Phone,
  Power,
  Globe,
  Building2,
  MapPin,
  Linkedin,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  MessageCircle,
  Send,
  Github,
  Calendar,
  Plus,
  Image as ImageIcon,
  X,
  GripVertical,
  Check,
  Sparkles,
  Camera,
  Upload,
  ImagePlus,
  Bold,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
} from 'lucide-react';

// Types
interface TextStyle {
  color?: string;
  bold?: boolean;
  underline?: boolean;
  fontFamily?: 'system' | 'serif' | 'mono' | 'arabic';
  alignment?: 'left' | 'center' | 'right';
}

interface BusinessCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  website: string;
  logoUrl: string;
  profilePhotoUrl: string;
  coverPhotoUrl?: string;
  department?: string;
  headline?: string;
  address?: string;
  socialLinks?: SocialLink[];
  template?: 'geometric' | 'professional' | 'fashion' | 'minimal' | 'clean';
  primaryColor?: string;
  mosaicPaletteId?: string;
  mosaicColors?: {
    light?: string;
    mid?: string;
    dark?: string;
    deepest?: string;
  };
  professionalColors?: {
    band?: string;
    ring?: string;
    line?: string;
    lineHeight?: number;
    bandHeight?: number;
  };
  fashionColors?: {
    curve?: string;
    star?: string;
    starGlow?: boolean;
  };
  minimalColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  cleanColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  photoShape?: 'circle' | 'square';
  // Text styling
  nameStyle?: TextStyle;
  titleStyle?: TextStyle;
  companyStyle?: TextStyle;
  // Icon styling
  iconStyle?: {
    showBackground?: boolean;
    backgroundColor?: string;
    iconColor?: string;
    useBrandColors?: boolean;
    colorIntensity?: number; // 0-100, default 50
  };
}

interface SocialLink {
  id: string;
  type: string;
  url: string;
  label?: string;
}

interface BusinessCardBuilderProps {
  initialData: BusinessCardData;
  onSave: (data: BusinessCardData) => void;
  onBack: () => void;
}

// Social platforms config with brand colors
const SOCIAL_PLATFORMS = [
  { type: 'phone', icon: Phone, label: 'Phone Number', placeholder: '+1234567890', color: '#22c55e' },
  { type: 'email', icon: Mail, label: 'Email', placeholder: 'email@example.com', color: '#ef4444' },
  { type: 'website', icon: Globe, label: 'Website', placeholder: 'https://...', color: '#3b82f6' },
  { type: 'linkedin', icon: Linkedin, label: 'LinkedIn', placeholder: 'linkedin.com/in/...', color: '#0A66C2' },
  { type: 'instagram', icon: Instagram, label: 'Instagram', placeholder: '@username', color: '#E4405F' },
  { type: 'twitter', icon: Twitter, label: 'X (Twitter)', placeholder: '@username', color: '#000000' },
  { type: 'facebook', icon: Facebook, label: 'Facebook', placeholder: 'facebook.com/...', color: '#1877F2' },
  { type: 'youtube', icon: Youtube, label: 'YouTube', placeholder: 'youtube.com/...', color: '#FF0000' },
  { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', placeholder: '+1234567890', color: '#25D366' },
  { type: 'telegram', icon: Send, label: 'Telegram', placeholder: '@username', color: '#26A5E4' },
  { type: 'github', icon: Github, label: 'GitHub', placeholder: 'github.com/...', color: '#181717' },
  { type: 'calendly', icon: Calendar, label: 'Calendly', placeholder: 'calendly.com/...', color: '#006BFF' },
  { type: 'tiktok', icon: Sparkles, label: 'TikTok', placeholder: '@username', color: '#000000' },
  { type: 'snapchat', icon: Camera, label: 'Snapchat', placeholder: '@username', color: '#FFFC00' },
  { type: 'address', icon: MapPin, label: 'Address', placeholder: '123 Main St...', color: '#f97316' },
];

// Card templates - Premium designs matching reference screenshots
const CARD_TEMPLATES = [
  {
    id: 'geometric',
    name: 'Geometric',
    nameAr: 'هندسي',
    preview: 'bg-gradient-to-br from-rose-300 via-rose-400 to-rose-600',
    headerStyle: 'mosaic',
  },
  {
    id: 'professional',
    name: 'Professional',
    nameAr: 'احترافي',
    preview: 'bg-gradient-to-br from-sky-400 via-sky-500 to-blue-500',
    headerStyle: 'professional',
  },
  {
    id: 'fashion',
    name: 'Fashion',
    nameAr: 'عصري',
    preview: 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600',
    headerStyle: 'fashion',
  },
  {
    id: 'minimal',
    name: 'Minimal Dark',
    nameAr: 'داكن بسيط',
    preview: 'bg-gradient-to-br from-gray-800 via-gray-900 to-black',
    headerStyle: 'minimal',
  },
  {
    id: 'clean',
    name: 'Clean White',
    nameAr: 'أبيض نظيف',
    preview: 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300',
    headerStyle: 'clean',
  },
];

const MOSAIC_PALETTES = [
  { id: 'rose', label: 'Rose', labelAr: 'وردي', colors: { light: '#f5b5b5', mid: '#e8a4a4', dark: '#d4847d', deepest: '#7a3a3a' } },
  { id: 'sunset', label: 'Sunset', labelAr: 'غروب', colors: { light: '#ffd6a5', mid: '#ffb585', dark: '#f18b6b', deepest: '#b45745' } },
  { id: 'plum', label: 'Plum', labelAr: 'برقوقي', colors: { light: '#d7c6ff', mid: '#b79bff', dark: '#8b6ee8', deepest: '#4b2c7a' } },
  { id: 'ocean', label: 'Ocean', labelAr: 'محيط', colors: { light: '#a8d8ea', mid: '#61c0bf', dark: '#3d8b8b', deepest: '#1a4f4f' } },
  { id: 'forest', label: 'Forest', labelAr: 'غابة', colors: { light: '#b8e0c8', mid: '#7bc89c', dark: '#4a9d6e', deepest: '#2d5a40' } },
  { id: 'gold', label: 'Gold', labelAr: 'ذهبي', colors: { light: '#fff3cd', mid: '#ffc107', dark: '#d4a106', deepest: '#8b6914' } },
  { id: 'berry', label: 'Berry', labelAr: 'توتي', colors: { light: '#f8c8dc', mid: '#e57399', dark: '#c44569', deepest: '#6b1d3a' } },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', colors: { light: '#cbd5e1', mid: '#94a3b8', dark: '#64748b', deepest: '#334155' } },
  { id: 'copper', label: 'Copper', labelAr: 'نحاسي', colors: { light: '#f3cbb0', mid: '#e7a978', dark: '#c77a4c', deepest: '#7a3f26' } },
  { id: 'aura', label: 'Aurora', labelAr: 'أورورا', colors: { light: '#cfe7ff', mid: '#9ac6ff', dark: '#6b9df7', deepest: '#2f4f99' } },
];

const PROFESSIONAL_PALETTES = [
  { id: 'blue', label: 'Blue', labelAr: 'أزرق', band: '#58b0e0', ring: '#1d4ed8' },
  { id: 'teal', label: 'Teal', labelAr: 'فيروزي', band: '#4cc3c7', ring: '#0f766e' },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', band: '#7c8aa3', ring: '#1f2937' },
  { id: 'navy', label: 'Navy', labelAr: 'كحلي', band: '#3b5998', ring: '#1e3a5f' },
  { id: 'emerald', label: 'Emerald', labelAr: 'زمردي', band: '#34d399', ring: '#059669' },
  { id: 'purple', label: 'Purple', labelAr: 'بنفسجي', band: '#a78bfa', ring: '#7c3aed' },
  { id: 'rose', label: 'Rose', labelAr: 'وردي', band: '#fb7185', ring: '#e11d48' },
  { id: 'amber', label: 'Amber', labelAr: 'كهرماني', band: '#fbbf24', ring: '#d97706' },
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', band: '#94a3b8', ring: '#334155' },
  { id: 'ice', label: 'Ice', labelAr: 'ثلجي', band: '#7dd3fc', ring: '#0ea5e9' },
];

const FASHION_PALETTES = [
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', curve: '#6b7280', star: '#c7ccd3' },
  { id: 'charcoal', label: 'Charcoal', labelAr: 'فحمي', curve: '#4b5563', star: '#d1d5db' },
  { id: 'midnight', label: 'Midnight', labelAr: 'منتصف الليل', curve: '#374151', star: '#cbd5f5' },
  { id: 'ocean', label: 'Ocean', labelAr: 'محيط', curve: '#0ea5e9', star: '#bae6fd' },
  { id: 'forest', label: 'Forest', labelAr: 'غابة', curve: '#22c55e', star: '#bbf7d0' },
  { id: 'wine', label: 'Wine', labelAr: 'نبيذي', curve: '#881337', star: '#fda4af' },
  { id: 'royal', label: 'Royal', labelAr: 'ملكي', curve: '#7c3aed', star: '#ddd6fe' },
  { id: 'sunset', label: 'Sunset', labelAr: 'غروب', curve: '#ea580c', star: '#fed7aa' },
  { id: 'celadon', label: 'Celadon', labelAr: 'سيلادون', curve: '#16a34a', star: '#dcfce7' },
  { id: 'blush', label: 'Blush', labelAr: 'توردي', curve: '#f472b6', star: '#fbcfe8' },
];

const MINIMAL_PALETTES = [
  { id: 'noir', label: 'Noir', labelAr: 'نوار', background: '#0b0b0f', header: '#111827', accent: '#1f2937', text: '#f9fafb', muted: '#9ca3af' },
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', background: '#101418', header: '#1f2937', accent: '#374151', text: '#f3f4f6', muted: '#9ca3af' },
  { id: 'ink', label: 'Ink', labelAr: 'حبر', background: '#0b1120', header: '#111827', accent: '#1e293b', text: '#e5e7eb', muted: '#94a3b8' },
  { id: 'obsidian', label: 'Obsidian', labelAr: 'سبج', background: '#05070b', header: '#0f172a', accent: '#1f2937', text: '#f8fafc', muted: '#a1a1aa' },
  { id: 'evergreen', label: 'Evergreen', labelAr: 'دائم الخضرة', background: '#0b1412', header: '#0f1f19', accent: '#14532d', text: '#ecfdf5', muted: '#9ca3af' },
  { id: 'merlot', label: 'Merlot', labelAr: 'ميرلو', background: '#160b0f', header: '#2a0e16', accent: '#7f1d1d', text: '#fef2f2', muted: '#a1a1aa' },
  { id: 'indigo', label: 'Indigo', labelAr: 'نيلي', background: '#0b1020', header: '#1e1b4b', accent: '#312e81', text: '#eef2ff', muted: '#a5b4fc' },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', background: '#0f172a', header: '#1f2937', accent: '#334155', text: '#e2e8f0', muted: '#94a3b8' },
  { id: 'bronze', label: 'Bronze', labelAr: 'برونزي', background: '#140f0b', header: '#2b1b10', accent: '#92400e', text: '#fef3c7', muted: '#d4d4d8' },
  { id: 'midnight', label: 'Midnight', labelAr: 'منتصف الليل', background: '#0c0f14', header: '#111827', accent: '#1f2937', text: '#f2f2f2', muted: '#858384' },
];

const CLEAN_PALETTES = [
  { id: 'pure', label: 'Pure', labelAr: 'نقي', background: '#fcfefd', header: '#f2f4f8', accent: '#060541', text: '#060541', muted: '#606062' },
  { id: 'linen', label: 'Linen', labelAr: 'كتان', background: '#fbf7f2', header: '#f0e6da', accent: '#8b5e34', text: '#3f2a1d', muted: '#8a7f76' },
  { id: 'sage', label: 'Sage', labelAr: 'ميرمية', background: '#f6fbf7', header: '#e8f5ec', accent: '#2f6f4e', text: '#1f3d2f', muted: '#6b7f75' },
  { id: 'sky', label: 'Sky', labelAr: 'سماء', background: '#f5f9ff', header: '#e6f0ff', accent: '#1d4ed8', text: '#1e3a8a', muted: '#64748b' },
  { id: 'pearl', label: 'Pearl', labelAr: 'لؤلؤي', background: '#fdfcfa', header: '#f1f0ee', accent: '#7c3aed', text: '#3b0764', muted: '#8b8b8b' },
  { id: 'sand', label: 'Sand', labelAr: 'رملي', background: '#fff9f0', header: '#f2e8d5', accent: '#b45309', text: '#7c2d12', muted: '#9a8c6c' },
  { id: 'blush', label: 'Blush', labelAr: 'توردي', background: '#fff5f7', header: '#fde2e4', accent: '#be123c', text: '#831843', muted: '#9f1239' },
  { id: 'mint', label: 'Mint', labelAr: 'نعناع', background: '#f4fffb', header: '#dcfce7', accent: '#047857', text: '#065f46', muted: '#6b7280' },
  { id: 'lavender', label: 'Lavender', labelAr: 'لافندر', background: '#faf5ff', header: '#ede9fe', accent: '#6d28d9', text: '#4c1d95', muted: '#7c3aed' },
  { id: 'golden', label: 'Golden', labelAr: 'ذهبي', background: '#fffdf6', header: '#fff2cc', accent: '#ca8a04', text: '#7c2d12', muted: '#a16207' },
];

// Translations
const translations = {
  en: {
    builder: 'Card Builder',
    details: 'Details',
    links: 'Links',
    style: 'Style',
    qrCode: 'QR Code',
    save: 'Save',
    share: 'Share',
    personalDetails: 'Personal Details',
    contactInfo: 'Contact Info',
    professionalInfo: 'Professional Info',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company',
    jobTitle: 'Job Title',
    department: 'Department',
    headline: 'Headline',
    website: 'Website',
    address: 'Address',
    holdToReorder: 'Hold each field below to re-order it',
    tapToAdd: 'Tap a field below to add it',
    addedLinks: 'Added Links',
    availableLinks: 'Available Links',
    chooseTemplate: 'Choose Your Card Style',
    templateSelected: 'Selected',
    preview: 'Preview',
    yourQrCode: 'Your QR Code',
    scanToConnect: 'Scan to connect instantly',
    downloadQr: 'Download QR Code',
    addToWidget: 'Add as Widget',
    widgetHint: 'Add your QR code as a widget for the fastest way to share',
    required: 'required',
    optional: 'optional',
    changePhoto: 'Change Photo',
    changeLogo: 'Change Logo',
  },
  ar: {
    builder: 'منشئ البطاقة',
    details: 'التفاصيل',
    links: 'الروابط',
    style: 'النمط',
    qrCode: 'رمز QR',
    save: 'حفظ',
    share: 'مشاركة',
    personalDetails: 'البيانات الشخصية',
    contactInfo: 'معلومات الاتصال',
    professionalInfo: 'المعلومات المهنية',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    company: 'الشركة',
    jobTitle: 'المسمى الوظيفي',
    department: 'القسم',
    headline: 'العنوان الرئيسي',
    website: 'الموقع الإلكتروني',
    address: 'العنوان',
    holdToReorder: 'اضغط مطولاً لإعادة الترتيب',
    tapToAdd: 'اضغط على حقل لإضافته',
    addedLinks: 'الروابط المضافة',
    availableLinks: 'الروابط المتاحة',
    chooseTemplate: 'اختر نمط بطاقتك',
    templateSelected: 'محدد',
    preview: 'معاينة',
    yourQrCode: 'رمز QR الخاص بك',
    scanToConnect: 'امسح للتواصل فوراً',
    downloadQr: 'تحميل رمز QR',
    addToWidget: 'إضافة كودجت',
    widgetHint: 'أضف رمز QR كودجت للمشاركة بأسرع طريقة',
    required: 'مطلوب',
    optional: 'اختياري',
    changePhoto: 'تغيير الصورة',
    changeLogo: 'تغيير الشعار',
  },
};

type TabType = 'details' | 'links' | 'style' | 'qrcode';

export const BusinessCardBuilder: React.FC<BusinessCardBuilderProps> = ({
  initialData,
  onSave,
  onBack,
}) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [formData, setFormData] = useState<BusinessCardData>({
    ...initialData,
    socialLinks: initialData.socialLinks || [],
    template: initialData.template || 'geometric',
    primaryColor: initialData.primaryColor || '#6366f1',
    photoShape: initialData.photoShape || 'circle',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<{ type: string; label: string; icon: any; placeholder?: string } | null>(null);
  const [linkModalValue, setLinkModalValue] = useState('');
  const [isLinkActive, setIsLinkActive] = useState(true);

  // File input refs for image uploads
  const coverPhotoRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Handle image upload and convert to base64 data URL
  const handleImageUpload = useCallback((file: File, field: 'coverPhotoUrl' | 'profilePhotoUrl' | 'logoUrl') => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFormData(prev => ({ ...prev, [field]: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, []);

  const updateField = useCallback((field: keyof BusinessCardData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const timeoutId = setTimeout(() => {
      onSave(formData);
      toast.success(isRTL ? 'تم الحفظ التلقائي!' : 'Auto-saved!', {
        description: isRTL ? 'تم حفظ التغييرات تلقائياً' : 'Changes saved automatically',
      });
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [formData, autoSaveEnabled, onSave, isRTL]);

  const addSocialLink = useCallback((type: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.type === type);
    if (!platform) return;
    
    const newLink: SocialLink = {
      id: `${type}-${Date.now()}`,
      type,
      url: '',
      label: platform.label,
    };
    
    setFormData(prev => ({
      ...prev,
      socialLinks: [...(prev.socialLinks || []), newLink],
    }));
  }, []);

  const removeSocialLink = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter(link => link.id !== id),
    }));
  }, []);

  const updateSocialLink = useCallback((id: string, url: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).map(link =>
        link.id === id ? { ...link, url } : link
      ),
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!', {
        description: isRTL ? 'تم حفظ بطاقتك بنجاح' : 'Your card has been saved successfully',
      });
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error', {
        description: isRTL ? 'فشل في حفظ البطاقة' : 'Failed to save card',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Tab navigation
  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'details', label: t.details, icon: User },
    { id: 'links', label: t.links, icon: Link2 },
    { id: 'style', label: t.style, icon: Palette },
    { id: 'qrcode', label: t.qrCode, icon: QrCode },
  ];

  // Render Details Tab - Wakti Design System
  const renderDetailsTab = () => (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={coverPhotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر صورة الغلاف' : 'Select cover photo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'coverPhotoUrl')}
      />
      <input
        ref={profilePhotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر صورة الملف الشخصي' : 'Select profile photo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'profilePhotoUrl')}
      />
      <input
        ref={logoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر الشعار' : 'Select logo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logoUrl')}
      />

      {/* Live Card Preview at Top */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(210,100%,65%)]/20 via-[hsl(280,70%,65%)]/20 to-[hsl(25,95%,60%)]/20 rounded-3xl blur-xl" />
        <div className="relative">
          <CardPreviewLive data={formData} />
        </div>
      </div>

      {/* Images & Layout Section - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'الصور والتخطيط' : 'Images & layout'}</h3>
        
        <div className="flex items-start gap-6">
          {/* Logo - Large */}
          <div className="relative">
            <button
              onClick={() => logoRef.current?.click()}
              className="w-28 h-28 rounded-2xl bg-[#060541]/5 dark:bg-white/5 border-2 border-dashed border-[#060541]/20 dark:border-white/20 flex items-center justify-center overflow-hidden hover:border-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,65%)]/5 transition-all cursor-pointer"
            >
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
              ) : (
                <Building2 className="w-12 h-12 text-[#606062]" />
              )}
            </button>
            <button 
              onClick={() => logoRef.current?.click()}
              aria-label={isRTL ? 'تغيير الشعار' : 'Change logo'}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#060541] dark:bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Profile Photo */}
          <div className="relative">
            <button
              onClick={() => profilePhotoRef.current?.click()}
              className={`w-16 h-16 ${formData.photoShape === 'square' ? 'rounded-2xl' : 'rounded-full'} bg-[#060541]/5 dark:bg-white/5 border-2 border-dashed border-[#060541]/20 dark:border-white/20 overflow-hidden hover:border-[hsl(280,70%,65%)] hover:bg-[hsl(280,70%,65%)]/5 transition-all cursor-pointer`}
            >
              {formData.profilePhotoUrl ? (
                <img
                  src={formData.profilePhotoUrl}
                  alt="Profile"
                  className={`w-full h-full object-cover ${formData.photoShape === 'square' ? 'rounded-xl' : 'rounded-full'}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-[#606062]" />
                </div>
              )}
            </button>
            <button 
              onClick={() => profilePhotoRef.current?.click()}
              aria-label={isRTL ? 'تغيير الصورة' : 'Change photo'}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(280,70%,65%)] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Cover Photo Button */}
        <button 
          onClick={() => coverPhotoRef.current?.click()}
          className="flex items-center gap-2 text-[hsl(320,75%,70%)] hover:text-[hsl(320,75%,60%)] transition-colors mt-2"
        >
          <ImagePlus className="w-4 h-4" />
          <span className="text-sm font-medium">
            {formData.coverPhotoUrl 
              ? (isRTL ? 'تغيير صورة الغلاف' : 'Change cover photo')
              : (isRTL ? 'إضافة صورة الغلاف' : 'Add cover photo')
            }
          </span>
        </button>
        {formData.coverPhotoUrl && (
          <div className="relative w-full h-20 rounded-xl overflow-hidden">
            <img src={formData.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            <button
              onClick={() => updateField('coverPhotoUrl', '')}
              aria-label={isRTL ? 'إزالة صورة الغلاف' : 'Remove cover photo'}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Personal Details - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(280,70%,65%)] flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.personalDetails}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.firstName}</label>
            <Input
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.lastName}</label>
            <Input
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.headline}</label>
          <Input
            value={formData.headline || ''}
            onChange={(e) => updateField('headline', e.target.value)}
            placeholder={isRTL ? 'مثال: مطور ويب | مصمم' : 'e.g. Web Developer | Designer'}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2] placeholder:text-[#858384]"
          />
        </div>
      </div>

      {/* Professional Info - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(45,100%,60%)] flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.professionalInfo}</h3>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.jobTitle}</label>
          <Input
            value={formData.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.company}</label>
          <Input
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.department}</label>
          <Input
            value={formData.department || ''}
            onChange={(e) => updateField('department', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>
      </div>

      {/* Contact Info - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(142,76%,55%)] to-[hsl(160,80%,55%)] flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.contactInfo}</h3>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.email}</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.phone}</label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.website}</label>
          <Input
            type="url"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="https://"
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2] placeholder:text-[#858384]"
          />
        </div>
      </div>
    </div>
  );


  const handleGridIconClick = (platform: typeof SOCIAL_PLATFORMS[0]) => {
    let currentValue = '';
    let isActive = false;

    if (platform.type === 'phone') currentValue = formData.phone;
    else if (platform.type === 'email') currentValue = formData.email;
    else if (platform.type === 'website') currentValue = formData.website;
    else if (platform.type === 'address') currentValue = formData.address || '';
    else {
      const socialLink = (formData.socialLinks || []).find(l => l.type === platform.type);
      if (socialLink) {
        currentValue = socialLink.url;
        isActive = true;
      }
    }

    if (['phone', 'email', 'website', 'address'].includes(platform.type)) {
      isActive = !!currentValue;
    }

    setSelectedPlatform(platform);
    setLinkModalValue(currentValue);
    setIsLinkActive(isActive);
    setIsLinkModalOpen(true);
  };

  const handleSaveLinkFromModal = () => {
    if (!selectedPlatform) return;

    const type = selectedPlatform.type;
    const value = linkModalValue;

    if (['phone', 'email', 'website', 'address'].includes(type)) {
      if (isLinkActive) {
        setFormData(prev => ({ ...prev, [type]: value }));
      } else {
        setFormData(prev => ({ ...prev, [type]: '' }));
      }
    } else {
      if (isLinkActive) {
         const existingIndex = (formData.socialLinks || []).findIndex(l => l.type === type);
         if (existingIndex >= 0) {
             const newLinks = [...(formData.socialLinks || [])];
             newLinks[existingIndex] = { ...newLinks[existingIndex], url: value };
             setFormData(prev => ({ ...prev, socialLinks: newLinks }));
         } else {
             const newLink: SocialLink = {
               id: `${type}-${Date.now()}`,
               type,
               url: value,
               label: selectedPlatform.label,
             };
             setFormData(prev => ({ ...prev, socialLinks: [...(prev.socialLinks || []), newLink] }));
         }
      } else {
         setFormData(prev => ({
           ...prev,
           socialLinks: (prev.socialLinks || []).filter(l => l.type !== type),
         }));
      }
    }
    setIsLinkModalOpen(false);
  };

  // Render Links Tab
  const renderLinksTab = () => {
    // Determine active links for visual state in grid
    const activeTypes = new Set((formData.socialLinks || []).map(l => l.type));
    if (formData.phone) activeTypes.add('phone');
    if (formData.email) activeTypes.add('email');
    if (formData.website) activeTypes.add('website');
    if (formData.address) activeTypes.add('address');

    return (
      <div className="space-y-6">
        {/* All Links Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t.availableLinks}</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {SOCIAL_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              
              // Check active state
              let coreValue = '';
              if (platform.type === 'phone') coreValue = formData.phone;
              else if (platform.type === 'email') coreValue = formData.email;
              else if (platform.type === 'website') coreValue = formData.website;
              else if (platform.type === 'address') coreValue = formData.address || '';
              else {
                const sl = (formData.socialLinks || []).find(l => l.type === platform.type);
                if (sl) coreValue = sl.url;
              }

              const isActive = !!coreValue;

              return (
                <button
                  key={platform.type}
                  onClick={() => handleGridIconClick(platform)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-green-500/10 border-green-500/50 hover:bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.5)] scale-110' : 'bg-white/10'
                  }`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'text-green-500 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'text-foreground'}`} />
                  </div>
                  <div className="text-center w-full">
                    <span className={`text-xs block ${isActive ? 'text-green-500 font-medium' : 'text-muted-foreground'}`}>
                      {platform.label}
                    </span>
                    {isActive && (
                      <div className="mt-1 flex flex-col items-center animate-in fade-in slide-in-from-bottom-1">
                        <span className="text-[10px] text-green-500/80 font-medium">
                          {isRTL ? 'نشط' : 'Active'}
                        </span>
                        <span className="text-[10px] text-green-500/60 truncate max-w-[100px] block" title={coreValue}>
                          {coreValue}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Link Edit Modal */}
        <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-[#fcfefd] dark:bg-[#0c0f14] border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedPlatform && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <selectedPlatform.icon className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span>{selectedPlatform?.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="link-active" className="flex flex-col space-y-1">
                  <span>{isRTL ? 'تفعيل' : 'Enable'}</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    {isRTL ? 'إظهار هذا الرابط في البطاقة' : 'Show this link on your card'}
                  </span>
                </Label>
                <Switch
                  id="link-active"
                  checked={isLinkActive}
                  onCheckedChange={setIsLinkActive}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">
                  {selectedPlatform?.type === 'phone' ? (isRTL ? 'رقم الهاتف' : 'Phone Number') :
                   selectedPlatform?.type === 'email' ? (isRTL ? 'البريد الإلكتروني' : 'Email Address') :
                   selectedPlatform?.type === 'address' ? (isRTL ? 'العنوان' : 'Address') :
                   (isRTL ? 'الرابط / المعرف' : 'URL / Username')}
                </Label>
                <Input
                  id="link-url"
                  value={linkModalValue}
                  onChange={(e) => setLinkModalValue(e.target.value)}
                  placeholder={selectedPlatform?.placeholder}
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSaveLinkFromModal} className="w-full">
                {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Color palette for text colors
  const TEXT_COLORS = [
    { id: 'default', color: '', label: 'Default' },
    { id: 'white', color: '#ffffff', label: 'White' },
    { id: 'black', color: '#000000', label: 'Black' },
    { id: 'primary', color: '#060541', label: 'Primary' },
    { id: 'blue', color: 'hsl(210, 100%, 65%)', label: 'Blue' },
    { id: 'purple', color: 'hsl(280, 70%, 65%)', label: 'Purple' },
    { id: 'pink', color: 'hsl(320, 75%, 70%)', label: 'Pink' },
    { id: 'green', color: 'hsl(142, 76%, 55%)', label: 'Green' },
    { id: 'orange', color: 'hsl(25, 95%, 60%)', label: 'Orange' },
  ];

  const FONT_FAMILIES = [
    { id: 'system', label: isRTL ? 'النظام' : 'System', className: 'font-sans' },
    { id: 'serif', label: isRTL ? 'كلاسيكي' : 'Serif', className: 'font-serif' },
    { id: 'mono', label: isRTL ? 'مونو' : 'Mono', className: 'font-mono' },
    { id: 'arabic', label: isRTL ? 'عربي' : 'Arabic', className: 'font-arabic' },
  ];

  // Helper to update text style
  const updateTextStyle = (field: 'nameStyle' | 'titleStyle' | 'companyStyle', property: keyof TextStyle, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] || {}),
        [property]: value,
      },
    }));
  };

  const updateMosaicColors = (property: keyof NonNullable<BusinessCardData['mosaicColors']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      mosaicColors: {
        ...(prev.mosaicColors || {}),
        [property]: value,
      },
    }));
  };

  const updateProfessionalColors = (
    property: keyof NonNullable<BusinessCardData['professionalColors']>,
    value: string | number,
  ) => {
    setFormData(prev => ({
      ...prev,
      professionalColors: {
        ...(prev.professionalColors || {}),
        [property]: value,
      },
    }));
  };

  const updateFashionColors = (property: keyof NonNullable<BusinessCardData['fashionColors']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      fashionColors: {
        ...(prev.fashionColors || {}),
        [property]: value,
      },
    }));
  };

  // Text Style Editor Component
  const TextStyleEditor = ({ 
    label, 
    field, 
    style 
  }: { 
    label: string; 
    field: 'nameStyle' | 'titleStyle' | 'companyStyle'; 
    style?: TextStyle;
  }) => (
    <div className="space-y-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
      <h4 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{label}</h4>
      
      {/* Formatting Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateTextStyle(field, 'bold', !style?.bold)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.bold 
              ? 'bg-[hsl(210,100%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'عريض' : 'Bold'}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'underline', !style?.underline)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.underline 
              ? 'bg-[hsl(210,100%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'تسطير' : 'Underline'}
        >
          <Underline className="w-4 h-4" />
        </button>
        
        <div className="w-px h-6 bg-[#060541]/10 dark:bg-white/10 mx-1" />
        
        {/* Alignment */}
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'left')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.alignment === 'left' 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'يسار' : 'Left'}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'center')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            (!style?.alignment || style?.alignment === 'center') 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'وسط' : 'Center'}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'right')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.alignment === 'right' 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'يمين' : 'Right'}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <span className="text-xs text-[#606062] dark:text-[#858384]">{isRTL ? 'اللون' : 'Color'}</span>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => updateTextStyle(field, 'color', c.color)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                (style?.color || '') === c.color 
                  ? 'border-[hsl(210,100%,65%)] ring-2 ring-[hsl(210,100%,65%)]/30' 
                  : 'border-[#060541]/20 dark:border-white/20'
              }`}
              style={{ backgroundColor: c.color || 'transparent' }}
              aria-label={c.label}
            >
              {c.id === 'default' && (
                <span className="text-xs text-[#606062]">A</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <span className="text-xs text-[#606062] dark:text-[#858384]">{isRTL ? 'الخط' : 'Font'}</span>
        <div className="flex flex-wrap gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => updateTextStyle(field, 'fontFamily', f.id as TextStyle['fontFamily'])}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${f.className} ${
                (style?.fontFamily || 'system') === f.id 
                  ? 'bg-[hsl(142,76%,55%)] text-white' 
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Style Tab
  const renderStyleTab = () => (
    <div className="space-y-6">
      {/* Live Preview at TOP */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(210,100%,65%)]/20 via-[hsl(280,70%,65%)]/20 to-[hsl(25,95%,60%)]/20 rounded-3xl blur-xl" />
        <div className="relative">
          <CardPreviewLive data={formData} />
        </div>
      </div>

      {/* Card Style / Template Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[hsl(280,70%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'نمط البطاقة' : 'Card style'}</h3>
        </div>
        
        {/* Premium style name selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {CARD_TEMPLATES.map((template) => {
            const isSelected = formData.template === template.id;
            const fancyName = (() => {
              switch (template.id) {
                case 'geometric':
                  return isRTL ? 'فسيفساء أورورا' : 'Aurora Mosaic';
                case 'professional':
                  return isRTL ? 'تنفيذي أزرق' : 'Executive Blue';
                case 'fashion':
                  return isRTL ? 'منحنى كوتور' : 'Couture Curve';
                case 'minimal':
                  return isRTL ? 'نوير بسيط' : 'Noir Minimal';
                case 'clean':
                  return isRTL ? 'استوديو نقي' : 'Pure Studio';
                default:
                  return isRTL ? template.nameAr : template.name;
              }
            })();

            return (
              <button
                key={template.id}
                onClick={() => updateField('template', template.id)}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-[hsl(210,100%,65%)] bg-[hsl(210,100%,65%)]/10 shadow-[0_8px_24px_rgba(56,189,248,0.25)]'
                    : 'border-[#060541]/10 dark:border-white/10 hover:border-[hsl(210,100%,65%)]/60'
                }`}
                aria-label={fancyName}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{fancyName}</p>
                  <p className="text-[11px] text-[#606062] dark:text-[#858384]">
                    {isRTL ? template.nameAr : template.name}
                  </p>
                </div>
                <span className={`w-3 h-3 rounded-full ${template.preview} border border-white/50`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Colors - Premium Visual Palette Cards */}
      {(formData.template === 'geometric' || formData.template === 'professional' || formData.template === 'fashion' || formData.template === 'minimal' || formData.template === 'clean') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(25,95%,60%)]" />
            <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'ألوان النمط' : 'Style colors'}</h3>
          </div>
          
          {/* Horizontal scrollable palette grid for mobile */}
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex gap-3 min-w-max">
              {formData.template === 'geometric' && MOSAIC_PALETTES.map((palette) => {
                const isSelected = (formData.mosaicPaletteId || 'rose') === palette.id;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('mosaicPaletteId', palette.id)}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(25,95%,60%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(25,95%,60%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden">
                      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                        <div style={{ backgroundColor: palette.colors.light }} />
                        <div style={{ backgroundColor: palette.colors.mid }} />
                        <div style={{ backgroundColor: palette.colors.dark }} />
                        <div style={{ backgroundColor: palette.colors.deepest }} />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(25,95%,60%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}


              {formData.template === 'professional' && PROFESSIONAL_PALETTES.map((palette) => {
                const isSelected = formData.professionalColors?.band === palette.band && formData.professionalColors?.ring === palette.ring;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('professionalColors', {
                      band: palette.band,
                      ring: palette.ring,
                      line: palette.band,
                      lineHeight: 6,
                      bandHeight: 60,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(210,100%,65%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(210,100%,65%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden flex flex-col">
                      <div className="flex-1" style={{ backgroundColor: palette.band }} />
                      <div className="h-4 flex items-center justify-center" style={{ backgroundColor: palette.ring }}>
                        <div className="w-3 h-3 rounded-full border-2 border-white/80" />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
              
              {formData.template === 'fashion' && FASHION_PALETTES.map((palette) => {
                const isSelected = formData.fashionColors?.curve === palette.curve && formData.fashionColors?.star === palette.star;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('fashionColors', { 
                      curve: palette.curve, 
                      star: palette.star,
                      starGlow: formData.fashionColors?.starGlow ?? false,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(320,75%,70%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(320,75%,70%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative bg-gray-100">
                      <div className="absolute bottom-0 left-0 right-0 h-2/3 rounded-t-full" style={{ backgroundColor: palette.curve }} />
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: palette.star }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(320,75%,70%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              {formData.template === 'minimal' && MINIMAL_PALETTES.map((palette) => {
                const isSelected = formData.minimalColors?.background === palette.background && formData.minimalColors?.accent === palette.accent;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('minimalColors', {
                      background: palette.background,
                      header: palette.header,
                      accent: palette.accent,
                      text: palette.text,
                      muted: palette.muted,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[#1f2937] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[#1f2937]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative" style={{ backgroundColor: palette.background }}>
                      <div className="absolute top-0 left-0 right-0 h-1/3" style={{ backgroundColor: palette.header }} />
                      <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full" style={{ backgroundColor: palette.muted }} />
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1f2937] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              {formData.template === 'clean' && CLEAN_PALETTES.map((palette) => {
                const isSelected = formData.cleanColors?.background === palette.background && formData.cleanColors?.accent === palette.accent;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('cleanColors', {
                      background: palette.background,
                      header: palette.header,
                      accent: palette.accent,
                      text: palette.text,
                      muted: palette.muted,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(210,100%,65%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(210,100%,65%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative" style={{ backgroundColor: palette.background }}>
                      <div className="absolute top-0 left-0 right-0 h-1/3" style={{ backgroundColor: palette.header }} />
                      <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full" style={{ backgroundColor: palette.muted }} />
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fashion Advanced Controls - Mobile Friendly */}
          {formData.template === 'fashion' && (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون النجمة' : 'Star color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateField('fashionColors', {
                          ...formData.fashionColors,
                          star: color.color,
                        })}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          formData.fashionColors?.star === color.color
                            ? 'border-[hsl(320,75%,70%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'توهج النجمة' : 'Star glow'}
                  </p>
                  <button
                    onClick={() => updateField('fashionColors', {
                      ...formData.fashionColors,
                      starGlow: !formData.fashionColors?.starGlow,
                    })}
                    className={`w-full py-2 rounded-lg text-[11px] font-medium transition-all ${
                      formData.fashionColors?.starGlow
                        ? 'bg-[hsl(320,75%,70%)] text-white'
                        : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                    }`}
                  >
                    {formData.fashionColors?.starGlow 
                      ? (isRTL ? 'مُفعّل ✨' : 'ON ✨') 
                      : (isRTL ? 'مُعطّل' : 'OFF')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Advanced Controls - Mobile Friendly */}
          {formData.template === 'professional' && (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون الخط' : 'Line color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateProfessionalColors('line', color.color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          (formData.professionalColors?.line || formData.professionalColors?.band) === color.color
                            ? 'border-[hsl(210,100%,65%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون الدائرة' : 'Circle color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateProfessionalColors('ring', color.color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          (formData.professionalColors?.ring || PROFESSIONAL_PALETTES[0].ring) === color.color
                            ? 'border-[hsl(280,70%,65%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'سماكة الخط' : 'Line thickness'}
                  </p>
                  <div className="flex gap-1.5">
                    {[4, 6, 8].map((height) => (
                      <button
                        key={height}
                        onClick={() => updateProfessionalColors('lineHeight', height)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          (formData.professionalColors?.lineHeight ?? 6) === height
                            ? 'bg-[hsl(210,100%,65%)] text-white'
                            : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                        }`}
                      >
                        {height}px
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'ارتفاع الشريط' : 'Band height'}
                  </p>
                  <div className="flex gap-1.5">
                    {[50, 60, 70].map((height) => (
                      <button
                        key={height}
                        onClick={() => updateProfessionalColors('bandHeight', height)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          (formData.professionalColors?.bandHeight ?? 60) === height
                            ? 'bg-[hsl(210,100%,65%)] text-white'
                            : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                        }`}
                      >
                        {height}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logo Position */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[hsl(25,95%,60%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'موضع الشعار' : 'Logo position'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {[
            { id: 'top-left', label: isRTL ? 'أعلى يسار' : 'Top Left' },
            { id: 'top-right', label: isRTL ? 'أعلى يمين' : 'Top Right' },
            { id: 'bottom-left', label: isRTL ? 'أسفل يسار' : 'Bottom Left' },
            { id: 'bottom-right', label: isRTL ? 'أسفل يمين' : 'Bottom Right' },
          ].map((pos) => (
            <button
              key={pos.id}
              onClick={() => updateField('logoPosition', pos.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                (formData.logoPosition || 'top-right') === pos.id
                  ? 'bg-[hsl(25,95%,60%)] text-white'
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo Shape */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[hsl(210,100%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'شكل الصورة' : 'Photo shape'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {[
            { id: 'circle', label: isRTL ? 'دائرة' : 'Circle' },
            { id: 'square', label: isRTL ? 'مربع' : 'Square' },
          ].map((shape) => (
            <button
              key={shape.id}
              onClick={() => updateField('photoShape', shape.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                (formData.photoShape || 'circle') === shape.id
                  ? 'bg-[hsl(210,100%,65%)] text-white'
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {shape.label}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Styling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[hsl(142,76%,55%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'تنسيق الأيقونات' : 'Icon styling'}</h3>
        </div>
        
        <div className="p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10 space-y-4">
          {/* Use Brand Colors Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'استخدام ألوان العلامات التجارية' : 'Use brand colors'}
              </p>
              <p className="text-[10px] text-[#606062] dark:text-[#858384]">
                {isRTL ? 'ألوان افتراضية لكل منصة' : 'Default colors for each platform'}
              </p>
            </div>
            <Switch
              checked={formData.iconStyle?.useBrandColors !== false}
              onCheckedChange={(checked) => updateField('iconStyle', {
                ...formData.iconStyle,
                useBrandColors: checked,
              })}
            />
          </div>

          {/* Icon Background Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'خلفية الأيقونة' : 'Icon background'}
              </p>
              <p className="text-[10px] text-[#606062] dark:text-[#858384]">
                {isRTL ? 'دائرة خلف الأيقونة مع ظل' : 'Circle behind icon with shadow'}
              </p>
            </div>
            <Switch
              checked={formData.iconStyle?.showBackground ?? true}
              onCheckedChange={(checked) => updateField('iconStyle', {
                ...formData.iconStyle,
                showBackground: checked,
              })}
            />
          </div>

          {/* Background Color (only if showBackground is true) */}
          {(formData.iconStyle?.showBackground ?? true) && (
            <div>
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                {isRTL ? 'لون الخلفية' : 'Background color'}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'black', color: '#000000', label: 'Black' },
                  { id: 'white', color: '#ffffff', label: 'White' },
                  { id: 'gray', color: '#6b7280', label: 'Gray' },
                  { id: 'blue', color: '#3b82f6', label: 'Blue' },
                  { id: 'purple', color: '#8b5cf6', label: 'Purple' },
                  { id: 'transparent', color: 'transparent', label: 'None' },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => updateField('iconStyle', {
                      ...formData.iconStyle,
                      backgroundColor: bg.color,
                    })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      (formData.iconStyle?.backgroundColor || '#000000') === bg.color
                        ? 'border-[hsl(142,76%,55%)] scale-110 ring-2 ring-[hsl(142,76%,55%)]/30'
                        : 'border-white/60 dark:border-white/30'
                    } ${bg.id === 'transparent' ? 'bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-600 dark:to-gray-800' : ''}`}
                    style={{ backgroundColor: bg.id !== 'transparent' ? bg.color : undefined }}
                    title={bg.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Color Intensity Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'شفافية الخلفية' : 'BG opacity'}
              </p>
              <span className="text-[10px] text-[#606062] dark:text-[#858384]">
                {formData.iconStyle?.colorIntensity ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={formData.iconStyle?.colorIntensity ?? 50}
              disabled={!((formData.iconStyle?.showBackground ?? true))}
              onChange={(e) => updateField('iconStyle', {
                ...formData.iconStyle,
                colorIntensity: parseInt(e.target.value),
              })}
              className={`w-full h-1.5 bg-[#060541]/10 dark:bg-white/10 rounded-lg appearance-none ${
                (formData.iconStyle?.showBackground ?? true) ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
              }`}
              id="color-intensity-slider"
              title="BG opacity"
              aria-label={isRTL ? 'شفافية الخلفية' : 'BG opacity'}
            />
            <label htmlFor="color-intensity-slider" className="sr-only">
              {isRTL ? 'شفافية الخلفية' : 'BG opacity'}
            </label>
          </div>

          {/* Custom Icon Color (only if not using brand colors) */}
          {formData.iconStyle?.useBrandColors === false && (
            <div>
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                {isRTL ? 'لون الأيقونة' : 'Icon color'}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'white', color: '#ffffff', label: 'White' },
                  { id: 'black', color: '#000000', label: 'Black' },
                  { id: 'blue', color: '#3b82f6', label: 'Blue' },
                  { id: 'green', color: '#22c55e', label: 'Green' },
                  { id: 'purple', color: '#8b5cf6', label: 'Purple' },
                  { id: 'pink', color: '#ec4899', label: 'Pink' },
                  { id: 'orange', color: '#f97316', label: 'Orange' },
                  { id: 'red', color: '#ef4444', label: 'Red' },
                ].map((ic) => (
                  <button
                    key={ic.id}
                    onClick={() => updateField('iconStyle', {
                      ...formData.iconStyle,
                      iconColor: ic.color,
                    })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      (formData.iconStyle?.iconColor || '#ffffff') === ic.color
                        ? 'border-[hsl(142,76%,55%)] scale-110 ring-2 ring-[hsl(142,76%,55%)]/30'
                        : 'border-white/60 dark:border-white/30'
                    }`}
                    style={{ backgroundColor: ic.color }}
                    title={ic.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text Customization */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-[hsl(210,100%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'تخصيص النص' : 'Text customization'}</h3>
        </div>
        
        <TextStyleEditor 
          label={isRTL ? 'الاسم' : 'Name'} 
          field="nameStyle" 
          style={formData.nameStyle} 
        />
        <TextStyleEditor 
          label={isRTL ? 'المسمى الوظيفي' : 'Job Title'} 
          field="titleStyle" 
          style={formData.titleStyle} 
        />
        <TextStyleEditor 
          label={isRTL ? 'الشركة' : 'Company'} 
          field="companyStyle" 
          style={formData.companyStyle} 
        />
      </div>
    </div>
  );

  // Render QR Code Tab
  const renderQrCodeTab = () => (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">{t.yourQrCode}</h3>
      
      {/* QR Code Display */}
      <div className="flex flex-col items-center p-6 rounded-2xl bg-white border border-gray-200">
        <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
          {/* Placeholder QR - will be generated */}
          <div className="w-40 h-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMSAyMSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGg3djdIMHptMiAyaDN2M0gyem05LTJoN3Y3aC03em0yIDJoM3YzaC0zek0wIDE0aDd2N0gwem0yIDJoM3YzSDJ6bTEwLTJoMXYxaC0xem0yIDB2MWgtMXYtMWgxem0tMiAyaDJ2MmgtMnptMiAwaDJ2MmgtMnptLTQgMmgxdjFoLTF6bTIgMGgxdjFoLTF6bTIgMGgxdjFoLTF6bTIgMGgxdjFoLTF6bS02IDJoMXYxaC0xem0yIDB2MWgtMXYtMWgxem0yIDB2MWgtMXYtMWgxem0yIDB2MWgtMXYtMWgxeiIvPjwvc3ZnPg==')] bg-contain" />
        </div>
        <p className="text-sm text-gray-500 mt-4">{t.scanToConnect}</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600">
          <QrCode className="w-5 h-5 mr-2" />
          {t.downloadQr}
        </Button>
      </div>

      {/* Widget Hint */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{t.addToWidget}</h4>
            <p className="text-sm text-muted-foreground mt-1">{t.widgetHint}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-blue-500/5 ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 -ml-2 rounded-xl bg-gradient-to-r from-[#060541]/10 to-[#060541]/5 dark:from-white/10 dark:to-white/5 hover:from-[#060541]/20 hover:to-[#060541]/10 dark:hover:from-white/20 dark:hover:to-white/10 border border-[#060541]/10 dark:border-white/10 transition-all active:scale-95"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span className="text-sm font-medium">{isRTL ? 'بطاقاتي' : 'My Cards'}</span>
        </button>
        <h1 className="text-lg font-bold">{t.builder}</h1>
        <div className="flex items-center gap-2">
          {/* Auto-save toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              autoSaveEnabled
                ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
            }`}
          >
            {autoSaveEnabled ? (
              <>
                <Check className="w-3 h-3 inline mr-1" />
                {isRTL ? 'تلقائي' : 'Auto'}
              </>
            ) : (
              <>
                <Power className="w-3 h-3 inline mr-1" />
                {isRTL ? 'يدوي' : 'Manual'}
              </>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 px-3 text-xs font-semibold text-white bg-gradient-to-r from-[#060541] via-[hsl(260,70%,25%)] to-[#060541] shadow-[0_0_16px_rgba(6,5,65,0.35)] hover:shadow-[0_0_24px_rgba(6,5,65,0.5)] hover:-translate-y-0.5 active:translate-y-0"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                <span>{isRTL ? 'جارٍ الحفظ' : 'Saving'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t.save}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'links' && renderLinksTab()}
        {activeTab === 'style' && renderStyleTab()}
        {activeTab === 'qrcode' && renderQrCodeTab()}
      </div>
    </div>
  );
};

// Helper to generate text style classes
const getTextStyleClasses = (style?: TextStyle): string => {
  const classes: string[] = [];
  
  if (style?.bold) classes.push('font-bold');
  if (style?.underline) classes.push('underline');
  
  if (style?.alignment === 'left') classes.push('text-left');
  else if (style?.alignment === 'right') classes.push('text-right');
  else classes.push('text-center');
  
  if (style?.fontFamily === 'serif') classes.push('font-serif');
  else if (style?.fontFamily === 'mono') classes.push('font-mono');
  
  return classes.join(' ');
};

// Live Card Preview Component - 5 Premium Business Card Designs
const CardPreviewLive: React.FC<{ data: BusinessCardData }> = ({ data }) => {
  const template = CARD_TEMPLATES.find(t => t.id === data.template) || CARD_TEMPLATES[0];
  const mosaicPalette = MOSAIC_PALETTES.find(p => p.id === (data.mosaicPaletteId || 'rose')) || MOSAIC_PALETTES[0];
  const mosaicColors = {
    ...mosaicPalette.colors,
    ...(data.mosaicColors || {}),
  };
  const professionalPalette = PROFESSIONAL_PALETTES[0];
  const professionalColors = {
    band: data.professionalColors?.band || professionalPalette.band,
    ring: data.professionalColors?.ring || professionalPalette.ring,
    line: data.professionalColors?.line || data.professionalColors?.band || professionalPalette.band,
    lineHeight: data.professionalColors?.lineHeight ?? 6,
    bandHeight: data.professionalColors?.bandHeight ?? 60,
  };
  const fashionPalette = FASHION_PALETTES[0];
  const fashionColors = {
    curve: data.fashionColors?.curve || fashionPalette.curve,
    star: data.fashionColors?.star || fashionPalette.star,
    starGlow: data.fashionColors?.starGlow ?? false,
  };
  const minimalPalette = MINIMAL_PALETTES[0];
  const minimalColors = {
    background: data.minimalColors?.background || minimalPalette.background,
    header: data.minimalColors?.header || minimalPalette.header,
    accent: data.minimalColors?.accent || minimalPalette.accent,
    text: data.minimalColors?.text || minimalPalette.text,
    muted: data.minimalColors?.muted || minimalPalette.muted,
  };
  const cleanPalette = CLEAN_PALETTES[0];
  const cleanColors = {
    background: data.cleanColors?.background || cleanPalette.background,
    header: data.cleanColors?.header || cleanPalette.header,
    accent: data.cleanColors?.accent || cleanPalette.accent,
    text: data.cleanColors?.text || cleanPalette.text,
    muted: data.cleanColors?.muted || cleanPalette.muted,
  };
  const photoShapeClass = data.photoShape === 'square' ? 'rounded-xl' : 'rounded-full';
  const photoShapeInnerClass = data.photoShape === 'square' ? 'rounded-lg' : 'rounded-full';
  const logoPositionClass =
    data.logoPosition === 'top-left'
      ? 'top-3 left-3'
      : data.logoPosition === 'bottom-left'
        ? 'bottom-3 left-3'
        : data.logoPosition === 'bottom-right'
          ? 'bottom-3 right-3'
          : 'top-3 right-3';

  // Icon style settings with defaults
  const iconStyle = {
    showBackground: data.iconStyle?.showBackground ?? true,
    backgroundColor: data.iconStyle?.backgroundColor || '#000000',
    iconColor: data.iconStyle?.iconColor || '#ffffff',
    useBrandColors: data.iconStyle?.useBrandColors !== false,
    colorIntensity: data.iconStyle?.colorIntensity ?? 50,
  };

  // Helper to get all active links for display with brand colors
  const activeLinks = [
    ...(data.phone ? [{ type: 'phone', url: data.phone, icon: Phone, label: 'Phone', color: '#22c55e' }] : []),
    ...(data.email ? [{ type: 'email', url: data.email, icon: Mail, label: 'Email', color: '#ef4444' }] : []),
    ...(data.website ? [{ type: 'website', url: data.website, icon: Globe, label: 'Website', color: '#3b82f6' }] : []),
    ...(data.address ? [{ type: 'address', url: data.address, icon: MapPin, label: 'Address', color: '#f97316' }] : []),
    ...(data.socialLinks || []).map(link => {
      const platform = SOCIAL_PLATFORMS.find(p => p.type === link.type);
      return {
        type: link.type,
        url: link.url,
        icon: platform?.icon || Link2,
        label: platform?.label || link.label || 'Link',
        color: platform?.color || '#6b7280'
      };
    })
  ];

  // Helper to get icon color based on settings
  const getIconColor = (brandColor: string) => {
    // Get base color
    const baseColor = iconStyle.useBrandColors ? brandColor : (iconStyle.iconColor || '#ffffff');
    return baseColor;
  };

  const getIconBackgroundColor = (color: string) => {
    if (!color || color === 'transparent') return 'transparent';

    const alphaRaw = (iconStyle.colorIntensity ?? 50) / 100;
    const alpha = Math.max(0, Math.min(1, alphaRaw));

    if (!color.startsWith('#')) return color;

    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // STYLE 1: Geometric Mosaic - Pink triangles, centered avatar overlapping
  if (template.headerStyle === 'mosaic') {
    return (
      <div className="w-[300px] min-h-[384px] mx-auto rounded-[20px] bg-white shadow-xl flex flex-col items-center relative pb-6">
        {/* Mosaic Header */}
        <div className="w-full h-[192px] rounded-t-[20px] overflow-hidden shrink-0">
          {data.coverPhotoUrl ? (
            <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-full h-full" viewBox="0 0 300 192" preserveAspectRatio="none">
              {/* Row 1 */}
              <polygon points="0,0 50,0 25,40" fill={mosaicColors.light} />
              <polygon points="50,0 25,40 75,40" fill={mosaicColors.mid} />
              <polygon points="50,0 100,0 75,40" fill={mosaicColors.dark} />
              <polygon points="100,0 75,40 125,40" fill={mosaicColors.mid} />
              <polygon points="100,0 150,0 125,40" fill={mosaicColors.light} />
              <polygon points="150,0 125,40 175,40" fill={mosaicColors.mid} />
              <polygon points="150,0 200,0 175,40" fill={mosaicColors.dark} />
              <polygon points="200,0 175,40 225,40" fill={mosaicColors.mid} />
              <polygon points="200,0 250,0 225,40" fill={mosaicColors.light} />
              <polygon points="250,0 225,40 275,40" fill={mosaicColors.dark} />
              <polygon points="250,0 300,0 275,40" fill={mosaicColors.mid} />
              <polygon points="300,0 275,40 300,40" fill={mosaicColors.light} />
              {/* Row 2 */}
              <polygon points="0,40 25,40 0,80" fill={mosaicColors.dark} />
              <polygon points="25,40 0,80 50,80" fill={mosaicColors.mid} />
              <polygon points="25,40 75,40 50,80" fill={mosaicColors.deepest} />
              <polygon points="75,40 50,80 100,80" fill={mosaicColors.dark} />
              <polygon points="75,40 125,40 100,80" fill={mosaicColors.mid} />
              <polygon points="125,40 100,80 150,80" fill={mosaicColors.deepest} />
              <polygon points="125,40 175,40 150,80" fill={mosaicColors.dark} />
              <polygon points="175,40 150,80 200,80" fill={mosaicColors.mid} />
              <polygon points="175,40 225,40 200,80" fill={mosaicColors.dark} />
              <polygon points="225,40 200,80 250,80" fill={mosaicColors.deepest} />
              <polygon points="225,40 275,40 250,80" fill={mosaicColors.mid} />
              <polygon points="275,40 250,80 300,80" fill={mosaicColors.dark} />
              {/* Row 3 */}
              <polygon points="0,80 50,80 25,120" fill={mosaicColors.dark} />
              <polygon points="50,80 25,120 75,120" fill={mosaicColors.deepest} />
              <polygon points="50,80 100,80 75,120" fill={mosaicColors.mid} />
              <polygon points="100,80 75,120 125,120" fill={mosaicColors.dark} />
              <polygon points="100,80 150,80 125,120" fill={mosaicColors.deepest} />
              <polygon points="150,80 125,120 175,120" fill={mosaicColors.mid} />
              <polygon points="150,80 200,80 175,120" fill={mosaicColors.dark} />
              <polygon points="200,80 175,120 225,120" fill={mosaicColors.deepest} />
              <polygon points="200,80 250,80 225,120" fill={mosaicColors.mid} />
              <polygon points="250,80 225,120 275,120" fill={mosaicColors.dark} />
              <polygon points="250,80 300,80 275,120" fill={mosaicColors.deepest} />
              <polygon points="300,80 275,120 300,120" fill={mosaicColors.mid} />
              {/* Row 4 */}
              <polygon points="0,120 25,120 0,160" fill={mosaicColors.deepest} />
              <polygon points="25,120 0,160 50,160" fill={mosaicColors.dark} />
              <polygon points="25,120 75,120 50,160" fill={mosaicColors.deepest} />
              <polygon points="75,120 50,160 100,160" fill={mosaicColors.dark} />
              <polygon points="75,120 125,120 100,160" fill={mosaicColors.deepest} />
              <polygon points="125,120 100,160 150,160" fill={mosaicColors.dark} />
              <polygon points="125,120 175,120 150,160" fill={mosaicColors.deepest} />
              <polygon points="175,120 150,160 200,160" fill={mosaicColors.dark} />
              <polygon points="175,120 225,120 200,160" fill={mosaicColors.deepest} />
              <polygon points="225,120 200,160 250,160" fill={mosaicColors.dark} />
              <polygon points="225,120 275,120 250,160" fill={mosaicColors.deepest} />
              <polygon points="275,120 250,160 300,160" fill={mosaicColors.dark} />
              {/* Bottom row */}
              <rect x="0" y="160" width="300" height="32" fill={mosaicColors.deepest} />
            </svg>
          )}
        </div>
        
        {/* Avatar - Centered, overlapping */}
        <div className={`absolute w-[114px] h-[114px] bg-white ${photoShapeClass} flex justify-center items-center z-10`} style={{ top: '135px' }}>
          <div className={`w-[100px] h-[100px] ${photoShapeInnerClass} overflow-hidden bg-white`}>
            {data.profilePhotoUrl ? (
              <img src={data.profilePhotoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
          </div>
        </div>
        
        {/* Name & Title */}
        <div className="mt-[60px] text-center px-4 w-full">
          <h3 
            className={`text-lg font-medium ${getTextStyleClasses(data.nameStyle)}`}
            style={{ color: data.nameStyle?.color || '#000' }}
          >
            {data.firstName || 'Cameron'} {data.lastName || 'Williamson'}
          </h3>
          <p 
            className={`mt-1 text-[15px] ${getTextStyleClasses(data.titleStyle)}`}
            style={{ color: data.titleStyle?.color || '#78858F' }}
          >
            {data.jobTitle || 'Web Development'}
          </p>
        </div>
        
        {/* Logo */}
        {data.logoUrl && (
          <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-20`}>
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* All Active Links - Customizable */}
        <div className="flex flex-wrap justify-center gap-3 mt-4 px-4 w-full">
          {activeLinks.map((link, i) => (
            <div 
              key={i} 
              className={`flex items-center justify-center hover:scale-110 transition-transform cursor-pointer ${
                iconStyle.showBackground 
                  ? 'w-9 h-9 rounded-full shadow-md' 
                  : 'w-8 h-8'
              }`}
              style={iconStyle.showBackground ? { 
                backgroundColor: getIconBackgroundColor(iconStyle.backgroundColor),
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              } : undefined}
            >
              <link.icon 
                className={iconStyle.showBackground ? 'w-4 h-4' : 'w-5 h-5'} 
                style={{ color: getIconColor(link.color) }} 
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // STYLE 2: Professional - Blue bands with avatar, contact list
  if (template.headerStyle === 'professional') {
    return (
      <div className="w-[300px] mx-auto rounded-lg shadow-xl overflow-hidden bg-white flex flex-col items-center relative min-h-[400px]">
        {/* Cover Photo Background (optional) */}
        {data.coverPhotoUrl && (
          <div className="absolute inset-0 h-24 opacity-20">
            <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Logo */}
        {data.logoUrl && (
          <div className={`absolute ${logoPositionClass} w-8 h-8 rounded-md bg-white/90 p-1 shadow-sm z-50`}>
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Avatar section with blue bands */}
        <div className="w-full pt-5 flex items-center justify-center flex-col gap-1">
          <div className="w-full flex items-center justify-center relative">
            {/* Top blue band */}
            <div
              className="absolute w-full top-4"
              style={{ backgroundColor: professionalColors.line, height: `${professionalColors.lineHeight}px` }}
            />
            {/* Bottom blue band */}
            <div
              className="absolute w-full bottom-4"
              style={{ backgroundColor: professionalColors.line, height: `${professionalColors.lineHeight}px` }}
            />
            {/* Avatar */}
            <div className={`w-36 h-36 z-40 ${photoShapeClass} overflow-hidden bg-white border-4`} style={{ borderColor: professionalColors.ring }}>
              {data.profilePhotoUrl ? (
                <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
              ) : (
                <div className="w-full h-full bg-[#58b0e0] flex items-center justify-center">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>
            {/* Blue background behind avatar */}
            <div
              className="absolute z-10 w-full"
              style={{ backgroundColor: professionalColors.band, height: `${professionalColors.bandHeight}%` }}
            />
          </div>
        </div>
        
        {/* Name & Title */}
        <div className="text-center leading-4 mt-2 px-2">
          <p 
            className={`text-xl font-serif font-semibold ${getTextStyleClasses(data.nameStyle)}`}
            style={{ color: data.nameStyle?.color || '#434955' }}
          >
            {(data.firstName || 'ANNA').toUpperCase()} {(data.lastName || 'WILSON').toUpperCase()}
          </p>
          <p 
            className={`text-sm font-semibold mt-1 ${getTextStyleClasses(data.titleStyle)}`}
            style={{ color: data.titleStyle?.color || '#434955' }}
          >
            {(data.jobTitle || 'DEVELOPER').toUpperCase()}
          </p>
        </div>
        
        {/* Contact Info List - Customizable */}
        <div className="w-full flex items-center justify-center mt-4 px-4 mb-4">
          <ul className="flex flex-col items-start gap-2 text-xs font-semibold text-[#434955] w-full max-w-[240px]">
            {activeLinks.map((link, i) => (
              <li key={i} className="inline-flex gap-2 items-center border-b border-dotted border-stone-700/30 pb-1 w-full truncate">
                <link.icon className="w-4 h-4 shrink-0" style={{ color: getIconColor(link.color) }} />
                <p className="truncate">{link.url}</p>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Bottom blue bar */}
        <div className="w-full h-3 mt-auto" style={{ backgroundColor: professionalColors.band }} />
      </div>
    );
  }
  
  // STYLE 3: Fashion - White top, gray curved bottom with star decoration
  if (template.headerStyle === 'fashion') {
    return (
      <div className="w-[300px] mx-auto rounded-lg shadow-xl overflow-hidden bg-white flex flex-col items-center py-8 px-6 gap-3 relative min-h-[450px]">
        {/* Cover Photo Background (optional) */}
        {data.coverPhotoUrl && (
          <div className="absolute inset-0 opacity-10">
            <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}
        
        {/* Logo */}
        {data.logoUrl && (
          <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-50`}>
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Decorative star */}
        <div className="absolute -left-[40%] top-0">
          <svg 
            className="rotate-[24deg]" 
            height="200" 
            width="200" 
            viewBox="0 0 24 24" 
            style={{ 
              fill: fashionColors.star,
              filter: fashionColors.starGlow ? `drop-shadow(0 0 12px ${fashionColors.star}) drop-shadow(0 0 24px ${fashionColors.star})` : 'none',
            }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        
        {/* Gray curved background */}
        <div className="absolute rounded-full z-20 left-1/2 top-[44%] h-[110%] w-[110%] -translate-x-1/2" style={{ backgroundColor: fashionColors.curve }} />
        
        {/* Title */}
        <div className="uppercase text-center leading-none z-40">
          <p 
            className={`font-bold text-xl tracking-wider ${getTextStyleClasses(data.companyStyle)}`}
            style={{ color: data.companyStyle?.color || '#6b7280' }}
          >
            {data.companyName || 'Fashion'}
          </p>
        </div>
        
        {/* Photo */}
        <div className={`w-[180px] aspect-square bg-white z-40 ${photoShapeClass} overflow-hidden shadow-lg`}>
          {data.profilePhotoUrl ? (
            <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <User className="w-20 h-20 text-white/70" />
            </div>
          )}
        </div>
        
        {/* Contact Grid - Customizable */}
        <div className="z-40 w-full mt-2">
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 w-full">
            {activeLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2 overflow-hidden bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                <div 
                  className="p-1 flex items-center justify-center rounded-full shrink-0"
                  style={iconStyle.showBackground ? { backgroundColor: getIconBackgroundColor(iconStyle.backgroundColor) } : { backgroundColor: 'white' }}
                >
                  <link.icon className="h-3 w-3" style={{ color: getIconColor(link.color) }} />
                </div>
                <p className="font-semibold text-[10px] text-white truncate">{link.url}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // STYLE 4: Minimal Dark - All black elegant card
  if (template.headerStyle === 'minimal') {
    return (
      <div className="w-[300px] mx-auto rounded-[20px] shadow-2xl overflow-hidden flex flex-col min-h-[400px]" style={{ backgroundColor: minimalColors.background }}>
        {/* Header with cover */}
        <div className="h-24 relative shrink-0" style={{ backgroundColor: minimalColors.header }}>
          {data.coverPhotoUrl && (
            <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover opacity-50" />
          )}
          {/* Logo */}
          {data.logoUrl && (
            <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/10 p-1`}>
              <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
        
        {/* Avatar */}
        <div className="flex justify-center -mt-14 relative z-10">
          <div className={`w-28 h-28 ${photoShapeClass} border-4 bg-white p-1 shadow-lg`} style={{ borderColor: minimalColors.accent }}>
            {data.profilePhotoUrl ? (
              <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-12 h-12" style={{ color: minimalColors.muted }} />
              </div>
            )}
          </div>
        </div>
        
        {/* Name & Title */}
        <div className="text-center mt-3 px-5">
          <h3 
            className={`text-xl font-light tracking-wide ${getTextStyleClasses(data.nameStyle)}`}
            style={{ color: data.nameStyle?.color || minimalColors.text }}
          >
            {data.firstName || 'Your'} {data.lastName || 'Name'}
          </h3>
          <p 
            className={`text-sm mt-1 tracking-wider uppercase ${getTextStyleClasses(data.titleStyle)}`}
            style={{ color: data.titleStyle?.color || minimalColors.muted }}
          >
            {data.jobTitle || 'Job Title'}
          </p>
          {data.companyName && (
            <p className="text-xs mt-1 opacity-70" style={{ color: minimalColors.muted }}>{data.companyName}</p>
          )}
        </div>
        
        {/* Contact Info & Socials - Customizable */}
        <div className="px-5 py-4 space-y-3 flex-1">
          {activeLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2 last:border-0" style={{ color: minimalColors.muted }}>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={iconStyle.showBackground ? { backgroundColor: getIconBackgroundColor(iconStyle.backgroundColor) } : { backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <link.icon className="w-4 h-4" style={{ color: getIconColor(link.color) }} />
              </div>
              <span className="truncate">{link.url}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // STYLE 5: Clean White - Minimal white card with actual data
  return (
    <div className="w-[300px] mx-auto rounded-[20px] shadow-xl overflow-hidden flex flex-col relative min-h-[400px]" style={{ backgroundColor: cleanColors.background }}>
      {/* Logo */}
      {data.logoUrl && (
        <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-10`}>
          <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
        </div>
      )}
      
      {/* Header */}
      <div className="h-28 relative flex items-center justify-center shrink-0" style={{ backgroundColor: cleanColors.header }}>
        {data.coverPhotoUrl ? (
          <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cleanColors.accent }}>
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      
      {/* Avatar */}
      <div className="flex justify-start px-5 -mt-8 relative z-10">
        <div className={`w-20 h-20 ${photoShapeClass} border-4 overflow-hidden bg-white shadow-lg`} style={{ borderColor: cleanColors.accent }}>
          {data.profilePhotoUrl ? (
            <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cleanColors.header }}>
              <User className="w-8 h-8" style={{ color: cleanColors.muted }} />
            </div>
          )}
        </div>
      </div>
      
      {/* Name & Title */}
      <div className="px-5 mt-3">
        <h3 
          className={`text-lg font-semibold ${getTextStyleClasses(data.nameStyle)}`}
          style={{ color: data.nameStyle?.color || cleanColors.text }}
        >
          {data.firstName || 'Your'} {data.lastName || 'Name'}
        </h3>
        <p 
          className={`text-sm mt-1 ${getTextStyleClasses(data.titleStyle)}`}
          style={{ color: data.titleStyle?.color || cleanColors.muted }}
        >
          {data.jobTitle || 'Job Title'}
        </p>
        {data.companyName && (
          <p className="text-xs mt-1" style={{ color: cleanColors.muted }}>{data.companyName}</p>
        )}
      </div>
      
      {/* All Links - Customizable */}
      <div className="px-5 py-4 space-y-3 flex-1">
        {activeLinks.map((link, i) => (
          <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-black/5 transition-colors" style={{ color: cleanColors.muted }}>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={iconStyle.showBackground ? { backgroundColor: getIconBackgroundColor(iconStyle.backgroundColor) } : { backgroundColor: '#f3f4f6' }}
            >
              <link.icon className="w-4 h-4" style={{ color: getIconColor(link.color) }} />
            </div>
            <span className="truncate">{link.url}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Card Preview Component for Style Tab (alias)
const CardPreview: React.FC<{ data: BusinessCardData }> = ({ data }) => {
  return <CardPreviewLive data={data} />;
};

export { CardPreviewLive };
export default BusinessCardBuilder;
