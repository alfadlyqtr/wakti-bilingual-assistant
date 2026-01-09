import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, Plus, SortAsc, Camera, Upload, X, 
  ChevronLeft, Trash2, FileText, MessageCircle, Calendar,
  Tag, Clock, CheckCircle, AlertTriangle, XCircle, Loader2,
  Edit2
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
    title: 'My Warranty',
    welcome: 'Welcome',
    youHave: 'you have',
    items: 'items',
    warrantiesTab: 'Warranties',
    askTab: 'Ask',
    filterAll: 'All',
    filterExpiring: 'Expiring',
    filterExpired: 'Expired',
    addNew: 'Add New',
    sort: 'Sort',
    expiredItems: 'Expired Items',
    willExpireOn: 'Will expire on',
    expiredOn: 'Expired on',
    monthsLeft: 'months left',
    daysLeft: 'days left',
    expired: 'Expired',
    analyzing: 'Analyzing document...',
    uploadFile: 'Upload File',
    takePhoto: 'Take Photo',
    productName: 'Product Name',
    purchaseDate: 'Purchase Date',
    warrantyMonths: 'Warranty Duration (months)',
    expiryDate: 'Expiry Date',
    coverage: 'Coverage',
    notes: 'Notes',
    viewReceipt: 'View Receipt',
    deleteItem: 'Delete Item',
    askWakti: 'Ask Wakti',
    provider: 'Provider',
    refNumber: 'Ref Number',
    supportContact: 'Support Contact',
    categoryLabel: 'Category',
    snapPhoto: 'Snap Photo',
    uploadDocument: 'Upload Document',
    extractedInfo: 'Extracted Info',
    aiSummary: 'AI Summary',
    askQuestion: 'Ask a question about this warranty...',
    send: 'Send',
    noItems: 'No warranties yet',
    addFirst: 'Add your first warranty',
    optional: 'Optional',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
  },
  ar: {
    title: 'ضماناتي',
    welcome: 'أهلاً',
    youHave: 'لديك',
    items: 'عناصر',
    warrantiesTab: 'الضمانات',
    askTab: 'اسأل',
    filterAll: 'الكل',
    filterExpiring: 'قريب الانتهاء',
    filterExpired: 'منتهي',
    addNew: 'إضافة جديد',
    sort: 'ترتيب',
    expiredItems: 'عناصر منتهية الصلاحية',
    willExpireOn: 'سينتهي في',
    expiredOn: 'انتهى في',
    monthsLeft: 'شهور متبقية',
    daysLeft: 'أيام متبقية',
    expired: 'منتهي',
    analyzing: 'جاري تحليل المستند...',
    uploadFile: 'رفع ملف',
    takePhoto: 'التقاط صورة',
    productName: 'اسم المنتج',
    purchaseDate: 'تاريخ الشراء',
    warrantyMonths: 'مدة الضمان (بالشهور)',
    expiryDate: 'تاريخ الانتهاء',
    coverage: 'التغطية',
    notes: 'ملاحظات',
    viewReceipt: 'عرض الإيصال',
    deleteItem: 'حذف',
    askWakti: 'اسأل وقتي',
    provider: 'المزود',
    refNumber: 'رقم المرجع',
    supportContact: 'جهة الاتصال',
    categoryLabel: 'الفئة',
    snapPhoto: 'التقاط صورة',
    uploadDocument: 'رفع مستند',
    extractedInfo: 'المعلومات المستخرجة',
    aiSummary: 'ملخص الذكاء الاصطناعي',
    askQuestion: 'اسأل سؤالاً عن هذا الضمان...',
    send: 'إرسال',
    noItems: 'لا توجد ضمانات بعد',
    addFirst: 'أضف أول ضمان لك',
    optional: 'اختياري',
    back: 'رجوع',
    save: 'حفظ',
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
  const [askAnswer, setAskAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

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

      // Upload to storage
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('warranty-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('warranty-docs')
        .getPublicUrl(fileName);

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
          image_url: isPdf ? '' : urlData.publicUrl,
          receipt_url: urlData.publicUrl,
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

  // Ask Wakti
  const handleAskWakti = async () => {
    if (!askQuestion.trim() || !selectedItem) return;

    setIsAsking(true);
    try {
      const context = JSON.stringify({
        product_name: selectedItem.product_name,
        purchase_date: selectedItem.purchase_date,
        expiry_date: selectedItem.expiry_date,
        warranty_months: selectedItem.warranty_months,
        notes: selectedItem.notes,
        ai_summary: selectedItem.ai_summary,
        extracted_data: selectedItem.extracted_data,
      });

      const { data, error } = await supabase.functions.invoke('my-warranty-ai', {
        body: {
          mode: 'qa',
          question: askQuestion,
          warrantyContext: context,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setAskAnswer(data.answer);
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

    return (
      <div
        key={item.id}
        onClick={() => {
          setSelectedItem(item);
          setViewMode('detail');
        }}
        className="enhanced-card p-4 mb-3 cursor-pointer active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(135deg, hsl(235, 25%, 12%) 0%, hsl(250, 20%, 14%) 100%)',
        }}
      >
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0">
            {item.image_url ? (
              <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white/80" />
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
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t.welcome}, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
              <br />
              {t.youHave} {warranties.length} {t.items}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <SortAsc className="w-5 h-5" />
          </Button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          <Button
            type="button"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="rounded-full h-9"
            onClick={() => setStatusFilter('all')}
          >
            {t.filterAll}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'expiring' ? 'default' : 'outline'}
            className="rounded-full h-9"
            onClick={() => setStatusFilter('expiring')}
          >
            {t.filterExpiring}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'expired' ? 'default' : 'outline'}
            className="rounded-full h-9"
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

      <div className="flex-1 overflow-y-auto px-4 pb-10">
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
              className="mt-6 w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition"
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

  const renderAskTab = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-bold text-foreground">{t.askWakti}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {selectedItem ? selectedItem.product_name : t.back}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {!selectedItem ? (
          <div className="space-y-3">
            {warranties.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedItem(w)}
                className="enhanced-card p-4 w-full text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{w.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.expiry_date ? format(parseISO(w.expiry_date), 'MM/dd/yy') : '-'}
                    </div>
                  </div>
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="enhanced-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-foreground truncate">{selectedItem.product_name}</div>
              <Button variant="ghost" size="sm" onClick={() => { setAskQuestion(''); setAskAnswer(''); setSelectedItem(null); }}>
                {t.back}
              </Button>
            </div>

            <Textarea
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              placeholder={t.askQuestion}
              className="min-h-[110px] bg-white/5 border-white/10"
            />

            <Button
              className="w-full mt-3"
              onClick={handleAskWakti}
              disabled={isAsking || !askQuestion.trim()}
            >
              {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : t.send}
            </Button>

            {askAnswer && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">{t.aiSummary}</div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{askAnswer}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'warranties' | 'ask')}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="warranties">{t.warrantiesTab}</TabsTrigger>
            <TabsTrigger value="ask">{t.askTab}</TabsTrigger>
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

  // Render Add View
  const renderAddView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={() => setViewMode('list')}>
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
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect(e, false)}
            />

            {/* Preview */}
            {(newItem.image_url || newItem.receipt_url) && (
              <div className="mb-6 relative">
                {newItem.file_type === 'pdf' ? (
                  <div className="w-full h-48 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-white/10 flex flex-col items-center justify-center gap-3">
                    <FileText className="w-16 h-16 text-red-400" />
                    <span className="text-sm text-muted-foreground">PDF Document</span>
                  </div>
                ) : (
                  <img 
                    src={newItem.image_url || newItem.receipt_url} 
                    alt="Receipt" 
                    className="w-full h-48 object-cover rounded-xl"
                  />
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setNewItem(prev => ({ ...prev, image_url: '', receipt_url: '', file_type: '' }))}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t.productName} *</label>
                <Input
                  value={newItem.product_name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, product_name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.provider}</label>
                  <Input
                    value={newItem.provider}
                    onChange={(e) => setNewItem(prev => ({ ...prev, provider: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.refNumber}</label>
                  <Input
                    value={newItem.ref_number}
                    onChange={(e) => setNewItem(prev => ({ ...prev, ref_number: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.purchaseDate}</label>
                  <Input
                    type="date"
                    value={newItem.purchase_date}
                    onChange={(e) => setNewItem(prev => ({ ...prev, purchase_date: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.expiryDate}</label>
                  <Input
                    type="date"
                    value={newItem.expiry_date}
                    onChange={(e) => setNewItem(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.warrantyMonths}</label>
                  <Input
                    type="number"
                    value={newItem.warranty_months}
                    onChange={(e) => setNewItem(prev => ({ ...prev, warranty_months: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t.supportContact}</label>
                  <Input
                    value={newItem.support_contact}
                    onChange={(e) => setNewItem(prev => ({ ...prev, support_contact: e.target.value }))}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t.notes} ({t.optional})</label>
                <Textarea
                  value={newItem.notes}
                  onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-white/5 border-white/10 min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Tags ({t.optional})</label>
                <Input
                  value={newTagsInput}
                  onChange={(e) => setNewTagsInput(e.target.value)}
                  placeholder="e.g. iPhone, TV, Car"
                  className="bg-white/5 border-white/10"
                />
                <div className="mt-2 flex gap-2 flex-wrap">
                  {newTagsInput
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-foreground/80">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>

              {/* AI Summary */}
              {newItem.ai_summary && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">AI Summary</h4>
                  <p className="text-sm text-muted-foreground">{newItem.ai_summary}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      {!isAnalyzing && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setViewMode('list')}
            >
              {t.cancel}
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
              onClick={handleSave}
              disabled={!newItem.product_name}
            >
              {t.save}
            </Button>
          </div>
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
          {/* Product Image */}
          <div className="w-full h-48 rounded-xl overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 mb-4">
            {selectedItem.image_url ? (
              <img src={selectedItem.image_url} alt={selectedItem.product_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shield className="w-16 h-16 text-white/80" />
              </div>
            )}
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
              onClick={() => window.open(selectedItem.receipt_url!, '_blank')}
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
              setAskAnswer('');
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

  // Main render
  return (
    <div
      className="h-full w-full bg-background"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      {viewMode === 'add' ? renderAddView() : viewMode === 'detail' ? renderDetailView() : renderMainView()}

      {/* Center-bottom FAB (+) - Only show when NOT in empty state or detail/add views */}
      {viewMode !== 'add' && viewMode !== 'detail' && activeTab === 'warranties' && warranties.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 z-50">
          <button
            type="button"
            onClick={() => setViewMode('add')}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition"
            aria-label={t.addNew}
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MyWarranty;
