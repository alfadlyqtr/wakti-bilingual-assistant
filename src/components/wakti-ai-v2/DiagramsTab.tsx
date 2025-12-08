import React, { useState, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/client';
import { Download, Share2, FileText, Sparkles, Loader2, Wand2, Palette, Zap, Check, Image } from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MaxDiagrams = 1 | 2 | 3;

type KrokiStyleKey =
  | 'auto'
  // Common Graphs
  | 'block-diagram'
  | 'dag'
  | 'mindmap-style'
  // UML / C4
  | 'sequence-diagram'
  | 'er-diagram'
  | 'activity-diagram'
  | 'use-case'
  | 'uml-general'
  | 'c4-diagram'
  // Project Management
  | 'wbs'
  | 'gantt'
  | 'business-process'
  // Freestyle
  | 'hand-drawn'
  | 'ascii-art'
  // Hardware
  | 'byte-field'
  | 'digital-timing'
  // Network
  | 'network-diagram'
  | 'packets'
  | 'rack'
  // Data Visualization
  | 'word-cloud'
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
      { value: 'block-diagram', labelEn: 'Block diagram', labelAr: 'مخطط كتل' },
      { value: 'dag', labelEn: 'DAG', labelAr: 'رسم بياني موجه' },
      { value: 'mindmap-style', labelEn: 'Mindmap', labelAr: 'خريطة ذهنية' },
    ],
  },
  {
    key: 'uml',
    labelEn: 'UML / C4',
    labelAr: 'مخططات UML / C4',
    options: [
      { value: 'sequence-diagram', labelEn: 'Sequence', labelAr: 'تسلسل' },
      { value: 'er-diagram', labelEn: 'E‑R', labelAr: 'كيانات وعلاقات' },
      { value: 'activity-diagram', labelEn: 'Activity', labelAr: 'نشاط' },
      { value: 'use-case', labelEn: 'Use case', labelAr: 'حالة استخدام' },
      { value: 'uml-general', labelEn: 'UMLs', labelAr: 'مخططات UML' },
      { value: 'c4-diagram', labelEn: 'C4 diagram', labelAr: 'مخطط C4' },
    ],
  },
  {
    key: 'pm',
    labelEn: 'Project management',
    labelAr: 'إدارة المشاريع',
    options: [
      { value: 'wbs', labelEn: 'WBS', labelAr: 'هيكل تقسيم العمل' },
      { value: 'gantt', labelEn: 'Gantt', labelAr: 'مخطط جانت' },
      { value: 'business-process', labelEn: 'Business process', labelAr: 'عملية عمل' },
    ],
  },
  {
    key: 'freestyle',
    labelEn: 'Freestyle',
    labelAr: 'أسلوب حر',
    options: [
      { value: 'hand-drawn', labelEn: 'Hand‑drawn', labelAr: 'رسم يدوي' },
      { value: 'ascii-art', labelEn: 'Ascii art', labelAr: 'رسوم نصية' },
    ],
  },
  {
    key: 'hardware',
    labelEn: 'Hardware',
    labelAr: 'عتاد',
    options: [
      { value: 'byte-field', labelEn: 'Byte field', labelAr: 'مجال البايت' },
      { value: 'digital-timing', labelEn: 'Digital timing', labelAr: 'توقيت رقمي' },
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
      { value: 'word-cloud', labelEn: 'Word cloud', labelAr: 'سحابة كلمات' },
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
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // State
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [maxDiagrams, setMaxDiagrams] = useState<MaxDiagrams>(1);
  const [krokiStyle, setKrokiStyle] = useState<KrokiStyleKey>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<GeneratedDiagram[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // File handling
  // ─────────────────────────────────────────────────────────────────────────

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

  // Extract text from image using Vision AI (streaming response)
  const extractTextFromImage = async (file: File): Promise<string> => {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/png';
    
    // Get auth session for proper authorization
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Use fetch with proper CORS settings (same as WaktiAIV2Service)
    const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain-stream', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        message: 'Extract ALL text from this image. Return ONLY the extracted text, nothing else. If there is no text, describe what you see in the image briefly.',
        mode: 'vision',
        files: [{
          type: mimeType,
          data: base64,
          content: base64,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    // Read the streaming response and collect all text
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE format: data: {"token":"..."}\n\n
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            const parsed = JSON.parse(jsonStr);
            if (parsed.token) {
              fullText += parsed.token;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    return fullText.trim();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);
    setIsExtracting(true);

    try {
      let extractedText = '';

      // Handle different file types
      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        // Plain text files - read directly
        extractedText = await file.text();
      } else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
        // Images - use Vision AI to extract text
        toast.info(isArabic ? 'جاري استخراج النص من الصورة...' : 'Extracting text from image...', {
          duration: 2000,
        });
        extractedText = await extractTextFromImage(file);
      } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        // PDF/Word - show message to copy-paste
        toast.info(isArabic ? 'نوع ملف غير مدعوم للاستخراج التلقائي' : 'File type not supported for auto-extraction', {
          description: isArabic 
            ? 'الرجاء نسخ ولصق النص من الملف مباشرة' 
            : 'Please copy and paste the text from the file directly',
        });
        setIsExtracting(false);
        return;
      } else {
        toast.error(isArabic ? 'نوع ملف غير مدعوم' : 'Unsupported file type');
        setIsExtracting(false);
        return;
      }

      if (extractedText.trim()) {
        setFileContent(extractedText);
        setInputText((prev) => prev ? `${prev}\n\n${extractedText}` : extractedText);
        toast.success(isArabic ? 'تم استخراج النص' : 'Text extracted', {
          description: isArabic ? 'تم إضافة محتوى الملف إلى مربع النص' : 'File content added to text box',
        });
      } else {
        toast.warning(isArabic ? 'لم يتم العثور على نص' : 'No text found', {
          description: isArabic ? 'لم نتمكن من استخراج نص من هذا الملف' : 'Could not extract text from this file',
        });
      }
    } catch (err) {
      console.error('File extraction error:', err);
      toast.error(isArabic ? 'فشل استخراج النص' : 'Failed to extract text', {
        description: isArabic ? 'الرجاء المحاولة مرة أخرى أو نسخ النص يدوياً' : 'Please try again or copy the text manually',
      });
    } finally {
      setIsExtracting(false);
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
          krokiStyle: krokiStyle === 'auto' ? undefined : krokiStyle,
          userId: user?.id,
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate diagrams');
      }

      setDiagrams(response.diagrams || []);

      if (!response.diagrams || response.diagrams.length === 0) {
        setError(isArabic ? 'لم يتم إنشاء أي مخططات. حاول بنص مختلف.' : 'No diagrams were generated. Try different text.');
      }
    } catch (err: any) {
      console.error('Diagram generation error:', err);
      setError(err.message || (isArabic ? 'حدث خطأ أثناء إنشاء المخططات' : 'Error generating diagrams'));
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Download diagram
  // ─────────────────────────────────────────────────────────────────────────

  const handleDownload = async (diagram: GeneratedDiagram) => {
    const fileName = `${diagram.title.replace(/\s+/g, '_')}.svg`;
    
    try {
      // Method 1: Try direct fetch with CORS
      const response = await fetch(diagram.imageUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(isArabic ? 'تم التحميل' : 'Downloaded', {
        description: isArabic ? 'تم حفظ المخطط بنجاح' : 'Diagram saved successfully',
      });
    } catch (err) {
      console.error('Download error (trying fallback):', err);
      
      // Method 2: Try to render from diagramSource if available
      if (diagram.diagramSource) {
        try {
          // Find the SVG element in the DOM and extract it
          const imgElement = document.querySelector(`img[src="${diagram.imageUrl}"]`) as HTMLImageElement;
          if (imgElement) {
            // Create a canvas and draw the image
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth || 800;
            canvas.height = imgElement.naturalHeight || 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(imgElement, 0, 0);
              
              // Download as PNG
              canvas.toBlob((blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = fileName.replace('.svg', '.png');
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(isArabic ? 'تم التحميل' : 'Downloaded', {
                    description: isArabic ? 'تم حفظ المخطط كصورة PNG' : 'Diagram saved as PNG',
                  });
                  return;
                }
              }, 'image/png');
              return;
            }
          }
        } catch (canvasErr) {
          console.error('Canvas fallback failed:', canvasErr);
        }
      }
      
      // Method 3: Open in new tab as last resort
      window.open(diagram.imageUrl, '_blank');
      toast.info(isArabic ? 'افتح في نافذة جديدة' : 'Opened in new tab', {
        description: isArabic ? 'اضغط بزر الماوس الأيمن واختر حفظ' : 'Right-click and choose Save As',
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Copy link
  // ─────────────────────────────────────────────────────────────────────────

  const handleCopyLink = async (diagram: GeneratedDiagram) => {
    try {
      await navigator.clipboard.writeText(diagram.imageUrl);
      setCopiedId(diagram.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(isArabic ? 'تم النسخ' : 'Copied!', {
        description: isArabic ? 'تم نسخ الرابط إلى الحافظة' : 'Link copied to clipboard',
      });
    } catch (err) {
      console.error('Copy error:', err);
      // Fallback: show the URL in a prompt
      window.prompt(isArabic ? 'انسخ الرابط:' : 'Copy this link:', diagram.imageUrl);
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
            accept=".txt,.md,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.bmp,image/*"
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
              ? (isArabic ? 'جاري الاستخراج...' : 'Extracting...')
              : (isArabic ? 'أو ارفع ملف' : 'Or upload file')
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
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            {isArabic ? 'مخططاتك جاهزة!' : 'Your diagrams are ready!'}
          </h3>
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
                      <button
                        type="button"
                        onClick={() => handleCopyLink(diagram)}
                        className="p-2.5 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/50 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-800 transition-colors text-fuchsia-600 dark:text-fuchsia-400"
                        title={isArabic ? 'نسخ الرابط' : 'Copy Link'}
                      >
                        {copiedId === diagram.id ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5" />}
                      </button>
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
