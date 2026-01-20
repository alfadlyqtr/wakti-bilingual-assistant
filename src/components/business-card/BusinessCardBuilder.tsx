import React, { useState, useCallback, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
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

// Social platforms config
const SOCIAL_PLATFORMS = [
  { type: 'phone', icon: Phone, label: 'Phone Number', placeholder: '+1234567890' },
  { type: 'email', icon: Mail, label: 'Email', placeholder: 'email@example.com' },
  { type: 'website', icon: Globe, label: 'Website', placeholder: 'https://...' },
  { type: 'linkedin', icon: Linkedin, label: 'LinkedIn', placeholder: 'linkedin.com/in/...' },
  { type: 'instagram', icon: Instagram, label: 'Instagram', placeholder: '@username' },
  { type: 'twitter', icon: Twitter, label: 'X (Twitter)', placeholder: '@username' },
  { type: 'facebook', icon: Facebook, label: 'Facebook', placeholder: 'facebook.com/...' },
  { type: 'youtube', icon: Youtube, label: 'YouTube', placeholder: 'youtube.com/...' },
  { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', placeholder: '+1234567890' },
  { type: 'telegram', icon: Send, label: 'Telegram', placeholder: '@username' },
  { type: 'github', icon: Github, label: 'GitHub', placeholder: 'github.com/...' },
  { type: 'calendly', icon: Calendar, label: 'Calendly', placeholder: 'calendly.com/...' },
  { type: 'tiktok', icon: Sparkles, label: 'TikTok', placeholder: '@username' },
  { type: 'snapchat', icon: Camera, label: 'Snapchat', placeholder: '@username' },
  { type: 'address', icon: MapPin, label: 'Address', placeholder: '123 Main St...' },
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
      toast({
        title: isRTL ? 'تم الحفظ!' : 'Saved!',
        description: isRTL ? 'تم حفظ بطاقتك بنجاح' : 'Your card has been saved successfully',
      });
    } catch (error) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حفظ البطاقة' : 'Failed to save card',
        variant: 'destructive',
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

  // Render Links Tab
  const renderLinksTab = () => {
    const addedTypes = new Set((formData.socialLinks || []).map(l => l.type));
    const availablePlatforms = SOCIAL_PLATFORMS.filter(p => !addedTypes.has(p.type));

    return (
      <div className="space-y-6">
        {/* Added Links */}
        {(formData.socialLinks || []).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t.addedLinks}</h3>
              <p className="text-xs text-muted-foreground">{t.holdToReorder}</p>
            </div>
            
            <div className="space-y-2">
              {(formData.socialLinks || []).map((link) => {
                const platform = SOCIAL_PLATFORMS.find(p => p.type === link.type);
                const Icon = platform?.icon || Link2;
                
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={link.url}
                        onChange={(e) => updateSocialLink(link.id, e.target.value)}
                        placeholder={platform?.placeholder}
                        className="bg-transparent border-0 border-b border-white/10 rounded-none px-0 h-8 focus-visible:ring-0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{platform?.label}</p>
                    </div>
                    <button
                      onClick={() => removeSocialLink(link.id)}
                      aria-label={isRTL ? 'حذف الرابط' : 'Remove link'}
                      title={isRTL ? 'حذف الرابط' : 'Remove link'}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}

            </div>
          </div>
        )}

        {/* Available Links */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t.tapToAdd}</h3>
            <Plus className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {availablePlatforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.type}
                  onClick={() => addSocialLink(platform.type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">{platform.label}</span>
                </button>
              );
            })}
          </div>
        </div>
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
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <h1 className="text-lg font-bold">{t.builder}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-blue-400"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
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
  
  // STYLE 1: Geometric Mosaic - Pink triangles, centered avatar overlapping
  if (template.headerStyle === 'mosaic') {
    return (
      <div className="w-[300px] h-[384px] mx-auto rounded-[20px] bg-white shadow-xl flex flex-col items-center relative">
        {/* Mosaic Header */}
        <div className="w-full h-[192px] rounded-t-[20px] overflow-hidden">
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
        <div className={`absolute w-[114px] h-[114px] bg-white ${photoShapeClass} flex justify-center items-center`} style={{ top: 'calc(50% - 57px)' }}>
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
        <h3 
          className={`mt-[60px] text-lg font-medium ${getTextStyleClasses(data.nameStyle)}`}
          style={{ color: data.nameStyle?.color || '#000' }}
        >
          {data.firstName || 'Cameron'} {data.lastName || 'Williamson'}
        </h3>
        <p 
          className={`mt-2 text-[15px] ${getTextStyleClasses(data.titleStyle)}`}
          style={{ color: data.titleStyle?.color || '#78858F' }}
        >
          {data.jobTitle || 'Web Development'}
        </p>
        
        {/* Logo */}
        {data.logoUrl && (
          <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm`}>
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Contact Info */}
        <div className="flex items-center gap-3 mt-4">
          {data.phone && (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Phone className="w-4 h-4 text-gray-700" />
            </div>
          )}
          {data.email && (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Mail className="w-4 h-4 text-gray-700" />
            </div>
          )}
          {data.website && (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-gray-700" />
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // STYLE 2: Professional - Blue bands with avatar, contact list
  if (template.headerStyle === 'professional') {
    return (
      <div className="w-[300px] mx-auto rounded-lg shadow-xl overflow-hidden bg-white flex flex-col items-center relative">
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
        <div className="text-center leading-4 mt-2">
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
        
        {/* Contact Info */}
        <div className="w-full flex items-center justify-center mt-3">
          <ul className="flex flex-col items-start gap-2 text-xs font-semibold text-[#434955] pb-3">
            {data.phone && (
              <li className="inline-flex gap-2 items-center border-b border-dotted border-stone-700 pb-1">
                <Phone className="w-4 h-4 fill-stone-700" />
                <p>{data.phone}</p>
              </li>
            )}
            {data.email && (
              <li className="inline-flex gap-2 items-center border-b border-dotted border-stone-700 pb-1">
                <Mail className="w-4 h-4 fill-stone-700" />
                <p>{data.email}</p>
              </li>
            )}
            {data.website && (
              <li className="inline-flex gap-2 items-center border-b border-dotted border-stone-700 pb-1">
                <Globe className="w-4 h-4 fill-stone-700" />
                <p>{data.website}</p>
              </li>
            )}
            {data.address && (
              <li className="inline-flex gap-2 items-center pb-1">
                <MapPin className="w-4 h-4 fill-stone-700" />
                <p>{data.address}</p>
              </li>
            )}
          </ul>
        </div>
        
        {/* Bottom blue bar */}
        <div className="w-full h-3" style={{ backgroundColor: professionalColors.band }} />
      </div>
    );
  }
  
  // STYLE 3: Fashion - White top, gray curved bottom with star decoration
  if (template.headerStyle === 'fashion') {
    return (
      <div className="w-[300px] mx-auto rounded-lg shadow-xl overflow-hidden bg-white flex flex-col items-center py-8 px-6 gap-3 relative">
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
        <div className={`w-[180px] aspect-square bg-white z-40 ${photoShapeClass} overflow-hidden`}>
          {data.profilePhotoUrl ? (
            <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <User className="w-20 h-20 text-white/70" />
            </div>
          )}
        </div>
        
        {/* Contact */}
        <div className="z-40 flex flex-row justify-between items-end gap-10 w-full">
          <div className="flex flex-col items-start gap-1">
            {data.phone && (
              <div className="inline-flex gap-3 items-center">
                <div className="p-1 bg-white flex items-center justify-center rounded-full">
                  <Phone className="h-3 w-3 fill-gray-800" />
                </div>
                <p className="font-semibold text-xs text-white">{data.phone}</p>
              </div>
            )}
            {data.email && (
              <div className="inline-flex gap-3 items-center">
                <div className="p-1 bg-white flex items-center justify-center rounded-full">
                  <Mail className="h-3 w-3 fill-gray-800" />
                </div>
                <p className="font-semibold text-xs text-white">{data.email}</p>
              </div>
            )}
            {data.website && (
              <div className="inline-flex gap-3 items-center">
                <div className="p-1 bg-white flex items-center justify-center rounded-full">
                  <Globe className="h-3 w-3 fill-gray-800" />
                </div>
                <p className="font-semibold text-xs text-white">{data.website}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // STYLE 4: Minimal Dark - All black elegant card
  if (template.headerStyle === 'minimal') {
    return (
      <div className="w-[300px] mx-auto rounded-[20px] shadow-2xl overflow-hidden flex flex-col" style={{ backgroundColor: minimalColors.background }}>
        {/* Header with cover */}
        <div className="h-24 relative" style={{ backgroundColor: minimalColors.header }}>
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
        <div className="flex justify-center mt-4">
          <div className={`w-28 h-28 ${photoShapeClass} border-4 bg-white p-1`} style={{ borderColor: minimalColors.accent }}>
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
            <p className="text-xs mt-1" style={{ color: minimalColors.muted }}>{data.companyName}</p>
          )}
        </div>
        
        {/* Contact Info */}
        <div className="px-5 py-4 space-y-2">
          {data.phone && (
            <div className="flex items-center gap-3 text-sm" style={{ color: minimalColors.muted }}>
              <Phone className="w-4 h-4" />
              <span>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-3 text-sm" style={{ color: minimalColors.muted }}>
              <Mail className="w-4 h-4" />
              <span>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-3 text-sm" style={{ color: minimalColors.muted }}>
              <Globe className="w-4 h-4" />
              <span>{data.website}</span>
            </div>
          )}
        </div>
        
        {/* Social Links */}
        {(data.socialLinks || []).length > 0 && (
          <div className="flex items-center justify-center gap-3 pb-5 pt-3 mx-5" style={{ borderTop: `1px solid ${minimalColors.accent}` }}>
            {(data.socialLinks || []).slice(0, 5).map((link) => {
              const platform = SOCIAL_PLATFORMS.find(p => p.type === link.type);
              const Icon = platform?.icon || Link2;
              return (
                <div key={link.id} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: minimalColors.accent }}>
                  <Icon className="w-4 h-4" style={{ color: minimalColors.text }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  // STYLE 5: Clean White - Minimal white card with actual data
  return (
    <div className="w-[300px] mx-auto rounded-[20px] shadow-xl overflow-hidden flex flex-col relative" style={{ backgroundColor: cleanColors.background }}>
      {/* Logo */}
      {data.logoUrl && (
        <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-10`}>
          <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
        </div>
      )}
      
      {/* Header */}
      <div className="h-28 relative flex items-center justify-center" style={{ backgroundColor: cleanColors.header }}>
        {data.coverPhotoUrl ? (
          <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cleanColors.accent }}>
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      
      {/* Avatar */}
      <div className="flex justify-start px-5 mt-6">
        <div className={`w-16 h-16 ${photoShapeClass} border-4 overflow-hidden bg-white shadow-lg`} style={{ borderColor: cleanColors.accent }}>
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
      
      {/* Contact Info */}
      <div className="px-5 py-4 space-y-2">
        {data.phone && (
          <div className="flex items-center gap-3 text-sm" style={{ color: cleanColors.muted }}>
            <Phone className="w-4 h-4" />
            <span>{data.phone}</span>
          </div>
        )}
        {data.email && (
          <div className="flex items-center gap-3 text-sm" style={{ color: cleanColors.muted }}>
            <Mail className="w-4 h-4" />
            <span>{data.email}</span>
          </div>
        )}
        {data.website && (
          <div className="flex items-center gap-3 text-sm" style={{ color: cleanColors.muted }}>
            <Globe className="w-4 h-4" />
            <span>{data.website}</span>
          </div>
        )}
      </div>
      
      {/* Social Links */}
      {(data.socialLinks || []).length > 0 && (
        <div className="flex items-center gap-2 px-5 pb-4">
          {(data.socialLinks || []).slice(0, 5).map((link) => {
            const platform = SOCIAL_PLATFORMS.find(p => p.type === link.type);
            const Icon = platform?.icon || Link2;
            return (
              <div key={link.id} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: cleanColors.header }}>
                <Icon className="w-4 h-4" style={{ color: cleanColors.muted }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Card Preview Component for Style Tab (alias)
const CardPreview: React.FC<{ data: BusinessCardData }> = ({ data }) => {
  return <CardPreviewLive data={data} />;
};

export default BusinessCardBuilder;
