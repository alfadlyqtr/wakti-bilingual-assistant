import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, Download, Loader2, Volume2, Mic, Info, Languages, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import EnhancedAudioControls from '@/components/tasjeel/EnhancedAudioControls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
}

interface VoiceCloneScreen3Props {
  onBack: () => void;
}

// Enhanced voice style configurations with corrected style values for eleven_multilingual_v2
const VOICE_STYLES = {
  neutral: {
    name: { en: 'Neutral', ar: 'عادي' },
    description: { en: 'Balanced, natural conversational tone', ar: 'نبرة محادثة طبيعية ومتوازنة' },
    technicalDesc: { en: 'Moderate stability & similarity', ar: 'ثبات واعتدال متوسط' },
    icon: '💬',
    settings: { stability: 0.7, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true }
  },
  report: {
    name: { en: 'News Report', ar: 'تقرير إخباري' },
    description: { en: 'Professional, clear news reporting style', ar: 'أسلوب التقارير الإخبارية المهنية والواضحة' },
    technicalDesc: { en: 'Authoritative & clear delivery', ar: 'إلقاء موثوق وواضح' },
    icon: '📰',
    settings: { stability: 0.8, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true }
  },
  storytelling: {
    name: { en: 'Storytelling', ar: 'سرد القصص' },
    description: { en: 'Dramatic, engaging narrative voice with emotion', ar: 'صوت سردي درامي وجذاب مع العاطفة' },
    technicalDesc: { en: 'Expressive & engaging delivery', ar: 'إلقاء معبر وجذاب' },
    icon: '📚',
    settings: { stability: 0.5, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true }
  },
  poetry: {
    name: { en: 'Poetry', ar: 'شعر' },
    description: { en: 'Highly expressive, artistic poetic delivery', ar: 'إلقاء شعري فني معبر للغاية' },
    technicalDesc: { en: 'Very expressive & artistic', ar: 'معبر وفني للغاية' },
    icon: '🎭',
    settings: { stability: 0.4, similarity_boost: 0.6, style: 0.7, use_speaker_boost: true }
  },
  teacher: {
    name: { en: 'Teacher', ar: 'معلم' },
    description: { en: 'Clear, authoritative educational presentation', ar: 'عرض تعليمي واضح وموثوق' },
    technicalDesc: { en: 'Firm & instructive delivery', ar: 'إلقاء حازم وتعليمي' },
    icon: '👨‍🏫',
    settings: { stability: 0.8, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true }
  },
  sports: {
    name: { en: 'Sports Announcer', ar: 'معلق رياضي' },
    description: { en: 'Dynamic, energetic sports commentary', ar: 'تعليق رياضي ديناميكي ونشيط' },
    technicalDesc: { en: 'Intense & energetic delivery', ar: 'إلقاء مكثف ونشيط' },
    icon: '🏆',
    settings: { stability: 0.3, similarity_boost: 0.5, style: 0.8, use_speaker_boost: true }
  }
};

// Complete ElevenLabs Multilingual v2 supported languages (29 languages)
const TRANSLATION_LANGUAGES = [
  { code: 'en', name: { en: 'English', ar: 'الإنجليزية' } },
  { code: 'ar', name: { en: 'Arabic', ar: 'العربية' } },
  { code: 'bg', name: { en: 'Bulgarian', ar: 'البلغارية' } },
  { code: 'zh', name: { en: 'Chinese', ar: 'الصينية' } },
  { code: 'cs', name: { en: 'Czech', ar: 'التشيكية' } },
  { code: 'da', name: { en: 'Danish', ar: 'الدنماركية' } },
  { code: 'nl', name: { en: 'Dutch', ar: 'الهولندية' } },
  { code: 'fi', name: { en: 'Finnish', ar: 'الفنلندية' } },
  { code: 'fr', name: { en: 'French', ar: 'الفرنسية' } },
  { code: 'de', name: { en: 'German', ar: 'الألمانية' } },
  { code: 'el', name: { en: 'Greek', ar: 'اليونانية' } },
  { code: 'he', name: { en: 'Hebrew', ar: 'العبرية' } },
  { code: 'hi', name: { en: 'Hindi', ar: 'الهندية' } },
  { code: 'hu', name: { en: 'Hungarian', ar: 'المجرية' } },
  { code: 'id', name: { en: 'Indonesian', ar: 'الإندونيسية' } },
  { code: 'it', name: { en: 'Italian', ar: 'الإيطالية' } },
  { code: 'ja', name: { en: 'Japanese', ar: 'اليابانية' } },
  { code: 'ko', name: { en: 'Korean', ar: 'الكورية' } },
  { code: 'no', name: { en: 'Norwegian', ar: 'النرويجية' } },
  { code: 'pl', name: { en: 'Polish', ar: 'البولندية' } },
  { code: 'pt', name: { en: 'Portuguese', ar: 'البرتغالية' } },
  { code: 'ro', name: { en: 'Romanian', ar: 'الرومانية' } },
  { code: 'ru', name: { en: 'Russian', ar: 'الروسية' } },
  { code: 'es', name: { en: 'Spanish', ar: 'الإسبانية' } },
  { code: 'sv', name: { en: 'Swedish', ar: 'السويدية' } },
  { code: 'th', name: { en: 'Thai', ar: 'التايلاندية' } },
  { code: 'tr', name: { en: 'Turkish', ar: 'التركية' } },
  { code: 'uk', name: { en: 'Ukrainian', ar: 'الأوكرانية' } },
  { code: 'vi', name: { en: 'Vietnamese', ar: 'الفيتنامية' } }
];

export function VoiceCloneScreen3({ onBack }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('neutral');
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStyleDetails, setShowStyleDetails] = useState(false);
  const [isDeletingVoice, setIsDeletingVoice] = useState<string | null>(null);

  // Translation states
  const [translationText, setTranslationText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ar');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Use the extended quota management hook to get voice quota data
  const { 
    userVoiceQuota, 
    isLoadingVoiceQuota, 
    loadUserVoiceQuota,
    totalAvailableCharacters,
    canUseVoice 
  } = useExtendedQuotaManagement(language);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load voices
      const { data: voicesData, error: voicesError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .order('created_at', { ascending: false });

      if (voicesError) throw voicesError;
      setVoices(voicesData || []);
      
      if (voicesData && voicesData.length > 0) {
        setSelectedVoiceId(voicesData[0].voice_id);
      }

      // Load voice quota using the hook
      await loadUserVoiceQuota();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteVoiceClone = async (voiceId: string, voiceName: string) => {
    setIsDeletingVoice(voiceId);
    
    try {
      console.log('🗑️ === Voice Deletion Request ===');
      console.log('🗑️ Voice ID:', voiceId);
      console.log('🗑️ Voice Name:', voiceName);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

      // Call edge function to delete voice from ElevenLabs and database
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-clone`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          voice_id: voiceId,
          action: 'delete'
        })
      });

      console.log('🗑️ Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🗑️ Delete response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('🗑️ Delete result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete voice');
      }

      // Update local state
      setVoices(prev => prev.filter(voice => voice.voice_id !== voiceId));
      
      // If deleted voice was selected, clear selection
      if (selectedVoiceId === voiceId) {
        setSelectedVoiceId('');
        setAudioUrl(null);
      }

      toast.success(language === 'ar' 
        ? `تم حذف الصوت "${voiceName}" بنجاح` 
        : `Voice "${voiceName}" deleted successfully`
      );

    } catch (error: any) {
      console.error('🗑️ Error deleting voice:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في حذف الصوت' : 'Failed to delete voice'));
    } finally {
      setIsDeletingVoice(null);
    }
  };

  const canGenerate = text.trim().length > 0 && selectedVoiceId && text.length <= totalAvailableCharacters && canUseVoice;
  const canTranslate = translationText.trim().length > 0;

  const generateSpeech = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const selectedStyleConfig = VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES];
      
      console.log('🎵 === Frontend TTS Request (Updated) ===');
      console.log('🎵 Text length:', text.trim().length);
      console.log('🎵 Voice ID:', selectedVoiceId);
      console.log('🎵 Style:', selectedStyle);
      console.log('🎵 Style config:', selectedStyleConfig);
      console.log('🎵 Settings to be applied:', selectedStyleConfig.settings);
      console.log('🎵 Model: eleven_multilingual_v2');

      // Show user what style is being applied
      toast.info(`${language === 'ar' ? 'تطبيق أسلوب' : 'Applying style'}: ${selectedStyleConfig.name[language]} (${selectedStyleConfig.technicalDesc[language]})`);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

      // Make direct fetch call to the edge function with corrected style parameter
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: selectedVoiceId,
          style: selectedStyle,
        })
      });

      console.log('🎵 Frontend response status:', response.status);
      console.log('🎵 Frontend response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎵 Frontend response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      console.log('🎵 Frontend Content-Type:', contentType);

      let audioBlob: Blob;

      if (contentType?.includes('application/json')) {
        // Response is JSON - might contain base64 encoded audio or error
        const jsonData = await response.json();
        console.log('🎵 Frontend JSON response received:', Object.keys(jsonData));
        
        if (jsonData.error) {
          throw new Error(jsonData.error);
        }
        
        if (jsonData.audioContent) {
          // Base64 encoded audio
          console.log('🎵 Frontend converting base64 to blob...');
          const binaryString = atob(jsonData.audioContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        } else {
          throw new Error('No audio content in response');
        }
      } else if (contentType?.includes('audio/mpeg')) {
        // Response is audio data
        console.log('🎵 Frontend processing audio response...');
        const arrayBuffer = await response.arrayBuffer();
        console.log('🎵 Frontend audio buffer size:', arrayBuffer.byteLength);
        audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      } else {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      console.log('🎵 Frontend final blob size:', audioBlob.size);
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data');
      }

      const url = URL.createObjectURL(audioBlob);
      console.log('🎵 Frontend created object URL:', url);
      setAudioUrl(url);

      // Reload voice quota after successful generation
      await loadUserVoiceQuota();

      toast.success(`${language === 'ar' ? 'تم إنشاء الصوت بنجاح بأسلوب' : 'Speech generated successfully with'} ${selectedStyleConfig.name[language]} ${language === 'ar' ? '' : 'style'}`);

    } catch (error: any) {
      console.error('🎵 Frontend error generating speech:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const translateText = async () => {
    if (!canTranslate) return;

    setIsTranslating(true);
    setTranslatedText('');

    try {
      console.log('🌐 === Translation Request ===');
      console.log('🌐 Text:', translationText);
      console.log('🌐 Target Language:', targetLanguage);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-clone-translator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          original_text: translationText.trim(),
          target_language: targetLanguage
        })
      });

      console.log('🌐 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🌐 Response error:', errorText);
        throw new Error(`Translation failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🌐 Translation result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Translation failed');
      }

      setTranslatedText(result.translated_text);
      
      // Automatically populate the main TTS text area
      setText(result.translated_text);
      
      toast.success(language === 'ar' ? 'تمت الترجمة بنجاح وتم نسخها إلى منطقة النص!' : 'Translation completed and copied to text area!');

    } catch (error: any) {
      console.error('🌐 Translation error:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في الترجمة' : 'Translation failed'));
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!translatedText) return;
    
    try {
      await navigator.clipboard.writeText(translatedText);
      toast.success(language === 'ar' ? 'تم نسخ النص المترجم!' : 'Translated text copied!');
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      console.log('🎵 Downloading audio from URL:', audioUrl);
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'voice-output.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading || isLoadingVoiceQuota) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <Volume2 className="h-12 w-12 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'لا توجد أصوات' : 'No Voices Available'}
        </h3>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'يجب إنشاء صوت أولاً لاستخدام هذه الميزة' 
            : 'You need to create a voice first to use this feature'
          }
        </p>
        <Button onClick={onBack}>
          {language === 'ar' ? 'رجوع' : 'Go Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'استوديو الصوت' : 'Voice Studio'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'أنشئ كلام أو ترجم النصوص بصوتك المستنسخ' : 'Generate speech or translate text with your cloned voice'}
        </p>
      </div>

      {/* Character Usage - Updated to use totalAvailableCharacters */}
      <div className="p-3 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
            {language === 'ar' ? 'الأحرف المتبقية' : 'Characters Remaining'}
          </span>
          <span className="text-sm">
            {totalAvailableCharacters.toLocaleString()} / {(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-2 mt-2">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ 
              width: `${Math.max(0, Math.min(100, ((userVoiceQuota.characters_used) / (userVoiceQuota.characters_limit + userVoiceQuota.extra_characters)) * 100))}%` 
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">
            {language === 'ar' 
              ? `لديك ${totalAvailableCharacters.toLocaleString()} حرف متبقي من أصل ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`
              : `You have ${totalAvailableCharacters.toLocaleString()} characters left out of ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`
            }
          </p>
          {userVoiceQuota.extra_characters > 0 && (
            <span className="text-xs text-green-600 font-medium">
              +{userVoiceQuota.extra_characters.toLocaleString()} {language === 'ar' ? 'إضافي' : 'extra'}
            </span>
          )}
        </div>
      </div>

      {/* Voice Selector with Delete Functionality */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'اختر الصوت' : 'Select Voice'}
        </label>
        <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
          <SelectTrigger>
            <SelectValue placeholder={language === 'ar' ? 'اختر صوت' : 'Choose a voice'} />
          </SelectTrigger>
          <SelectContent>
            {voices.map((voice) => (
              <SelectItem key={voice.id} value={voice.voice_id}>
                <div className="flex items-center justify-between w-full">
                  <span>{voice.voice_name}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                        disabled={isDeletingVoice === voice.voice_id}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDeletingVoice === voice.voice_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {language === 'ar' ? 'حذف الصوت المستنسخ' : 'Delete Voice Clone'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {language === 'ar' 
                            ? `هل أنت متأكد من حذف الصوت "${voice.voice_name}"؟ هذا الإجراء لا يمكن التراجع عنه.`
                            : `Are you sure you want to delete the voice "${voice.voice_name}"? This action cannot be undone.`
                          }
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteVoiceClone(voice.voice_id, voice.voice_name)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {language === 'ar' ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick Translator Section - ABOVE main TTS */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            {language === 'ar' ? 'مترجم سريع' : 'Quick Translator'}
          </h3>
        </div>

        {/* Target Language Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {language === 'ar' ? 'ترجم إلى' : 'Translate to'}
          </label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Text Input - Using totalAvailableCharacters instead of hardcoded 6000 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {language === 'ar' ? 'النص للترجمة' : 'Text to Translate'}
          </label>
          <Textarea
            value={translationText}
            onChange={(e) => setTranslationText(e.target.value)}
            placeholder={language === 'ar' 
              ? 'اكتب ما تريد ترجمته بأي لغة...'
              : 'Type whatever you want to translate in any language...'
            }
            className="min-h-20 resize-none"
            dir="auto"
            maxLength={totalAvailableCharacters}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{translationText.length} / {totalAvailableCharacters} {language === 'ar' ? 'حرف' : 'characters'}</span>
          </div>
        </div>

        {/* Translate Button */}
        <Button
          onClick={translateText}
          disabled={!canTranslate || isTranslating}
          className="w-full"
        >
          {isTranslating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === 'ar' ? 'جاري الترجمة...' : 'Translating...'}
            </>
          ) : (
            <>
              <Languages className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'ترجم' : 'Translate'}
            </>
          )}
        </Button>

        {/* Translation Results */}
        {translatedText && (
          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {language === 'ar' ? 'النص المترجم:' : 'Translated Text:'}
            </div>
            <div className="text-sm font-medium mb-3" dir="auto">{translatedText}</div>
            
            {/* Copy Button */}
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'نسخ النص المترجم' : 'Copy Translated Text'}
            </Button>
          </div>
        )}
      </div>

      {/* Enhanced Voice Style Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">
            {language === 'ar' ? 'أسلوب الصوت' : 'Voice Style'}
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStyleDetails(!showStyleDetails)}
            className="h-auto p-1"
          >
            <Info className="h-3 w-3" />
          </Button>
        </div>
        
        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(VOICE_STYLES).map(([key, style]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span>{style.icon}</span>
                  <div className="flex flex-col">
                    <span className="font-medium">{style.name[language]}</span>
                    <span className="text-xs text-muted-foreground">{style.description[language]}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>{VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].description[language]}</p>
          {showStyleDetails && (
            <div className="bg-muted/50 p-2 rounded text-xs">
              <p className="font-medium mb-1">{language === 'ar' ? 'الإعدادات التقنية:' : 'Technical Settings:'}</p>
              <p>{VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].technicalDesc[language]}</p>
              <div className="mt-1 font-mono text-xs">
                {JSON.stringify(VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].settings, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text Input with Arabic support - Updated to use totalAvailableCharacters consistently */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'النص' : 'Text'}
        </label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={language === 'ar' 
            ? 'اكتب ما تريد سماعه بأي لغة... سيتم إنتاجه بصوتك المستنسخ وبأساليب متنوعة!'
            : 'Type whatever you want in any language to speak it in your voice and in many styles!'
          }
          className="min-h-32 resize-none"
          maxLength={totalAvailableCharacters}
          dir="auto"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{text.length} / {totalAvailableCharacters}</span>
          {text.length > totalAvailableCharacters && (
            <span className="text-red-500">
              {language === 'ar' ? 'تجاوز الحد المسموح' : 'Exceeds limit'}
            </span>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={generateSpeech}
        disabled={!canGenerate || isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 mr-2" />
            {language === 'ar' ? `تحدث بأسلوب ${VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]}` : `Speak with ${VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]} Style`}
          </>
        )}
      </Button>

      {/* Enhanced Audio Player */}
      {audioUrl && (
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {language === 'ar' ? 'الصوت المُنشأ' : 'Generated Audio'}
            </h3>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'أسلوب:' : 'Style:'} {VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]}
            </div>
          </div>
          
          <EnhancedAudioControls
            audioUrl={audioUrl}
            labels={{
              play: language === 'ar' ? 'تشغيل' : 'Play',
              pause: language === 'ar' ? 'إيقاف مؤقت' : 'Pause',
              rewind: language === 'ar' ? 'إرجاع' : 'Rewind',
              stop: language === 'ar' ? 'إيقاف' : 'Stop',
              error: language === 'ar' ? 'خطأ في تشغيل الصوت' : 'Error playing audio'
            }}
          />
          
          <div className="flex gap-2 justify-center">
            <Button onClick={downloadAudio} variant="outline" size="sm">
              <Download className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'تحميل' : 'Download'}
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
