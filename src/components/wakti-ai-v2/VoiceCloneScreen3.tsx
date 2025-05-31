
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Loader2, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
}

interface VoiceUsage {
  characters_used: number;
  characters_limit: number;
}

interface VoiceCloneScreen3Props {
  onBack: () => void;
}

export function VoiceCloneScreen3({ onBack }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [usage, setUsage] = useState<VoiceUsage>({ characters_used: 0, characters_limit: 5000 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Load usage
      const { data: usageData, error: usageError } = await supabase
        .from('user_voice_usage')
        .select('*')
        .single();

      if (usageData) {
        setUsage(usageData);
      } else if (usageError && !usageError.message.includes('No rows')) {
        throw usageError;
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const remainingCharacters = usage.characters_limit - usage.characters_used;
  const canGenerate = text.trim().length > 0 && selectedVoiceId && text.length <= remainingCharacters;

  const generateSpeech = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const response = await supabase.functions.invoke('voice-tts', {
        body: {
          text: text.trim(),
          voice_id: selectedVoiceId,
        }
      });

      if (response.error) throw response.error;

      // The response.data should be a blob for audio
      const audioBlob = response.data;
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Update usage
      setUsage(prev => ({
        ...prev,
        characters_used: prev.characters_used + text.trim().length
      }));

      toast({
        title: language === 'ar' ? 'نجح!' : 'Success!',
        description: language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Speech generated successfully',
      });

    } catch (error: any) {
      console.error('Error generating speech:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'voice-output.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
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
          {language === 'ar' ? 'تحويل النص إلى كلام' : 'Text to Speech'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'اكتب أي نص بأي لغة' : 'Type any text in any language'}
        </p>
      </div>

      {/* Character Usage */}
      <div className="p-3 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
            {language === 'ar' ? 'الأحرف المتبقية' : 'Characters Remaining'}
          </span>
          <span className="text-sm">
            {remainingCharacters.toLocaleString()} / {usage.characters_limit.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-2 mt-2">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ width: `${((usage.characters_limit - remainingCharacters) / usage.characters_limit) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {language === 'ar' 
            ? `لديك ${remainingCharacters.toLocaleString()} حرف متبقي من أصل ${usage.characters_limit.toLocaleString()}.`
            : `You have ${remainingCharacters.toLocaleString()} characters left out of ${usage.characters_limit.toLocaleString()}.`
          }
        </p>
      </div>

      {/* Voice Selector */}
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
                {voice.voice_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'النص' : 'Text'}
        </label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={language === 'ar' ? 'اكتب ما تريد سماعه بصوتك...' : 'Type what you want to hear in your voice...'}
          className="min-h-32 resize-none"
          maxLength={remainingCharacters}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{text.length} / {remainingCharacters}</span>
          {text.length > remainingCharacters && (
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
            <Volume2 className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحدث بهذا' : 'Speak This'}
          </>
        )}
      </Button>

      {/* Audio Player */}
      {audioUrl && (
        <div className="p-4 border rounded-lg space-y-4">
          <h3 className="font-medium">
            {language === 'ar' ? 'الصوت المُنشأ' : 'Generated Audio'}
          </h3>
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex gap-2">
            <Button onClick={playAudio} variant="outline" size="sm">
              <Play className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'تشغيل' : 'Play'}
            </Button>
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
