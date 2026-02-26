// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, BookOpen, HelpCircle, ShoppingBag, Clock, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface QAPair {
  id: string;
  question: string;
  answer: string;
}

interface KBSection {
  id: string;
  title: string;
  titleAr: string;
  icon: React.ReactNode;
  color: string;
  pairs: QAPair[];
  expanded: boolean;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function serializeKB(sections: KBSection[]): string {
  return sections
    .filter(s => s.pairs.some(p => p.question.trim() || p.answer.trim()))
    .map(s => {
      const pairs = s.pairs
        .filter(p => p.question.trim() || p.answer.trim())
        .map(p => `Q: ${p.question}\nA: ${p.answer}`)
        .join('\n\n');
      return `## ${s.title}\n${pairs}`;
    })
    .join('\n\n---\n\n');
}

function parseKB(raw: string, defaultSections: KBSection[]): KBSection[] {
  if (!raw || !raw.trim()) return defaultSections;
  const blocks = raw.split(/\n---\n/);
  const result = defaultSections.map(s => ({ ...s, pairs: [{ id: makeId(), question: '', answer: '' }] }));

  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    const titleLine = lines.find(l => l.startsWith('##'));
    if (!titleLine) return;
    const title = titleLine.replace('##', '').trim();
    const sectionIdx = result.findIndex(s => s.title === title);
    if (sectionIdx === -1) return;
    const body = lines.filter(l => !l.startsWith('##')).join('\n');
    const rawPairs = body.split(/\n\nQ:|\nQ:/).filter(Boolean);
    const pairs: QAPair[] = rawPairs.map(p => {
      const qMatch = p.match(/^:?\s*(.*?)\nA:/s);
      const aMatch = p.match(/\nA:\s*([\s\S]*)/);
      return {
        id: makeId(),
        question: qMatch ? qMatch[1].trim() : p.replace(/^:\s*/, '').split('\nA:')[0].trim(),
        answer: aMatch ? aMatch[1].trim() : '',
      };
    }).filter(p => p.question || p.answer);
    if (pairs.length) result[sectionIdx].pairs = pairs;
  });

  return result;
}

const DEFAULT_SECTIONS = (isRTL: boolean): KBSection[] => [
  {
    id: 'faq',
    title: 'FAQ',
    titleAr: 'الأسئلة الشائعة',
    icon: <HelpCircle className="h-4 w-4" />,
    color: '#3b82f6',
    pairs: [{ id: makeId(), question: '', answer: '' }],
    expanded: false,
  },
  {
    id: 'products',
    title: 'Products & Services',
    titleAr: 'المنتجات والخدمات',
    icon: <ShoppingBag className="h-4 w-4" />,
    color: '#8b5cf6',
    pairs: [{ id: makeId(), question: '', answer: '' }],
    expanded: false,
  },
  {
    id: 'hours',
    title: 'Business Hours & Contact',
    titleAr: 'أوقات العمل والتواصل',
    icon: <Clock className="h-4 w-4" />,
    color: '#f59e0b',
    pairs: [{ id: makeId(), question: '', answer: '' }],
    expanded: false,
  },
  {
    id: 'policies',
    title: 'Policies & Terms',
    titleAr: 'السياسات والشروط',
    icon: <FileText className="h-4 w-4" />,
    color: '#10b981',
    pairs: [{ id: makeId(), question: '', answer: '' }],
    expanded: false,
  },
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  saving: boolean;
  isRTL: boolean;
}

export default function KnowledgeBaseEditor({ value, onChange, onSave, saving, isRTL }: Props) {
  const [sections, setSections] = useState<KBSection[]>(() => parseKB(value, DEFAULT_SECTIONS(isRTL)));
  const [mode, setMode] = useState<'structured' | 'raw'>('structured');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      let extracted = '';

      if (file.name.endsWith('.txt')) {
        extracted = await file.text();

      } else if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => item.str).join(' '));
        }
        extracted = pages.join('\n\n');

      } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extracted = result.value;
      }

      if (extracted.trim()) {
        onChange((value ? value + '\n\n' : '') + extracted.trim());
      }
    } catch (err) {
      console.error('File extraction error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (mode === 'structured') {
      onChange(serializeKB(sections));
    }
  }, [sections, mode]);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  };

  const updatePair = (sectionId: string, pairId: string, field: 'question' | 'answer', val: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, pairs: s.pairs.map(p => p.id === pairId ? { ...p, [field]: val } : p) }
        : s
    ));
  };

  const addPair = (sectionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, pairs: [...s.pairs, { id: makeId(), question: '', answer: '' }] }
        : s
    ));
  };

  const removePair = (sectionId: string, pairId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, pairs: s.pairs.filter(p => p.id !== pairId).length ? s.pairs.filter(p => p.id !== pairId) : [{ id: makeId(), question: '', answer: '' }] }
        : s
    ));
  };

  const totalPairs = sections.reduce((acc, s) => acc + s.pairs.filter(p => p.question.trim() || p.answer.trim()).length, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Mode switcher + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{totalPairs} {isRTL ? 'إدخال' : 'entries'}</span>
        </div>
        <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
          <button
            onClick={() => setMode('structured')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
              mode === 'structured' ? "bg-white dark:bg-[#060541] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isRTL ? 'منظم' : 'Structured'}
          </button>
          <button
            onClick={() => setMode('raw')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
              mode === 'raw' ? "bg-white dark:bg-[#060541] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isRTL ? 'نص حر' : 'Raw Text'}
          </button>
        </div>
      </div>

      {/* Structured mode */}
      {mode === 'structured' && (
        <div className="flex flex-col gap-2">
          {sections.map(section => (
            <div
              key={section.id}
              className="rounded-xl border border-border/50 bg-background overflow-hidden"
            >
              {/* Section header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                onClick={() => toggleSection(section.id)}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ background: section.color }}
                >
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    {isRTL ? section.titleAr : section.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {section.pairs.filter(p => p.question.trim() || p.answer.trim()).length} {isRTL ? 'إدخال' : 'entries'}
                  </p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shrink-0",
                  section.expanded
                    ? "bg-foreground/10 text-foreground rotate-180"
                    : "bg-muted/60 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                )}>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
                </div>
              </button>

              {/* Pairs */}
              {section.expanded && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border/40 pt-3">
                  {section.pairs.map((pair, idx) => (
                    <div key={pair.id} className="flex gap-2">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <input
                          value={pair.question}
                          onChange={e => updatePair(section.id, pair.id, 'question', e.target.value)}
                          placeholder={isRTL ? `سؤال ${idx + 1}...` : `Question ${idx + 1}...`}
                          className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/40 rounded-lg focus:outline-none focus:border-[#060541]/30 dark:focus:border-white/30 placeholder:text-muted-foreground/50"
                        />
                        <textarea
                          value={pair.answer}
                          onChange={e => updatePair(section.id, pair.id, 'answer', e.target.value)}
                          placeholder={isRTL ? 'الإجابة...' : 'Answer...'}
                          rows={2}
                          className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/40 rounded-lg focus:outline-none focus:border-[#060541]/30 dark:focus:border-white/30 resize-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <button
                        title="Remove"
                        onClick={() => removePair(section.id, pair.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors self-start mt-0.5 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addPair(section.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isRTL ? 'إضافة سؤال' : 'Add entry'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw text mode */}
      {mode === 'raw' && (
        <div className="flex flex-col gap-2">
          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              className="hidden"
              aria-label="Upload knowledge base file"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/60 hover:border-[#060541]/40 dark:hover:border-white/30 bg-muted/30 hover:bg-muted/50 transition-colors text-xs text-muted-foreground w-full justify-center"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploading ? (isRTL ? 'جارٍ القراءة...' : 'Reading...') : (isRTL ? 'رفع ملف (PDF، TXT، Word)' : 'Upload file (PDF, .txt, Word)')}</span>
            </button>
          </div>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={8}
            className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30 resize-none font-mono text-xs"
            placeholder={isRTL
              ? 'أضف معلومات عن منتجاتك، الأسئلة الشائعة، ساعات العمل...'
              : 'Add any info about your business, products, FAQs, policies...'}
          />
        </div>
      )}

      {/* Save button */}
      <Button
        size="sm"
        className="gap-1.5 text-xs rounded-lg bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] self-start"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {isRTL ? 'حفظ قاعدة المعرفة' : 'Save Knowledge Base'}
      </Button>
    </div>
  );
}
