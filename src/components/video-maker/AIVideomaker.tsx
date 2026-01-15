import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  Image as ImageIcon,
  Video,
  Loader2,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  Clock,
  AlertCircle,
  X,
  Play,
  Wand2,
  Camera,
} from 'lucide-react';

interface QuotaInfo {
  used: number;
  limit: number;
  extra: number;
  canGenerate: boolean;
}

export default function AIVideomaker() {
  const { language } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);

  // Load quota on mount
  const loadQuota = useCallback(async () => {
    if (!user) return;
    setLoadingQuota(true);
    try {
      const { data, error } = await (supabase as any).rpc('can_generate_ai_video', {
        p_user_id: user.id,
      });
      if (error) throw error;
      const q = data?.[0] || data;
      setQuota({
        used: q?.videos_generated || 0,
        limit: q?.videos_limit || 10,
        extra: q?.extra_videos || 0,
        canGenerate: q?.can_generate ?? true,
      });
    } catch (e) {
      console.error('Failed to load AI video quota:', e);
    } finally {
      setLoadingQuota(false);
    }
  }, [user]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  // Handle image upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setGeneratedVideoUrl(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setGeneratedVideoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!imagePreview || !user) return;

    if (!quota?.canGenerate) {
      toast.error(
        language === 'ar'
          ? 'لقد وصلت للحد الشهري من الفيديوهات'
          : 'You have reached your monthly AI video limit'
      );
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(language === 'ar' ? 'جاري إنشاء الفيديو...' : 'Creating video...');
    setGeneratedVideoUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: {
          image: imagePreview,
          prompt: prompt.trim() || undefined,
          negative_prompt: negativePrompt.trim() || undefined,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate video');
      }

      if (!data?.ok) {
        throw new Error(data?.error || 'Video generation failed');
      }

      setGeneratedVideoUrl(data.videoUrl);
      toast.success(language === 'ar' ? 'تم إنشاء الفيديو!' : 'Video generated!');
      await loadQuota();
    } catch (e: any) {
      console.error('AI Video generation error:', e);
      toast.error(e?.message || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleDownload = async () => {
    if (!generatedVideoUrl) return;
    try {
      const response = await fetch(generatedVideoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-ai-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      window.open(generatedVideoUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (!generatedVideoUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Wakti AI Video',
          url: generatedVideoUrl,
        });
      } else {
        await navigator.clipboard.writeText(generatedVideoUrl);
        toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const remaining = quota ? quota.limit - quota.used + quota.extra : 0;
  const canGenerate = imagePreview && quota?.canGenerate && !isGenerating;

  return (
    <div className="space-y-5">
      {/* Hero header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#060541] via-[hsl(260,70%,25%)] to-[#060541] p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              <Wand2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {language === 'ar' ? 'صانع الفيديو بالذكاء الاصطناعي' : 'AI Video Generator'}
              </h2>
              <p className="text-sm text-white/70">
                {language === 'ar' ? 'حوّل صورتك إلى فيديو متحرك' : 'Transform your image into motion'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <Sparkles className="h-4 w-4" />
            {loadingQuota ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="font-semibold">{remaining}/{quota?.limit || 10}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main content - two column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column - Image upload */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {language === 'ar' ? 'الصورة المصدر' : 'Source Image'}
            </h3>
          </div>

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative cursor-pointer group"
            >
              <div className="aspect-[9/16] max-h-[400px] rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col items-center justify-center gap-4 transition-all hover:border-primary/60 hover:bg-primary/10">
                <div className="p-5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center px-4">
                  <p className="font-semibold text-lg">
                    {language === 'ar' ? 'اسحب صورة أو انقر للتحميل' : 'Drop image or click to upload'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'PNG, JPG حتى 10MB' : 'PNG, JPG up to 10MB'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <div className="aspect-[9/16] max-h-[400px] rounded-2xl overflow-hidden bg-black shadow-2xl">
                <img
                  src={imagePreview}
                  alt="Selected"
                  className="w-full h-full object-contain"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-3 right-3 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={clearImage}
                disabled={isGenerating}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 bg-white/90 hover:bg-white text-black"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                >
                  {language === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                </Button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            aria-label={language === 'ar' ? 'اختر صورة' : 'Select image'}
          />
        </div>

        {/* Right column - Prompt & Generate */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {language === 'ar' ? 'وصف الحركة' : 'Motion Description'}
            </h3>
          </div>

          {/* Main prompt - always visible */}
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'صف الحركة التي تريدها... مثال: شخص يبتسم ويلوح بيده، قطة تحرك رأسها، سيارة تتحرك للأمام...'
                  : 'Describe the motion you want... e.g., A person smiling and waving, a cat moving its head, a car driving forward...'
              }
              className="min-h-[140px] text-base resize-none rounded-xl border-2 focus:border-primary transition-colors"
              maxLength={2500}
              disabled={isGenerating}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {showAdvanced 
                  ? (language === 'ar' ? '▲ إخفاء الخيارات المتقدمة' : '▲ Hide advanced options')
                  : (language === 'ar' ? '▼ خيارات متقدمة' : '▼ Advanced options')
                }
              </button>
              <span className="text-xs text-muted-foreground">{prompt.length}/2500</span>
            </div>
          </div>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-2 p-4 rounded-xl bg-muted/30 border">
              <label className="text-sm font-medium">
                {language === 'ar' ? 'ما تريد تجنبه' : 'What to avoid'}
              </label>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'ضبابي، جودة منخفضة، تشوهات...'
                    : 'blurry, low quality, distortions...'
                }
                className="min-h-[80px] text-sm resize-none"
                maxLength={2500}
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Duration badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <Clock className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">
              {language === 'ar' ? 'مدة الفيديو: 5 ثوانٍ' : 'Video duration: 5 seconds'}
            </span>
          </div>

          {/* Generate button */}
          <Button
            className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-[#060541] to-[hsl(260,70%,35%)] hover:from-[hsl(243,84%,20%)] hover:to-[hsl(260,70%,40%)] shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isGenerating ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{generationStatus || (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Wand2 className="h-5 w-5" />
                <span>{language === 'ar' ? 'إنشاء الفيديو' : 'Generate Video'}</span>
              </div>
            )}
          </Button>

          {!imagePreview && (
            <p className="text-center text-sm text-muted-foreground">
              {language === 'ar' ? '👆 قم بتحميل صورة أولاً' : '👆 Upload an image first'}
            </p>
          )}

          {!quota?.canGenerate && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {language === 'ar'
                  ? 'لقد استخدمت جميع فيديوهات AI الشهرية'
                  : 'You have used all your monthly AI videos'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generated video result */}
      {generatedVideoUrl && (
        <Card className="overflow-hidden rounded-2xl border-2 border-green-500/30 shadow-xl">
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <Video className="h-5 w-5 text-green-600" />
              </div>
              <span className="font-semibold text-lg">
                {language === 'ar' ? '🎉 الفيديو جاهز!' : '🎉 Video Ready!'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'تحميل' : 'Download'}
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'مشاركة' : 'Share'}
              </Button>
            </div>
          </div>
          <div className="bg-black p-4">
            <video
              src={generatedVideoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="w-full max-h-[500px] object-contain rounded-xl"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
