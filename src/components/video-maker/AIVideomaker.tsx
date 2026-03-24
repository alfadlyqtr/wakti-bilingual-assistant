import React, { useState, useRef, useCallback, useEffect } from 'react';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
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
  const { language } = useTheme();
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
  const [cinemaScenes, setCinemaScenes] = useState<{scene: number; text: string}[]>([]);
  const [isDirecting, setIsDirecting] = useState(false);
  const [cinemaStep, setCinemaStep] = useState<'desk' | 'storyboard' | 'casting' | 'filming' | 'premiere'>('desk');
  const [visualDNA, setVisualDNA] = useState('');
  const [cinemaFormat, setCinemaFormat] = useState<'16:9' | '9:16'>('16:9');

  // Role 2 & 3 — Artist & Cloner
  const [sceneImages, setSceneImages] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [anchorImageUrl, setAnchorImageUrl] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [castingProgress, setCastingProgress] = useState<('idle' | 'loading' | 'done' | 'error')[]>(
    ['idle', 'idle', 'idle', 'idle', 'idle', 'idle']
  );

  // Role 4 — Animator
  const [videoClips, setVideoClips] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [animTaskIds, setAnimTaskIds] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [animProgress, setAnimProgress] = useState<('idle' | 'queued' | 'rendering' | 'done' | 'error')[]>(
    ['idle', 'idle', 'idle', 'idle', 'idle', 'idle']
  );
  const [isFilming, setIsFilming] = useState(false);
  const animPollRef = useRef<NodeJS.Timeout | null>(null);

  // Role 5 — Premiere
  const [isStitching, setIsStitching] = useState(false);
  const [stitchStatus, setStitchStatus] = useState(''); // e.g. "Waking up server..."
  const [premiereVideoUrl, setPremiereVideoUrl] = useState<string | null>(null);
  const [isCinemaSaving, setIsCinemaSaving] = useState(false);
  const [isCinemaSaved, setIsCinemaSaved] = useState(false);

  // Reference images — user-uploaded assets for Cinema
  // Index 0-5 = scene slots, index 6 = brand logo/reference anchor
  const [cinemaReferenceImages, setCinemaReferenceImages] = useState<(string | null)[]>([]);
  const [cinemaRefTags, setCinemaRefTags] = useState<string[]>([]); // 'scene1'..'scene6', 'logo', 'ref'
  const [isUploadingRef, setIsUploadingRef] = useState(false);

  // Storyboard scene editing state
  const [editingSceneNum, setEditingSceneNum] = useState<number | null>(null); // which scene is being edited
  const [editingSceneText, setEditingSceneText] = useState('');
  const [regenSceneNum, setRegenSceneNum] = useState<number | null>(null); // which scene is regenerating

  // Cinema Visionnaire form state
  const [cinemaOpenSection, setCinemaOpenSection] = useState(0); // accordion open section index
  const [cinemaSubject, setCinemaSubject] = useState('');
  const [cinemaSetting, setCinemaSetting] = useState('');
  const [cinemaSettingCustom, setCinemaSettingCustom] = useState('');
  const [cinemaAction, setCinemaAction] = useState('');
  const [cinemaActionCustom, setCinemaActionCustom] = useState('');
  const [cinemaVibe, setCinemaVibe] = useState('');
  const [cinemaVibeCustom, setCinemaVibeCustom] = useState('');
  const [cinemaCharacters, setCinemaCharacters] = useState('');
  const [cinemaRelationship, setCinemaRelationship] = useState('');
  const [cinemaCTA, setCinemaCTA] = useState('');
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
        limit: q?.videos_limit || 60,
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
    const effectiveSetting = cinemaSetting === 'Custom' ? cinemaSettingCustom : cinemaSetting;
    const effectiveAction = cinemaAction === 'Custom' ? cinemaActionCustom : cinemaAction;
    const effectiveVibe = cinemaVibe === 'Custom' ? cinemaVibeCustom : cinemaVibe;
    const effectiveCTA = cinemaCTA === 'Custom' ? cinemaCTACustom : cinemaCTA;
    const builtVision = [
      cinemaSubject && `Subject: ${cinemaSubject}`,
      effectiveSetting && `Setting: ${effectiveSetting}`,
      effectiveAction && `Action: ${effectiveAction}`,
      effectiveVibe && `Vibe: ${effectiveVibe}`,
      cinemaCharacters && `Characters: ${cinemaCharacters === 'Custom' ? (cinemaRelationship || 'custom characters') : cinemaCharacters}${cinemaCharacters !== 'Custom' && cinemaCharacters !== 'no people — product, object, or creature only' && cinemaCharacters !== 'one solo person — the hero, the protagonist' && cinemaRelationship ? ` (${cinemaRelationship})` : ''}`,
      effectiveCTA && `Purpose: ${effectiveCTA}`,
    ].filter(Boolean).join('. ');

    const visionToSend = builtVision || cinemaVision.trim();
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
  }, [cinemaVision, cinemaSubject, cinemaSetting, cinemaSettingCustom, cinemaAction, cinemaActionCustom, cinemaVibe, cinemaVibeCustom, cinemaCharacters, cinemaRelationship, cinemaCTA, cinemaCTACustom, isDirecting, language, user]);

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
    const pollTask = async (task_id: string, scene_index: number): Promise<string> => {
      for (let i = 0; i < 36; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await artistCall({ mode: 'status', task_id, scene_index });
        if (res.status === 'COMPLETED' && res.image_url) return res.image_url as string;
        if (res.status === 'FAILED') throw new Error(res.error || 'Image generation failed');
      }
      throw new Error('Image generation timed out');
    };

    try {
      const scene1 = cinemaScenes.find(s => s.scene === 1);
      if (!scene1) throw new Error('Scene 1 not found');

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

      // ── Scene 1: use tagged scene image OR T2I (with logo as anchor if available) ──
      let anchor: string;
      if (sceneSlotMap[0]) {
        anchor = sceneSlotMap[0];
      } else if (logoAnchor) {
        // I2I from logo anchor to get scene 1 in brand style
        const t2iCreate = await artistCall({ mode: 'i2i_create', prompt: scene1.text, anchor_url: logoAnchor, scene_index: 0, visual_dna: scene1.text });
        anchor = await pollTask(t2iCreate.task_id, 0);
      } else {
        const t2iCreate = await artistCall({ mode: 't2i_create', prompt: scene1.text, aspect_ratio: cinemaFormat });
        anchor = await pollTask(t2iCreate.task_id, 0);
      }
      setAnchorImageUrl(anchor);
      setSceneImages(prev => { const n = [...prev]; n[0] = anchor; return n; });
      setCastingProgress(prev => { const n = [...prev]; n[0] = 'done'; for (let i = 1; i < cinemaSceneCount; i++) n[i] = 'loading'; return n; });

      // ── Scenes 2-N: sequential chain — each scene uses previous result as anchor ──
      let prevAnchor = anchor;

      for (const scene of cinemaScenes.filter(s => s.scene >= 2 && s.scene <= cinemaSceneCount).sort((a, b) => a.scene - b.scene)) {
        const idx = scene.scene - 1;
        if (sceneSlotMap[idx]) {
          // User tagged this exact scene — use directly
          setSceneImages(prev => { const n = [...prev]; n[idx] = sceneSlotMap[idx]; return n; });
          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
          prevAnchor = sceneSlotMap[idx];
          continue;
        }
        // I2I from previous scene result — ensures visual chain continuity
        try {
          const created = await artistCall({ mode: 'i2i_create', prompt: scene.text, anchor_url: prevAnchor, scene_index: idx, visual_dna: scene1!.text });
          const imgUrl = await pollTask(created.task_id, idx);
          setSceneImages(prev => { const n = [...prev]; n[idx] = imgUrl; return n; });
          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'done'; return n; });
          prevAnchor = imgUrl;
        } catch (err: any) {
          console.error(`[cinema] I2I scene ${idx + 1} failed:`, err);
          setCastingProgress(prev => { const n = [...prev]; n[idx] = 'error'; return n; });
        }
      }

      toast.success(language === 'ar' ? 'تم إنشاء الصور!' : 'Scenes cast!');
    } catch (err: any) {
      console.error('[cinema] Cast error:', err);
      toast.error(language === 'ar' ? 'فشل إنشاء الصور: ' + err.message : 'Casting failed: ' + err.message);
      setCinemaStep('storyboard');
    } finally {
      setIsCasting(false);
    }
  }, [user, isCasting, cinemaScenes, cinemaFormat, language, cinemaReferenceImages]);

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
          const result = await callAnimator({
            mode: 'create',
            image_url: imgUrl,
            prompt: scene?.text || '',
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
  }, [user, isFilming, sceneImages, cinemaScenes, language, loadQuota]);

  // ── Role 5: Premiere — browser-side stitch via canvas + MediaRecorder ──
  // No external server needed. Each clip is fetched as a blob, played into a hidden
  // <video> element, drawn frame-by-frame onto a <canvas>, and recorded by MediaRecorder.
  const handleStitch = useCallback(async () => {
    const readyClips = videoClips.filter(Boolean) as string[];
    if (readyClips.length < 2 || isStitching) return;
    setIsStitching(true);
    setStitchStatus(language === 'ar' ? 'جاري تحميل المقاطع...' : 'Loading clips...');

    try {
      // Step 1: Fetch all clips as object URLs (bypass CORS by going through blob)
      const blobUrls: string[] = [];
      for (let i = 0; i < readyClips.length; i++) {
        setStitchStatus(language === 'ar' ? `جاري التحميل ${i + 1}/${readyClips.length}...` : `Downloading ${i + 1}/${readyClips.length}...`);
        const resp = await fetch(readyClips[i]);
        if (!resp.ok) throw new Error(`Clip ${i + 1} download failed: ${resp.status}`);
        const blob = await resp.blob();
        blobUrls.push(URL.createObjectURL(blob));
      }

      setStitchStatus(language === 'ar' ? 'جاري تجميع الفيديو...' : 'Stitching video...');

      // Step 2: Set up canvas + hidden video element
      const canvas = document.createElement('canvas');
      canvas.width = cinemaFormat === '16:9' ? 1280 : 720;
      canvas.height = cinemaFormat === '16:9' ? 720 : 1280;
      const ctx = canvas.getContext('2d')!;

      const videoEl = document.createElement('video');
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.style.display = 'none';
      document.body.appendChild(videoEl);

      // Step 3: Set up MediaRecorder on canvas stream
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start(100); // collect in 100ms chunks

      // Step 4: Play each clip sequentially, drawing each frame to canvas
      for (let i = 0; i < blobUrls.length; i++) {
        setStitchStatus(language === 'ar' ? `جاري الدمج ${i + 1}/${blobUrls.length}...` : `Merging ${i + 1}/${blobUrls.length}...`);
        await new Promise<void>((resolve, reject) => {
          videoEl.src = blobUrls[i];
          videoEl.onloadeddata = () => {
            videoEl.play().catch(reject);
          };
          videoEl.onerror = () => reject(new Error(`Video ${i + 1} failed to load`));

          let rafId: number;
          const drawFrame = () => {
            if (videoEl.ended || videoEl.paused) {
              cancelAnimationFrame(rafId);
              resolve();
              return;
            }
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            rafId = requestAnimationFrame(drawFrame);
          };
          videoEl.onplaying = () => { rafId = requestAnimationFrame(drawFrame); };
          videoEl.onended = () => { cancelAnimationFrame(rafId); resolve(); };
        });
        // Small pause between clips
        await new Promise(r => setTimeout(r, 100));
      }

      recorder.stop();
      document.body.removeChild(videoEl);

      // Revoke blob URLs
      blobUrls.forEach(u => URL.revokeObjectURL(u));

      setStitchStatus(language === 'ar' ? 'جاري المعالجة النهائية...' : 'Finalizing...');
      const finalBlob = await recordingDone;
      const url = URL.createObjectURL(finalBlob);
      setPremiereVideoUrl(url);
      setCinemaStep('premiere');
      toast.success(language === 'ar' ? 'العرض الأول جاهز! 🎬' : 'Premiere ready! 🎬');
    } catch (err: any) {
      console.error('[cinema] Stitch error:', err);
      toast.error(language === 'ar' ? 'فشل تجميع الفيديو: ' + err.message : 'Stitch failed: ' + err.message);
    } finally {
      setIsStitching(false);
      setStitchStatus('');
    }
  }, [videoClips, isStitching, language, cinemaFormat]);

  // ── Cinema full reset ──
  const handleCinemaReset = useCallback(() => {
    setCinemaStep('desk');
    setCinemaVision('');
    setCinemaScenes([]);
    setCinemaSubject('');
    setCinemaSetting('');
    setCinemaSettingCustom('');
    setCinemaAction('');
    setCinemaActionCustom('');
    setCinemaVibe('');
    setCinemaVibeCustom('');
    setCinemaCharacters('');
    setCinemaRelationship('');
    setCinemaCTA('');
    setCinemaCTACustom('');
    setAnchorImageUrl(null);
    setSceneImages([null, null, null, null, null, null]);
    setCastingProgress(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
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
      const effectiveSetting = cinemaSetting === 'Custom' ? cinemaSettingCustom : cinemaSetting;
      const effectiveAction = cinemaAction === 'Custom' ? cinemaActionCustom : cinemaAction;
      const effectiveVibe = cinemaVibe === 'Custom' ? cinemaVibeCustom : cinemaVibe;
      const effectiveCTA = cinemaCTA === 'Custom' ? cinemaCTACustom : cinemaCTA;
      const builtVision = [
        cinemaSubject && `Subject: ${cinemaSubject}`,
        effectiveSetting && `Setting: ${effectiveSetting}`,
        effectiveAction && `Action: ${effectiveAction}`,
        effectiveVibe && `Vibe: ${effectiveVibe}`,
        effectiveCTA && `Purpose: ${effectiveCTA}`,
      ].filter(Boolean).join('. ');
      const visionToSend = builtVision || cinemaVision.trim();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ vision: visionToSend, language, scene_count: cinemaSceneCount }),
      });
      const result = await resp.json().catch(() => ({}));
      if (result?.success && Array.isArray(result.scenes)) {
        const newScene = result.scenes.find((s: { scene: number; text: string }) => s.scene === sceneNum);
        if (newScene) {
          setCinemaScenes(prev => prev.map(s => s.scene === sceneNum ? { ...s, text: newScene.text } : s));
          toast.success(language === 'ar' ? `تم إعادة كتابة المشهد ${sceneNum}` : `Scene ${sceneNum} rewritten!`);
        }
      } else throw new Error(result?.error || 'No scene returned');
    } catch (err: any) {
      toast.error(language === 'ar' ? 'فشل إعادة الكتابة' : 'Regen failed: ' + err.message);
    } finally {
      setRegenSceneNum(null);
    }
  }, [user, regenSceneNum, cinemaSubject, cinemaSetting, cinemaSettingCustom, cinemaAction, cinemaActionCustom, cinemaVibe, cinemaVibeCustom, cinemaCTA, cinemaCTACustom, cinemaVision, language, cinemaSceneCount]);

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
      const { data: importData, error: importError } = await supabase.functions.invoke('import-external-video', {
        body: {
          sourceUrl: premiereVideoUrl,
          filenameHint: cinemaVision.trim().slice(0, 40) || 'cinema-premiere',
        },
      });
      if (importError) throw importError;
      const storagePath = importData?.storagePath as string | undefined;
      if (!storagePath) throw new Error(importData?.error || 'Failed to save video');

      const { error } = await (supabase as any).from('user_videos').insert({
        user_id: user.id,
        title: cinemaVision.trim().slice(0, 60) || 'Wakti Cinema',
        description: cinemaVision.trim() || null,
        storage_path: storagePath,
        video_url: null,
        thumbnail_url: sceneImages[0] || null,
        duration_seconds: cinemaSceneCount * 10,
        aspect_ratio: cinemaFormat,
        style_template: 'cinema',
        is_public: false,
      });
      if (error) throw error;
      setIsCinemaSaved(true);
      toast.success(language === 'ar' ? 'تم الحفظ في فيديوهاتي!' : 'Saved to My Videos!');
      await loadLatestVideo();
      if (onSaveSuccess) setTimeout(() => onSaveSuccess(), 1000);
    } catch (e: any) {
      console.error('Cinema save failed:', e);
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setIsCinemaSaving(false);
    }
  };

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

  const remaining = quota ? quota.limit - quota.used + quota.extra : 60;
  const used = quota?.used || 0;
  const limit = quota?.limit || 60;
  const limitReached = quota !== null && !quota.canGenerate;

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
              <div className="relative col-span-full min-h-[60vh] flex flex-col justify-center">
                {cinemaStep === 'desk' && (() => {
                  const effectiveSetting = cinemaSetting === 'Custom' ? cinemaSettingCustom : cinemaSetting;
                  const effectiveAction = cinemaAction === 'Custom' ? cinemaActionCustom : cinemaAction;
                  const effectiveVibe = cinemaVibe === 'Custom' ? cinemaVibeCustom : cinemaVibe;
                  const effectiveCTA = cinemaCTA === 'Custom' ? cinemaCTACustom : cinemaCTA;
                  const isSceneCountReady = cinemaSceneCountTouched;
                  const isFormReady = !!(cinemaSubject.trim() && effectiveVibe.trim() && cinemaCharacters.trim() && isSceneCountReady);
                  const filledCount = [cinemaSubject.trim(), effectiveVibe.trim(), cinemaCharacters.trim(), isSceneCountReady ? 'y' : ''].filter(Boolean).length;
                  const progressPct = Math.round((filledCount / 4) * 100);

                  // Chip helper — renders a tappable pill
                  type ChipProps = { label: string; emoji: string; value: string; selected: boolean; onSelect: () => void; disabled?: boolean };
                  const Chip = ({ label, emoji, value: _v, selected, onSelect, disabled }: ChipProps) => (
                    <button
                      type="button"
                      onClick={onSelect}
                      disabled={disabled}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
                      style={{
                        background: selected ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : 'rgba(255,255,255,0.05)',
                        border: selected ? '1px solid rgba(226,199,168,0.9)' : '1px solid rgba(255,255,255,0.1)',
                        color: selected ? '#0c0f14' : 'rgba(255,255,255,0.7)',
                        boxShadow: selected ? '0 2px 12px rgba(226,199,168,0.35)' : 'none',
                      }}
                    >{emoji} {label}</button>
                  );

                  // Collapse state uses cinemaOpenSection: 0=section1, 1=section2, 2=section3
                  const openSection = cinemaOpenSection;
                  const sec1Done = !!cinemaSubject.trim();
                  const sec2Done = !!effectiveVibe.trim();
                  const sec3Done = !!cinemaCharacters.trim() && isSceneCountReady;

                  // Section header helper
                  const SecHeader = ({ idx, label, done, summary }: { idx: number; label: string; done: boolean; summary?: string }) => (
                    <button type="button" onClick={() => setCinemaOpenSection(openSection === idx ? -1 : idx)}
                      className="w-full flex items-center justify-between gap-2 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                          style={{background:done?'linear-gradient(135deg,#E2C7A8,#C5A47E)':'rgba(255,255,255,0.08)',color:done?'#0c0f14':'rgba(255,255,255,0.4)'}}>
                          {done ? '✓' : (idx + 1)}
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wider truncate ${done ? 'text-[#E2C7A8]' : 'text-white/70'}`}>{label}</span>
                        {done && summary && openSection !== idx && (
                          <span className="text-[10px] text-white/35 truncate ml-1 hidden sm:block">— {summary.length > 30 ? summary.slice(0,30)+'…' : summary}</span>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-white/30 text-xs transition-transform duration-200"
                        style={{transform: openSection === idx ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
                    </button>
                  );

                  return (
                  <div className="flex flex-col gap-0 py-2">
                    {/* Sticky gold progress bar */}
                    <div className="sticky top-0 z-20 pt-1 pb-3" style={{background:'linear-gradient(to bottom,rgba(12,15,20,0.98) 70%,transparent)'}}>
                      <div className="text-center mb-2">
                        <h3 className="text-xl font-bold text-white" style={{textShadow:'0 0 20px rgba(226,199,168,0.5)'}}>
                          {language === 'ar' ? 'مكتب الفيزيونير' : 'The Visionnaire'}
                        </h3>
                      </div>
                      <div className="relative h-[3px] rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.07)'}}>
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{width:`${progressPct}%`,background:'linear-gradient(90deg,#C5A47E,#E2C7A8,#fff9ee)',boxShadow:progressPct>0?'0 0 8px rgba(226,199,168,0.8),0 0 16px rgba(226,199,168,0.4)':'none'}} />
                      </div>
                      {progressPct > 0 && (
                        <p className="text-[10px] text-[#E2C7A8]/60 text-right mt-1">
                          {isFormReady ? (language==='ar'?'✨ جاهز للتصوير!':'✨ Ready to direct!') : (language==='ar'?`${progressPct}% مكتمل`:`${progressPct}% complete`)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 max-w-lg mx-auto w-full">

                      {/* ── SECTION 1: What is your movie about? ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background:openSection===0?'rgba(226,199,168,0.06)':'rgba(255,255,255,0.02)',border:openSection===0?'1px solid rgba(226,199,168,0.25)':'1px solid rgba(255,255,255,0.07)'}}>
                        <SecHeader idx={0} label={language==='ar'?'عم يدور فيلمك؟':'What is your movie about?'} done={sec1Done} summary={cinemaSubject} />
                        {openSection === 0 && (
                          <div className="mt-3 flex flex-col gap-2">
                            <div className="rounded-xl overflow-hidden" style={{background:'rgba(12,15,20,0.7)',border:`1px solid ${cinemaSubject.trim()?'rgba(226,199,168,0.5)':'rgba(255,255,255,0.1)'}`}}>
                              <textarea
                                value={cinemaSubject}
                                onChange={(e) => setCinemaSubject(e.target.value.slice(0,300))}
                                onInput={(e) => {
                                  const t = e.currentTarget;
                                  t.style.height='auto';
                                  t.style.height=`${Math.min(t.scrollHeight,140)}px`;
                                  t.style.overflowY=t.scrollHeight>140?'auto':'hidden';
                                }}
                                disabled={isDirecting} autoFocus rows={2} maxLength={300}
                                placeholder={language==='ar'?'مثال: رجل أعمال يطلق منتجه الجديد في مؤتمر كبير...':'e.g., An entrepreneur launching a new product at a major conference...'}
                                className="w-full resize-none bg-transparent px-4 py-3 text-base text-white placeholder:text-white/30 outline-none min-h-[72px] max-h-[140px] leading-7"
                              />
                            </div>
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] text-white/30">{cinemaSubject.length}/300</span>
                              {cinemaSubject.trim() && (
                                <button type="button" onClick={()=>setCinemaOpenSection(1)}
                                  className="text-[11px] font-semibold text-[#E2C7A8] opacity-70 hover:opacity-100 transition-opacity">
                                  {language==='ar'?'التالي ›':'Next ›'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── SECTION 2: Style pickers ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background:openSection===1?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.02)',border:openSection===1?'1px solid rgba(226,199,168,0.2)':'1px solid rgba(255,255,255,0.07)'}}>
                        <SecHeader idx={1} label={language==='ar'?'اختر أسلوب فيلمك':'Choose your style'} done={sec2Done}
                          summary={effectiveVibe ? effectiveVibe.split('—')[0].trim() : undefined} />
                        {openSection === 1 && (
                          <div className="mt-3 flex flex-col gap-4">

                            {/* Vibe & Mood chips */}
                            <div>
                              <p className="text-[10px] text-white/40 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'المزاج والأجواء ✱':'Vibe & Mood ✱'}{effectiveVibe.trim() && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🔥',en:'Epic & Grand',ar:'ملحمي وعظيم',v:'Epic and grand — cinematic score, wide establishing shots, larger than life'},
                                  {e:'✨',en:'Luxurious',ar:'فاخر وراقي',v:'Luxurious and prestigious — slow motion, rich textures, gold tones'},
                                  {e:'⚡',en:'Dramatic',ar:'درامي مكثف',v:'Dramatic and intense — high contrast, deep shadows, powerful tension'},
                                  {e:'💛',en:'Emotional',ar:'عاطفي مؤثر',v:'Emotional and heartfelt — soft light, intimate close-ups, stirring music'},
                                  {e:'🌅',en:'Inspiring',ar:'ملهم',v:'Inspiring and uplifting — bright light, rising motion, hopeful tone'},
                                  {e:'💥',en:'High Energy',ar:'طاقة عالية',v:'Exciting and high energy — fast cuts, dynamic movement, adrenaline'},
                                  {e:'🌿',en:'Peaceful',ar:'هادئ',v:'Peaceful and serene — slow camera, nature, stillness, gentle pace'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaVibe===v}
                                    onSelect={()=>{setCinemaVibe(v);setCinemaVibeCustom('');}} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaVibe==='Custom'} onSelect={()=>setCinemaVibe('Custom')} disabled={isDirecting} />
                              </div>
                              {cinemaVibe==='Custom' && (
                                <input type="text" value={cinemaVibeCustom} onChange={(e)=>setCinemaVibeCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف المزاج...':'Describe the mood...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                                  style={{background:'rgba(12,15,20,0.6)',border:'1px solid rgba(226,199,168,0.4)'}} autoFocus />
                              )}
                            </div>

                            {/* Setting chips */}
                            <div>
                              <p className="text-[10px] text-white/35 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'الموقع (اختياري)':'Setting (optional)'}{effectiveSetting.trim() && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🌆',en:'City Night',ar:'مدينة ليلاً',v:'a futuristic modern city skyline at night, glass towers reflecting light'},
                                  {e:'🏜️',en:'Desert',ar:'صحراء',v:'a vast open desert at golden hour, endless sand dunes, warm haze'},
                                  {e:'🌊',en:'Ocean',ar:'ساحل',v:'an ocean coastline at sunrise, crashing waves, warm mist'},
                                  {e:'🚀',en:'Space',ar:'الفضاء',v:'outer space, earth from orbit, stars and galaxies stretching forever'},
                                  {e:'🏔️',en:'Mountains',ar:'جبال',v:'dramatic mountain peaks above the clouds, epic wide shot'},
                                  {e:'🌲',en:'Forest',ar:'غابة',v:'a lush green forest, rays of light through tall trees'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaSetting===v}
                                    onSelect={()=>{setCinemaSetting(v);setCinemaSettingCustom('');}} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaSetting==='Custom'} onSelect={()=>setCinemaSetting('Custom')} disabled={isDirecting} />
                              </div>
                              {cinemaSetting==='Custom' && (
                                <input type="text" value={cinemaSettingCustom} onChange={(e)=>setCinemaSettingCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف الموقع...':'Describe the setting...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                                  style={{background:'rgba(12,15,20,0.6)',border:'1px solid rgba(226,199,168,0.4)'}} autoFocus />
                              )}
                            </div>

                            {/* Main Action chips */}
                            <div>
                              <p className="text-[10px] text-white/35 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'الحدث الرئيسي (اختياري)':'Main Action (optional)'}{effectiveAction.trim() && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🎬',en:'Dramatic Reveal',ar:'كشف درامي',v:'a slow dramatic cinematic reveal — the subject emerges from darkness into a spotlight'},
                                  {e:'🚀',en:'Soaring Flight',ar:'تحليق جريء',v:'soaring and flying at high speed through a dramatic environment'},
                                  {e:'❤️',en:'Human Moment',ar:'لحظة إنسانية',v:'an intimate human moment — warmth, connection, and genuine emotion'},
                                  {e:'🌍',en:'Epic Journey',ar:'رحلة ملحمية',v:'a sweeping aerial journey — camera glides over landscapes and terrain'},
                                  {e:'🎉',en:'Celebration',ar:'احتفال',v:'a joyful celebration — energy, movement, confetti, people coming together'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v} selected={cinemaAction===v}
                                    onSelect={()=>{setCinemaAction(v);setCinemaActionCustom('');}} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaAction==='Custom'} onSelect={()=>setCinemaAction('Custom')} disabled={isDirecting} />
                              </div>
                              {cinemaAction==='Custom' && (
                                <input type="text" value={cinemaActionCustom} onChange={(e)=>setCinemaActionCustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف الحدث...':'Describe the action...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                                  style={{background:'rgba(12,15,20,0.6)',border:'1px solid rgba(226,199,168,0.4)'}} autoFocus />
                              )}
                            </div>

                            {effectiveVibe.trim() && (
                              <button type="button" onClick={()=>setCinemaOpenSection(2)}
                                className="self-end text-[11px] font-semibold text-[#E2C7A8] opacity-70 hover:opacity-100 transition-opacity">
                                {language==='ar'?'التالي ›':'Next ›'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── SECTION 3: Characters + Scenes ── */}
                      <div className="rounded-2xl px-4 py-3 transition-all"
                        style={{background:openSection===2?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.02)',border:openSection===2?'1px solid rgba(226,199,168,0.2)':'1px solid rgba(255,255,255,0.07)'}}>
                        <SecHeader idx={2} label={language==='ar'?'الشخصيات وعدد المشاهد':'Characters & Scenes'} done={sec3Done}
                          summary={cinemaCharacters ? cinemaCharacters.split('—')[0].trim() : undefined} />
                        {openSection === 2 && (
                          <div className="mt-3 flex flex-col gap-4">

                            {/* Characters chips */}
                            <div>
                              <p className="text-[10px] text-white/40 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'من يظهر في الفيلم؟ ✱':'Who is in the movie? ✱'}{cinemaCharacters.trim() && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'📦',en:'No People',ar:'بدون أشخاص',v:'no people — product, object, or creature only'},
                                  {e:'👤',en:'Solo Hero',ar:'بطل واحد',v:'one solo person — the hero, the protagonist'},
                                  {e:'👥',en:'Two People',ar:'شخصان',v:'two people'},
                                  {e:'👨‍👩‍👧',en:'Small Group',ar:'مجموعة صغيرة',v:'a small group of 3-5 people'},
                                  {e:'🏟️',en:'Crowd',ar:'حشد',v:'a crowd or community — many people united'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v}
                                    selected={cinemaCharacters===v}
                                    onSelect={()=>{setCinemaCharacters(v);setCinemaRelationship('');}}
                                    disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaCharacters==='Custom'} onSelect={()=>{setCinemaCharacters('Custom');setCinemaRelationship('');}} disabled={isDirecting} />
                              </div>
                              {(cinemaCharacters==='Custom' || (cinemaCharacters && cinemaCharacters!=='no people — product, object, or creature only' && cinemaCharacters!=='one solo person — the hero, the protagonist')) && (
                                <input type="text" value={cinemaRelationship} onChange={(e)=>setCinemaRelationship(e.target.value)}
                                  disabled={isDirecting}
                                  placeholder={cinemaCharacters==='Custom'?(language==='ar'?'صف الشخصيات...':'Describe characters...'):(language==='ar'?'العلاقة بينهم...':'Relationship between them...')}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                                  style={{background:'rgba(12,15,20,0.6)',border:'1px solid rgba(226,199,168,0.4)'}} autoFocus />
                              )}
                            </div>

                            {/* Scene count — compact inline pills — default 3 shown dimmed, user must tap */}
                            <div>
                              <p className="text-[10px] text-white/40 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'عدد المشاهد ✱':'How many scenes? ✱'}{isSceneCountReady && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex gap-2">
                                {[1,2,3,4,5,6].map(n=>(
                                  <button key={n}
                                    onClick={()=>{setCinemaSceneCount(n);setCinemaSceneCountTouched(true);}}
                                    disabled={isDirecting}
                                    className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                                    style={{
                                      background: isSceneCountReady && cinemaSceneCount===n ? 'linear-gradient(135deg,#E2C7A8,#C5A47E)' : n===3 && !isSceneCountReady ? 'rgba(226,199,168,0.08)' : 'rgba(255,255,255,0.04)',
                                      border: isSceneCountReady && cinemaSceneCount===n ? '1px solid rgba(226,199,168,0.8)' : n===3 && !isSceneCountReady ? '1px solid rgba(226,199,168,0.2)' : '1px solid rgba(255,255,255,0.1)',
                                      color: isSceneCountReady && cinemaSceneCount===n ? '#0c0f14' : 'rgba(255,255,255,0.5)',
                                    }}>
                                    <span className="text-sm font-bold">{n}</span>
                                    <span className="text-[9px] opacity-80">{n*10}s</span>
                                  </button>
                                ))}
                              </div>
                              {!isSceneCountReady && (
                                <p className="text-[10px] text-white/25 mt-1.5 px-1">{language==='ar'?'اختر عدد المشاهد للمتابعة':'Tap a number to confirm'}</p>
                              )}
                            </div>

                            {/* Video Purpose chips (optional) */}
                            <div>
                              <p className="text-[10px] text-white/35 mb-2 font-semibold uppercase tracking-wider">
                                {language==='ar'?'هدف الفيديو (اختياري)':'Goal (optional)'}{effectiveCTA.trim() && <span className="text-[#E2C7A8] ml-1">✓</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  {e:'🛍️',en:'Sell Product',ar:'بيع منتج',v:'sell or promote a product — end with a strong desire to buy'},
                                  {e:'🏷️',en:'Brand',ar:'هوية العلامة',v:'build brand identity — make the audience feel who we are'},
                                  {e:'📣',en:'Announce',ar:'إعلان حدث',v:'announce an event or launch — create urgency and excitement'},
                                  {e:'💪',en:'Inspire',ar:'إلهام',v:'inspire and motivate the viewer — leave them feeling empowered'},
                                  {e:'❤️',en:'Emotional',ar:'تواصل عاطفي',v:'create an emotional connection — make the audience feel deeply'},
                                  {e:'📱',en:'Go Viral',ar:'انتشار واسع',v:'grow social media presence — designed to be shared and go viral'},
                                ] as {e:string;en:string;ar:string;v:string}[]).map(({e,en,ar,v})=>(
                                  <Chip key={v} emoji={e} label={language==='ar'?ar:en} value={v}
                                    selected={cinemaCTA===v} onSelect={()=>{setCinemaCTA(v);setCinemaCTACustom('');}} disabled={isDirecting} />
                                ))}
                                <Chip emoji="✏️" label={language==='ar'?'مخصص':'Custom'} value="Custom"
                                  selected={cinemaCTA==='Custom'} onSelect={()=>setCinemaCTA('Custom')} disabled={isDirecting} />
                              </div>
                              {cinemaCTA==='Custom' && (
                                <input type="text" value={cinemaCTACustom} onChange={(e)=>setCinemaCTACustom(e.target.value)}
                                  disabled={isDirecting} placeholder={language==='ar'?'صف هدف الفيديو...':'Describe the goal...'}
                                  className="mt-2 w-full bg-transparent rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                                  style={{background:'rgba(12,15,20,0.6)',border:'1px solid rgba(226,199,168,0.4)'}} autoFocus />
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
                              ? 'جاري تحليل رؤيتك وإنشاء ٦ مشاهد سينمائية...'
                              : 'Analyzing your vision and creating 6 cinematic scenes...'}
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
                        {/* Format Toggle */}
                        <div className="flex items-center rounded-full p-0.5" style={{background:'rgba(226,199,168,0.1)',border:'1px solid rgba(226,199,168,0.25)'}}>
                          <button
                            onClick={() => setCinemaFormat('16:9')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${cinemaFormat === '16:9' ? 'text-[#0c0f14]' : 'text-[#E2C7A8]/60'}`}
                            style={cinemaFormat === '16:9' ? {background:'linear-gradient(135deg,#E2C7A8,#C5A47E)'} : {}}
                          >16:9</button>
                          <button
                            onClick={() => setCinemaFormat('9:16')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${cinemaFormat === '9:16' ? 'text-[#0c0f14]' : 'text-[#E2C7A8]/60'}`}
                            style={cinemaFormat === '9:16' ? {background:'linear-gradient(135deg,#E2C7A8,#C5A47E)'} : {}}
                          >9:16</button>
                        </div>
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
                            <div className="flex-1 min-h-[40px]">
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
                                  <TypewriterText text={scene.text} delay={sceneNum * 200} />
                                </p>
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Loader2 className="h-5 w-5 animate-spin text-[#E2C7A8]/30" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reference image upload section */}
                    {cinemaScenes.length >= cinemaSceneCount && (() => {
                      // Slot definitions: N scene slots + 1 logo/brand slot
                      const totalSlots = cinemaSceneCount + 1;
                      const tagOptions = [
                        ...Array.from({length: cinemaSceneCount}, (_, i) => ({ value: `scene${i+1}`, label: language === 'ar' ? `مشهد ${i+1}` : `Scene ${i+1}` })),
                        { value: 'logo', label: language === 'ar' ? 'شعار العلامة' : 'Brand Logo' },
                        { value: 'ref', label: language === 'ar' ? 'مرجع بصري' : 'Visual Ref' },
                      ];
                      const uploadedCount = cinemaReferenceImages.filter(Boolean).length;
                      return (
                      <div className="rounded-2xl p-4 flex flex-col gap-3" style={{background:'rgba(226,199,168,0.05)', border:'1px solid rgba(226,199,168,0.15)'}}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#E2C7A8] uppercase tracking-wider">
                              {language === 'ar' ? '🖼 صورك الخاصة (اختياري)' : '🖼 Your Own Images (Optional)'}
                            </p>
                            <p className="text-[10px] text-white/35 mt-0.5">
                              {language === 'ar' ? 'ارفع صورك وحدد دورها — وجه، شعار، مشهد محدد' : 'Upload images & tag their role — face, logo, or specific scene'}
                            </p>
                          </div>
                          {uploadedCount > 0 && (
                            <button
                              onClick={() => { setCinemaReferenceImages([]); setCinemaRefTags([]); }}
                              className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                            >
                              {language === 'ar' ? 'مسح الكل' : 'Clear all'}
                            </button>
                          )}
                        </div>

                        {/* Upload grid */}
                        <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${Math.min(totalSlots, 4)}, 1fr)`}}>
                          {Array.from({length: totalSlots}, (_, slotIdx) => {
                            const refUrl = cinemaReferenceImages[slotIdx];
                            const tag = cinemaRefTags[slotIdx] || 'ref'; // default: always visual ref until user picks
                            const tagLabel = tagOptions.find(t => t.value === tag)?.label || tag;
                            const isLogoSlot = slotIdx === cinemaSceneCount; // last slot = logo/brand
                            return (
                              <div key={slotIdx} className="flex flex-col gap-1">
                                {/* Image tile */}
                                <div className="relative rounded-xl overflow-hidden" style={{aspectRatio:'1', background: refUrl ? 'transparent' : 'rgba(255,255,255,0.03)', border: refUrl ? '1px solid rgba(226,199,168,0.4)' : `2px dashed ${isLogoSlot ? 'rgba(142,76,55,0.35)' : 'rgba(255,255,255,0.15)'}`}}>
                                  {refUrl ? (
                                    <>
                                      <img src={refUrl} alt={`ref ${slotIdx+1}`} className="w-full h-full object-cover" />
                                      <button
                                        onClick={() => {
                                          setCinemaReferenceImages(prev => { const n = [...prev]; n[slotIdx] = null; return n; });
                                          setCinemaRefTags(prev => { const n = [...prev]; n[slotIdx] = ''; return n; });
                                        }}
                                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/80 text-white text-[10px] flex items-center justify-center hover:bg-red-500/80 transition-colors"
                                      >✕</button>
                                    </>
                                  ) : (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-0.5">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleCinemaRefUpload(file, slotIdx, tag);
                                        }}
                                      />
                                      {isUploadingRef ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                                      ) : (
                                        <span className="text-white/25 text-xl leading-none">+</span>
                                      )}
                                    </label>
                                  )}
                                </div>

                                {/* Tag selector — custom styled to look like a real dropdown */}
                                <div className="relative w-full">
                                  <select
                                    value={tag}
                                    title={language === 'ar' ? 'نوع الصورة' : 'Image tag'}
                                    aria-label={language === 'ar' ? 'نوع الصورة' : 'Image tag'}
                                    onChange={(e) => {
                                      const newTag = e.target.value;
                                      setCinemaRefTags(prev => { const n = [...prev]; n[slotIdx] = newTag; return n; });
                                    }}
                                    className="w-full text-[9px] font-semibold rounded-lg pl-2 pr-5 py-1.5 outline-none appearance-none cursor-pointer transition-all"
                                    style={{
                                      background: refUrl ? 'rgba(226,199,168,0.15)' : 'rgba(255,255,255,0.06)',
                                      border: refUrl ? '1px solid rgba(226,199,168,0.4)' : '1px solid rgba(255,255,255,0.12)',
                                      color: refUrl ? '#E2C7A8' : 'rgba(255,255,255,0.45)',
                                      colorScheme: 'dark',
                                    }}
                                  >
                                    {tagOptions.map(opt => (
                                      <option key={opt.value} value={opt.value} className="bg-[#0c0f14] text-white">{opt.label}</option>
                                    ))}
                                  </select>
                                  {/* Chevron overlay */}
                                  <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
                                    <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                                      <path d="M1 1l3 3 3-3" stroke={refUrl ? '#E2C7A8' : 'rgba(255,255,255,0.35)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {uploadedCount > 0 && (
                          <p className="text-[10px] text-[#E2C7A8]/50 px-0.5">
                            {language === 'ar'
                              ? `${uploadedCount} ${uploadedCount === 1 ? 'صورة مرفوعة' : 'صور مرفوعة'} — الذكاء الاصطناعي سيستخدمها وفق التصنيف`
                              : `${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded — AI will use them based on their tag`}
                          </p>
                        )}
                      </div>
                      );
                    })()}

                    {/* Sticky footer — CAST YOUR MOVIE */}
                    {cinemaScenes.length >= cinemaSceneCount && (
                      <div className="cinema-sticky-footer px-4 py-3">
                        <button
                          onClick={handleCast}
                          disabled={isCasting}
                          className="relative w-full h-14 text-base font-bold rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                          style={{background:'linear-gradient(135deg,#E2C7A8 0%,#C5A47E 50%,#E2C7A8 100%)',backgroundSize:'200% 100%',animation:'shimmerGold 2.5s ease-in-out infinite',boxShadow:'0 8px 32px rgba(226,199,168,0.4)',color:'#0c0f14'}}
                        >
                          {isCasting ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>{language === 'ar' ? 'المصور يرسم الصور...' : 'Artist is painting...'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Camera className="h-5 w-5" />
                              <span>{language === 'ar' ? 'التالي: صب الفيلم' : 'NEXT: CAST YOUR MOVIE'}</span>
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
                      <h3 className="text-lg font-bold text-white">{language === 'ar' ? 'تصوير المشاهد' : 'Casting the Movie'}</h3>
                      <p className="text-xs text-white/50">
                        {isCasting
                          ? (language === 'ar' ? 'المصور الذكي يرسم مشاهدك...' : 'AI Artist is painting your scenes...')
                          : (language === 'ar' ? 'اختر صورة المرساة للمشهد الأول' : 'Your scenes are ready — approve to film')}
                      </p>
                    </div>

                    {/* Master Anchor Preview */}
                    {anchorImageUrl && (
                      <div className="mx-auto cinema-diamond-border rounded-2xl overflow-hidden"
                        style={{width: cinemaFormat === '16:9' ? '100%' : '60%', aspectRatio: cinemaFormat === '16:9' ? '16/9' : '9/16', maxHeight: '240px'}}>
                        <img src={anchorImageUrl} alt="Anchor scene" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* N scene image grid (2 columns) */}
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({length: cinemaSceneCount}, (_, i) => i).map((idx) => {
                        const img = sceneImages[idx];
                        const prog = castingProgress[idx];
                        return (
                          <div key={idx}
                            className={`relative rounded-2xl overflow-hidden ${prog === 'loading' ? 'cinema-gold-pulse cinema-painting-skeleton' : ''}`}
                            style={{aspectRatio: cinemaFormat === '16:9' ? '16/9' : '9/16', background:'rgba(12,15,20,0.8)', border: img ? '1px solid rgba(226,199,168,0.5)' : '1px solid rgba(255,255,255,0.06)'}}>
                            {img ? (
                              <img src={img} alt={`Scene ${idx+1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
                                {prog === 'loading' ? (
                                  <Loader2 className="h-6 w-6 animate-spin text-[#E2C7A8]/50" />
                                ) : prog === 'error' ? (
                                  <span className="text-red-400 text-xs">✗</span>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border border-white/10" />
                                )}
                              </div>
                            )}
                            {/* Scene label */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold"
                              style={{background:'rgba(12,15,20,0.7)',color: prog === 'done' ? '#E2C7A8' : 'rgba(255,255,255,0.4)'}}>
                              {language === 'ar' ? `م${idx+1}` : `S${idx+1}`}
                              {prog === 'done' && ' ✓'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

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
                        disabled={isFilming || isCasting || castingProgress.slice(0, cinemaSceneCount).some(p => p === 'loading') || sceneImages.slice(0, cinemaSceneCount).some(img => img === null)}
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
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-bold text-white">{language === 'ar' ? 'الإنتاج جارٍ...' : 'Production in Progress'}</h3>
                      <p className="text-xs text-white/50">{language === 'ar' ? `${cinemaSceneCount} مشاهد • ١٠ ثوانٍ كل مشهد` : `${cinemaSceneCount} chapters • 10s each`}</p>
                    </div>

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
                            style={{aspectRatio:'9/16', minHeight:'120px', background:'rgba(12,15,20,0.8)', border: clip ? '1px solid rgba(226,199,168,0.6)' : '1px solid rgba(255,255,255,0.06)'}}>
                            {clip ? (
                              <video src={clip} muted playsInline loop autoPlay className="w-full h-full object-cover" />
                            ) : (
                              <>
                                {prog === 'queued' && <div className="w-3 h-3 rounded-full bg-[#E2C7A8]/30 animate-pulse" />}
                                {prog === 'rendering' && <Loader2 className="h-5 w-5 animate-spin text-[#E2C7A8]" />}
                                {prog === 'error' && <span className="text-red-400 text-xs">✗</span>}
                                {prog === 'done' && <span className="text-green-400 text-xs">✓</span>}
                              </>
                            )}
                            <span className="absolute top-1.5 left-2 text-[9px] font-bold"
                              style={{color: prog === 'done' ? '#E2C7A8' : 'rgba(255,255,255,0.3)'}}>
                              {language === 'ar' ? `م${idx+1}` : `Ch.${idx+1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Sticky footer — PREMIERE */}
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
                        disabled={isStitching || isFilming || videoClips.slice(0, cinemaSceneCount).filter(Boolean).length < cinemaSceneCount}
                        className="flex-1 h-12 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 cinema-glow-pulse"
                        style={{background:'linear-gradient(135deg,hsl(210,100%,60%),hsl(280,70%,65%))',color:'#fff',boxShadow:'0 6px 28px hsla(210,100%,65%,0.4)'}}
                      >
                        {isStitching ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{stitchStatus || (language === 'ar' ? 'جاري التجميع...' : 'Stitching...')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span>{language === 'ar' ? `العرض الأول (${videoClips.slice(0, cinemaSceneCount).filter(Boolean).length}/${cinemaSceneCount})` : `PREMIERE (${videoClips.slice(0, cinemaSceneCount).filter(Boolean).length}/${cinemaSceneCount} ready)`}</span>
                          </div>
                        )}
                      </button>
                    </div>
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
                      <div className="flex gap-3">
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
                            <><Loader2 className="h-4 w-4 animate-spin" /><span>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span></>
                          ) : isCinemaSaved ? (
                            <><span>✓</span><span>{language === 'ar' ? 'تم الحفظ' : 'Saved!'}</span></>
                          ) : (
                            <><Download className="h-4 w-4" /><span>{language === 'ar' ? 'حفظ في فيديوهاتي' : 'Save to My Videos'}</span></>
                          )}
                        </button>
                        <button
                          onClick={handleCinemaReset}
                          className="h-12 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 flex-shrink-0"
                          style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)'}}
                        >
                          <RefreshCw className="h-4 w-4" />
                          {language === 'ar' ? 'جديد' : 'New'}
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
