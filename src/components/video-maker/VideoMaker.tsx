import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Clock,
  AlertCircle,
  Loader2,
  Check,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFFmpegVideo } from '@/hooks/useFFmpegVideo';

// Types
interface Slide {
  id: string;
  imageUrl: string;
  imageFile?: File;
  text: string;
  textPosition: 'top' | 'center' | 'bottom';
  textColor: string;
  durationSec: number;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  source: 'upload' | 'music_gen' | 'tts';
}

type TemplateStyle = 'dark-glow' | 'warm-minimal' | 'vibrant-gradient';

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
  }
};

const MAX_SLIDES = 10;
const MIN_SLIDES = 2;
const MAX_DURATION_SEC = 60;
const MAX_AUDIO_SIZE_MB = 10;

export default function VideoMaker() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Project state
  const [project, setProject] = useState<VideoProject>({
    slides: [],
    audio: null,
    template: 'dark-glow',
    title: '',
    isPublic: false
  });

  // FFmpeg hook
  const { loadFFmpeg, generateVideo, isLoading: ffmpegLoading, isReady: ffmpegReady } = useFFmpegVideo();

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

  // Calculate total duration
  const totalDuration = project.slides.reduce((sum, s) => sum + s.durationSec, 0);
  const remainingDuration = MAX_DURATION_SEC - totalDuration;

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

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newSlides: Slide[] = [];
    const maxToAdd = MAX_SLIDES - project.slides.length;

    Array.from(files).slice(0, maxToAdd).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const url = URL.createObjectURL(file);
      newSlides.push({
        id: crypto.randomUUID(),
        imageUrl: url,
        imageFile: file,
        text: '',
        textPosition: 'bottom',
        textColor: TEMPLATES[project.template].textColor,
        durationSec: Math.min(3, remainingDuration / (maxToAdd || 1))
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
    setProject(prev => ({
      ...prev,
      audio: {
        id: crypto.randomUUID(),
        name: file.name,
        url,
        source: 'upload'
      }
    }));
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
    setProject(prev => ({ ...prev, audio: track }));
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
      {/* Device disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {language === 'ar' 
            ? 'يعمل بشكل أفضل على iPhone 11+ / Android 2020+'
            : 'Works best on iPhone 11+ / Android 2020+'
          }
        </p>
      </div>

      {/* Upload area */}
      <Card 
        className="p-6 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {language === 'ar' ? 'اضغط لتحميل الصور' : 'Tap to upload images'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? `${MIN_SLIDES}-${MAX_SLIDES} صور • PNG, JPG, WebP`
                : `${MIN_SLIDES}-${MAX_SLIDES} images • PNG, JPG, WebP`
              }
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageUpload}
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
                <img 
                  src={slide.imageUrl} 
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                />
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proceed button */}
      {canProceedToCustomize && (
        <Button 
          className="w-full"
          onClick={() => setStep('customize')}
        >
          {language === 'ar' ? 'التالي: تخصيص' : 'Next: Customize'}
        </Button>
      )}
    </div>
  );

  // Render customize step
  const renderCustomizeStep = () => (
    <div className="space-y-4">
      {/* Duration counter */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {language === 'ar' ? 'المدة الإجمالية' : 'Total Duration'}
          </span>
        </div>
        <div className={`text-sm font-medium ${totalDuration > MAX_DURATION_SEC ? 'text-red-500' : ''}`}>
          {totalDuration}s / {MAX_DURATION_SEC}s
        </div>
      </div>

      {/* Template picker */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {language === 'ar' ? 'اختر القالب' : 'Choose Template'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TEMPLATES) as [TemplateStyle, typeof TEMPLATES[TemplateStyle]][]).map(([key, template]) => (
            <button
              key={key}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                project.template === key 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setProject(prev => ({ ...prev, template: key }))}
            >
              <div 
                className="h-16 rounded-md mb-2"
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
        <div className="space-y-2">
          {project.slides.map((slide, index) => (
            <Card key={slide.id} className="p-3">
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="w-16 h-24 rounded overflow-hidden bg-muted shrink-0">
                  <img 
                    src={slide.imageUrl} 
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-2">
                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-16">
                      {language === 'ar' ? 'المدة' : 'Duration'}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={slide.durationSec}
                      onChange={(e) => updateSlide(slide.id, { durationSec: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">s</span>
                  </div>

                  {/* Text */}
                  <div className="flex items-start gap-2">
                    <label className="text-xs text-muted-foreground w-16 pt-2">
                      {language === 'ar' ? 'النص' : 'Text'}
                    </label>
                    <Textarea
                      value={slide.text}
                      onChange={(e) => updateSlide(slide.id, { text: e.target.value })}
                      placeholder={language === 'ar' ? 'أضف نص (اختياري)' : 'Add text (optional)'}
                      className="h-16 text-sm resize-none"
                    />
                  </div>

                  {/* Text position */}
                  {slide.text && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-16">
                        {language === 'ar' ? 'الموضع' : 'Position'}
                      </label>
                      <div className="flex gap-1">
                        {(['top', 'center', 'bottom'] as const).map((pos) => (
                          <Button
                            key={pos}
                            variant={slide.textPosition === pos ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateSlide(slide.id, { textPosition: pos })}
                          >
                            {pos === 'top' ? (language === 'ar' ? 'أعلى' : 'Top') :
                             pos === 'center' ? (language === 'ar' ? 'وسط' : 'Center') :
                             (language === 'ar' ? 'أسفل' : 'Bottom')}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reorder / Delete */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, index - 1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === project.slides.length - 1}
                    onClick={() => moveSlide(index, index + 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => removeSlide(slide.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Audio section */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {language === 'ar' ? 'الصوت' : 'Audio'}
        </p>
        
        {project.audio ? (
          <Card className="p-3">
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

      {/* Title */}
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
        </div>
      )}
    </div>
  );

  // Handle video generation with FFmpeg.wasm
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus(language === 'ar' ? 'جاري تحميل المحرك...' : 'Loading video engine...');

    try {
      // Load FFmpeg if not ready
      if (!ffmpegReady) {
        const loaded = await loadFFmpeg();
        if (!loaded) {
          throw new Error('Failed to load video engine');
        }
      }

      // Generate video
      const videoBlob = await generateVideo({
        slides: project.slides,
        audioUrl: project.audio?.url,
        template: TEMPLATES[project.template],
        aspectRatio: '9:16',
        onProgress: (progress, status) => {
          setGenerationProgress(progress);
          // Translate status messages
          if (status.includes('Processing images')) {
            setGenerationStatus(language === 'ar' ? 'جاري معالجة الصور...' : status);
          } else if (status.includes('Creating video')) {
            setGenerationStatus(language === 'ar' ? 'جاري إنشاء الفيديو...' : status);
          } else if (status.includes('Finalizing')) {
            setGenerationStatus(language === 'ar' ? 'جاري الإنهاء...' : status);
          } else if (status.includes('Complete')) {
            setGenerationStatus(language === 'ar' ? 'اكتمل!' : status);
          } else {
            setGenerationStatus(language === 'ar' ? 'جاري المعالجة...' : status);
          }
        }
      });

      if (!videoBlob) {
        throw new Error('Video generation failed');
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
      // Upload video to storage
      const fileName = `${user.id}/${Date.now()}.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, generatedVideoBlob, {
          contentType: 'video/mp4',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Save metadata to database (cast to any to bypass type checking for new table)
      const { data: videoData, error: dbError } = await (supabase as any)
        .from('user_videos')
        .insert({
          user_id: user.id,
          title: project.title || null,
          storage_path: uploadData.path,
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

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                step === s.key 
                  ? 'bg-primary text-primary-foreground' 
                  : steps.findIndex(x => x.key === step) > i
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <s.icon className="h-5 w-5" />
              </div>
              <span className="text-xs">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                steps.findIndex(x => x.key === step) > i ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {step === 'upload' && renderUploadStep()}
      {step === 'customize' && renderCustomizeStep()}
      {step === 'generate' && renderGenerateStep()}
    </div>
  );
}
