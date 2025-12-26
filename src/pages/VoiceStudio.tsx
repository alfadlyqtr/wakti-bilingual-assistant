import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PenLine, Loader2, Copy } from 'lucide-react';
import { VoiceCloneScreen1 } from '@/components/wakti-ai-v2/VoiceCloneScreen1';
import { VoiceCloneScreen2 } from '@/components/wakti-ai-v2/VoiceCloneScreen2';
import { VoiceCloneScreen3 } from '@/components/wakti-ai-v2/VoiceCloneScreen3';
import { VoiceTTSScreen } from '@/components/wakti-ai-v2/VoiceTTSScreen';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import Tesseract from 'tesseract.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const TAB_MAP: Record<string, number> = {
  'tts': 4,
  'text-to-speech': 4,
  'clone': 2,
  'clone-my-voice': 2,
  'voice-translator': 3,
  'text-translator': 5,
};

export default function VoiceStudio() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentScreen, setCurrentScreen] = useState(0); // 0 = Welcome
  const [hasExistingVoices, setHasExistingVoices] = useState(false);
  const LANGS = [
    { code: 'en', nameEn: 'English', nameAr: 'الإنجليزية' },
    { code: 'ar', nameEn: 'Arabic', nameAr: 'العربية' },
    { code: 'es', nameEn: 'Spanish', nameAr: 'الإسبانية' },
    { code: 'fr', nameEn: 'French', nameAr: 'الفرنسية' },
    { code: 'de', nameEn: 'German', nameAr: 'الألمانية' },
    { code: 'it', nameEn: 'Italian', nameAr: 'الإيطالية' },
    { code: 'pt', nameEn: 'Portuguese', nameAr: 'البرتغالية' },
    { code: 'ru', nameEn: 'Russian', nameAr: 'الروسية' },
    { code: 'hi', nameEn: 'Hindi', nameAr: 'الهندية' },
    { code: 'bn', nameEn: 'Bengali', nameAr: 'البنغالية' },
    { code: 'zh', nameEn: 'Chinese', nameAr: 'الصينية' },
    { code: 'ja', nameEn: 'Japanese', nameAr: 'اليابانية' },
    { code: 'ko', nameEn: 'Korean', nameAr: 'الكورية' },
    { code: 'tr', nameEn: 'Turkish', nameAr: 'التركية' },
    { code: 'fa', nameEn: 'Persian (Farsi)', nameAr: 'الفارسية' },
    { code: 'ur', nameEn: 'Urdu', nameAr: 'الأردية' },
    { code: 'sv', nameEn: 'Swedish', nameAr: 'السويدية' },
    { code: 'no', nameEn: 'Norwegian', nameAr: 'النرويجية' },
    { code: 'da', nameEn: 'Danish', nameAr: 'الدنماركية' },
    { code: 'nl', nameEn: 'Dutch', nameAr: 'الهولندية' },
    { code: 'pl', nameEn: 'Polish', nameAr: 'البولندية' },
    { code: 'uk', nameEn: 'Ukrainian', nameAr: 'الأوكرانية' },
    { code: 'el', nameEn: 'Greek', nameAr: 'اليونانية' },
    { code: 'cs', nameEn: 'Czech', nameAr: 'التشيكية' },
    { code: 'sk', nameEn: 'Slovak', nameAr: 'السلوفاكية' },
    { code: 'ro', nameEn: 'Romanian', nameAr: 'الرومانية' },
    { code: 'hu', nameEn: 'Hungarian', nameAr: 'المجرية' },
    { code: 'id', nameEn: 'Indonesian', nameAr: 'الإندونيسية' },
    { code: 'ms', nameEn: 'Malaysian', nameAr: 'الماليزية' },
    { code: 'th', nameEn: 'Thai', nameAr: 'التايلاندية' },
    { code: 'vi', nameEn: 'Vietnamese', nameAr: 'الفيتنامية' },
    { code: 'he', nameEn: 'Hebrew', nameAr: 'العبرية' },
    { code: 'tl', nameEn: 'Filipino (Tagalog)', nameAr: 'الفلبينية (التاغالوغ)' },
  ];
  // Text translator states
  const [ttText, setTtText] = useState('');
  const [ttTarget, setTtTarget] = useState('ar');
  const [ttLoading, setTtLoading] = useState(false);
  const [ttResult, setTtResult] = useState('');
  const [ttSectionTab, setTtSectionTab] = useState<'input' | 'results' | 'my'>('input');
  const [ttActiveTab, setTtActiveTab] = useState<'text' | 'document'>('text');
  const [ttSelectedFile, setTtSelectedFile] = useState<File | null>(null);
  const [ttExtracting, setTtExtracting] = useState(false);
  const [ttExtractError, setTtExtractError] = useState<string>('');
  const [ttGeneratingDoc, setTtGeneratingDoc] = useState(false);
  const [ttDocError, setTtDocError] = useState<string>('');
  const [ttPreviewUrl, setTtPreviewUrl] = useState<string>('');
  const [ttTranslatedPdfUrl, setTtTranslatedPdfUrl] = useState<string>('');
  const [ttMyTranslations, setTtMyTranslations] = useState<Array<{
    id: string;
    created_at: string;
    source_filename: string | null;
    target_language: string;
    source_text_length: number | null;
    translated_text_length: number | null;
    translated_pdf_storage_path: string;
    preview_image_storage_path: string | null;
  }>>([]);
  const [ttMyTranslationsLoading, setTtMyTranslationsLoading] = useState(false);
  const [ttMyTranslationsError, setTtMyTranslationsError] = useState<string>('');
  const [ttSignedUrls, setTtSignedUrls] = useState<Record<string, { pdfUrl?: string; previewUrl?: string }>>({});
  const ttRenderRef = useRef<HTMLDivElement | null>(null);
  const TT_MAX = 2500;
  const TT_MAX_FILE_BYTES = 5 * 1024 * 1024;
  const TT_MAX_PDF_PAGES = 10;
  const [ttHistory, setTtHistory] = useState<{ target:string; sourceLen:number; preview:string; ts:number }[]>(() => {
    try {
      const raw = localStorage.getItem('wakti-tt-history');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const ttTargetLabel = useMemo(() => {
    const found = LANGS.find(l => l.code === ttTarget);
    if (!found) return ttTarget;
    return language === 'ar' ? found.nameAr : found.nameEn;
  }, [language, ttTarget]);

  const loadMyTranslations = async () => {
    if (!user?.id) return;
    setTtMyTranslationsLoading(true);
    setTtMyTranslationsError('');
    try {
      const { data, error } = await supabase
        .from('user_translations')
        .select('id, created_at, source_filename, target_language, source_text_length, translated_text_length, translated_pdf_storage_path, preview_image_storage_path')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTtMyTranslations((data || []) as any);
    } catch (e: any) {
      setTtMyTranslationsError(language === 'ar' ? 'حدث خطأ أثناء تحميل الترجمات' : 'Failed to load translations');
      console.error(e);
    } finally {
      setTtMyTranslationsLoading(false);
    }
  };

  const handleClearTextTranslate = () => {
    setTtText('');
    setTtResult('');
    setTtActiveTab('text');
    setTtSelectedFile(null);
    setTtExtracting(false);
    setTtExtractError('');
    setTtGeneratingDoc(false);
    setTtDocError('');
    setTtPreviewUrl('');
    setTtTranslatedPdfUrl('');
    setTtSectionTab('input');
  };

  const ensureSignedUrlsForRows = async (rows: Array<{ id: string; translated_pdf_storage_path: string; preview_image_storage_path: string | null }>) => {
    const missing = rows.filter((r) => {
      const existing = ttSignedUrls[r.id];
      const needsPdf = !existing?.pdfUrl;
      const needsPreview = !!r.preview_image_storage_path && !existing?.previewUrl;
      return needsPdf || needsPreview;
    });
    if (missing.length === 0) return;
    const updates: Record<string, { pdfUrl?: string; previewUrl?: string }> = { ...ttSignedUrls };
    await Promise.all(missing.map(async (row) => {
      try {
        const pdfRes = await supabase.storage.from('translations').createSignedUrl(row.translated_pdf_storage_path, 60 * 60);
        const pdfUrl = pdfRes.data?.signedUrl;
        let previewUrl: string | undefined = updates[row.id]?.previewUrl;
        if (row.preview_image_storage_path) {
          const prevRes = await supabase.storage.from('translations').createSignedUrl(row.preview_image_storage_path, 60 * 60);
          previewUrl = prevRes.data?.signedUrl;
        }
        updates[row.id] = { pdfUrl: pdfUrl || updates[row.id]?.pdfUrl, previewUrl };
      } catch (e) {
        console.error(e);
      }
    }));
    setTtSignedUrls(updates);
  };

  const readFileAsArrayBuffer = (file: File) => {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const buf = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    if (pdf.numPages > TT_MAX_PDF_PAGES) {
      throw new Error(language === 'ar' ? `الملف كبير جدًا (حد الصفحات ${TT_MAX_PDF_PAGES})` : `PDF too large (max ${TT_MAX_PDF_PAGES} pages)`);
    }
    const chunks: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = (content.items as any[])
        .map(it => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      chunks.push(line);
    }
    return chunks.join('\n\n').trim();
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const buf = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || '').trim();
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const res = await Tesseract.recognize(file, 'eng+ara');
    return (res.data?.text || '').trim();
  };

  const handleSelectFile = async (file: File | null) => {
    setTtExtractError('');
    setTtDocError('');
    setTtPreviewUrl('');
    setTtTranslatedPdfUrl('');
    setTtSelectedFile(file);
    if (!file) return;

    if (file.size > TT_MAX_FILE_BYTES) {
      setTtExtractError(language === 'ar' ? 'حجم الملف كبير جدًا (الحد 5MB)' : 'File too large (max 5MB)');
      setTtSelectedFile(null);
      return;
    }

    setTtExtracting(true);
    try {
      const mime = file.type || '';
      let extracted = '';
      if (mime.includes('application/pdf') || file.name.toLowerCase().endsWith('.pdf')) {
        extracted = await extractTextFromPDF(file);
      } else if (mime.includes('wordprocessingml.document') || file.name.toLowerCase().endsWith('.docx')) {
        extracted = await extractTextFromDOCX(file);
      } else if (mime.startsWith('image/')) {
        extracted = await extractTextFromImage(file);
      } else {
        throw new Error(language === 'ar' ? 'نوع الملف غير مدعوم' : 'Unsupported file type');
      }

      if (!extracted.trim()) {
        throw new Error(language === 'ar' ? 'لم يتم العثور على نص داخل الملف' : 'No text found in file');
      }

      setTtText(extracted.slice(0, TT_MAX));
    } catch (e: any) {
      setTtExtractError(e?.message || (language === 'ar' ? 'فشل استخراج النص' : 'Failed to extract text'));
      console.error(e);
    } finally {
      setTtExtracting(false);
    }
  };

  const renderTranslationCardHtml = (args: { title: string; subtitle: string; body: string; isRtl: boolean }) => {
    const fontFamily = args.isRtl
      ? "'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
      : "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const bodyEscaped = (args.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div style="
        width: 794px;
        padding: 18px;
        background: #ffffff;
        font-family: ${fontFamily};
        direction: ${args.isRtl ? 'rtl' : 'ltr'};
        text-align: ${args.isRtl ? 'right' : 'left'};
      ">
        <div style="
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          background: linear-gradient(135deg, #fcfefd 0%, hsl(200 15% 96%) 30%, #fcfefd 100%);
        ">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 12px;">
            <div>
              <div style="font-size:16px; font-weight:800; color:#060541; margin-bottom:4px;">${args.title}</div>
              <div style="font-size:12px; color:#475569;">${args.subtitle}</div>
            </div>
            <div style="font-size:12px; color:#94a3b8;">WAKTI</div>
          </div>
          <div style="height: 10px;"></div>
          <div style="
            white-space: pre-wrap;
            font-size: 13px;
            line-height: 1.7;
            color: #0f172a;
          ">${bodyEscaped}</div>
        </div>
      </div>
    `;
  };

  const generatePreviewAndPdf = async (translatedText: string) => {
    const isRtl = ttTarget === 'ar';
    const title = language === 'ar' ? 'ترجمة المستند' : 'Document Translation';
    const subtitle = `${language === 'ar' ? 'إلى' : 'To'} ${ttTargetLabel}`;
    const html = renderTranslationCardHtml({ title, subtitle, body: translatedText, isRtl });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.background = 'white';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      await (document as any).fonts?.ready;
      const cardEl = container.firstElementChild as HTMLElement;
      const canvas = await html2canvas(cardEl, { backgroundColor: 'white', scale: 2, useCORS: true, allowTaint: true, logging: false });
      const pngDataUrl = canvas.toDataURL('image/png');
      const previewBlob = await (await fetch(pngDataUrl)).blob();
      const previewObjectUrl = URL.createObjectURL(previewBlob);
      setTtPreviewUrl(previewObjectUrl);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (canvas.width * imgH) / canvas.height;
      }
      doc.addImage(pngDataUrl, 'PNG', margin, margin, imgW, imgH);
      const pdfBlob = doc.output('blob');
      const pdfObjectUrl = URL.createObjectURL(pdfBlob);
      setTtTranslatedPdfUrl(pdfObjectUrl);
      return { previewBlob, pdfBlob };
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container);
    }
  };

  const uploadAndSaveTranslation = async (translatedText: string) => {
    if (!user?.id) {
      throw new Error(language === 'ar' ? 'يجب تسجيل الدخول' : 'You must be logged in');
    }
    if (!ttSelectedFile) {
      throw new Error(language === 'ar' ? 'يرجى اختيار ملف' : 'Please select a file');
    }

    const { previewBlob, pdfBlob } = await generatePreviewAndPdf(translatedText);

    const id = crypto.randomUUID();
    const userId = user.id;
    const ext = (ttSelectedFile.name.split('.').pop() || '').toLowerCase();
    const safeExt = ext ? `.${ext}` : '';
    const sourcePath = `${userId}/${id}/source${safeExt}`;
    const pdfPath = `${userId}/${id}/translated.pdf`;
    const previewPath = `${userId}/${id}/preview.png`;

    const uploadSource = await supabase.storage.from('translations').upload(sourcePath, ttSelectedFile, {
      upsert: true,
      contentType: ttSelectedFile.type || undefined,
    });
    if (uploadSource.error) throw uploadSource.error;

    const uploadPdf = await supabase.storage.from('translations').upload(pdfPath, pdfBlob, {
      upsert: true,
      contentType: 'application/pdf',
    });
    if (uploadPdf.error) throw uploadPdf.error;

    const uploadPrev = await supabase.storage.from('translations').upload(previewPath, previewBlob, {
      upsert: true,
      contentType: 'image/png',
    });
    if (uploadPrev.error) throw uploadPrev.error;

    const { error: insertError } = await supabase
      .from('user_translations')
      .insert({
        user_id: userId,
        target_language: ttTarget,
        source_filename: ttSelectedFile.name,
        source_mime_type: ttSelectedFile.type || null,
        source_storage_path: sourcePath,
        source_text_length: ttText.trim().length,
        translated_text: translatedText,
        translated_text_length: translatedText.length,
        translated_pdf_storage_path: pdfPath,
        preview_image_storage_path: previewPath,
      });
    if (insertError) throw insertError;

    await loadMyTranslations();
    setTtActiveTab('document');
  };

  const doTextTranslate = async () => {
    if (!ttText.trim()) return;
    setTtLoading(true);
    setTtResult('');
    try {
      const { data: result, error } = await supabase.functions.invoke('voice-clone-translator', {
        body: { original_text: ttText.trim(), target_language: ttTarget }
      });
      if (error) throw new Error(error.message);
      if (!result || !result.success) throw new Error(result?.error || 'Translation failed');
      setTtResult(result.translated_text || '');
      setTtSectionTab('results');
      // update last-two history
      const item = { target: ttTarget, sourceLen: ttText.trim().length, preview: (result.translated_text || '').slice(0, 80), ts: Date.now() };
      const next = [item, ...ttHistory].slice(0, 6);
      setTtHistory(next);
      try { localStorage.setItem('wakti-tt-history', JSON.stringify(next)); } catch {}
    } catch (e:any) {
      setTtResult(language === 'ar' ? 'حدث خطأ في الترجمة' : 'Translation error');
      console.error(e);
    } finally {
      setTtLoading(false);
    }
  };

  useEffect(() => {
    // On page mount, mirror popup behavior: check if user already has voices
    checkExistingVoices();
    
    // Deep-link support: read ?tab= query param and open the correct tab
    const tabParam = searchParams.get('tab');
    if (tabParam && TAB_MAP[tabParam.toLowerCase()]) {
      setCurrentScreen(TAB_MAP[tabParam.toLowerCase()]);
    } else {
      setCurrentScreen(0);
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentScreen === 5) {
      loadMyTranslations();
    }
  }, [currentScreen, user?.id]);

  useEffect(() => {
    if (ttMyTranslations.length > 0) {
      ensureSignedUrlsForRows(ttMyTranslations.map(r => ({ id: r.id, translated_pdf_storage_path: r.translated_pdf_storage_path, preview_image_storage_path: r.preview_image_storage_path })));
    }
  }, [ttMyTranslations]);

  const checkExistingVoices = async () => {
    try {
      const { data, error } = await supabase
        .from('user_voice_clones')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error checking voices:', error);
        return;
      }

      setHasExistingVoices(!!(data && data.length > 0));
    } catch (error) {
      console.error('Error checking voices:', error);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 0:
        // Welcome screen
        return (
          <div className="w-full">
            <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-white/5 shadow-xl p-5 md:p-6">
              <div className="mb-2">
                <h2 className="text-xl md:text-2xl font-semibold">
                  {language === 'ar'
                    ? `مرحبًا${user?.user_metadata?.full_name ? `، ${user.user_metadata.full_name}` : ''}!`
                    : `Welcome${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!`}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ar'
                    ? 'هنا يمكنك تحويل النص إلى كلام، استنساخ صوتك، أو استخدام المترجم. اختر تبويبًا بالأعلى للبدء.'
                    : 'Here you can turn text into speech, clone your voice, or use the translator. Choose a tab above to get started.'}
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setCurrentScreen(4)}
                  aria-label={language === 'ar' ? 'افتح نص إلى كلام' : 'Open Text To Speech'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'نص → كلام' : 'Text To Speech'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'حوّل النص إلى صوت طبيعي بلغات متعددة. مثالي للرسائل، الملاحظات، والعروض.'
                      : 'Convert text into natural speech in many languages. Great for messages, notes, and presentations.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen(2)}
                  aria-label={language === 'ar' ? 'افتح استنساخ الصوت' : 'Open Clone My Voice'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'استنساخ الصوت' : 'Clone My Voice'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'أنشئ نسخة آمنة من صوتك لاستخدامها في القراءة أو الترجمة.'
                      : 'Create a safe clone of your voice to use for reading or translations.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen(3)}
                  aria-label={language === 'ar' ? 'افتح المترجم' : 'Open Translator'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'المترجم' : 'Translator'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'ترجم النصوص إلى +60 لغة واستمع إليها بصوت افتراضي أو بصوتك المستنسخ.'
                      : 'Translate text into 60+ languages and listen in a default or your cloned voice.'}
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      case 1:
        // Single-screen clone flow: render Screen2 directly
        return (
          <VoiceCloneScreen2
            onNext={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 2:
        return (
          <VoiceCloneScreen2
            onNext={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 3:
        return (
          <VoiceCloneScreen3
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 4:
        return (
          <VoiceTTSScreen
            onBack={() => setCurrentScreen(1)}
          />
        );
      case 5:
        return (
          <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-white/5 shadow-xl p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{language === 'ar' ? 'ترجمة نصية' : 'Text Translate'}</h2>
              <div className="text-xs text-muted-foreground">{ttText.length} / {TT_MAX}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'ترجمة النص - الأقسام' : 'Text Translate sections'}>
              <button
                type="button"
                onClick={() => setTtSectionTab('input')}
                role="tab"
                aria-selected={ttSectionTab === 'input'}
                className={`h-11 rounded-xl border text-sm font-medium transition-all
                  ${ttSectionTab === 'input'
                    ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                    : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
                `}
              >
                {language === 'ar' ? 'الإدخال' : 'Input'}
              </button>
              <button
                type="button"
                onClick={() => setTtSectionTab('results')}
                role="tab"
                aria-selected={ttSectionTab === 'results'}
                className={`h-11 rounded-xl border text-sm font-medium transition-all
                  ${ttSectionTab === 'results'
                    ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                    : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
                `}
              >
                {language === 'ar' ? 'النتائج' : 'Results'}
              </button>
              <button
                type="button"
                onClick={() => setTtSectionTab('my')}
                role="tab"
                aria-selected={ttSectionTab === 'my'}
                className={`h-11 rounded-xl border text-sm font-medium transition-all
                  ${ttSectionTab === 'my'
                    ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                    : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
                `}
              >
                {language === 'ar' ? 'ترجماتي' : 'My'}
              </button>
            </div>

            {ttSectionTab === 'input' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="tt-file">{language === 'ar' ? 'ارفع ملف (PDF / صورة / Word)' : 'Upload a file (PDF / Image / Word)'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="tt-file"
                      accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm"
                    />
                    {ttSelectedFile && (
                      <button
                        type="button"
                        onClick={() => handleSelectFile(null)}
                        className="h-10 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-sm"
                      >
                        {language === 'ar' ? 'إزالة' : 'Remove'}
                      </button>
                    )}
                  </div>
                  {ttSelectedFile && (
                    <div className="text-xs text-muted-foreground">
                      {ttSelectedFile.name} · {(ttSelectedFile.size / 1024).toFixed(0)} KB
                    </div>
                  )}
                  {ttExtracting && (
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {language === 'ar' ? 'جاري استخراج النص...' : 'Extracting text...'}
                    </div>
                  )}
                  {ttExtractError && (
                    <div className="text-xs text-red-600">{ttExtractError}</div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="tt-target">{language === 'ar' ? 'اللغة الهدف' : 'Translate to'}</label>
                    <select id="tt-target" value={ttTarget} onChange={(e)=>setTtTarget(e.target.value)} className="h-11 rounded-md border border-border bg-white/80 dark:bg-white/5 px-3">
                      {LANGS.map(l => (
                        <option key={l.code} value={l.code}>{language === 'ar' ? l.nameAr : l.nameEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium" htmlFor="tt-source-text">{language === 'ar' ? 'نص للترجمة' : 'Text to translate'}</label>
                    <button
                      type="button"
                      onClick={handleClearTextTranslate}
                      className="h-8 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-xs"
                    >
                      {language === 'ar' ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <textarea
                    id="tt-source-text"
                    value={ttText}
                    onChange={(e)=> setTtText(e.target.value.slice(0, TT_MAX))}
                    dir="auto"
                    placeholder={language === 'ar' ? 'ألصق النص هنا...' : 'Paste your text here...'}
                    className="w-full min-h-32 rounded-md border border-border bg-white/80 dark:bg-white/5 p-3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={doTextTranslate}
                    disabled={!ttText.trim() || ttLoading}
                    className="flex-1 h-12 rounded-xl border text-sm font-medium transition-all bg-gradient-to-r from-indigo-400 to-purple-400 text-white shadow-md disabled:opacity-60"
                  >
                    {ttLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <PenLine className="h-5 w-5 animate-spin" style={{ animationDuration: '800ms' }} />
                        {language === 'ar' ? 'جاري الترجمة النصية...' : 'Text translating...'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <PenLine className="h-5 w-5" />
                        {language === 'ar' ? 'ترجمة نصية' : 'Text Translate'}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={()=> ttResult && navigator.clipboard.writeText(ttResult)}
                    disabled={!ttResult}
                    className="h-10 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-sm flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" /> {language === 'ar' ? 'نسخ' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {ttSectionTab === 'results' && (
              <div className="space-y-3">
                {!ttResult && (
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'قم بالترجمة أولاً لرؤية النتائج' : 'Translate first to see results'}
                  </div>
                )}

                {ttResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'نتائج الترجمة' : 'Translation results'}>
                      <button
                        type="button"
                        onClick={() => setTtActiveTab('text')}
                        role="tab"
                        aria-selected={ttActiveTab === 'text'}
                        className={`h-11 rounded-xl border text-sm font-medium transition-all
                          ${ttActiveTab === 'text'
                            ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                            : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
                        `}
                      >
                        {language === 'ar' ? 'نص (سريع)' : 'Text (Fast)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTtActiveTab('document')}
                        role="tab"
                        aria-selected={ttActiveTab === 'document'}
                        className={`h-11 rounded-xl border text-sm font-medium transition-all
                          ${ttActiveTab === 'document'
                            ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                            : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
                        `}
                      >
                        {language === 'ar' ? 'مستند (يحافظ على الشكل)' : 'Document (Keep Layout)'}
                      </button>
                    </div>

                    {ttActiveTab === 'text' && (
                      <div className="relative">
                        <label className="text-sm font-medium mb-1 block" htmlFor="tt-result-text">{language === 'ar' ? 'النتيجة' : 'Result'}</label>
                        <textarea id="tt-result-text" readOnly value={ttResult} className="w-full min-h-32 rounded-md border border-border bg-white/80 dark:bg-white/5 p-3" />
                      </div>
                    )}

                    {ttActiveTab === 'document' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!ttResult.trim()) return;
                              setTtGeneratingDoc(true);
                              setTtDocError('');
                              try {
                                await uploadAndSaveTranslation(ttResult);
                                setTtSectionTab('my');
                              } catch (e: any) {
                                setTtDocError(e?.message || (language === 'ar' ? 'فشل إنشاء المستند' : 'Failed to generate document'));
                                console.error(e);
                              } finally {
                                setTtGeneratingDoc(false);
                              }
                            }}
                            disabled={ttGeneratingDoc || !ttSelectedFile || !ttResult.trim()}
                            className="flex-1 h-11 rounded-xl border text-sm font-medium transition-all bg-gradient-to-r from-indigo-400 to-purple-400 text-white shadow-md disabled:opacity-60"
                          >
                            {ttGeneratingDoc ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {language === 'ar' ? 'جاري إنشاء وحفظ PDF...' : 'Creating & saving PDF...'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <PenLine className="h-5 w-5" />
                                {language === 'ar' ? 'إنشاء PDF وحفظه' : 'Generate & Save PDF'}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!ttTranslatedPdfUrl) return;
                              const a = document.createElement('a');
                              a.href = ttTranslatedPdfUrl;
                              a.download = 'translation.pdf';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            disabled={!ttTranslatedPdfUrl}
                            className="h-11 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-sm"
                          >
                            {language === 'ar' ? 'تحميل' : 'Download'}
                          </button>
                        </div>
                        {ttDocError && (
                          <div className="text-xs text-red-600">{ttDocError}</div>
                        )}
                        {ttPreviewUrl && (
                          <div className="rounded-xl border border-border bg-white/80 dark:bg-white/5 p-2">
                            <div className="text-xs text-muted-foreground mb-2">{language === 'ar' ? 'معاينة صغيرة' : 'Small preview'}</div>
                            <img src={ttPreviewUrl} alt="preview" className="w-full rounded-lg border border-border/60" />
                          </div>
                        )}
                        <div ref={ttRenderRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {ttSectionTab === 'my' && (
              <div className="space-y-4">
                {ttHistory.length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">{language === 'ar' ? 'آخر النتائج' : 'Recent results'}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ttHistory.map((h, idx) => (
                        <div key={idx} className="p-2 border border-border rounded-md bg-white/70 dark:bg-white/5">
                          <div className="text-[11px] text-muted-foreground mb-1">{(language==='ar'?'إلى ':'to ')}{h.target} · {new Date(h.ts).toLocaleTimeString()}</div>
                          <div className="text-xs line-clamp-2">{h.preview}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-muted-foreground">{language === 'ar' ? 'ترجماتي' : 'My Translations'}</div>
                    <button
                      type="button"
                      onClick={loadMyTranslations}
                      className="h-8 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-xs"
                    >
                      {language === 'ar' ? 'تحديث' : 'Refresh'}
                    </button>
                  </div>
                  {ttMyTranslationsLoading ? (
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                    </div>
                  ) : ttMyTranslationsError ? (
                    <div className="text-xs text-red-600">{ttMyTranslationsError}</div>
                  ) : ttMyTranslations.length === 0 ? (
                    <div className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد ترجمات محفوظة بعد' : 'No saved translations yet'}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ttMyTranslations.map((row) => {
                        const urls = ttSignedUrls[row.id] || {};
                        const hasPreview = !!row.preview_image_storage_path;
                        return (
                          <div key={row.id} className="p-2 border border-border rounded-md bg-white/70 dark:bg-white/5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-medium line-clamp-1">{row.source_filename || (language === 'ar' ? 'ملف' : 'File')}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {new Date(row.created_at).toLocaleString()} · {language === 'ar' ? 'إلى' : 'to'} {row.target_language}
                                </div>
                              </div>
                              <a
                                href={urls.pdfUrl || '#'}
                                onClick={(e) => { if (!urls.pdfUrl) e.preventDefault(); }}
                                className="text-xs underline text-indigo-600"
                              >
                                {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                              </a>
                            </div>

                            {hasPreview && !urls.previewUrl && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await ensureSignedUrlsForRows([
                                      {
                                        id: row.id,
                                        translated_pdf_storage_path: row.translated_pdf_storage_path,
                                        preview_image_storage_path: row.preview_image_storage_path,
                                      },
                                    ]);
                                  }}
                                  className="h-8 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-xs"
                                >
                                  {language === 'ar' ? 'إصلاح المعاينة' : 'Fix preview'}
                                </button>
                              </div>
                            )}

                            {urls.previewUrl && (
                              <div className="mt-2">
                                <img src={urls.previewUrl} alt="preview" className="w-full rounded border border-border/60" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-3xl w-[92vw] md:w-[90vw] lg:w-auto pt-6 md:pt-8 pb-10 px-3 md:px-4">
        {/* Page header (icon removed per request) */}
        <div className="text-center mb-2 md:mb-3">
          <h1 className="text-2xl font-semibold">
            {language === 'ar' ? 'الصوت والمترجم' : 'Voice & Translator'}
          </h1>
        </div>

        {/* Top tabs under title */}
        <div className="mb-3">
          <div className="grid grid-cols-4 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            <button
              type="button"
              onClick={() => setCurrentScreen(4)}
              role="tab"
              aria-selected={currentScreen === 4}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 4
                  ? 'bg-gradient-secondary text-secondary-foreground shadow-lg border-secondary ring-1 ring-secondary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'نص → كلام' : 'Text To Speech'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(2)}
              role="tab"
              aria-selected={currentScreen === 1 || currentScreen === 2}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 1 || currentScreen === 2
                  ? 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'استنساخ الصوت' : 'Clone My Voice'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(3)}
              role="tab"
              aria-selected={currentScreen === 3}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 3
                  ? 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'المترجم الصوتي' : 'Voice translator'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(5)}
              role="tab"
              aria-selected={currentScreen === 5}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 5
                  ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'مترجم النص' : 'Text translator'}
            </button>
          </div>
        </div>

        {/* Subtitle removed */}

        {/* Page body mirrors the previous dialog content area */}
        <div>{renderScreen()}</div>
      </div>
    </div>
  );
}
