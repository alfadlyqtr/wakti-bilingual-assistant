import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import jsQR from 'jsqr';
import { BusinessCardWizard } from '@/components/business-card/BusinessCardWizard';
import { BusinessCardBuilder, CardPreviewLive } from '@/components/business-card/BusinessCardBuilder';
import { CardCreatedCelebration } from '@/components/business-card/CardCreatedCelebration';
import { CVBuilderWizard } from '@/components/cv-builder';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { StudioGuestLoginDialog } from '@/components/studio/StudioGuestLoginDialog';
import { supabase } from '@/integrations/supabase/client';
import ShareButton from '@/components/ui/ShareButton';
import { 
  scheduleDocExpiryPush, rescheduleDocExpiryPush, findExistingDocExpiryNotification, cancelDocExpiryNotification 
} from '@/services/DocumentExpiryReminderService';
import { 
  Shield, Plus, SortAsc, Camera, Upload, X, 
  ChevronLeft, Trash2, FileText, MessageCircle, Calendar,
  Tag, Clock, CheckCircle, AlertTriangle, AlertCircle, XCircle, Loader2,
  Edit2, ExternalLink, CreditCard, User, FolderOpen, ChevronDown, Phone, Mail, Globe, MapPin, Link2, Send, ArrowLeft,
  Store, Hash, Receipt, Package, LayoutGrid, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, differenceInMonths, parseISO, addMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface WarrantyCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  item_count: number;
}

interface WarrantyItem {
  id: string;
  user_id: string;
  product_name: string;
  category_id: string | null;
  purchase_date: string | null;
  expiry_date: string | null;
  warranty_months: number | null;
  image_url: string | null;
  receipt_url: string | null;
  file_type: string | null;
  extracted_data: Record<string, unknown>;
  ai_summary: string | null;
  notes: string | null;
  provider: string | null;
  ref_number: string | null;
  support_contact: string | null;
  status: 'active' | 'expiring_soon' | 'expired';
  created_at: string;
  category?: WarrantyCategory;
}

type ViewMode = 'list' | 'detail' | 'add' | 'categories' | 'ask';

interface SocialLink {
  id: string;
  type: string;
  url: string;
  label?: string;
}

interface TextStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
}

const CompactCardPreview: React.FC<{ data: BusinessCardData }> = ({ data }) => {
  const template = (data.template || 'geometric');

  const headerBg = (() => {
    if (template === 'minimal') return data.minimalColors?.header || '#12161f';
    if (template === 'clean') return data.cleanColors?.header || '#e9ceb0';
    if (template === 'fashion') return data.fashionColors?.curve || '#7c7a79';
    if (template === 'professional') return data.professionalColors?.band || '#1d4ed8';
    // geometric
    const light = data.mosaicColors?.light || '#93c5fd';
    const mid = data.mosaicColors?.mid || '#60a5fa';
    const dark = data.mosaicColors?.dark || '#2563eb';
    return `linear-gradient(135deg, ${light} 0%, ${mid} 50%, ${dark} 100%)`;
  })();

  const bg = (() => {
    if (template === 'minimal') return data.minimalColors?.background || '#0b0f14';
    if (template === 'clean') return data.cleanColors?.background || '#ffffff';
    return '#ffffff';
  })();

  const text = (() => {
    if (template === 'minimal') return data.minimalColors?.text || '#f2f2f2';
    if (template === 'clean') return data.cleanColors?.text || '#060541';
    return '#111827';
  })();

  const muted = (() => {
    if (template === 'minimal') return data.minimalColors?.muted || 'rgba(242,242,242,0.7)';
    if (template === 'clean') return data.cleanColors?.muted || '#606062';
    return '#6b7280';
  })();

  const photoShapeClass = data.photoShape === 'square' ? 'rounded-xl' : 'rounded-full';
  const photoShapeInnerClass = data.photoShape === 'square' ? 'rounded-lg' : 'rounded-full';

  const iconStyle = {
    showBackground: data.iconStyle?.showBackground ?? true,
    backgroundColor: data.iconStyle?.backgroundColor || '#000000',
    iconColor: data.iconStyle?.iconColor || '#ffffff',
    useBrandColors: data.iconStyle?.useBrandColors !== false,
    colorIntensity: data.iconStyle?.colorIntensity ?? 50,
  };

  const activeLinks = [
    ...(data.phone ? [{ type: 'phone', url: data.phone, icon: Phone, color: '#22c55e' }] : []),
    ...(data.email ? [{ type: 'email', url: data.email, icon: Mail, color: '#ef4444' }] : []),
    ...(data.website ? [{ type: 'website', url: data.website, icon: Globe, color: '#3b82f6' }] : []),
    ...(data.address ? [{ type: 'address', url: data.address, icon: MapPin, color: '#f97316' }] : []),
    ...(data.socialLinks || []).map((link) => ({
      type: link.type,
      url: link.url,
      icon: Link2,
      color: '#6b7280'
    }))
  ].filter(l => (l.url || '').trim().length > 0).slice(0, 6);

  const getIconColor = (brandColor: string) => {
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

  const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Your Name';
  const title = (data.jobTitle || '').trim();

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: bg }}>
      <div className="relative h-20">
        {data.coverPhotoUrl ? (
          <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: headerBg as any }} />
        )}
        {data.logoUrl ? (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/90 p-1 shadow-sm">
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <div className="-mt-8 flex justify-center">
          <div className={`w-16 h-16 ${photoShapeClass} bg-white p-1 shadow-lg`}>
            <div className={`w-full h-full ${photoShapeInnerClass} overflow-hidden bg-white`}>
              {data.profilePhotoUrl ? (
                <img src={data.profilePhotoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-base font-semibold truncate" style={{ color: text }}>{name}</p>
          {title ? (
            <p className="text-xs truncate" style={{ color: muted }}>{title}</p>
          ) : null}
        </div>

        {activeLinks.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {activeLinks.map((l, i) => (
              <div
                key={`${l.type}-${i}`}
                className={`flex items-center justify-center ${iconStyle.showBackground ? 'w-8 h-8 rounded-full' : 'w-7 h-7'}`}
                style={iconStyle.showBackground ? { backgroundColor: getIconBackgroundColor(iconStyle.backgroundColor) } : undefined}
              >
                <l.icon className={iconStyle.showBackground ? 'w-3.5 h-3.5' : 'w-4 h-4'} style={{ color: getIconColor(l.color) }} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

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
    colorIntensity?: number;
  };
}

const ScaledCardPreview: React.FC<{
  data: BusinessCardData;
  isFlipped: boolean;
  handleFlip: () => void;
}> = ({ data, isFlipped, handleFlip }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(0.9);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const measureScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const baseWidth = 300;
    const maxScale = 0.9;
    const next = Math.min(maxScale, containerWidth / baseWidth);
    setScale(next);
  }, []);

  const measureBox = useCallback(() => {
    const el = scaledRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    setBox({ width: rect.width, height: rect.height });
  }, []);

  useLayoutEffect(() => {
    measureScale();
  }, [measureScale, data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      measureScale();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [measureScale]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      measureBox();
    });
    return () => cancelAnimationFrame(raf);
  }, [measureBox, scale, data]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="mx-auto" style={box ? { width: box.width, height: box.height } : undefined}>
        <div
          ref={scaledRef}
          className="inline-block"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <CardPreviewLive data={data} isFlipped={isFlipped} handleFlip={handleFlip} handleAddToWallet={() => {}} />
        </div>
      </div>
    </div>
  );
};

const translations = {
  en: {
    title: 'My Documents',
    welcome: 'Welcome',
    youHave: 'you have',
    items: 'documents',
    warrantiesTab: 'Documents',
    askTab: 'Ask Wakti AI',
    // Main tabs
    myDocsTab: 'My Docs',
    myCardTab: 'Business Cards',
    myCVTab: 'My CV',
    // Docs hero
    docsHeroTitle: 'Your Smart Document Vault',
    docsHeroSubtitle: 'Store IDs, passports, warranties, policies & more. AI extracts key info so you can ask questions anytime.',
    docsFeature1: 'IDs & Passports',
    docsFeature2: 'Warranties',
    docsFeature3: 'Insurance Policies',
    docsFeature4: 'Contracts',
    // Card tab
    cardTitle: 'My Card',
    cardDescription: 'Store and manage your cards',
    cardComingSoon: 'Card management coming soon',
    // CV tab
    cvTitle: 'My CV',
    cvDescription: 'Create and manage your CV',
    cvComingSoon: 'CV builder coming soon',
    filterAll: 'All',
    filterExpiring: 'Expiring',
    filterExpired: 'Expired',
    addNew: 'Add Doc',
    sort: 'Sort',
    expiredItems: 'Expired Items',
    willExpireOn: 'Expires',
    expiredOn: 'Expired',
    monthsLeft: 'months left',
    daysLeft: 'days left',
    expired: 'Expired',
    analyzing: 'AI is reading your document...',
    uploadFile: 'Upload File',
    takePhoto: 'Take Photo',
    productName: 'Document Name',
    purchaseDate: 'Issue Date',
    warrantyMonths: 'Validity (months)',
    expiryDate: 'Expiry Date',
    coverage: 'Coverage',
    notes: 'Notes',
    viewReceipt: 'View Document',
    deleteItem: 'Delete',
    back: 'Back',
    edit: 'Edit',
    askWakti: 'Ask Wakti AI',
    askEmptyTitle: 'Ask about any document',
    askEmptyHint: 'Try questions like:',
    askExample1: 'Is my passport expiring soon?',
    askExample2: 'When does my rent agreement end?',
    askExample3: 'What is my policy coverage?',
    provider: 'Issuer',
    refNumber: 'Reference #',
    supportContact: 'Contact',
    categoryLabel: 'Category',
    snapPhoto: 'Snap Photo',
    uploadDocument: 'Upload Document',
    extractedInfo: 'Extracted Info',
    aiSummary: 'AI Summary',
    askQuestion: 'Ask anything about this document...',
    scopeTitle: 'Smart Scope',
    scopeHint: 'Tap to choose sources',
    scopeAuto: 'Auto',
    scopeAll: 'All Files',
    scopeInstruction: 'Ask a question — keep Auto or tap to pick files.',
    send: 'Send',
    noItems: 'No documents yet',
    addFirst: 'Add your first document',
    optional: 'Optional',
    save: 'Save',
    saveFile: 'Save File',
    cancel: 'Cancel',
    pdfDocument: 'PDF Document',
    aiAnalyzed: 'AI Analyzed',
    noDocument: 'No document',
    uploadedDocuments: 'Uploaded Documents',
    files: 'files',
    primary: 'Primary',
    completeDetails: 'Complete Details',
    waktiSummary: 'Wakti Summary',
    aiPowered: 'AI-powered analysis',
    fieldsDiscovered: 'fields discovered',
    extractedData: 'Extracted Data',
    noTagsYet: 'No tags yet',
    noReceipt: 'No receipt available',
    searchingDocs: 'Searching your documents...',
    analyzingText: 'Analyzing...',
    fullAccess: 'Full Access',
    myDigitalCards: 'My Digital Cards',
    cardsOf: 'of 2 cards',
    primaryCard: 'Primary Card',
    secondaryCard: 'Secondary Card',
    noCardsCollected: 'No Cards Collected',
    scanOthers: 'Scan other people\'s cards to save them here',
    scanCard: 'Scan a Card',
    collectedTab: 'Collected',
  },
  ar: {
    title: 'مستنداتي',
    welcome: 'أهلاً',
    youHave: 'لديك',
    items: 'مستندات',
    warrantiesTab: 'المستندات',
    askTab: 'اسأل وقتي الذكي',
    // Main tabs
    myDocsTab: 'مستنداتي',
    myCardTab: 'بطاقتي',
    myCVTab: 'سيرتي',
    // Docs hero
    docsHeroTitle: 'خزنة مستنداتك الذكية',
    docsHeroSubtitle: 'احفظ الهويات، جوازات السفر، الضمانات، وثائق التأمين والمزيد. الذكاء الاصطناعي يستخرج المعلومات المهمة.',
    docsFeature1: 'الهويات والجوازات',
    docsFeature2: 'الضمانات',
    docsFeature3: 'وثائق التأمين',
    docsFeature4: 'العقود',
    // Card tab
    cardTitle: 'بطاقتي',
    cardDescription: 'احفظ وأدر بطاقاتك',
    cardComingSoon: 'إدارة البطاقات قريباً',
    // CV tab
    cvTitle: 'سيرتي الذاتية',
    cvDescription: 'أنشئ وأدر سيرتك الذاتية',
    cvComingSoon: 'منشئ السيرة الذاتية قريباً',
    filterAll: 'الكل',
    filterExpiring: 'قريب الانتهاء',
    filterExpired: 'منتهي',
    addNew: 'إضافة',
    sort: 'ترتيب',
    expiredItems: 'مستندات منتهية',
    willExpireOn: 'ينتهي',
    expiredOn: 'انتهى',
    monthsLeft: 'شهور متبقية',
    daysLeft: 'أيام متبقية',
    expired: 'منتهي',
    analyzing: 'الذكاء الاصطناعي يقرأ مستندك...',
    uploadFile: 'رفع ملف',
    takePhoto: 'التقاط صورة',
    productName: 'اسم المستند',
    purchaseDate: 'تاريخ الإصدار',
    warrantyMonths: 'الصلاحية (بالشهور)',
    expiryDate: 'تاريخ الانتهاء',
    coverage: 'التغطية',
    notes: 'ملاحظات',
    viewReceipt: 'عرض المستند',
    deleteItem: 'حذف',
    back: 'رجوع',
    edit: 'تعديل',
    askWakti: 'اسأل وقتي الذكي',
    askEmptyTitle: 'اسأل عن أي مستند',
    askEmptyHint: 'جرّب أسئلة مثل:',
    askExample1: 'هل جواز سفري ينتهي قريباً؟',
    askExample2: 'متى تنتهي اتفاقية الإيجار؟',
    askExample3: 'ما هي تغطية وثيقة التأمين؟',
    provider: 'الجهة المصدرة',
    refNumber: 'رقم المرجع',
    supportContact: 'جهة الاتصال',
    categoryLabel: 'الفئة',
    snapPhoto: 'التقاط صورة',
    uploadDocument: 'رفع مستند',
    extractedInfo: 'المعلومات المستخرجة',
    aiSummary: 'ملخص الذكاء الاصطناعي',
    askQuestion: 'اسأل أي شيء عن هذا المستند...',
    scopeTitle: 'نطاق ذكي',
    scopeHint: 'اختر المصادر',
    scopeAuto: 'تلقائي',
    scopeAll: 'كل الملفات',
    scopeInstruction: 'اكتب سؤالك — اتركه تلقائي أو اختر الملفات.',
    send: 'إرسال',
    noItems: 'لا توجد مستندات بعد',
    addFirst: 'أضف أول مستند لك',
    optional: 'اختياري',
    save: 'حفظ',
    saveFile: 'حفظ الملف',
    cancel: 'إلغاء',
    pdfDocument: 'مستند PDF',
    aiAnalyzed: 'تم التحليل بالذكاء الاصطناعي',
    noDocument: 'لا يوجد مستند',
    uploadedDocuments: 'المستندات المرفوعة',
    files: 'ملفات',
    primary: 'الأساسية',
    completeDetails: 'التفاصيل الكاملة',
    waktiSummary: 'ملخص وقتي',
    aiPowered: 'تم التحليل بالذكاء الاصطناعي',
    fieldsDiscovered: 'حقل مكتشف',
    extractedData: 'البيانات المستخرجة',
    noTagsYet: 'لا توجد تصنيفات',
    noReceipt: 'لا يوجد إيصال',
    searchingDocs: 'جاري البحث في مستنداتك...',
    analyzingText: 'جاري التحليل...',
    fullAccess: 'وصول كامل',
    myDigitalCards: 'بطاقاتي الرقمية',
    cardsOf: 'من 2 بطاقات',
    primaryCard: 'البطاقة الرئيسية',
    secondaryCard: 'البطاقة الثانوية',
    noCardsCollected: 'لا توجد بطاقات محفوظة',
    scanOthers: 'امسح بطاقات الآخرين لحفظها هنا',
    scanCard: 'مسح بطاقة',
    collectedTab: 'المحفوظة',
  },
};

// Field label translations for extracted data
const fieldLabelTranslations: Record<string, string> = {
  // Document info
  serial_number: 'الرقم التسلسلي',
  document_type: 'نوع المستند',
  issuing_country: 'بلد الإصدار',
  issue_date: 'تاريخ الإصدار',
  expiry_date: 'تاريخ الانتهاء',
  document_number: 'رقم المستند',
  reference_number: 'رقم المرجع',
  policy_number: 'رقم الوثيقة',
  certificate_number: 'رقم الشهادة',
  license_number: 'رقم الرخصة',
  permit_number: 'رقم التصريح',
  registration_number: 'رقم التسجيل',
  file_number: 'رقم الملف',
  // Personal info
  full_name: 'الاسم الكامل',
  full_name_arabic: 'الاسم بالعربية',
  first_name: 'الاسم الأول',
  last_name: 'اسم العائلة',
  father_name: 'اسم الأب',
  date_of_birth: 'تاريخ الميلاد',
  place_of_birth: 'مكان الميلاد',
  nationality: 'الجنسية',
  gender: 'الجنس',
  marital_status: 'الحالة الاجتماعية',
  occupation: 'المهنة',
  employer: 'جهة العمل',
  national_id: 'رقم الهوية',
  passport_number: 'رقم الجواز',
  civil_id: 'الرقم المدني',
  blood_type: 'فصيلة الدم',
  // Contact info
  phone: 'الهاتف',
  mobile: 'الجوال',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  city: 'المدينة',
  country: 'الدولة',
  postal_code: 'الرمز البريدي',
  po_box: 'صندوق البريد',
  // Vehicle info
  make: 'الشركة المصنعة',
  model: 'الموديل',
  year: 'السنة',
  color: 'اللون',
  plate_number: 'رقم اللوحة',
  chassis_number: 'رقم الشاسيه',
  engine_number: 'رقم المحرك',
  vin: 'رقم الهيكل',
  vehicle_type: 'نوع المركبة',
  fuel_type: 'نوع الوقود',
  seating_capacity: 'عدد المقاعد',
  // Insurance info
  insurer_name: 'اسم شركة التأمين',
  policy_holder: 'حامل الوثيقة',
  coverage_type: 'نوع التغطية',
  coverage_amount: 'مبلغ التغطية',
  premium_amount: 'قسط التأمين',
  deductible: 'التحمل',
  start_date: 'تاريخ البداية',
  end_date: 'تاريخ النهاية',
  beneficiary_name: 'اسم المستفيد',
  // Financial info
  amount: 'المبلغ',
  total_amount: 'المبلغ الإجمالي',
  currency: 'العملة',
  payment_method: 'طريقة الدفع',
  bank_name: 'اسم البنك',
  account_number: 'رقم الحساب',
  // Product info
  product_name: 'اسم المنتج',
  brand: 'العلامة التجارية',
  manufacturer: 'الشركة المصنعة',
  warranty_period: 'فترة الضمان',
  purchase_date: 'تاريخ الشراء',
  // Company info
  company_name: 'اسم الشركة',
  trade_license: 'الرخصة التجارية',
  tax_id: 'الرقم الضريبي',
  // Common fields
  status: 'الحالة',
  type: 'النوع',
  category: 'الفئة',
  description: 'الوصف',
  notes: 'ملاحظات',
  remarks: 'ملاحظات',
  validity: 'الصلاحية',
  valid_from: 'صالح من',
  valid_to: 'صالح حتى',
  issued_by: 'صادر من',
  issuing_authority: 'الجهة المصدرة',
  provider: 'المزود',
  title: 'العنوان',
  name: 'الاسم',
};

// Helper function to translate field labels
const translateFieldLabel = (key: string, isRTL: boolean): string => {
  if (!isRTL) {
    // English: format the key nicely
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  // Arabic: look up translation or format key
  const lowerKey = key.toLowerCase();
  if (fieldLabelTranslations[lowerKey]) {
    return fieldLabelTranslations[lowerKey];
  }
  // Fallback: format the key nicely (for untranslated fields)
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const MyWarranty: React.FC = () => {
  const { language } = useTheme();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const getPublicBaseUrl = useCallback(() => {
    if (typeof window === 'undefined') return 'https://wakti.qa';
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return 'https://wakti.qa';
    // Always use wakti.qa for public card URLs
    return 'https://wakti.qa';
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mainTab, setMainTab] = useState<'docs' | 'card' | 'cv'>('docs');
  const [activeTab, setActiveTab] = useState<'warranties' | 'ask'>('warranties');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring' | 'expired'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WarrantyItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  
  const [newItem, setNewItem] = useState({
    title: '',
    provider: '',
    category: '',
    purchase_date: '',
    warranty_period: '',
    expiry_date: '',
    ref_number: '',
    support_contact: '',
    image_url: '', // Primary image
    receipt_url: '', // Backup for primary
    additional_images: [] as string[], // NEW: For front/back or multi-page
    file_type: '' as 'image' | 'pdf' | '',
    extracted_data: {} as Record<string, unknown>,
    ai_summary: '',
  });

  // Separate state for preview URLs (base64 data URLs for instant preview)
  const [previewUrls, setPreviewUrls] = useState({
    primary: '',
    additional: [] as string[]
  });

  const [newTagsInput, setNewTagsInput] = useState('');
  const [detailTagsInput, setDetailTagsInput] = useState('');
  const [docSide, setDocSide] = useState<'front' | 'back' | 'both'>('front'); // Document side selector
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [detailExpiryInput, setDetailExpiryInput] = useState('');
  
  // Collapsible sections state - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    document_info: true,
    personal_info: true,
    contact_info: true,
    vehicle_info: true,
    insurance_info: true,
    financial_info: true,
    product_info: true,
    medical_info: true,
    property_info: true,
    education_info: true,
    employment_info: true,
    company_info: true,
    additional_info: true,
  });
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Ask Wakti state
  const [askQuestion, setAskQuestion] = useState('');
  const [askMessages, setAskMessages] = useState<Array<{ 
    role: 'user' | 'assistant'; 
    content: string;
    needsClarification?: boolean;
    clarificationType?: string;
    options?: Array<{
      id: string;
      title: string;
      subtitle: string;
      expiry: string | null;
    }>;
  }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [docScopeMode, setDocScopeMode] = useState<'auto' | 'manual'>('auto');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  
  // Document viewer modal state
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<{ url: string; type: 'image' | 'pdf' } | null>(null);

  // Business Card state - supports up to 2 cards
  const [businessCards, setBusinessCards] = useState<(BusinessCardData & { cardSlot: number; cardName: string; shareSlug?: string; viewCount?: number })[]>([]);
  const [activeCardSlot, setActiveCardSlot] = useState<number>(1);
  const [showCardWizard, setShowCardWizard] = useState(false);
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLoadingCard, setIsLoadingCard] = useState(true);
  const [cardInnerTab, setCardInnerTab] = useState<'mycard' | 'collected'>('mycard');
  const [collectedCards, setCollectedCards] = useState<any[]>([]);
  const [collectedViewMode, setCollectedViewMode] = useState<'grid' | 'list'>('grid');

  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualScanValue, setManualScanValue] = useState('');
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCollectedPreviewOpen, setIsCollectedPreviewOpen] = useState(false);
  const [collectedPreview, setCollectedPreview] = useState<{ data: BusinessCardData; shareSlug?: string } | null>(null);
  const [isCollectedPreviewFlipped, setIsCollectedPreviewFlipped] = useState(false);

  const [myCardFlippedBySlot, setMyCardFlippedBySlot] = useState<Record<number, boolean>>({});
  const [showAnalyticsBySlot, setShowAnalyticsBySlot] = useState<Record<number, boolean>>({});
  const [cardSavesBySlot, setCardSavesBySlot] = useState<Record<string, number>>({});
  
  // Get current active card
  const businessCard = businessCards.find(c => c.cardSlot === activeCardSlot) || null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const stopQrScanner = useCallback(() => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((t) => t.stop());
      scanStreamRef.current = null;
    }
    const video = scanVideoRef.current;
    if (video) {
      try {
        (video as any).srcObject = null;
      } catch {}
    }
    scanCanvasRef.current = null;
    setIsScanning(false);
  }, []);

  const extractShareSlugFromValue = useCallback((value: string): string | null => {
    const raw = (value || '').trim();
    if (!raw) return null;
    try {
      const u = new URL(raw);
      const parts = u.pathname.split('/').filter(Boolean);
      const cardIdx = parts.findIndex((p) => p.toLowerCase() === 'card');
      if (cardIdx >= 0 && parts[cardIdx + 1]) return parts[cardIdx + 1];
      return null;
    } catch {
      // Not a URL; if it's just a slug, accept it
      if (/^[a-z0-9_-]{6,}$/i.test(raw)) return raw;
      return null;
    }
  }, []);

  const fetchCollectedCards = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('collected_business_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCollectedCards(Array.isArray(data) ? data : []);
    } catch {
      setCollectedCards([]);
    }
  }, [user]);

  const saveCollectedByShareSlug = useCallback(async (shareSlug: string) => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .rpc('get_business_card_by_share_slug', { p_share_slug: shareSlug });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Card not found');

    const snapshot = row;
    const ownerUserId = row.user_id || null;

    const { error: upsertError } = await (supabase as any)
      .from('collected_business_cards')
      .upsert(
        {
          user_id: user.id,
          share_slug: shareSlug,
          owner_user_id: ownerUserId,
          card_snapshot: snapshot,
        },
        { onConflict: 'user_id,share_slug' }
      );
    if (upsertError) throw upsertError;
  }, [user]);

  const handleScanResultValue = useCallback(async (value: string) => {
    const shareSlug = extractShareSlugFromValue(value);
    if (!shareSlug) {
      setScanError(isRTL ? 'رمز QR غير صالح' : 'Invalid QR code');
      return;
    }

    setScanError(null);
    setIsScanning(false);
    stopQrScanner();

    try {
      await saveCollectedByShareSlug(shareSlug);
      await fetchCollectedCards();
      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ البطاقة في المحفوظة' : 'Card saved to Collected',
      });
      setIsScanOpen(false);
      setManualScanValue('');
    } catch {
      setScanError(isRTL ? 'تعذر حفظ البطاقة' : 'Failed to save card');
    }
  }, [extractShareSlugFromValue, fetchCollectedCards, isRTL, saveCollectedByShareSlug, stopQrScanner]);

  const startQrScanner = useCallback(async () => {
    setScanError(null);

    if (typeof window === 'undefined') {
      setScanError(isRTL ? 'غير مدعوم' : 'Not supported');
      return;
    }

    try {
      setIsScanning(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        setIsScanning(false);
        setScanError(isRTL ? 'الكاميرا غير مدعومة على هذا الجهاز' : 'Camera is not supported on this device');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      scanStreamRef.current = stream;

      const video = scanVideoRef.current;
      if (!video) throw new Error('Video not ready');

      (video as any).srcObject = stream;
      await video.play();

      const hasDetector = typeof (window as any).BarcodeDetector !== 'undefined';
      const detector = hasDetector ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;

      const ensureCanvas = () => {
        if (!scanCanvasRef.current) {
          scanCanvasRef.current = document.createElement('canvas');
        }
        const canvas = scanCanvasRef.current;
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        if (canvas && vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
          canvas.width = vw;
          canvas.height = vh;
        }
        return canvas;
      };

      const tick = async () => {
        try {
          if (!scanVideoRef.current) return;
          if (detector) {
            const results = await detector.detect(scanVideoRef.current);
            if (results && results.length > 0) {
              const value = results[0].rawValue || '';
              if (value) {
                void handleScanResultValue(value);
                return;
              }
            }
          } else {
            const canvas = ensureCanvas();
            if (!canvas) throw new Error('Canvas not available');
            const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
            if (!ctx) throw new Error('Canvas context not available');
            const vw = video.videoWidth || 0;
            const vh = video.videoHeight || 0;
            if (vw > 0 && vh > 0) {
              ctx.drawImage(video, 0, 0, vw, vh);
              const imageData = ctx.getImageData(0, 0, vw, vh);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                void handleScanResultValue(code.data);
                return;
              }
            }
          }
        } catch {}
        scanRafRef.current = requestAnimationFrame(() => void tick());
      };

      scanRafRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setIsScanning(false);
      setScanError(isRTL ? 'لم نتمكن من فتح الكاميرا' : 'Could not open camera');
      stopQrScanner();
    }
  }, [handleScanResultValue, isRTL, stopQrScanner]);

  const mapSnapshotToBusinessCardData = useCallback((snapshot: any): BusinessCardData => {
    const s = snapshot || {};
    const socialLinksRaw = s.social_links ?? s.socialLinks ?? [];
    const socialLinks = Array.isArray(socialLinksRaw) ? socialLinksRaw : [];

    return {
      firstName: s.first_name ?? s.firstName ?? '',
      lastName: s.last_name ?? s.lastName ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      companyName: s.company_name ?? s.companyName ?? '',
      jobTitle: s.job_title ?? s.jobTitle ?? '',
      website: s.website ?? '',
      logoUrl: s.logo_url ?? s.logoUrl ?? '',
      profilePhotoUrl: s.profile_photo_url ?? s.profilePhotoUrl ?? '',
      coverPhotoUrl: s.cover_photo_url ?? s.coverPhotoUrl ?? undefined,
      department: s.department ?? undefined,
      headline: s.headline ?? undefined,
      address: s.address ?? undefined,
      socialLinks: socialLinks,
      template: s.template ?? 'geometric',
      primaryColor: s.primary_color ?? s.primaryColor ?? undefined,
      mosaicPaletteId: s.mosaic_palette_id ?? s.mosaicPaletteId ?? undefined,
      mosaicColors: s.mosaic_colors ?? s.mosaicColors ?? undefined,
      professionalColors: s.professional_colors ?? s.professionalColors ?? undefined,
      fashionColors: s.fashion_colors ?? s.fashionColors ?? undefined,
      minimalColors: s.minimal_colors ?? s.minimalColors ?? undefined,
      cleanColors: s.clean_colors ?? s.cleanColors ?? undefined,
      logoPosition: s.logo_position ?? s.logoPosition ?? undefined,
      photoShape: s.photo_shape ?? s.photoShape ?? undefined,
      nameStyle: s.name_style ?? s.nameStyle ?? undefined,
      titleStyle: s.title_style ?? s.titleStyle ?? undefined,
      companyStyle: s.company_style ?? s.companyStyle ?? undefined,
      iconStyle: s.icon_style ?? s.iconStyle ?? undefined,
    };
  }, []);

  // Fetch warranties
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: warData, error: warError } = await (supabase as any)
        .from('user_warranties')
        .select('*')
        .eq('user_id', user.id)
        .order('expiry_date', { ascending: true });

      if (warError) throw warError;
      setWarranties(warData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load warranties',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate time remaining
  const getTimeRemaining = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    
    const expiry = parseISO(expiryDate);
    const today = new Date();
    const daysLeft = differenceInDays(expiry, today);
    const monthsLeft = differenceInMonths(expiry, today);

    if (daysLeft < 0) {
      return { text: t.expired, color: 'bg-red-500', textColor: 'text-red-400', progress: 0 };
    } else if (daysLeft <= 30) {
      return { text: `${daysLeft} ${t.daysLeft}`, color: 'bg-orange-500', textColor: 'text-orange-400', progress: Math.max(5, (daysLeft / 30) * 100) };
    } else {
      return { text: `${monthsLeft} ${t.monthsLeft}`, color: 'bg-green-500', textColor: 'text-green-400', progress: Math.min(100, (monthsLeft / 12) * 100) };
    }
  };

  // Build a rich summary from extracted data when AI doesn't provide one
  const buildRichSummary = (extracted: any): string => {
    const parts: string[] = [];
    const ed = (extracted.extracted_data || {}) as Record<string, unknown>;
    
    // Always start with document type
    parts.push('This is a Document.');
    
    // Add core document details
    if (ed.document_info) {
      const docInfo = ed.document_info as Record<string, unknown>;
      if (docInfo.document_type) parts.push(`Type: ${docInfo.document_type}.`);
      if (docInfo.issuer) parts.push(`Issued by ${docInfo.issuer}.`);
    }
    
    if (extracted.title) parts.push(`📄 ${extracted.title}`);
    if (extracted.provider) parts.push(`🏢 Issued by ${extracted.provider}`);
    const holder = (ed.personal_info as any)?.full_name || ed.holder_name || ed.insured_name || ed.full_name;
    if (holder) parts.push(`👤 For: ${holder}`);
    const vi = ed.vehicle_info as any;
    const vehicle = vi ? [vi.make, vi.model, vi.year].filter(Boolean).join(' ') : null;
    if (vehicle) parts.push(`🚗 Vehicle: ${vehicle}`);
    if (vi?.chassis_number) parts.push(`🔧 Chassis: ${vi.chassis_number}`);
    if (vi?.plate_number) parts.push(`🔢 Plate: ${vi.plate_number}`);
    if (extracted.purchase_date && extracted.expiry_date) {
      parts.push(`📅 Valid: ${extracted.purchase_date} to ${extracted.expiry_date}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : 'Document analyzed and saved.';
  };

  // Optimize image for preview and upload - fixes mobile quality issues
  const optimizeImage = async (file: File, maxWidth: number = 2048, quality: number = 0.92): Promise<{ optimizedFile: File; previewUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if larger than maxWidth while maintaining aspect ratio
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw image with high quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob with quality setting
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              
              // Create optimized file
              const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              // Create preview URL
              const previewUrl = canvas.toDataURL('image/jpeg', quality);
              
              console.log('[optimizeImage] Original size:', file.size, 'Optimized size:', optimizedFile.size, 'Dimensions:', width, 'x', height);
              
              resolve({ optimizedFile, previewUrl });
            },
            'image/jpeg',
            quality
          );
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, isCamera: boolean = false) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    // IMPORTANT: Copy file data BEFORE resetting input
    const fileList = Array.from(files);
    const fileCount = fileList.length;

    // Reset file input to allow re-selecting same file
    event.target.value = '';

    // Show uploading indicator
    setIsAnalyzing(true);
    setViewMode('add');
    
    try {
      const newImages: string[] = [];
      const newPreviewUrls: string[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        let fileToUpload = file;
        let previewUrl = '';
        
        // Only handle image files
        if (file.type.startsWith('image/')) {
          // Optimize images for better quality and smaller size
          try {
            const optimized = await optimizeImage(file);
            fileToUpload = optimized.optimizedFile;
            previewUrl = optimized.previewUrl;
            console.log('[handleFileSelect] Image optimized for upload and preview');
          } catch (error) {
            console.warn('[handleFileSelect] Image optimization failed, using original:', error);
            // Fallback to original file
            previewUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
          }
        } else {
          // For other files, just create preview URL
          previewUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }
        
        newPreviewUrls.push(previewUrl);
        
        // Upload to Supabase for storage and analysis
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${user.id}/${Date.now()}_${i}_${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from('warranty-docs')
          .upload(fileName, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('warranty-docs')
          .getPublicUrl(fileName);
        
        newImages.push(urlData.publicUrl);
      }

      console.log('[handleFileSelect] Uploaded images URLs:', newImages);
      console.log('[handleFileSelect] Preview URLs created:', newPreviewUrls.length);
      
      // Update preview URLs state
      setPreviewUrls(prev => {
        let primaryPreview = prev.primary;
        const updatedPreviews = [...prev.additional];

        if (!primaryPreview) {
          primaryPreview = newPreviewUrls[0];
          updatedPreviews.push(...newPreviewUrls.slice(1));
        } else {
          updatedPreviews.push(...newPreviewUrls);
        }

        console.log('[handleFileSelect] Setting preview URLs:', {
          primaryPreview: primaryPreview?.substring(0, 50) + '...',
          additionalCount: updatedPreviews.length
        });

        return {
          primary: primaryPreview,
          additional: updatedPreviews
        };
      });

      // Update Supabase URLs state
      setNewItem(prev => {
        const updatedImages = [...prev.additional_images];
        let primaryImage = prev.image_url;

        // Handle first image vs additional images
        if (!primaryImage) {
          primaryImage = newImages[0];
          updatedImages.push(...newImages.slice(1));
        } else {
          updatedImages.push(...newImages);
        }

        console.log('[handleFileSelect] Setting state:', { 
          primaryImage, 
          updatedImages, 
          primaryImageLength: primaryImage?.length,
          updatedImagesCount: updatedImages.length 
        });

        const newState = {
          ...prev,
          image_url: primaryImage,
          receipt_url: primaryImage,
          additional_images: updatedImages,
          file_type: 'image' as '' | 'image' | 'pdf'
        };

        console.log('[handleFileSelect] New state created:', {
          image_url: newState.image_url,
          additional_images_count: newState.additional_images.length,
          file_type: newState.file_type
        });

        return newState;
      });

      // Show success toast with guidance
      toast({
        title: isRTL ? 'تم رفع الصور' : 'Photos Uploaded',
        description: isRTL 
          ? `تم رفع ${fileCount} صورة بنجاح. يمكنك إضافة المزيد من الصور أو الضغط على "تحليل" للمتابعة.` 
          : `${fileCount} photo${fileCount > 1 ? 's' : ''} uploaded successfully. You can add more photos or click "Analyze" to continue.`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل رفع الصور' : 'Failed to upload photos',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Handle manual analyze (Send button)
  const handleAnalyzeDocument = async () => {
    // Check if we have any images to analyze
    if (!user || (!newItem.image_url && newItem.additional_images.length === 0)) {
      console.error('[handleAnalyzeDocument] No images to analyze:', { image_url: newItem.image_url, additional: newItem.additional_images });
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'لا توجد صور للتحليل' : 'No images to analyze',
        variant: 'destructive',
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Use previewUrls (base64 data URLs) if available - more reliable on mobile
      // Fall back to fetching from Supabase URLs if previewUrls not available
      const base64Images: string[] = [];
      
      // Check if we have preview URLs (base64 data URLs from file upload)
      const allPreviewUrls = [previewUrls.primary, ...previewUrls.additional].filter(url => url && url.trim() !== '');
      
      if (allPreviewUrls.length > 0) {
        console.log('[handleAnalyzeDocument] Using preview URLs (base64):', allPreviewUrls.length);
        
        for (const dataUrl of allPreviewUrls) {
          // Extract base64 from data URL (format: data:image/jpeg;base64,/9j/...)
          if (dataUrl.includes(',')) {
            const base64Part = dataUrl.split(',')[1];
            if (base64Part && base64Part.length > 0) {
              console.log('[handleAnalyzeDocument] Extracted base64 length:', base64Part.length);
              base64Images.push(base64Part);
            }
          }
        }
      } else {
        // Fallback: Fetch from Supabase URLs
        const allImageUrls = [newItem.image_url, ...newItem.additional_images].filter(url => url && url.trim() !== '');
        
        console.log('[handleAnalyzeDocument] Fetching from Supabase URLs:', allImageUrls.length);
        
        if (allImageUrls.length === 0) {
          throw new Error('No valid image URLs found');
        }
        
        for (const url of allImageUrls) {
          console.log('[handleAnalyzeDocument] Fetching:', url);
          const response = await fetch(url);
          if (!response.ok) {
            console.error('[handleAnalyzeDocument] Fetch failed:', response.status, response.statusText);
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          const blob = await response.blob();
          console.log('[handleAnalyzeDocument] Blob size:', blob.size, 'type:', blob.type);
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log('[handleAnalyzeDocument] Base64 length:', base64.length);
          base64Images.push(base64);
        }
      }
      
      if (base64Images.length === 0) {
        throw new Error('No valid images to analyze');
      }
      
      console.log('[handleAnalyzeDocument] Total images to analyze:', base64Images.length);

      const { data: aiData, error: aiError } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'extract',
          images: base64Images,
          mimeType: newItem.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg',
          language: isRTL ? 'ar' : 'en',
        },
      });

      if (aiError) throw aiError;
      
      if (aiData?.success && aiData?.data) {
        const extracted = aiData.data;
        
        // Merge existing and new extracted data
        const existingData = newItem.extracted_data || {};
        const newData = extracted.extracted_data || {};
        
        // Simple merge - just spread objects together
        const fullExtractedData: Record<string, unknown> = {
          ...existingData,
          ...newData,
          notes: [existingData.notes, extracted.notes || ''].filter(Boolean).join('\n\n'),
          all_text: [existingData.all_text, extracted.notes || ''].filter(Boolean).join('\n\n')
        };
        
        // Build comprehensive summary
        const richSummary = extracted.ai_summary || buildRichSummary({ ...extracted, extracted_data: fullExtractedData });

        // Update state with new data
        const updatedItem = {
          ...newItem,
          title: extracted.title || newItem.title,
          provider: extracted.provider || newItem.provider,
          category: extracted.category || newItem.category,
          purchase_date: extracted.purchase_date || newItem.purchase_date,
          expiry_date: extracted.expiry_date || newItem.expiry_date,
          ref_number: extracted.ref_number || newItem.ref_number,
          support_contact: extracted.support_contact || newItem.support_contact,
          extracted_data: fullExtractedData,
          ai_summary: richSummary,
        };

        // Auto-save after successful analysis
        await handleSave(updatedItem);

        // Update UI state
        setNewItem(prev => ({
          ...prev,
          title: extracted.title || prev.title,
          provider: extracted.provider || prev.provider,
          category: extracted.category || prev.category,
          purchase_date: extracted.purchase_date || prev.purchase_date,
          expiry_date: extracted.expiry_date || prev.expiry_date,
          ref_number: extracted.ref_number || prev.ref_number,
          support_contact: extracted.support_contact || prev.support_contact,
          extracted_data: fullExtractedData,
          ai_summary: richSummary,
        }));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل تحليل المستند' : 'Failed to analyze document',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Save
  const handleSave = async (itemToSave = newItem) => {
    if (!user || !itemToSave.title) return;

    try {
      // Start loading
      setIsLoading(true);
      // Set view mode to list immediately to prevent double-save
      setViewMode('list');
      const parsedTags = newTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const extractedWithTags: Record<string, unknown> = {
        ...(itemToSave.extracted_data || {}),
        user_tags: parsedTags,
        additional_images: itemToSave.additional_images,
      };

      // Save with returning ID to get the new warranty ID for preview caching
      const { data: newWarrantyData, error } = await (supabase as any)
        .from('user_warranties')
        .insert({
          user_id: user.id,
          product_name: itemToSave.title,
          purchase_date: itemToSave.purchase_date || null,
          expiry_date: itemToSave.expiry_date || null,
          warranty_months: itemToSave.warranty_period ? parseInt(itemToSave.warranty_period) : null,
          notes: itemToSave.ai_summary || null,
          provider: itemToSave.provider || null,
          ref_number: itemToSave.ref_number || null,
          support_contact: itemToSave.support_contact || null,
          image_url: itemToSave.image_url || null,
          receipt_url: itemToSave.receipt_url || null,
          file_type: itemToSave.file_type || null,
          extracted_data: extractedWithTags,
          ai_summary: itemToSave.ai_summary || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Cache the preview URL in localStorage with the actual warranty ID
      if (newWarrantyData?.id && previewUrls.primary) {
        try {
          const cacheKey = `warranty_preview_${newWarrantyData.id}`;
          localStorage.setItem(cacheKey, previewUrls.primary);
          console.log('[handleSave] Cached preview image with key:', cacheKey);
        } catch (e) {
          console.warn('[handleSave] Failed to cache preview:', e);
        }
      }

      if (newWarrantyData?.id && itemToSave.expiry_date) {
        await scheduleDocExpiryPush({
          userId: user.id,
          docId: newWarrantyData.id,
          docTitle: itemToSave.title,
          expiryDateIso: itemToSave.expiry_date,
        });
      }

      toast({
        title: isRTL ? 'نجاح' : 'Success',
        description: isRTL ? 'تم حفظ المستند بنجاح' : 'Document saved successfully',
      });

      setNewItem({
        title: '',
        provider: '',
        category: '',
        purchase_date: '',
        warranty_period: '',
        expiry_date: '',
        ref_number: '',
        support_contact: '',
        image_url: '',
        receipt_url: '',
        additional_images: [],
        file_type: '',
        extracted_data: {},
        ai_summary: '',
      });
      setNewTagsInput('');
      setViewMode('list');
      fetchData();
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل حفظ المستند' : 'Failed to save document',
        variant: 'destructive',
      });
    }
  };

  // Delete warranty
  const handleDelete = async (id: string) => {
    try {
      if (user) {
        const existing = await findExistingDocExpiryNotification(user.id, id);
        if (existing?.id && existing.onesignalId) {
          await cancelDocExpiryNotification({
            userId: user.id,
            notificationId: existing.id,
            onesignalId: existing.onesignalId,
          });
        }
      }

      const { error } = await (supabase as any)
        .from('user_warranties')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Warranty deleted successfully',
      });

      setSelectedItem(null);
      setViewMode('list');
      fetchData();
    } catch (error) {
      console.error('Error deleting warranty:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete warranty',
        variant: 'destructive',
      });
    }
  };

  const getDocLabel = (doc: WarrantyItem) =>
    doc.product_name || doc.provider || doc.ref_number || (isRTL ? 'مستند' : 'Document');

  const getDocSortValue = (doc: WarrantyItem) => {
    const dateValue = doc.expiry_date || doc.purchase_date;
    if (!dateValue) return 0;
    return parseISO(dateValue).getTime();
  };

  // Get user tags from extracted_data
  const getUserTags = (item: WarrantyItem): string[] => {
    const ed = item.extracted_data || {};
    const tags = (ed as any).user_tags;
    if (Array.isArray(tags)) return tags;
    return [];
  };

  // Build tag index for filtering
  const tagIndex = useMemo(() => {
    const index: Record<string, { count: number; thumbUrl?: string }> = {};
    warranties.forEach((w) => {
      const tags = getUserTags(w);
      tags.forEach((tag) => {
        if (!index[tag]) {
          index[tag] = { count: 0, thumbUrl: w.receipt_url || w.image_url || undefined };
        }
        index[tag].count++;
      });
    });
    return index;
  }, [warranties]);

  // Filter warranties by status and tag
  const filteredWarrantiesByTag = useMemo(() => {
    let filtered = warranties;
    
    // Filter by status
    if (statusFilter === 'expiring') {
      filtered = filtered.filter((w) => w.status === 'expiring_soon');
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter((w) => w.status === 'expired');
    }
    
    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter((w) => getUserTags(w).includes(selectedTag));
    }
    
    return filtered;
  }, [warranties, statusFilter, selectedTag]);

  // Smart pick IDs for auto scope
  const smartPickIds = useMemo(() => new Set<string>(), []);

  // Check if all files are selected
  const isAllFilesSelected = useMemo(() => {
    return selectedDocIds.length === warranties.length && warranties.length > 0;
  }, [selectedDocIds, warranties]);

  // Handle auto scope selection
  const handleSelectAuto = () => {
    setDocScopeMode('auto');
    setSelectedDocIds([]);
  };

  // Handle select all files
  const handleSelectAllFiles = () => {
    setDocScopeMode('manual');
    setSelectedDocIds(warranties.map((w) => w.id));
  };

  // Handle toggle doc selection
  const handleToggleDoc = (docId: string) => {
    setDocScopeMode('manual');
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Get suggested docs based on question
  const getSuggestedDocs = useCallback((question: string): string[] => {
    const q = question.toLowerCase();
    const matches: string[] = [];
    
    warranties.forEach((w) => {
      const name = (w.product_name || '').toLowerCase();
      const provider = (w.provider || '').toLowerCase();
      const summary = (w.ai_summary || '').toLowerCase();
      
      if (name.includes(q) || provider.includes(q) || summary.includes(q) || q.includes(name) || q.includes(provider)) {
        matches.push(w.id);
      }
    });
    
    return matches.length > 0 ? matches : warranties.slice(0, 3).map((w) => w.id);
  }, [warranties]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [askMessages]);

  // Handle document selection from clarification
  const handleDocumentSelect = async (docId: string, originalQuestion: string) => {
    setIsAsking(true);
    
    try {
      const selectedDoc = warranties.find(w => w.id === docId);
      if (!selectedDoc) throw new Error('Document not found');
      
      const ed = selectedDoc.extracted_data || {};
      const context = `Document: ${selectedDoc.product_name}\nProvider: ${selectedDoc.provider || 'N/A'}\nExpiry: ${selectedDoc.expiry_date || 'N/A'}\nSummary: ${selectedDoc.ai_summary || 'N/A'}\nData: ${JSON.stringify(ed)}`;
      
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      
      const { data, error } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'qa',
          question: originalQuestion,
          context,
          userName,
          documents: [{
            id: selectedDoc.id,
            product_name: selectedDoc.product_name,
            provider: selectedDoc.provider,
            category: selectedDoc.category,
            expiry_date: selectedDoc.expiry_date,
            ref_number: selectedDoc.ref_number,
          }],
        },
      });
      
      if (error) throw error;
      
      const answer = data?.answer || (isRTL ? 'عذراً، لم أتمكن من الإجابة.' : 'Sorry, I could not answer that.');
      setAskMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      console.error('Ask error:', error);
      setAskMessages((prev) => [...prev, { role: 'assistant', content: isRTL ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.' }]);
    } finally {
      setIsAsking(false);
    }
  };

  // Handle Ask Wakti
  const handleAskWakti = async () => {
    if (!askQuestion.trim() || warranties.length === 0) return;
    
    setIsAsking(true);
    const userMessage = askQuestion.trim();
    setAskMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setAskQuestion('');
    
    try {
      // Determine which docs to use
      let docsToUse: WarrantyItem[] = [];
      
      if (docScopeMode === 'auto') {
        const suggestedIds = getSuggestedDocs(userMessage);
        docsToUse = warranties.filter((w) => suggestedIds.includes(w.id));
      } else {
        docsToUse = selectedDocIds.length > 0
          ? warranties.filter((w) => selectedDocIds.includes(w.id))
          : warranties;
      }
      
      // Build context from selected docs
      const context = docsToUse.map((doc) => {
        const ed = doc.extracted_data || {};
        return `Document: ${doc.product_name}\nProvider: ${doc.provider || 'N/A'}\nExpiry: ${doc.expiry_date || 'N/A'}\nSummary: ${doc.ai_summary || 'N/A'}\nData: ${JSON.stringify(ed)}`;
      }).join('\n\n---\n\n');
      
      // Get user name from profile if available
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      
      // Prepare documents array for clarification detection
      const documentsArray = docsToUse.map(doc => ({
        id: doc.id,
        product_name: doc.product_name,
        provider: doc.provider,
        category: doc.category,
        expiry_date: doc.expiry_date,
        ref_number: doc.ref_number,
      }));
      
      const { data, error } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'qa',
          question: userMessage,
          context,
          userName,
          documents: documentsArray,
        },
      });
      
      if (error) throw error;
      
      const answer = data?.answer || data?.response || (isRTL ? 'عذراً، لم أتمكن من الإجابة.' : 'Sorry, I could not answer that.');
      
      // Check if response needs clarification
      if (data?.needsClarification && data?.options) {
        setAskMessages((prev) => [...prev, { 
          role: 'assistant', 
          content: answer,
          needsClarification: true,
          clarificationType: data.clarificationType,
          options: data.options,
        }]);
      } else {
        setAskMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      }
    } catch (error) {
      console.error('Ask error:', error);
      setAskMessages((prev) => [...prev, { role: 'assistant', content: isRTL ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.' }]);
    } finally {
      setIsAsking(false);
    }
  };

  // Render warranty card
  const renderWarrantyCard = (item: WarrantyItem) => {
    const timeRemaining = getTimeRemaining(item.expiry_date);
    const tags = getUserTags(item);
    const rawUrl = (item.receipt_url || item.image_url || '').trim();
    const isPdf = item.file_type === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf');

    return (
      <div 
        key={item.id} 
        className="mb-4 rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Card Content */}
        <div className="p-4 flex gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            {rawUrl && !isPdf ? (
              <img 
                src={rawUrl} 
                alt={item.product_name} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : isPdf ? (
              <div className="w-full h-full flex items-center justify-center bg-red-500/10">
                <FileText className="w-6 h-6 text-red-400" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 pr-2">
              {item.product_name}
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              {item.status === 'expired' ? t.expiredOn : t.willExpireOn}: {item.expiry_date ? format(parseISO(item.expiry_date), 'MM/dd/yy') : '-'}
            </p>
            
            {/* Progress Bar */}
            {timeRemaining && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${timeRemaining.textColor}`}>
                    {timeRemaining.text}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${timeRemaining.color} rounded-full`}
                    style={{ width: `${timeRemaining.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar - Bottom of card, clean separation */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            onClick={() => {
              setSelectedItem(item);
              setViewMode('detail');
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {isRTL ? 'فتح' : 'Open'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {isRTL ? 'حذف' : 'Delete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background border border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>{isRTL ? 'حذف المستند' : 'Delete Document'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {isRTL ? 'هل أنت متأكد من حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this document? This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 text-white"
                  onClick={async () => {
                    await handleDelete(item.id);
                  }}
                >
                  {isRTL ? 'حذف' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  // Render List View
  const renderWarrantiesTab = () => (
    <div className="flex flex-col h-full w-full overflow-x-hidden">
      <div className="px-4 pt-6 pb-3 w-full overflow-x-hidden">
        {/* Filter Row - Luxurious pill buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Button */}
          {viewMode !== 'add' && viewMode !== 'detail' && viewMode !== 'ask' && mainTab === 'docs' && activeTab === 'warranties' && warranties.length > 0 && (
            <Button
              onClick={() => {
                if (isGuest) {
                  setGuestDialogOpen(true);
                  return;
                }
                setViewMode('add');
              }}
              size="sm"
              className="h-9 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium shadow-md"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-muted/50">
            <button
              onClick={() => setStatusFilter('all')}
              className={`h-8 px-4 rounded-full text-sm font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {isRTL ? 'الكل' : 'All'}
            </button>

            <button
              onClick={() => setStatusFilter('expiring')}
              className={`h-8 px-3 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'expiring'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{isRTL ? 'قريباً' : 'Expiring'}</span>
            </button>

            <button
              onClick={() => setStatusFilter('expired')}
              className={`h-8 px-3 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'expired'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isRTL ? 'منتهية' : 'Expired'}</span>
            </button>
          </div>
        </div>

        {Object.keys(tagIndex).length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <Button
              type="button"
              variant={selectedTag === null ? 'default' : 'outline'}
              className="rounded-full h-9 whitespace-nowrap"
              onClick={() => setSelectedTag(null)}
            >
              {t.filterAll}
            </Button>
            {Object.entries(tagIndex)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([tag, meta]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={
                    `h-9 inline-flex items-center gap-2 rounded-full px-3 border transition ` +
                    (selectedTag === tag
                      ? 'bg-white/10 border-white/20 text-foreground'
                      : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')
                  }
                >
                  <span className="relative w-5 h-5 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                    {meta.thumbUrl ? (
                      <img src={meta.thumbUrl} alt={tag} className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-3.5 h-3.5 m-auto opacity-80" />
                    )}
                  </span>
                  <span className="text-sm whitespace-nowrap">{tag}</span>
                  <span className="text-xs opacity-70">{meta.count}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : warranties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">{t.noItems}</h3>
            <p className="text-muted-foreground text-sm">{t.addFirst}</p>
            <button
              type="button"
              onClick={() => {
                if (isGuest) {
                  setGuestDialogOpen(true);
                  return;
                }
                setViewMode('add');
              }}
              className="
                mt-6 w-16 h-16 rounded-full
                bg-gradient-to-br from-emerald-500 to-blue-500
                hover:from-emerald-400 hover:to-blue-400
                active:from-emerald-600 active:to-blue-600
                flex items-center justify-center
                shadow-[0_8px_32px_-8px_rgba(16,185,129,0.5)]
                hover:shadow-[0_12px_40px_-8px_rgba(16,185,129,0.6)]
                active:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.4)]
                transition-all duration-300 active:scale-95
                border border-emerald-400/30
              "
              aria-label={t.addNew}
            >
              <Plus className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
            </button>
          </div>
        ) : filteredWarrantiesByTag.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="w-14 h-14 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-sm">{t.noItems}</p>
          </div>
        ) : (
          <>
            {filteredWarrantiesByTag.map(renderWarrantyCard)}
          </>
        )}
      </div>
    </div>
  );

  const renderAskTab = () => {
    return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background via-background to-blue-500/5">
      {/* Minimal Scope Chips Row */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-muted/20">
          <p className="text-[10px] text-muted-foreground/70 mr-1">{t.scopeInstruction}</p>
          {/* Auto Chip */}
          <button
            type="button"
            onClick={handleSelectAuto}
            className={
              `px-3 py-1.5 rounded-full text-xs font-semibold border transition ` +
              (docScopeMode === 'auto'
                ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 border-blue-400/60 text-foreground shadow-[0_4px_12px_rgba(59,130,246,0.2)]'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')
            }
          >
            ✨ {t.scopeAuto}
          </button>

          {/* All Files Chip with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsScopeOpen(!isScopeOpen)}
              className={
                `px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 ` +
                (docScopeMode === 'manual'
                  ? isAllFilesSelected
                    ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border-emerald-400/60 text-foreground shadow-[0_4px_12px_rgba(16,185,129,0.2)]'
                    : 'bg-gradient-to-r from-blue-500/25 to-indigo-500/25 border-blue-400/60 text-foreground'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')
              }
            >
              📚 {docScopeMode === 'manual' && !isAllFilesSelected ? `${selectedDocIds.length} ${t.items}` : t.scopeAll}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isScopeOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown with file chips */}
            {isScopeOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 min-w-[280px] max-w-[90vw] rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/30 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">{t.scopeHint}</p>
                  <button
                    type="button"
                    onClick={handleSelectAllFiles}
                    className={
                      `px-2 py-1 rounded-full text-[10px] font-semibold border transition ` +
                      (isAllFilesSelected
                        ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border-emerald-400/60 text-foreground'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')
                    }
                  >
                    {isAllFilesSelected ? '✓ ' : ''}{t.scopeAll}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {warranties.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    const isSmartPick = docScopeMode === 'auto' && smartPickIds.has(doc.id);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleToggleDoc(doc.id)}
                        className={
                          `px-2.5 py-1 rounded-full text-xs border transition truncate max-w-[200px] ` +
                          (isSelected
                            ? 'bg-gradient-to-r from-blue-500/25 to-indigo-500/25 border-blue-400/60 text-foreground'
                            : isSmartPick
                              ? 'bg-white/10 border-blue-500/30 text-foreground'
                              : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')
                        }
                      >
                        {isSmartPick && docScopeMode === 'auto' ? '⭐ ' : ''}{isSelected ? '✓ ' : ''}{getDocLabel(doc)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Document Indicator */}
      {selectedDocIds.length === 1 && docScopeMode === 'manual' && (
        <div className="px-4 pt-3">
          {warranties
            .filter(doc => doc.id === selectedDocIds[0])
            .map(doc => {
              // Selected document card
              const hasImage = doc.image_url || doc.receipt_url;
              return (
                <div key={doc.id} className="p-3 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-purple-500/10 mb-3">
                  <div className="flex items-center gap-3">
                    {/* Document thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 border border-white/20">
                      {hasImage ? (
                        <img 
                          src={doc.image_url || doc.receipt_url} 
                          alt={doc.product_name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If image fails to load, show document icon
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="w-6 h-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>';
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-blue-500/10">
                          <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                      )}
                    </div>
                    {/* Document details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {doc.product_name || (isRTL ? 'بدون عنوان' : 'Untitled')}
                      </h3>
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>{isRTL ? 'تسأل عن هذا المستند' : 'Asking about this document'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {askMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            {/* Empty state with beautiful design */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-6">
              <MessageCircle className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.askEmptyHint}</h3>
            <div className="space-y-2 mt-4 w-full max-w-sm">
              {[t.askExample1, t.askExample2, t.askExample3].map((example, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  onClick={() => setAskQuestion(example)} // Set the question to the example
                  className="
                    group flex items-center gap-2 h-10 px-4 rounded-full w-full
                    bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent
                    hover:from-blue-500/20 hover:via-purple-500/10 hover:to-transparent
                    border border-white/20 hover:border-white/30
                    transition-all duration-300 active:scale-95
                    shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]
                    hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.2)]
                    dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]
                    dark:hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7)]
                  "
                >
                  <div className="
                    w-8 h-8 shrink-0 rounded-full 
                    bg-gradient-to-br from-blue-500 to-purple-500
                    flex items-center justify-center
                    shadow-[0_2px_8px_-2px_rgba(59,130,246,0.5)]
                    group-hover:shadow-[0_4px_12px_-2px_rgba(59,130,246,0.7)]
                    transition-all duration-300
                  ">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-foreground ml-2 truncate text-left">{example}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {askMessages.map((message, index) => (
              <div key={`${message.role}-${index}`}>
                {message.role === 'user' ? (
                  <div className="flex justify-end mb-1">
                    <div className="bg-blue-500/20 text-foreground px-4 py-2 rounded-xl max-w-[85%]">
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/10 dark:bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Wakti AI</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                    {message.needsClarification && message.options && (
                      <div className="mt-4 space-y-2">
                        {message.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              const lastUserMessage = askMessages.filter(m => m.role === 'user').pop();
                              if (lastUserMessage) {
                                handleDocumentSelect(option.id, lastUserMessage.content);
                              }
                            }}
                            className="w-full text-left p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                          >
                            <div className="font-medium text-sm text-foreground">{option.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">{option.subtitle}</div>
                            {option.expiry && (
                              <div className="text-xs text-blue-400 mt-1">
                                {isRTL ? 'ينتهي في' : 'Expires'}: {option.expiry}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isAsking && (
              <div className="bg-white/10 dark:bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                    <Shield className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Wakti AI</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">{isRTL ? 'جاري البحث في مستنداتك...' : 'Searching your documents...'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Premium Input Area */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="relative rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-border shadow-lg shadow-black/10 overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 pointer-events-none" />
          
          <div className="relative flex items-end gap-2 p-3">
            <Textarea
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              placeholder={t.askQuestion}
              className="flex-1 min-h-[44px] max-h-[120px] bg-transparent border border-border rounded-lg resize-none text-foreground placeholder:text-muted-foreground/60 focus:ring-0 focus:outline-none focus:border-blue-500 text-sm py-2 px-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskWakti();
                }
              }}
            />
            <Button
              className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95 shrink-0"
              onClick={handleAskWakti}
              disabled={isAsking || !askQuestion.trim() || warranties.length === 0}
            >
              {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  // Handle business card wizard completion
  const handleCardWizardComplete = async (data: BusinessCardData) => {
    if (!user) return;
    
    try {
      const { data: saved, error } = await (supabase as any)
        .from('user_business_cards')
        .upsert({
          user_id: user.id,
          card_slot: activeCardSlot,
          card_name: activeCardSlot === 1 ? 'Primary Card' : 'Secondary Card',
          first_name: data.firstName,
          last_name: data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,
          company_name: data.companyName || null,
          job_title: data.jobTitle || null,
          website: data.website || null,
          logo_url: data.logoUrl || null,
          profile_photo_url: data.profilePhotoUrl || null,
        }, { onConflict: 'user_id,card_slot' })
        .select('share_slug, card_slot, card_name')
        .maybeSingle();

      if (error) throw error;

      // Add to business cards array with slot info
      const newCard = {
        ...data,
        cardSlot: activeCardSlot,
        cardName: activeCardSlot === 1 ? 'Primary Card' : 'Secondary Card',
        shareSlug: (saved as any)?.share_slug || undefined,
      };
      setBusinessCards(prev => {
        const filtered = prev.filter(c => c.cardSlot !== activeCardSlot);
        return [...filtered, newCard];
      });
      setShowCardWizard(false);
      setShowCelebration(true); // Show celebration popup first
    } catch (error) {
      console.error('Error saving business card:', error);
      toast({
        title: 'Error',
        description: 'Failed to save business card',
        variant: 'destructive',
      });
    }
  };

  // Fetch existing business cards (supports up to 2)
  const fetchBusinessCard = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingCard(true);
    try {
      // Fetch all cards for this user (up to 2)
      const { data, error } = await (supabase as any)
        .from('user_business_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('card_slot', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const cards = data.map((row: any, index: number) => ({
          firstName: row.first_name,
          lastName: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          companyName: row.company_name || '',
          jobTitle: row.job_title || '',
          website: row.website || '',
          logoUrl: row.logo_url || '',
          profilePhotoUrl: row.profile_photo_url || '',
          coverPhotoUrl: row.cover_photo_url || '',
          department: row.department || '',
          headline: row.headline || '',
          address: row.address || '',
          socialLinks: row.social_links || [],
          template: row.template || 'geometric',
          primaryColor: row.primary_color || '#6366f1',
          mosaicPaletteId: row.mosaic_palette_id || 'rose',
          mosaicColors: row.mosaic_colors || undefined,
          professionalColors: row.professional_colors || undefined,
          fashionColors: row.fashion_colors || undefined,
          minimalColors: row.minimal_colors || undefined,
          cleanColors: row.clean_colors || undefined,
          logoPosition: row.logo_position || 'top-right',
          photoShape: row.photo_shape || 'circle',
          nameStyle: row.name_style || undefined,
          titleStyle: row.title_style || undefined,
          companyStyle: row.company_style || undefined,
          iconStyle: row.icon_style || undefined,
          cardSlot: row.card_slot || (index + 1),
          cardName: row.card_name || (index === 0 ? 'Primary Card' : 'Secondary Card'),
          shareSlug: row.share_slug || undefined,
          viewCount: row.view_count || 0,
        }));
        setBusinessCards(cards as any);
        // Set active slot to first card's slot
        if (cards.length > 0) {
          setActiveCardSlot(cards[0].cardSlot);
        }
      }
    } catch (error) {
      console.error('Error fetching business card:', error);
    } finally {
      setIsLoadingCard(false);
    }
  }, [user]);

  // Fetch business card on mount
  useEffect(() => {
    fetchBusinessCard();
  }, [fetchBusinessCard]);

  useEffect(() => {
    fetchCollectedCards();
  }, [fetchCollectedCards]);

  // Fetch how many times each card has been saved by others
  useEffect(() => {
    const fetchCardSaves = async () => {
      if (!user || businessCards.length === 0) return;
      
      try {
        // Get saves count for each card individually
        const savesMap: Record<string, number> = {};
        
        for (const card of businessCards) {
          if (!card.shareSlug) continue;
          
          const { count, error } = await supabase
            .from('collected_business_cards')
            .select('*', { count: 'exact', head: true })
            .eq('share_slug', card.shareSlug);

          if (!error && count !== null) {
            savesMap[card.shareSlug] = count;
          }
        }
        
        setCardSavesBySlot(savesMap);
      } catch (err) {
        console.error('Error fetching card saves:', err);
      }
    };

    fetchCardSaves();
  }, [user, businessCards]);

  useEffect(() => {
    if (!isScanOpen) {
      stopQrScanner();
      setScanError(null);
      setManualScanValue('');
    }
  }, [isScanOpen, stopQrScanner]);

  useEffect(() => {
    if (isScanOpen) {
      void startQrScanner();
    }
  }, [isScanOpen, startQrScanner]);

  // Handle builder save
  const handleBuilderSave = async (data: BusinessCardData) => {
    if (!user) return;
    
    try {
      const { error } = await (supabase as any)
        .from('user_business_cards')
        .update({
          first_name: data.firstName,
          last_name: data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,
          company_name: data.companyName || null,
          job_title: data.jobTitle || null,
          website: data.website || null,
          logo_url: data.logoUrl || null,
          profile_photo_url: data.profilePhotoUrl || null,
          cover_photo_url: (data as any).coverPhotoUrl || null,
          department: (data as any).department || null,
          headline: (data as any).headline || null,
          address: (data as any).address || null,
          template: (data as any).template || 'geometric',
          social_links: (data as any).socialLinks || [],
          primary_color: (data as any).primaryColor || '#6366f1',
          mosaic_palette_id: (data as any).mosaicPaletteId || 'rose',
          mosaic_colors: (data as any).mosaicColors || null,
          professional_colors: (data as any).professionalColors || null,
          fashion_colors: (data as any).fashionColors || null,
          minimal_colors: (data as any).minimalColors || null,
          clean_colors: (data as any).cleanColors || null,
          logo_position: (data as any).logoPosition || 'top-right',
          photo_shape: (data as any).photoShape || 'circle',
          name_style: (data as any).nameStyle || null,
          title_style: (data as any).titleStyle || null,
          company_style: (data as any).companyStyle || null,
          icon_style: (data as any).iconStyle || null,
          card_slot: activeCardSlot,
          card_name: activeCardSlot === 1 ? 'Primary Card' : 'Secondary Card',
        })
        .eq('user_id', user.id)
        .eq('card_slot', activeCardSlot);

      if (error) throw error;
      // Update the card in the businessCards array
      const existingShareSlug = businessCards.find(c => c.cardSlot === activeCardSlot)?.shareSlug;
      const updatedCard = {
        ...data,
        cardSlot: activeCardSlot,
        cardName: activeCardSlot === 1 ? 'Primary Card' : 'Secondary Card',
        shareSlug: existingShareSlug,
      };
      setBusinessCards(prev => {
        const filtered = prev.filter(c => c.cardSlot !== activeCardSlot);
        return [...filtered, updatedCard as any];
      });
    } catch (error) {
      console.error('Error updating business card:', error);
      throw error;
    }
  };

  // Render My Card inner content (user's own card)
  const renderMyCardContent = () => {
    // Loading state
    if (isLoadingCard) {
      return (
        <div className="flex flex-col h-full items-center justify-center px-4 py-20">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      );
    }

    const cardLimitReached = businessCards.length >= 2;
    const hasCards = businessCards.length > 0;

    // Calculate total views across all cards
    const totalViews = businessCards.reduce((sum, card) => sum + (card.viewCount || 0), 0);

    return (
      <div className="flex flex-col px-4 py-4 pb-24">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {isRTL ? 'بطاقاتي الرقمية' : 'My Digital Cards'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isRTL 
                ? `${businessCards.length} من 2 بطاقات`
                : `${businessCards.length} of 2 cards`}
            </p>
          </div>
        </div>

        {/* Cards Grid - Mobile First */}
        {hasCards && (
          <div className="space-y-4 mb-6">
            {businessCards.map((card, index) => (
              <div
                key={card.cardSlot}
                className={`relative rounded-2xl overflow-hidden border transition-all ${
                  activeCardSlot === card.cardSlot
                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Card Header with Analytics Button */}
                <div className="flex items-center justify-between p-3 bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      index === 0 
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                        : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    }`}>
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  
                  {/* Per-Card Analytics Button */}
                  <button
                    type="button"
                    aria-label={isRTL ? 'إحصائيات البطاقة' : 'Card analytics'}
                    title={isRTL ? 'إحصائيات البطاقة' : 'Card analytics'}
                    onClick={() => setShowAnalyticsBySlot(prev => ({
                      ...prev,
                      [card.cardSlot]: !prev[card.cardSlot]
                    }))}
                    className="h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-purple-500/15 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/15 text-foreground border border-white/10 shadow-sm transition-all active:scale-95"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAnalyticsBySlot[card.cardSlot] ? 'rotate-180' : ''}`} />
                    {isRTL ? 'إحصائيات' : 'Stats'}
                  </button>
                </div>

                {/* Per-Card Analytics Panel */}
                {showAnalyticsBySlot[card.cardSlot] && (
                  <div className="px-3 pb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 border border-white/10">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xl font-bold text-blue-500">{card.viewCount || 0}</p>
                          <p className="text-[10px] text-muted-foreground">{isRTL ? 'مشاهدات' : 'Views'}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-xl font-bold text-emerald-500">{card.shareSlug ? (cardSavesBySlot[card.shareSlug] || 0) : 0}</p>
                          <p className="text-[10px] text-muted-foreground">{isRTL ? 'حفظ' : 'Saves'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setActiveCardSlot(card.cardSlot)}
                >
                  <ScaledCardPreview
                    data={card}
                    isFlipped={!!myCardFlippedBySlot[card.cardSlot]}
                    handleFlip={() =>
                      setMyCardFlippedBySlot((prev) => ({
                        ...prev,
                        [card.cardSlot]: !prev[card.cardSlot],
                      }))
                    }
                  />
                </div>

                {/* Card Actions */}
                <div className="flex gap-2 p-3 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCardSlot(card.cardSlot);
                      setShowCardBuilder(true);
                    }}
                    className="flex-1 h-9 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                  </Button>
                  <div className="flex items-center justify-center w-12">
                    <div onClick={(e) => e.stopPropagation()}>
                      <ShareButton
                        size="sm"
                        shareUrl={`${getPublicBaseUrl()}/card/${card.shareSlug || ''}`}
                        shareTitle={isRTL ? 'بطاقتي من Wakti' : 'My Wakti Business Card'}
                        shareDescription={isRTL ? 'افتح بطاقتي الرقمية' : 'Open my digital card'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create New Card Button */}
        <div className="mt-auto pb-4">
          <Button
            onClick={() => {
              if (!cardLimitReached) {
                setActiveCardSlot(businessCards.length + 1);
                setShowCardWizard(true);
              }
            }}
            disabled={cardLimitReached}
            className={`w-full h-14 text-base font-semibold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              cardLimitReached
                ? 'bg-gray-500/20 text-muted-foreground cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25'
            }`}
          >
            {cardLimitReached ? (
              <>
                <AlertTriangle className="w-5 h-5 opacity-60" />
                <span>{isRTL ? 'تم الوصول للحد الأقصى (2 بطاقات)' : 'Card limit reached (2 cards)'}</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>{isRTL ? 'إنشاء بطاقة جديدة' : 'Create New Card'}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Delete a collected card
  const handleDeleteCollectedCard = async (cardId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('collected_business_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Refresh the list
      await fetchCollectedCards();
      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف البطاقة من المحفوظة' : 'Card removed from Collected',
      });
    } catch (err) {
      console.error('Error deleting collected card:', err);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'تعذر حذف البطاقة' : 'Failed to delete card',
        variant: 'destructive',
      });
    }
  };

  // Render Collected tab (scanned cards from others)
  const renderCollectedContent = () => {
    if (collectedCards.length === 0) {
      return (
        <div className="flex flex-col h-full items-center justify-center px-6 py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {isRTL ? 'لا توجد بطاقات محفوظة' : 'No Cards Collected'}
          </h2>
          <p className="text-muted-foreground text-center max-w-xs mb-6">
            {isRTL 
              ? 'امسح بطاقات الآخرين لحفظها هنا'
              : 'Scan other people\'s cards to save them here'}
          </p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setIsScanOpen(true);
            }}
          >
            {isRTL ? 'مسح بطاقة' : 'Scan a Card'}
          </Button>
        </div>
      );
    }

    // Show collected cards with header
    return (
      <div className="flex flex-col h-full px-4 py-4">
        {/* Header with count, view toggle, and scan button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {collectedCards.length} {isRTL ? 'بطاقة' : collectedCards.length === 1 ? 'card' : 'cards'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setCollectedViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${collectedViewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label={isRTL ? 'عرض شبكي' : 'Grid view'}
                title={isRTL ? 'عرض شبكي' : 'Grid view'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCollectedViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${collectedViewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label={isRTL ? 'عرض قائمة' : 'List view'}
                title={isRTL ? 'عرض قائمة' : 'List view'}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 px-3 text-xs"
              onClick={() => setIsScanOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {isRTL ? 'مسح' : 'Scan'}
            </Button>
          </div>
        </div>

        {/* Grid View */}
        {collectedViewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 transition-all duration-300">
            {collectedCards.map((card) => (
              <div
                key={card.id}
                className="relative group p-2 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="absolute top-1 right-1 z-10 p-1.5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 active:scale-95"
                      aria-label={isRTL ? 'حذف البطاقة' : 'Delete card'}
                      title={isRTL ? 'حذف البطاقة' : 'Delete card'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{isRTL ? 'حذف البطاقة؟' : 'Delete Card?'}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {isRTL 
                          ? 'هل أنت متأكد من حذف هذه البطاقة من المحفوظة؟'
                          : 'Are you sure you want to remove this card from your collection?'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600"
                        onClick={() => handleDeleteCollectedCard(card.id)}
                      >
                        {isRTL ? 'حذف' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={isRTL ? 'فتح البطاقة' : 'Open card'}
                  title={isRTL ? 'فتح البطاقة' : 'Open card'}
                  onClick={() => {
                    const snapshot = card?.card_snapshot || {};
                    const shareSlug = card?.share_slug || undefined;
                    setCollectedPreview({ data: mapSnapshotToBusinessCardData(snapshot), shareSlug });
                    setIsCollectedPreviewFlipped(false);
                    setIsCollectedPreviewOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const snapshot = card?.card_snapshot || {};
                      const shareSlug = card?.share_slug || undefined;
                      setCollectedPreview({ data: mapSnapshotToBusinessCardData(snapshot), shareSlug });
                      setIsCollectedPreviewFlipped(false);
                      setIsCollectedPreviewOpen(true);
                    }
                  }}
                >
                  <CompactCardPreview data={mapSnapshotToBusinessCardData(card?.card_snapshot || {})} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {collectedViewMode === 'list' && (
          <div className="flex flex-col gap-2">
            {collectedCards.map((card) => {
              const snapshot = card?.card_snapshot || {};
              const cardData = mapSnapshotToBusinessCardData(snapshot);
              return (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                >
                  {/* Mini card preview or avatar */}
                  <div 
                    className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                    onClick={() => {
                      setCollectedPreview({ data: cardData, shareSlug: card?.share_slug });
                      setIsCollectedPreviewFlipped(false);
                      setIsCollectedPreviewOpen(true);
                    }}
                  >
                    {cardData.profilePhotoUrl ? (
                      <img src={cardData.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-blue-400" />
                    )}
                  </div>
                  
                  {/* Card info */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      setCollectedPreview({ data: cardData, shareSlug: card?.share_slug });
                      setIsCollectedPreviewFlipped(false);
                      setIsCollectedPreviewOpen(true);
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground truncate">
                      {cardData.firstName} {cardData.lastName}
                    </p>
                    {cardData.jobTitle && (
                      <p className="text-xs text-muted-foreground truncate">{cardData.jobTitle}</p>
                    )}
                    {cardData.companyName && (
                      <p className="text-[10px] text-muted-foreground/70 truncate">{cardData.companyName}</p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                      aria-label={isRTL ? 'فتح البطاقة' : 'View card'}
                      title={isRTL ? 'فتح البطاقة' : 'View card'}
                      onClick={() => {
                        setCollectedPreview({ data: cardData, shareSlug: card?.share_slug });
                        setIsCollectedPreviewFlipped(false);
                        setIsCollectedPreviewOpen(true);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                          aria-label={isRTL ? 'حذف البطاقة' : 'Delete card'}
                          title={isRTL ? 'حذف البطاقة' : 'Delete card'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{isRTL ? 'حذف البطاقة؟' : 'Delete Card?'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isRTL 
                              ? 'هل أنت متأكد من حذف هذه البطاقة من المحفوظة؟'
                              : 'Are you sure you want to remove this card from your collection?'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => handleDeleteCollectedCard(card.id)}
                          >
                            {isRTL ? 'حذف' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render My Card Tab with inner tabs
  const renderMyCardTab = () => {
    // Show wizard if user wants to create/edit card
    if (showCardWizard) {
      return (
        <BusinessCardWizard
          onComplete={handleCardWizardComplete}
          onCancel={() => setShowCardWizard(false)}
        />
      );
    }

    // Show builder after wizard or when editing
    if (showCardBuilder && businessCard) {
      return (
        <BusinessCardBuilder
          initialData={businessCard}
          onSave={handleBuilderSave}
          onBack={() => setShowCardBuilder(false)}
        />
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Inner Tab Navigation - Elegant segmented control */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0">
          <div className="flex p-1 rounded-full bg-muted/50">
            <button
              type="button"
              onClick={() => setCardInnerTab('mycard')}
              className={`flex-1 h-10 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                cardInnerTab === 'mycard'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{t.myCardTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setCardInnerTab('collected')}
              className={`flex-1 h-10 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                cardInnerTab === 'collected'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>{t.collectedTab}</span>
            </button>
          </div>
        </div>

        {/* Inner Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {cardInnerTab === 'mycard' ? renderMyCardContent() : renderCollectedContent()}
        </div>
      </div>
    );
  };

  // Render My CV Tab - Full CV Builder
  const renderMyCVTab = () => (
    <div className="flex flex-col h-[calc(100vh-180px)] w-full">
      <CVBuilderWizard 
        onComplete={(data) => {
          console.log('CV completed:', data);
          // TODO: Save CV and generate PDF
        }}
        onBack={() => setMainTab('docs')}
      />
    </div>
  );

  const renderDocsTabContent = () => (
    <div className="flex flex-col h-full w-full overflow-x-hidden">
      {/* Inner Tabs - Elegant segmented control */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex p-1 rounded-full bg-muted/50">
          <button
            onClick={() => setActiveTab('warranties')}
            className={`flex-1 h-10 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'warranties'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t.warrantiesTab}</span>
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            className={`flex-1 h-10 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'ask'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t.askTab}</span>
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'warranties' && renderWarrantiesTab()}
        {activeTab === 'ask' && renderAskTab()}
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="flex flex-col w-full overflow-x-hidden">
      {/* Main 3-Tab Navigation */}
      <div className="px-4 pt-safe pb-2 solid-bg border-b border-white/10 w-full">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'docs' | 'card' | 'cv')}>
          <TabsList className="justify-center sm:justify-start gap-2 rounded-xl p-1 text-muted-foreground w-full bg-gradient-to-r from-white/8 to-white/5 border border-white/15 backdrop-blur-sm grid grid-cols-3 h-11 mt-2 shadow-inner transition-all duration-300 hover:shadow-md hover:border-white/20">
            <TabsTrigger value="docs" className="flex flex-col items-center justify-center gap-0.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="text-[9px] font-medium leading-none">{t.myDocsTab}</span>
            </TabsTrigger>
            <TabsTrigger value="card" className="flex flex-col items-center justify-center gap-0.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="text-[9px] font-medium leading-none">{t.myCardTab}</span>
            </TabsTrigger>
            <TabsTrigger value="cv" className="flex flex-col items-center justify-center gap-0.5">
              <User className="w-3.5 h-3.5" />
              <span className="text-[9px] font-medium leading-none">{t.myCVTab}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {mainTab === 'docs' && renderDocsTabContent()}
        {mainTab === 'card' && renderMyCardTab()}
        {mainTab === 'cv' && renderMyCVTab()}
      </div>
    </div>
  );

  // Render Add View
  const renderAddView = () => (
    <div className="flex flex-col h-full w-full overflow-x-hidden" dir="ltr">
      {/* Header - Always LTR layout, back button always on left */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Clear form when going back
            setNewItem({
              title: '',
              provider: '',
              category: '',
              purchase_date: '',
              warranty_period: '',
              expiry_date: '',
              ref_number: '',
              support_contact: '',
              image_url: '',
              receipt_url: '',
              extracted_data: {},
              ai_summary: '',
              additional_images: [],
              file_type: '',
            });
            setViewMode('list');
          }}
          className="
            group flex items-center gap-2 h-10 pl-1 pr-4 rounded-full
            bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent
            hover:from-emerald-500/20 hover:via-emerald-500/10 hover:to-transparent
            border border-white/20 hover:border-white/30
            transition-all duration-300 active:scale-95
            shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]
            hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.2)]
            dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]
            dark:hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7)]
          "
        >
          <div className="
            w-8 h-8 rounded-full 
            bg-gradient-to-br from-emerald-500 to-emerald-600
            flex items-center justify-center
            shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)]
            group-hover:shadow-[0_4px_12px_-2px_rgba(16,185,129,0.7)]
            transition-all duration-300
          ">
            <ChevronLeft className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium tracking-wide">{t.back}</span>
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1" dir={isRTL ? 'rtl' : 'ltr'}>{t.addNew}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-20">
            {/* Premium Wakti AI Loader */}
            <div className="relative mb-8">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 blur-xl opacity-40 animate-pulse" style={{ width: '120px', height: '120px', margin: '-10px' }} />
              
              {/* Scanning ring animation */}
              <div className="relative w-24 h-24">
                <svg className="w-full h-full animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 200" />
                </svg>
                
                {/* Center eye icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                    <svg className="w-6 h-6 text-blue-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status text with typing effect */}
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {isRTL ? 'وقتي يقرأ مستندك...' : 'Wakti is reading your document...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'استخراج كل التفاصيل' : 'Extracting every detail'}
              </p>
            </div>
            
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-6">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <>
            {/* Upload Options */}
            <div className="flex flex-col gap-6 mb-6">
              {/* Upload Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="enhanced-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform"
                >
                  <Camera className="w-10 h-10 text-blue-400" />
                  <span className="text-sm font-medium">
                    {newItem.image_url ? (isRTL ? 'إضافة صورة أخرى' : 'Add Another Photo') : t.snapPhoto}
                  </span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="enhanced-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform"
                >
                  <Upload className="w-10 h-10 text-green-400" />
                  <span className="text-sm font-medium">
                    {newItem.image_url ? (isRTL ? 'رفع ملف آخر' : 'Upload Another File') : t.uploadFile}
                  </span>
                </button>
              </div>

              {/* Analyze button moved to bottom of preview section */}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, true)}
              aria-label="Snap Photo"
              title="Snap Photo"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, false)}
              aria-label="Upload Document"
              title="Upload Document"
            />

            {/* Document Preview - MULTI-IMAGE GRID */}
            {(newItem.image_url || newItem.additional_images.length > 0) && (
              <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>📸</span> {isRTL ? 'الصور المرفوعة' : 'Uploaded Photos'}
                    <span className="text-[10px] font-normal text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                      {1 + newItem.additional_images.length} {isRTL ? 'صور' : 'photos'}
                    </span>
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 flex items-center gap-1"
                    onClick={() => {
                      setNewItem(prev => ({ ...prev, image_url: '', receipt_url: '', additional_images: [], file_type: '' }));
                      setPreviewUrls({ primary: '', additional: [] });
                    }}
                  >
                    <X className="w-3 h-3" />
                    <span>{isRTL ? 'مسح الكل' : 'Clear All'}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {/* Primary Image/PDF - use previewUrls.primary (base64) or fallback to newItem.image_url (Supabase URL) */}
                  {(previewUrls.primary || newItem.image_url) && (
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/50 group">
                      {newItem.file_type === 'pdf' ? (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500/20 to-orange-500/20">
                          <FileText className="w-10 h-10 text-red-400" />
                          <span className="text-xs font-medium text-red-400 mt-2">PDF</span>
                        </div>
                      ) : (
                        <img 
                          src={previewUrls.primary || newItem.image_url} 
                          alt="Front" 
                          className="absolute inset-0 w-full h-full object-cover"
                          onLoad={() => console.log('[Preview] Primary image loaded successfully')}
                          onError={(e) => console.error('[Preview] Primary image failed to load:', (e.target as HTMLImageElement).src)}
                        />
                      )}
                      <div className="absolute top-2 left-2 bg-blue-500/90 backdrop-blur-sm px-2 py-1 rounded-lg z-10">
                        <span className="text-[10px] font-bold text-white">
                          {newItem.file_type === 'pdf' ? 'PDF' : (isRTL ? 'الصفحة الأولى' : 'Front Page')}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white border border-white/20 backdrop-blur-sm"
                        onClick={() => setNewItem(prev => ({
                          ...prev,
                          image_url: '',
                          receipt_url: prev.additional_images[0] || '',
                          file_type: ''
                        }))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Additional Images - use previewUrls.additional or fallback to newItem.additional_images */}
                  {(previewUrls.additional.length > 0 ? previewUrls.additional : newItem.additional_images).map((imgUrl, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/10 animate-in zoom-in-95 duration-200">
                      <img 
                        src={imgUrl} 
                        alt={`Page ${idx + 2}`} 
                        className="w-full h-full object-cover"
                        onLoad={() => console.log(`[Preview] Additional image ${idx + 1} loaded successfully`)}
                        onError={(e) => console.error(`[Preview] Additional image ${idx + 1} failed to load:`, e)}
                      />
                      <div className="absolute top-2 left-2 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-[10px] font-bold text-white">
                          {isRTL ? `الصفحة ${idx + 2}` : `Page ${idx + 2}`}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white border border-white/20 backdrop-blur-sm"
                        onClick={() => setNewItem(prev => ({
                          ...prev,
                          additional_images: prev.additional_images.filter((_, i) => i !== idx)
                        }))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Add More Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="
                      relative aspect-[3/4] rounded-xl 
                      border-2 border-dashed border-emerald-500/30
                      flex flex-col items-center justify-center gap-2 
                      bg-gradient-to-br from-emerald-500/10 to-blue-500/10
                      hover:from-emerald-500/20 hover:to-blue-500/20
                      active:from-emerald-500/30 active:to-blue-500/30
                      transition-all duration-300 active:scale-95
                    "
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-emerald-400 uppercase">{isRTL ? 'إضافة' : 'ADD'}</span>
                  </button>
                </div>

                {/* Send Button - disabled after extraction */}
                <Button
                  onClick={handleAnalyzeDocument}
                  disabled={isAnalyzing || (newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0)}
                  className={`w-full mt-4 h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 ${
                    newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'btn-enhanced text-white'
                  }`}
                >
                  {newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0 ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {isRTL ? 'تم التحليل' : 'Analysis Complete'}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {isRTL ? 'إرسال للتحليل' : 'Send for Analysis'}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* AI Summary Card */}
            {newItem.ai_summary && (() => {
              // Clean up ai_summary - ensure it's plain text, not JSON
              let cleanSummary = newItem.ai_summary;
              if (cleanSummary && (cleanSummary.trim().startsWith('{') || cleanSummary.trim().startsWith('```') || cleanSummary.includes('"title":'))) {
                // It's JSON - build a clean summary from extracted fields
                const parts: string[] = [];
                if (newItem.title) parts.push(`This is ${newItem.title}.`);
                if (newItem.provider) parts.push(`Issued by ${newItem.provider}.`);
                const ed = newItem.extracted_data as Record<string, unknown>;
                const personalInfo = ed?.personal_info as Record<string, unknown> | undefined;
                const customerName = personalInfo?.full_name || (ed as any)?.customer_name;
                if (customerName) parts.push(`For ${customerName}.`);
                if (newItem.ref_number) parts.push(`Reference: ${newItem.ref_number}.`);
                const financialInfo = ed?.financial_info as Record<string, unknown> | undefined;
                const totalAmount = financialInfo?.total_amount || (ed as any)?.total_amount;
                if (totalAmount) parts.push(`Amount: ${totalAmount}.`);
                if (newItem.purchase_date) parts.push(`Dated ${newItem.purchase_date}.`);
                if (newItem.expiry_date) parts.push(`Expires ${newItem.expiry_date}.`);
                cleanSummary = parts.length > 0 ? parts.join(' ') : 'Document analyzed successfully.';
              }
              
              return (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-blue-500/20 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-foreground">{isRTL ? 'ملخص وقتي' : 'Wakti Summary'}</h4>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'تحليل بالذكاء الاصطناعي' : 'AI-powered analysis'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{cleanSummary}</p>
                </div>
              );
            })()}

            {/* AI Extracted Data - Collapsible Category Sections */}
            {newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0 && (
              <div className="space-y-3">
                {(() => {
                  const ed = newItem.extracted_data as Record<string, unknown>;
                  
                  const categoryConfig: Record<string, { icon: string; color: string; labelEn: string; labelAr: string }> = {
                    document_info: { icon: '📄', color: 'blue', labelEn: 'Document Information', labelAr: 'معلومات المستند' },
                    personal_info: { icon: '👤', color: 'emerald', labelEn: 'Personal Information', labelAr: 'المعلومات الشخصية' },
                    contact_info: { icon: '📞', color: 'cyan', labelEn: 'Contact Information', labelAr: 'معلومات الاتصال' },
                    vehicle_info: { icon: '🚗', color: 'blue', labelEn: 'Vehicle Information', labelAr: 'معلومات المركبة' },
                    insurance_info: { icon: '🛡️', color: 'purple', labelEn: 'Insurance Details', labelAr: 'تفاصيل التأمين' },
                    financial_info: { icon: '💰', color: 'amber', labelEn: 'Financial Details', labelAr: 'المعلومات المالية' },
                    product_info: { icon: '📦', color: 'orange', labelEn: 'Product Information', labelAr: 'معلومات المنتج' },
                    medical_info: { icon: '🏥', color: 'red', labelEn: 'Medical Information', labelAr: 'المعلومات الطبية' },
                    property_info: { icon: '🏠', color: 'teal', labelEn: 'Property Information', labelAr: 'معلومات العقار' },
                    education_info: { icon: '🎓', color: 'indigo', labelEn: 'Education Information', labelAr: 'المعلومات التعليمية' },
                    employment_info: { icon: '💼', color: 'slate', labelEn: 'Employment Information', labelAr: 'معلومات التوظيف' },
                    company_info: { icon: '🏢', color: 'violet', labelEn: 'Company Information', labelAr: 'معلومات الشركة' },
                    additional_info: { icon: '📝', color: 'gray', labelEn: 'Additional Information', labelAr: 'معلومات إضافية' },
                  };

                  const getColorClasses = (color: string) => ({
                    bg: `from-${color}-500/25 via-${color}-500/15 to-transparent`,
                    text: `text-${color}-500 dark:text-${color}-400`,
                    border: `border-${color}-500/40`,
                    iconBg: `bg-${color}-500/20`,
                  });

                  const hasCategorizedData = Object.keys(categoryConfig).some(cat => 
                    ed[cat] && typeof ed[cat] === 'object' && Object.keys(ed[cat] as object).length > 0
                  );

                  if (hasCategorizedData) {
                    return Object.entries(categoryConfig).map(([categoryKey]) => {
                      const data = ed[categoryKey];
                      if (!data || typeof data !== 'object') return null;
                      
                      const fields = Object.entries(data as Record<string, unknown>).filter(([, val]) => {
                        if (!val || val === 'null' || val === '-' || val === '') return false;
                        return true;
                      });
                      
                      if (fields.length === 0) return null;
                      
                      const config = categoryConfig[categoryKey];
                      const colors = getColorClasses(config.color);
                      const isCollapsed = collapsedSections[categoryKey];
                      
                      return (
                        <div key={categoryKey} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isCollapsed ? 'bg-white/5 border-white/10' : `bg-white/[0.08] ${colors.border} shadow-xl`}`}>
                          <button 
                            onClick={() => toggleSection(categoryKey)}
                            className="w-full px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-all duration-200 relative"
                          >
                            {!isCollapsed && <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-60`} />}
                            
                            <div className="flex items-center gap-4 relative z-10">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-lg ${colors.iconBg} border border-white/20`}>
                                {config.icon}
                              </div>
                              <div className="text-left" dir={isRTL ? 'rtl' : 'ltr'}>
                                <h5 className={`text-sm font-black uppercase tracking-widest ${isCollapsed ? 'text-foreground' : colors.text} transition-colors duration-300`}>
                                  {isRTL ? config.labelAr : config.labelEn}
                                </h5>
                                <p className={`text-[10px] font-black uppercase tracking-tight ${isCollapsed ? 'text-muted-foreground' : 'text-foreground/70'}`}>
                                  {fields.length} {fields.length === 1 ? (isRTL ? 'حقل' : 'field') : (isRTL ? 'حقول' : 'fields')}
                                </p>
                              </div>
                            </div>
                            
                            <div className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </button>
                          
                          {!isCollapsed && (
                            <div className="p-4 flex flex-wrap gap-2">
                              {fields.map(([key, val], idx) => {
                                const label = translateFieldLabel(key, isRTL);
                                const value = String(val);
                                const isLongValue = value.length > 35;
                                const isMonoValue = key.includes('number') || key.includes('_no') || key.includes('_id') || 
                                                   key.includes('chassis') || key.includes('plate') || key.includes('vin');
                                
                                return (
                                  <div key={`${key}-${idx}`} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20">
                                    <span className="text-[10px] text-muted-foreground uppercase">{label}: </span>
                                    <span className={`text-sm font-medium text-foreground ${isMonoValue ? 'font-mono text-xs' : ''}`}>{value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  }

                  // Fallback for non-categorized data
                  const allFields = Object.entries(ed).filter(([key, val]) => {
                    if (key === 'user_tags' || key === 'raw_ocr_text') return false;
                    if (!val || val === 'null' || val === '-' || val === '') return false;
                    if (typeof val === 'object') return false;
                    return true;
                  });

                  if (allFields.length === 0) return null;

                  return (
                    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {allFields.map(([key, val], idx) => {
                          const label = translateFieldLabel(key, isRTL);
                          const value = String(val);
                          const isLongValue = value.length > 35;
                          const isMonoValue = key.includes('number') || key.includes('_no') || key.includes('_id');
                          
                          return (
                            <div key={`${key}-${idx}`} className={isLongValue ? 'col-span-2' : ''}>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                              <p className={`text-sm font-semibold text-foreground ${isMonoValue ? 'font-mono text-xs' : ''}`}>
                                {value}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Show analyzing state */}
      {isAnalyzing && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-sm text-muted-foreground">{isRTL ? 'جاري التحليل...' : 'Analyzing...'}</span>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to build dynamic chips from extracted data
  const buildDynamicChips = (item: WarrantyItem) => {
    const chips: Array<{ label: string; value: string; icon?: string }> = [];
    const extracted = (item.extracted_data || {}) as Record<string, unknown>;
    
    // Icon mapping for common fields
    const iconMap: Record<string, string> = {
      holder_name: '👤', insured_name: '👤', full_name: '👤', owner_name: '👤', name: '👤',
      vehicle_make: '🚗', vehicle_model: '🚗', make: '🚗', model: '🚗',
      vehicle_year: '📅', year: '📅', year_of_manufacture: '📅',
      chassis_number: '🔧', chassis: '🔧', vin: '🔧',
      plate_number: '🔢', plate: '🔢', license_plate: '🔢',
      engine_type: '⚙️', engine: '⚙️', cylinders: '⚙️',
      color: '🎨', vehicle_color: '🎨',
      seats: '💺', no_of_seats: '💺', passengers: '💺',
      coverage_type: '🛡️', policy_type: '🛡️', type_of_cover: '🛡️',
      coverage_area: '🌍', geographical_area: '🌍',
      premium_amount: '💰', total_amount: '💰', contribution: '💰', amount: '💰',
      deductible: '💵', nationality: '🌐', address: '📍',
      tel_no: '📞', phone: '📞', telephone: '📞',
      id_no: '🆔', id_number: '🆔', policy_no: '📋', policy_number: '📋',
      use_of_vehicle: '🚙', private: '🏠', commercial: '🏢',
    };
    
    // Skip these internal/duplicate fields
    const skipKeys = ['user_tags', 'raw_text', 'raw_ocr_text', 'ocr_text', 'summary', 'ai_summary', 
      'title', 'provider', 'category', 'purchase_date', 'expiry_date', 'warranty_period', 
      'ref_number', 'support_contact', 'notes'];
    
    // Add core fields first (from item itself, not extracted_data to avoid duplication)
    if (item.provider) chips.push({ label: isRTL ? 'الجهة' : 'Issuer', value: item.provider, icon: '🏢' });
    if (item.ref_number) chips.push({ label: isRTL ? 'المرجع' : 'Ref #', value: item.ref_number, icon: '📋' });
    
    // Dynamic fields from extracted_data
    Object.entries(extracted).forEach(([key, val]) => {
      if (skipKeys.includes(key.toLowerCase()) || !val) return;
      if (typeof val === 'object') return;
      const strVal = String(val).trim();
      if (!strVal || strVal === '-' || strVal === 'null' || strVal.length > 100) return;
      
      // Format key nicely with translation support
      const label = translateFieldLabel(key, isRTL);
      const icon = iconMap[key.toLowerCase()] || '📌';
      chips.push({ label, value: strVal, icon });
    });
    
    return chips;
  };

  // Render Detail View
  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const timeRemaining = getTimeRemaining(selectedItem.expiry_date);
    const dynamicChips = buildDynamicChips(selectedItem);
    const extracted = (selectedItem.extracted_data || {}) as Record<string, unknown>;
    
    // Clean up ai_summary - ensure it's plain text, not JSON
    let aiSummary = selectedItem.ai_summary || (extracted.summary as string) || '';
    if (aiSummary && (aiSummary.trim().startsWith('{') || aiSummary.trim().startsWith('```') || aiSummary.includes('"title":'))) {
      // It's JSON - build a clean summary from extracted fields
      const parts: string[] = [];
      if (selectedItem.product_name) parts.push(`This is ${selectedItem.product_name}.`);
      if (selectedItem.provider) parts.push(`Issued by ${selectedItem.provider}.`);
      const personalInfo = extracted.personal_info as Record<string, unknown> | undefined;
      const customerName = personalInfo?.full_name || (extracted as any).customer_name;
      if (customerName) parts.push(`For ${customerName}.`);
      if (selectedItem.ref_number) parts.push(`Reference: ${selectedItem.ref_number}.`);
      const financialInfo = extracted.financial_info as Record<string, unknown> | undefined;
      const totalAmount = financialInfo?.total_amount || (extracted as any).total_amount;
      if (totalAmount) parts.push(`Amount: ${totalAmount}.`);
      if (selectedItem.purchase_date) parts.push(`Dated ${selectedItem.purchase_date}.`);
      if (selectedItem.expiry_date) parts.push(`Expires ${selectedItem.expiry_date}.`);
      aiSummary = parts.length > 0 ? parts.join(' ') : 'Document analyzed successfully.';
    }
    
    const userTags = getUserTags(selectedItem);

    return (
      <div className="flex flex-col h-full w-full overflow-x-hidden" dir="ltr">
        {/* Header - Always LTR layout, back button always on left */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 w-full">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setViewMode('list')}
            className="
              group flex items-center gap-2 h-10 pl-1 pr-4 rounded-full
              bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent
              hover:from-blue-500/20 hover:via-purple-500/10 hover:to-transparent
              border border-white/20 hover:border-white/30
              transition-all duration-300 active:scale-95
              shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]
              hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.2)]
              dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]
              dark:hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7)]
            "
          >
            <div className="
              w-8 h-8 rounded-full 
              bg-gradient-to-br from-blue-500 to-purple-500
              flex items-center justify-center
              shadow-[0_2px_8px_-2px_rgba(59,130,246,0.5)]
              group-hover:shadow-[0_4px_12px_-2px_rgba(59,130,246,0.7)]
              transition-all duration-300
            ">
              <ChevronLeft className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium tracking-wide">{t.back}</span>
          </Button>
          <h1 className="text-lg font-bold text-foreground text-center flex-1 mx-2 truncate" dir={isRTL ? 'rtl' : 'ltr'}>{selectedItem.product_name}</h1>
          <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Document Preview - Compact */}
          <div className="w-full mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">{isRTL ? 'المستند' : 'Document'}</h4>
            </div>
            <div 
              className="group relative w-full h-[200px] rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-zoom-in transition-all hover:shadow-xl hover:border-white/20"
              onClick={() => {
                const img = document.querySelector('.document-preview') as HTMLElement;
                if (img) {
                  img.classList.toggle('expanded');
                }
              }}
            >
              {(() => {
                const rawUrl = (selectedItem.receipt_url || selectedItem.image_url || '').trim();
                const isPdf = selectedItem.file_type === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf');
                
                if (rawUrl && !isPdf) {
                  // Try to find matching base64 preview URL for better compatibility
                  const allWarranties = warranties || [];
                  const currentWarranty = allWarranties.find(w => w.id === selectedItem.id);
                  
                  // Default to Supabase URL, but try to find preview in localStorage if available
                  let imageUrl = rawUrl;
                  let imageFallbackUrl = '';
                  
                  // Check if we have a cached preview URL in localStorage
                  try {
                    const cacheKey = `warranty_preview_${selectedItem.id}`;
                    const cachedPreview = localStorage.getItem(cacheKey);
                    if (cachedPreview) {
                      imageUrl = cachedPreview;
                      console.log('[DetailView] Using cached preview from localStorage');
                    }
                  } catch (e) {
                    console.warn('[DetailView] Error accessing localStorage:', e);
                  }

                  return (
                    <div className="relative w-full h-full">
                      <img 
                        src={imageUrl} 
                        alt={selectedItem.product_name}
                        className="document-preview w-full h-full object-contain bg-black/20 transition-all duration-300"
                        crossOrigin="anonymous"
                        onLoad={() => console.log('[DetailView] Image loaded successfully from:', imageUrl.substring(0, 30) + '...')}
                        onError={(e) => {
                          console.error('[DetailView] Primary image failed to load:', imageUrl.substring(0, 30) + '...');
                          const imgElement = e.target as HTMLImageElement;
                          
                          // If the main URL fails, try the fallback Supabase URL
                          if (imageUrl !== rawUrl) {
                            console.log('[DetailView] Trying fallback to Supabase URL');
                            imgElement.src = rawUrl;
                          }
                        }}
                      />
                      {selectedItem.receipt_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white border border-white/20 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(selectedItem.receipt_url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-1.5" />
                          {isRTL ? 'فتح' : 'Open'}
                        </Button>
                      )}
                    </div>
                  );
                } else if (isPdf) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-red-500/5">
                      <FileText className="w-12 h-12 text-red-400" />
                      <p className="text-foreground font-medium text-sm">{t.pdfDocument}</p>
                      <p className="text-xs text-blue-400">✓ {t.aiAnalyzed}</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Shield className="w-12 h-12 text-foreground/20" />
                      <span className="text-xs text-muted-foreground">{t.noDocument}</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
          {/* AI Summary Section */}
          {aiSummary && (
            <div className="mb-5">
              <div className="relative p-4 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-blue-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{t.waktiSummary}</h4>
                      <p className="text-[10px] text-muted-foreground">{t.aiPowered}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{aiSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Categorized Extracted Data - Dynamic Cards */}
          {(() => {
            const ed = extracted as Record<string, unknown>;
      
            // Category config with icons, colors, and labels
            const categoryConfig: Record<string, { icon: string; color: string; labelEn: string; labelAr: string }> = {
              document_info: { icon: '📄', color: 'blue', labelEn: 'Document Information', labelAr: 'معلومات المستند' },
              personal_info: { icon: '👤', color: 'emerald', labelEn: 'Personal Information', labelAr: 'المعلومات الشخصية' },
              contact_info: { icon: '📞', color: 'cyan', labelEn: 'Contact Information', labelAr: 'معلومات الاتصال' },
              vehicle_info: { icon: '🚗', color: 'blue', labelEn: 'Vehicle Information', labelAr: 'معلومات المركبة' },
              insurance_info: { icon: '🛡️', color: 'purple', labelEn: 'Insurance Details', labelAr: 'تفاصيل التأمين' },
              financial_info: { icon: '💰', color: 'amber', labelEn: 'Financial Details', labelAr: 'المعلومات المالية' },
              product_info: { icon: '📦', color: 'orange', labelEn: 'Product Information', labelAr: 'معلومات المنتج' },
              medical_info: { icon: '🏥', color: 'red', labelEn: 'Medical Information', labelAr: 'المعلومات الطبية' },
              property_info: { icon: '🏠', color: 'teal', labelEn: 'Property Information', labelAr: 'معلومات العقار' },
              education_info: { icon: '🎓', color: 'indigo', labelEn: 'Education Information', labelAr: 'المعلومات التعليمية' },
              employment_info: { icon: '💼', color: 'slate', labelEn: 'Employment Information', labelAr: 'معلومات التوظيف' },
              company_info: { icon: '🏢', color: 'violet', labelEn: 'Company Information', labelAr: 'معلومات الشركة' },
              additional_info: { icon: '📝', color: 'gray', labelEn: 'Additional Information', labelAr: 'معلومات إضافية' },
            };
            
            // Get color classes for 'sexy' headers with better contrast
            const getColorClasses = (color: string) => ({
              bg: `from-${color}-500/25 via-${color}-500/15 to-transparent`,
              text: `text-${color}-500 dark:text-${color}-400`,
              border: `border-${color}-500/40`,
              iconBg: `bg-${color}-500/20`,
              fieldBg: `bg-${color}-500/5`,
              fieldBorder: `border-${color}-500/20`,
            });
            
            // Check if extracted_data has categorized structure
            const hasCategorizedData = Object.keys(categoryConfig).some(cat => 
              ed[cat] && typeof ed[cat] === 'object' && Object.keys(ed[cat] as object).length > 0
            );
            
            // Render a category card
            const renderCategoryCard = (categoryKey: string, data: Record<string, unknown>) => {
              const config = categoryConfig[categoryKey];
              if (!config) return null;
              
              const fields = Object.entries(data).filter(([, val]) => {
                if (!val || val === 'null' || val === '-' || val === '') return false;
                return true;
              });
              
              if (fields.length === 0) return null;
              
              const colors = getColorClasses(config.color);
              const isCollapsed = collapsedSections[categoryKey];
              
              return (
                <div key={categoryKey} className={`rounded-2xl border transition-all duration-300 mb-4 overflow-hidden ${isCollapsed ? 'bg-white/5 border-white/10' : `bg-white/[0.08] ${colors.border} shadow-xl`}`}>
                  <button 
                    onClick={() => toggleSection(categoryKey)}
                    className={`w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 active:scale-[0.99] transition-all duration-200 relative group`}
                  >
                    {!isCollapsed && <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-60`} />}
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-lg ${colors.iconBg} border border-white/20 group-hover:scale-110 transition-transform duration-300`}>
                        {config.icon}
                      </div>
                      <div className="text-left" dir={isRTL ? 'rtl' : 'ltr'}>
                        <h5 className={`text-sm font-black uppercase tracking-widest ${isCollapsed ? 'text-foreground' : colors.text} transition-colors duration-300 drop-shadow-sm`}>
                          {isRTL ? config.labelAr : config.labelEn}
                        </h5>
                        <p className={`text-[10px] font-black uppercase tracking-tighter ${isCollapsed ? 'text-muted-foreground' : 'text-foreground/70'}`}>
                          {fields.length} {fields.length === 1 ? (isRTL ? 'حقل' : 'field') : (isRTL ? 'حقول' : 'fields')} {isRTL ? 'مكتشفة' : 'discovered'}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {fields.map(([key, val], idx) => {
                        const label = translateFieldLabel(key, isRTL);
                        const value = String(val);
                        const isLongValue = value.length > 35;
                        const isMonoValue = key.includes('number') || key.includes('_no') || key.includes('_id') || 
                                           key.includes('chassis') || key.includes('plate') || key.includes('vin');
                        
                        // Get chip color based on field type
                        let chipColor = 'white';
                        if (key.includes('date')) chipColor = 'emerald';
                        else if (key.includes('amount') || key.includes('price')) chipColor = 'amber';
                        else if (key.includes('number') || key.includes('id')) chipColor = 'purple';
                        else if (key.includes('type')) chipColor = 'blue';
                        else if (key.includes('status')) chipColor = 'cyan';
                        else if (key.includes('name')) chipColor = 'orange';
                        
                        return (
                          <div key={`${key}-${idx}`} className={`flex flex-col gap-2 ${isLongValue ? 'col-span-2' : ''}`}>
                            <div className={`
                              inline-flex items-center px-2.5 py-1 rounded-md w-fit
                              bg-${chipColor}-500/20
                              border border-${chipColor}-500/40
                            `}>
                              <span className="text-[10px] font-black uppercase tracking-wider text-${chipColor}-400">
                                {label}
                              </span>
                            </div>
                            <div className={`
                              inline-flex items-center px-3 py-2 rounded-lg
                              bg-${chipColor}-500/15 
                              border border-${chipColor}-500/30
                              shadow-sm
                              transition-all duration-200
                              hover:bg-${chipColor}-500/20 hover:border-${chipColor}-500/40
                              hover:shadow-md
                            `}>
                              <span className={`text-sm font-bold text-foreground ${isMonoValue ? 'font-mono text-xs' : ''}`}>
                                {value}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            // Render the categorized data
            if (hasCategorizedData) {
              return (
                <>
                  {Object.entries(categoryConfig).map(([key]) => {
                    const data = ed[key];
                    if (data && typeof data === 'object') {
                      return renderCategoryCard(key, data as Record<string, unknown>);
                    }
                    return null;
                  })}
                </>
              );
            }

            // Fallback for non-categorized data
            const allFields = Object.entries(ed).filter(([key, val]) => {
              if (key === 'user_tags') return false;
              if (!val || val === 'null' || val === '-' || val === '') return false;
              if (typeof val === 'object') return false;
              return true;
            });

            if (allFields.length === 0) return null;

            return (
              <div className="rounded-2xl border border-white/10 bg-white/5 mb-4 overflow-hidden">
                <div className="p-4 grid grid-cols-2 gap-3">
                  {allFields.map(([key, val], idx) => {
                    const label = translateFieldLabel(key, isRTL);
                    const value = String(val);
                    const isLongValue = value.length > 35;
                    const isMonoValue = key.includes('number') || key.includes('_no') || key.includes('_id') || 
                                       key.includes('chassis') || key.includes('plate') || key.includes('vin');
                    
                    return (
                      <div key={`${key}-${idx}`} className={isLongValue ? 'col-span-2' : ''}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                        <p className={`text-sm font-semibold text-foreground ${isMonoValue ? 'font-mono text-xs' : ''}`}>
                          {value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* User Tags with Edit */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isRTL ? 'التصنيفات' : 'Tags'}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setDetailTagsInput(userTags.join(', '));
                  setIsEditingTags(true);
                }}
              >
                {isRTL ? 'تعديل' : 'Edit'}
              </Button>
            </div>

            {isEditingTags ? (
              <div className="space-y-2">
                <Input
                  value={detailTagsInput}
                  onChange={(e) => setDetailTagsInput(e.target.value)}
                  placeholder={isRTL ? 'أدخل التصنيفات مفصولة بفواصل' : 'Enter tags separated by commas'}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsEditingTags(false);
                      setDetailTagsInput('');
                    }}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
                    onClick={async () => {
                      if (!user) return;
                      setIsSavingTags(true);
                      try {
                        const parsed = detailTagsInput
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean);

                        const nextExtracted: Record<string, unknown> = {
                          ...(selectedItem.extracted_data || {}),
                          user_tags: parsed,
                        };

                        const { error } = await (supabase as any)
                          .from('user_warranties')
                          .update({ extracted_data: nextExtracted })
                          .eq('id', selectedItem.id);

                        if (error) throw error;

                        setSelectedItem({ ...selectedItem, extracted_data: nextExtracted });
                        setIsEditingTags(false);
                        setDetailTagsInput('');
                        fetchData();
                      } catch (e) {
                        toast({ title: 'Error', description: 'Failed to save tags', variant: 'destructive' });
                      } finally {
                        setIsSavingTags(false);
                      }
                    }}
                    disabled={isSavingTags}
                  >
                    {isSavingTags ? <Loader2 className="w-4 h-4 animate-spin" /> : t.save}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {userTags.length === 0 ? (
                  <span className="text-sm text-muted-foreground italic">{isRTL ? 'لا توجد تصنيفات' : 'No tags yet'}</span>
                ) : (
                  userTags.map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-foreground/90">
                      {tag}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setDetailExpiryInput(selectedItem.expiry_date ? selectedItem.expiry_date.slice(0, 10) : '');
                  setIsEditingExpiry(true);
                }}
              >
                {isRTL ? 'تعديل' : 'Edit'}
              </Button>
            </div>

            {isEditingExpiry ? (
              <div className="space-y-2">
                <Input
                  type="date"
                  value={detailExpiryInput}
                  onChange={(e) => setDetailExpiryInput(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsEditingExpiry(false);
                      setDetailExpiryInput('');
                    }}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
                    onClick={async () => {
                      if (!user || !selectedItem) return;
                      const nextExpiry = detailExpiryInput ? new Date(detailExpiryInput).toISOString() : null;
                      try {
                        const { error } = await (supabase as any)
                          .from('user_warranties')
                          .update({ expiry_date: nextExpiry })
                          .eq('id', selectedItem.id);

                        if (error) throw error;

                        setSelectedItem({ ...selectedItem, expiry_date: nextExpiry });
                        setIsEditingExpiry(false);
                        setDetailExpiryInput('');
                        fetchData();

                        if (nextExpiry) {
                          await rescheduleDocExpiryPush({
                            userId: user.id,
                            docId: selectedItem.id,
                            docTitle: selectedItem.product_name,
                            expiryDateIso: nextExpiry,
                          });
                        } else {
                          const existing = await findExistingDocExpiryNotification(user.id, selectedItem.id);
                          if (existing?.id && existing.onesignalId) {
                            await cancelDocExpiryNotification({
                              userId: user.id,
                              notificationId: existing.id,
                              onesignalId: existing.onesignalId,
                            });
                          }
                        }
                      } catch (e) {
                        toast({ title: 'Error', description: 'Failed to save expiry date', variant: 'destructive' });
                      }
                    }}
                  >
                    {t.save}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {selectedItem.expiry_date ? format(parseISO(selectedItem.expiry_date), 'MM/dd/yy') : '-'}
              </div>
            )}
          </div>

          {/* View Receipt Button */}
          {selectedItem.receipt_url && (
            <Button
              className="w-full mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center gap-2"
              onClick={() => {
                const rawUrl = (selectedItem.receipt_url || '').trim();
                if (!rawUrl) {
                  toast({
                    title: 'Error',
                    description: isRTL ? 'لا يوجد إيصال' : 'No receipt available',
                    variant: 'destructive'
                  });
                  return;
                }
                
                // Open document in modal
                const isPdf = selectedItem.file_type === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf');
                setDocumentToView({ url: rawUrl, type: isPdf ? 'pdf' : 'image' });
                setIsDocumentModalOpen(true);
              }}
            >
              <FileText className="w-4 h-4" />
              <span>{t.viewReceipt}</span>
            </Button>
          )}

          {/* Ask Wakti AI Button */}
          <Button
            variant="outline"
            className="w-full mb-3 flex items-center justify-center gap-2"
            onClick={() => {
              // Reset question and messages
              setAskQuestion('');
              setAskMessages([]);
              
              // Switch to main view with Ask tab active
              setViewMode('list');
              setMainTab('docs');
              setActiveTab('ask');
              
              // Pre-select this document in the scope
              setDocScopeMode('manual');
              setSelectedDocIds([selectedItem.id]);
            }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t.askWakti}</span>
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center gap-2"
            onClick={() => handleDelete(selectedItem.id)}
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteItem}</span>
          </Button>
        </div>
      </div>
    );
  };

  // Render Ask View (dedicated view for asking questions about a warranty)
  const renderAskView = () => (
    <div className="flex flex-col h-full w-full overflow-x-hidden" dir="ltr">
      {/* Header - Always LTR layout, back button always on left */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0 w-full">
        <Button variant="ghost" size="sm" onClick={() => setViewMode('detail')} className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center">
          <span className="text-sm font-medium">{t.back}</span>
        </Button>
        <div className="flex-1" dir={isRTL ? 'rtl' : 'ltr'}>
          <h1 className="text-xl font-bold text-foreground truncate">{t.askWakti}</h1>
          <p className="text-sm text-muted-foreground truncate">{selectedItem?.product_name}</p>
        </div>
      </div>

      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 w-full" ref={messagesContainerRef} dir={isRTL ? 'rtl' : 'ltr'}>
        {selectedItem && (
          <div className="space-y-4">
            {selectedItem.ai_summary && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h4 className="text-sm font-medium text-blue-400 mb-2">{t.aiSummary}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedItem.ai_summary}</p>
              </div>
            )}

            {askMessages.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground mb-2">{t.askEmptyHint}</div>
                <div className="space-y-2">
                  {[t.askExample1, t.askExample2, t.askExample3].map((example, i) => (
                    <div
                      key={i}
                      className="cursor-pointer hover:bg-white/10 rounded-lg p-2 transition-colors"
                      onClick={() => setAskQuestion(example)}
                    >
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {askMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`}>
                    {message.role === 'user' ? (
                      <div className="flex justify-end mb-1">
                        <div className="bg-blue-500/20 text-foreground px-4 py-2 rounded-xl max-w-[85%]">
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/10 dark:bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <Shield className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-foreground">Wakti AI</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                        {message.needsClarification && message.options && (
                          <div className="mt-4 space-y-2">
                            {message.options.map((option) => (
                              <button
                                key={option.id}
                                onClick={() => {
                                  const lastUserMessage = askMessages.filter(m => m.role === 'user').pop();
                                  if (lastUserMessage) {
                                    handleDocumentSelect(option.id, lastUserMessage.content);
                                  }
                                }}
                                className="w-full text-left p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                              >
                                <div className="font-medium text-sm text-foreground">{option.title}</div>
                                <div className="text-xs text-muted-foreground mt-1">{option.subtitle}</div>
                                {option.expiry && (
                                  <div className="text-xs text-blue-400 mt-1">
                                    {isRTL ? 'ينتهي في' : 'Expires'}: {option.expiry}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Input Area at Bottom */}
      <div className="shrink-0 px-4 py-4 border-t border-white/10 bg-background">
        <div className="space-y-3">
          <Textarea
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            placeholder={t.askQuestion}
            className="min-h-[80px] bg-white/5 border-white/10"
          />

          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center gap-2"
            onClick={handleAskWakti}
            disabled={isAsking || !askQuestion.trim()}
          >
            {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            <span>{isAsking ? (isRTL ? 'جاري التحليل...' : 'Analyzing...') : t.send}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div
      className="w-full bg-background overflow-x-hidden relative"
      style={{ paddingTop: 'calc(var(--app-header-h, 64px) - 32px)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col w-full max-w-full">
        {viewMode === 'add' ? renderAddView() : viewMode === 'detail' ? renderDetailView() : viewMode === 'ask' ? renderAskView() : renderMainView()}
      </div>

      <Dialog open={isScanOpen} onOpenChange={setIsScanOpen}>
        <DialogContent
          className="max-w-md w-[92vw] rounded-2xl border border-white/10 bg-gradient-to-b from-background via-background to-blue-500/5 p-4"
          title={isRTL ? 'مسح بطاقة' : 'Scan a Card'}
          description={isRTL ? 'افتح الكاميرا لمسح QR' : 'Open camera to scan a QR'}
        >
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">
              {isRTL ? 'امسح رمز QR لبطاقة وقتي' : 'Scan a Wakti business card QR'}
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
              <div className="relative w-full aspect-[3/4]">
                <video
                  ref={scanVideoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      variant="outline"
                      className="rounded-xl bg-white/5 border-white/10"
                      onClick={() => void startQrScanner()}
                    >
                      {isRTL ? 'تشغيل الكاميرا' : 'Start Camera'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {scanError && (
              <div className="text-xs text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl p-2">
                {scanError}
              </div>
            )}

            <div className="pt-1">
              <div className="text-xs text-muted-foreground mb-2">
                {isRTL ? 'إذا لم يعمل المسح، الصق رابط البطاقة هنا:' : 'If scanning doesn’t work, paste the card link here:'}
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualScanValue}
                  onChange={(e) => setManualScanValue(e.target.value)}
                  placeholder={isRTL ? 'https://wakti.qa/card/...' : 'https://wakti.qa/card/...'}
                  className="bg-white/5 border-white/10 rounded-xl"
                />
                <Button
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600"
                  onClick={() => void handleScanResultValue(manualScanValue)}
                  disabled={!manualScanValue.trim()}
                >
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCollectedPreviewOpen}
        onOpenChange={(open) => {
          setIsCollectedPreviewOpen(open);
          if (!open) setCollectedPreview(null);
        }}
      >
        <DialogContent
          className="max-w-md w-[92vw] rounded-2xl border border-white/10 bg-gradient-to-b from-background via-background to-purple-500/5 p-4"
          title={isRTL ? 'البطاقة' : 'Card'}
          description={isRTL ? 'معاينة البطاقة' : 'Card preview'}
        >
          {collectedPreview && (
            <div className="space-y-3">
              <CardPreviewLive
                data={collectedPreview.data}
                isFlipped={isCollectedPreviewFlipped}
                handleFlip={() => setIsCollectedPreviewFlipped((v) => !v)}
                handleAddToWallet={() => {}}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Removed floating plus button from bottom center */}

      {/* Document Viewer Modal */}
      {isDocumentModalOpen && documentToView && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setIsDocumentModalOpen(false)}
        >
          <div 
            className="relative w-full h-full max-w-6xl max-h-[90vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsDocumentModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all"
              aria-label={isRTL ? 'إغلاق' : 'Close'}
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Document Display */}
            <div className="w-full h-full flex items-center justify-center">
              {documentToView.type === 'pdf' ? (
                <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                  <iframe
                    src={documentToView.url}
                    className="w-full h-full"
                    title="PDF Document"
                  />
                </div>
              ) : (
                <div className="w-full h-full overflow-auto p-4">
                  <img
                    src={documentToView.url}
                    alt="Document"
                    className="max-w-none max-h-none object-contain rounded-lg mx-auto"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card Created Celebration Popup */}
      <CardCreatedCelebration
        isOpen={showCelebration}
        onContinue={() => {
          setShowCelebration(false);
          setShowCardBuilder(true);
        }}
      />

      <StudioGuestLoginDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        redirectTo={typeof window === 'undefined' ? '/my-documents' : `${window.location.pathname}${window.location.search}`}
        language={language === 'ar' ? 'ar' : 'en'}
      />
    </div>
  );
};

export default MyWarranty;
