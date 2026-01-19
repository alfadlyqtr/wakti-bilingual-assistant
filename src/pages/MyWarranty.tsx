import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, Plus, SortAsc, Camera, Upload, X, 
  ChevronLeft, Trash2, FileText, MessageCircle, Calendar,
  Tag, Clock, CheckCircle, AlertTriangle, XCircle, Loader2,
  Edit2, ExternalLink, CreditCard, User, FolderOpen, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, differenceInMonths, parseISO, addMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    myCardTab: 'My Card',
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
    addNew: 'Add Document',
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
    back: 'Back',
    save: 'Save',
    saveFile: 'Save File',
    cancel: 'Cancel',
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
    addNew: 'إضافة مستند',
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
    back: 'رجوع',
    save: 'حفظ',
    saveFile: 'حفظ الملف',
    cancel: 'إلغاء',
  },
};

const MyWarranty: React.FC = () => {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mainTab, setMainTab] = useState<'docs' | 'card' | 'cv'>('docs');
  const [activeTab, setActiveTab] = useState<'warranties' | 'ask'>('warranties');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring' | 'expired'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WarrantyItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Add form state
  const [newItem, setNewItem] = useState({
    product_name: '',
    purchase_date: '',
    expiry_date: '',
    warranty_months: '',
    notes: '',
    provider: '',
    ref_number: '',
    support_contact: '',
    category_name: '',
    image_url: '',
    receipt_url: '',
    file_type: '' as 'image' | 'pdf' | '',
    extracted_data: {} as Record<string, unknown>,
    ai_summary: '',
  });

  const [newTagsInput, setNewTagsInput] = useState('');
  const [detailTagsInput, setDetailTagsInput] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  // Ask Wakti state
  const [askQuestion, setAskQuestion] = useState('');
  const [askMessages, setAskMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [docScopeMode, setDocScopeMode] = useState<'auto' | 'manual'>('auto');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  
  // Document viewer modal state
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<{ url: string; type: 'image' | 'pdf' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch warranties
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch warranties
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

  // Handle file upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, isCamera: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // CLEAR all old state before starting new upload
    setNewItem({
      product_name: '',
      purchase_date: '',
      expiry_date: '',
      warranty_months: '',
      notes: '',
      provider: '',
      ref_number: '',
      support_contact: '',
      category_name: '',
      image_url: '',
      receipt_url: '',
      file_type: '',
      extracted_data: {},
      ai_summary: '',
    });
    
    setIsAnalyzing(true);
    setViewMode('add');

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const isPdf = file.type === 'application/pdf';
      const mimeType = file.type;

      // Upload to storage - sanitize filename to avoid URL issues
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('warranty-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('warranty-docs')
        .getPublicUrl(fileName);
      
      console.log('[MyWarranty] Uploaded file URL:', urlData.publicUrl);

      // Call AI extraction
      const { data: aiData, error: aiError } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'extract',
          imageBase64: isPdf ? undefined : base64,
          pdfBase64: isPdf ? base64 : undefined,
          mimeType,
        },
      });

      if (aiError) throw aiError;

      if (aiData?.success && aiData?.data) {
        const extracted = aiData.data;
        
        setNewItem({
          product_name: extracted.title || '',
          purchase_date: extracted.purchase_date || '',
          expiry_date: extracted.expiry_date || '',
          warranty_months: extracted.warranty_period ? extracted.warranty_period.toString() : '',
          notes: extracted.notes || '',
          provider: extracted.provider || '',
          ref_number: extracted.ref_number || '',
          support_contact: extracted.support_contact || '',
          category_name: '',
          image_url: isPdf ? '' : urlData.publicUrl.trim(),
          receipt_url: urlData.publicUrl.trim(),
          file_type: isPdf ? 'pdf' : 'image',
          extracted_data: extracted,
          ai_summary: `Provider: ${extracted.provider || 'N/A'}\nRef: ${extracted.ref_number || 'N/A'}\nContact: ${extracted.support_contact || 'N/A'}`,
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze document',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save warranty
  const handleSave = async () => {
    if (!user || !newItem.product_name) return;

    try {
      const parsedTags = newTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const extractedWithTags: Record<string, unknown> = {
        ...(newItem.extracted_data || {}),
        user_tags: parsedTags,
      };

      const { error } = await (supabase as any).from('user_warranties').insert({
        user_id: user.id,
        product_name: newItem.product_name,
        purchase_date: newItem.purchase_date || null,
        expiry_date: newItem.expiry_date || null,
        warranty_months: newItem.warranty_months ? parseInt(newItem.warranty_months) : null,
        notes: newItem.notes || null,
        provider: newItem.provider || null,
        ref_number: newItem.ref_number || null,
        support_contact: newItem.support_contact || null,
        image_url: newItem.image_url || null,
        receipt_url: newItem.receipt_url || null,
        file_type: newItem.file_type || null,
        extracted_data: extractedWithTags,
        ai_summary: newItem.ai_summary || null,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Warranty saved successfully',
      });

      setNewItem({
        product_name: '',
        purchase_date: '',
        expiry_date: '',
        warranty_months: '',
        notes: '',
        provider: '',
        ref_number: '',
        support_contact: '',
        category_name: '',
        image_url: '',
        receipt_url: '',
        file_type: '',
        extracted_data: {},
        ai_summary: '',
      });
      setNewTagsInput('');
      setViewMode('list');
      fetchData();
    } catch (error) {
      console.error('Error saving warranty:', error);
      toast({
        title: 'Error',
        description: 'Failed to save warranty',
        variant: 'destructive',
      });
    }
  };

  // Delete warranty
  const handleDelete = async (id: string) => {
    try {
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

  const getSuggestedDocs = (question: string) => {
    const trimmed = question.trim().toLowerCase();
    const tokens = trimmed.split(/[^a-z0-9\u0600-\u06FF]+/i).filter((t) => t.length > 2);
    const hasExpiryIntent = /expire|expiry|valid|end|انتهاء|ينتهي|صالحة/.test(trimmed);

    if (tokens.length === 0) {
      return [...warranties]
        .sort((a, b) => getDocSortValue(b) - getDocSortValue(a))
        .slice(0, 3);
    }

    const scored = warranties
      .map((doc) => {
        const haystack = [
          doc.product_name,
          doc.provider,
          doc.ref_number,
          doc.notes,
          doc.ai_summary,
          JSON.stringify(doc.extracted_data || {}),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 0;
        tokens.forEach((token) => {
          if (haystack.includes(token)) score += 2;
        });
        if (hasExpiryIntent && doc.expiry_date) score += 3;
        return { doc, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.doc);

    if (scored.length > 0) return scored.slice(0, 3);

    return [...warranties]
      .sort((a, b) => getDocSortValue(b) - getDocSortValue(a))
      .slice(0, 3);
  };

  const smartPicks = useMemo(() => getSuggestedDocs(askQuestion), [askQuestion, warranties]);
  const smartPickIds = useMemo(() => new Set(smartPicks.map((doc) => doc.id)), [smartPicks]);
  const allDocIds = useMemo(() => warranties.map((doc) => doc.id), [warranties]);

  const isAllFilesSelected =
    docScopeMode === 'manual' && selectedDocIds.length > 0 && selectedDocIds.length === allDocIds.length;

  const handleSelectAuto = () => {
    setDocScopeMode('auto');
    setSelectedDocIds([]);
  };

  const handleSelectAllFiles = () => {
    setDocScopeMode('manual');
    setSelectedDocIds(allDocIds);
  };

  const handleToggleDoc = (docId: string) => {
    setDocScopeMode('manual');
    setSelectedDocIds((prev) => {
      const next = prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId];
      if (next.length === 0) {
        setDocScopeMode('auto');
      }
      return next;
    });
  };

  // Ask Wakti - searches ALL documents
  const handleAskWakti = async () => {
    const trimmedQuestion = askQuestion.trim();
    if (!trimmedQuestion || warranties.length === 0) return;

    setIsAsking(true);
    setAskMessages((prev) => [...prev, { role: 'user', content: trimmedQuestion }]);
    
    try {
      const suggestedDocs = getSuggestedDocs(trimmedQuestion);
      const scopedDocs =
        docScopeMode === 'manual' && selectedDocIds.length > 0
          ? warranties.filter((doc) => selectedDocIds.includes(doc.id))
          : suggestedDocs.length > 0
            ? suggestedDocs
            : warranties;

      // Build context from scoped documents
      const allDocsContext = scopedDocs.map((doc) => ({
        product_name: doc.product_name,
        provider: doc.provider,
        ref_number: doc.ref_number,
        support_contact: doc.support_contact,
        purchase_date: doc.purchase_date,
        expiry_date: doc.expiry_date,
        warranty_months: doc.warranty_months,
        notes: doc.notes,
        ai_summary: doc.ai_summary,
        extracted_data: doc.extracted_data,
      }));

      const { data, error } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'qa',
          question: trimmedQuestion,
          warrantyContext: JSON.stringify(allDocsContext),
        },
      });

      if (error) throw error;

      if (data?.success) {
        setAskMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
        setAskQuestion('');
      }
    } catch (error) {
      console.error('Error asking Wakti:', error);
      toast({
        title: 'Error',
        description: 'Failed to get answer',
        variant: 'destructive',
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Filter warranties
  const filteredWarranties = warranties.filter((w) => {
    if (statusFilter === 'expired') return w.status === 'expired';
    if (statusFilter === 'expiring') return w.status === 'expiring_soon';
    return true;
  });

  const getUserTags = (w: WarrantyItem): string[] => {
    const raw = (w.extracted_data as Record<string, unknown> | null)?.user_tags;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x)).map((s) => s.trim()).filter(Boolean);
  };

  const tagIndex = filteredWarranties.reduce<Record<string, { count: number; thumbUrl?: string }>>((acc, w) => {
    const tags = getUserTags(w);
    tags.forEach((tag) => {
      if (!acc[tag]) acc[tag] = { count: 0 };
      acc[tag].count += 1;
      if (!acc[tag].thumbUrl && w.image_url) acc[tag].thumbUrl = w.image_url;
    });
    return acc;
  }, {});

  const filteredWarrantiesByTag = selectedTag
    ? filteredWarranties.filter((w) => getUserTags(w).includes(selectedTag))
    : filteredWarranties;

  // Render warranty card
  const renderWarrantyCard = (item: WarrantyItem) => {
    const timeRemaining = getTimeRemaining(item.expiry_date);
    const tags = getUserTags(item);
    // Sanitize URL by removing leading spaces and properly trimming
    const rawUrl = (item.receipt_url || item.image_url || '').trim();
    const isPdf = item.file_type === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf');

    return (
      <div
        key={item.id}
        onClick={() => {
          setSelectedItem(item);
          setViewMode('detail');
        }}
        className="enhanced-card p-4 mb-3 cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 relative">
            {rawUrl && !isPdf ? (
              <img 
                src={rawUrl} 
                alt={item.product_name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-full h-full flex items-center justify-center bg-white/5';
                    fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield text-foreground/20"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : isPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/10 gap-1">
                <FileText className="w-8 h-8 text-red-400/60" />
                <span className="text-[10px] text-red-400/80 font-medium">PDF</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-foreground/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{item.product_name}</h3>
            <p className="text-sm text-muted-foreground">
              {item.status === 'expired' ? t.expiredOn : t.willExpireOn}: {item.expiry_date ? format(parseISO(item.expiry_date), 'MM/dd/yy') : '-'}
            </p>

            {tags.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-foreground/80 whitespace-nowrap">
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-foreground/60 whitespace-nowrap">
                    +{tags.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {/* Progress Bar */}
            {timeRemaining && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${timeRemaining.textColor}`}>
                    {timeRemaining.text}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${timeRemaining.color} rounded-full transition-all`}
                    style={{ width: `${timeRemaining.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render List View
  const renderWarrantiesTab = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 solid-bg">
        {/* Hero Section - Beautiful intro */}
        <div className="relative mb-6 p-5 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-white/10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t.docsHeroTitle}</h1>
                <p className="text-xs text-muted-foreground">{warranties.length} {t.items}</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {t.docsHeroSubtitle}
            </p>
            
            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
                🪪 {t.docsFeature1}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                🛡️ {t.docsFeature2}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                📋 {t.docsFeature3}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
                📝 {t.docsFeature4}
              </span>
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
          <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
            <SortAsc className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <Button
            type="button"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className={
              'rounded-full h-9 ' +
              (statusFilter === 'all'
                ? 'btn-enhanced'
                : '')
            }
            onClick={() => setStatusFilter('all')}
          >
            {t.filterAll}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'expiring' ? 'default' : 'outline'}
            className={
              'rounded-full h-9 ' +
              (statusFilter === 'expiring'
                ? 'bg-orange-500/15 border border-orange-500/30 text-foreground hover:bg-orange-500/20'
                : '')
            }
            onClick={() => setStatusFilter('expiring')}
          >
            {t.filterExpiring}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'expired' ? 'default' : 'outline'}
            className={
              'rounded-full h-9 ' +
              (statusFilter === 'expired'
                ? 'bg-red-500/15 border border-red-500/30 text-foreground hover:bg-red-500/20'
                : '')
            }
            onClick={() => setStatusFilter('expired')}
          >
            {t.filterExpired}
          </Button>
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
              onClick={() => setViewMode('add')}
              className="mt-6 w-16 h-16 rounded-full btn-enhanced flex items-center justify-center active:scale-95 transition"
              aria-label={t.addNew}
            >
              <Plus className="w-7 h-7 text-white" />
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
                <button
                  key={i}
                  onClick={() => setAskQuestion(example)}
                  className="w-full p-3 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 text-sm text-muted-foreground hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left active:scale-[0.98]"
                >
                  <span className="text-blue-400 mr-2">→</span> {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {askMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-lg shadow-blue-500/20">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[80%] rounded-2xl rounded-tr-md bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm text-white shadow-lg shadow-blue-500/20'
                      : 'max-w-[80%] rounded-2xl rounded-tl-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 px-4 py-3 text-sm text-foreground whitespace-pre-wrap'
                  }
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ml-2 mt-1 flex-shrink-0 shadow-lg shadow-emerald-500/20">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isAsking && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 animate-pulse">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 px-4 py-3 text-sm text-muted-foreground flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {isRTL ? 'جاري البحث في مستنداتك...' : 'Searching your documents...'}
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

  // Render My Card Tab (placeholder)
  const renderMyCardTab = () => (
    <div className="flex flex-col h-full items-center justify-center px-4 py-20">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
        <CreditCard className="w-10 h-10 text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{t.cardTitle}</h2>
      <p className="text-muted-foreground text-center mb-4">{t.cardDescription}</p>
      <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10">
        <span className="text-sm text-muted-foreground">{t.cardComingSoon}</span>
      </div>
    </div>
  );

  // Render My CV Tab (placeholder)
  const renderMyCVTab = () => (
    <div className="flex flex-col h-full items-center justify-center px-4 py-20">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6">
        <User className="w-10 h-10 text-purple-400" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{t.cvTitle}</h2>
      <p className="text-muted-foreground text-center mb-4">{t.cvDescription}</p>
      <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10">
        <span className="text-sm text-muted-foreground">{t.cvComingSoon}</span>
      </div>
    </div>
  );

  // Render Docs Tab Content (existing warranties + ask)
  const renderDocsTabContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'warranties' | 'ask')}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="warranties">{t.warrantiesTab}</TabsTrigger>
            <TabsTrigger
              value="ask"
              className="border-2 border-blue-500/40 bg-gradient-to-r from-blue-500/15 to-purple-500/15 text-foreground shadow-[0_8px_24px_rgba(59,130,246,0.25)] hover:shadow-[0_10px_28px_rgba(99,102,241,0.35)] data-[state=active]:from-blue-500/30 data-[state=active]:to-purple-500/30 data-[state=active]:border-blue-400/60"
            >
              {t.askTab}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warranties" className="mt-3">
            {renderWarrantiesTab()}
          </TabsContent>
          <TabsContent value="ask" className="mt-3">
            {renderAskTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="flex flex-col h-full">
      {/* Main 3-Tab Navigation */}
      <div className="px-4 pt-4 pb-2 solid-bg border-b border-white/10">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'docs' | 'card' | 'cv')}>
          <TabsList className="w-full bg-white/5 border border-white/10 grid grid-cols-3">
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{t.myDocsTab}</span>
            </TabsTrigger>
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t.myCardTab}</span>
            </TabsTrigger>
            <TabsTrigger value="cv" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t.myCVTab}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'docs' && renderDocsTabContent()}
        {mainTab === 'card' && renderMyCardTab()}
        {mainTab === 'cv' && renderMyCVTab()}
      </div>
    </div>
  );

  // Render Add View
  const renderAddView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={() => {
          // Clear form when going back
          setNewItem({
            product_name: '',
            purchase_date: '',
            expiry_date: '',
            warranty_months: '',
            notes: '',
            provider: '',
            ref_number: '',
            support_contact: '',
            category_name: '',
            image_url: '',
            receipt_url: '',
            file_type: '',
            extracted_data: {},
            ai_summary: '',
          });
          setNewTagsInput('');
          // Reset file inputs
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (fileInputRef.current) fileInputRef.current.value = '';
          setViewMode('list');
        }}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{t.addNew}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t.analyzing}</p>
          </div>
        ) : (
          <>
            {/* Upload Options */}
            {!newItem.receipt_url && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="enhanced-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform"
                >
                  <Camera className="w-10 h-10 text-blue-400" />
                  <span className="text-sm font-medium">{t.snapPhoto}</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="enhanced-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform"
                >
                  <Upload className="w-10 h-10 text-green-400" />
                  <span className="text-sm font-medium">{t.uploadFile}</span>
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e, true)}
              aria-label="Snap Photo"
              title="Snap Photo"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect(e, false)}
              aria-label="Upload Document"
              title="Upload Document"
            />

            {/* Document Preview - LARGE & CLEAR */}
            {(newItem.image_url || newItem.receipt_url) && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">{isRTL ? 'المستند' : 'Receipt'}</h4>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setNewItem(prev => ({ ...prev, image_url: '', receipt_url: '', file_type: '' }))}
                  >
                    <X className="w-3 h-3 mr-1" />
                    {isRTL ? 'حذف' : 'Remove'}
                  </Button>
                </div>
                <div className="relative w-full h-[400px] rounded-xl overflow-hidden bg-white/5 border-2 border-blue-500/30">
                  {newItem.file_type === 'pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-red-500/10">
                      <FileText className="w-24 h-24 text-red-400" />
                      <div className="text-center">
                        <p className="text-foreground font-medium text-lg">PDF Document</p>
                        <p className="text-xs text-blue-400 mt-2">✓ Uploaded & AI Analyzed</p>
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={newItem.image_url || newItem.receipt_url} 
                      alt="Receipt Preview" 
                      className="w-full h-full object-contain bg-black/20"
                      onError={(e) => {
                        console.error('Image failed to load:', newItem.image_url || newItem.receipt_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* AI Extracted Data - Display ALL captured information */}
            {newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
                  <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {isRTL ? 'البيانات المستخرجة بالذكاء الاصطناعي' : 'AI Extracted Data'}
                  </h4>
                  <div className="space-y-3">
                    {/* Title */}
                    {(newItem.extracted_data as any).title && (
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'العنوان' : 'Title'}</p>
                        <p className="text-foreground font-medium">{(newItem.extracted_data as any).title}</p>
                      </div>
                    )}
                    
                    {/* Provider & Category */}
                    <div className="grid grid-cols-2 gap-3">
                      {(newItem.extracted_data as any).provider && (
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'المزود' : 'Provider'}</p>
                          <p className="text-foreground text-sm">{(newItem.extracted_data as any).provider}</p>
                        </div>
                      )}
                      {(newItem.extracted_data as any).category && (
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'الفئة' : 'Category'}</p>
                          <p className="text-foreground text-sm">{(newItem.extracted_data as any).category}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Ref Number */}
                    {(newItem.extracted_data as any).ref_number && (
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'رقم المرجع' : 'Reference Number'}</p>
                        <p className="text-foreground text-sm font-mono">{(newItem.extracted_data as any).ref_number}</p>
                      </div>
                    )}
                    
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      {(newItem.extracted_data as any).purchase_date && (
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'تاريخ الشراء' : 'Purchase Date'}</p>
                          <p className="text-foreground text-sm">{(newItem.extracted_data as any).purchase_date}</p>
                        </div>
                      )}
                      {(newItem.extracted_data as any).expiry_date && (
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}</p>
                          <p className="text-foreground text-sm">{(newItem.extracted_data as any).expiry_date}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Warranty Period */}
                    {(newItem.extracted_data as any).warranty_period && (
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'مدة الضمان' : 'Warranty Period'}</p>
                        <p className="text-foreground text-sm">{(newItem.extracted_data as any).warranty_period}</p>
                      </div>
                    )}
                    
                    {/* Support Contact */}
                    {(newItem.extracted_data as any).support_contact && (
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'جهة الاتصال' : 'Support Contact'}</p>
                        <p className="text-foreground text-sm">{(newItem.extracted_data as any).support_contact}</p>
                      </div>
                    )}
                    
                    {/* Notes - This contains ALL the comprehensive details */}
                    {(newItem.extracted_data as any).notes && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-400 mb-2 font-medium">{isRTL ? 'التفاصيل الكاملة' : 'Complete Details'}</p>
                        <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{(newItem.extracted_data as any).notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Button - Only show if we have extracted data */}
      {!isAnalyzing && newItem.extracted_data && Object.keys(newItem.extracted_data).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe">
          <Button
            className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold py-3"
            onClick={async () => {
              await handleSave();
              // Clear form after successful save
              setNewItem({
                product_name: '',
                purchase_date: '',
                expiry_date: '',
                warranty_months: '',
                notes: '',
                provider: '',
                ref_number: '',
                support_contact: '',
                category_name: '',
                image_url: '',
                receipt_url: '',
                file_type: '',
                extracted_data: {},
                ai_summary: '',
              });
              setNewTagsInput('');
              // Reset file inputs
              if (cameraInputRef.current) cameraInputRef.current.value = '';
              if (fileInputRef.current) fileInputRef.current.value = '';
              // Go back to list
              setViewMode('list');
              // Refresh data
              fetchData();
            }}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {t.saveFile}
          </Button>
        </div>
      )}
    </div>
  );

  // Render Detail View
  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const timeRemaining = getTimeRemaining(selectedItem.expiry_date);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">{selectedItem.product_name}</h1>
          <Button variant="ghost" size="icon">
            <Edit2 className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
          {/* Document Preview - LARGE & PROMINENT */}
          <div className="w-full mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">{isRTL ? 'المستند' : 'Document'}</h4>
              {selectedItem.receipt_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(selectedItem.receipt_url, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  {isRTL ? 'فتح' : 'Open'}
                </Button>
              )}
            </div>
            <div className="w-full h-[400px] rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all"
              onClick={() => {
                const url = selectedItem.receipt_url || selectedItem.image_url;
                if (url) window.open(url, '_blank');
              }}
            >
              {(() => {
                const rawUrl = (selectedItem.receipt_url || selectedItem.image_url || '').trim();
                const isPdf = selectedItem.file_type === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf');
                
                if (rawUrl && !isPdf) {
                  return (
                    <img 
                      src={rawUrl} 
                      alt={selectedItem.product_name} 
                      className="w-full h-full object-contain bg-black/20" 
                    />
                  );
                } else if (isPdf) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-red-500/5">
                      <FileText className="w-24 h-24 text-red-400" />
                      <div className="text-center">
                        <p className="text-foreground font-medium text-lg">PDF Document</p>
                        <p className="text-sm text-muted-foreground mt-2">Tap to open full document</p>
                        <p className="text-xs text-blue-400 mt-1">✓ Saved & AI Analyzed</p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      <Shield className="w-20 h-20 text-foreground/20" />
                      <span className="text-sm text-muted-foreground">No document attached</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          {/* Progress Bar */}
          {timeRemaining && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${timeRemaining.textColor}`}>
                  {timeRemaining.text}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${timeRemaining.color} rounded-full transition-all`}
                  style={{ width: `${timeRemaining.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.provider}</p>
              <p className="font-medium truncate">{selectedItem.provider || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.refNumber}</p>
              <p className="font-medium truncate">{selectedItem.ref_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.purchaseDate}</p>
              <p className="font-medium">{selectedItem.purchase_date ? format(parseISO(selectedItem.purchase_date), 'MM/dd/yy') : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.expiryDate}</p>
              <p className="font-medium">{selectedItem.expiry_date ? format(parseISO(selectedItem.expiry_date), 'MM/dd/yy') : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.warrantyMonths}</p>
              <p className="font-medium">{selectedItem.warranty_months || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.supportContact}</p>
              <p className="font-medium truncate">{selectedItem.support_contact || '-'}</p>
            </div>
          </div>

          {/* Notes */}
          {selectedItem.notes && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-1">{t.notes}</p>
              <p className="text-sm">{selectedItem.notes}</p>
            </div>
          )}

          {/* Tags */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Tags</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentTags = getUserTags(selectedItem);
                  setDetailTagsInput(currentTags.join(', '));
                  setIsEditingTags(true);
                }}
              >
                Edit
              </Button>
            </div>

            {isEditingTags ? (
              <div className="space-y-2">
                <Input
                  value={detailTagsInput}
                  onChange={(e) => setDetailTagsInput(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsEditingTags(false);
                      setDetailTagsInput('');
                    }}
                  >
                    {t.cancel}
                  </Button>
                  <Button
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
                {getUserTags(selectedItem).length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  getUserTags(selectedItem).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-foreground/80">
                      {tag}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* AI Summary */}
          {selectedItem.ai_summary && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
              <h4 className="text-sm font-medium text-blue-400 mb-2">AI Summary</h4>
              <p className="text-sm text-muted-foreground">{selectedItem.ai_summary}</p>
            </div>
          )}

          {/* View Receipt Button */}
          {selectedItem.receipt_url && (
            <Button
              className="w-full mb-3 bg-gradient-to-r from-blue-500 to-cyan-500"
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
              <FileText className="w-4 h-4 mr-2" />
              {t.viewReceipt}
            </Button>
          )}

          {/* Ask Wakti Button */}
          <Button
            variant="outline"
            className="w-full mb-3"
            onClick={() => {
              setAskQuestion('');
              setAskMessages([]);
              setViewMode('ask');
            }}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            {t.askWakti}
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={() => handleDelete(selectedItem.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t.deleteItem}
          </Button>
        </div>
      </div>
    );
  };

  // Render Ask View (dedicated view for asking questions about a warranty)
  const renderAskView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setViewMode('detail')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t.askWakti}</h1>
          <p className="text-sm text-muted-foreground">{selectedItem?.product_name}</p>
        </div>
      </div>

      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
                <ul className="space-y-2">
                  <li>• {t.askExample1}</li>
                  <li>• {t.askExample2}</li>
                  <li>• {t.askExample3}</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                {askMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === 'user'
                        ? 'ml-auto max-w-[85%] rounded-2xl bg-blue-500/15 border border-blue-500/30 px-4 py-3 text-sm text-foreground'
                        : 'mr-auto max-w-[85%] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-foreground'
                    }
                  >
                    {message.content}
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
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500"
            onClick={handleAskWakti}
            disabled={isAsking || !askQuestion.trim()}
          >
            {isAsking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            {isAsking ? (isRTL ? 'جاري التحليل...' : 'Analyzing...') : t.send}
          </Button>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div
      className="h-full w-full bg-background"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      {viewMode === 'add' ? renderAddView() : viewMode === 'detail' ? renderDetailView() : viewMode === 'ask' ? renderAskView() : renderMainView()}

      {/* Center-bottom FAB (+) - Only show when on docs tab in warranties view */}
      {viewMode !== 'add' && viewMode !== 'detail' && viewMode !== 'ask' && mainTab === 'docs' && activeTab === 'warranties' && warranties.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50">
          <button
            type="button"
            onClick={() => setViewMode('add')}
            className="w-14 h-14 rounded-full btn-enhanced flex items-center justify-center active:scale-95 transition"
            aria-label={t.addNew}
          >
            <Plus className="w-7 h-7 text-white" />
          </button>
        </div>
      )}

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
                <img
                  src={documentToView.url}
                  alt="Document"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyWarranty;
