import { useState, useRef, useEffect } from 'react';
import { Save, Loader2, Plus, Trash2, Upload, FileText, MessageSquare, Type, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import mammoth from 'mammoth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Types ────────────────────────────────────────────────────────────────────
interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  botId: string;
  isRTL: boolean;
}

type KBTab = 'type' | 'faqs' | 'pdf';

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FAQItem({
  faq, index, onChange, onDelete, isRTL, forceCollapsed,
}: {
  faq: FAQ; index: number;
  onChange: (id: string, field: 'question' | 'answer', val: string) => void;
  onDelete: (id: string) => void;
  isRTL: boolean;
  forceCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => { if (forceCollapsed) setOpen(false); }, [forceCollapsed]);
  return (
    <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
        <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">#{index + 1}</span>
        <input
          value={faq.question}
          onChange={e => onChange(faq.id, 'question', e.target.value)}
          placeholder={isRTL ? 'السؤال *' : 'Question *'}
          className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button onClick={() => setOpen(o => !o)} className="p-1 rounded-lg hover:bg-muted transition-colors">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        <button onClick={() => onDelete(faq.id)} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>
      {open && (
        <textarea
          value={faq.answer}
          onChange={e => onChange(faq.id, 'answer', e.target.value)}
          placeholder={isRTL ? 'الإجابة *' : 'Answer *'}
          rows={3}
          className="w-full px-3 py-2.5 text-sm bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground/60 border-t border-border/30"
        />
      )}
    </div>
  );
}

// ─── Supabase save helper ──────────────────────────────────────────────────────
async function saveToDB(botId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('chatbot_bots').update(patch).eq('id', botId);
  if (error) throw error;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function KnowledgeBaseEditor({ botId, isRTL }: Props) {
  const [tab, setTab] = useState<KBTab>('type');
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [collapsedAll, setCollapsedAll] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [savingType, setSavingType] = useState(false);
  const [savingFAQs, setSavingFAQs] = useState(false);
  const [savingPDF, setSavingPDF] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [pdfText, setPdfText] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faqFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!botId) return;
    supabase.from('chatbot_bots').select('knowledge_base, faqs').eq('id', botId).single()
      .then(({ data }) => {
        if (data) {
          setTypeText(data.knowledge_base || '');
          setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
        }
        setLoading(false);
      });
  }, [botId]);

  // ── Type helpers ─────────────────────────────────────────────────────────────
  const saveType = async () => {
    setSavingType(true);
    try {
      await saveToDB(botId, { knowledge_base: typeText });
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!');
    } catch { toast.error(isRTL ? 'فشل الحفظ' : 'Save failed'); }
    finally { setSavingType(false); }
  };

  const generateWithAI = async () => {
    if (!typeText.trim()) { toast.error(isRTL ? 'اكتب شيئاً أولاً' : 'Type something first'); return; }
    setGenerating(true);
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY || ''}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [
          { role: 'system', content: 'Expand and enrich the following business knowledge base for a customer service chatbot. Return only the improved text.' },
          { role: 'user', content: typeText },
        ], max_tokens: 800, temperature: 0.7 }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const generated = data.choices?.[0]?.message?.content || '';
      if (generated) { setTypeText(generated); toast.success(isRTL ? 'تم التوليد!' : 'Generated!'); }
    } catch { toast.error(isRTL ? 'فشل التوليد' : 'Generation failed — check DeepSeek API key'); }
    finally { setGenerating(false); }
  };

  // ── FAQ helpers ──────────────────────────────────────────────────────────────
  const addFAQ = () => {
    setCollapsedAll(false);
    setFaqs(prev => [...prev, { id: crypto.randomUUID(), question: '', answer: '' }]);
  };

  const updateFAQ = (id: string, field: 'question' | 'answer', val: string) => {
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, [field]: val } : f));
  };

  const deleteFAQ = async (id: string) => {
    const updated = faqs.filter(f => f.id !== id);
    setFaqs(updated);
    try { await saveToDB(botId, { faqs: updated }); }
    catch { toast.error(isRTL ? 'فشل الحذف' : 'Delete failed'); }
  };

  const saveFAQs = async () => {
    const valid = faqs.filter(f => f.question.trim() && f.answer.trim());
    if (valid.length === 0) { toast.error(isRTL ? 'أضف سؤالاً وإجابة على الأقل' : 'Add at least one Q&A pair'); return; }
    setSavingFAQs(true);
    try {
      await saveToDB(botId, { faqs: valid });
      setFaqs(valid);
      setCollapsedAll(true);
      toast.success(isRTL ? 'تم حفظ الأسئلة!' : 'FAQs saved!');
    } catch { toast.error(isRTL ? 'فشل الحفظ' : 'Save failed'); }
    finally { setSavingFAQs(false); }
  };

  // ── FAQ CSV upload ────────────────────────────────────────────────────────────
  const handleFAQFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      // Simple CSV parse: Q,A per line
      const lines = text.split('\n').filter(l => l.trim());
      const parsed: FAQ[] = lines.map(line => {
        const [q, ...rest] = line.split(',');
        return { id: crypto.randomUUID(), question: q?.trim() || '', answer: rest.join(',').trim() };
      }).filter(f => f.question && f.answer);
      if (parsed.length > 0) {
        setFaqs(prev => [...prev, ...parsed]);
        toast.success(isRTL ? `تم استيراد ${parsed.length} سؤال` : `Imported ${parsed.length} FAQs`);
      } else {
        toast.error(isRTL ? 'تعذر قراءة الملف' : 'Could not parse file. Use CSV format: Question,Answer');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── File extraction (PDF, DOCX, TXT) ──────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDOCX = file.type.includes('wordprocessingml.document') || file.name.toLowerCase().endsWith('.docx');
    const isTXT = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    
    if (!isPDF && !isDOCX && !isTXT) {
      toast.error(isRTL ? 'يرجى رفع ملف PDF أو Word أو نص' : 'Please upload PDF, Word, or text file');
      return;
    }
    
    setPdfName(file.name);
    setExtracting(true);
    
    try {
      let extracted = '';
      
      if (isPDF) {
        // PDF extraction via pdfjs-dist
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(file);
        });
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const chunks: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const line = (content.items as any[]).map((it) => (typeof it.str === 'string' ? it.str : '')).join(' ');
          chunks.push(line);
        }
        extracted = chunks.join('\n\n').trim();
      } else if (isDOCX) {
        // Word extraction via mammoth
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(file);
        });
        const result = await mammoth.extractRawText({ arrayBuffer });
        extracted = (result.value || '').trim();
      } else if (isTXT) {
        // Text file extraction
        extracted = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });
        extracted = extracted.trim();
      }
      
      if (extracted.length > 10) {
        setPdfText(extracted.slice(0, 8000));
        toast.success(isRTL ? 'تم استخراج النص بنجاح' : 'Text extracted successfully');
      } else {
        setPdfText(`[${file.name}] - Content uploaded for AI training.`);
        toast.info(isRTL ? 'تم رفع الملف (لا يوجد نص قابل للاستخراج)' : 'File uploaded (no extractable text)');
      }
    } catch {
      toast.error(isRTL ? 'فشل استخراج النص' : 'Failed to extract text');
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  const savePDF = async () => {
    if (!pdfText.trim()) { toast.error(isRTL ? 'ارفع ملف PDF أولاً' : 'Upload a PDF first'); return; }
    setSavingPDF(true);
    try {
      const combined = typeText ? typeText + '\n\n' + pdfText : pdfText;
      await saveToDB(botId, { knowledge_base: combined });
      setTypeText(combined);
      setPdfText(''); setPdfName('');
      toast.success(isRTL ? 'تم الحفظ في قاعدة المعرفة!' : 'Saved to Knowledge Base!');
    } catch { toast.error(isRTL ? 'فشل الحفظ' : 'Save failed'); }
    finally { setSavingPDF(false); }
  };

  const TABS: { id: KBTab; icon: React.ReactNode; label: string; labelAr: string }[] = [
    { id: 'type',  icon: <Type className="h-3.5 w-3.5" />,        label: 'Type',       labelAr: 'كتابة' },
    { id: 'faqs',  icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'FAQs',      labelAr: 'أسئلة شائعة' },
    { id: 'pdf',   icon: <FileText className="h-3.5 w-3.5" />,     label: 'Upload File', labelAr: 'رفع ملف' },
  ];

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-3 p-1 bg-muted/40 rounded-xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all duration-200",
              tab === t.id
                ? "bg-white dark:bg-white/10 text-[#060541] dark:text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {isRTL ? t.labelAr : t.label}
          </button>
        ))}
      </div>

      {/* ── TYPE TAB ── */}
      {tab === 'type' && (
        <div>
          <textarea
            value={typeText}
            onChange={e => setTypeText(e.target.value)}
            rows={5}
            className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30 resize-none mb-3"
            placeholder={isRTL
              ? 'أضف معلومات عن منتجاتك، ساعات العمل، السياسات...'
              : 'Add info about your business, hours, policies, products...'}
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-lg border-[#060541]/30 dark:border-white/20 text-[#060541] dark:text-white hover:bg-[#060541]/5"
              onClick={generateWithAI}
              disabled={generating}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isRTL ? 'توليد بالذكاء الاصطناعي' : 'AI Generate'}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-lg bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541]"
              onClick={saveType}
              disabled={savingType}
            >
              {savingType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* ── FAQs TAB ── */}
      {tab === 'faqs' && (
        <div>
          {faqs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center border border-dashed border-border/50 rounded-xl mb-3">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground mb-0.5">
                {isRTL ? 'لم تضف أسئلة بعد' : 'You have not added any FAQs yet'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'أضف الأسئلة الشائعة لتدريب الذكاء الاصطناعي' : 'Add all the FAQs here and it will be used to train the AI'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 mb-3 max-h-[320px] overflow-y-auto pr-0.5">
              {faqs.map((faq, i) => (
                <FAQItem key={faq.id} faq={faq} index={i} onChange={updateFAQ} onDelete={deleteFAQ} isRTL={isRTL} forceCollapsed={collapsedAll} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-lg"
              onClick={addFAQ}
            >
              <Plus className="h-3.5 w-3.5" />
              {isRTL ? 'إضافة سؤال' : 'Add FAQ'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-lg"
              onClick={() => faqFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {isRTL ? 'رفع ملف CSV' : "Upload FAQ's"}
            </Button>
            <input ref={faqFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFAQFile} />
            {faqs.length > 0 && (
              <Button
                size="sm"
                className="gap-1.5 text-xs rounded-lg bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] ml-auto"
                onClick={saveFAQs}
                disabled={savingFAQs}
              >
                {savingFAQs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            )}
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/30">
            <span className="text-base shrink-0">💡</span>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              {isRTL
                ? 'عملاؤنا يجدون قفزة في رضا العملاء بمقدار 3x عند تدريب البوت على بياناتهم'
                : 'Our customers find a jump in customer satisfaction by 3X when the bots are trained on their data'}
            </p>
          </div>
        </div>
      )}

      {/* ── PDF TAB ── */}
      {tab === 'pdf' && (
        <div>
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-[#060541]/40 dark:hover:border-white/30 hover:bg-muted/20 transition-all duration-200 mb-3"
          >
            {extracting ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-[#060541] dark:text-white" />
                <p className="text-sm font-semibold text-foreground">{isRTL ? 'جاري استخراج النص...' : 'Extracting text...'}</p>
              </>
            ) : pdfName ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{pdfName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL ? 'انقر لتغيير الملف' : 'Click to change file'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-[#060541]/8 dark:bg-white/8 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-[#060541] dark:text-white/60" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">
                    {isRTL ? 'انقر لرفع ملف' : 'Click to upload file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL ? 'PDF, Word, أو ملف نصي' : 'PDF, Word, or text file'}
                  </p>
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={handleFileUpload} />

          {/* Extracted preview */}
          {pdfText && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                {isRTL ? 'النص المستخرج (معاينة)' : 'Extracted Text (Preview)'}
              </p>
              <div className="border border-border/50 rounded-xl px-3 py-2.5 bg-muted/20 max-h-[200px] overflow-y-auto">
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{pdfText}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {pdfText && (
              <Button
                size="sm"
                className="gap-1.5 text-xs rounded-lg bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541]"
                onClick={savePDF}
                disabled={savingPDF}
              >
                {savingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isRTL ? 'حفظ في قاعدة المعرفة' : 'Save to Knowledge Base'}
              </Button>
            )}
            {pdfText && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs rounded-lg"
                onClick={() => { setPdfText(''); setPdfName(''); }}
              >
                {isRTL ? 'مسح' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
