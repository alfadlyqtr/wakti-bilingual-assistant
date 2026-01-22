import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  File,
  Grid3X3,
  LayoutList,
  Columns
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaConfig {
  allowedTypes: ('image' | 'video' | 'audio' | 'document')[];
  maxFileSize: number; // in MB
  maxFiles: number;
  displayStyle: 'grid' | 'list' | 'carousel';
  features: {
    dragDrop: boolean;
    preview: boolean;
    progress: boolean;
    multiSelect: boolean;
  };
  design: {
    borderRadius: 'rounded' | 'sharp' | 'pill';
    colorScheme: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
    dropzoneStyle: 'minimal' | 'bordered' | 'dashed';
  };
}

interface MediaWizardProps {
  onComplete: (config: MediaConfig, structuredPrompt: string) => void;
  onCancel: () => void;
  onSkipWizard: () => void;
  originalPrompt: string;
}

export function MediaWizard({ onComplete, onCancel, onSkipWizard, originalPrompt }: MediaWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: File Types
  const [allowedTypes, setAllowedTypes] = useState<('image' | 'video' | 'audio' | 'document')[]>(['image']);
  const [maxFileSize, setMaxFileSize] = useState(10);
  const [maxFiles, setMaxFiles] = useState(5);
  
  // Step 2: Features
  const [dragDrop, setDragDrop] = useState(true);
  const [preview, setPreview] = useState(true);
  const [progress, setProgress] = useState(true);
  const [multiSelect, setMultiSelect] = useState(true);
  const [displayStyle, setDisplayStyle] = useState<'grid' | 'list' | 'carousel'>('grid');
  
  // Step 3: Design
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [colorScheme, setColorScheme] = useState<'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');
  const [dropzoneStyle, setDropzoneStyle] = useState<'minimal' | 'bordered' | 'dashed'>('dashed');

  const COLOR_SCHEMES = [
    { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo', labelAr: 'نيلي' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Green', labelAr: 'أخضر' },
    { id: 'rose', color: 'bg-rose-500', label: 'Rose', labelAr: 'وردي' },
    { id: 'amber', color: 'bg-amber-500', label: 'Amber', labelAr: 'كهرماني' },
    { id: 'slate', color: 'bg-slate-600', label: 'Slate', labelAr: 'رمادي' },
  ];

  const fileTypes = [
    { id: 'image', icon: <ImageIcon className="h-5 w-5" />, label: 'Images', labelAr: 'صور', ext: 'JPG, PNG, GIF' },
    { id: 'video', icon: <FileVideo className="h-5 w-5" />, label: 'Videos', labelAr: 'فيديو', ext: 'MP4, MOV' },
    { id: 'audio', icon: <FileAudio className="h-5 w-5" />, label: 'Audio', labelAr: 'صوت', ext: 'MP3, WAV' },
    { id: 'document', icon: <File className="h-5 w-5" />, label: 'Documents', labelAr: 'مستندات', ext: 'PDF, DOC' },
  ];

  const toggleFileType = (type: 'image' | 'video' | 'audio' | 'document') => {
    setAllowedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleComplete = () => {
    const config: MediaConfig = {
      allowedTypes,
      maxFileSize,
      maxFiles,
      displayStyle,
      features: {
        dragDrop,
        preview,
        progress,
        multiSelect,
      },
      design: {
        borderRadius,
        colorScheme,
        dropzoneStyle,
      }
    };

    const acceptedExtensions = allowedTypes.map(type => {
      switch(type) {
        case 'image': return 'image/*';
        case 'video': return 'video/*';
        case 'audio': return 'audio/*';
        case 'document': return '.pdf,.doc,.docx,.txt';
        default: return '';
      }
    }).join(',');

    let prompt = `Build a beautiful file upload component with these EXACT specifications:

ALLOWED FILE TYPES:
${allowedTypes.map(t => `- ${t.charAt(0).toUpperCase() + t.slice(1)}s`).join('\n')}
Accept attribute: "${acceptedExtensions}"

LIMITS:
- Maximum file size: ${maxFileSize}MB per file
- Maximum files: ${maxFiles} files total
- Show error message if limits exceeded

FEATURES:
${dragDrop ? '- Drag and drop support with visual feedback (highlight on drag over)' : '- Click to upload only (no drag and drop)'}
${preview ? '- Show file previews (thumbnails for images, icons for other types)' : '- No file previews'}
${progress ? '- Upload progress bar for each file' : '- No progress indicator'}
${multiSelect ? '- Allow selecting multiple files at once' : '- Single file selection only'}

DISPLAY STYLE: ${displayStyle}
${displayStyle === 'grid' ? '- Show uploaded files in a grid layout' : ''}
${displayStyle === 'list' ? '- Show uploaded files in a vertical list' : ''}
${displayStyle === 'carousel' ? '- Show uploaded files in a horizontal carousel/slider' : ''}

DESIGN:
- Dropzone style: ${dropzoneStyle} (${dropzoneStyle === 'minimal' ? 'clean, subtle' : dropzoneStyle === 'bordered' ? 'solid border' : 'dashed border'})
- Border radius: ${borderRadius}
- Color scheme: ${colorScheme} (use ${colorScheme}-500 for accent colors)
- Add hover effects and smooth transitions
- Show file name, size, and type for each uploaded file
- Include remove/delete button for each file

BACKEND INTEGRATION:
- Upload endpoint: { projectId: "{{PROJECT_ID}}", action: "upload", data: FormData with file }
- Use multipart/form-data for file uploads
- Handle upload errors gracefully
- Show success/error toast messages

CRITICAL - DO NOT:
- Do NOT create supabaseClient.js
- Do NOT write any API keys
- Do NOT use external file upload libraries (build from scratch)

Original request: ${originalPrompt}`;

    onComplete(config, prompt);
  };

  const displayOptions = [
    { id: 'grid', icon: <Grid3X3 className="h-5 w-5" />, label: 'Grid', labelAr: 'شبكة' },
    { id: 'list', icon: <LayoutList className="h-5 w-5" />, label: 'List', labelAr: 'قائمة' },
    { id: 'carousel', icon: <Columns className="h-5 w-5" />, label: 'Carousel', labelAr: 'عرض شرائح' },
  ];

  const renderStep = () => {
    // Step 1: File Types
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">
              {isRTL ? 'أنواع الملفات المسموحة' : 'Allowed File Types'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'اختر أنواع الملفات التي يمكن رفعها' : 'Select which file types can be uploaded'}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {fileTypes.map(type => (
              <button
                key={type.id}
                onClick={() => toggleFileType(type.id as any)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border transition-all",
                  allowedTypes.includes(type.id as any)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-md",
                  allowedTypes.includes(type.id as any) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {type.icon}
                </div>
                <div className="text-left">
                  <span className="text-xs font-medium block">
                    {isRTL ? type.labelAr : type.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{type.ext}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'الحد الأقصى لحجم الملف (MB)' : 'Max File Size (MB)'}</Label>
              <div className="flex gap-2">
                {[5, 10, 25, 50].map(size => (
                  <button
                    key={size}
                    onClick={() => setMaxFileSize(size)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium rounded-lg border transition-all",
                      maxFileSize === size
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {size}MB
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'الحد الأقصى لعدد الملفات' : 'Max Number of Files'}</Label>
              <div className="flex gap-2">
                {[1, 5, 10, 20].map(num => (
                  <button
                    key={num}
                    onClick={() => setMaxFiles(num)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium rounded-lg border transition-all",
                      maxFiles === num
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Features
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اختر ميزات الرفع' : 'Choose upload features'}
          </p>
          
          <div className="space-y-2">
            {[
              { key: 'dragDrop', label: isRTL ? 'سحب وإفلات' : 'Drag & Drop', desc: isRTL ? 'اسحب الملفات للرفع' : 'Drag files to upload', state: dragDrop, setter: setDragDrop },
              { key: 'preview', label: isRTL ? 'معاينة الملفات' : 'File Preview', desc: isRTL ? 'عرض صور مصغرة' : 'Show thumbnails', state: preview, setter: setPreview },
              { key: 'progress', label: isRTL ? 'شريط التقدم' : 'Progress Bar', desc: isRTL ? 'إظهار تقدم الرفع' : 'Show upload progress', state: progress, setter: setProgress },
              { key: 'multiSelect', label: isRTL ? 'اختيار متعدد' : 'Multi-Select', desc: isRTL ? 'رفع عدة ملفات' : 'Upload multiple files', state: multiSelect, setter: setMultiSelect },
            ].map(opt => (
              <div 
                key={opt.key} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  opt.state ? "border-primary/30 bg-primary/5" : "border-border"
                )}
              >
                <div>
                  <Label className="text-xs font-medium">{opt.label}</Label>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
                <Switch checked={opt.state} onCheckedChange={opt.setter} />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs">{isRTL ? 'نمط العرض' : 'Display Style'}</Label>
            <div className="grid grid-cols-3 gap-2">
              {displayOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDisplayStyle(opt.id as typeof displayStyle)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                    displayStyle === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {opt.icon}
                  <span className="text-xs font-medium">
                    {isRTL ? opt.labelAr : opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Design
    if (step === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تخصيص التصميم' : 'Customize design'}
          </p>
          
          <div className="space-y-3">
            {/* Dropzone Style */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط منطقة الإفلات' : 'Dropzone Style'}</Label>
              <div className="flex gap-2">
                {(['minimal', 'bordered', 'dashed'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setDropzoneStyle(style)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium rounded-lg transition-all",
                      style === 'minimal' ? 'border border-transparent' : style === 'bordered' ? 'border-2 border-border' : 'border-2 border-dashed border-border',
                      dropzoneStyle === style
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    {style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') : 
                     style === 'bordered' ? (isRTL ? 'محدد' : 'Bordered') : 
                     (isRTL ? 'متقطع' : 'Dashed')}
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط الحواف' : 'Border Style'}</Label>
              <div className="flex gap-2">
                {(['rounded', 'sharp', 'pill'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setBorderRadius(r)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium border transition-all",
                      r === 'sharp' ? 'rounded-none' : r === 'pill' ? 'rounded-full' : 'rounded-lg',
                      borderRadius === r
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {r === 'rounded' ? (isRTL ? 'مدور' : 'Rounded') : 
                     r === 'sharp' ? (isRTL ? 'حاد' : 'Sharp') : 
                     (isRTL ? 'دائري' : 'Pill')}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نظام الألوان' : 'Color Scheme'}</Label>
              <div className="flex gap-2">
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    onClick={() => setColorScheme(scheme.id as typeof colorScheme)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all",
                      colorScheme === scheme.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full", scheme.color)} />
                    <span className="text-[10px]">{isRTL ? scheme.labelAr : scheme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div className="text-xs font-semibold mb-2">
                {isRTL ? 'معاينة' : 'Preview'}
              </div>
              <div className={cn(
                "p-4 bg-background flex flex-col items-center justify-center gap-2",
                borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'pill' ? 'rounded-2xl' : 'rounded-lg',
                dropzoneStyle === 'minimal' ? 'border border-border/50' : dropzoneStyle === 'bordered' ? 'border-2 border-border' : 'border-2 border-dashed border-border'
              )}>
                <Upload className={cn(
                  "h-6 w-6",
                  colorScheme === 'indigo' ? 'text-indigo-500' :
                  colorScheme === 'emerald' ? 'text-emerald-500' :
                  colorScheme === 'rose' ? 'text-rose-500' :
                  colorScheme === 'amber' ? 'text-amber-500' : 'text-slate-500'
                )} />
                <p className="text-[10px] text-muted-foreground">
                  {isRTL ? 'اسحب الملفات هنا' : 'Drop files here'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 p-4 bg-card border border-border rounded-2xl shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-purple-500" />
          <div>
            <h3 className="font-semibold text-sm">
              {isRTL ? 'معالج رفع الملفات' : 'Media Upload Wizard'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'إعداد مكون رفع الملفات' : 'Set up file upload component'}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isRTL ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
        </span>
      </div>
      
      {/* Step Content */}
      {renderStep()}
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
            className="text-xs"
          >
            {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </Button>
          
          {step === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSkipWizard}
              className="text-xs border-dashed"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {isRTL ? 'دع الذكاء يتولى' : 'Let AI Handle It'}
            </Button>
          )}
        </div>
        
        {step < totalSteps ? (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            className="text-xs bg-purple-600 hover:bg-purple-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {isRTL ? 'إنشاء مكون الرفع' : 'Generate Uploader'}
          </Button>
        )}
      </div>
    </div>
  );
}
