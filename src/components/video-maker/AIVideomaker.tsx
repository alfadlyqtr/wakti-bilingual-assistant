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
  Save,
  Check,
  Lock,
  FolderOpen,
} from 'lucide-react';

interface QuotaInfo {
  used: number;
  limit: number;
  extra: number;
  canGenerate: boolean;
}

interface AIVideomakerProps {
  onSaveSuccess?: () => void;
}

interface LatestVideo {
  id: string;
  title: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export default function AIVideomaker({ onSaveSuccess }: AIVideomakerProps) {
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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [latestVideo, setLatestVideo] = useState<LatestVideo | null>(null);
  const pollInFlightRef = useRef(false);
  const usageIncrementedRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const loadLatestVideo = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('id, title, video_url, duration_seconds, created_at')
        .eq('user_id', user.id)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (row?.video_url) {
        setLatestVideo(row);
        return;
      }

      const { data: aiData, error: aiError } = await (supabase as any)
        .from('user_ai_videos')
        .select('id, title, video_url, duration_seconds, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (aiError) throw aiError;
      const aiRow = aiData?.[0];
      if (aiRow?.video_url) {
        setLatestVideo(aiRow);
      }
    } catch (e) {
      console.error('Failed to load latest video:', e);
    }
  }, [user]);

  useEffect(() => {
    loadLatestVideo();
  }, [loadLatestVideo]);

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

  const handleDownloadLatest = async () => {
    if (!latestVideo?.video_url) return;
    try {
      const response = await fetch(latestVideo.video_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      window.open(latestVideo.video_url, '_blank');
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for task status
  const pollTaskStatus = useCallback(async (tid: string) => {
    try {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: { mode: 'status', task_id: tid, increment_usage: !usageIncrementedRef.current },
      });

      if (error) throw error;

      const status = data?.data?.status?.toLowerCase();
      console.log('[AIVideomaker] Poll status:', status);

      if (status === 'completed' || status === 'succeed' || status === 'succeeded') {
        // Done!
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        usageIncrementedRef.current = true;
        // Video URL is in generated array, NOT video.url!
        const videoUrl = data?.data?.generated?.[0] || data?.data?.video?.url;
        if (videoUrl) {
          setGeneratedVideoUrl(videoUrl);
          setIsSaved(false);
          setGenerationProgress(100);
          setGenerationStatus(language === 'ar' ? 'تم!' : 'Done!');
          toast.success(language === 'ar' ? 'تم إنشاء الفيديو!' : 'Video generated!');
          await loadQuota();
          await loadLatestVideo();
        } else {
          throw new Error('Video URL not found');
        }
        setIsGenerating(false);
        setTaskId(null);
      } else if (status === 'failed' || status === 'error') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        throw new Error(data?.data?.error || 'Video generation failed');
      } else {
        // Still processing - update progress
        setGenerationProgress((prev) => Math.min(prev + 5, 90));
      }
    } catch (e: any) {
      console.error('[AIVideomaker] Poll error:', e);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setIsGenerating(false);
      setTaskId(null);
      setGenerationProgress(0);
      toast.error(e?.message || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
    } finally {
      pollInFlightRef.current = false;
    }
  }, [language, loadQuota, loadLatestVideo]);

  const handleGenerate = async () => {
    if (!imagePreview || !user) return;

    if (loadingQuota) {
      toast.message(language === 'ar' ? 'جاري التحقق من الحد...' : 'Checking quota...');
      return;
    }

    if (!quota) {
      await loadQuota();
      if (!quota) {
        toast.error(language === 'ar' ? 'تعذر تحميل الحد الشهري' : 'Failed to load quota');
        return;
      }
    }

    if (!quota.canGenerate) {
      toast.error(
        language === 'ar'
          ? 'لقد وصلت للحد الشهري من الفيديوهات'
          : 'You have reached your monthly AI video limit'
      );
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);
    setGenerationStatus(language === 'ar' ? 'جاري رفع الصورة...' : 'Uploading image...');
    setGeneratedVideoUrl(null);
    usageIncrementedRef.current = false;

    try {
      // Start task in async mode
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: {
          image: imagePreview,
          prompt: prompt.trim() || undefined,
          negative_prompt: negativePrompt.trim() || undefined,
          mode: 'async',
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to start video generation');
      }

      if (!data?.ok || !data?.task_id) {
        throw new Error(data?.error || 'Failed to create video task');
      }

      const tid = data.task_id;
      setTaskId(tid);
      setGenerationProgress(15);
      setGenerationStatus(language === 'ar' ? 'جاري إنشاء الفيديو...' : 'Generating video...');

      // Start polling every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        pollTaskStatus(tid);
      }, 5000);

      // Also poll immediately after a short delay
      setTimeout(() => pollTaskStatus(tid), 3000);

    } catch (e: any) {
      console.error('AI Video generation error:', e);
      toast.error(e?.message || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
      setIsGenerating(false);
      setGenerationProgress(0);
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

  const handleSaveToMyVideos = async () => {
    if (!generatedVideoUrl || !user || isSaved) return;
    setIsSaving(true);
    try {
      // Save into unified user_videos table
      const { error } = await (supabase as any).from('user_videos').insert({
        user_id: user.id,
        title: prompt.trim().slice(0, 100) || 'AI Video',
        description: prompt.trim() || null,
        video_url: generatedVideoUrl,
        duration_seconds: 5,
        aspect_ratio: '9:16',
        style_template: 'ai',
        is_public: false,
      });

      if (error) throw error;

      setIsSaved(true);
      toast.success(language === 'ar' ? 'تم الحفظ في فيديوهاتي!' : 'Saved to My Videos!');
      // Navigate to My AI Videos tab after successful save
      if (onSaveSuccess) {
        setTimeout(() => onSaveSuccess(), 1000);
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const remaining = quota ? quota.limit - quota.used + quota.extra : 10;
  const used = quota?.used || 0;
  const limit = quota?.limit || 10;
  const limitReached = quota !== null && !quota.canGenerate;
  const canGenerate = imagePreview && !limitReached && !isGenerating && !loadingQuota;
  const showLatestVideo = !generatedVideoUrl && !!latestVideo?.video_url;

  return (
    <div className="relative">
      {/* Glowing background effects */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-40 blur-3xl bg-gradient-to-br from-[hsl(210,100%,65%)] via-[hsl(280,70%,65%)] to-[hsl(25,95%,60%)] dark:opacity-20" />
      
      {/* Main card container */}
      <div className="relative enhanced-card rounded-[1.5rem] p-5 md:p-6 overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1vcGFjaXR5PSIwLjAyIj48cGF0aCBkPSJNMjAgMjBjMC0xMSA5LTIwIDIwLTIwdjQwYy0xMSAwLTIwLTktMjAtMjB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative space-y-5">
          {/* Compact header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#060541] to-[hsl(280,70%,35%)] shadow-lg shadow-primary/30">
                <Wand2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#060541] to-[hsl(280,70%,45%)] dark:from-white dark:to-[hsl(280,70%,75%)] bg-clip-text text-transparent">
                  {language === 'ar' ? 'صانع الفيديو بالذكاء الاصطناعي' : 'AI Video Generator'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[hsl(210,100%,65%)]/20 to-[hsl(280,70%,65%)]/20 border border-primary/20">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{language === 'ar' ? '5 ثوانٍ' : '5 sec'}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${limitReached ? 'bg-red-500/20 border-red-500/30' : 'bg-gradient-to-r from-[hsl(142,76%,55%)]/20 to-[hsl(160,80%,55%)]/20 border-green-500/20'}`}>
                <Sparkles className={`h-3.5 w-3.5 ${limitReached ? 'text-red-500' : 'text-green-500'}`} />
                {loadingQuota ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
                ) : (
                  <span className={`text-xs font-bold ${limitReached ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{used}/{limit}</span>
                )}
              </div>
            </div>
          </div>

          {/* Unified content area */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            {/* Image upload - compact */}
            <div className="relative">
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer group h-full min-h-[200px]"
                >
                  <div className="h-full rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-[hsl(210,100%,65%)]/5 via-[hsl(280,70%,65%)]/5 to-[hsl(25,95%,60%)]/5 flex flex-col items-center justify-center gap-3 transition-all hover:border-primary hover:shadow-[0_0_30px_hsla(210,100%,65%,0.3)] active:scale-[0.98]">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#060541] to-[hsl(280,70%,35%)] shadow-lg shadow-primary/40 group-hover:shadow-xl group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                      <Upload className="h-7 w-7 text-white" />
                    </div>
                    <div className="text-center px-3">
                      <p className="font-semibold text-sm">
                        {language === 'ar' ? 'اختر صورة' : 'Choose Image'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === 'ar' ? 'PNG, JPG • 10MB' : 'PNG, JPG • 10MB'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative h-full min-h-[200px]">
                  <div className="h-full rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-primary/30">
                    <img
                      src={imagePreview}
                      alt="Selected"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Always visible X button */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                    onClick={clearImage}
                    disabled={isGenerating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {/* Change button at bottom */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full h-8 text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
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

            {/* Prompt & Generate - compact */}
            <div className="flex flex-col gap-3 relative">
              {/* Limit reached overlay */}
              {limitReached && (
                <div className="absolute inset-0 z-10 rounded-xl bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <div className="p-3 rounded-full bg-red-500/20">
                    <Lock className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-white font-semibold text-center px-4">
                    {language === 'ar' ? 'انتهت الفيديوهات الشهرية' : 'Monthly limit reached'}
                  </p>
                  <p className="text-white/60 text-xs text-center px-4">
                    {language === 'ar' ? `استخدمت ${used}/${limit} فيديو هذا الشهر` : `Used ${used}/${limit} videos this month`}
                  </p>
                </div>
              )}

              {/* Prompt textarea */}
              <div className="relative flex-1">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    language === 'ar'
                      ? 'صف الحركة المطلوبة...\n\nمثال: شخص يبتسم ويلوح بيده، قطة تحرك رأسها ببطء، سيارة تتحرك للأمام...'
                      : 'Describe the motion you want...\n\ne.g., A person smiling and waving, a cat slowly moving its head, a car driving forward...'
                  }
                  className="min-h-[140px] h-full text-sm resize-none rounded-xl border-2 border-primary/20 focus:border-primary bg-background/50 backdrop-blur-sm transition-all placeholder:text-muted-foreground/60"
                  maxLength={2500}
                  disabled={isGenerating || limitReached}
                />
                <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/50">{prompt.length}/2500</div>
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="self-start text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <span>{showAdvanced ? '▲' : '▼'}</span>
                <span>{language === 'ar' ? 'خيارات متقدمة' : 'Advanced'}</span>
              </button>

              {showAdvanced && (
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder={language === 'ar' ? 'ما تريد تجنبه: ضبابي، جودة منخفضة...' : 'What to avoid: blurry, low quality...'}
                  className="min-h-[60px] text-xs resize-none rounded-xl border border-muted bg-muted/30"
                  maxLength={2500}
                  disabled={isGenerating}
                />
              )}

              {/* Generate button */}
              <Button
                className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-[#060541] via-[hsl(260,70%,30%)] to-[hsl(280,70%,35%)] hover:from-[hsl(243,84%,18%)] hover:via-[hsl(260,70%,35%)] hover:to-[hsl(280,70%,40%)] shadow-[0_4px_20px_hsla(260,70%,50%,0.4)] hover:shadow-[0_6px_30px_hsla(260,70%,50%,0.5)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{generationStatus || (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    <span>{language === 'ar' ? 'إنشاء الفيديو ✨' : 'Generate Video ✨'}</span>
                  </div>
                )}
              </Button>

              {/* Progress bar during generation */}
              {isGenerating && (
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[hsl(210,100%,65%)] via-[hsl(280,70%,65%)] to-[hsl(142,76%,55%)] transition-all duration-500 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{generationStatus}</span>
                    <span className="font-medium text-primary">{generationProgress}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 text-center">
                    {language === 'ar' ? 'قد يستغرق الأمر 1-3 دقائق...' : 'This may take 1-3 minutes...'}
                  </p>
                </div>
              )}

              {/* Status messages */}
              {!imagePreview && !isGenerating && !limitReached && (
                <p className="text-center text-xs text-muted-foreground">
                  {language === 'ar' ? '← اختر صورة للبدء' : '← Select an image to start'}
                </p>
              )}
            </div>
          </div>

          {/* Generated video result - Mobile optimized, full width */}
          {generatedVideoUrl && (
            <div className="rounded-2xl overflow-hidden border-2 border-green-500/50 shadow-[0_0_60px_hsla(142,76%,55%,0.4)] bg-gradient-to-b from-green-500/5 to-transparent">
              {/* Video player - Full width, prominent */}
              <div className="relative bg-black">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full aspect-[9/16] max-h-[70vh] object-contain"
                />
                {/* Floating badge */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
                  {language === 'ar' ? '🎉 جاهز!' : '🎉 Ready!'}
                </div>
              </div>
              
              {/* Action buttons - Mobile friendly, large touch targets */}
              <div className="p-4 space-y-3">
                <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                  {language === 'ar' ? 'تم إنشاء الفيديو بنجاح!' : 'Video generated successfully!'}
                </p>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    className={`h-12 flex-col gap-1 rounded-xl ${
                      isSaved 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300'
                    }`}
                    onClick={handleSaveToMyVideos}
                    disabled={isSaving || isSaved}
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isSaved ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-medium">
                      {isSaved ? (language === 'ar' ? 'تم!' : 'Saved!') : (language === 'ar' ? 'حفظ' : 'Save')}
                    </span>
                  </Button>
                  
                  <Button 
                    className="h-12 flex-col gap-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300"
                    onClick={handleDownload}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'تحميل' : 'Download'}</span>
                  </Button>
                  
                  <Button 
                    className="h-12 flex-col gap-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'مشاركة' : 'Share'}</span>
                  </Button>
                </div>
                
                {/* Create another button */}
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl text-sm"
                  onClick={() => {
                    setGeneratedVideoUrl(null);
                    setIsSaved(false);
                    clearImage();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'إنشاء فيديو جديد' : 'Create Another Video'}
                </Button>
              </div>
            </div>
          )}

          {showLatestVideo && (
            <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-primary/5 to-transparent">
              <div className="relative bg-black">
                <video
                  src={latestVideo?.video_url || undefined}
                  controls
                  playsInline
                  className="w-full aspect-[9/16] max-h-[60vh] object-contain"
                />
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold shadow-lg">
                  {language === 'ar' ? 'آخر فيديو' : 'Latest Video'}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-center text-sm font-medium text-primary">
                  {language === 'ar' ? 'هذا آخر فيديو محفوظ' : 'This is your latest saved video'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button className="h-11 flex-col gap-1 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" disabled>
                    <Check className="h-5 w-5" />
                    <span className="text-[10px] font-medium">
                      {language === 'ar' ? 'محفوظ' : 'Saved'}
                    </span>
                  </Button>
                  <Button
                    className="h-11 flex-col gap-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300"
                    onClick={handleDownloadLatest}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'تحميل' : 'Download'}</span>
                  </Button>
                  <Button
                    className="h-11 flex-col gap-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300"
                    onClick={() => onSaveSuccess?.()}
                  >
                    <FolderOpen className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'المحفوظات' : 'Saved'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
