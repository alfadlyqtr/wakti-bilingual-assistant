import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Upload, Download, Loader2, FileSpreadsheet, Presentation, X, Table } from 'lucide-react';

type OutputType = 'pptx' | 'docx' | 'pdf' | 'xlsx' | 'txt';

export default function FileGeneratorTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Debug: Check if component renders
  console.log('FileGeneratorTab rendered', { language, user: !!user });

  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [outputType, setOutputType] = useState<OutputType>('pptx');
  const [outputSize, setOutputSize] = useState(5);
  const [includeImages, setIncludeImages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<{
    downloadUrl: string;
    fileName: string;
    fileSize: number;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (20 MB limit)
    if (file.size > 20 * 1024 * 1024) {
      setError(language === 'ar' 
        ? 'حجم الملف يجب أن يكون أقل من 20 ميجابايت'
        : 'File size must be less than 20 MB');
      return;
    }

    // Check file type
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      setError(language === 'ar'
        ? 'نوع الملف غير مدعوم. استخدم PDF أو Word أو TXT'
        : 'Unsupported file type. Use PDF, Word, or TXT');
      return;
    }

    setUploadedFile(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setError('');
    setSuccess('');
    
    if (!inputText && !uploadedFile) {
      setError(language === 'ar'
        ? 'الرجاء إدخال نص أو رفع ملف'
        : 'Please enter text or upload a file');
      return;
    }

    if (!user) {
      setError(language === 'ar'
        ? 'يجب تسجيل الدخول أولاً'
        : 'You must be logged in');
      return;
    }

    setIsGenerating(true);
    setGeneratedFile(null);

    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload file to storage if provided
      if (uploadedFile) {
        const timestamp = Date.now();
        const storagePath = `${user.id}/input_${timestamp}_${uploadedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('generated-files')
          .upload(storagePath, uploadedFile);

        if (uploadError) {
          throw new Error('Failed to upload file');
        }

        const { data: urlData } = supabase.storage
          .from('generated-files')
          .getPublicUrl(storagePath);

        fileUrl = urlData.publicUrl;
        fileName = uploadedFile.name;
      }

      // Call Edge Function V2 (with real file generation)
      const { data, error } = await supabase.functions.invoke('smart-file-generator-v2', {
        body: {
          inputText: inputText || undefined,
          fileUrl,
          fileName,
          outputType,
          outputSize,
          includeImages,
          language: language === 'ar' ? 'ar' : 'en',
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setGeneratedFile({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
      });

      setSuccess(language === 'ar'
        ? 'تم إنشاء الملف بنجاح'
        : 'File generated successfully');

    } catch (error: any) {
      console.error('File generation error:', error);
      setError(error.message || (language === 'ar'
        ? 'فشل إنشاء الملف'
        : 'Failed to generate file'));
    } finally {
      setIsGenerating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSizeLabel = () => {
    if (outputType === 'pptx') {
      return language === 'ar' ? 'عدد الشرائح' : 'Number of slides';
    }
    return language === 'ar' ? 'عدد الصفحات' : 'Number of pages';
  };

  return (
    <div className="space-y-4">
      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
          {success}
        </div>
      )}
      
      {/* Input Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'المحتوى' : 'Content'}
        </label>
        
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={language === 'ar'
            ? 'اكتب أو الصق المحتوى هنا...'
            : 'Type or paste your content here...'}
          className="min-h-[150px] resize-none"
          maxLength={10000}
        />

        <div className="text-xs text-muted-foreground text-right">
          {inputText.length} / 10,000
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!uploadedFile ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'رفع ملف' : 'Upload File'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{uploadedFile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(uploadedFile.size)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            {language === 'ar'
              ? 'الأنواع المدعومة: PDF، Word، TXT (حتى 20 ميجابايت)'
              : 'Supported: PDF, Word, TXT (up to 20 MB)'}
          </div>
        </div>
      </div>

      {/* Output Configuration */}
      <div className="space-y-3">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'نوع الملف' : 'Output Type'}
        </label>
        
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          <Button
            type="button"
            variant={outputType === 'pptx' ? 'default' : 'outline'}
            onClick={() => setOutputType('pptx')}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Presentation className="w-5 h-5" />
            <span className="text-xs">PowerPoint</span>
          </Button>
          
          <Button
            type="button"
            variant={outputType === 'docx' ? 'default' : 'outline'}
            onClick={() => setOutputType('docx')}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Word</span>
          </Button>
          
          <Button
            type="button"
            variant={outputType === 'xlsx' ? 'default' : 'outline'}
            onClick={() => setOutputType('xlsx')}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Table className="w-5 h-5" />
            <span className="text-xs">Excel</span>
          </Button>
          
          <Button
            type="button"
            variant={outputType === 'pdf' ? 'default' : 'outline'}
            onClick={() => setOutputType('pdf')}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-xs">PDF</span>
          </Button>
          
          <Button
            type="button"
            variant={outputType === 'txt' ? 'default' : 'outline'}
            onClick={() => setOutputType('txt')}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Text</span>
          </Button>
        </div>
      </div>

      {/* Size Control */}
      <div className="space-y-3">
        <label className="text-sm font-medium">
          {getSizeLabel()}
        </label>
        
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            value={outputSize}
            onChange={(e) => setOutputSize(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className="text-sm font-medium w-12 text-center">
            {outputSize}
          </div>
        </div>
      </div>

      {/* Include Images Checkbox */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
        <input
          type="checkbox"
          id="includeImages"
          checked={includeImages}
          onChange={(e) => setIncludeImages(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="includeImages" className="text-sm font-medium cursor-pointer flex-1">
          {language === 'ar' ? 'تضمين صور' : 'Include Images'}
        </label>
        <span className="text-xs text-muted-foreground">
          {language === 'ar' ? '(يتم إنشاؤها بالذكاء الاصطناعي)' : '(AI-generated)'}
        </span>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || (!inputText && !uploadedFile)}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
          </>
        ) : (
          <>
            {language === 'ar' ? 'إنشاء الملف' : 'Generate File'}
          </>
        )}
      </Button>

      {/* Generated File Display */}
      {generatedFile && (
        <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {outputType === 'pptx' && <Presentation className="w-6 h-6 text-primary" />}
              {outputType === 'docx' && <FileText className="w-6 h-6 text-primary" />}
              {outputType === 'xlsx' && <Table className="w-6 h-6 text-primary" />}
              {outputType === 'pdf' && <FileSpreadsheet className="w-6 h-6 text-primary" />}
              {outputType === 'txt' && <FileText className="w-6 h-6 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {generatedFile.fileName}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(generatedFile.fileSize)}
              </div>
            </div>
          </div>
          
          <a
            href={generatedFile.downloadUrl}
            download={generatedFile.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button className="w-full" variant="default">
              <Download className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'تحميل' : 'Download'}
            </Button>
          </a>
          
          <div className="text-xs text-muted-foreground text-center">
            {language === 'ar'
              ? 'الملف متاح للتحميل لمدة 24 ساعة'
              : 'File available for 24 hours'}
          </div>
        </div>
      )}
    </div>
  );
}
