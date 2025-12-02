import React, { useState, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/client';
import { Download, Share2, RefreshCw, FileText, Sparkles, Clock, GitBranch, Users, Server, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DiagramFamily = 'auto' | 'flow' | 'timeline' | 'process' | 'map' | 'system';
type MaxDiagrams = 1 | 2 | 3;

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
// Diagram family options
// ─────────────────────────────────────────────────────────────────────────────

const DIAGRAM_FAMILIES: { value: DiagramFamily; labelEn: string; labelAr: string; icon: React.ReactNode; description: string; descriptionAr: string }[] = [
  { value: 'auto', labelEn: 'Auto', labelAr: 'تلقائي', icon: <Sparkles className="w-4 h-4" />, description: 'Let Wakti choose the best diagram type', descriptionAr: 'دع واكتي يختار أفضل نوع' },
  { value: 'flow', labelEn: 'Flow / Journey', labelAr: 'تدفق / رحلة', icon: <GitBranch className="w-4 h-4" />, description: 'Processes, funnels, user journeys', descriptionAr: 'عمليات، قمع، رحلات المستخدم' },
  { value: 'timeline', labelEn: 'Timeline', labelAr: 'جدول زمني', icon: <Clock className="w-4 h-4" />, description: 'Roadmaps, schedules, history', descriptionAr: 'خرائط طريق، جداول، تاريخ' },
  { value: 'process', labelEn: 'Process', labelAr: 'عملية', icon: <RefreshCw className="w-4 h-4" />, description: 'Workflows with decisions', descriptionAr: 'سير عمل مع قرارات' },
  { value: 'map', labelEn: 'Map / Org', labelAr: 'خريطة / هيكل', icon: <Users className="w-4 h-4" />, description: 'Org charts, stakeholder maps', descriptionAr: 'هياكل تنظيمية، خرائط أصحاب المصلحة' },
  { value: 'system', labelEn: 'System', labelAr: 'نظام', icon: <Server className="w-4 h-4" />, description: 'Architecture, technical diagrams', descriptionAr: 'بنية تقنية، مخططات فنية' },
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
  const [diagramFamily, setDiagramFamily] = useState<DiagramFamily>('auto');
  const [maxDiagrams, setMaxDiagrams] = useState<MaxDiagrams>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<GeneratedDiagram[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // File handling
  // ─────────────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);

    // Read file content as text (for txt, md) or just store the name for now
    // For PDFs/DOCX, we'd need server-side extraction - for v1, we support text files
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text();
      setFileContent(text);
    } else {
      // For other file types, we'll send the file name and let user know
      setFileContent(`[File: ${file.name}] - For best results with PDF/DOCX, please paste the text content directly.`);
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
          diagramFamily,
          language: isArabic ? 'ar' : 'en',
          maxDiagrams,
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
    try {
      const response = await fetch(diagram.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.title.replace(/\s+/g, '_')}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Copy link
  // ─────────────────────────────────────────────────────────────────────────

  const handleCopyLink = async (diagram: GeneratedDiagram) => {
    try {
      await navigator.clipboard.writeText(diagram.imageUrl);
      // Could add a toast here
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">
          {isArabic ? 'مولد المخططات الذكي' : 'Smart Diagram Generator'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isArabic
            ? 'حوّل أفكارك ونصوصك إلى مخططات احترافية'
            : 'Transform your ideas and text into professional diagrams'}
        </p>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Text Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {isArabic ? 'أدخل النص أو الفكرة' : 'Enter text or idea'}
          </label>
          <textarea
            className="w-full border rounded-lg p-3 min-h-[120px] resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            placeholder={isArabic
              ? 'اكتب ملخص اجتماع، فكرة مشروع، خطة عمل، أو أي نص تريد تحويله إلى مخطط...'
              : 'Write a meeting summary, project idea, business plan, or any text you want to turn into a diagram...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* File Upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
            id="diagram-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
            disabled={isLoading}
          >
            <FileText className="w-4 h-4" />
            {isArabic ? 'رفع ملف' : 'Upload File'}
          </button>
          {uploadedFile && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{uploadedFile.name}</span>
              <button
                type="button"
                onClick={clearFile}
                className="text-destructive hover:underline"
              >
                {isArabic ? 'إزالة' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Diagram Family Selection */}
      <div>
        <label className="block text-sm font-medium mb-3">
          {isArabic ? 'نوع المخطط' : 'Diagram Type'}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {DIAGRAM_FAMILIES.map((family) => (
            <button
              key={family.value}
              type="button"
              onClick={() => setDiagramFamily(family.value)}
              disabled={isLoading}
              className={`flex flex-col items-start p-3 rounded-lg border transition-all text-left ${
                diagramFamily === family.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {family.icon}
                <span className="font-medium text-sm">
                  {isArabic ? family.labelAr : family.labelEn}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isArabic ? family.descriptionAr : family.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Number of Diagrams */}
      <div>
        <label className="block text-sm font-medium mb-3">
          {isArabic ? 'عدد المخططات' : 'Number of Diagrams'}
        </label>
        <div className="flex gap-2">
          {([1, 2, 3] as MaxDiagrams[]).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setMaxDiagrams(num)}
              disabled={isLoading}
              className={`px-6 py-2 rounded-lg border font-medium transition-all ${
                maxDiagrams === num
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading || (!inputText.trim() && !fileContent.trim())}
        className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isArabic ? 'جارٍ الإنشاء...' : 'Generating...'}
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            {isArabic ? 'إنشاء المخططات' : 'Generate Diagrams'}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Results Gallery */}
      {diagrams.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {isArabic ? 'المخططات المُنشأة' : 'Generated Diagrams'}
          </h3>
          <div className="grid gap-4">
            {diagrams.map((diagram) => (
              <div
                key={diagram.id}
                className="border rounded-xl overflow-hidden bg-card shadow-sm"
              >
                {/* Diagram Preview */}
                <div className="p-4 bg-white dark:bg-gray-900 flex items-center justify-center min-h-[200px]">
                  <img
                    src={diagram.imageUrl}
                    alt={diagram.title}
                    className="max-w-full max-h-[400px] object-contain"
                  />
                </div>

                {/* Diagram Info & Actions */}
                <div className="p-4 border-t bg-muted/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium">{diagram.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {diagram.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {diagram.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {diagram.engine}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(diagram)}
                        className="p-2 rounded-lg border hover:bg-muted transition-colors"
                        title={isArabic ? 'تحميل' : 'Download'}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(diagram)}
                        className="p-2 rounded-lg border hover:bg-muted transition-colors"
                        title={isArabic ? 'نسخ الرابط' : 'Copy Link'}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagramsTab;
