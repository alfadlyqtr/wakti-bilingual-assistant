import React, { useState, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText, Sparkles, Loader2, Wand2, Palette, Zap, FilePlus2 } from 'lucide-react';
import ShareButton from '@/components/ui/ShareButton';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MaxDiagrams = 1 | 2 | 3;

// Only PNG-supported Kroki engines
type KrokiStyleKey =
  | 'auto'
  // Common Graphs (PNG supported)
  | 'block-diagram'
  | 'flowchart'
  | 'mindmap-style'
  // UML / C4 (PNG supported)
  | 'sequence-diagram'
  | 'er-diagram'
  | 'activity-diagram'
  | 'class-diagram'
  | 'c4-diagram'
  // Project Management (PNG supported)
  | 'gantt'
  // Network (PNG supported)
  | 'network-diagram'
  | 'packets'
  | 'rack'
  // Data Visualization (PNG supported)
  | 'bar-chart';

interface GeneratedDiagram {
  id: string;
  title: string;
  description: string;
  type: string;
  engine: string;
  imageUrl: string;
  diagramSource: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki style groups (all the pretty diagram types)
// ─────────────────────────────────────────────────────────────────────────────

// Only PNG-supported diagram styles
const KROKI_STYLE_GROUPS: {
  key: string;
  labelEn: string;
  labelAr: string;
  options: { value: KrokiStyleKey; labelEn: string; labelAr: string }[];
}[] = [
  {
    key: 'common',
    labelEn: 'Common graphs',
    labelAr: 'رسوم بيانية عامة',
    options: [
      { value: 'flowchart', labelEn: 'Flowchart', labelAr: 'مخطط تدفق' },
      { value: 'block-diagram', labelEn: 'Block diagram', labelAr: 'مخطط كتل' },
      { value: 'mindmap-style', labelEn: 'Mindmap', labelAr: 'خريطة ذهنية' },
    ],
  },
  {
    key: 'uml',
    labelEn: 'UML / C4',
    labelAr: 'مخططات UML / C4',
    options: [
      { value: 'sequence-diagram', labelEn: 'Sequence', labelAr: 'تسلسل' },
      { value: 'class-diagram', labelEn: 'Class diagram', labelAr: 'مخطط فئات' },
      { value: 'er-diagram', labelEn: 'E‑R', labelAr: 'كيانات وعلاقات' },
      { value: 'activity-diagram', labelEn: 'Activity', labelAr: 'نشاط' },
      { value: 'c4-diagram', labelEn: 'C4 diagram', labelAr: 'مخطط C4' },
    ],
  },
  {
    key: 'pm',
    labelEn: 'Project management',
    labelAr: 'إدارة المشاريع',
    options: [
      { value: 'gantt', labelEn: 'Gantt', labelAr: 'مخطط جانت' },
    ],
  },
  {
    key: 'network',
    labelEn: 'Network',
    labelAr: 'شبكات',
    options: [
      { value: 'network-diagram', labelEn: 'Network', labelAr: 'شبكة' },
      { value: 'packets', labelEn: 'Packets', labelAr: 'حزم' },
      { value: 'rack', labelEn: 'Rack', labelAr: 'رك' },
    ],
  },
  {
    key: 'dataviz',
    labelEn: 'Data visualization',
    labelAr: 'تصوير البيانات',
    options: [
      { value: 'bar-chart', labelEn: 'Bar chart', labelAr: 'مخطط أعمدة' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const DiagramsTab: React.FC = () => {
  const { language } = useTheme();
  const { user } = useAuth();
  const isArabic = language === 'ar';

  // State
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [maxDiagrams, setMaxDiagrams] = useState<MaxDiagrams>(1);
  const [krokiStyle, setKrokiStyle] = useState<KrokiStyleKey>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<GeneratedDiagram[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start new diagram - reset all state
  const handleStartNew = () => {
    setInputText('');
    setUploadedFile(null);
    setFileContent('');
    setMaxDiagrams(1);
    setKrokiStyle('auto');
    setDiagrams([]);
    setError(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // File handling - Text files read directly, images sent to backend for OCR
  // ─────────────────────────────────────────────────────────────────────────

  // State for extraction loading
  const [isExtracting, setIsExtracting] = useState(false);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Extract text from image using backend Vision API
  const extractTextFromImage = async (base64: string, mimeType: string): Promise<string> => {
    const response = await callEdgeFunctionWithRetry<{
      success: boolean;
      extractedText?: string;
      error?: string;
    }>('wakti-diagrams-v1', {
      body: {
        imageBase64: base64,
        imageMimeType: mimeType,
        extractOnly: true, // New flag to just extract text, not generate diagrams
        language: isArabic ? 'ar' : 'en',
      },
    });

    if (!response.success || !response.extractedText) {
      throw new Error(response.error || 'Failed to extract text');
    }

    return response.extractedText;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);

    // Text files - read directly
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const extractedText = await file.text();
      if (extractedText.trim()) {
        setFileContent(extractedText);
        setInputText((prev) => prev ? `${prev}\n\n${extractedText}` : extractedText);
        toast.success(isArabic ? 'تم استخراج النص' : 'Text extracted', {
          description: isArabic ? 'تم إضافة محتوى الملف إلى مربع النص' : 'File content added to text box',
        });
      }
    } 
    // Images - extract text immediately using Vision API
    else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i)) {
      setIsExtracting(true);
      toast.info(isArabic ? 'جاري استخراج النص...' : 'Extracting text...', { duration: 2000 });
      
      try {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/png';
        
        // Call backend to extract text
        const extractedText = await extractTextFromImage(base64, mimeType);
        
        if (extractedText.trim()) {
          setFileContent(extractedText);
          setInputText((prev) => prev ? `${prev}\n\n${extractedText}` : extractedText);
          toast.success(isArabic ? 'تم استخراج النص' : 'Text extracted', {
            description: isArabic ? 'تم إضافة النص المستخرج إلى مربع النص' : 'Extracted text added to text box',
          });
        } else {
          toast.warning(isArabic ? 'لم يتم العثور على نص' : 'No text found in image');
        }
      } catch (err) {
        console.error('Error extracting text from image:', err);
        toast.error(isArabic ? 'فشل استخراج النص' : 'Failed to extract text from image');
      } finally {
        setIsExtracting(false);
      }
    }
    // PDF/Word - not supported yet
    else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      toast.info(isArabic ? 'PDF/Word غير مدعوم حالياً' : 'PDF/Word not supported yet', {
        description: isArabic 
          ? 'الرجاء نسخ النص من الملف ولصقه مباشرة' 
          : 'Please copy text from the file and paste it directly',
      });
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    // Other files
    else {
      toast.error(isArabic ? 'نوع ملف غير مدعوم' : 'Unsupported file type');
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setFileContent('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Generate diagrams
  // ─────────────────────────────────────────────────────────────────────────

  const saveDiagramToDb = async (diagram: GeneratedDiagram) => {
    if (!user?.id) return null;
    try {
      // Extract raw storage path from signed URL
      // Format: .../storage/v1/object/sign/generated-files/{user_id}/diagrams/{file}?token=...
      let storagePath = diagram.imageUrl;
      const match = diagram.imageUrl.match(/\/generated-files\/([^?]+)/);
      if (match) storagePath = match[1];

      const { data, error } = await (supabase
        .from('user_diagrams' as any)
        .insert({
          user_id: user.id,
          storage_url: storagePath,
          name: diagram.title,
        })
        .select('id')
        .single() as any);
      if (error) throw error;
      return data?.id ?? null;
    } catch (err) {
      console.error('Failed to save diagram to DB:', err);
      return null;
    }
  };

  const handleGenerate = async () => {
    const textToUse = inputText.trim() || fileContent.trim();

    if (!textToUse) {
      setError(isArabic ? 'الرجاء إدخال نص أو رفع ملف' : 'Please enter text or upload a file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiagrams([]);

    try {
      const response = await callEdgeFunctionWithRetry<{
        success: boolean;
        error?: string;
        count?: number;
        diagrams?: GeneratedDiagram[];
      }>('wakti-diagrams-v1', {
        body: {
          inputText: textToUse,
          diagramFamily: 'auto',
          language: isArabic ? 'ar' : 'en',
          maxDiagrams,
          krokiStyle: krokiStyle, // Always send the style, backend handles 'auto'
          userId: user?.id,
        },
      });

      if (response.error === 'TRIAL_LIMIT_REACHED') {
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: 'diagrams' } }));
        setIsLoading(false);
        return;
      }
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate diagrams');
      }

      // Save diagrams to DB and add DB IDs
      const diagramsWithIds = await Promise.all(
        (response.diagrams || []).map(async (d) => {
          const dbId = await saveDiagramToDb(d);
          return { ...d, dbId };
        })
      );

      setDiagrams(diagramsWithIds as any);

      if (!response.diagrams || response.diagrams.length === 0) {
        setError(isArabic ? 'لم يتم إنشاء أي مخططات. حاول بنص مختلف.' : 'No diagrams were generated. Try different text.');
      }
    } catch (err: unknown) {
      console.error('Diagram generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage || (isArabic ? 'حدث خطأ أثناء إنشاء المخططات' : 'Error generating diagrams'));
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Download diagram (SVG directly from backend)
  // ─────────────────────────────────────────────────────────────────────────

  const handleDownload = async (diagram: GeneratedDiagram) => {
    const fileName = `${diagram.title.replace(/\s+/g, '_')}.svg`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    try {
      // Fetch the SVG directly from Supabase
      const response = await fetch(diagram.imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const svgBlob = await response.blob();

      // For iOS: Use Web Share API with SVG file
      if (isIOS) {
        const svgFile = new File([svgBlob], fileName, { type: 'image/svg+xml' });
        
        if (navigator.share && navigator.canShare?.({ files: [svgFile] })) {
          await navigator.share({
            files: [svgFile],
            title: diagram.title,
          });
          toast.success(isArabic ? 'تم المشاركة' : 'Shared!');
          return;
        }
        
        // iOS fallback: open SVG in new tab for long-press save
        const url = URL.createObjectURL(svgBlob);
        window.open(url, '_blank');
        toast.info(isArabic ? 'اضغط مطولاً للحفظ' : 'Long-press to save', {
          description: isArabic ? 'اضغط مطولاً على الصورة واختر حفظ' : 'Long-press the image and choose Save',
        });
        return;
      }
      
      // Desktop/Android: Download as SVG
      const url = URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(isArabic ? 'تم التحميل' : 'Downloaded', {
        description: isArabic ? 'تم حفظ المخطط كصورة SVG' : 'Diagram saved as SVG image',
      });
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: Open in new tab
      window.open(diagram.imageUrl, '_blank');
      toast.info(isArabic ? 'افتح في نافذة جديدة' : 'Opened in new tab', {
        description: isArabic ? 'اضغط مطولاً على الصورة للحفظ' : 'Long-press image to save',
      });
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 relative">
      {/* Animated background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-emerald-500/10 via-blue-500/10 to-purple-500/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header with gradient text */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
            <Wand2 className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">
            {isArabic ? 'مولد المخططات السحري' : 'Magic Diagram Studio'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isArabic
            ? 'حوّل أفكارك إلى مخططات مذهلة بضغطة زر واحدة ✨'
            : 'Turn your ideas into stunning diagrams with one click ✨'}
        </p>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Text Input with glow effect */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <div className="relative">
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              {isArabic ? 'أدخل فكرتك هنا' : 'Drop your idea here'}
            </label>
            <textarea
              className="w-full border-2 border-violet-200 dark:border-violet-800 rounded-xl p-4 min-h-[140px] resize-none bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all placeholder:text-muted-foreground/60"
              placeholder={isArabic
                ? '💡 اكتب ملخص اجتماع، فكرة مشروع، خطة عمل، جدول رمضان...'
                : '💡 Meeting notes, project plan, Ramadan schedule, business flow...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* File Upload - compact */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,image/*"
            onChange={handleFileChange}
            className="hidden"
            id="diagram-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-sm font-medium text-violet-600 dark:text-violet-400"
            disabled={isLoading || isExtracting}
          >
            {isExtracting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {isExtracting 
              ? (isArabic ? 'جاري استخراج النص...' : 'Extracting text...')
              : (isArabic ? 'أو ارفع ملف أو صورة' : 'Or upload file or image')
            }
          </button>
          {uploadedFile && (
            <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30">
              <span className="text-violet-700 dark:text-violet-300 font-medium">{uploadedFile.name}</span>
              <button
                type="button"
                onClick={clearFile}
                className="text-red-500 hover:text-red-600 font-medium"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Diagram Style Dropdown - THE MAIN SELECTOR */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2 flex items-center gap-2" htmlFor="kroki-style-select">
          <Palette className="w-4 h-4 text-fuchsia-500" />
          {isArabic ? 'اختر نمط المخطط' : 'Choose Diagram Style'}
        </label>
        <div className="relative">
          <select
            id="kroki-style-select"
            className="w-full appearance-none border-2 border-fuchsia-200 dark:border-fuchsia-800 rounded-xl px-4 py-3 text-sm bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all cursor-pointer font-medium"
            value={krokiStyle}
            onChange={(e) => setKrokiStyle(e.target.value as KrokiStyleKey)}
            disabled={isLoading}
          >
            <option value="auto">
              ✨ {isArabic ? 'تلقائي - دع الذكاء الاصطناعي يختار الأفضل' : 'Auto - Let AI pick the best style'}
            </option>
            {KROKI_STYLE_GROUPS.map((group) => (
              <optgroup key={group.key} label={isArabic ? group.labelAr : group.labelEn}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isArabic ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fuchsia-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <span>🎨</span>
          {isArabic
            ? '40+ نمط متاح: Gantt، C4، شبكات، مخططات بيانية، رسم يدوي...'
            : '40+ styles: Gantt, C4, Network, Charts, Hand-drawn & more!'}
        </p>
      </div>

      {/* Number of Diagrams - pill style */}
      <div>
        <label className="block text-sm font-medium mb-3">
          {isArabic ? 'كم مخطط تريد؟' : 'How many diagrams?'}
        </label>
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
          {([1, 2, 3] as MaxDiagrams[]).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setMaxDiagrams(num)}
              disabled={isLoading}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                maxDiagrams === num
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button - big and bold */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading || (!inputText.trim() && !fileContent.trim())}
        className="group relative w-full py-4 rounded-2xl font-bold text-lg text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-[length:200%_100%] animate-gradient" />
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Button content */}
        <span className="relative flex items-center justify-center gap-3">
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              {isArabic ? 'السحر يحدث الآن...' : 'Magic happening...'}
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
              {isArabic ? '✨ أنشئ المخططات' : '✨ Generate Diagrams'}
            </>
          )}
        </span>
      </button>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Results Gallery - with animations */}
      {diagrams.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              {isArabic ? 'مخططاتك جاهزة!' : 'Your diagrams are ready!'}
            </h3>
            {/* Start New button */}
            <button
              onClick={handleStartNew}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors text-sm"
              title={isArabic ? 'مخطط جديد' : 'New Diagram'}
            >
              <FilePlus2 className="w-4 h-4" />
              {isArabic ? 'جديد' : 'New'}
            </button>
          </div>
          <div className="grid gap-4">
            {diagrams.map((diagram, index) => (
              <div
                key={diagram.id}
                className="border-2 border-violet-200 dark:border-violet-800 rounded-2xl overflow-hidden bg-card shadow-lg hover:shadow-xl transition-all"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Diagram Preview */}
                <div className="p-6 bg-gradient-to-br from-white to-violet-50 dark:from-gray-900 dark:to-violet-950/20 flex items-center justify-center min-h-[250px]">
                  <img
                    src={diagram.imageUrl}
                    alt={diagram.title}
                    className="max-w-full max-h-[450px] object-contain drop-shadow-lg"
                  />
                </div>

                {/* Diagram Info & Actions */}
                <div className="p-4 border-t-2 border-violet-100 dark:border-violet-900 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg">{diagram.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {diagram.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium">
                          {diagram.type}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {diagram.engine}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(diagram)}
                        className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/50 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors text-violet-600 dark:text-violet-400"
                        title={isArabic ? 'تحميل' : 'Download'}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <ShareButton
                        shareUrl={diagram.imageUrl}
                        shareTitle={diagram.title}
                        shareDescription={diagram.description}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS for gradient animation */}
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default DiagramsTab;
