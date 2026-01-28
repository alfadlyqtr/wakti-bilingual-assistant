import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Upload, 
  Image as ImageIcon, 
  Music, 
  Type, 
  Palette, 
  Play, 
  Download, 
  Share2, 
  Trash2, 
  GripVertical,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  RefreshCw,
  Video,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  Loader2,
  Check,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCanvasVideo } from '@/hooks/useCanvasVideo';

// Types
type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'wipe-left' | 'wipe-right' | 'dissolve' | 'none';
type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'zoom-in' | 'typewriter' | 'bounce';
type KenBurnsDirection = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'random';
type TextFont = 'system' | 'serif' | 'mono' | 'handwritten' | 'bold';
type FilterPreset = 'none' | 'vivid' | 'warm' | 'cool' | 'vintage' | 'bw' | 'dramatic' | 'soft';

type SlideMediaType = 'image' | 'video';

interface SlideFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  preset: FilterPreset;
}

interface Slide {
  id: string;
  mediaType: SlideMediaType;
  imageUrl?: string;
  imageFile?: File;
  videoUrl?: string;
  videoFile?: File;
  clipMuted: boolean;
  clipVolume: number; // 0..1
  text: string;
  textPosition: 'top' | 'center' | 'bottom';
  textColor: string;
  textSize: 'small' | 'medium' | 'large';
  textAnimation: TextAnimation;
  textFont: TextFont;
  textShadow: boolean;
  durationSec: number;
  transition: TransitionType;
  transitionDuration: number;
  filters: SlideFilters;
  kenBurns: KenBurnsDirection;
  kenBurnsSpeed: number;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  source: 'upload' | 'music_gen' | 'tts';
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
}

interface SavedVideo {
  id: string;
  title: string | null;
  thumbnail_url?: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  is_public: boolean;
  created_at: string;
  signedUrl?: string | null;
  thumbnailSignedUrl?: string | null;
}

type TemplateStyle = 'dark-glow' | 'warm-minimal' | 'vibrant-gradient' | 'ocean-blue' | 'sunset-orange' | 'forest-green' | 'royal-purple' | 'midnight-black' | 'rose-pink';

interface VideoProject {
  slides: Slide[];
  audio: AudioTrack | null;
  template: TemplateStyle;
  title: string;
  isPublic: boolean;
}

// Template definitions using Wakti colors
const TEMPLATES: Record<TemplateStyle, { name: string; nameAr: string; bgGradient: string; textColor: string; accentColor: string }> = {
  'dark-glow': {
    name: 'Wakti Dark Glow',
    nameAr: 'وقتي داكن متوهج',
    bgGradient: 'linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 30%, hsl(250 20% 10%) 70%, #0c0f14 100%)',
    textColor: '#f2f2f2',
    accentColor: 'hsl(210 100% 65%)'
  },
  'warm-minimal': {
    name: 'Warm Minimal',
    nameAr: 'دافئ بسيط',
    bgGradient: 'linear-gradient(135deg, #fcfefd 0%, hsl(200 15% 96%) 30%, #fcfefd 100%)',
    textColor: '#060541',
    accentColor: '#e9ceb0'
  },
  'vibrant-gradient': {
    name: 'Vibrant Gradient',
    nameAr: 'تدرج نابض',
    bgGradient: 'linear-gradient(135deg, hsl(210 100% 60%) 0%, hsl(280 70% 65%) 50%, hsl(25 95% 60%) 100%)',
    textColor: '#f2f2f2',
    accentColor: 'hsl(45 100% 60%)'
  },
  'ocean-blue': {
    name: 'Ocean Blue',
    nameAr: 'أزرق المحيط',
    bgGradient: 'linear-gradient(135deg, hsl(200 80% 20%) 0%, hsl(210 90% 35%) 50%, hsl(195 85% 45%) 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(180 70% 60%)'
  },
  'sunset-orange': {
    name: 'Sunset Orange',
    nameAr: 'غروب برتقالي',
    bgGradient: 'linear-gradient(135deg, hsl(15 90% 55%) 0%, hsl(35 95% 60%) 50%, hsl(45 100% 65%) 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(0 80% 50%)'
  },
  'forest-green': {
    name: 'Forest Green',
    nameAr: 'أخضر الغابة',
    bgGradient: 'linear-gradient(135deg, hsl(140 50% 20%) 0%, hsl(150 60% 30%) 50%, hsl(160 70% 40%) 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(120 60% 50%)'
  },
  'royal-purple': {
    name: 'Royal Purple',
    nameAr: 'بنفسجي ملكي',
    bgGradient: 'linear-gradient(135deg, hsl(270 60% 25%) 0%, hsl(280 70% 40%) 50%, hsl(290 80% 55%) 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(300 70% 70%)'
  },
  'midnight-black': {
    name: 'Midnight Black',
    nameAr: 'أسود منتصف الليل',
    bgGradient: 'linear-gradient(135deg, #000000 0%, #1a1a2e 50%, #16213e 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(220 80% 60%)'
  },
  'rose-pink': {
    name: 'Rose Pink',
    nameAr: 'وردي',
    bgGradient: 'linear-gradient(135deg, hsl(340 80% 55%) 0%, hsl(350 85% 65%) 50%, hsl(0 90% 75%) 100%)',
    textColor: '#ffffff',
    accentColor: 'hsl(330 70% 80%)'
  }
};

const MAX_SLIDES = 10;
const MIN_SLIDES = 2;
const MAX_DURATION_SEC = 60;
const MAX_AUDIO_SIZE_MB = 10;

type VideoMakerTab = 'create' | 'saved';

// Video player component that fetches video as blob to handle content-type issues
function VideoPlayer({ url, language }: { url: string; language: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const headerType = response.headers.get('content-type') || '';
        const mime = blob.type || headerType || 'video/mp4';
        const videoBlob = new Blob([blob], { type: mime });
        objectUrl = URL.createObjectURL(videoBlob);
        if (mounted) {
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('Video fetch error:', err);
        if (mounted) {
          setError(language === 'ar' ? 'فشل تحميل الفيديو' : 'Failed to load video');
          setLoading(false);
        }
      }
    };
    fetchVideo();
    return () => {
      mounted = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [language, url]);

  if (loading) {
    return (
      <div className="px-3 pb-3">
        <div className="w-full h-48 bg-black rounded-lg flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 pb-3">
        <div className="w-full h-48 bg-black rounded-lg flex items-center justify-center text-white text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <video 
        src={blobUrl || url}
        controls 
        autoPlay
        playsInline
        className="w-full max-h-[60vh] rounded-lg bg-black object-contain"
      />
    </div>
  );
}

export default function VideoMaker({ initialTab }: { initialTab?: VideoMakerTab } = {}) {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<VideoMakerTab>(initialTab || 'create');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState<SavedVideo | null>(null);

  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
  const [slidePanels, setSlidePanels] = useState<Record<string, 'text' | 'look' | 'motion'>>({});

  // Project state
  const [project, setProject] = useState<VideoProject>({
    slides: [],
    audio: null,
    template: 'dark-glow',
    title: '',
    isPublic: false
  });

  // Canvas Video hook
  const { generateVideo, progress: canvasProgress, status: canvasStatus, error: canvasError, isLoading: canvasLoading, isReady: canvasReady } = useCanvasVideo();

  // UI state
  const [step, setStep] = useState<'upload' | 'customize' | 'generate'>('upload');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [savedTracks, setSavedTracks] = useState<AudioTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Calculate total duration
  const totalDuration = project.slides.reduce((sum, s) => sum + s.durationSec, 0);
  const remainingDuration = MAX_DURATION_SEC - totalDuration;

  // Sync Canvas progress with local state
  useEffect(() => {
    if (canvasLoading) {
      setGenerationProgress(canvasProgress);
      if (canvasStatus) {
        setGenerationStatus(canvasStatus);
      }
    }
  }, [canvasLoading, canvasProgress, canvasStatus]);

  // Load user's saved music tracks
  const loadSavedTracks = useCallback(async () => {
    if (!user) return;
    setLoadingTracks(true);
    try {
      const { data, error } = await supabase
        .from('user_music_tracks')
        .select('id, prompt, storage_path, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tracks: AudioTrack[] = await Promise.all(
        (data || []).map(async (track) => {
          let url = '';
          if (track.storage_path) {
            const { data: urlData } = await supabase.storage
              .from('music')
              .createSignedUrl(track.storage_path, 3600);
            url = urlData?.signedUrl || '';
          }
          return {
            id: track.id,
            name: track.prompt || `Track ${track.id.slice(0, 8)}`,
            url,
            source: 'music_gen' as const
          };
        })
      );

      setSavedTracks(tracks.filter(t => t.url));
    } catch (e) {
      console.error('Failed to load tracks:', e);
    } finally {
      setLoadingTracks(false);
    }
  }, [user]);

  useEffect(() => {
    if (showAudioPicker) {
      loadSavedTracks();
    }
  }, [showAudioPicker, loadSavedTracks]);

  const loadSavedVideos = useCallback(async () => {
    if (!user) return;
    setLoadingVideos(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('id, title, thumbnail_url, storage_path, duration_seconds, is_public, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: SavedVideo[] = (data || []) as SavedVideo[];

      const withUrls: SavedVideo[] = await Promise.all(
        rows.map(async (v) => {
          let signedUrl: string | null = null;
          let thumbnailSignedUrl: string | null = null;

          // Use signed URL for better compatibility (handles content-type properly)
          if (v.storage_path) {
            const { data: urlData, error: urlErr } = await supabase.storage
              .from('videos')
              .createSignedUrl(v.storage_path, 3600);
            if (urlErr) {
              console.error('[VideoMaker] Signed URL error:', urlErr);
              // Fallback to public URL
              const { data: pubData } = supabase.storage
                .from('videos')
                .getPublicUrl(v.storage_path);
              signedUrl = pubData?.publicUrl || null;
            } else {
              signedUrl = urlData?.signedUrl || null;
            }
            console.log('[VideoMaker] Video URL:', signedUrl ? 'OK' : 'FAILED', 'path:', v.storage_path);
          }

          if ((v as any).thumbnail_url) {
            const thumbPath = (v as any).thumbnail_url as string;
            const { data: tSigned, error: tErr } = await supabase.storage
              .from('videos')
              .createSignedUrl(thumbPath, 3600);
            if (tErr) {
              console.error('[VideoMaker] Thumbnail signed URL error:', tErr);
              const { data: tUrl } = supabase.storage.from('videos').getPublicUrl(thumbPath);
              thumbnailSignedUrl = tUrl?.publicUrl || null;
            } else {
              thumbnailSignedUrl = tSigned?.signedUrl || null;
            }
            console.log('[VideoMaker] Thumbnail URL:', thumbnailSignedUrl ? 'OK' : 'FAILED', 'path:', thumbPath);
          }

          return { ...v, signedUrl, thumbnailSignedUrl };
        })
      );

      console.log('[VideoMaker] Loaded videos:', withUrls);
      setSavedVideos(withUrls);
    } catch (e) {
      console.error('Failed to load saved videos:', e);
      toast.error(language === 'ar' ? 'فشل تحميل الفيديوهات' : 'Failed to load videos');
    } finally {
      setLoadingVideos(false);
    }
  }, [language, user]);

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedVideos();
    }
  }, [activeTab, loadSavedVideos]);

  const formatDuration = (sec: number | null | undefined) => {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  };

  const confirmDeleteSavedVideo = async () => {
    if (!user || !pendingDeleteVideo) return;
    const v = pendingDeleteVideo;
    try {
      if (v.storage_path) {
        await supabase.storage.from('videos').remove([v.storage_path]);
      }
      if ((v as any).thumbnail_url) {
        await supabase.storage.from('videos').remove([(v as any).thumbnail_url]);
      }
      await (supabase as any)
        .from('user_videos')
        .delete()
        .eq('id', v.id)
        .eq('user_id', user.id);

      setSavedVideos((prev) => prev.filter((x) => x.id !== v.id));
      if (activePreviewId === v.id) setActivePreviewId(null);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (e) {
      console.error('Delete failed:', e);
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Delete failed');
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeleteVideo(null);
    }
  };

  const handleDeleteSavedVideo = (v: SavedVideo) => {
    setPendingDeleteVideo(v);
    setDeleteDialogOpen(true);
  };

  const handleShareSavedVideo = async (v: SavedVideo) => {
    const shareUrl = `${window.location.origin}/video/${v.id}`;
    if (!v.is_public) {
      toast.error(language === 'ar' ? 'اجعل الفيديو عاماً أولاً' : 'Make the video public first');
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: v.title || 'Wakti Video', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (_) {}
  };

  const handleTogglePublic = async (v: SavedVideo) => {
    if (!user) return;
    try {
      const next = !v.is_public;
      const { error } = await (supabase as any)
        .from('user_videos')
        .update({ is_public: next })
        .eq('id', v.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setSavedVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, is_public: next } : x)));
      toast.success(next ? (language === 'ar' ? 'تم جعله عاماً' : 'Now public') : (language === 'ar' ? 'تم جعله خاصاً' : 'Now private'));
    } catch (e) {
      console.error('Toggle public failed:', e);
      toast.error(language === 'ar' ? 'فشل التحديث' : 'Update failed');
    }
  };

  // Handle media upload (images + videos)
  const handleMediaUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newSlides: Slide[] = [];
    const maxToAdd = MAX_SLIDES - project.slides.length;

    Array.from(files).slice(0, maxToAdd).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) return;

      const url = URL.createObjectURL(file);
      newSlides.push({
        id: crypto.randomUUID(),
        mediaType: isVideo ? 'video' : 'image',
        imageUrl: isImage ? url : undefined,
        imageFile: isImage ? file : undefined,
        videoUrl: isVideo ? url : undefined,
        videoFile: isVideo ? file : undefined,
        clipMuted: false,
        clipVolume: 1,
        text: '',
        textPosition: 'bottom',
        textColor: TEMPLATES[project.template].textColor,
        textSize: 'medium',
        textAnimation: 'fade-in',
        textFont: 'system',
        textShadow: true,
        durationSec: Math.min(3, remainingDuration / (maxToAdd || 1)),
        transition: 'fade',
        transitionDuration: 0.5,
        filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, preset: 'none' },
        kenBurns: 'random',
        kenBurnsSpeed: 1
      });
    });

    if (newSlides.length > 0) {
      setProject(prev => ({
        ...prev,
        slides: [...prev.slides, ...newSlides]
      }));
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [project.slides.length, project.template, remainingDuration]);

  // Handle audio upload
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      toast.error(language === 'ar' 
        ? `حجم الملف يجب أن يكون أقل من ${MAX_AUDIO_SIZE_MB} ميجابايت`
        : `File size must be less than ${MAX_AUDIO_SIZE_MB}MB`
      );
      return;
    }

    // Check file type
    if (!file.type.includes('audio/')) {
      toast.error(language === 'ar' ? 'يرجى تحميل ملف صوتي' : 'Please upload an audio file');
      return;
    }

    const url = URL.createObjectURL(file);
    
    // Get audio duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      setProject(prev => ({
        ...prev,
        audio: {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          source: 'upload',
          duration: duration,
          trimStart: 0,
          trimEnd: Math.min(duration, MAX_DURATION_SEC)
        }
      }));
    });
    
    // Fallback if metadata doesn't load
    audio.addEventListener('error', () => {
      setProject(prev => ({
        ...prev,
        audio: {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          source: 'upload'
        }
      }));
    });
    
    setShowAudioPicker(false);

    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  }, [language]);

  // Remove slide
  const removeSlide = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      slides: prev.slides.filter(s => s.id !== id)
    }));
  }, []);

  // Update slide
  const updateSlide = useCallback((id: string, updates: Partial<Slide>) => {
    setProject(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, []);

  // Move slide
  const moveSlide = useCallback((fromIndex: number, toIndex: number) => {
    setProject(prev => {
      const newSlides = [...prev.slides];
      const [removed] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, removed);
      return { ...prev, slides: newSlides };
    });
  }, []);

  // Select saved track as audio
  const selectSavedTrack = useCallback((track: AudioTrack) => {
    // Get audio duration for trimmer
    if (track.url) {
      const audio = new Audio(track.url);
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        setProject(prev => ({ 
          ...prev, 
          audio: {
            ...track,
            duration: duration,
            trimStart: 0,
            trimEnd: Math.min(duration, MAX_DURATION_SEC)
          }
        }));
      });
      audio.addEventListener('error', () => {
        setProject(prev => ({ ...prev, audio: track }));
      });
    } else {
      setProject(prev => ({ ...prev, audio: track }));
    }
    setShowAudioPicker(false);
  }, []);

  // Remove audio
  const removeAudio = useCallback(() => {
    setProject(prev => ({ ...prev, audio: null }));
  }, []);

  // Can proceed to next step
  const canProceedToCustomize = project.slides.length >= MIN_SLIDES;
  const canGenerate = project.slides.length >= MIN_SLIDES && totalDuration <= MAX_DURATION_SEC;

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-4">
      {/* Upload area */}
      <Card 
        className="enhanced-card p-6 sm:p-8 border-2 border-dashed border-border/60 hover:border-primary/60 transition-all cursor-pointer hover:shadow-[var(--glow-primary)]"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-2xl bg-gradient-primary shadow-[var(--shadow-soft)]">
            <Upload className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="font-semibold bg-gradient-primary bg-clip-text text-transparent">
              {language === 'ar' ? 'اضغط لتحميل صور أو فيديو' : 'Tap to upload images or videos'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? `${MIN_SLIDES}-${MAX_SLIDES} ملفات • صور/فيديو`
                : `${MIN_SLIDES}-${MAX_SLIDES} files • images/videos`
              }
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleMediaUpload}
        />
      </Card>

      {/* Uploaded images preview */}
      {project.slides.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {language === 'ar' 
                ? `${project.slides.length} صور مُحملة`
                : `${project.slides.length} images uploaded`
              }
            </p>
            {project.slides.length < MAX_SLIDES && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4 mr-1" />
                {language === 'ar' ? 'إضافة المزيد' : 'Add more'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {project.slides.map((slide, index) => (
              <div key={slide.id} className="relative group aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                {slide.mediaType === 'video' ? (
                  <video
                    src={slide.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img 
                    src={slide.imageUrl} 
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSlide(slide.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                  {index + 1}
                </div>
                {slide.mediaType === 'video' && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                    {language === 'ar' ? 'فيديو' : 'VIDEO'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proceed button */}
      {canProceedToCustomize && (
        <Button 
          className="w-full btn-enhanced text-white hover:shadow-glow active:scale-95"
          onClick={() => setStep('customize')}
        >
          {language === 'ar' ? 'التالي' : 'Next'}
        </Button>
      )}
    </div>
  );

  // Render customize step
  const renderCustomizeStep = () => (
    <div className="space-y-4">
      {/* Title - moved to top */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'عنوان الفيديو (اختياري)' : 'Video Title (optional)'}
        </label>
        <Input
          value={project.title}
          onChange={(e) => setProject(prev => ({ ...prev, title: e.target.value }))}
          placeholder={language === 'ar' ? 'أدخل عنوان' : 'Enter title'}
        />
      </div>

      {/* Template picker */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {language === 'ar' ? 'اختر القالب' : 'Choose Template'}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(Object.entries(TEMPLATES) as [TemplateStyle, typeof TEMPLATES[TemplateStyle]][]).map(([key, template]) => (
            <button
              key={key}
              className={`relative min-w-[132px] p-3 rounded-xl border-2 transition-all active:scale-95 ${
                project.template === key 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setProject(prev => ({ ...prev, template: key }))}
            >
              <div 
                className="h-16 rounded-lg mb-2"
                style={{ background: template.bgGradient }}
              />
              <p className="text-xs font-medium truncate">
                {language === 'ar' ? template.nameAr : template.name}
              </p>
              {project.template === key && (
                <div className="absolute top-1 right-1 p-1 rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Slides editor */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {language === 'ar' ? 'تعديل الشرائح' : 'Edit Slides'}
        </p>
        <div className="space-y-3">
          {project.slides.map((slide, index) => {
            const isExpanded = expandedSlideId === slide.id;
            const panel = slidePanels[slide.id] || 'text';
            const maxPerSlide = Math.floor(MAX_DURATION_SEC / project.slides.length);
            const setPanel = (next: 'text' | 'look' | 'motion') => {
              setSlidePanels((prev) => ({ ...prev, [slide.id]: next }));
            };

            return (
              <Card key={slide.id} className="enhanced-card rounded-2xl p-3">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 text-left"
                  onClick={() => setExpandedSlideId(isExpanded ? null : slide.id)}
                >
                  <div className="w-14 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                    {slide.mediaType === 'video' ? (
                      <video
                        src={slide.videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={slide.imageUrl}
                        alt={`Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {language === 'ar' ? `شريحة ${index + 1}` : `Slide ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {slide.text?.trim()
                            ? slide.text.trim()
                            : (language === 'ar' ? 'بدون نص' : 'No text')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{language === 'ar' ? 'المدة' : 'Dur'}</span>
                          <Input
                            type="number"
                            min={1}
                            max={maxPerSlide}
                            value={slide.durationSec}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              updateSlide(slide.id, { durationSec: Math.min(maxPerSlide, Math.max(1, parseInt(e.target.value) || 1)) });
                            }}
                            className="h-9 w-16 text-center"
                          />
                          <span className="text-xs text-muted-foreground">s</span>
                        </div>
                        <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${
                          isExpanded ? 'bg-white/10 dark:bg-black/20' : 'bg-transparent'
                        }`}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl p-2 flex gap-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                      <button
                        type="button"
                        onClick={() => setPanel('text')}
                        className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                          panel === 'text'
                            ? 'btn-enhanced text-white border-transparent shadow-[var(--glow-primary)]'
                            : 'bg-white/10 border-border/60 hover:bg-white/15'
                        }`}
                      >
                        {language === 'ar' ? 'نص' : 'Text'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanel('look')}
                        className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                          panel === 'look'
                            ? 'btn-enhanced text-white border-transparent shadow-[var(--glow-primary)]'
                            : 'bg-white/10 border-border/60 hover:bg-white/15'
                        }`}
                      >
                        {language === 'ar' ? 'شكل' : 'Look'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanel('motion')}
                        className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                          panel === 'motion'
                            ? 'btn-enhanced text-white border-transparent shadow-[var(--glow-primary)]'
                            : 'bg-white/10 border-border/60 hover:bg-white/15'
                        }`}
                      >
                        {language === 'ar' ? 'حركة' : 'Motion'}
                      </button>
                    </div>

                    {panel === 'text' && (
                      <div className="space-y-3">
                        <Textarea
                          value={slide.text}
                          onChange={(e) => updateSlide(slide.id, { text: e.target.value })}
                          placeholder={language === 'ar' ? 'أضف نص (اختياري)' : 'Add text (optional)'}
                          className="min-h-[80px] text-sm resize-none rounded-2xl"
                        />

                        {!!slide.text?.trim() && (
                          <div className="space-y-3">
                            {/* Position & Size Row */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-2xl p-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                                <p className="text-xs text-muted-foreground mb-2">
                                  {language === 'ar' ? 'الموضع' : 'Position'}
                                </p>
                                <div className="flex gap-1">
                                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                                    <button
                                      key={pos}
                                      type="button"
                                      onClick={() => updateSlide(slide.id, { textPosition: pos })}
                                      className={`flex-1 h-8 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                                        (slide.textPosition || 'bottom') === pos
                                          ? 'btn-enhanced text-white border-transparent'
                                          : 'bg-white/10 border-border/60'
                                      }`}
                                    >
                                      {pos === 'top' ? '⬆️' : pos === 'center' ? '⬅️➡️' : '⬇️'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl p-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                                <p className="text-xs text-muted-foreground mb-2">
                                  {language === 'ar' ? 'الحجم' : 'Size'}
                                </p>
                                <div className="flex gap-1">
                                  {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => updateSlide(slide.id, { textSize: size })}
                                      className={`flex-1 h-8 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                                        (slide.textSize || 'medium') === size
                                          ? 'btn-enhanced text-white border-transparent'
                                          : 'bg-white/10 border-border/60'
                                      }`}
                                    >
                                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Text Color */}
                            <div className="rounded-2xl p-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                              <p className="text-xs text-muted-foreground mb-2">
                                {language === 'ar' ? 'لون النص' : 'Text Color'}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  { color: '#ffffff', label: 'White' },
                                  { color: '#000000', label: 'Black' },
                                  { color: '#f2f2f2', label: 'Light' },
                                  { color: '#060541', label: 'Navy' },
                                  { color: '#ff6b6b', label: 'Red' },
                                  { color: '#ffd93d', label: 'Yellow' },
                                  { color: '#6bcb77', label: 'Green' },
                                  { color: '#4d96ff', label: 'Blue' },
                                ].map((c) => (
                                  <button
                                    key={c.color}
                                    type="button"
                                    onClick={() => updateSlide(slide.id, { textColor: c.color })}
                                    className={`w-8 h-8 rounded-full border-2 transition-all active:scale-95 ${
                                      slide.textColor === c.color ? 'ring-2 ring-primary ring-offset-2' : ''
                                    }`}
                                    style={{ backgroundColor: c.color, borderColor: c.color === '#ffffff' ? '#ccc' : c.color }}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Font & Animation Row */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-2xl p-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                                <p className="text-xs text-muted-foreground mb-2">
                                  {language === 'ar' ? 'الخط' : 'Font'}
                                </p>
                                <select
                                  value={slide.textFont || 'system'}
                                  onChange={(e) => updateSlide(slide.id, { textFont: e.target.value as TextFont })}
                                  className="w-full h-8 px-2 text-xs rounded-lg border border-input bg-background"
                                  title={language === 'ar' ? 'الخط' : 'Font'}
                                >
                                  <option value="system">{language === 'ar' ? 'عادي' : 'System'}</option>
                                  <option value="serif">{language === 'ar' ? 'كلاسيكي' : 'Serif'}</option>
                                  <option value="mono">{language === 'ar' ? 'ثابت' : 'Mono'}</option>
                                  <option value="bold">{language === 'ar' ? 'عريض' : 'Bold'}</option>
                                </select>
                              </div>

                              <div className="rounded-2xl p-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                                <p className="text-xs text-muted-foreground mb-2">
                                  {language === 'ar' ? 'الحركة' : 'Animation'}
                                </p>
                                <select
                                  value={slide.textAnimation || 'fade-in'}
                                  onChange={(e) => updateSlide(slide.id, { textAnimation: e.target.value as TextAnimation })}
                                  className="w-full h-8 px-2 text-xs rounded-lg border border-input bg-background"
                                  title={language === 'ar' ? 'الحركة' : 'Animation'}
                                >
                                  <option value="none">{language === 'ar' ? 'بدون' : 'None'}</option>
                                  <option value="fade-in">{language === 'ar' ? 'تلاشي' : 'Fade In'}</option>
                                  <option value="slide-up">{language === 'ar' ? 'انزلاق للأعلى' : 'Slide Up'}</option>
                                  <option value="slide-down">{language === 'ar' ? 'انزلاق للأسفل' : 'Slide Down'}</option>
                                  <option value="zoom-in">{language === 'ar' ? 'تكبير' : 'Zoom In'}</option>
                                  <option value="typewriter">{language === 'ar' ? 'آلة كاتبة' : 'Typewriter'}</option>
                                  <option value="bounce">{language === 'ar' ? 'ارتداد' : 'Bounce'}</option>
                                </select>
                              </div>
                            </div>

                            {/* Shadow Toggle */}
                            <div className="flex items-center justify-between rounded-2xl p-3 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                              <span className="text-sm font-medium">
                                {language === 'ar' ? 'ظل النص' : 'Text Shadow'}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSlide(slide.id, { textShadow: !slide.textShadow })}
                                title={language === 'ar' ? 'تبديل ظل النص' : 'Toggle text shadow'}
                                aria-label={language === 'ar' ? 'تبديل ظل النص' : 'Toggle text shadow'}
                                className={`w-12 h-6 rounded-full transition-all ${
                                  slide.textShadow !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                  slide.textShadow !== false ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {panel === 'look' && (
                      <div className="space-y-4">
                        {/* Filter Presets */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">{language === 'ar' ? 'تأثيرات سريعة' : 'Quick Effects'}</p>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { key: 'none', label: language === 'ar' ? 'بدون' : 'None', emoji: '⚪' },
                              { key: 'vivid', label: language === 'ar' ? 'حيوي' : 'Vivid', emoji: '🌈' },
                              { key: 'warm', label: language === 'ar' ? 'دافئ' : 'Warm', emoji: '🌅' },
                              { key: 'cool', label: language === 'ar' ? 'بارد' : 'Cool', emoji: '❄️' },
                              { key: 'vintage', label: language === 'ar' ? 'كلاسيك' : 'Vintage', emoji: '📷' },
                              { key: 'bw', label: language === 'ar' ? 'أبيض/أسود' : 'B&W', emoji: '⬛' },
                              { key: 'dramatic', label: language === 'ar' ? 'درامي' : 'Drama', emoji: '🎭' },
                              { key: 'soft', label: language === 'ar' ? 'ناعم' : 'Soft', emoji: '☁️' },
                            ] as const).map((preset) => (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => {
                                  const presetFilters: Record<FilterPreset, SlideFilters> = {
                                    none: { brightness: 100, contrast: 100, saturation: 100, blur: 0, preset: 'none' },
                                    vivid: { brightness: 105, contrast: 115, saturation: 140, blur: 0, preset: 'vivid' },
                                    warm: { brightness: 105, contrast: 100, saturation: 110, blur: 0, preset: 'warm' },
                                    cool: { brightness: 100, contrast: 105, saturation: 90, blur: 0, preset: 'cool' },
                                    vintage: { brightness: 95, contrast: 90, saturation: 70, blur: 0, preset: 'vintage' },
                                    bw: { brightness: 100, contrast: 110, saturation: 0, blur: 0, preset: 'bw' },
                                    dramatic: { brightness: 90, contrast: 130, saturation: 120, blur: 0, preset: 'dramatic' },
                                    soft: { brightness: 105, contrast: 85, saturation: 95, blur: 1, preset: 'soft' },
                                  };
                                  updateSlide(slide.id, { filters: presetFilters[preset.key] });
                                }}
                                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all active:scale-95 ${
                                  slide.filters.preset === preset.key
                                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <span className="text-lg mb-1">{preset.emoji}</span>
                                <span className="truncate w-full text-center">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {slide.mediaType === 'video' && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">{language === 'ar' ? 'صوت المقطع' : 'Clip Audio'}</p>

                            <div className="flex items-center justify-between rounded-2xl p-3 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                              <span className="text-sm font-medium">
                                {language === 'ar' ? 'كتم' : 'Mute'}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSlide(slide.id, { clipMuted: !slide.clipMuted })}
                                title={language === 'ar' ? 'تبديل كتم الصوت' : 'Toggle mute'}
                                aria-label={language === 'ar' ? 'تبديل كتم الصوت' : 'Toggle mute'}
                                className={`w-12 h-6 rounded-full transition-all ${
                                  slide.clipMuted ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                  slide.clipMuted ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                              </button>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">🔊 {language === 'ar' ? 'مستوى الصوت' : 'Volume'}</span>
                                <span className="text-xs font-medium">{Math.round((slide.clipVolume ?? 1) * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round((slide.clipVolume ?? 1) * 100)}
                                onChange={(e) => updateSlide(slide.id, { clipVolume: Math.max(0, Math.min(1, parseInt(e.target.value) / 100)) })}
                                className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 cursor-pointer"
                                title={language === 'ar' ? 'مستوى صوت المقطع' : 'Clip volume'}
                              />
                            </div>
                          </div>
                        )}

                        {/* Manual Adjustments */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{language === 'ar' ? 'تعديل يدوي' : 'Manual Adjust'}</p>
                            <button
                              type="button"
                              className="text-xs underline text-muted-foreground"
                              onClick={() => updateSlide(slide.id, { filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, preset: 'none' } })}
                            >
                              {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">☀️ {language === 'ar' ? 'سطوع' : 'Bright'}</span>
                                <span className="text-xs font-medium">{slide.filters.brightness}%</span>
                              </div>
                              <input
                                type="range"
                                min="50"
                                max="150"
                                value={slide.filters.brightness}
                                onChange={(e) => updateSlide(slide.id, { filters: { ...slide.filters, brightness: parseInt(e.target.value), preset: 'none' } })}
                                className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-gray-800 to-white cursor-pointer"
                                title={language === 'ar' ? 'السطوع' : 'Brightness'}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">◐ {language === 'ar' ? 'تباين' : 'Contrast'}</span>
                                <span className="text-xs font-medium">{slide.filters.contrast}%</span>
                              </div>
                              <input
                                type="range"
                                min="50"
                                max="150"
                                value={slide.filters.contrast}
                                onChange={(e) => updateSlide(slide.id, { filters: { ...slide.filters, contrast: parseInt(e.target.value), preset: 'none' } })}
                                className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-gray-400 to-black cursor-pointer"
                                title={language === 'ar' ? 'التباين' : 'Contrast'}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">🎨 {language === 'ar' ? 'تشبع' : 'Saturation'}</span>
                                <span className="text-xs font-medium">{slide.filters.saturation}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="200"
                                value={slide.filters.saturation}
                                onChange={(e) => updateSlide(slide.id, { filters: { ...slide.filters, saturation: parseInt(e.target.value), preset: 'none' } })}
                                className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-gray-400 via-red-400 to-purple-500 cursor-pointer"
                                title={language === 'ar' ? 'التشبع' : 'Saturation'}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">💨 {language === 'ar' ? 'ضبابية' : 'Blur'}</span>
                                <span className="text-xs font-medium">{slide.filters.blur || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="10"
                                value={slide.filters.blur || 0}
                                onChange={(e) => updateSlide(slide.id, { filters: { ...slide.filters, blur: parseInt(e.target.value), preset: 'none' } })}
                                className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-blue-400 to-blue-100 cursor-pointer"
                                title={language === 'ar' ? 'الضبابية' : 'Blur'}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Apply to All */}
                        <button
                          type="button"
                          onClick={() => {
                            project.slides.forEach(s => updateSlide(s.id, { filters: { ...slide.filters } }));
                            toast.success(language === 'ar' ? 'تم تطبيق الفلتر على جميع الشرائح' : 'Filter applied to all slides');
                          }}
                          className="w-full h-10 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-all active:scale-95"
                        >
                          {language === 'ar' ? 'تطبيق على الكل' : 'Apply to All Slides'}
                        </button>
                      </div>
                    )}

                    {panel === 'motion' && (
                      <div className="space-y-4">
                        {/* Ken Burns Effect */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">{language === 'ar' ? 'حركة الصورة' : 'Image Motion'}</p>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { key: 'random', label: language === 'ar' ? 'عشوائي' : 'Random', emoji: '🎲' },
                              { key: 'zoom-in', label: language === 'ar' ? 'تكبير' : 'Zoom In', emoji: '🔍' },
                              { key: 'zoom-out', label: language === 'ar' ? 'تصغير' : 'Zoom Out', emoji: '🔎' },
                              { key: 'pan-left', label: language === 'ar' ? 'يسار' : 'Pan L', emoji: '⬅️' },
                              { key: 'pan-right', label: language === 'ar' ? 'يمين' : 'Pan R', emoji: '➡️' },
                              { key: 'pan-up', label: language === 'ar' ? 'أعلى' : 'Pan Up', emoji: '⬆️' },
                              { key: 'pan-down', label: language === 'ar' ? 'أسفل' : 'Pan Dn', emoji: '⬇️' },
                            ] as const).map((kb) => (
                              <button
                                key={kb.key}
                                type="button"
                                onClick={() => updateSlide(slide.id, { kenBurns: kb.key })}
                                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all active:scale-95 ${
                                  (slide.kenBurns || 'random') === kb.key
                                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <span className="text-base">{kb.emoji}</span>
                                <span className="truncate w-full text-center text-[10px]">{kb.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Transition Type */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">{language === 'ar' ? 'الانتقال' : 'Transition'}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { key: 'fade', label: language === 'ar' ? 'تلاشي' : 'Fade', emoji: '✨' },
                              { key: 'dissolve', label: language === 'ar' ? 'ذوبان' : 'Dissolve', emoji: '💫' },
                              { key: 'slide-left', label: language === 'ar' ? 'يسار' : 'Slide L', emoji: '⬅️' },
                              { key: 'slide-right', label: language === 'ar' ? 'يمين' : 'Slide R', emoji: '➡️' },
                              { key: 'zoom-in', label: language === 'ar' ? 'تكبير' : 'Zoom In', emoji: '🔍' },
                              { key: 'zoom-out', label: language === 'ar' ? 'تصغير' : 'Zoom Out', emoji: '🔎' },
                              { key: 'wipe-left', label: language === 'ar' ? 'مسح يسار' : 'Wipe L', emoji: '🧹' },
                              { key: 'wipe-right', label: language === 'ar' ? 'مسح يمين' : 'Wipe R', emoji: '🧽' },
                              { key: 'none', label: language === 'ar' ? 'بدون' : 'None', emoji: '⚪' },
                            ] as const).map((tr) => (
                              <button
                                key={tr.key}
                                type="button"
                                onClick={() => updateSlide(slide.id, { transition: tr.key })}
                                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all active:scale-95 ${
                                  slide.transition === tr.key
                                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <span className="text-base">{tr.emoji}</span>
                                <span className="truncate w-full text-center text-[10px]">{tr.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Apply to All */}
                        <button
                          type="button"
                          onClick={() => {
                            project.slides.forEach(s => updateSlide(s.id, { 
                              transition: slide.transition,
                              kenBurns: slide.kenBurns 
                            }));
                            toast.success(language === 'ar' ? 'تم تطبيق الإعدادات على جميع الشرائح' : 'Settings applied to all slides');
                          }}
                          className="w-full h-10 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-all active:scale-95"
                        >
                          {language === 'ar' ? 'تطبيق على الكل' : 'Apply to All Slides'}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          disabled={index === 0}
                          onClick={() => moveSlide(index, index - 1)}
                        >
                          <ChevronUp className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          disabled={index === project.slides.length - 1}
                          onClick={() => moveSlide(index, index + 1)}
                        >
                          <ChevronDown className="h-5 w-5" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="h-10 text-red-500 hover:text-red-600"
                        onClick={() => removeSlide(slide.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'حذف الشريحة' : 'Delete Slide'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Audio section */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {language === 'ar' ? 'الصوت' : 'Audio'}
        </p>
        
        {project.audio ? (
          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-sm truncate max-w-[200px]">{project.audio.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({project.audio.source === 'upload' 
                    ? (language === 'ar' ? 'مُحمل' : 'Uploaded')
                    : project.audio.source === 'music_gen'
                    ? (language === 'ar' ? 'موسيقى وقتي' : 'Wakti Music')
                    : (language === 'ar' ? 'صوت وقتي' : 'Wakti Voice')
                  })
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500"
                onClick={removeAudio}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Audio Trimmer */}
            {project.audio.duration && project.audio.duration > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'قص الصوت' : 'Trim Audio'} ({Math.floor(project.audio.duration)}s {language === 'ar' ? 'إجمالي' : 'total'})
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12">
                    {language === 'ar' ? 'بداية' : 'Start'}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={(project.audio.trimEnd || project.audio.duration) - 1}
                    value={project.audio.trimStart || 0}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setProject(prev => ({
                        ...prev,
                        audio: prev.audio ? { ...prev.audio, trimStart: val } : null
                      }));
                    }}
                    className="h-8 w-16"
                  />
                  <span className="text-xs">s</span>
                  <label className="text-xs text-muted-foreground w-12 ml-2">
                    {language === 'ar' ? 'نهاية' : 'End'}
                  </label>
                  <Input
                    type="number"
                    min={(project.audio.trimStart || 0) + 1}
                    max={project.audio.duration}
                    value={project.audio.trimEnd || Math.floor(project.audio.duration)}
                    onChange={(e) => {
                      const val = Math.min(project.audio.duration || 60, parseInt(e.target.value) || 0);
                      setProject(prev => ({
                        ...prev,
                        audio: prev.audio ? { ...prev.audio, trimEnd: val } : null
                      }));
                    }}
                    className="h-8 w-16"
                  />
                  <span className="text-xs">s</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'المدة المحددة:' : 'Selected duration:'} {((project.audio.trimEnd || project.audio.duration) - (project.audio.trimStart || 0)).toFixed(0)}s
                </p>
              </div>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Upload MP3 */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => audioInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {language === 'ar' ? `تحميل MP3 (حتى ${MAX_AUDIO_SIZE_MB}MB)` : `Upload MP3 (up to ${MAX_AUDIO_SIZE_MB}MB)`}
            </Button>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav"
              className="hidden"
              onChange={handleAudioUpload}
            />

            {/* Select from Wakti Music */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowAudioPicker(!showAudioPicker)}
            >
              <Music className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'اختر من موسيقى وقتي' : 'Select from Wakti Music'}
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showAudioPicker ? 'rotate-180' : ''}`} />
            </Button>

            {/* Saved tracks dropdown */}
            {showAudioPicker && (
              <Card className="p-2 max-h-48 overflow-y-auto">
                {loadingTracks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : savedTracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === 'ar' ? 'لا توجد مقاطع محفوظة' : 'No saved tracks'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {savedTracks.map((track) => (
                      <button
                        key={track.id}
                        className="w-full p-2 rounded hover:bg-muted text-left text-sm truncate"
                        onClick={() => selectSavedTrack(track)}
                      >
                        {track.name}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Go to Voice Studio */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/tools/voice-studio')}
            >
              <Mic className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إنشاء تعليق صوتي' : 'Generate Voiceover'}
            </Button>
          </div>
        )}
      </div>

      {/* Duration counter - moved to bottom */}
      <div className="enhanced-card rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {language === 'ar' ? 'المدة الإجمالية' : 'Total Duration'}
          </span>
        </div>
        <div className={`text-sm font-semibold ${totalDuration > MAX_DURATION_SEC ? 'text-red-500' : ''}`}>
          {totalDuration}s / {MAX_DURATION_SEC}s
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <Button 
          variant="outline"
          onClick={() => setStep('upload')}
        >
          {language === 'ar' ? 'السابق' : 'Back'}
        </Button>
        <Button 
          className="flex-1"
          disabled={!canGenerate}
          onClick={() => setStep('generate')}
        >
          {language === 'ar' ? 'التالي: إنشاء الفيديو' : 'Next: Generate Video'}
        </Button>
      </div>
    </div>
  );

  // Render generate step
  const renderGenerateStep = () => (
    <div className="space-y-4">
      {/* Preview summary */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'الشرائح' : 'Slides'}
            </span>
            <span className="font-medium">{project.slides.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'المدة' : 'Duration'}
            </span>
            <span className="font-medium">{totalDuration}s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'القالب' : 'Template'}
            </span>
            <span className="font-medium">
              {language === 'ar' ? TEMPLATES[project.template].nameAr : TEMPLATES[project.template].name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'الصوت' : 'Audio'}
            </span>
            <span className="font-medium">
              {project.audio 
                ? project.audio.name.slice(0, 20) + (project.audio.name.length > 20 ? '...' : '')
                : (language === 'ar' ? 'بدون صوت' : 'No audio')
              }
            </span>
          </div>
        </div>
      </Card>

      {/* Public toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {language === 'ar' ? 'فيديو عام' : 'Public Video'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'يمكن لأي شخص مشاهدته عبر الرابط'
                : 'Anyone can view via link'
              }
            </p>
          </div>
          <button
            className={`w-12 h-6 rounded-full transition-colors ${
              project.isPublic ? 'bg-primary' : 'bg-muted'
            }`}
            onClick={() => setProject(prev => ({ ...prev, isPublic: !prev.isPublic }))}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
              project.isPublic ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </Card>

      {/* Generate button / Progress */}
      {!isGenerating && !generatedVideoUrl && (
        <div className="space-y-2">
          <Button 
            className="w-full h-12 text-lg"
            onClick={handleGenerate}
          >
            <Play className="h-5 w-5 mr-2" />
            {language === 'ar' ? 'إنشاء الفيديو' : 'Generate Video'}
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => setStep('customize')}
          >
            {language === 'ar' ? 'السابق' : 'Back'}
          </Button>
        </div>
      )}

      {/* Generation progress */}
      {isGenerating && (
        <Card className="p-6">
          <div className="space-y-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">{generationStatus}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'يرجى الانتظار...' : 'Please wait...'}
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{generationProgress}%</p>
          </div>
        </Card>
      )}

      {/* Generated video result */}
      {generatedVideoUrl && (
        <div className="space-y-4">
          <Card className="p-4">
            <video 
              src={generatedVideoUrl} 
              controls 
              className="w-full rounded-lg"
              style={{ maxHeight: '400px' }}
            />
          </Card>

          {/* Save to Wakti */}
          {!savedVideoId && (
            <Button
              className="w-full"
              onClick={handleSaveVideo}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving 
                ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                : (language === 'ar' ? 'حفظ في وقتي' : 'Save to Wakti')
              }
            </Button>
          )}

          {/* Saved confirmation */}
          {savedVideoId && (
            <Card className="p-3 bg-green-500/10 border-green-500/30">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span className="font-medium">
                  {language === 'ar' ? 'تم الحفظ!' : 'Saved!'}
                </span>
                {project.isPublic && (
                  <button
                    className="ml-auto text-sm underline"
                    onClick={() => {
                      const url = `${window.location.origin}/video/${savedVideoId}`;
                      navigator.clipboard.writeText(url);
                      toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
                    }}
                  >
                    {language === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
                  </button>
                )}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'تنزيل' : 'Download'}
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'مشاركة' : 'Share'}
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleCreateNew}
          >
            {language === 'ar' ? 'إنشاء فيديو جديد' : 'Create New Video'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStep('customize')}
          >
            {language === 'ar' ? 'رجوع للتعديل' : 'Back to Customize'}
          </Button>
        </div>
      )}
    </div>
  );

  // Handle video generation with Canvas + Ken Burns + Transitions
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus(language === 'ar' ? 'جاري تحميل المحرك...' : 'Loading video engine...');

    try {
      // Build slides config for the new hook
      const slidesConfig = project.slides
        .filter(slide => slide.imageFile || slide.videoFile)
        .map(slide => {
          const config = {
            mediaType: slide.mediaType,
            imageFile: slide.imageFile as File | undefined,
            videoFile: slide.videoFile as File | undefined,
            clipMuted: !!slide.clipMuted,
            clipVolume: typeof slide.clipVolume === 'number' ? slide.clipVolume : 1,
            text: slide.text?.trim() || undefined,
            textPosition: slide.textPosition || 'bottom',
            textColor: slide.textColor || TEMPLATES[project.template].textColor,
            textSize: slide.textSize || 'medium',
            textAnimation: slide.textAnimation || 'fade-in',
            textFont: slide.textFont || 'system',
            textShadow: slide.textShadow !== false,
            durationSec: slide.durationSec,
            transition: slide.transition || 'fade',
            transitionDuration: slide.transitionDuration || 0.5,
            filters: slide.filters || { brightness: 100, contrast: 100, saturation: 100, blur: 0, preset: 'none' },
            kenBurns: slide.kenBurns || 'random',
            kenBurnsSpeed: slide.kenBurnsSpeed || 1,
          };
          console.log('[VideoMaker] Slide config:', { mediaType: config.mediaType, text: config.text, textPosition: config.textPosition, transition: config.transition });
          return config;
        });

      if (slidesConfig.length === 0) {
        throw new Error('No images to process');
      }

      // Generate video using Canvas + Ken Burns + Crossfade transitions
      const videoBlob = await generateVideo({
        slides: slidesConfig,
        audioUrl: project.audio?.url || null,
        audioTrimStart: project.audio?.trimStart || 0,
        audioTrimEnd: project.audio?.trimEnd,
        width: 1080,
        height: 1920,
        transitionDuration: 0.5,
      });

      if (!videoBlob) {
        throw new Error(canvasError || 'Video generation failed');
      }

      // Create object URL for preview
      const videoUrl = URL.createObjectURL(videoBlob);
      setGeneratedVideoUrl(videoUrl);
      setGeneratedVideoBlob(videoBlob);

      toast.success(language === 'ar' ? 'تم إنشاء الفيديو!' : 'Video created!');

    } catch (error) {
      console.error('Generation failed:', error);
      toast.error(language === 'ar' ? 'فشل إنشاء الفيديو' : 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save video to Supabase
  const handleSaveVideo = async () => {
    if (!user || !generatedVideoBlob) return;

    setIsSaving(true);
    try {
      let thumbnailPath: string | null = null;
      
      // Generate thumbnail from first slide image (more reliable than video extraction)
      try {
        const firstSlide = project.slides[0];
        if (firstSlide?.imageFile) {
          const img = new Image();
          const imgUrl = URL.createObjectURL(firstSlide.imageFile);
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = imgUrl;
          });
          
          const canvas = document.createElement('canvas');
          const maxSize = 400;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const thumb = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
            });
            
            if (thumb) {
              const thumbName = `${user.id}/thumbnails/${Date.now()}.jpg`;
              const { data: tData, error: tErr } = await supabase.storage
                .from('videos')
                .upload(thumbName, thumb, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600'
                });
              if (!tErr) thumbnailPath = tData?.path || null;
            }
          }
          
          URL.revokeObjectURL(imgUrl);
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation failed:', thumbErr);
        thumbnailPath = null;
      }

      // Upload video to storage - detect actual format from blob type
      const isWebm = generatedVideoBlob.type.includes('webm');
      const ext = isWebm ? 'webm' : 'mp4';
      const contentType = isWebm ? 'video/webm' : 'video/mp4';
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, generatedVideoBlob, {
          contentType,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      let finalPath = uploadData?.path || fileName;

      // If WebM on iOS, trigger server-side conversion
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      if (isWebm && isIOS && finalPath) {
        try {
          toast.info(language === 'ar' ? 'جاري تحويل الفيديو...' : 'Converting video for iOS...');
          const { data: convData, error: convErr } = await supabase.functions.invoke('convert-webm-to-mp4', {
            body: { storagePath: finalPath, bucket: 'videos' }
          });
          if (!convErr && convData?.storagePath) {
            finalPath = convData.storagePath;
          }
        } catch (convE) {
          console.warn('[VideoMaker] Server conversion failed, using WebM:', convE);
        }
      }

      // Save metadata to database (cast to any to bypass type checking for new table)
      const { data: videoData, error: dbError } = await (supabase as any)
        .from('user_videos')
        .insert({
          user_id: user.id,
          title: project.title || null,
          thumbnail_url: thumbnailPath,
          storage_path: finalPath,
          duration_seconds: totalDuration,
          aspect_ratio: '9:16',
          style_template: project.template,
          is_public: project.isPublic,
          slides: project.slides.map(s => ({
            text: s.text,
            textPosition: s.textPosition,
            durationSec: s.durationSec
          })),
          audio_source: project.audio?.source || null,
          audio_track_id: project.audio?.source === 'music_gen' ? project.audio.id : null
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      setSavedVideoId((videoData as any).id);
      toast.success(language === 'ar' ? 'تم حفظ الفيديو!' : 'Video saved!');

      // If public, show share link
      if (project.isPublic) {
        const shareUrl = `${window.location.origin}/video/${(videoData as any).id}`;
        toast.info(
          language === 'ar' ? `رابط المشاركة: ${shareUrl}` : `Share link: ${shareUrl}`,
          { duration: 5000 }
        );
      }

    } catch (error) {
      console.error('Save failed:', error);
      toast.error(language === 'ar' ? 'فشل حفظ الفيديو' : 'Failed to save video');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!generatedVideoUrl) return;
    const a = document.createElement('a');
    a.href = generatedVideoUrl;
    a.download = `${project.title || 'wakti-video'}.mp4`;
    a.click();
  };

  const handleShare = async () => {
    if (!generatedVideoUrl) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title || 'Wakti Video',
          url: generatedVideoUrl
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      // Copy to clipboard
      await navigator.clipboard.writeText(generatedVideoUrl);
      toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
    }
  };

  const handleCreateNew = () => {
    setProject({
      slides: [],
      audio: null,
      template: 'dark-glow',
      title: '',
      isPublic: false
    });
    setGeneratedVideoUrl(null);
    setStep('upload');
  };

  // Progress indicator
  const steps = [
    { key: 'upload', label: language === 'ar' ? 'تحميل' : 'Upload', icon: Upload },
    { key: 'customize', label: language === 'ar' ? 'تخصيص' : 'Customize', icon: Palette },
    { key: 'generate', label: language === 'ar' ? 'إنشاء' : 'Generate', icon: Play }
  ];

  const renderSavedTab = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'فيديوهاتي' : 'My Videos'}
          {savedVideos.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({savedVideos.length})
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={loadSavedVideos} 
            disabled={loadingVideos}
          >
            {loadingVideos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={() => { setActiveTab('create'); setStep('upload'); }}>
            <Plus className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'جديد' : 'New'}
          </Button>
        </div>
      </div>

      {loadingVideos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : savedVideos.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                {language === 'ar' ? 'لا توجد فيديوهات بعد' : 'No videos yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'ar' ? 'أنشئ أول فيديو لك!' : 'Create your first video!'}
              </p>
            </div>
            <Button onClick={() => { setActiveTab('create'); setStep('upload'); }} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إنشاء فيديو' : 'Create Video'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {savedVideos.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="flex gap-3 p-3">
                {/* Thumbnail */}
                <button
                  className="w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 shrink-0 relative group"
                  onClick={() => setActivePreviewId((prev) => (prev === v.id ? null : v.id))}
                >
                  {v.thumbnailSignedUrl ? (
                    <img
                      src={v.thumbnailSignedUrl}
                      alt={v.title || 'Video'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                  {!!v.duration_seconds && (
                    <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-medium">
                      {formatDuration(v.duration_seconds)}
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-medium truncate">
                      {v.title || (language === 'ar' ? 'بدون عنوان' : 'Untitled')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(v.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        v.is_public 
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {v.is_public ? (language === 'ar' ? 'عام' : 'Public') : (language === 'ar' ? 'خاص' : 'Private')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => handleTogglePublic(v)}
                    >
                      {v.is_public ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <button
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                      onClick={() => handleShareSavedVideo(v)}
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleDeleteSavedVideo(v)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded video player */}
              {activePreviewId === v.id && v.signedUrl && (
                <VideoPlayer 
                  url={v.signedUrl} 
                  language={language}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setPendingDeleteVideo(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف الفيديو؟' : 'Delete video?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? 'لا يمكن التراجع عن هذا الإجراء.'
                : "This action can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteSavedVideo}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-3 md:p-6 pb-20 md:pb-6">
      <div className="relative space-y-4">
        <div className="pointer-events-none absolute -inset-2 rounded-[2rem] opacity-60 blur-2xl bg-[var(--gradient-warm)] dark:opacity-0" />
        <div className="pointer-events-none absolute -inset-2 rounded-[2rem] opacity-0 blur-2xl bg-[var(--gradient-vibrant)] dark:opacity-25" />

        <div className="enhanced-card rounded-[2rem] p-4 md:p-6 shadow-[var(--shadow-vibrant)]">
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {language === 'ar' ? 'صانع الفيديو' : 'Video Maker'}
            </h1>
            <div />
          </div>

          {/* Tab switcher */}
          <div className="mt-4 rounded-2xl p-2 flex gap-2 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                activeTab === 'create'
                  ? 'btn-enhanced text-white border-transparent shadow-[var(--glow-primary)]'
                  : 'bg-white/10 border-border/60 hover:bg-white/15'
              }`}
            >
              {language === 'ar' ? 'إنشاء' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex-1 h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                activeTab === 'saved'
                  ? 'btn-enhanced text-white border-transparent shadow-[var(--glow-primary)]'
                  : 'bg-white/10 border-border/60 hover:bg-white/15'
              }`}
            >
              {language === 'ar' ? 'فيديوهاتي' : 'My Videos'}
            </button>
          </div>

          <div className="mt-4">
            {activeTab === 'saved' ? (
              renderSavedTab()
            ) : (
              <>
                {/* Step indicator */}
                <Card className="enhanced-card rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-xl dark:bg-black/20">
                  <div className="flex items-center justify-between">
                    {steps.map((s, i) => (
                      <React.Fragment key={s.key}>
                        <div className="flex flex-col items-center gap-2 min-w-[72px]">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                            step === s.key
                              ? 'btn-enhanced text-white shadow-[var(--glow-primary)]'
                              : steps.findIndex(x => x.key === step) > i
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted/60 text-muted-foreground'
                          }`}>
                            <s.icon className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-1 mx-2 rounded-full ${
                            steps.findIndex(x => x.key === step) > i ? 'bg-primary/60' : 'bg-muted/60'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </Card>

                {/* Step content */}
                <div className="mt-4">
                  {step === 'upload' && renderUploadStep()}
                  {step === 'customize' && renderCustomizeStep()}
                  {step === 'generate' && renderGenerateStep()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
