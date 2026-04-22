import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { Loader2, Presentation, Download, Trash2, LayoutDashboard, Eye, FileText, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ShareButton from '@/components/ui/ShareButton';
import { downloadA4RowsAsJpgs, downloadA4RowsAsPdf, fetchA4History, type A4HistoryBatch } from './a4/a4Service';

interface SavedPresentation {
  id: string;
  title: string;
  share_url: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SavedDiagram {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

const SAVED_TEXTS_KEY = 'wakti_saved_texts_v1';

interface SavedText {
  id: string;
  text: string;
  savedAt: string;
}

export default function SavedItemsTab() {
  const { user } = useAuth();
  const { language } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'text' | 'presentations' | 'diagrams' | 'a4'>('text');
  
  const [presentations, setPresentations] = useState<SavedPresentation[]>([]);
  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [a4Documents, setA4Documents] = useState<A4HistoryBatch[]>([]);
  const [savedTexts, setSavedTexts] = useState<SavedText[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; itemId?: string; itemName?: string; type?: 'presentation' | 'diagram' | 'text' }>({ isOpen: false });

  useEffect(() => {
    loadSavedTexts();
    if (user?.id) {
      if (activeTab === 'presentations') {
        loadPresentations();
      } else if (activeTab === 'diagrams') {
        loadDiagrams();
      } else if (activeTab === 'a4') {
        loadA4Documents();
      }
    }
  }, [user?.id, activeTab]);

  const loadSavedTexts = () => {
    try {
      const raw = localStorage.getItem(SAVED_TEXTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSavedTexts(arr);
      }
    } catch { }
  };

  const handleCopyText = async (item: SavedText) => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { toast.error(language === 'ar' ? 'فشل النسخ' : 'Copy failed'); }
  };

  const deleteText = (id: string) => {
    try {
      const raw = localStorage.getItem(SAVED_TEXTS_KEY);
      const existing: SavedText[] = raw ? JSON.parse(raw) : [];
      const next = existing.filter(t => t.id !== id);
      localStorage.setItem(SAVED_TEXTS_KEY, JSON.stringify(next));
      setSavedTexts(next);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch { }
  };

  const loadPresentations = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_presentations')
        .select('id, title, share_url, thumbnail_url, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPresentations(data || []);
    } catch (err) {
      console.error('Error loading presentations:', err);
      toast.error(language === 'ar' ? 'فشل تحميل العروض' : 'Failed to load presentations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadA4Documents = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchA4History();
      setA4Documents(data);
    } catch (err) {
      console.error('Error loading A4 documents:', err);
      toast.error(language === 'ar' ? 'فشل تحميل مستندات A4' : 'Failed to load A4 documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadA4Pdf = async (item: A4HistoryBatch) => {
    try {
      toast.info(language === 'ar' ? 'جاري إنشاء الملف…' : 'Building PDF…');
      await downloadA4RowsAsPdf(item.rows, item.title ?? 'wakti-a4');
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل تنزيل PDF' : 'Failed to download PDF');
    }
  };

  const handleDownloadA4Photos = async (item: A4HistoryBatch) => {
    try {
      toast.info(language === 'ar' ? 'جاري تجهيز الصور…' : 'Preparing photo download…');
      await downloadA4RowsAsJpgs(item.rows, item.title ?? 'wakti-a4');
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل تنزيل الصور' : 'Failed to download photos');
    }
  };

  const getA4StatusLabel = (status: A4HistoryBatch['status']) => {
    if (language === 'ar') {
      if (status === 'completed') return 'مكتمل';
      if (status === 'partial') return 'مكتمل جزئياً';
      if (status === 'failed') return 'فشل';
      return 'قيد المعالجة';
    }
    if (status === 'completed') return 'Completed';
    if (status === 'partial') return 'Partial';
    if (status === 'failed') return 'Failed';
    return 'Generating';
  };

  const getA4StatusClass = (status: A4HistoryBatch['status']) => {
    if (status === 'completed') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (status === 'partial') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (status === 'failed') return 'bg-red-500/10 text-red-700 dark:text-red-300';
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  };

  const loadDiagrams = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('user_diagrams' as any)
        .select('id, storage_url, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any);

      if (error) {
        console.error('DB query error for user_diagrams:', error);
        throw error;
      }

      console.log('[SavedItemsTab] user_diagrams from DB:', data?.length ?? 0);

      if (!data || !Array.isArray(data) || data.length === 0) {
        setDiagrams([]);
        return;
      }

      // Generate signed URLs for raw storage paths
      const pathsToSign = data
        .filter((d: any) => d.storage_url && !d.storage_url.startsWith('http'))
        .map((d: any) => d.storage_url);

      let signedMap: Record<string, string> = {};
      if (pathsToSign.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('generated-files')
          .createSignedUrls(pathsToSign, 86400 * 7);
        if (signedUrls) {
          signedUrls.forEach((s: any, i: number) => {
            if (s.signedUrl) signedMap[pathsToSign[i]] = s.signedUrl;
          });
        }
      }

      const mapped: SavedDiagram[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        url: d.storage_url.startsWith('http') ? d.storage_url : (signedMap[d.storage_url] || '')
      }));

      setDiagrams(mapped);
    } catch (err) {
      console.error('Error loading diagrams:', err);
      toast.error(language === 'ar' ? 'فشل تحميل المخططات' : 'Failed to load diagrams');
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteConfirm = (itemId: string, itemName: string, type: 'presentation' | 'diagram') => {
    setConfirmDialog({ isOpen: true, itemId, itemName, type });
  };

  const handleConfirmDelete = async () => {
    const { itemId, type } = confirmDialog;
    if (!itemId || !type || !user?.id) return;

    try {
      if (type === 'presentation') {
        const { error } = await supabase.from('user_presentations').delete().eq('id', itemId).eq('user_id', user.id);
        if (error) throw error;
        setPresentations(prev => prev.filter(p => p.id !== itemId));
      } else {
        const { error } = await supabase.storage.from('generated-files').remove([`${user.id}/diagrams/${itemId}`]);
        if (error) throw error;
        setDiagrams(prev => prev.filter(d => d.name !== itemId));
      }
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Failed to delete');
    } finally {
      setConfirmDialog({ isOpen: false });
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false });
  };

  return (
    <div className="w-full space-y-4">
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex bg-muted/50 p-1 rounded-lg w-max min-w-full">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'text' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            {language === 'ar' ? 'النصوص' : 'Text'}
          </button>
          <button
            onClick={() => setActiveTab('presentations')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'presentations' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            {language === 'ar' ? 'العروض' : 'Presentations'}
          </button>
          <button
            onClick={() => setActiveTab('diagrams')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'diagrams' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            {language === 'ar' ? 'المخططات' : 'Diagrams'}
          </button>
          <button
            onClick={() => setActiveTab('a4')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'a4' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            {language === 'ar' ? 'مستندات A4' : 'A4 Documents'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : activeTab === 'text' ? (
        <div className="space-y-3">
          {savedTexts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد نصوص محفوظة' : 'No saved texts yet'}
            </div>
          ) : (
            savedTexts.map((item) => (
              <div key={item.id} className="border rounded-xl p-4 bg-card hover:shadow-md transition-all">
                <p className="text-sm whitespace-pre-wrap line-clamp-4 text-foreground mb-3">{item.text}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.savedAt).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => handleCopyText(item)}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'نسخ' : 'Copy'}
                    >
                      {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === item.id ? (language === 'ar' ? 'تم!' : 'Done!') : (language === 'ar' ? 'نسخ' : 'Copy')}
                    </button>
                    <ShareButton
                      shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}`}
                      shareTitle={language === 'ar' ? 'نص محفوظ' : 'Saved Text'}
                      shareDescription={item.text.substring(0, 100)}
                      size="sm"
                      className="!w-7 !h-7 !p-1.5"
                    />
                    <button
                      onClick={() => deleteText(item.id)}
                      className="text-xs flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'presentations' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {presentations.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد عروض محفوظة' : 'No saved presentations'}
            </div>
          ) : (
            presentations.map((p) => (
              <div key={p.id} className="border rounded-xl p-3 flex gap-3 bg-card hover:shadow-md transition-all">
                <div className="w-24 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative border">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Presentation className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <h4 className="font-semibold text-sm truncate" title={p.title}>{p.title}</h4>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <a 
                      href={`https://wakti.qa/presentation/${p.id}`}
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'عرض العرض التقديمي' : 'View presentation'}
                    >
                      <Eye className="w-3 h-3" />
                      {language === 'ar' ? 'عرض' : 'View'}
                    </a>
                    {p.share_url && (
                      <ShareButton
                        shareUrl={`https://wakti.qa/presentation/${p.id}`}
                        shareTitle={p.title}
                        shareDescription={language === 'ar' ? 'عرض تقديمي من Wakti' : 'A presentation from Wakti'}
                        size="sm"
                        className="!w-7 !h-7 !p-1.5"
                      />
                    )}
                    <button 
                      onClick={() => openDeleteConfirm(p.id, p.title, 'presentation')}
                      className="text-xs flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded ml-auto"
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'diagrams' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {diagrams.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد مخططات محفوظة' : 'No saved diagrams'}
            </div>
          ) : (
            diagrams.map((d) => (
              <div key={d.name} className="border rounded-xl p-3 flex flex-col gap-3 bg-card hover:shadow-md transition-all">
                <div className="w-full h-32 bg-white rounded-lg overflow-hidden relative border flex items-center justify-center p-2">
                  <img src={d.url} alt={d.name} className="max-w-full max-h-full object-contain drop-shadow-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`https://wakti.qa/diagram/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'عرض المخطط' : 'View diagram'}
                    >
                      <Eye className="w-3 h-3" />
                      {language === 'ar' ? 'عرض' : 'View'}
                    </a>
                    <a 
                      href={d.url} 
                      target="_blank" 
                      rel="noreferrer"
                      download={d.name}
                      className="text-xs flex items-center gap-1 text-violet-600 hover:text-violet-800 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'تحميل المخطط' : 'Download diagram'}
                    >
                      <Download className="w-3 h-3" />
                      {language === 'ar' ? 'تحميل' : 'Download'}
                    </a>
                    <ShareButton
                      shareUrl={`https://wakti.qa/diagram/${d.id}`}
                      shareTitle={d.name.replace(/\.[^.]+$/, '')}
                      shareDescription={language === 'ar' ? 'مخطط من Wakti' : 'A diagram from Wakti'}
                      size="sm"
                      className="!w-7 !h-7 !p-1.5"
                    />
                    <button 
                      onClick={() => openDeleteConfirm(d.name, d.name, 'diagram')}
                      className="text-xs flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {a4Documents.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد مستندات A4 محفوظة' : 'No saved A4 documents'}
            </div>
          ) : (
            a4Documents.map((item) => (
              <div key={item.batch_id} className="border rounded-xl p-3 flex flex-col gap-3 bg-card hover:shadow-md transition-all">
                <div className="w-full aspect-[3/4] bg-muted/30 rounded-lg overflow-hidden border flex items-center justify-center">
                  {item.preview_image_url ? (
                    <img src={item.preview_image_url} alt={item.title ?? 'A4 Document'} className="w-full h-full object-contain bg-white" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs">{language === 'ar' ? 'لا توجد معاينة' : 'No preview'}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate" title={item.title ?? undefined}>
                        {item.title || (language === 'ar' ? 'مستند A4' : 'A4 Document')}
                      </h4>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(item.updated_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${getA4StatusClass(item.status)}`}>
                      {getA4StatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {language === 'ar'
                      ? `${item.completed_pages} من ${item.total_pages} صفحة مكتملة`
                      : `${item.completed_pages} of ${item.total_pages} pages completed`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDownloadA4Pdf(item)}
                      className="text-xs flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:opacity-90"
                      title={language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                    >
                      <Download className="w-3 h-3" />
                      {language === 'ar' ? 'PDF' : 'PDF'}
                    </button>
                    <button
                      onClick={() => handleDownloadA4Photos(item)}
                      className="text-xs flex items-center gap-1 border border-primary/30 bg-primary/10 text-primary px-2.5 py-1.5 rounded-md hover:bg-primary/15"
                      title={language === 'ar' ? 'تنزيل الصور' : 'Download photos'}
                    >
                      <ImageIcon className="w-3 h-3" />
                      {language === 'ar' ? 'صورة' : 'Photo'}
                    </button>
                    {item.preview_image_url && (
                      <a
                        href={item.preview_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-md"
                        title={language === 'ar' ? 'عرض المعاينة' : 'View preview'}
                      >
                        <Eye className="w-3 h-3" />
                        {language === 'ar' ? 'عرض' : 'View'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl shadow-2xl p-6 max-w-sm mx-4 animate-in fade-in scale-95">
            <h3 className="text-lg font-semibold mb-2">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ar'
                ? `هل أنت متأكد من حذف "${confirmDialog.itemName}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${confirmDialog.itemName}"? This action cannot be undone.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium"
              >
                {language === 'ar' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
