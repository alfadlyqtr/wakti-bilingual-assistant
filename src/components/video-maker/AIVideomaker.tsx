import React, { useState, useRef, useCallback, useEffect } from 'react';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
import { SavedImagesPicker } from '@/components/dashboard/SavedImagesPicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import TrialGateOverlay from '@/components/TrialGateOverlay';
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
  ArrowLeft,
  ArrowRight,
  Camera,
  Save,
  Check,
  Lock,
  FolderOpen,
  Type,
  GalleryHorizontalEnd,
  Images,
  Film,
  Pencil,
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
  storage_path?: string | null;
  duration_seconds: number | null;
  created_at: string;
  signedUrl?: string | null;
}

// Image compression helper
const compressImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas compression failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

const cleanSignedUrl = (url: string): string => {
  try {
    return decodeURI(url).trim();
  } catch {
    return url.replace(/%20/g, ' ').trim();
  }
};

export default function AIVideomaker({ onSaveSuccess }: AIVideomakerProps) {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const hasArabicChars = (text: string) => /[\u0600-\u06FF]/.test(text || '');

  // State
  const [generationMode, setGenerationModeRaw] = useState<'image_to_video' | 'text_to_video' | '2images_to_video' | 'cinema'>('image_to_video');
  const setGenerationMode = (mode: 'image_to_video' | 'text_to_video' | '2images_to_video' | 'cinema') => {
    setGenerationModeRaw(mode);
    if (mode === '2images_to_video') {
      setDuration('8');
    } else {
      setDuration('6');
    }
  };
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<'4' | '6' | '8' | '10' | '12' | '15'>('8');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p');
  const [videoStyleMode, setVideoStyleMode] = useState<'normal' | 'fun'>('normal');
  const [isAmping, setIsAmping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const [latestVideo, setLatestVideo] = useState<LatestVideo | null>(null);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [savedImages, setSavedImages] = useState<{id:string; image_url:string; submode:string; created_at:string}[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [pickingForSlot, setPickingForSlot] = useState<1 | 2>(1);
  const pollInFlightRef = useRef(false);
  const usageIncrementedRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Trial access check — Cinema is locked for 24-hour trial users
  const [isTrialUser, setIsTrialUser] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u?.id) return;
        const { data: p } = await (supabase as any)
          .from('profiles')
          .select('is_subscribed, admin_gifted, payment_method, next_billing_date, free_access_start_at')
          .eq('id', u.id)
          .single();
        if (!p || !mounted) return;
        const isPaid = p.is_subscribed === true;
        const isGifted = p.admin_gifted === true;
        const pm = p.payment_method;
        const hasActivePaid = pm && pm !== 'manual' && p.next_billing_date && new Date(p.next_billing_date) > new Date();
        const isOn24hTrial = p.free_access_start_at != null;
        if (!isPaid && !isGifted && !hasActivePaid && isOn24hTrial) {
          setIsTrialUser(true);
        }
      } catch { /* non-critical */ }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Cinema mode state
  const [cinemaVision, setCinemaVision] = useState('');
  const [cinemaScenes, setCinemaScenes] = useState<{scene: number; text: string; english_prompt: string; scene_pipeline?: string}[]>([]);
  const [isDirecting, setIsDirecting] = useState(false);
  const [isCinemaAmping, setIsCinemaAmping] = useState(false);
  const [cinemaStep, setCinemaStep] = useState<'desk' | 'storyboard' | 'casting' | 'filming' | 'premiere'>('desk');
  const [visualDNA, setVisualDNA] = useState('');
  const [subjectLock, setSubjectLock] = useState('');
  const [cinemaFormat, setCinemaFormat] = useState<'16:9' | '9:16' | '4:5'>('16:9');
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'tiktok' | 'instagram' | 'snapchat' | null>(null);
  const [selectedSubFormat, setSelectedSubFormat] = useState<string | null>(null);
  const [cinemaMode, setCinemaMode] = useState<'auto' | 'custom'>('auto');
  const [cinemaAudio, setCinemaAudio] = useState(true);

  // Role 2 & 3 — Artist & Cloner
  const [sceneImages, setSceneImages] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [sceneImageOptions, setSceneImageOptions] = useState<(string[] | null)[]>([null, null, null, null, null, null]);
  const [anchorImageUrl, setAnchorImageUrl] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [castingProgress, setCastingProgress] = useState<('idle' | 'loading' | 'done' | 'error')[]>(
    ['idle', 'idle', 'idle', 'idle', 'idle', 'idle']
  );
  const [activeCastingIdx, setActiveCastingIdx] = useState(0);

  // Role 4 — Animator
  const [videoClips, setVideoClips] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [animTaskIds, setAnimTaskIds] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [animProgress, setAnimProgress] = useState<('idle' | 'queued' | 'rendering' | 'done' | 'error')[]>(
    ['idle', 'idle', 'idle', 'idle', 'idle', 'idle']
  );
  const [isFilming, setIsFilming] = useState(false);
  const animPollRef = useRef<NodeJS.Timeout | null>(null);

  // Visual Supervisor — per-scene spatial motion briefs from Gemini Flash-Lite
  const [visualSupervisorPrompts, setVisualSupervisorPrompts] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [vsStatus, setVsStatus] = useState<('idle' | 'scanning' | 'done' | 'error')[]>(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);

  // Role 5 — Premiere
  const [isStitching, setIsStitching] = useState(false);
  const [stitchStatus, setStitchStatus] = useState(''); // e.g. "Waking up server..."
  const [premiereVideoUrl, setPremiereVideoUrl] = useState<string | null>(null);
  const [isCinemaSaving, setIsCinemaSaving] = useState(false);
  const [isCinemaSaved, setIsCinemaSaved] = useState(false);

  // Brand anchor — the master style/logo image uploaded in Visionnaire step 1
  const [brandAnchor, setBrandAnchor] = useState<string | null>(null);
  const [isUploadingBrand, setIsUploadingBrand] = useState(false);
  const [showBrandSavedPicker, setShowBrandSavedPicker] = useState(false);

  // Reference images — user-uploaded assets for Cinema
  // Index 0-5 = scene slots, index 6 = brand logo/reference anchor
  const [cinemaReferenceImages, setCinemaReferenceImages] = useState<(string | null)[]>([]);
  const [cinemaRefTags, setCinemaRefTags] = useState<string[]>([]); // 'scene1'..'scene6', 'logo', 'ref'
  const [isUploadingRef, setIsUploadingRef] = useState(false);

  // Smart-Tag: user-declared intent for the brand anchor image
  const [anchorTag, setAnchorTag] = useState<'logo' | 'style' | 'character'>('style');

  // Casting: per-scene regen modal
  const [castingRegenModal, setCastingRegenModal] = useState<{ sceneIdx: number } | null>(null);
  const [castingRegenNote, setCastingRegenNote] = useState('');
  const [castingRegenUseMaster, setCastingRegenUseMaster] = useState(true);
  const [isRegenningScene, setIsRegenningScene] = useState(false);
  const [castingRegenSceneAnchor, setCastingRegenSceneAnchor] = useState<string | null>(null);
  const [isUploadingRegenAnchor, setIsUploadingRegenAnchor] = useState(false);

  // Premiere: manual download fallback URL if save fails
  const [cinematicSaveFallbackUrl, setCinematicSaveFallbackUrl] = useState<string | null>(null);

  // Storyboard scene editing state
  const [editingSceneNum, setEditingSceneNum] = useState<number | null>(null); // which scene is being edited
  const [editingSceneText, setEditingSceneText] = useState('');
  const [regenSceneNum, setRegenSceneNum] = useState<number | null>(null); // which scene is regenerating

  // Cinema Visionnaire form state
  const [cinemaOpenSection, setCinemaOpenSection] = useState(0); // accordion open section index
  const [cinemaSubject, setCinemaSubject] = useState('');
  const [cinemaSetting, setCinemaSetting] = useState<string[]>([]);
  const [cinemaSettingCustom, setCinemaSettingCustom] = useState('');
  const [cinemaAction, setCinemaAction] = useState<string[]>([]);
  const [cinemaActionCustom, setCinemaActionCustom] = useState('');
  const [cinemaVibe, setCinemaVibe] = useState<string[]>([]);
  const [cinemaVibeCustom, setCinemaVibeCustom] = useState('');
  const [cinemaCharacters, setCinemaCharacters] = useState<string[]>([]);
  const [cinemaRelationship, setCinemaRelationship] = useState('');
  const [cinemaCTA, setCinemaCTA] = useState<string[]>([]);
  const [cinemaSceneCount, setCinemaSceneCount] = useState(3);
  const [cinemaSceneCountTouched, setCinemaSceneCountTouched] = useState(false);
  const [cinemaCTACustom, setCinemaCTACustom] = useState('');

  // Typewriter effect component for Cinema scene cards
  const TypewriterText = ({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) => {
    const [displayText, setDisplayText] = useState('');
    const [started, setStarted] = useState(false);

    useEffect(() => {
      const startTimeout = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(startTimeout);
    }, [delay]);

    useEffect(() => {
      if (!started) return;
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 15); // 15ms per character for smooth typing
      return () => clearInterval(interval);
    }, [text, started]);

    return (
      <span className={className}>
        {displayText}
        <span className="animate-pulse">|</span>
      </span>
    );
  };

  const invokePromptAmpWithBetterErrors = useCallback(
    async (body: Record<string, unknown>) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = SUPABASE_URL;
      const supabaseKey = SUPABASE_ANON_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/prompt-amp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify(body),
      });

      const txt = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(txt || `prompt-amp returned ${resp.status}`);
      }

      try {
        return { data: JSON.parse(txt) };
      } catch {
        throw new Error('Invalid JSON from prompt-amp');
      }
    },
    []
  );

  // Amp: generate/improve a cinematic prompt
  const handleAmp = useCallback(async () => {
    if (isAmping || isGenerating || !user) return;
    // Image mode requires an image; text mode requires a prompt; 2images mode requires both images
    if (generationMode === 'image_to_video' && !imagePreview) return;
    if (generationMode === 'text_to_video' && !prompt.trim()) return;
    if (generationMode === '2images_to_video' && (!imagePreview || !imagePreview2)) return;
    setIsAmping(true);
    try {
      if (generationMode === 'image_to_video') {
        // Image-to-Video amp: upload image then use OpenAI vision
        let ampImageUrl = '';
        try {
          const randomId = Math.random().toString(36).substring(2, 15);
          const storagePath = `${user.id}/ai-video-input/${randomId}.jpg`;

          let sourceBlob: Blob;
          if (imageFile) {
            sourceBlob = await compressImage(imageFile, 512, 0.5);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob = await compressImage(new File([previewBlob], 'preview.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob = await compressImage(new File([fetchedBlob], 'saved.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing image source');
          }

          console.log('[AIVideomaker] Amp: Uploading to message_attachments:', storagePath);
          const { error: uploadErr } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath, sourceBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.error('[AIVideomaker] Amp upload error:', uploadErr);
            throw new Error(`Upload failed: ${uploadErr.message}`);
          }

          const { data: signedData, error: signedErr } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath, 60 * 60 * 6);
          if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
          if (!signedData?.signedUrl) throw new Error('Signed URL missing');
          ampImageUrl = cleanSignedUrl(signedData.signedUrl);
          console.log('[AIVideomaker] Amp upload successful:', ampImageUrl);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Amp prepare error:', prepErr);
          throw new Error(
            language === 'ar'
              ? 'فشل تجهيز الصورة: ' + (prepErr?.message || '')
              : 'Failed to prepare image: ' + (prepErr?.message || '')
          );
        }

        const { data } = await invokePromptAmpWithBetterErrors({
          mode: 'image2video',
          image_url: ampImageUrl,
          brand_details: prompt.trim() || '',
          environment: 'auto',
          duration,
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      } else if (generationMode === '2images_to_video') {
        // 2Images-to-Video amp: upload both images then use OpenAI vision with dual images
        let ampImageUrl1 = '';
        let ampImageUrl2 = '';
        try {
          // Upload first image
          const randomId1 = Math.random().toString(36).substring(2, 15);
          const storagePath1 = `${user.id}/ai-video-input/${randomId1}_amp1.jpg`;

          let sourceBlob1: Blob;
          if (imageFile) {
            sourceBlob1 = await compressImage(imageFile, 512, 0.5);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob1 = await compressImage(new File([previewBlob], 'preview1.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob1 = await compressImage(new File([fetchedBlob], 'saved1.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing first image source');
          }

          console.log('[AIVideomaker] Amp: Uploading first image to message_attachments:', storagePath1);
          const { error: uploadErr1 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath1, sourceBlob1, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr1) {
            console.error('[AIVideomaker] Amp upload error (image1):', uploadErr1);
            throw new Error(`Upload failed (image1): ${uploadErr1.message}`);
          }

          const { data: signedData1, error: signedErr1 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath1, 60 * 60 * 6);
          if (signedErr1) throw new Error(`Signed URL failed (image1): ${signedErr1.message}`);
          if (!signedData1?.signedUrl) throw new Error('Signed URL missing (image1)');
          ampImageUrl1 = cleanSignedUrl(signedData1.signedUrl);
          console.log('[AIVideomaker] Amp first image uploaded:', ampImageUrl1);

          // Upload second image
          const randomId2 = Math.random().toString(36).substring(2, 15);
          const storagePath2 = `${user.id}/ai-video-input/${randomId2}_amp2.jpg`;

          let sourceBlob2: Blob;
          if (imageFile2) {
            sourceBlob2 = await compressImage(imageFile2, 512, 0.5);
          } else if (imagePreview2?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview2);
            sourceBlob2 = await compressImage(new File([previewBlob], 'preview2.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview2?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview2).then(r => r.blob());
            sourceBlob2 = await compressImage(new File([fetchedBlob], 'saved2.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing second image source');
          }

          console.log('[AIVideomaker] Amp: Uploading second image to message_attachments:', storagePath2);
          const { error: uploadErr2 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath2, sourceBlob2, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr2) {
            console.error('[AIVideomaker] Amp upload error (image2):', uploadErr2);
            throw new Error(`Upload failed (image2): ${uploadErr2.message}`);
          }

          const { data: signedData2, error: signedErr2 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath2, 60 * 60 * 6);
          if (signedErr2) throw new Error(`Signed URL failed (image2): ${signedErr2.message}`);
          if (!signedData2?.signedUrl) throw new Error('Signed URL missing (image2)');
          ampImageUrl2 = cleanSignedUrl(signedData2.signedUrl);
          console.log('[AIVideomaker] Amp second image uploaded:', ampImageUrl2);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Amp prepare error:', prepErr);
          throw new Error(
            language === 'ar'
              ? 'فشل تجهيز الصور: ' + (prepErr?.message || '')
              : 'Failed to prepare images: ' + (prepErr?.message || '')
          );
        }

        const { data } = await invokePromptAmpWithBetterErrors({
          mode: '2images2video',
          image_url_1: ampImageUrl1,
          image_url_2: ampImageUrl2,
          user_text: prompt.trim() || '',
          duration,
          aspect_ratio: aspectRatio,
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      } else {
        // Text-to-Video amp: enhance/translate the text prompt via DeepSeek
        const { data } = await invokePromptAmpWithBetterErrors({
          mode: 'text2video',
          text: prompt.trim(),
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      }
    } catch (err: any) {
      console.error('[AIVideomaker] Amp error:', err);
      toast.error(language === 'ar' ? 'فشل تحسين الوصف: ' + (err.message || '') : 'Failed to amp: ' + (err.message || ''));
    } finally {
      setIsAmping(false);
    }
  }, [generationMode, imagePreview, imagePreview2, imageFile, imageFile2, isAmping, isGenerating, prompt, duration, aspectRatio, language, user, invokePromptAmpWithBetterErrors]);

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
        limit: q?.videos_limit || 80,
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
        .select('id, title, video_url, storage_path, duration_seconds, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (row?.storage_path) {
        let signedUrl: string | null = null;
        const { data: urlData, error: urlErr } = await supabase.storage
          .from('videos')
          .createSignedUrl(row.storage_path, 3600);
        if (urlErr) {
          const { data: pubData } = supabase.storage.from('videos').getPublicUrl(row.storage_path);
          signedUrl = pubData?.publicUrl || null;
        } else {
          signedUrl = urlData?.signedUrl || null;
        }

        if (signedUrl) {
          setLatestVideo({ ...row, signedUrl });
        }
      }
    } catch (e) {
      console.error('Failed to load latest video:', e);
    }
  }, [user]);

  useEffect(() => {
    loadLatestVideo();
  }, [loadLatestVideo]);

  // Fetch saved images for picker
  const fetchSavedImages = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url, submode, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setSavedImages((data || []).map((img: any) => ({
        ...img,
        image_url: (img.image_url || '').replace(/%20/g, ' ').trim(),
      })));
    } catch (e) {
      console.error('Failed to fetch saved images:', e);
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  const handlePickSaved = (url: string) => {
    if (pickingForSlot === 1) {
      setImageFile(null);
      setImagePreview(url);
    } else {
      setImageFile2(null);
      setImagePreview2(url);
    }
    setGeneratedVideoUrl(null);
    setShowSavedPicker(false);
  };

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

  const handleImageSelect2 = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setImageFile2(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview2(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setGeneratedVideoUrl(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setGeneratedVideoUrl(null);
    setSourceImagePath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearImage2 = () => {
    setImageFile2(null);
    setImagePreview2(null);
    setGeneratedVideoUrl(null);
    if (fileInputRef2.current) {
      fileInputRef2.current.value = '';
    }
  };

  const handleDownloadLatest = async () => {
    const downloadUrl = latestVideo?.signedUrl || latestVideo?.video_url;
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
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
      window.open(downloadUrl, '_blank');
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
      console.log('[AIVideomaker] Full data on poll:', JSON.stringify(data));

      if (status === 'completed' || status === 'succeed' || status === 'succeeded') {
        // Done!
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        usageIncrementedRef.current = true;
        // Video URL is in generated array, NOT video.url!
        const videoUrl = data?.data?.generated?.[0] || data?.data?.video?.url;
        console.log('[AIVideomaker] Extracted videoUrl:', videoUrl);
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
      setGenerationStatus('');
      const msg = e?.message || '';
      const userMsg = msg.includes('generation failed')
        ? (language === 'ar' ? 'فشل إنشاء الفيديو. حاول بصورة أو وصف مختلف.' : 'Video generation failed. Try a different image or prompt.')
        : (msg || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
      toast.error(userMsg);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [language, loadQuota, loadLatestVideo]);

  const handleGenerate = async () => {
    // Validate based on mode
    if (generationMode === 'image_to_video' && !imagePreview) return;
    if (generationMode === 'text_to_video' && !prompt.trim()) return;
    if (generationMode === '2images_to_video' && !imagePreview) return;
    if (generationMode === 'cinema' && !prompt.trim()) return;
    if (!user) return;

    const needsArabicTranslation =
      language === 'ar' &&
      hasArabicChars(prompt) &&
      (generationMode === 'text_to_video' ||
        (generationMode === 'image_to_video' && prompt.trim().length > 0));
    if (needsArabicTranslation) return;

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
    setGeneratedVideoUrl(null);
    usageIncrementedRef.current = false;

    try {
      let requestBody: Record<string, unknown>;
      const endingDirective = language === 'ar'
        ? 'اختم بمشهد يهدأ تدريجياً مع تلاشي لطيف في النهاية.'
        : 'End with a smooth wind-down and a gentle fade-out.';
      const basePrompt = prompt.trim();
      const finalPrompt = basePrompt ? `${basePrompt}\n${endingDirective}` : endingDirective;

      if (generationMode === 'text_to_video') {
        // Text-to-Video: no image upload needed
        setGenerationStatus(language === 'ar' ? 'جاري بدء الإنشاء...' : 'Starting generation...');

        requestBody = {
          generation_type: 'text_to_video',
          prompt: finalPrompt,
          duration,
          aspect_ratio: aspectRatio,
          resolution,
          video_style_mode: videoStyleMode,
          mode: 'async',
        };
      } else if (generationMode === 'image_to_video') {
        // Image-to-Video: always compress + upload image to get a signed https URL
        setGenerationStatus(language === 'ar' ? 'جاري رفع الصورة...' : 'Uploading image...');
        let imageUrl = '';
        try {
          const randomId = Math.random().toString(36).substring(2, 15);
          const storagePath = `${user.id}/ai-video-input/${randomId}.jpg`;

          let sourceBlob: Blob;
          if (imageFile) {
            sourceBlob = await compressImage(imageFile, 1024, 0.7);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob = await compressImage(new File([previewBlob], 'preview.jpg', { type: 'image/jpeg' }), 1024, 0.7);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob = await compressImage(new File([fetchedBlob], 'saved.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
          } else {
            throw new Error('Missing image source');
          }

          console.log('[AIVideomaker] Uploading to message_attachments:', storagePath, 'size:', sourceBlob.size);

          const { error: uploadErr } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath, sourceBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.error('[AIVideomaker] Storage upload error details:', uploadErr);
            throw new Error(`Upload failed: ${uploadErr.message}`);
          }

          const { data: signedData, error: signedErr } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath, 60 * 60 * 6);
          if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
          if (!signedData?.signedUrl) throw new Error('Signed URL missing');
          imageUrl = signedData.signedUrl;
          setSourceImageUrl(imageUrl);
          setSourceImagePath(storagePath);
          console.log('[AIVideomaker] Upload successful, URL:', imageUrl);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Prepare image error:', prepErr);
          throw prepErr;
        }

        requestBody = {
          generation_type: 'image_to_video',
          image: imageUrl,
          prompt: finalPrompt,
          duration,
          aspect_ratio: aspectRatio,
          resolution,
          video_style_mode: videoStyleMode,
          mode: 'async',
        };
      } else if (generationMode === '2images_to_video') {
        setGenerationStatus(language === 'ar' ? 'جاري رفع الصور...' : 'Uploading images...');
        let imageUrl1 = '';

        try {
          const randomId1 = Math.random().toString(36).substring(2, 15);
          const storagePath1 = `${user.id}/ai-video-input/${randomId1}_1.jpg`;
          let sourceBlob1: Blob;
          if (imageFile) {
            sourceBlob1 = await compressImage(imageFile, 1024, 0.7);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob1 = await compressImage(new File([previewBlob], 'preview1.jpg', { type: 'image/jpeg' }), 1024, 0.7);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob1 = await compressImage(new File([fetchedBlob], 'saved1.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
          } else {
            throw new Error('Missing first image source');
          }
          const { error: uploadErr1 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath1, sourceBlob1, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
          if (uploadErr1) throw new Error(`First image upload failed: ${uploadErr1.message}`);
          const { data: signedData1, error: signedErr1 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath1, 60 * 60 * 6);
          if (signedErr1) throw new Error(`First image signed URL failed: ${signedErr1.message}`);
          if (!signedData1?.signedUrl) throw new Error('First image signed URL missing');
          imageUrl1 = signedData1.signedUrl;

          if (imagePreview2) {
            // Both images present — use Seedance 2images model
            const randomId2 = Math.random().toString(36).substring(2, 15);
            const storagePath2 = `${user.id}/ai-video-input/${randomId2}_2.jpg`;
            let sourceBlob2: Blob;
            if (imageFile2) {
              sourceBlob2 = await compressImage(imageFile2, 1024, 0.7);
            } else if (imagePreview2.startsWith('data:')) {
              const previewBlob = await dataUrlToBlob(imagePreview2);
              sourceBlob2 = await compressImage(new File([previewBlob], 'preview2.jpg', { type: 'image/jpeg' }), 1024, 0.7);
            } else if (imagePreview2.startsWith('http')) {
              const fetchedBlob = await fetch(imagePreview2).then(r => r.blob());
              sourceBlob2 = await compressImage(new File([fetchedBlob], 'saved2.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
            } else {
              throw new Error('Missing second image source');
            }
            const { error: uploadErr2 } = await supabase.storage
              .from('message_attachments')
              .upload(storagePath2, sourceBlob2, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
            if (uploadErr2) throw new Error(`Second image upload failed: ${uploadErr2.message}`);
            const { data: signedData2, error: signedErr2 } = await supabase.storage
              .from('message_attachments')
              .createSignedUrl(storagePath2, 60 * 60 * 6);
            if (signedErr2) throw new Error(`Second image signed URL failed: ${signedErr2.message}`);
            if (!signedData2?.signedUrl) throw new Error('Second image signed URL missing');
            const imageUrl2 = signedData2.signedUrl;

            requestBody = {
              generation_type: '2images_to_video',
              image1: imageUrl1,
              image2: imageUrl2,
              prompt: finalPrompt,
              duration,
              aspect_ratio: aspectRatio,
              resolution,
              mode: 'async',
            };
          } else {
            // Only one image — fall back to grok image_to_video
            requestBody = {
              generation_type: 'image_to_video',
              image: imageUrl1,
              prompt: finalPrompt,
              duration,
              aspect_ratio: aspectRatio,
              resolution,
              video_style_mode: videoStyleMode,
              mode: 'async',
            };
          }
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Prepare images error:', prepErr);
          throw prepErr;
        }
      }

      setGenerationProgress(10);
      setGenerationStatus(language === 'ar' ? 'جاري بدء الإنشاء...' : 'Starting generation...');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: requestBody,
      });

      if (error) {
        throw new Error(error.message || 'Failed to start video generation');
      }

      if (data?.error === 'TRIAL_LIMIT_REACHED') {
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: data?.feature || 'i2v' } }));
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
        return;
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

  // Cinema: handle directing (GPT-4o mini)
  const handleDirect = useCallback(async () => {
    // Multi-select arrays: join into comma-separated string; fallback to custom text
    const hasCustomVibe = cinemaVibe.includes('Custom');
    const hasCustomSetting = cinemaSetting.includes('Custom');
    const hasCustomAction = cinemaAction.includes('Custom');
    const effectiveVibe = hasCustomVibe
      ? [cinemaVibeCustom].filter(Boolean).join(', ')
      : cinemaVibe.filter(v => v !== 'Custom').join(', ');
    const effectiveSetting = hasCustomSetting
      ? [cinemaSettingCustom].filter(Boolean).join(', ')
      : cinemaSetting.filter(v => v !== 'Custom').join(', ');
    const effectiveAction = hasCustomAction
      ? [cinemaActionCustom].filter(Boolean).join(', ')
      : cinemaAction.filter(v => v !== 'Custom').join(', ');
    const effectiveCTA = cinemaCTA.filter(v => v !== 'Custom').join(', ');
    const effectiveCharacters = cinemaCharacters.includes('Custom') ? (cinemaRelationship || 'custom characters') : cinemaCharacters.filter(v => v !== 'Custom').join(', ');
    const builtVision = [
      cinemaSubject && `Subject: ${cinemaSubject}`,
      effectiveSetting && `Setting: ${effectiveSetting}`,
      effectiveAction && `Action: ${effectiveAction}`,
      effectiveVibe && `Vibe: ${effectiveVibe}`,
      effectiveCharacters && `Cast: ${effectiveCharacters}${!cinemaCharacters.includes('Custom') && cinemaRelationship ? ` (${cinemaRelationship})` : ''}`,
      effectiveCTA && `Goal: ${effectiveCTA}`,
      brandAnchor && anchorTag === 'logo' && `Brand asset provided: a LOGO/TEXT mark — Scene 1 must describe the visual scene that the logo will be composited onto; do NOT describe the logo itself`,
      brandAnchor && anchorTag === 'style' && `Brand reference image provided: use ONLY its color palette, lighting mood, and atmosphere — do NOT mention logos, brand marks, emblems, or text`,
      brandAnchor && anchorTag === 'character' && `Character reference image provided: describe the actions and journey of this specific character throughout all scenes`,
      selectedSubFormat && (() => {
        const sf = selectedSubFormat;
        if(sf.includes('YouTube Standard')) return `Format: YouTube Standard Video (16:9 widescreen) — optimize for cinematic widescreen storytelling with wide establishing shots and deliberate pacing`;
        if(sf.includes('YouTube Shorts')) return `Format: YouTube Shorts (9:16 vertical) — optimize for high-energy vertical mobile viewing; fast hook in first 2 seconds`;
        if(sf.includes('Instagram Reels')) return `Format: Instagram Reel (9:16 vertical) — optimize for high-energy mobile viewing; bold visuals, trendy pacing, immediate visual hook`;
        if(sf.includes('Instagram Feed')) return `Format: Instagram Feed Post (4:5 vertical) — bold clean composition for the feed; strong central subject, immediate visual impact`;
        if(sf.includes('Instagram Story')) return `Format: Instagram Story (9:16 vertical) — full-screen immersive vertical; intimate tone, ephemeral feel`;
        if(sf.includes('TikTok')) return `Format: TikTok Vertical (9:16) — optimize for vertical viewing with high-impact visuals for the mobile feed; fast hooks, energetic pacing, trending aesthetic`;
        if(sf.includes('Snapchat')) return `Format: Snapchat Story (9:16 vertical) — full-screen vertical; playful, authentic, immediate visual engagement`;
        return `Format: ${sf} — optimize for the selected platform and aspect ratio`;
      })(),
    ].filter(Boolean).join('. ');

    // Chips lead as production requirements; user's written vision follows as the story description.
    // This ensures the Director reads both equally — chips set the brief, vision tells the story.
    const visionToSend = cinemaVision.trim() && builtVision
      ? `PRODUCTION BRIEF:\n${builtVision}\n\nSTORY VISION:\n${cinemaVision.trim()}`
      : cinemaVision.trim() || builtVision;
    if (!visionToSend || isDirecting || !user) return;
    setIsDirecting(true);
    setCinemaScenes([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      // Call the cinema-director edge function
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-director`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          vision: visionToSend,
          language: language,
          scene_count: cinemaSceneCount,
          brand_anchor_url: brandAnchor || undefined,
          anchor_tag: brandAnchor ? anchorTag : undefined,
        }),
      });

      const txt = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(txt || `cinema-director returned ${resp.status}`);
      }

      let result;
      try {
        result = JSON.parse(txt);
      } catch {
        throw new Error('Invalid JSON from cinema-director');
      }

      if (result?.success && result?.scenes && Array.isArray(result.scenes)) {
        setCinemaScenes(result.scenes);
        setVisualDNA(result.visualDna || '');
        setSubjectLock(result.subject_lock || '');
        setCinemaStep('storyboard');
        toast.success(language === 'ar' ? 'تم إنشاء السيناريو!' : 'Script created!');
      } else {
        throw new Error(result?.error || 'No scenes returned');
      }
    } catch (err: any) {
      console.error('[AIVideomaker] Direct error:', err);
      toast.error(language === 'ar' ? 'فشل إنشاء السيناريو: ' + (err.message || '') : 'Failed to create script: ' + (err.message || ''));
    } finally {
      setIsDirecting(false);
    }
  }, [cinemaVision, cinemaSubject, cinemaSetting, cinemaSettingCustom, cinemaAction, cinemaActionCustom, cinemaVibe, cinemaVibeCustom, cinemaCharacters, cinemaRelationship, cinemaCTA, isDirecting, language, user, brandAnchor, cinemaSceneCount]);

  // ── Role 2 & 3: Artist & Cloner ──
  // Uses create/status two-call pattern to avoid edge function 60s timeout.
  // Step 1: fire T2I create for Scene 1 → get task_id
  // Step 2: poll until Scene 1 done → get anchor image URL
  // Step 3: fire I2I create for Scenes 2-6 in parallel
  // Step 4: poll all I2I tasks from frontend every 5s
  const handleCast = useCallback(async () => {
    if (!user || isCasting || cinemaScenes.length < cinemaSceneCount) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;

    setIsCasting(true);
    setAnchorImageUrl(null);
    setSceneImages([null, null, null, null, null, null]);
    setSceneImageOptions([null, null, null, null, null, null]);
    setActiveCastingIdx(0);
    setCastingProgress(Array.from({length: 6}, (_, i) => i === 0 ? 'loading' : 'idle') as ('idle'|'loading'|'done'|'error')[]);
    setCinemaStep('casting');

    const artistCall = async (body: Record<string, unknown>) => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-artist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || `cinema-artist ${resp.status}`);
      return json;
    };

    // Poll a single task until COMPLETED or FAILED (max 3 min, 5s intervals)
    // Returns { url: string, options: string[] } — options holds all images KIE returned
    const pollTask = async (task_id: string, scene_index: number): Promise<{ url: string; options: string[] }> => {
      for (let i = 0; i < 36; i++) {
        await new Promise(r => setTimeout(r, 5000));
        // BD-2: artistCall itself may throw on network error — catch and treat as FAILED
        let res: any;
        try {
          res = await artistCall({ mode: 'status', task_id, scene_index });
        } catch {
          throw new Error('Image generation failed');
        }
        if (res.status === 'COMPLETED' && res.image_url) {
          const opts: string[] = Array.isArray(res.image_urls) && res.image_urls.length > 0 ? res.image_urls : [res.image_url];
          return { url: res.image_url as string, options: opts };
        }
        if (res.status === 'FAILED') throw new Error(res.error || 'Image generation failed');
        // If network error on status (FAILED from kieGetStatus), continue retrying up to max
      }
      throw new Error('Image generation timed out');
    };

    try {
      const scene1 = cinemaScenes.find(s => s.scene === 1);
      if (!scene1) throw new Error('Scene 1 not found');
      // Use english_prompt for all AI image calls — image models don't understand Arabic well
      const ep1 = scene1.english_prompt || scene1.text;

      // ── Build scene-slot map from tags ──
      // logo/ref tagged images are used as visual anchor (style reference) for all AI scenes
      // scene-tagged images (scene1..scene6) go directly to that slot index
      const sceneSlotMap: Record<number, string> = {}; // idx → url for direct-use
      let logoAnchor: string | null = null; // brand logo or reference image

      cinemaReferenceImages.forEach((url, slotIdx) => {
        if (!url) return;
        const tag = cinemaRefTags[slotIdx] || 'ref'; // default: treat untagged images as visual reference
        if (tag === 'logo' || tag === 'ref') {
          logoAnchor = url; // use as style anchor for AI-generated scenes
        } else {
          // tag is 'scene1'..'scene6' — extract scene number
          const sceneNum = parseInt(tag.replace('scene', ''), 10);
          if (!isNaN(sceneNum) && sceneNum >= 1 && sceneNum <= 6) {
            sceneSlotMap[sceneNum - 1] = url; // 0-indexed
          }
        }
      });

      // ── Smart-Tag pipeline selection ──
      // Pipeline A (logo):      True I2I — brandAnchor sent as source image; AI generates new background around it
      // Pipeline B (style):     Dual-anchor ghost-cure — brandAnchor=style@0.45, prevAnchor=motion
      // Pipeline C (character): I2I at 0.72 strength to preserve facial/body identity across scenes
      const effectiveTag = brandAnchor ? anchorTag : 'style';

      // ── Scene 1 — Unified multi-take logic (no auto-select bias) ──
      if (sceneSlotMap[0]) {
        // User pre-filled scene 1 via reference slot — use directly
        setSceneImages(prev => { const n = [...prev]; n[0] = sceneSlotMap[0]; return n; });
        setSceneImageOptions(prev => { const n = [...prev]; n[0] = null; return n; });
        setAnchorImageUrl(sceneSlotMap[0]);
        setCastingProgress(prev => { const n = [...prev]; n[0] = 'done'; for (let i = 1; i < cinemaSceneCount; i++) n[i] = 'loading'; return n; });
      } else {
        // Set scene 1 + all others to loading
        setCastingProgress(prev => { const n = [...prev]; for (let i = 0; i < cinemaSceneCount; i++) n[i] = 'loading'; return n; });
        try {
          let created;
          if (effectiveTag === 'logo' && brandAnchor) {
            created = await artistCall({ mode: 'i2i_create', prompt: ep1, anchor_url: brandAnchor, anchor_pipeline: 'logo', scene_index: 0 });
          } else if (effectiveTag === 'character' && brandAnchor) {
            created = await artistCall({ mode: 'i2i_create', prompt: ep1, anchor_url: brandAnchor, anchor_pipeline: 'character', scene_index: 0 });
          } else {
            created = await artistCall({ mode: 't2i_create', prompt: ep1, aspect_ratio: cinemaFormat });
          }
          const { url: s1url, options: s1opts } = await pollTask(created.task_id, 0);
          // Always store in options — never auto-pick, even for single image.
          // User must tap "Pick your shot" just like Scenes 2-N.
          const optsToShow = s1opts.length >= 1 ? s1opts : [s1url];
          setSceneImageOptions(prev => { const n = [...prev]; n[0] = optsToShow; return n; });
          setSceneImages(prev => { const n = [...prev]; n[0] = null; return n; });
          // Don't set anchorImageUrl yet — wait for user pick
          setCastingProgress(prev => { const n = [...prev]; n[0] = 'done'; for (let i = 1; i < cinemaSceneCount; i++) n[i] = 'loading'; return n; });
        } catch (s1err: any) {
          console.error('[cinema] Scene 1 failed:', s1err);
          setCastingProgress(prev => { const n = [...prev]; n[0] = 'error'; for (let i = 1; i < cinemaSceneCount; i++) n[i] = 'loading'; return n; });
        }
      }

      // ── Scenes 2-N: PARALLEL pipeline-aware generation using Director's Production Contract ──
      // IDENTITY MUTE: When anchorTag === 'logo', only the bookend scenes (S1 & SN) use I2I.
      // Middle scenes (S2..SN-1) are muted to T2I with the subject lock text — this prevents
      // the logo pixels from ghosting onto trucks, people, and backgrounds.
      const remainingScenes = cinemaScenes
        .filter(s => s.scene >= 2 && s.scene <= cinemaSceneCount)
        .sort((a, b) => a.scene - b.scene);

      await Promise.allSettled(remainingScenes.map(async (scene) => {
        const idx = scene.scene - 1;
        if (sceneSlotMap[idx]) {
          setSceneImages(prev => { const n = [...prev]; n[idx] = sceneSlotMap[idx]; return n; });
          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
          return;
        }
        try {
          let created;
          // Subject Lock enforcement: prepend the locked subject string to every prompt
          // LOGO FILTER: If subjectLock contains branding words, skip it for style_extraction scenes
          const rawPrompt = scene.english_prompt || scene.text;
          const scenePipelineTag = scene.scene_pipeline || 'style_extraction';
          const lockIsPoisoned = subjectLock && /\b(logo|brand|emblem|wordmark|insignia)\b/i.test(subjectLock);
          const useSubjectLock = subjectLock && !lockIsPoisoned && scenePipelineTag !== 'logo_integration';
          const epScene = useSubjectLock && !rawPrompt.startsWith(subjectLock) ? `${subjectLock}. ${rawPrompt}` : rawPrompt;
          // Director's scene_pipeline tag
          const scenePipeline = scene.scene_pipeline || 'style_extraction';

          // Identity Mute: middle scenes in logo mode are pure T2I (no anchor sent to KIE)
          // S1-3: S2..SN-1 muted. S1-4: SN (last scene) treated as bookend — I2I like S1.
          const isLogoMode = effectiveTag === 'logo' && brandAnchor;
          const isLastScene = scene.scene === cinemaSceneCount;
          const isMuted = isLogoMode && !isLastScene; // middle scenes muted

          if (isMuted) {
            // MUTED: pure T2I — subject lock text keeps subject consistent, zero logo leak
            created = await artistCall({
              mode: 't2i_create',
              prompt: epScene,
              aspect_ratio: cinemaFormat,
              scene_index: idx,
            });
          } else if ((scenePipeline === 'logo_integration' || isLastScene) && isLogoMode) {
            // S1-4: Last scene bookend OR explicit logo_integration tag — I2I with brand anchor
            created = await artistCall({
              mode: 'i2i_create',
              prompt: epScene,
              anchor_url: brandAnchor,
              anchor_pipeline: 'logo',
              scene_index: idx,
            });
          } else if (scenePipeline === 'character_lock' && brandAnchor) {
            // Character lock: high-strength I2I for face/body consistency
            created = await artistCall({
              mode: 'i2i_create',
              prompt: epScene,
              anchor_url: brandAnchor,
              anchor_pipeline: 'character',
              scene_index: idx,
            });
          } else {
            // style_extraction (default): always T2I — never send anchor to KIE for style scenes
            created = await artistCall({
              mode: 't2i_create',
              prompt: epScene,
              aspect_ratio: cinemaFormat,
              scene_index: idx,
            });
          }
          const { url: imgUrl, options: imgOptions } = await pollTask(created.task_id, idx);
          if (imgOptions.length >= 2) {
            // BD-3: 2 images returned — store options, do NOT auto-select, wait for user pick
            setSceneImageOptions(prev => { const n = [...prev]; n[idx] = imgOptions; return n; });
            setSceneImages(prev => { const n = [...prev]; n[idx] = null; return n; });
            setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
          } else {
            // Only 1 image — auto-select as before
            setSceneImages(prev => { const n = [...prev]; n[idx] = imgUrl; return n; });
            setSceneImageOptions(prev => { const n = [...prev]; n[idx] = null; return n; });
            setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
          }
        } catch (err: any) {
          console.error(`[cinema] scene ${idx + 1} failed:`, err);
          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
        }
      }));

      toast.success(language === 'ar' ? 'تم إنشاء الصور!' : 'Scenes cast!');
    } catch (err: any) {
      console.error('[cinema] Cast error:', err);
      toast.error(language === 'ar' ? 'فشل إنشاء الصور: ' + err.message : 'Casting failed: ' + err.message);
      setCinemaStep('storyboard');
    } finally {
      setIsCasting(false);
    }
  }, [user, isCasting, cinemaScenes, cinemaFormat, language, cinemaReferenceImages, anchorTag, brandAnchor, subjectLock]);

  // ── Visual Supervisor: fire-and-forget per-scene spatial analysis ──
  // Called immediately when user picks Shot A or B. Runs in background, no await needed.
  const runVisualSupervisor = useCallback(async (idx: number, imageUrl: string, sceneScript: string) => {
    setVsStatus(prev => { const n = [...prev]; n[idx] = 'scanning'; return n; });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ image_url: imageUrl, scene_script: sceneScript, scene_index: idx }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || `cinema-vision ${resp.status}`);
      setVisualSupervisorPrompts(prev => { const n = [...prev]; n[idx] = json.brief; return n; });
      setVsStatus(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
      console.log(`[cinema] VS scene ${idx} brief: ${json.brief?.slice(0, 80)}`);
    } catch (err) {
      console.warn(`[cinema] VS scene ${idx} failed (will use fallback):`, err);
      setVsStatus(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
    }
  }, []);

  // ── Role 4: Animator ──
  // Fires 6 parallel I2V tasks then polls until all done
  const handleFilm = useCallback(async () => {
    if (!user || isFilming) return;
    const images = sceneImages;
    if (images.slice(0, cinemaSceneCount).some(img => img === null)) {
      toast.error(language === 'ar' ? 'لم تكتمل جميع الصور بعد' : 'Not all scene images are ready');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;

    setIsFilming(true);
    setVideoClips(Array(cinemaSceneCount).fill(null));
    setAnimTaskIds(Array(cinemaSceneCount).fill(null));
    setAnimProgress(Array(cinemaSceneCount).fill('queued'));
    setCinemaStep('filming');

    const callAnimator = async (body: Record<string, unknown>) => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-animator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || `cinema-animator ${resp.status}`);
      return json;
    };

    try {
      // Fire all N I2V tasks in parallel
      const taskResults = await Promise.allSettled(
        images.slice(0, cinemaSceneCount).map(async (imgUrl, idx) => {
          const scene = cinemaScenes[idx];
          // Visual Supervisor brief takes priority — it maps actual pixel physics.
          // Fallback chain: VS brief → english_prompt → scene text
          const motionPrompt = visualSupervisorPrompts[idx] || scene?.english_prompt || scene?.text || '';
          const result = await callAnimator({
            mode: 'create',
            image_url: imgUrl,
            prompt: motionPrompt,
            scene_index: idx,
          });
          setAnimTaskIds(prev => { const n = [...prev]; n[idx] = result.task_id; return n; });
          setAnimProgress(prev => { const n = [...prev]; n[idx] = 'rendering'; return n; });
          return { idx, task_id: result.task_id };
        })
      );

      // Collect successful task ids
      const activeTasks: { idx: number; task_id: string }[] = [];
      taskResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          activeTasks.push(r.value);
        } else {
          setAnimProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
        }
      });

      // Poll all active tasks every 6s until all done
      const pollTasks = async () => {
        const pending = [...activeTasks];
        while (pending.length > 0) {
          await new Promise(r => setTimeout(r, 6000));
          const toRemove: number[] = [];
          await Promise.allSettled(
            pending.map(async ({ idx, task_id }) => {
              try {
                const status = await callAnimator({ mode: 'status', task_id, scene_index: idx });
                if (status.status === 'COMPLETED' && status.video_url) {
                  setVideoClips(prev => { const n = [...prev]; n[idx] = status.video_url; return n; });
                  setAnimProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
                  toRemove.push(idx);
                  // Deduct 1 credit per completed scene
                  supabase.rpc('increment_ai_video_usage', { p_user_id: user!.id }).then(() => loadQuota());
                } else if (status.status === 'FAILED') {
                  setAnimProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
                  toRemove.push(idx);
                }
              } catch (e) {
                console.error(`[cinema] Poll scene ${idx} failed:`, e);
              }
            })
          );
          toRemove.forEach(idx => {
            const pos = pending.findIndex(t => t.idx === idx);
            if (pos !== -1) pending.splice(pos, 1);
          });
        }
      };

      await pollTasks();
      toast.success(language === 'ar' ? 'تم تصوير جميع المشاهد!' : 'All scenes filmed!');
    } catch (err: any) {
      console.error('[cinema] Film error:', err);
      toast.error(language === 'ar' ? 'فشل التصوير: ' + err.message : 'Filming failed: ' + err.message);
    } finally {
      setIsFilming(false);
    }
  }, [user, isFilming, sceneImages, cinemaScenes, language, loadQuota, visualSupervisorPrompts]);

  // ── Role 4b: Retry single failed animation ──
  const handleRetryFilm = useCallback(async (idx: number) => {
    const imgUrl = sceneImages[idx];
    if (!imgUrl || !user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;

    setAnimProgress(prev => { const n = [...prev]; n[idx] = 'queued'; return n; });
    setVideoClips(prev => { const n = [...prev]; n[idx] = null; return n; });
    setAnimTaskIds(prev => { const n = [...prev]; n[idx] = null; return n; });

    const callAnimator = async (body: Record<string, unknown>) => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-animator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || `cinema-animator ${resp.status}`);
      return json;
    };

    try {
      const scene = cinemaScenes[idx];
      const motionPrompt = visualSupervisorPrompts[idx] || scene?.english_prompt || scene?.text || '';
      const result = await callAnimator({
        mode: 'create',
        image_url: imgUrl,
        prompt: motionPrompt,
        scene_index: idx,
      });
      setAnimTaskIds(prev => { const n = [...prev]; n[idx] = result.task_id; return n; });
      setAnimProgress(prev => { const n = [...prev]; n[idx] = 'rendering'; return n; });

      // Poll this single task
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 6000));
        try {
          const status = await callAnimator({ mode: 'status', task_id: result.task_id, scene_index: idx });
          if (status.status === 'COMPLETED' && status.video_url) {
            setVideoClips(prev => { const n = [...prev]; n[idx] = status.video_url; return n; });
            setAnimProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
            supabase.rpc('increment_ai_video_usage', { p_user_id: user.id }).then(() => loadQuota());
            done = true;
          } else if (status.status === 'FAILED') {
            setAnimProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
            done = true;
          }
        } catch (e) {
          console.error(`[cinema] Retry poll scene ${idx} failed:`, e);
        }
      }
    } catch (err: any) {
      console.error(`[cinema] Retry scene ${idx} error:`, err);
      setAnimProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
      toast.error(language === 'ar' ? `فشل تحريك المشهد ${idx + 1}` : `Scene ${idx + 1} animation failed`);
    }
  }, [user, sceneImages, cinemaScenes, language, loadQuota, visualSupervisorPrompts]);

  // ── Role 5: Premiere — Cloud Studio stitch via Vercel API + FFmpeg ──
  // Sends clip URLs to /api/video/stitch, which downloads them server-side,
  // runs FFmpeg xfade+acrossfade for smooth 1s transitions, uploads the final
  // MP4 to Supabase Storage, and returns the permanent public URL.
  const handleStitch = useCallback(async () => {
    const readyClips = videoClips.filter(Boolean) as string[];
    if (readyClips.length < 1 || isStitching) return;
    setIsStitching(true);
    setStitchStatus(language === 'ar' ? '🎬 استوديو Wakti السحابي يُجهّز تحفتك السينمائية...' : '🎬 Wakti Cloud Studio is rendering your Wakti Cinema Masterpiece...');

    try {
      // On localhost the Vercel serverless runtime isn't available, so always
      // hit the deployed production endpoint directly.
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const stitchBase = isLocal ? 'https://www.wakti.qa' : '';
      const resp = await fetch(`${stitchBase}/api/video/stitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrls: readyClips,
          userId: user!.id,
          format: cinemaFormat,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(errBody.error || `Server error ${resp.status}`);
      }

      const result = await resp.json();
      if (!result.url) throw new Error('No URL returned from Cloud Studio');

      setPremiereVideoUrl(result.url);
      setCinemaStep('premiere');
      toast.success(language === 'ar' ? 'العرض الأول جاهز! 🎬' : 'Premiere ready! 🎬');
    } catch (err: any) {
      console.error('[cinema] Cloud stitch error:', err);
      toast.error(language === 'ar' ? 'فشل التجميع السحابي: ' + err.message : 'Cloud stitch failed: ' + err.message);
    } finally {
      setIsStitching(false);
      setStitchStatus('');
    }
  }, [videoClips, isStitching, language, cinemaFormat, user]);

  // ── Cinema full reset ──
  const handleCinemaReset = useCallback(() => {
    setCinemaStep('desk');
    setCinemaVision('');
    setCinemaScenes([]);
    setSubjectLock('');
    setCinemaSubject('');
    setCinemaSetting([]);
    setCinemaSettingCustom('');
    setCinemaAction([]);
    setCinemaActionCustom('');
    setCinemaVibe([]);
    setCinemaVibeCustom('');
    setBrandAnchor(null);
    setCinemaCharacters([]);
    setCinemaRelationship('');
    setCinemaCTA([]);
    setCinemaCTACustom('');
    setAnchorImageUrl(null);
    setSceneImages([null, null, null, null, null, null]);
    setSceneImageOptions([null, null, null, null, null, null]);
    setActiveCastingIdx(0);
    setCastingProgress(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
    setVisualSupervisorPrompts([null, null, null, null, null, null]);
    setVsStatus(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
    setVideoClips([null, null, null, null, null, null]);
    setAnimTaskIds([null, null, null, null, null, null]);
    setAnimProgress(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
    setCinemaSceneCount(3);
    setCinemaSceneCountTouched(false);
    setIsFilming(false);
    setIsCasting(false);
    setIsStitching(false);
    setPremiereVideoUrl(null);
    setIsCinemaSaved(false);
    setIsCinemaSaving(false);
    setCinemaReferenceImages([]);
    setCinemaRefTags([]);
    setEditingSceneNum(null);
    setRegenSceneNum(null);
    setCinemaOpenSection(0);
    setCinematicSaveFallbackUrl(null);
    setCastingRegenModal(null);
    setCastingRegenNote('');
    setCastingRegenSceneAnchor(null);
    setIsRegenningScene(false);
    setAnchorTag('style');
    setCinemaMode('auto');
    setCinemaAudio(true);
    if (animPollRef.current) clearInterval(animPollRef.current);
  }, []);

  // ── Storyboard: regenerate a single scene ──
  const handleRegenScene = useCallback(async (sceneNum: number) => {
    if (!user || regenSceneNum !== null) return;
    setRegenSceneNum(sceneNum);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');
      const effectiveVibe = cinemaVibe.includes('Custom') ? cinemaVibeCustom : cinemaVibe.filter(v => v !== 'Custom').join(', ');
      const effectiveSetting = cinemaSetting.includes('Custom') ? cinemaSettingCustom : cinemaSetting.filter(v => v !== 'Custom').join(', ');
      const effectiveAction = cinemaAction.includes('Custom') ? cinemaActionCustom : cinemaAction.filter(v => v !== 'Custom').join(', ');
      const effectiveCTA = cinemaCTA.filter(v => v !== 'Custom').join(', ');
      const builtVision = [
        cinemaSubject && `Subject: ${cinemaSubject}`,
        effectiveSetting && `Setting: ${effectiveSetting}`,
        effectiveAction && `Action: ${effectiveAction}`,
        effectiveVibe && `Vibe: ${effectiveVibe}`,
        effectiveCTA && `Goal: ${effectiveCTA}`,
      ].filter(Boolean).join('. ');
      const visionToSend = cinemaVision.trim() && builtVision
        ? `PRODUCTION BRIEF:\n${builtVision}\n\nSTORY VISION:\n${cinemaVision.trim()}`
        : cinemaVision.trim() || builtVision;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ vision: visionToSend, language, scene_count: cinemaSceneCount }),
      });
      const result = await resp.json().catch(() => ({}));
      if (result?.success && Array.isArray(result.scenes)) {
        const newScene = result.scenes.find((s: { scene: number; text: string; english_prompt: string }) => s.scene === sceneNum);
        if (newScene) {
          setCinemaScenes(prev => prev.map(s => s.scene === sceneNum
            ? { ...s, text: newScene.text, english_prompt: newScene.english_prompt || newScene.text }
            : s
          ));
          toast.success(language === 'ar' ? `تم إعادة كتابة المشهد ${sceneNum}` : `Scene ${sceneNum} rewritten!`);
        }
      } else throw new Error(result?.error || 'No scene returned');
    } catch (err: any) {
      toast.error(language === 'ar' ? 'فشل إعادة الكتابة' : 'Regen failed: ' + err.message);
    } finally {
      setRegenSceneNum(null);
    }
  }, [user, regenSceneNum, cinemaSubject, cinemaSetting, cinemaSettingCustom, cinemaAction, cinemaActionCustom, cinemaVibe, cinemaVibeCustom, cinemaCTA, cinemaVision, language, cinemaSceneCount]);

  // ── Cinema AMP ⚡️ — enhance cinemaSubject prompt with gpt-4o-mini ──
  const handleCinemaAmp = useCallback(async () => {
    const raw = cinemaSubject.trim();
    if (!raw || isCinemaAmping || !user) return;
    setIsCinemaAmping(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-amp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ text: raw }),
      });
      const result = await resp.json().catch(() => ({}));
      if (result?.ok && result.enhanced) {
        setCinemaSubject(result.enhanced.slice(0, 800));
        toast.success(language === 'ar' ? '⚡️ تم تحسين الوصف!' : '⚡️ Prompt enhanced!');
      } else {
        throw new Error(result?.error || 'No result');
      }
    } catch (err: any) {
      toast.error(language === 'ar' ? 'فشل التحسين' : 'AMP failed: ' + err.message);
    } finally {
      setIsCinemaAmping(false);
    }
  }, [cinemaSubject, isCinemaAmping, user, language]);

  // ── Storyboard: save inline scene text edit ──
  const handleSaveSceneEdit = useCallback((sceneNum: number, newText: string) => {
    setCinemaScenes(prev => prev.map(s => s.scene === sceneNum ? { ...s, text: newText } : s));
    setEditingSceneNum(null);
    setEditingSceneText('');
  }, []);

  const handleCinemaSave = async () => {
    if (!premiereVideoUrl || !user || isCinemaSaved || isCinemaSaving) return;
    setIsCinemaSaving(true);
    try {
      // The cloud stitch API already uploaded the final MP4 to Supabase Storage
      // and returned a permanent public URL. We only need to insert the DB record.
      const { error: dbError } = await (supabase as any).from('user_videos').insert({
        user_id: user.id,
        title: cinemaVision.trim().slice(0, 60) || 'Wakti Cinema',
        description: cinemaVision.trim() || null,
        storage_path: null,
        video_url: premiereVideoUrl,
        thumbnail_url: sceneImages[0] || null,
        duration_seconds: cinemaSceneCount * 10,
        aspect_ratio: cinemaFormat,
        style_template: 'cinema',
        is_public: false,
      });
      if (dbError) throw dbError;

      setIsCinemaSaved(true);
      toast.success(language === 'ar' ? 'تم الحفظ في فيديوهاتي!' : 'Saved to My Videos!');
      await loadLatestVideo();
      if (onSaveSuccess) setTimeout(() => onSaveSuccess(), 1000);
    } catch (e: any) {
      console.error('Cinema save failed:', e);
      toast.error(language === 'ar' ? 'فشل الحفظ — استخدم زر التنزيل أدناه' : 'Save failed — use the Download button below');
    } finally {
      setIsCinemaSaving(false);
    }
  };

  // ── Casting: regenerate a single scene image with optional note and master style ──
  const handleCastingRegenScene = useCallback(async (sceneIdx: number, note: string, useMaster: boolean, sceneAnchor: string | null = null) => {
    if (!user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;
    setIsRegenningScene(true);
    setCastingProgress(prev => { const n = [...prev]; n[sceneIdx] = 'loading'; return n; });
    try {
      const scene = cinemaScenes.find(s => s.scene === sceneIdx + 1);
      if (!scene) throw new Error('Scene not found');
      const regenArtistCall = async (body: Record<string, unknown>) => {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-artist`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify(body),
        });
        const json = await resp.json();
        if (!resp.ok || !json.ok) throw new Error(json.error || `cinema-artist ${resp.status}`);
        return json;
      };
      const regenPollTask = async (task_id: string): Promise<string> => {
        for (let i = 0; i < 36; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const res = await regenArtistCall({ mode: 'status', task_id, scene_index: sceneIdx });
          if (res.status === 'COMPLETED' && res.image_url) return res.image_url as string;
          if (res.status === 'FAILED') throw new Error(res.error || 'Failed');
        }
        throw new Error('Timed out');
      };

      // Build the effective prompt (subject lock + scene text + optional note)
      const rawPrompt = scene.english_prompt || scene.text;
      const lockedPrompt = subjectLock && !rawPrompt.startsWith(subjectLock) ? `${subjectLock}. ${rawPrompt}` : rawPrompt;
      const finalPrompt = note ? `${lockedPrompt}. Director note: ${note}` : lockedPrompt;

      // Identity Mute: logo mode middle scenes always use T2I (same rule as handleCast)
      const isLogoMode = anchorTag === 'logo' && brandAnchor;
      const isLastScene = scene.scene === cinemaSceneCount;
      const isMuted = isLogoMode && scene.scene > 1 && !isLastScene;

      // sceneAnchor (from modal upload) overrides the mute — explicit upload = intentional
      const effectiveAnchor = sceneAnchor || ((!isMuted && useMaster && brandAnchor) ? brandAnchor : null);

      let imgUrl: string;
      if (effectiveAnchor) {
        const pipeline = sceneAnchor ? 'style' : (anchorTag === 'character' ? 'character' : anchorTag === 'logo' ? 'logo' : 'style');
        const created = await regenArtistCall({
          mode: 'i2i_create',
          prompt: finalPrompt,
          anchor_url: effectiveAnchor,
          anchor_pipeline: pipeline,
          scene_index: sceneIdx,
        });
        imgUrl = await regenPollTask(created.task_id);
      } else {
        // T2I — either muted or no anchor available
        const created = await regenArtistCall({
          mode: 't2i_create',
          prompt: finalPrompt,
          aspect_ratio: cinemaFormat,
          scene_index: sceneIdx,
        });
        imgUrl = await regenPollTask(created.task_id);
      }
      setSceneImages(prev => { const n = [...prev]; n[sceneIdx] = imgUrl; return n; });
      setCastingProgress(prev => { const n = [...prev]; n[sceneIdx] = 'done'; return n; });
      toast.success(language === 'ar' ? `تم إعادة توليد المشهد ${sceneIdx + 1}` : `Scene ${sceneIdx + 1} regenerated!`);
    } catch (err: any) {
      setCastingProgress(prev => { const n = [...prev]; n[sceneIdx] = 'error'; return n; });
      toast.error(language === 'ar' ? 'فشل إعادة التوليد' : 'Regen failed: ' + err.message);
    } finally {
      setIsRegenningScene(false);
      setCastingRegenModal(null);
      setCastingRegenNote('');
      setCastingRegenUseMaster(true);
      setCastingRegenSceneAnchor(null);
    }
  }, [user, cinemaScenes, sceneImages, brandAnchor, cinemaFormat, language, anchorTag, cinemaSceneCount, subjectLock]);

  const handleCinemaRefUpload = async (file: File, slotIdx: number, tag: string) => {
    if (!user) return;
    setIsUploadingRef(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/cinema-refs/${Date.now()}_${slotIdx}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error('Failed to get public URL');
      setCinemaReferenceImages(prev => {
        const updated = [...prev];
        updated[slotIdx] = publicUrl;
        return updated;
      });
      setCinemaRefTags(prev => {
        const updated = [...prev];
        updated[slotIdx] = tag;
        return updated;
      });
    } catch (e: any) {
      toast.error(language === 'ar' ? 'فشل رفع الصورة' : 'Image upload failed');
      console.error('[cinema] ref upload failed:', e);
    } finally {
      setIsUploadingRef(false);
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
      const { data: importData, error: importError } = await supabase.functions.invoke('import-external-video', {
        body: {
          sourceUrl: generatedVideoUrl,
          filenameHint: prompt.trim().slice(0, 40) || 'ai-video',
        },
      });
      if (importError) throw importError;
      const storagePath = importData?.storagePath as string | undefined;
      if (!storagePath) {
        throw new Error(importData?.error || 'Failed to save video');
      }

      // Generate a clean short title from the prompt
      const generateTitle = (raw: string): string => {
        if (!raw || !raw.trim()) return 'AI Video';
        let t = raw.trim();
        // Strip JSON-like prefixes
        t = t.replace(/^\{?\s*"?description"?\s*:\s*"?/i, '');
        // Strip leading "Style:", "Camera:", etc labels if that's all we have
        t = t.replace(/^(Style|Camera|Lighting|Environment|Elements|Motion|Ending|Keywords):\s*/i, '');
        // Take first sentence or up to 60 chars
        const sentenceEnd = t.search(/[.!?]/);
        if (sentenceEnd > 0 && sentenceEnd <= 80) {
          t = t.slice(0, sentenceEnd + 1);
        } else {
          t = t.slice(0, 60);
          // Don't cut mid-word
          const lastSpace = t.lastIndexOf(' ');
          if (lastSpace > 30) t = t.slice(0, lastSpace);
        }
        // Clean up trailing quotes/braces
        t = t.replace(/["{}]+$/g, '').trim();
        return t || 'AI Video';
      };

      // Save into unified user_videos table
      const { error } = await (supabase as any).from('user_videos').insert({
        user_id: user.id,
        title: generateTitle(prompt),
        description: prompt.trim() || null,
        storage_path: storagePath,
        video_url: null,
        thumbnail_url: generationMode === 'image_to_video'
          ? (sourceImagePath || sourceImageUrl || null)
          : null,
        duration_seconds: parseInt(duration, 10),
        aspect_ratio: aspectRatio,
        style_template: 'ai',
        is_public: false,
      });

      if (error) throw error;

      setIsSaved(true);
      toast.success(language === 'ar' ? 'تم الحفظ في فيديوهاتي!' : 'Saved to My Videos!');
      await loadLatestVideo();
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

  const remaining = quota ? quota.limit - quota.used + quota.extra : 80;
  const used = quota?.used || 0;
  const limit = quota?.limit || 80;
  const limitReached = quota !== null && !quota.canGenerate;
  const maxAffordableCinemaScenes = Math.max(0, Math.min(6, remaining));

  const needsArabicTranslation =
    language === 'ar' &&
    hasArabicChars(prompt) &&
    (generationMode === 'text_to_video' ||
      (generationMode === 'image_to_video' && prompt.trim().length > 0));

  const canGenerate = generationMode === 'text_to_video'
    ? (prompt.trim().length > 0 && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : generationMode === 'image_to_video'
    ? (imagePreview && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : generationMode === '2images_to_video'
    ? (imagePreview && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : false;
  const showLatestVideo = !generatedVideoUrl && !!(latestVideo?.signedUrl || latestVideo?.video_url);

  useEffect(() => {
    if (generationMode !== 'cinema') return;
    if (loadingQuota) return;
    if (maxAffordableCinemaScenes <= 0) return;
    if (cinemaSceneCount > maxAffordableCinemaScenes) {
      setCinemaSceneCount(maxAffordableCinemaScenes);
    }
  }, [generationMode, loadingQuota, maxAffordableCinemaScenes, cinemaSceneCount]);

  const getSignedVideoUrl = useCallback(async (storagePath?: string | null) => {
    if (!storagePath) return null;
    const { data } = await supabase.storage
      .from('user-videos')
      .getPublicUrl(storagePath);
    return data?.publicUrl;
  }, [supabase]);

  // Map generationMode to trial feature key/limit/label
  const videoTrialMap: Record<string, { key: string; limit: number; en: string; ar: string }> = {
    'image_to_video':    { key: 'i2v',  limit: 1, en: 'Image to Video',    ar: 'صورة إلى فيديو' },
    'text_to_video':     { key: 't2v',  limit: 1, en: 'Text to Video',     ar: 'نص إلى فيديو' },
    '2images_to_video':  { key: '2i2v', limit: 1, en: '2 Images to Video', ar: 'صورتان إلى فيديو' },
    'cinema':            { key: 'cinema', limit: 1, en: 'Cinema',            ar: 'سينما' },
  };
  const activeVideoTrial = videoTrialMap[generationMode] || videoTrialMap['image_to_video'];

  return (
    <div className="relative">
      <TrialGateOverlay featureKey={activeVideoTrial.key} limit={activeVideoTrial.limit} featureLabel={{ en: activeVideoTrial.en, ar: activeVideoTrial.ar }} />
      {/* Glowing background effects */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-40 blur-3xl bg-gradient-to-br from-[hsl(210,100%,65%)] via-[hsl(180,85%,60%)] to-[hsl(160,80%,55%)] dark:opacity-20" />
      
      {/* Main card container */}
      <div className="relative enhanced-card rounded-[1.5rem] p-5 md:p-6 overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1vcGFjaXR5PSIwLjAyIj48cGF0aCBkPSJNMjAgMjBjMC0xMSA5LTIwIDIwLTIwdjQwYy0xMSAwLTIwLTktMjAtMjB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative space-y-5">
          {/* Compact header row - Hidden in Cinema mode */}
          {generationMode !== 'cinema' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/30">
                <Wand2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#060541] to-[hsl(210,100%,45%)] dark:from-white dark:to-[hsl(210,100%,75%)] bg-clip-text text-transparent">
                  {language === 'ar' ? 'صانع الفيديو بالذكاء الاصطناعي' : 'AI Video Generator'}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Duration selector - hidden in Cinema mode */}
              {generationMode !== 'cinema' && (
              <div className="flex items-center gap-0.5 rounded-full border border-primary/20 overflow-hidden">
                <Clock className="h-3.5 w-3.5 text-primary ml-2.5" />
                {generationMode === '2images_to_video' ? (
                  <>
                    <button
                      onClick={() => !isGenerating && setDuration('4')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '4'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '4 ث' : '4s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('8')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '8'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '8 ث' : '8s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && !(resolution === '720p') && setDuration('12')}
                      disabled={isGenerating || resolution === '720p'}
                      title={resolution === '720p' ? (language === 'ar' ? 'غير متاح في 720p' : 'Not available at 720p') : undefined}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all mr-0.5 ${
                        duration === '12'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : resolution === '720p'
                            ? 'text-muted-foreground/30 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '12 ث' : '12s'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => !isGenerating && setDuration('6')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '6'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '6 ث' : '6s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('10')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '10'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '10 ث' : '10s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('15')}
                      disabled={isGenerating}
                      title={undefined}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all mr-0.5 ${
                        duration === '15'
                          ? 'bg-gradient-to-r from-[hsl(25,95%,60%)]/30 to-[hsl(45,100%,60%)]/25 text-orange-500 font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '15 ث' : '15s'}
                    </button>
                  </>
                )}
              </div>
              )}
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
          )}

          {/* Mode toggle - Glassmorphic Segmented Control */}
          <div
            className={`relative grid grid-cols-2 gap-2 rounded-[26px] p-2 border ${
              isGenerating ? 'opacity-80' : ''
            } bg-[linear-gradient(135deg,rgba(252,254,253,0.98),rgba(233,206,176,0.34))] border-[#060541]/10 shadow-[0_10px_28px_rgba(6,5,65,0.10)] dark:bg-[linear-gradient(135deg,rgba(12,15,20,0.96),rgba(30,34,42,0.94))] dark:border-white/10 dark:shadow-[0_18px_42px_rgba(0,0,0,0.42)]`}
            role="group"
            aria-label={language === 'ar' ? 'وضع إنشاء الفيديو' : 'Video generation mode'}
          >
            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('image_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 min-h-[52px] text-[11px] font-semibold transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed whitespace-nowrap border ${
                generationMode === 'image_to_video'
                  ? 'text-[#060541] border-[#C5A47E] shadow-[0_10px_24px_rgba(197,164,126,0.28)] dark:text-[#0c0f14]'
                  : 'text-[#060541]/70 border-[#060541]/10 bg-white/70 hover:bg-white dark:text-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
              style={{
                background: generationMode === 'image_to_video' 
                  ? 'linear-gradient(135deg, #E2C7A8 0%, #C5A47E 100%)' 
                  : undefined,
              }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'صورة ← فيديو' : 'Image → Video'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('text_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 min-h-[52px] text-[11px] font-semibold transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed whitespace-nowrap border ${
                generationMode === 'text_to_video'
                  ? 'text-[#060541] border-[#C5A47E] shadow-[0_10px_24px_rgba(197,164,126,0.28)] dark:text-[#0c0f14]'
                  : 'text-[#060541]/70 border-[#060541]/10 bg-white/70 hover:bg-white dark:text-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
              style={{
                background: generationMode === 'text_to_video' 
                  ? 'linear-gradient(135deg, #E2C7A8 0%, #C5A47E 100%)' 
                  : undefined,
              }}
            >
              <Type className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'نص ← فيديو' : 'Text → Video'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('2images_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 min-h-[52px] text-[11px] font-semibold transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed whitespace-nowrap border ${
                generationMode === '2images_to_video'
                  ? 'text-[#060541] border-[#C5A47E] shadow-[0_10px_24px_rgba(197,164,126,0.28)] dark:text-[#0c0f14]'
                  : 'text-[#060541]/70 border-[#060541]/10 bg-white/70 hover:bg-white dark:text-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
              style={{
                background: generationMode === '2images_to_video' 
                  ? 'linear-gradient(135deg, #E2C7A8 0%, #C5A47E 100%)' 
                  : undefined,
              }}
            >
              <Images className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'صورتان ← فيديو' : '2Images → Video'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGenerating && !isTrialUser) setGenerationMode('cinema');
              }}
              disabled={isGenerating}
              className={`relative flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 min-h-[52px] text-[11px] font-semibold transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed whitespace-nowrap border ${
                isTrialUser
                  ? 'text-[#060541]/35 border-[#060541]/10 bg-white/40 cursor-not-allowed dark:text-white/30 dark:border-white/10 dark:bg-white/5'
                  : generationMode === 'cinema'
                  ? 'text-[#060541] border-[#C5A47E] shadow-[0_10px_24px_rgba(197,164,126,0.28)] dark:text-[#0c0f14]'
                  : 'text-[#060541]/70 border-[#060541]/10 bg-white/70 hover:bg-white dark:text-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
              style={{
                background: !isTrialUser && generationMode === 'cinema'
                  ? 'linear-gradient(135deg, #E2C7A8 0%, #C5A47E 100%)'
                  : undefined,
              }}
            >
              <Film className="h-3.5 w-3.5" />
              <span>{language === 'ar' ? 'سينما' : 'Cinema'}</span>
              {isTrialUser && <Lock className="h-3 w-3 ml-0.5 opacity-60" />}
            </button>
          </div>

          {/* Unified content area */}
          <div className={`grid grid-cols-1 ${generationMode === 'image_to_video' ? 'xl:grid-cols-[280px_1fr]' : ''} gap-5 items-start`}>
            {/* Single image upload - only shown in image_to_video mode */}
            {generationMode === 'image_to_video' && (
              <div className="relative">
                {!imagePreview ? (
                  <div className="h-full min-h-[200px] flex flex-col gap-2">
                    {/* Upload from device */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative cursor-pointer group flex-1"
                    >
                      <div className="h-full rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-[hsl(210,100%,65%)]/5 via-[hsl(180,85%,60%)]/5 to-[hsl(160,80%,55%)]/5 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary hover:shadow-[0_0_30px_hsla(210,100%,65%,0.3)] active:scale-[0.98]">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/40 group-hover:shadow-xl group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-center px-3">
                          <p className="font-semibold text-sm">
                            {language === 'ar' ? 'رفع صورة' : 'Upload Image'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {language === 'ar' ? 'PNG, JPG • 10MB' : 'PNG, JPG • 10MB'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Pick from saved images */}
                    <div
                      onClick={() => { setShowSavedPicker(true); fetchSavedImages(); }}
                      className="relative cursor-pointer group"
                    >
                      <div className="rounded-2xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-2.5 py-3 px-4 transition-all hover:border-orange-500 hover:shadow-[0_0_30px_hsla(25,95%,60%,0.3)] active:scale-[0.98]">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 group-hover:shadow-xl group-hover:shadow-orange-500/40 transition-all group-hover:scale-105">
                          <GalleryHorizontalEnd className="h-4 w-4 text-white" />
                        </div>
                        <p className="font-semibold text-sm">
                          {language === 'ar' ? 'اختر من المحفوظات' : 'Pick from Saved'}
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
            )}

            {/* Dual image upload - only shown in 2images_to_video mode */}
            {generationMode === '2images_to_video' && (
              <div className="relative grid grid-cols-2 gap-2 sm:gap-3">
                {/* First Image */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[hsl(210,100%,65%)]/20 to-[hsl(180,85%,60%)]/20 border border-[hsl(210,100%,65%)]/30 text-[hsl(210,100%,65%)] truncate max-w-full">
                      <span>▶</span> <span className="truncate">{language === 'ar' ? 'البداية' : 'Start'}</span>
                    </span>
                  </div>
                  {!imagePreview ? (
                    <div className="h-full min-h-[140px] sm:min-h-[180px] flex flex-col gap-1.5 sm:gap-2">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative cursor-pointer group flex-1"
                      >
                        <div className="h-full rounded-xl sm:rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-[hsl(210,100%,65%)]/5 via-[hsl(180,85%,60%)]/5 to-[hsl(160,80%,55%)]/5 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:border-primary hover:shadow-[0_0_30px_hsla(210,100%,65%,0.3)] active:scale-[0.98] py-2">
                          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/40 group-hover:shadow-xl group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                            <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <div className="text-center px-1">
                            <p className="font-semibold text-[10px] sm:text-xs">
                              {language === 'ar' ? 'صورة البداية' : 'Start Image'}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">PNG, JPG</p>
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={() => { setPickingForSlot(1); setShowSavedPicker(true); fetchSavedImages(); }}
                        className="relative cursor-pointer group"
                      >
                        <div className="rounded-lg sm:rounded-xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:py-2 sm:px-3 transition-all hover:border-orange-500 active:scale-[0.98]">
                          <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 transition-all group-hover:scale-105">
                            <GalleryHorizontalEnd className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                          </div>
                          <p className="font-semibold text-[10px] sm:text-xs">
                            {language === 'ar' ? 'من المحفوظات' : 'From Saved'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-full min-h-[140px] sm:min-h-[180px]">
                      <div className="h-full rounded-xl sm:rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-primary/30">
                        <img
                          src={imagePreview}
                          alt="First"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                        onClick={clearImage}
                        disabled={isGenerating}
                      >
                        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full h-6 sm:h-7 text-[10px] sm:text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isGenerating}
                        >
                          {language === 'ar' ? 'تغيير' : 'Change'}
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
                    aria-label={language === 'ar' ? 'اختر الصورة الأولى' : 'Select first image'}
                  />
                </div>

                {/* Second Image */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[hsl(280,70%,65%)]/20 to-[hsl(320,75%,70%)]/20 border border-[hsl(280,70%,65%)]/30 text-[hsl(280,70%,65%)] truncate max-w-full">
                      <span>⏹</span> <span className="truncate">{language === 'ar' ? 'النهاية' : 'End'}</span>
                    </span>
                  </div>
                  {!imagePreview2 ? (
                    <div className="h-full min-h-[140px] sm:min-h-[180px] flex flex-col gap-1.5 sm:gap-2">
                      <div
                        onClick={() => fileInputRef2.current?.click()}
                        className="relative cursor-pointer group flex-1"
                      >
                        <div className="h-full rounded-xl sm:rounded-2xl border-2 border-dashed border-purple-400/40 bg-gradient-to-br from-[hsl(280,70%,65%)]/5 via-[hsl(320,75%,70%)]/5 to-[hsl(280,60%,75%)]/5 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:border-purple-500 hover:shadow-[0_0_30px_hsla(280,70%,65%,0.3)] active:scale-[0.98] py-2">
                          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/40 group-hover:shadow-xl group-hover:shadow-purple-500/50 transition-all group-hover:scale-105">
                            <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <div className="text-center px-1">
                            <p className="font-semibold text-[10px] sm:text-xs">
                              {language === 'ar' ? 'صورة النهاية' : 'End Image'}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">PNG, JPG</p>
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={() => { setPickingForSlot(2); setShowSavedPicker(true); fetchSavedImages(); }}
                        className="relative cursor-pointer group"
                      >
                        <div className="rounded-lg sm:rounded-xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:py-2 sm:px-3 transition-all hover:border-orange-500 active:scale-[0.98]">
                          <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 transition-all group-hover:scale-105">
                            <GalleryHorizontalEnd className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                          </div>
                          <p className="font-semibold text-[10px] sm:text-xs">
                            {language === 'ar' ? 'من المحفوظات' : 'From Saved'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-full min-h-[140px] sm:min-h-[180px]">
                      <div className="h-full rounded-xl sm:rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-purple-500/30">
                        <img
                          src={imagePreview2}
                          alt="Second"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                        onClick={clearImage2}
                        disabled={isGenerating}
                      >
                        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full h-6 sm:h-7 text-[10px] sm:text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
                          onClick={() => fileInputRef2.current?.click()}
                          disabled={isGenerating}
                        >
                          {language === 'ar' ? 'تغيير' : 'Change'}
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect2}
                    aria-label={language === 'ar' ? 'اختر الصورة الثانية' : 'Select second image'}
                  />
                </div>
              </div>
            )}

            {/* Cinema mode - Director's Desk */}
            {generationMode === 'cinema' && (
              <div className="relative col-span-full flex flex-col">
                {cinemaStep === 'desk' && (() => {
                  // Multi-select → comma-separated string helpers
                  const effectiveVibe = cinemaVibe.includes('Custom') ? cinemaVibeCustom : cinemaVibe.filter(v => v !== 'Custom').join(', ');
                  const effectiveSetting = cinemaSetting.includes('Custom') ? cinemaSettingCustom : cinemaSetting.filter(v => v !== 'Custom').join(', ');
                  const effectiveAction = cinemaAction.includes('Custom') ? cinemaActionCustom : cinemaAction.filter(v => v !== 'Custom').join(', ');
                  const effectiveCTA = cinemaCTA.filter(v => v !== 'Custom').join(', ');
                  const effectiveCharacters = cinemaCharacters.includes('Custom') ? (cinemaRelationship || 'custom characters') : cinemaCharacters.filter(v => v !== 'Custom').join(', ');
                  const isSceneCountReady = cinemaSceneCountTouched === true;
                  const isDark = theme === 'dark';

                  // Explicit boolean checks — no implicit truthy on number defaults
                  const f1 = cinemaSubject.trim().length > 0;
                  const f2 = cinemaVibe.length > 0 && (cinemaVibe.includes('Custom') ? cinemaVibeCustom.trim().length > 0 : true);
                  const f3 = cinemaCharacters.length > 0;
                  const f4 = isSceneCountReady;
                  const filledCount = [f1, f2, f3, f4].filter(Boolean).length;
                  const progressPct = filledCount === 0 ? 0 : Math.round((filledCount / 4) * 100);
                  const isFormReady = f1 && f2 && f3 && f4;

                  const sec1Done = f1;
                  const sec2Done = f2 && f3 && f4;
                  const sec3Done = false; // section 3 is optional — never blocks

                  const openSection = cinemaOpenSection;

                  // Theme-aware color tokens
                  const clr = {
                    text:       isDark ? 'rgba(255,255,255,0.85)' : '#1a1d2e',
                    textMuted:  isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.35)',
                    textSubtle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    cardBg:     isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    cardBgOpen: isDark ? 'rgba(226,199,168,0.06)' : 'rgba(226,199,168,0.12)',
                    cardBorder: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
                    cardBorderOpen: isDark ? 'rgba(226,199,168,0.25)' : 'rgba(226,199,168,0.5)',
                    inputBg:    isDark ? 'rgba(12,15,20,0.7)'    : 'rgba(255,255,255,0.8)',
                    inputBorder: (active: boolean) => active
                      ? 'rgba(226,199,168,0.6)'
                      : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                    chipBg:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    chipBorder: isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)',
                    chipText:   isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.65)',
                    numBg:      isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    numBorder:  isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)',
                    numText:    isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.45)',
                    stickyBg:   isDark
                      ? 'linear-gradient(to bottom,rgba(12,15,20,0.98) 70%,transparent)'
                      : 'linear-gradient(to bottom,rgba(252,254,253,0.98) 70%,transparent)',
                    secNumBg:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                    optBadgeBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    progressTrack: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
                  };

                  // Chip helper
                  type ChipProps = { label: string; emoji: string; value: string; selected: boolean; onSelect: () => void; disabled?: boolean };
                  const Chip = ({ label, emoji, value: _v, selected, onSelect, disabled }: ChipProps) => (
                    <button type="button" onClick={onSelect} disabled={disabled}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
                      style={{
                        background: selected ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : clr.chipBg,
                        border: selected ? '1px solid rgba(226,199,168,0.9)' : `1px solid ${clr.chipBorder}`,
                        color: selected ? '#0c0f14' : clr.chipText,
                        boxShadow: selected ? '0 2px 12px rgba(226,199,168,0.35)' : 'none',
                      }}>{emoji} {label}</button>
                  );

                  // Section header helper
                  const SecHeader = ({ idx, label, done, optional, summary }: { idx: number; label: string; done: boolean; optional?: boolean; summary?: string }) => (
                    <button type="button" onClick={() => setCinemaOpenSection(openSection === idx ? -1 : idx)}
                      className="w-full flex items-center justify-between gap-2 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                          style={{background: done ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : optional ? clr.optBadgeBg : clr.secNumBg, color: done ? '#0c0f14' : clr.textMuted}}>
                          {done ? '✓' : (idx + 1)}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider truncate"
                          style={{color: done ? '#C5A47E' : optional ? clr.textMuted : clr.text}}>{label}</span>
                        {done && summary && openSection !== idx && (
                          <span className="text-[10px] truncate ml-1 hidden sm:block" style={{color: clr.textMuted}}>— {summary.length > 28 ? summary.slice(0,28)+'…' : summary}</span>
                        )}
                        {optional && !done && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-semibold" style={{background: clr.optBadgeBg, color: clr.textMuted}}>
                            {language==='ar'?'اختياري':'optional'}
                          </span>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-xs" style={{color: clr.textMuted, transform: openSection === idx ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s'}}>▼</span>
                    </button>
                  );

                  return (
                  <div className="flex flex-col gap-0 py-2">
                    {/* Sticky gold progress bar */}
                    <div className="sticky top-0 z-20 pt-1 pb-3" style={{background: clr.stickyBg}}>
                      <div className="text-center mb-2">
                        <h3 className="text-xl font-bold" style={{color: clr.text, textShadow: isDark ? '0 0 20px rgba(226,199,168,0.5)' : 'none'}}>
                          {language === 'ar' ? 'مكتب الفيزيونير' : 'The Visionnaire'}
                        </h3>
                        {/* Auto / Custom toggle */}
                        <div className="inline-flex mt-2 rounded-xl overflow-hidden" style={{border:'1px solid rgba(226,199,168,0.25)',background:'rgba(12,15,20,0.4)'}}>
                          <button
                            type="button"
                            onClick={() => setCinemaMode('auto')}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold transition-all"
                            style={cinemaMode==='auto'
                              ? {background:'#0f172a',color:'#E2C7A8',border:'2px solid #E2C7A8',boxShadow:'0 0 12px rgba(226,199,168,0.5)',borderRadius:'10px'}
                              : {background:'transparent',color:'rgba(255,255,255,0.45)',border:'2px solid transparent',borderRadius:'10px'}}
                          >
                            <span style={{filter: cinemaMode==='auto' ? 'none' : 'grayscale(1) opacity(0.5)'}}>🪄</span><span>{language==='ar'?'تلقائي':'Auto'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCinemaMode('custom')}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold transition-all"
                            style={cinemaMode==='custom'
                              ? {background:'#0f172a',color:'#E2C7A8',border:'2px solid #E2C7A8',boxShadow:'0 0 12px rgba(226,199,168,0.5)',borderRadius:'10px'}
                              : {background:'transparent',color:'rgba(255,255,255,0.45)',border:'2px solid transparent',borderRadius:'10px'}}
                          >
                            <span style={{filter: cinemaMode==='custom' ? 'none' : 'grayscale(1) opacity(0.5)'}}>🎥</span><span>{language==='ar'?'يدوي':'Custom'}</span>
                          </button>
                        </div>
                        
                        {/* Cinematic Audio Toggle */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl mt-3 max-w-xs mx-auto" style={{background:'rgba(226,199,168,0.08)',border:'1px solid rgba(226,199,168,0.2)'}}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cinemaAudio ? '🔊' : '🔇'}</span>
                            <div>
                              <p className="text-[11px] font-bold" style={{color:'#E2C7A8'}}>
                                {language==='ar' ? 'صوت سينمائي' : 'Cinematic Audio'}
                              </p>
                              <p className="text-[9px]" style={{color:'rgba(226,199,168,0.5)'}}>
                                {language==='ar' ? 'موسيقى خلفية تلقائية' : 'Auto background music'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCinemaAudio(prev => !prev)}
                            className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                            style={{background: cinemaAudio ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : 'rgba(255,255,255,0.12)'}}
                            aria-label={language === 'ar' ? (cinemaAudio ? 'تعطيل الصوت السينمائي' : 'تفعيل الصوت السينمائي') : (cinemaAudio ? 'Disable cinematic audio' : 'Enable cinematic audio')}
                          >
                            <div className="absolute top-0.5 rounded-full w-5 h-5 bg-white shadow-md transition-all"
                              style={{left: cinemaAudio ? '22px' : '2px'}} />
                          </button>
                        </div>
                      </div>
                      <div className="relative h-[3px] rounded-full overflow-hidden" style={{background: clr.progressTrack}}>
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{width:`${progressPct}%`, background:'linear-gradient(90deg,#C5A47E,#E2C7A8,#fff9ee)', boxShadow: progressPct > 0 ? '0 0 8px rgba(226,199,168,0.8),0 0 16px rgba(226,199,168,0.4)' : 'none'}} />
                      </div>
                      {filledCount > 0 && (
                        <p className="text-[10px] text-[#E2C7A8]/60 text-right mt-1">
                          {isFormReady ? (language==='ar'?'✨ جاهز للتصوير!':'✨ Ready to direct!') : (language==='ar'?`${progressPct}% مكتمل`:`${progressPct}% complete`)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 max-w-lg mx-auto w-full">

                      {/* ── SECTION 1: What is your movie about? ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background: openSection===0 ? clr.cardBgOpen : clr.cardBg, border: `1px solid ${openSection===0 ? clr.cardBorderOpen : clr.cardBorder}`}}>
                        <SecHeader idx={0} label={language==='ar'?'عم يدور فيلمك؟':'What is your movie about?'} done={sec1Done} summary={cinemaSubject} />
                        {openSection === 0 && (
                          <div className="mt-3 flex flex-col gap-2">
                            <div className="rounded-xl overflow-hidden" style={{background: clr.inputBg, border:`1px solid ${clr.inputBorder(f1)}`}}>
                              <textarea
                                value={cinemaSubject}
                                onChange={(e) => setCinemaSubject(e.target.value.slice(0,800))}
                                onInput={(e) => { const t=e.currentTarget; t.style.height='auto'; t.style.height=`${Math.min(t.scrollHeight,220)}px`; t.style.overflowY=t.scrollHeight>220?'auto':'hidden'; }}
                                disabled={isDirecting} autoFocus rows={5} maxLength={800}
                                placeholder={language==='ar'?'مثال: رجل أعمال يطلق منتجه الجديد في مؤتمر كبير...':'e.g., An entrepreneur launching a new product at a major conference...'}
                                className="w-full resize-none bg-transparent px-4 py-3 text-base placeholder:text-black/25 outline-none min-h-[120px] max-h-[220px] leading-7" style={{color: clr.text}}
                              />
                            </div>
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px]" style={{color: cinemaSubject.length > 720 ? '#f97316' : clr.textSubtle}}>{cinemaSubject.length}/800</span>
                              <div className="flex items-center gap-2">
                                {/* AMP ⚡️ — cinematic prompt enhancer */}
                                {cinemaSubject.trim().length > 3 && (
                                  <button
                                    type="button"
                                    onClick={handleCinemaAmp}
                                    disabled={isCinemaAmping}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                                    style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.35)',color:'rgba(165,167,255,0.95)'}}
                                  >
                                    {isCinemaAmping
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /><span>{language==='ar'?'جاري التحسين...':'Enhancing...'}</span></>
                                      : <><span>⚡️</span><span>{language==='ar'?'تحسين':'AMP'}</span></>
                                    }
                                  </button>
                                )}
                                {f1 && (
                                  <button type="button" onClick={()=>setCinemaOpenSection(1)}
                                    className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                                    style={{background:'linear-gradient(135deg,#E2C7A8,#C5A47E)', color:'#0c0f14', boxShadow:'0 2px 12px rgba(226,199,168,0.4)'}}>
                                    {language==='ar'?'التالي ›':'Next ›'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Brand / Anchor Image Upload — hidden in Custom mode */}
                            {cinemaMode === 'auto' && <div className="mt-1 rounded-xl p-3 flex flex-col gap-2" style={{background: brandAnchor ? 'rgba(226,199,168,0.08)' : clr.cardBg, border: `1px solid ${brandAnchor ? 'rgba(226,199,168,0.35)' : clr.cardBorder}`}}>
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{color: brandAnchor ? '#C5A47E' : clr.textMuted}}>
                                {language==='ar' ? '🎨 أساس النمط والعلامة التجارية (اختياري)' : '🎨 Style & Brand Foundation (Optional)'}
                                {brandAnchor && <span className="ml-1 text-[#E2C7A8]">✓</span>}
                              </p>
                              <p className="text-[9px]" style={{color: clr.textSubtle}}>
                                {language==='ar' ? 'شعار، صورة منتج، أو مرجع بصري — يُثبِّت الهوية البصرية في جميع المشاهد' : 'Logo, product shot, or visual reference — locks brand identity across all scenes'}
                              </p>
                              <div className="flex items-center gap-3">
                                {brandAnchor ? (
                                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{border:'1px solid rgba(226,199,168,0.5)'}}>
                                    <img src={brandAnchor} alt="brand anchor" className="w-full h-full object-cover" />
                                    <button
                                      onClick={() => setBrandAnchor(null)}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white text-[9px] flex items-center justify-center hover:bg-red-500/80 transition-colors"
                                    >✕</button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <label className="w-16 h-16 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 transition-all hover:opacity-80"
                                      style={{background: clr.numBg, border:`2px dashed rgba(226,199,168,0.3)`}}>
                                      <input type="file" accept="image/*" className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file || !user) return;
                                          setIsUploadingBrand(true);
                                          try {
                                            const ext = file.name.split('.').pop() || 'jpg';
                                            const path = `${user.id}/cinema-refs/brand-${Date.now()}.${ext}`;
                                            await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                                            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                                            if (urlData?.publicUrl) setBrandAnchor(urlData.publicUrl);
                                          } catch { toast.error(language==='ar'?'فشل رفع الصورة':'Upload failed'); }
                                          finally { setIsUploadingBrand(false); }
                                        }}
                                      />
                                      {isUploadingBrand ? <Loader2 className="h-4 w-4 animate-spin" style={{color:clr.textMuted}} /> : <span className="text-xl leading-none" style={{color:clr.textSubtle}}>+</span>}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setShowBrandSavedPicker(true)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all active:scale-95"
                                      style={{background:'rgba(226,199,168,0.1)', border:'1px solid rgba(226,199,168,0.3)', color:'#E2C7A8', whiteSpace:'nowrap'}}
                                    >
                                      <Images className="h-3 w-3 flex-shrink-0" />
                                      {language === 'ar' ? 'من المحفوظة' : 'From Saved'}
                                    </button>
                                  </div>
                                )}
                                <p className="text-[9px] leading-relaxed" style={{color: clr.textMuted}}>
                                  {brandAnchor
                                    ? (language==='ar' ? 'المخرج والمصور سيحافظان على هذا النمط في كل مشهد' : 'The Director & Artist will maintain this style across all scenes')
                                    : (language==='ar' ? 'إذا لم ترفع صورة، سيبتكر الذكاء الاصطناعي نمطه الخاص' : 'Without one, the AI will invent its own visual style')}
                                </p>
                              </div>

                              {/* Saved Images Picker modal */}
              {showBrandSavedPicker && (
                <SavedImagesPicker
                  onSelect={(url) => { setBrandAnchor(url); setShowBrandSavedPicker(false); }}
                  onClose={() => setShowBrandSavedPicker(false)}
                />
              )}

              {/* ── Smart-Tag Selector — shown after upload ── */}
                              {brandAnchor && (
                                <div className="mt-2 flex flex-col gap-1.5">
                                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{color: clr.textMuted}}>
                                    {language==='ar' ? '🏷 ما هذه الصورة؟' : '🏷 What is this?'}
                                  </p>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {([
                                      { value: 'logo',      labelEn: 'Logo / Text',       labelAr: 'شعار / نص',         descEn: 'AI Background Integration', descAr: 'تكامل الخلفية بالذكاء' },
                                      { value: 'style',     labelEn: 'Style / Colors',    labelAr: 'نمط / ألوان',       descEn: 'Mood & palette guide',     descAr: 'مرشد المزاج واللون' },
                                      { value: 'character', labelEn: 'Character / Person', labelAr: 'شخصية / وجه',       descEn: 'Identity consistency',     descAr: 'تناسق الهوية البصرية' },
                                    ] as const).map(opt => {
                                      const isActive = anchorTag === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => setAnchorTag(opt.value)}
                                          className="flex flex-col items-start px-2.5 py-2 rounded-xl text-left transition-all active:scale-95 flex-1 min-w-[80px] relative"
                                          style={{
                                            background: isActive ? 'linear-gradient(135deg,rgba(226,199,168,0.22),rgba(197,164,126,0.14))' : clr.numBg,
                                            border: `2px solid ${isActive ? '#C5A47E' : clr.cardBorder}`,
                                            boxShadow: isActive ? '0 0 0 3px rgba(226,199,168,0.15), 0 4px 16px rgba(226,199,168,0.2)' : 'none',
                                          }}
                                        >
                                          {isActive && (
                                            <span className="absolute top-1 right-1.5 text-[8px] font-black" style={{color:'#C5A47E'}}>✓</span>
                                          )}
                                          <span className="text-[10px] font-bold leading-tight" style={{color: isActive ? '#E2C7A8' : clr.textMuted}}>
                                            {language==='ar' ? opt.labelAr : opt.labelEn}
                                          </span>
                                          <span className="text-[8px] leading-tight mt-0.5" style={{color: isActive ? 'rgba(226,199,168,0.7)' : clr.textSubtle}}>
                                            {language==='ar' ? opt.descAr : opt.descEn}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>}

                          </div>
                        )}
                      </div>

                      {/* ── SECTION 2: Style & Cast (all required) ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background: openSection===1 ? clr.cardBgOpen : clr.cardBg, border: `1px solid ${openSection===1 ? clr.cardBorderOpen : clr.cardBorder}`}}>
                        <SecHeader idx={1} label={language==='ar'?'الأسلوب والممثلون':'Style & Cast'} done={sec2Done}
                          summary={effectiveVibe ? effectiveVibe.split('—')[0].trim() : undefined} />
                        {openSection === 1 && (
                          <div className="mt-3 flex flex-col gap-5">

                            {/* Vibe & Mood — required, multi-select */}
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{color: f2 ? '#C5A47E' : clr.text}}>
                                {language==='ar'?'المزاج والأجواء':'Vibe & Mood'}
                                <span className="ml-1" style={{color:'#E2C7A8'}}>{f2 ? '✓' : '✱'}</span>
                              </p>
                              <p className="text-[9px] mb-2" style={{color: clr.textMuted}}>{language==='ar'?'اختر واحداً أو أكثر':'Select one or more'}</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🔥',en:'Epic & Grand',ar:'ملحمي وعظيم',v:'Epic and grand — cinematic score, wide establishing shots, larger than life'},
                                  {e:'✨',en:'Luxurious',ar:'فاخر وراقي',v:'Luxurious and prestigious — slow motion, rich textures, gold tones'},
                                  {e:'⚡',en:'Dramatic',ar:'درامي مكثف',v:'Dramatic and intense — high contrast, deep shadows, powerful tension'},
                                  {e:'💛',en:'Emotional',ar:'عاطفي مؤثر',v:'Emotional and heartfelt — soft light, intimate close-ups, stirring music'},
                                  {e:'🌅',en:'Inspiring',ar:'ملهم',v:'Inspiring and uplifting — bright light, rising motion, hopeful tone'},
                                  {e:'💥',en:'High Energy',ar:'طاقة عالية',v:'Exciting and high energy — fast cuts, dynamic movement, adrenaline'},
                                  {e:'🌿',en:'Peaceful',ar:'هادئ',v:'Peaceful and serene — slow camera, nature, stillness, gentle pace'},
                                  {e:'📺',en:'Nostalgic / Retro',ar:'نوستالژيا / ريترو',v:'Nostalgic and retro — warm film grain, faded colors, childhood memory aesthetic'},
                                  {e:'🎞️',en:'Vintage Film',ar:'فيلم كلاسيكي',v:'Vintage film look — heavy grain, muted tones, old-money cinematic quality'},
                                  {e:'🛸',en:'Futuristic',ar:'مستقبلي',v:'Futuristic and hi-tech — neon accents, sleek surfaces, modern urban atmosphere'},
                                  {e:'⬛',en:'Minimalist',ar:'بسيط هادئ',v:'Minimalist and clean — negative space, simple geometry, silent elegance'},

                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaVibe.includes(v)}
                                    onSelect={()=>{
                                      setCinemaVibe(prev => { if (prev.includes(v)) return prev.filter(x=>x!==v); const nonCustom = prev.filter(x=>x!=='Custom'); if (nonCustom.length >= 3) return prev; return [...nonCustom, v]; });
                                    }} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaVibe.includes('Custom')}
                                  onSelect={()=>setCinemaVibe(prev => prev.includes('Custom') ? prev.filter(x=>x!=='Custom') : [...prev, 'Custom'])}
                                  disabled={isDirecting} />
                              </div>
                              {cinemaVibe.includes('Custom') && (
                                <input type="text" value={cinemaVibeCustom} onChange={(e)=>setCinemaVibeCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف المزاج...':'Describe the mood...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm placeholder:text-black/25 outline-none"
                                  style={{background: clr.inputBg, border:'1px solid rgba(226,199,168,0.4)', color: clr.text}} autoFocus />
                              )}
                            </div>

                            {/* Characters — required */}
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color: f3 ? '#C5A47E' : clr.text}}>
                                {language==='ar'?'من يظهر في الفيلم؟':'Who is in the movie?'}
                                <span className="ml-1" style={{color:'#E2C7A8'}}>{f3 ? '✓' : '✱'}</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'📦',en:'No People',ar:'بدون أشخاص',v:'no people — product, object, or creature only'},
                                  {e:'👤',en:'Solo Hero',ar:'بطل واحد',v:'one solo person — the hero, the protagonist'},
                                  {e:'👥',en:'Two People',ar:'شخصان',v:'two people'},
                                  {e:'👨‍👩‍👧‍👦',en:'Family',ar:'العائلة',v:'a family — warm, authentic moments between family members'},
                                  {e:'💼',en:'Professionals',ar:'محترفون',v:'a group of professionals — confident, competent, business-ready'},
                                  {e:'🦅',en:'Animals',ar:'حيوانات',v:'animals or wildlife — majestic creatures as the visual subject'},
                                  {e:'📦',en:'Objects',ar:'منتجات / مجسمات',v:'objects or products — hero product shots, no people'},
                                  {e:'🏟️',en:'Crowd',ar:'حشد',v:'a crowd or community — many people united'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaCharacters.includes(v)}
                                    onSelect={()=>setCinemaCharacters(prev => { if (prev.includes(v)) return prev.filter(x=>x!==v); const nonCustom = prev.filter(x=>x!=='Custom'); if (nonCustom.length >= 3) return prev; return [...nonCustom, v]; })} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaCharacters.includes('Custom')} onSelect={()=>setCinemaCharacters(prev => prev.includes('Custom') ? prev.filter(x=>x!=='Custom') : [...prev, 'Custom'])} disabled={isDirecting} />
                              </div>
                              {(cinemaCharacters.includes('Custom') || cinemaCharacters.includes('\u0645\u062e\u0635\u0635')) && (
                                <input type="text" value={cinemaRelationship} onChange={(e)=>setCinemaRelationship(e.target.value)}
                                  disabled={isDirecting}
                                  placeholder={cinemaCharacters.includes('Custom')?(language==='ar'?'صف الشخصيات...':'Describe characters...'):(language==='ar'?'العلاقة بينهم...':'Relationship between them...')}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm placeholder:text-black/25 outline-none"
                                  style={{background: clr.inputBg, border:'1px solid rgba(226,199,168,0.4)', color: clr.text}} autoFocus />
                              )}
                            </div>

                            {/* Scene count — required, user must tap */}
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color: f4 ? '#C5A47E' : clr.text}}>
                                {language==='ar'?'عدد المشاهد':'How many scenes?'}
                                <span className="ml-1" style={{color:'#E2C7A8'}}>{f4 ? '✓' : '✱'}</span>
                              </p>
                              <div className="flex gap-2">
                                {[1,2,3,4,5,6].map(n=>{
                                  const exceedsQuota = !loadingQuota && n > maxAffordableCinemaScenes;
                                  return (
                                  <button key={n}
                                    onClick={()=>{if (exceedsQuota) return; setCinemaSceneCount(n);setCinemaSceneCountTouched(true);}}
                                    disabled={isDirecting || exceedsQuota}
                                    className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                                    style={{
                                      background: f4 && cinemaSceneCount===n ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : n===3 && !f4 ? 'rgba(226,199,168,0.1)' : clr.numBg,
                                      border: f4 && cinemaSceneCount===n ? '1px solid rgba(226,199,168,0.8)' : n===3 && !f4 ? '1px solid rgba(226,199,168,0.25)' : `1px solid ${clr.numBorder}`,
                                      color: f4 && cinemaSceneCount===n ? '#0c0f14' : clr.numText,
                                    }}>
                                    <span className="text-sm font-bold">{n}</span>
                                    <span className="text-[9px] opacity-80">{n*10}s</span>
                                  </button>
                                )})}
                              </div>
                              {!f4 && <p className="text-[10px] mt-1.5 px-1" style={{color: clr.textSubtle}}>{language==='ar'?'اختر عدداً للمتابعة':'Tap a number to confirm'}</p>}
                              {!loadingQuota && generationMode === 'cinema' && maxAffordableCinemaScenes < 6 && (
                                <p className="text-[10px] mt-1.5 px-1" style={{color: 'rgba(226,199,168,0.78)'}}>
                                  {maxAffordableCinemaScenes > 0
                                    ? (language === 'ar'
                                      ? `يمكنك اختيار حتى ${maxAffordableCinemaScenes} ${maxAffordableCinemaScenes === 1 ? 'مشهد' : 'مشاهد'} حسب رصيد الفيديو المتبقي`
                                      : `You can choose up to ${maxAffordableCinemaScenes} scene${maxAffordableCinemaScenes === 1 ? '' : 's'} based on your remaining video credits`)
                                    : (language === 'ar'
                                      ? 'لا توجد أرصدة فيديو متبقية لهذا الشهر'
                                      : 'No video credits remaining this month')}
                                </p>
                              )}
                            </div>

                            {/* Platform & Format selector */}
                            <div>
                              <p className="text-[10px] mb-1 font-semibold uppercase tracking-wider" style={{color: clr.textMuted}}>
                                {language==='ar'?'المنصة والتنسيق':'Platform & Format'}{selectedSubFormat && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <p className="text-[9px] mb-2" style={{color: clr.textSubtle}}>{language==='ar'?'اختر منصة النشر':'Choose your publishing platform'}</p>
                              <div className="flex flex-wrap gap-2">

                                {/* YouTube — real dropdown */}
                                <div className="relative">
                                  <button
                                    type="button" disabled={isDirecting}
                                    onClick={()=>setSelectedPlatform(p => p==='youtube' ? null : 'youtube')}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                                    style={selectedPlatform==='youtube'||selectedSubFormat?.includes('YouTube')
                                      ? {background:'rgba(255,0,0,0.15)',border:'1.5px solid rgba(255,0,0,0.6)',color:'#fff',boxShadow:'0 0 8px rgba(255,0,0,0.3)'}
                                      : {background: clr.numBg, border:`1px solid ${clr.numBorder}`, color: clr.numText}}
                                  >
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                    <span>{selectedSubFormat?.includes('YouTube') ? selectedSubFormat.replace(' (16:9)','').replace(' (9:16)','') : (language==='ar'?'يوتيوب':'YouTube')}</span>
                                    <span className="text-[9px] opacity-60">{selectedPlatform==='youtube' ? '▴' : '▾'}</span>
                                  </button>
                                  {selectedPlatform==='youtube' && (
                                    <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl" style={{background:'#1a1f2e',border:'1px solid rgba(255,0,0,0.4)',minWidth:'160px'}}>
                                      {([
                                        {label:language==='ar'?'فيديو عادي':'Standard Video', sub:'16:9', fmt:'16:9' as const, sfName:'YouTube Standard (16:9)'},
                                        {label:language==='ar'?'يوتيوب شورتس':'YouTube Shorts', sub:'9:16', fmt:'9:16' as const, sfName:'YouTube Shorts (9:16)'},
                                      ]).map(({label,sub,fmt,sfName})=>(
                                        <button key={sfName} type="button"
                                          onClick={()=>{setCinemaFormat(fmt);setSelectedSubFormat(sfName);setSelectedPlatform(null);}}
                                          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all hover:bg-red-900/30 active:scale-[0.98]"
                                          style={{color: selectedSubFormat===sfName ? '#fff' : 'rgba(255,255,255,0.75)', background: selectedSubFormat===sfName ? 'rgba(255,0,0,0.2)' : 'transparent'}}>
                                          <span>{label}</span>
                                          <span className="opacity-50 text-[9px]">{sub}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* TikTok — instant select */}
                                <button
                                  type="button" disabled={isDirecting}
                                  onClick={()=>{setSelectedPlatform('tiktok');setCinemaFormat('9:16');setSelectedSubFormat('TikTok Vertical (9:16)');}}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                                  style={selectedSubFormat?.includes('TikTok')
                                    ? {background:'rgba(0,0,0,0.5)',border:'1.5px solid #69C9D0',color:'#fff',boxShadow:'0 0 8px rgba(105,201,208,0.4)'}
                                    : {background: clr.numBg, border:`1px solid ${clr.numBorder}`, color: clr.numText}}
                                >
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.29 6.29 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg>
                                  <span>{language==='ar'?'تيك توك':'TikTok'}</span>
                                </button>

                                {/* Instagram — real dropdown */}
                                <div className="relative">
                                  <button
                                    type="button" disabled={isDirecting}
                                    onClick={()=>setSelectedPlatform(p => p==='instagram' ? null : 'instagram')}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                                    style={selectedPlatform==='instagram'||selectedSubFormat?.includes('Instagram')
                                      ? {background:'rgba(188,24,136,0.2)',border:'1.5px solid #cc2366',color:'#fff',boxShadow:'0 0 8px rgba(188,24,136,0.3)'}
                                      : {background: clr.numBg, border:`1px solid ${clr.numBorder}`, color: clr.numText}}
                                  >
                                    <svg viewBox="0 0 24 24" width="13" height="13"><defs><linearGradient id="ig3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig3)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                    <span>{selectedSubFormat?.includes('Instagram') ? selectedSubFormat.replace(' (9:16)','').replace(' (4:5)','') : (language==='ar'?'إنستغرام':'Instagram')}</span>
                                    <span className="text-[9px] opacity-60">{selectedPlatform==='instagram' ? '▴' : '▾'}</span>
                                  </button>
                                  {selectedPlatform==='instagram' && (
                                    <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl" style={{background:'#1a1f2e',border:'1px solid rgba(204,35,102,0.5)',minWidth:'160px'}}>
                                      {([
                                        {label:language==='ar'?'ريلز':'Reels', sub:'9:16', fmt:'9:16' as const, sfName:'Instagram Reels (9:16)'},
                                        {label:language==='ar'?'بوست':'Feed Post', sub:'4:5', fmt:'4:5' as const, sfName:'Instagram Feed Post (4:5)'},
                                        {label:language==='ar'?'ستوري':'Story', sub:'9:16', fmt:'9:16' as const, sfName:'Instagram Story (9:16)'},
                                      ]).map(({label,sub,fmt,sfName})=>(
                                        <button key={sfName} type="button"
                                          onClick={()=>{setCinemaFormat(fmt);setSelectedSubFormat(sfName);setSelectedPlatform(null);}}
                                          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all hover:bg-pink-900/30 active:scale-[0.98]"
                                          style={{color: selectedSubFormat===sfName ? '#fff' : 'rgba(255,255,255,0.75)', background: selectedSubFormat===sfName ? 'rgba(188,24,136,0.25)' : 'transparent'}}>
                                          <span>{label}</span>
                                          <span className="opacity-50 text-[9px]">{sub}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Snapchat — instant select */}
                                <button
                                  type="button" disabled={isDirecting}
                                  onClick={()=>{setSelectedPlatform('snapchat');setCinemaFormat('9:16');setSelectedSubFormat('Snapchat Story (9:16)');}}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                                  style={selectedSubFormat?.includes('Snapchat')
                                    ? {background:'rgba(255,252,0,0.15)',border:'1.5px solid rgba(255,252,0,0.7)',color:'#fff',boxShadow:'0 0 8px rgba(255,252,0,0.3)'}
                                    : {background: clr.numBg, border:`1px solid ${clr.numBorder}`, color: clr.numText}}
                                >
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="#FFFC00"><path d="M12.166.006c.94-.006 4.55.26 6.22 3.79.56 1.17.44 3.14.35 4.73l-.02.3c-.01.21-.02.41-.03.58.24-.09.5-.22.74-.39.3-.21.61-.3.9-.27.5.05.95.43.98.85.03.38-.2.79-.73 1.1-.09.05-.21.11-.35.17-.44.19-1.07.43-1.27 1.01-.1.3.01.64.34 1.03.02.02 1.93 2.44 4.55 2.86.18.03.31.19.29.37-.02.16-.14.29-.29.32-.03.01-.05.01-.08.02-.45.09-2.18.46-2.48 1.5-.06.2-.22.31-.43.26-.11-.02-.22-.04-.36-.07-.56-.12-1.29-.28-2.29-.28-.42 0-.86.03-1.29.1-.87.14-1.62.61-2.42 1.11-.97.59-1.96 1.21-3.27 1.21s-2.3-.62-3.27-1.21c-.8-.5-1.55-.97-2.42-1.11-.43-.07-.87-.1-1.29-.1-1 0-1.73.16-2.29.28-.13.03-.25.05-.36.07-.21.05-.37-.06-.43-.26-.3-1.04-2.03-1.41-2.48-1.5-.03 0-.05-.01-.08-.02-.15-.03-.27-.16-.29-.32-.02-.18.11-.34.29-.37 2.62-.42 4.52-2.82 4.55-2.86.33-.39.44-.73.34-1.03-.2-.58-.83-.82-1.27-1.01-.14-.06-.26-.12-.35-.17-.48-.28-.74-.68-.73-1.1.03-.42.48-.8.98-.85.29-.03.6.06.9.27.24.17.5.3.74.39-.01-.17-.02-.37-.03-.58l-.02-.3c-.09-1.59-.21-3.56.35-4.73C7.616.272 11.17.012 12.116.006h.05z"/></svg>
                                  <span>{language==='ar'?'سناب شات':'Snapchat'}</span>
                                </button>

                              </div>
                            </div>

                            {sec2Done && (
                              <button type="button" onClick={()=>setCinemaOpenSection(2)}
                                className="self-end px-4 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                                style={{background:'linear-gradient(135deg,#E2C7A8,#C5A47E)', color:'#0c0f14', boxShadow:'0 2px 12px rgba(226,199,168,0.4)'}}>
                                {language==='ar'?'التالي ›':'Next ›'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── SECTION 3: All optionals together ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background: clr.cardBg, border: `1px solid ${clr.cardBorder}`}}>
                        <SecHeader idx={2} optional
                          label={language==='ar'?'تفاصيل إضافية':'Extra Details'}
                          done={!!(effectiveSetting || effectiveAction || effectiveCTA)}
                          summary={effectiveSetting || effectiveAction || effectiveCTA || undefined} />
                        {openSection === 2 && (
                          <div className="mt-3 flex flex-col gap-5">

                            {/* Setting — multi-select */}
                            <div>
                              <p className="text-[10px] mb-1 font-semibold uppercase tracking-wider" style={{color: clr.textMuted}}>
                                {language==='ar'?'الموقع':'Setting'}{effectiveSetting && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <p className="text-[9px] mb-2" style={{color: clr.textSubtle}}>{language==='ar'?'اختر واحداً أو أكثر':'Select one or more'}</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🏙️',en:'City Night',ar:'مدينة ليلاً',v:'a futuristic modern city skyline at night, glass towers reflecting light'},
                                  {e:'🌇',en:'City Day',ar:'مدينة نهاراً',v:'a vibrant modern city skyline during the day, blue sky, busy streets, urban energy'},
                                  {e:'🏜️',en:'Desert',ar:'صحراء',v:'a vast open desert at golden hour, endless sand dunes, warm haze'},
                                  {e:'🌊',en:'Ocean',ar:'ساحل',v:'an ocean coastline at sunrise, crashing waves, warm mist'},
                                  {e:'🚀',en:'Space',ar:'الفضاء',v:'outer space, earth from orbit, stars and galaxies stretching forever'},
                                  {e:'🏔️',en:'Mountains',ar:'جبال',v:'dramatic mountain peaks above the clouds, epic wide shot'},
                                  {e:'🌲',en:'Forest',ar:'غابة',v:'a lush green forest, rays of light through tall trees'},
                                  {e:'🏠',en:'Luxury Interior',ar:'تصميم داخلي فاخر',v:'a high-end luxury interior — marble floors, tall ceilings, warm ambient lighting, premium furniture'},
                                  {e:'🕌',en:'Heritage / Traditional',ar:'تراثي / تقليدي',v:'a traditional GCC heritage setting — old market, wind towers, traditional architecture, warm earth tones'},
                                  {e:'🏢',en:'Modern Office',ar:'مكتب عصري',v:'a sleek modern corporate office — glass walls, open plan, professional lighting'},
                                  {e:'🛣️',en:'Highway / Road',ar:'طريق سريعة',v:'a long open highway stretching into the horizon, heat haze, dramatic sky'},

                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaSetting.includes(v)}
                                    onSelect={()=>setCinemaSetting(prev => { if (prev.includes(v)) return prev.filter(x=>x!==v); const nonCustom = prev.filter(x=>x!=='Custom'); if (nonCustom.length >= 3) return prev; return [...nonCustom, v]; })}
                                    disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaSetting.includes('Custom')}
                                  onSelect={()=>setCinemaSetting(prev => prev.includes('Custom') ? prev.filter(x=>x!=='Custom') : [...prev, 'Custom'])}
                                  disabled={isDirecting} />
                              </div>
                              {cinemaSetting.includes('Custom') && (
                                <input type="text" value={cinemaSettingCustom} onChange={(e)=>setCinemaSettingCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف الموقع...':'Describe the setting...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm placeholder:text-black/25 outline-none"
                                  style={{background: clr.inputBg, border:'1px solid rgba(226,199,168,0.4)', color: clr.text}} autoFocus />
                              )}
                            </div>

                            {/* Main Action — multi-select */}
                            <div>
                              <p className="text-[10px] mb-1 font-semibold uppercase tracking-wider" style={{color: clr.textMuted}}>
                                {language==='ar'?'الحدث الرئيسي':'Main Action'}{effectiveAction && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <p className="text-[9px] mb-2" style={{color: clr.textSubtle}}>{language==='ar'?'اختر واحداً أو أكثر':'Select one or more'}</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🎬',en:'Dramatic Reveal',ar:'كشف درامي',v:'a slow dramatic cinematic reveal — the subject emerges from darkness into a spotlight'},
                                  {e:'🚀',en:'Soaring Flight',ar:'تحليق جريء',v:'soaring and flying at high speed through a dramatic environment'},
                                  {e:'❤️',en:'Human Moment',ar:'لحظة إنسانية',v:'an intimate human moment — warmth, connection, and genuine emotion'},
                                  {e:'🌍',en:'Epic Journey',ar:'رحلة ملحمية',v:'a sweeping aerial journey — camera glides over landscapes and terrain'},
                                  {e:'🎉',en:'Celebration',ar:'احتفال',v:'a joyful celebration — energy, movement, confetti, people coming together'},
                                  {e:'🛸',en:'Drone Sweep',ar:'مسح طائرة درون',v:'a cinematic drone sweep — wide aerial pull-back revealing scale and grandeur of the scene'},
                                  {e:'🔍',en:'Product Close-up',ar:'لقطة مقربة للمنتج',v:'a detailed product close-up — macro lens, texture and craftsmanship, slow rotation'},
                                  {e:'🚶‍♂️',en:'Cinematic Walk',ar:'مشي سينمائي',v:'a confident cinematic walk — hero strides forward, camera tracks alongside or follows from behind'},
                                  {e:'⚡',en:'Fast Motion / Speed',ar:'حركة سريعة',v:'fast motion and speed — blurred streaks, rapid movement, adrenaline-fueled energy'},

                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaAction.includes(v)}
                                    onSelect={()=>setCinemaAction(prev => { if (prev.includes(v)) return prev.filter(x=>x!==v); const nonCustom = prev.filter(x=>x!=='Custom'); if (nonCustom.length >= 3) return prev; return [...nonCustom, v]; })}
                                    disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaAction.includes('Custom')}
                                  onSelect={()=>setCinemaAction(prev => prev.includes('Custom') ? prev.filter(x=>x!=='Custom') : [...prev, 'Custom'])}
                                  disabled={isDirecting} />
                              </div>
                              {cinemaAction.includes('Custom') && (
                                <input type="text" value={cinemaActionCustom} onChange={(e)=>setCinemaActionCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف الحدث...':'Describe the action...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm placeholder:text-black/25 outline-none"
                                  style={{background: clr.inputBg, border:'1px solid rgba(226,199,168,0.4)', color: clr.text}} autoFocus />
                              )}
                            </div>

                            {/* Goal */}
                            <div>
                              <p className="text-[10px] mb-2 font-semibold uppercase tracking-wider" style={{color: clr.textMuted}}>
                                {language==='ar'?'هدف الفيديو':'Video Goal'}{effectiveCTA && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🛍️',en:'Sell Product',ar:'بيع منتج',v:'sell or promote a product — end with a strong desire to buy'},
                                  {e:'🏷️',en:'Brand',ar:'هوية العلامة',v:'build brand identity — make the audience feel who we are'},
                                  {e:'📣',en:'Announce',ar:'إعلان حدث',v:'announce an event or launch — create urgency and excitement'},
                                  {e:'💪',en:'Inspire',ar:'إلهام',v:'inspire and motivate the viewer — leave them feeling empowered'},
                                  {e:'❤️',en:'Emotional',ar:'تواصل عاطفي',v:'create an emotional connection — make the audience feel deeply'},
                                  {e:'📱',en:'Go Viral',ar:'انتشار واسع',v:'grow social media presence — designed to be shared and go viral'},
                                  {e:'🏠',en:'Real Estate Tour',ar:'جولة عقارية',v:'showcase a property — highlight space, luxury finishes, and lifestyle — make the viewer want to live there'},
                                  {e:'🚗',en:'Automotive / Speed',ar:'عرض سيارات',v:'showcase an automotive vehicle — power, speed, design — evoke desire and aspiration'},
                                  {e:'🍴',en:'Food & Beverage',ar:'مطاعم ومأكولات',v:'showcase food and dining — close-up textures, steam, pour shots, appetite appeal'},

                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v}
                                    selected={cinemaCTA.includes(v)} onSelect={()=>setCinemaCTA(prev => { if (prev.includes(v)) return prev.filter(x=>x!==v); const nonCustom = prev.filter(x=>x!=='Custom'); if (nonCustom.length >= 3) return prev; return [...nonCustom, v]; })} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaCTA.includes('Custom')} onSelect={()=>setCinemaCTA(prev => prev.includes('Custom') ? prev.filter(x=>x!=='Custom') : [...prev, 'Custom'])} disabled={isDirecting} />
                              </div>
                              {cinemaCTA.includes('Custom') && (
                                <input type="text" value={cinemaCTACustom} onChange={(e)=>setCinemaCTACustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف الهدف...':'Describe the goal...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm placeholder:text-black/25 outline-none"
                                  style={{background: clr.inputBg, border:'1px solid rgba(226,199,168,0.4)', color: clr.text}} autoFocus />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PREVIEW & START DIRECTING button */}
                    <div className="pt-2 max-w-lg mx-auto w-full">
                      {isDirecting ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-4 h-4 rounded-full bg-[#E2C7A8] animate-pulse" />
                              <div className="absolute inset-0 w-4 h-4 rounded-full bg-[#E2C7A8] animate-ping opacity-30" />
                            </div>
                            <span className="text-lg font-semibold text-[#E2C7A8] animate-pulse">
                              {language === 'ar' ? 'المخرج يكتب السيناريو...' : 'Director is scripting...'}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 max-w-md text-center">
                            {language === 'ar'
                              ? `جاري تحليل رؤيتك وإنشاء ${cinemaSceneCount} مشاهد سينمائية...`
                              : `Analyzing your vision and creating ${cinemaSceneCount} cinematic scene${cinemaSceneCount === 1 ? '' : 's'}...`}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleDirect}
                          disabled={!isFormReady || isDirecting}
                          className="relative w-full h-16 text-lg font-bold rounded-xl border-0 transition-all active:scale-[0.98] overflow-hidden"
                          style={{
                            background: isFormReady
                              ? 'linear-gradient(135deg, #E2C7A8 0%, #C5A47E 50%, #E2C7A8 100%)'
                              : 'rgba(226,199,168,0.12)',
                            backgroundSize: isFormReady ? '200% 100%' : '100% 100%',
                            animation: isFormReady ? 'shimmerGold 2.5s ease-in-out infinite' : 'none',
                            boxShadow: isFormReady ? '0 12px 40px rgba(226,199,168,0.45), 0 6px 20px rgba(197,164,126,0.3)' : 'none',
                            color: isFormReady ? '#0c0f14' : 'rgba(226,199,168,0.4)',
                            border: isFormReady ? 'none' : '1px solid rgba(226,199,168,0.2)',
                            cursor: isFormReady ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <div className="flex items-center justify-center gap-3">
                            <Film className={`h-6 w-6 ${!isFormReady ? 'opacity-40' : ''}`} />
                            <span>
                              {isFormReady
                                ? (language === 'ar' ? 'معاينة وابدأ الإخراج' : 'PREVIEW & START DIRECTING')
                                : (language === 'ar' ? 'أكمل الحقول للمتابعة...' : 'Fill in the fields above to continue...')}
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })()}

                {cinemaStep === 'storyboard' && (
                  <div className="flex flex-col gap-4 pb-4">
                    {/* Header + controls row */}
                    <div className="flex items-center justify-between px-1 gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white">{language === 'ar' ? 'اللوحة الإخراجية' : 'The Storyboard'}</h3>
                        <p className="text-xs text-white/50 mt-0.5">{language === 'ar' ? 'حرر أو أعد كتابة أي مشهد' : 'Edit or rewrite any scene'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Regen All */}
                        {cinemaScenes.length >= cinemaSceneCount && (
                          <button
                            onClick={() => { setCinemaScenes([]); setIsDirecting(true); handleDirect(); }}
                            disabled={isDirecting || regenSceneNum !== null}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40"
                            style={{background:'rgba(226,199,168,0.12)',border:'1px solid rgba(226,199,168,0.3)',color:'#E2C7A8'}}
                            title={language === 'ar' ? 'إعادة كتابة كل المشاهد' : 'Rewrite all scenes'}
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>{language === 'ar' ? 'إعادة الكل' : 'Regen All'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Vertical stacked scene cards */}
                    <div className="flex flex-col gap-3">
                      {Array.from({length: cinemaSceneCount}, (_, i) => i + 1).map((sceneNum) => {
                        const scene = cinemaScenes.find(s => s.scene === sceneNum);
                        const isEditing = editingSceneNum === sceneNum;
                        const isRegening = regenSceneNum === sceneNum;
                        return (
                          <div
                            key={sceneNum}
                            className={`relative rounded-2xl p-4 flex flex-col gap-3 transition-all ${!scene ? 'cinema-painting-skeleton' : ''}`}
                            style={{
                              backdropFilter: 'blur(12px)',
                              background: scene ? 'rgba(226,199,168,0.08)' : 'rgba(255,255,255,0.02)',
                              border: isEditing ? '1px solid rgba(226,199,168,0.7)' : scene ? '1px solid rgba(226,199,168,0.35)' : '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {/* Scene badge + action buttons */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{background: scene ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : 'rgba(255,255,255,0.08)', color: scene ? '#0c0f14' : 'rgba(255,255,255,0.4)'}}>
                                  {sceneNum}
                                </div>
                                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                                  {language === 'ar' ? `مشهد ${sceneNum} • ١٠ث` : `Scene ${sceneNum} • 10s`}
                                </span>
                              </div>
                              {scene && !isEditing && (
                                <div className="flex items-center gap-1.5">
                                  {/* Edit */}
                                  <button
                                    onClick={() => { setEditingSceneNum(sceneNum); setEditingSceneText(scene.text); }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all active:scale-95"
                                    style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)'}}
                                    title={language === 'ar' ? 'تحرير' : 'Edit scene'}
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                    <span>{language === 'ar' ? 'تحرير' : 'Edit'}</span>
                                  </button>
                                  {/* Regen this scene */}
                                  <button
                                    onClick={() => handleRegenScene(sceneNum)}
                                    disabled={regenSceneNum !== null}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                                    style={{background:'rgba(226,199,168,0.1)',border:'1px solid rgba(226,199,168,0.25)',color:'#E2C7A8'}}
                                    title={language === 'ar' ? 'إعادة كتابة هذا المشهد' : 'Rewrite this scene'}
                                  >
                                    {isRegening ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                                    <span>{language === 'ar' ? 'إعادة' : 'Regen'}</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Scene text — view or edit */}
                            {(() => {
                              // Sanitize: strip Visual DNA and SCENE ACTION technical blocks from display
                              const sanitizeSceneText = (raw: string) => {
                                return raw
                                  .replace(/Visual DNA:.*?(\n|$)/gi, '')
                                  .replace(/\[SCENE ACTION\]:.*?(\n|$)/gi, '')
                                  .replace(/\[VISUAL DNA\][^[]*(\[|$)/gi, '')
                                  .trim();
                              };
                              // Extract Visual DNA badge text if present
                              const extractDnaBadge = (raw: string) => {
                                const match = raw.match(/Visual DNA:\s*([^\n\[]+)/i) || raw.match(/\[VISUAL DNA\]\s*([^\[]+)/i);
                                return match ? match[1].trim().slice(0, 60) : null;
                              };
                              const dnaBadge = scene ? extractDnaBadge(scene.text) : null;
                              const cleanText = scene ? sanitizeSceneText(scene.text) : '';
                              return (
                            <div className="flex-1 min-h-[40px]">
                              {dnaBadge && !isEditing && (
                                <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                                  style={{background:'rgba(226,199,168,0.12)',border:'1px solid rgba(226,199,168,0.25)',color:'rgba(226,199,168,0.7)'}}>
                                  <span>🎨</span>
                                  <span>{language === 'ar' ? 'النمط: ' : 'Style: '}{dnaBadge}</span>
                                </div>
                              )}
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <textarea
                                    value={editingSceneText}
                                    onChange={(e) => setEditingSceneText(e.target.value)}
                                    className="w-full text-xs leading-relaxed text-[#E2C7A8]/90 bg-transparent resize-none outline-none rounded-lg p-2"
                                    rows={5}
                                    style={{border:'1px solid rgba(226,199,168,0.3)',background:'rgba(0,0,0,0.3)'}}
                                    aria-label={language === 'ar' ? 'تحرير نص المشهد' : 'Edit scene text'}
                                    autoFocus
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => { setEditingSceneNum(null); setEditingSceneText(''); }}
                                      className="px-3 py-1 rounded-lg text-[10px] font-semibold transition-all"
                                      style={{background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.5)'}}
                                    >{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                                    <button
                                      onClick={() => handleSaveSceneEdit(sceneNum, editingSceneText)}
                                      className="px-3 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                                      style={{background:'linear-gradient(135deg,#E2C7A8,#C5A47E)',color:'#0c0f14'}}
                                    >{language === 'ar' ? 'حفظ' : 'Save'}</button>
                                  </div>
                                </div>
                              ) : isRegening ? (
                                <div className="flex items-center gap-2 text-[#E2C7A8]/50">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-xs">{language === 'ar' ? 'يعيد الكتابة...' : 'Rewriting...'}</span>
                                </div>
                              ) : scene ? (
                                <p className="text-xs leading-relaxed text-[#E2C7A8]/90">
                                  <TypewriterText text={cleanText || scene.text} delay={sceneNum * 200} />
                                </p>
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Loader2 className="h-5 w-5 animate-spin text-[#E2C7A8]/30" />
                                </div>
                              )}
                            </div>
                          );
                            })()}
                          </div>
                        );
                      })}
                    </div>

                    {/* Style & Brand Foundation reminder — upload is in Step 1 */}
                    {cinemaScenes.length >= cinemaSceneCount && brandAnchor && (
                      <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{background:'rgba(226,199,168,0.06)',border:'1px solid rgba(226,199,168,0.18)'}}>
                        <img src={brandAnchor} alt="Brand anchor" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" style={{border:'1px solid rgba(226,199,168,0.35)'}} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[#E2C7A8] uppercase tracking-wider">{language === 'ar' ? 'أساس الهوية البصرية مُفعَّل' : 'Style & Brand Foundation Active'}</p>
                          <p className="text-[9px] text-white/35 mt-0.5 truncate">{language === 'ar' ? 'جميع المشاهد ستُنجز بنمط هذه الصورة' : 'All scenes will be rendered in this style'}</p>
                        </div>
                        <span className="text-green-400 text-sm flex-shrink-0">✓</span>
                      </div>
                    )}

                    {/* Sticky footer — CAST YOUR MOVIE */}
                    {cinemaScenes.length >= cinemaSceneCount && (
                      <div className="cinema-sticky-footer px-4 py-3">
                        <button
                          onClick={() => {
                            if (cinemaMode === 'custom') {
                              setSceneImages(Array(cinemaSceneCount).fill(null));
                              setSceneImageOptions(Array(cinemaSceneCount).fill(null));
                              setCastingProgress(Array(cinemaSceneCount).fill('idle'));
                              setCinemaStep('casting');
                            } else {
                              handleCast();
                            }
                          }}
                          disabled={isCasting}
                          className="relative w-full h-14 text-base font-bold rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                          style={cinemaMode === 'custom'
                            ? {background:'linear-gradient(135deg,hsl(210,100%,60%),hsl(280,70%,65%))',boxShadow:'0 8px 32px hsla(210,100%,65%,0.4)',color:'#fff'}
                            : {background:'linear-gradient(135deg,#E2C7A8 0%,#C5A47E 50%,#E2C7A8 100%)',backgroundSize:'200% 100%',animation:'shimmerGold 2.5s ease-in-out infinite',boxShadow:'0 8px 32px rgba(226,199,168,0.4)',color:'#0c0f14'}}
                        >
                          {isCasting ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>{language === 'ar' ? 'المصور يرسم الصور...' : 'Artist is painting...'}</span>
                            </div>
                          ) : cinemaMode === 'custom' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span>🎥</span>
                              <span>{language === 'ar' ? 'رفع صور المشاهد يدوياً' : 'Upload My Own Scene Images'}</span>
                              <ArrowRight className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Camera className="h-5 w-5" />
                              <span>{language === 'ar' ? 'بدء التصوير' : 'NEXT: CAST YOUR MOVIE'}</span>
                              <ArrowRight className="h-5 w-5" />
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {cinemaStep === 'casting' && (
                  <div className="flex flex-col gap-4 pb-4">
                    {/* Header */}
                    <div className="text-center space-y-1 px-1">
                      <h3 className="text-lg font-bold text-white">
                        {cinemaMode === 'custom'
                          ? (language === 'ar' ? '🎥 رفع صور المشاهد' : '🎥 Upload Scene Images')
                          : (language === 'ar' ? 'تصوير المشاهد' : 'Casting the Movie')}
                      </h3>
                      <p className="text-xs text-white/50">
                        {cinemaMode === 'custom'
                          ? (language === 'ar' ? 'ارفع صورة لكل مشهد — ثم اضغط تصوير' : 'Upload one image per scene — then tap Film')
                          : isCasting
                            ? (language === 'ar' ? 'المصور الذكي يرسم مشاهدك...' : 'AI Artist is painting your scenes...')
                            : (language === 'ar' ? 'اختر صورة المرساة للمشهد الأول' : 'Your scenes are ready — approve to film')}
                      </p>
                    </div>

                    {/* Master Anchor Preview — auto mode only */}
                    {cinemaMode === 'auto' && anchorImageUrl && (
                      <div className="mx-auto cinema-diamond-border rounded-2xl overflow-hidden"
                        style={{width: cinemaFormat === '16:9' ? '100%' : '60%', aspectRatio: cinemaFormat === '16:9' ? '16/9' : '9/16', maxHeight: '240px'}}>
                        <img src={anchorImageUrl} alt="Anchor scene" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* ── Scene Stepper (auto mode) / Upload grid (custom mode) ── */}
                    {cinemaMode === 'custom' ? (
                      // ── CUSTOM MODE: 2-col upload grid ──
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({length: cinemaSceneCount}, (_, i) => i).map((idx) => {
                          const img = sceneImages[idx];
                          const prog = castingProgress[idx];
                          return (
                            <div key={idx} className="relative flex flex-col gap-1">
                              <label
                                className="relative rounded-2xl overflow-hidden cursor-pointer flex flex-col items-center justify-center transition-all active:scale-95"
                                style={{aspectRatio: cinemaFormat === '16:9' ? '16/9' : '9/16', minHeight: '100px', background: img ? 'rgba(12,15,20,0.9)' : 'rgba(12,15,20,0.5)', border: img ? '1px solid rgba(226,199,168,0.6)' : '2px dashed rgba(255,255,255,0.15)'}}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !user) return;
                                    setCastingProgress(prev => { const n = [...prev]; n[idx] = 'loading'; return n; });
                                    try {
                                      const ext = file.name.split('.').pop() || 'jpg';
                                      const path = `${user.id}/cinema-custom/scene-${idx}-${Date.now()}.${ext}`;
                                      await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                                      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                                      if (urlData?.publicUrl) {
                                        setSceneImages(prev => { const n = [...prev]; n[idx] = urlData.publicUrl; return n; });
                                        setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
                                      }
                                    } catch {
                                      setCastingProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
                                      toast.error(language === 'ar' ? 'فشل رفع الصورة' : 'Upload failed');
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                {img ? (
                                  <img src={img} alt={`Scene ${idx+1}`} className="w-full h-full object-cover" />
                                ) : prog === 'loading' ? (
                                  <Loader2 className="h-6 w-6 animate-spin text-[#E2C7A8]/60" />
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <Upload className="h-5 w-5 text-white/30" />
                                    <span className="text-[9px] text-white/30 font-semibold">
                                      {language === 'ar' ? 'اضغط للرفع' : 'Tap to upload'}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                                  style={{background:'rgba(12,15,20,0.75)',color: img ? '#E2C7A8' : 'rgba(255,255,255,0.35)'}}>
                                  {language === 'ar' ? `م${idx+1}` : `S${idx+1}`}{img && ' ✓'}
                                </div>
                                {img && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setSceneImages(prev => { const n = [...prev]; n[idx] = null; return n; }); setCastingProgress(prev => { const n = [...prev]; n[idx] = 'idle'; return n; }); }}
                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{background:'rgba(0,0,0,0.7)',color:'rgba(255,255,255,0.7)'}}
                                  >✕</button>
                                )}
                              </label>
                              {cinemaScenes[idx] && (
                                <p className="text-[9px] text-white/40 px-1 line-clamp-2 leading-tight">
                                  {cinemaScenes[idx].text.slice(0, 60)}{cinemaScenes[idx].text.length > 60 ? '…' : ''}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // ── AUTO MODE: Focused Scene Stepper ──
                      <div className="flex flex-col gap-2">
                        {Array.from({length: cinemaSceneCount}, (_, i) => i).map((idx) => {
                          const img = sceneImages[idx];
                          const prog = castingProgress[idx];
                          const opts = sceneImageOptions[idx];
                          const isActive = idx === activeCastingIdx;
                          const isDone = prog === 'done' && img !== null;
                          const hasChoice = opts && opts.length >= 1 && !img;
                          const sceneText = cinemaScenes[idx]?.text || '';

                          // ── DONE + COLLAPSED: slim summary bar ──
                          if (isDone && !isActive) {
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveCastingIdx(idx)}
                                className="flex items-center gap-3 w-full rounded-2xl px-3 transition-all active:scale-[0.99]"
                                style={{height:'60px', background:'rgba(226,199,168,0.06)', border:'1px solid rgba(226,199,168,0.2)'}}
                              >
                                {/* Thumbnail */}
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden" style={{border:'1px solid rgba(226,199,168,0.35)'}}>
                                  <img src={img!} alt={`S${idx+1}`} className="w-full h-full object-cover" />
                                </div>
                                {/* Scene label */}
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-xs font-bold" style={{color:'#E2C7A8'}}>
                                    {language === 'ar' ? `مشهد ${idx + 1}` : `Scene ${idx + 1}`}
                                  </p>
                                  {sceneText && (
                                    <p className="text-[10px] truncate" style={{color:'rgba(255,255,255,0.35)'}}>
                                      {sceneText.slice(0, 45)}{sceneText.length > 45 ? '…' : ''}
                                    </p>
                                  )}
                                </div>
                                {/* Green checkmark + edit hint */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-sm" style={{color:'#4ade80'}}>✓</span>
                                  <span className="text-[9px]" style={{color:'rgba(255,255,255,0.25)'}}>
                                    {language === 'ar' ? 'تغيير' : 'change'}
                                  </span>
                                </div>
                              </button>
                            );
                          }

                          // ── IDLE / LOADING / ERROR: not yet active ──
                          // If this scene already has opts ready (loaded while not active), make it tappable
                          if (!isActive && !isDone) {
                            const canOpen = opts && opts.length >= 1 && !img;
                            return (
                              <div
                                key={idx}
                                onClick={canOpen ? () => setActiveCastingIdx(idx) : undefined}
                                className={`flex items-center gap-3 w-full rounded-2xl px-3${canOpen ? ' cursor-pointer active:scale-[0.99]' : ''}`}
                                style={{height:'52px', background: canOpen ? 'rgba(226,199,168,0.06)' : 'rgba(255,255,255,0.02)', border: canOpen ? '1px solid rgba(226,199,168,0.3)' : '1px solid rgba(255,255,255,0.06)'}}
                              >
                                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)'}}>
                                  {prog === 'loading' ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-[#E2C7A8]/40" />
                                  ) : prog === 'error' ? (
                                    <span className="text-red-400 text-xs">✗</span>
                                  ) : (
                                    <span className="text-[10px] font-bold" style={{color:'rgba(255,255,255,0.2)'}}>{idx + 1}</span>
                                  )}
                                </div>
                                <p className="text-xs flex-1" style={{color: (opts && opts.length >= 1 && !img) ? 'rgba(226,199,168,0.7)' : 'rgba(255,255,255,0.2)'}}>
                                  {prog === 'loading'
                                    ? (language === 'ar' ? 'جاري الرسم...' : 'Painting…')
                                    : prog === 'error'
                                    ? (language === 'ar' ? 'فشل التوليد' : 'Generation failed')
                                    : (opts && opts.length >= 1 && !img)
                                    ? (language === 'ar' ? `مشهد ${idx + 1} — اضغط للاختيار` : `Scene ${idx + 1} — tap to pick`)
                                    : (language === 'ar' ? `مشهد ${idx + 1}` : `Scene ${idx + 1}`)}
                                </p>
                                {prog === 'error' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCastingRegenScene(idx, '', true, null)}
                                    disabled={isRegenningScene}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                                    style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.4)',color:'#f87171'}}
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    <span>{language === 'ar' ? 'إعادة' : 'Retry'}</span>
                                  </button>
                                )}
                              </div>
                            );
                          }

                          // ── ACTIVE: expanded focused card ──
                          return (
                            <div key={idx} className="flex flex-col gap-3 rounded-2xl p-4" style={{background:'rgba(226,199,168,0.06)', border:'1.5px solid rgba(226,199,168,0.4)'}}>
                              {/* Header: Scene X of N */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold" style={{color:'#E2C7A8'}}>
                                    {language === 'ar'
                                      ? `مشهد ${idx + 1} من ${cinemaSceneCount}`
                                      : `Scene ${idx + 1} of ${cinemaSceneCount}`}
                                  </h4>
                                  {sceneText && (
                                    <p className="text-[11px] italic mt-0.5 leading-tight" style={{color:'rgba(255,255,255,0.45)'}}>
                                      {sceneText.slice(0, 50)}{sceneText.length > 50 ? '…' : ''}
                                    </p>
                                  )}
                                </div>
                                {/* Loading spinner shown in card header while painting */}
                                {prog === 'loading' && (
                                  <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{color:'rgba(226,199,168,0.5)'}} />
                                )}
                              </div>

                              {/* Multi-shot picker or single-image or loading/error state */}
                              {hasChoice && opts ? (
                                // All returned shots — vertical stack, labeled Shot 1 / Shot 2 / ...
                                <div>
                                  <p className="text-[10px] font-semibold mb-2 text-center" style={{color:'rgba(226,199,168,0.7)'}}>
                                    {language === 'ar' ? `اختر لقطة (${opts.length} متاحة)` : `Pick a shot (${opts.length} available)`}
                                  </p>
                                  <div className="flex flex-col gap-2">
                                    {opts.map((shotUrl, shotIdx) => (
                                      <button
                                        key={shotIdx}
                                        type="button"
                                        onClick={() => {
                                          setSceneImages(prev => { const n = [...prev]; n[idx] = shotUrl; return n; });
                                          setSceneImageOptions(prev => { const n = [...prev]; n[idx] = null; return n; });
                                          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
                                          if (idx === 0) setAnchorImageUrl(shotUrl);
                                          setActiveCastingIdx(prev => Math.min(prev + 1, cinemaSceneCount - 1));
                                          runVisualSupervisor(idx, shotUrl, cinemaScenes[idx]?.english_prompt || cinemaScenes[idx]?.text || '');
                                        }}
                                        className="relative w-full rounded-2xl overflow-hidden transition-all active:brightness-125 active:scale-[0.99]"
                                        style={{border:'1.5px solid rgba(226,199,168,0.4)', background:'none', padding:0}}
                                      >
                                        <img src={shotUrl} alt={`Shot ${shotIdx + 1}`} className="w-full object-cover block" style={{maxHeight:'300px'}} />
                                        {/* Shot number badge */}
                                        <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{background:'rgba(12,15,20,0.88)',color:'#E2C7A8'}}>
                                          {language === 'ar' ? `لقطة ${shotIdx + 1}` : `Shot ${shotIdx + 1}`}
                                        </div>
                                        {/* VS scanning overlay — only on the most recently picked shot */}
                                        {vsStatus[idx] === 'scanning' && (
                                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-semibold flex items-center gap-1" style={{background:'rgba(12,15,20,0.85)',color:'rgba(226,199,168,0.8)'}}>
                                            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#E2C7A8'}} />
                                            {language === 'ar' ? 'المشرف يحدد الأبعاد...' : 'Supervisor mapping physics...'}
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : img ? (
                                // Single image — show with regen option
                                <div className="relative rounded-2xl overflow-hidden" style={{border:'1px solid rgba(226,199,168,0.35)'}}>
                                  <img src={img} alt={`Scene ${idx+1}`} className="w-full object-cover" style={{maxHeight:'300px'}} />
                                  {!isCasting && (
                                    <button
                                      onClick={() => { setCastingRegenModal({ sceneIdx: idx }); setCastingRegenNote(''); setCastingRegenUseMaster(true); }}
                                      disabled={isRegenningScene}
                                      className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40"
                                      style={{background:'rgba(12,15,20,0.85)',border:'1px solid rgba(226,199,168,0.4)',color:'#E2C7A8',backdropFilter:'blur(8px)'}}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      <span>{language === 'ar' ? 'إعادة' : 'Regen'}</span>
                                    </button>
                                  )}
                                </div>
                              ) : prog === 'error' ? (
                                <div className="flex flex-col items-center gap-3 py-6">
                                  <span className="text-red-400 text-2xl">✗</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCastingRegenScene(idx, '', true, null)}
                                    disabled={isRegenningScene}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                                    style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.5)',color:'#f87171'}}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>{language === 'ar' ? 'إعادة محاولة' : 'Retry Scene'}</span>
                                  </button>
                                </div>
                              ) : (
                                // Loading state inside active card
                                <div className="flex flex-col items-center gap-2 py-8">
                                  <Loader2 className="h-8 w-8 animate-spin" style={{color:'rgba(226,199,168,0.4)'}} />
                                  <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>
                                    {language === 'ar' ? 'الذكاء الاصطناعي يرسم...' : 'AI is painting…'}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Casting Regen Modal */}
                    {castingRegenModal !== null && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px) saturate(0.4)'}}
                        onPointerDown={(e) => { if (e.target === e.currentTarget) { setCastingRegenModal(null); setCastingRegenNote(''); setCastingRegenSceneAnchor(null); } }}
                      >
                        <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
                          style={{background:'rgba(12,15,20,0.97)',border:'1px solid rgba(226,199,168,0.3)',boxShadow:'0 24px 60px rgba(0,0,0,0.8)'}}>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-[#E2C7A8]">
                              {language === 'ar' ? `إعادة توليد المشهد ${castingRegenModal.sceneIdx + 1}` : `Regenerate Scene ${castingRegenModal.sceneIdx + 1}`}
                            </h4>
                            <button onClick={() => { setCastingRegenModal(null); setCastingRegenNote(''); setCastingRegenSceneAnchor(null); }}
                              className="text-white/40 hover:text-white/70 text-sm transition-colors">✕</button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                              {language === 'ar' ? 'تغييرات محددة (اختياري)' : 'Director\'s note (optional)'}
                            </label>
                            <input
                              type="text"
                              value={castingRegenNote}
                              onChange={(e) => setCastingRegenNote(e.target.value)}
                              placeholder={language === 'ar' ? 'مثال: أضف ضوءاً ذهبياً، غيّر الخلفية...' : 'e.g., Add golden light, change background...'}
                              className="w-full bg-transparent rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none"
                              style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)'}}
                            />
                          </div>
                          {/* Scene-specific reference upload — overrides brandAnchor for this scene only */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                              {language === 'ar' ? 'مرجع مشهد مخصص (يستبدل الهوية العامة لهذا المشهد فقط)' : 'Scene-specific reference (overrides brand anchor for this scene only)'}
                            </label>
                            <div className="flex items-center gap-3">
                              {castingRegenSceneAnchor ? (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{border:'1px solid rgba(226,199,168,0.5)'}}>
                                  <img src={castingRegenSceneAnchor} alt="scene ref" className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => setCastingRegenSceneAnchor(null)}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white text-[9px] flex items-center justify-center hover:bg-red-500/80 transition-colors"
                                  >✕</button>
                                </div>
                              ) : (
                                <label className="w-14 h-14 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 transition-all hover:opacity-80"
                                  style={{background:'rgba(255,255,255,0.04)',border:'2px dashed rgba(226,199,168,0.25)'}}>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file || !user) return;
                                      setIsUploadingRegenAnchor(true);
                                      try {
                                        const ext = file.name.split('.').pop() || 'jpg';
                                        const path = `${user.id}/cinema-refs/regen-${Date.now()}.${ext}`;
                                        await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                                        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                                        if (urlData?.publicUrl) setCastingRegenSceneAnchor(urlData.publicUrl);
                                      } catch { toast.error(language === 'ar' ? 'فشل رفع الصورة' : 'Upload failed'); }
                                      finally { setIsUploadingRegenAnchor(false); }
                                    }}
                                  />
                                  {isUploadingRegenAnchor ? <Loader2 className="h-4 w-4 animate-spin text-white/30" /> : <span className="text-xl leading-none text-white/25">+</span>}
                                </label>
                              )}
                              <p className="text-[9px] text-white/35 leading-relaxed">
                                {castingRegenSceneAnchor
                                  ? (language === 'ar' ? 'هذه الصورة ستُستخدم كمرجع حصري لهذا المشهد فقط (قوة ٧٠٪)' : 'This image overrides the brand anchor for this scene at 70% strength')
                                  : (language === 'ar' ? 'اتركها فارغة لاستخدام أساس النمط العام' : 'Leave empty to use the global Style & Brand Foundation')}
                              </p>
                            </div>
                          </div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div
                              onClick={() => setCastingRegenUseMaster(prev => !prev)}
                              className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                              style={{background: castingRegenUseMaster ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : 'rgba(255,255,255,0.12)'}}>
                              <div className="absolute top-0.5 rounded-full w-4 h-4 bg-white transition-all"
                                style={{left: castingRegenUseMaster ? '18px' : '2px'}} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white/80">
                                {language === 'ar' ? 'الحفاظ على النمط الرئيسي' : 'Maintain Master Style'}
                              </p>
                              <p className="text-[10px] text-white/40">
                                {language === 'ar' ? 'يستخدم مرساة العلامة كمرجع أساسي' : 'Uses brand anchor as primary style reference'}
                              </p>
                            </div>
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => { setCastingRegenModal(null); setCastingRegenNote(''); setCastingRegenSceneAnchor(null); }}
                              className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all active:scale-95"
                              style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)'}}>
                              {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                              onClick={() => handleCastingRegenScene(castingRegenModal.sceneIdx, castingRegenNote, castingRegenUseMaster, castingRegenSceneAnchor)}
                              disabled={isRegenningScene}
                              className="flex-1 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                              style={{background:'linear-gradient(135deg,#E2C7A8,#C5A47E)',color:'#0c0f14'}}>
                              {isRegenningScene ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /><span>{language === 'ar' ? 'جاري التوليد...' : 'Generating...'}</span></>
                              ) : (
                                <><RefreshCw className="h-4 w-4" /><span>{language === 'ar' ? 'إعادة توليد المشهد' : 'Regenerate Scene'}</span></>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sticky footer — APPROVE & FILM */}
                    <div className="cinema-sticky-footer px-4 py-3 flex gap-3">
                      <button
                        onClick={handleCinemaReset}
                        className="h-12 px-4 rounded-xl text-sm font-semibold text-white/60 flex-shrink-0 transition-all active:scale-[0.97]"
                        style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}
                      >
                        {language === 'ar' ? 'من البداية' : 'Reset'}
                      </button>
                      <button
                        onClick={handleFilm}
                        disabled={isFilming || isCasting || castingProgress.slice(0, cinemaSceneCount).some(p => p === 'loading') || sceneImages.slice(0, cinemaSceneCount).some(img => img === null) || sceneImageOptions.slice(0, cinemaSceneCount).some(o => o !== null && o.length >= 2)}
                        className="flex-1 h-12 text-sm font-bold rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-40"
                        style={{background:'linear-gradient(135deg,#E2C7A8 0%,#C5A47E 100%)',color:'#0c0f14',boxShadow:'0 6px 24px rgba(226,199,168,0.35)'}}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Film className="h-4 w-4" />
                          <span>{language === 'ar' ? 'موافقة وابدأ التصوير' : 'APPROVE & FILM'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {cinemaStep === 'filming' && (
                  <div className="flex flex-col gap-5 pb-4">
                    {/* Header */}
                    {(() => {
                      const errorIdxs = animProgress.slice(0, cinemaSceneCount).map((p, i) => p === 'error' ? i : -1).filter(i => i !== -1);
                      const hasError = errorIdxs.length > 0;
                      return (
                        <div className="text-center space-y-1">
                          {hasError ? (
                            <>
                              <h3 className="text-base font-bold" style={{color:'#f87171'}}>
                                {language === 'ar'
                                  ? `⚠️ فشل تحريك المشهد ${errorIdxs.map(i => i + 1).join(', ')}. اضغط لإعادة المحاولة.`
                                  : `⚠️ Animation error in Chapter ${errorIdxs.map(i => i + 1).join(', ')}. Tap to retry.`}
                              </h3>
                              <p className="text-xs text-white/40">{language === 'ar' ? `${cinemaSceneCount} مشاهد • ١٠ ثوانٍ كل مشهد` : `${cinemaSceneCount} chapters • 10s each`}</p>
                            </>
                          ) : (
                            <>
                              <h3 className="text-lg font-bold text-white">{language === 'ar' ? 'الإنتاج جارٍ...' : 'Production in Progress'}</h3>
                              <p className="text-xs text-white/50">{language === 'ar' ? `${cinemaSceneCount} مشاهد • ١٠ ثوانٍ كل مشهد` : `${cinemaSceneCount} chapters • 10s each`}</p>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Production progress bar */}
                    {(() => {
                      const score = animProgress.slice(0, cinemaSceneCount).reduce((acc, p) => acc + (p === 'done' ? 1 : p === 'rendering' ? 0.4 : p === 'queued' ? 0.05 : 0), 0);
                      const pct = Math.min(100, Math.round((score / cinemaSceneCount) * 100));
                      return (
                        <div className="space-y-2 px-1">
                          <div className="flex justify-between text-xs text-white/60">
                            <span>{language === 'ar' ? 'تقدم الإنتاج' : 'Production progress'}</span>
                            <span className="text-[#E2C7A8] font-bold">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.06)'}}>
                            <div
                              className="h-full rounded-full cinema-progress-bar transition-all duration-700"
                              style={{width:`${pct}%`, background:'linear-gradient(90deg,#E2C7A8,#C5A47E,hsl(210,100%,65%))'}}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* N scene clip status grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({length: cinemaSceneCount}, (_, i) => i).map((idx) => {
                        const prog = animProgress[idx];
                        const clip = videoClips[idx];
                        return (
                          <div key={idx}
                            className={`relative rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1.5 ${prog === 'rendering' || prog === 'queued' ? 'cinema-gold-pulse' : ''}`}
                            style={{aspectRatio:'9/16', minHeight:'120px', background:'rgba(12,15,20,0.8)', border: prog === 'error' ? '1px solid rgba(248,113,113,0.5)' : clip ? '1px solid rgba(226,199,168,0.6)' : '1px solid rgba(255,255,255,0.06)'}}>
                            {clip ? (
                              <video src={clip} muted playsInline loop autoPlay className="w-full h-full object-cover" />
                            ) : (
                              <>
                                {prog === 'queued' && <div className="w-3 h-3 rounded-full bg-[#E2C7A8]/30 animate-pulse" />}
                                {prog === 'rendering' && <Loader2 className="h-5 w-5 animate-spin text-[#E2C7A8]" />}
                                {prog === 'error' && (
                                  <button
                                    onClick={() => handleRetryFilm(idx)}
                                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all active:scale-95"
                                    style={{background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.4)'}}
                                  >
                                    <RefreshCw className="h-5 w-5" style={{color:'#f87171'}} />
                                    <span className="text-[8px] font-bold" style={{color:'#f87171'}}>
                                      {language === 'ar' ? 'إعادة محاولة' : 'Retry'}
                                    </span>
                                  </button>
                                )}
                                {prog === 'done' && <span className="text-green-400 text-xs">✓</span>}
                              </>
                            )}
                            <span className="absolute top-1.5 left-2 text-[9px] font-bold"
                              style={{color: prog === 'done' ? '#E2C7A8' : prog === 'error' ? '#f87171' : 'rgba(255,255,255,0.3)'}}>
                              {language === 'ar' ? `م${idx+1}` : `Ch.${idx+1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Sticky footer — PREMIERE */}
                    {(() => {
                      const doneCount = animProgress.slice(0, cinemaSceneCount).filter(p => p === 'done').length;
                      const allDone = doneCount === cinemaSceneCount;
                      const premiereDisabled = isStitching || !allDone;
                      return (
                        <div className="cinema-sticky-footer px-4 py-3 flex gap-3">
                          <button
                            onClick={handleCinemaReset}
                            className="h-12 px-4 rounded-xl text-sm font-semibold text-white/60 flex-shrink-0 transition-all active:scale-[0.97]"
                            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}
                          >
                            {language === 'ar' ? 'إعادة' : 'Reset'}
                          </button>
                          <button
                            onClick={handleStitch}
                            disabled={premiereDisabled}
                            className="flex-1 h-12 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 cinema-glow-pulse"
                            style={{background:'linear-gradient(135deg,hsl(210,100%,60%),hsl(280,70%,65%))',color:'#fff',boxShadow:'0 6px 28px hsla(210,100%,65%,0.4)'}}
                          >
                            {isStitching ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{stitchStatus || (language === 'ar' ? 'جاري التجميع...' : 'Stitching...')}</span>
                              </div>
                            ) : !allDone ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin opacity-60" />
                                <span>{language === 'ar' ? `جاري المعالجة... (${doneCount}/${cinemaSceneCount})` : `Processing... (${doneCount}/${cinemaSceneCount})`}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                <span>{language === 'ar' ? `العرض الأول (${doneCount}/${cinemaSceneCount})` : `PREMIERE (${doneCount}/${cinemaSceneCount} ready)`}</span>
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {cinemaStep === 'premiere' && premiereVideoUrl && (
                  <div className="cinema-player-overlay">
                    {/* Gold frame video player */}
                    <div className="relative w-full max-w-2xl mx-auto px-4 flex flex-col gap-4">
                      <div className="text-center space-y-1">
                        <p className="text-[#E2C7A8] text-xs font-semibold uppercase tracking-widest opacity-80">
                          {language === 'ar' ? 'وكتي سينما' : 'Wakti Cinema'}
                        </p>
                        <h2 className="text-2xl font-bold text-white">{language === 'ar' ? '🎬 العرض الأول' : '🎬 The Premiere'}</h2>
                      </div>
                      <div className="cinema-diamond-border rounded-2xl overflow-hidden w-full"
                        style={{aspectRatio: cinemaFormat === '16:9' ? '16/9' : '9/16', maxHeight:'70vh'}}>
                        <video
                          src={premiereVideoUrl}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2">
                        {/* Save to My Videos */}
                        <button
                          onClick={handleCinemaSave}
                          disabled={isCinemaSaving || isCinemaSaved}
                          className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                          style={{
                            background: isCinemaSaved
                              ? 'rgba(34,197,94,0.15)'
                              : 'linear-gradient(135deg,#E2C7A8 0%,#C5A47E 100%)',
                            border: isCinemaSaved ? '1px solid rgba(34,197,94,0.4)' : 'none',
                            color: isCinemaSaved ? '#4ade80' : '#0c0f14',
                          }}
                        >
                          {isCinemaSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span></>
                          ) : isCinemaSaved ? (
                            <><span>✓</span><span className="hidden sm:inline">{language === 'ar' ? 'تم الحفظ' : 'Saved!'}</span></>
                          ) : (
                            <><Download className="h-4 w-4" /><span className="sm:hidden">{language === 'ar' ? 'حفظ' : 'Save'}</span><span className="hidden sm:inline">{language === 'ar' ? 'حفظ في فيديوهاتي' : 'Save to My Videos'}</span></>
                          )}
                        </button>

                        {/* Download */}
                        <a
                          href={premiereVideoUrl}
                          download="Wakti-Cinema.mp4"
                          className="h-12 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 flex-shrink-0 transition-all active:scale-95"
                          style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.85)'}}
                        >
                          <Download className="h-4 w-4" />
                          <span className="sm:hidden">{language === 'ar' ? 'تنزيل' : 'DL'}</span>
                          <span className="hidden sm:inline">{language === 'ar' ? 'تنزيل' : 'Download'}</span>
                        </a>

                        {/* New film */}
                        <button
                          onClick={handleCinemaReset}
                          className="h-12 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 flex-shrink-0"
                          style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)'}}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="hidden sm:inline">{language === 'ar' ? 'جديد' : 'New'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prompt & Generate - Hidden in Cinema mode */}
            {generationMode !== 'cinema' && (
            <div className="flex flex-col gap-3 pt-2 border-t border-border/30">
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

              {/* Amp row */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {needsArabicTranslation && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#060541]">
                      <span>{language === 'ar' ? 'اضغط لترجمة العربية' : 'Click to translate Arabic'}</span>
                      {language === 'ar' ? (
                        <ArrowLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleAmp}
                    disabled={isAmping || isGenerating || !(
                      generationMode === 'image_to_video' ? imagePreview :
                      generationMode === '2images_to_video' ? imagePreview :
                      prompt.trim()
                    )}
                    style={(!isAmping && !isGenerating && (
                      generationMode === 'image_to_video' ? !!imagePreview :
                      generationMode === '2images_to_video' ? !!imagePreview :
                      !!prompt.trim()
                    )) ? {
                      animation: 'amp-alive 1.4s ease-in-out infinite',
                    } : undefined}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-full transition-colors duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border ${
                      isAmping
                        ? 'bg-gradient-to-r from-violet-500/50 to-fuchsia-500/50 text-white dark:text-white border-violet-400/60'
                        : needsArabicTranslation
                          ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-900 dark:text-amber-200 border-amber-400/50'
                          : 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 text-violet-900 dark:text-violet-200 border-violet-500/40'
                    }`}
                    title={
                      needsArabicTranslation
                        ? (language === 'ar' ? 'اضغط لترجمة العربية' : 'Click to translate Arabic')
                        : (language === 'ar' ? 'تعزيز الوصف بالذكاء الاصطناعي' : 'Amp: enhance prompt with AI')
                    }
                  >
                    <Wand2 className={`h-3.5 w-3.5 ${isAmping ? 'animate-spin' : ''}`} />
                    <span>{isAmping ? (language === 'ar' ? 'جاري التعزيز...' : 'Amping...') : (language === 'ar' ? '✦ تعزيز' : '✦ Amp')}</span>
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground/50">{prompt.length}/2500</span>
              </div>

              {/* Prompt textarea */}
              <div className="relative flex-1">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    generationMode === 'text_to_video'
                      ? (language === 'ar'
                          ? 'صف المشهد والحركة بالتفصيل...\n\nمثال: أبواب تفتح واحدًا تلو الآخر لتكشف غرفًا مختلفة بداخلها أشخاص صغار يعيشون حياتهم...'
                          : 'Describe the full scene and motion in detail...\n\ne.g., Doors open one by one to reveal different rooms with tiny people living inside...')
                      : (language === 'ar'
                          ? 'صف الحركة المطلوبة...\n\nمثال: شخص يبتسم ويلوح بيده، قطة تحرك رأسها ببطء، سيارة تتحرك للأمام...'
                          : 'Describe the motion you want...\n\ne.g., A person smiling and waving, a cat slowly moving its head, a car driving forward...')
                  }
                  className="min-h-[140px] h-full text-sm resize-none rounded-xl border-2 border-primary/20 focus:border-primary bg-background/50 backdrop-blur-sm transition-all placeholder:text-muted-foreground/60"
                  maxLength={2500}
                  disabled={isGenerating || limitReached}
                />
              </div>

              {/* Aspect ratio + Resolution pickers */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                    <button
                      onClick={() => !isGenerating && setAspectRatio('9:16')}
                      disabled={isGenerating}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        aspectRatio === '9:16'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <span className="text-[11px] opacity-80">▮</span>
                      {language === 'ar' ? 'عمودي' : 'Portrait'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setAspectRatio('16:9')}
                      disabled={isGenerating}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        aspectRatio === '16:9'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <span className="text-[11px] opacity-80">▬</span>
                      {language === 'ar' ? 'أفقي' : 'Landscape'}
                    </button>
                  </div>

                {/* Resolution picker - all modes */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                  <button
                    onClick={() => {
                      if (!isGenerating) setResolution('480p');
                    }}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      resolution === '480p'
                        ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    }`}
                  >
                    480p
                  </button>
                  <button
                    onClick={() => {
                      if (!isGenerating) {
                        setResolution('720p');
                        if (duration === '12') setDuration('8');
                      }
                    }}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      resolution === '720p'
                        ? 'bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(45,100%,60%)] text-white shadow-md shadow-orange-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    }`}
                  >
                    720p
                  </button>
                </div>
                {(generationMode === 'image_to_video' || generationMode === 'text_to_video') && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                    <button
                      onClick={() => !isGenerating && setVideoStyleMode('normal')}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        videoStyleMode === 'normal'
                          ? 'bg-gradient-to-r from-[#060541] to-[hsl(210,100%,45%)] text-white shadow-md shadow-blue-500/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      {language === 'ar' ? 'عادي' : 'Normal'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setVideoStyleMode('fun')}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        videoStyleMode === 'fun'
                          ? 'bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(320,75%,70%)] text-white shadow-md shadow-orange-500/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      {language === 'ar' ? 'مرح' : 'Fun'}
                    </button>
                  </div>
                )}
              </div>


              {/* Generate button */}
              <Button
                className="w-full h-12 text-base font-bold rounded-xl bg-[#060541] text-white border border-white/10 shadow-[0_10px_28px_rgba(6,5,65,0.35)] hover:bg-[hsl(243,84%,18%)] hover:shadow-[0_14px_34px_hsla(210,100%,65%,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
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
                      className="h-full bg-gradient-to-r from-[hsl(210,100%,65%)] via-[hsl(180,85%,60%)] to-[hsl(160,80%,55%)] transition-all duration-500 ease-out"
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
              {!isGenerating && !limitReached && (
                generationMode === 'image_to_video' ? (
                  !imagePreview && (
                    <p className="text-center text-xs text-muted-foreground">
                      {language === 'ar' ? '← اختر صورة للبدء' : '← Select an image to start'}
                    </p>
                  )
                ) : (
                  !prompt.trim() && (
                    <p className="text-center text-xs text-muted-foreground">
                      {language === 'ar' ? '← اكتب وصفاً للبدء' : '← Write a prompt to start'}
                    </p>
                  )
                )
              )}
            </div>
            )}
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
                    className="h-12 flex-col gap-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-300"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'مشاركة' : 'Share'}</span>
                  </Button>
                </div>
                
                {/* Instagram */}
                <InstagramPublishButton
                  mediaUrl={generatedVideoUrl}
                  mediaType="reel"
                  publishTarget="reel"
                  defaultCaption={prompt || ''}
                  language={language as 'en' | 'ar'}
                />

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

          {/* Latest Video - Hidden in Cinema mode */}
          {showLatestVideo && generationMode !== 'cinema' && (
            <div className="rounded-2xl overflow-hidden" style={{background: 'linear-gradient(135deg, hsl(235,25%,8%) 0%, hsl(250,20%,10%) 100%)', border: '1px solid hsla(210,100%,65%,0.2)', boxShadow: '0 4px 32px hsla(0,0%,0%,0.4), 0 0 0 1px hsla(210,100%,65%,0.08)'}}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] shadow-[0_0_6px_hsla(210,100%,65%,0.8)]" />
                  <span className="text-xs font-bold text-white/80 tracking-wide uppercase">
                    {language === 'ar' ? 'آخر فيديو' : 'Latest Video'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'محفوظ' : 'Saved'}
                </span>
              </div>
              <div className="relative bg-black">
                <video
                  src={latestVideo?.signedUrl || latestVideo?.video_url || undefined}
                  controls
                  playsInline
                  className="w-full aspect-[9/16] max-h-[60vh] object-contain"
                />
              </div>
              <div className="p-3 flex items-center gap-2">
                  <Button
                    className="flex-1 h-10 gap-2 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-300 border border-blue-500/20 text-xs font-semibold"
                    onClick={handleDownloadLatest}
                  >
                    <Download className="h-4 w-4" />
                    {language === 'ar' ? 'تحميل' : 'Download'}
                  </Button>
                  <Button
                    className="flex-1 h-10 gap-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-300 border border-violet-500/20 text-xs font-semibold"
                    onClick={() => onSaveSuccess?.()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {language === 'ar' ? 'المحفوظات' : 'My Videos'}
                  </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Images Picker Modal */}
      {showSavedPicker && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSavedPicker(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[80vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GalleryHorizontalEnd className="h-5 w-5 text-orange-500" />
                <h3 className="font-bold text-sm">
                  {language === 'ar' ? 'اختر من صورك المحفوظة' : 'Pick from Saved Images'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedPicker(false)}
                title={language === 'ar' ? 'إغلاق' : 'Close'}
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loadingSaved ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
              ) : savedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">
                    {language === 'ar' ? 'لا توجد صور محفوظة بعد' : 'No saved images yet'}
                  </p>
                  <p className="text-xs">
                    {language === 'ar' ? 'أنشئ صوراً في تبويب الصور أولاً' : 'Generate images in the Image tab first'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {savedImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handlePickSaved(img.image_url)}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-500 focus:border-orange-500 transition-all active:scale-95 group"
                    >
                      <img
                        src={img.image_url}
                        alt="Saved"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                      <span className="absolute bottom-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/50 text-white/80">
                        {img.submode === 'text2image' ? 'T2I' : img.submode === 'image2image' ? 'I2I' : img.submode === 'background-removal' ? 'BG' : img.submode === 'draw' ? 'Draw' : img.submode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
