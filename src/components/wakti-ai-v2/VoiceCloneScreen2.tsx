
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
  user_email?: string;
  created_at: string;
}

interface VoiceCloneScreen2Props {
  onNext: () => void;
  onBack: () => void;
}

export function VoiceCloneScreen2({ onNext, onBack }: VoiceCloneScreen2Props) {
  const { language } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [existingVoices, setExistingVoices] = useState<VoiceClone[]>([]);
  const [loading, setLoading] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadExistingVoices();
  }, []);

  const loadExistingVoices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      // Get user's profile to access email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const userEmail = profile?.email || user.email;
      
      if (!userEmail) {
        console.error('User email not found');
        return;
      }

      console.log('Loading voices for email:', userEmail);

      // Load voices using both user_id and user_email for compatibility
      const { data, error } = await supabase
        .from('user_voice_clones')
        .select('*')
        .or(`user_id.eq.${user.id},user_email.eq.${userEmail}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading voices:', error);
        throw error;
      }

      console.log('Loaded voices:', data);
      setExistingVoices(data || []);
    } catch (error) {
      console.error('Error loading voices:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل الأصوات' : 'Failed to load voices');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 180) { // Max 3 minutes as per ElevenLabs best practices
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Microphone access error:', error);
      toast.error(language === 'ar' ? 'فشل في الوصول للميكروفون' : 'Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      setIsPlaying(true);
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const createVoiceClone = async () => {
    if (!voiceName.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم للصوت' : 'Please enter a voice name');
      return;
    }

    if (!audioBlob) {
      toast.error(language === 'ar' ? 'يرجى تسجيل ملف صوتي' : 'Please record an audio file');
      return;
    }

    // Validate minimum duration (at least 30 seconds as per requirements)
    if (recordingTime < 30) {
      toast.error(language === 'ar' ? 'التسجيل يجب أن يكون 30 ثانية على الأقل' : 'Recording must be at least 30 seconds');
      return;
    }

    // Validate maximum duration (3 minutes as per ElevenLabs best practices)
    if (recordingTime > 180) {
      toast.error(language === 'ar' ? 'التسجيل يجب أن يكون أقل من 3 دقائق' : 'Recording must be less than 3 minutes');
      return;
    }

    setIsCloning(true);

    try {
      // Convert WebM to a more compatible format if needed
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm;codecs=opus'
      });

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('voiceName', voiceName.trim());

      console.log('Creating voice clone:', {
        audioSize: audioFile.size,
        voiceName: voiceName.trim(),
        duration: recordingTime
      });

      const { data, error } = await supabase.functions.invoke('voice-clone', {
        body: formData,
      });

      if (error) {
        console.error('Voice clone error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Voice cloning failed');
      }

      console.log('Voice clone success:', data);
      toast.success(language === 'ar' ? 'تم إنشاء نسخة الصوت بنجاح' : 'Voice clone created successfully');

      // Reload voices and reset form
      await loadExistingVoices();
      setVoiceName('');
      deleteRecording();

    } catch (error: any) {
      console.error('Error creating voice clone:', error);
      const errorMessage = error?.message || error?.error || 'Failed to create voice clone';
      toast.error(language === 'ar' ? 'فشل في إنشاء نسخة الصوت: ' + errorMessage : 'Failed to create voice clone: ' + errorMessage);
    } finally {
      setIsCloning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canRecord = existingVoices.length < 3;
  const hasValidAudio = audioBlob && recordingTime >= 30 && recordingTime <= 180;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading voices...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'سجل صوتك' : 'Record Your Voice'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'يمكنك إنشاء حتى 3 أصوات' : 'You can create up to 3 voices'}
        </p>
      </div>

      {/* Existing Voices */}
      {existingVoices.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">
            {language === 'ar' ? 'أصواتك المحفوظة' : 'Your Saved Voices'}
          </h3>
          {existingVoices.map((voice) => (
            <div key={voice.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-sm font-medium">{voice.voice_name}</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                {language === 'ar' ? 'مستنسخ' : 'Cloned'}
              </span>
              {voice.user_email && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {voice.user_email}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Voice Limit Warning */}
      {!canRecord && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {language === 'ar' 
              ? 'لقد وصلت إلى الحد الأقصى من 3 أصوات. احذف صوتاً لإنشاء صوت جديد.' 
              : "You've reached your 3-voice limit. Delete a voice to create a new one."
            }
          </p>
        </div>
      )}

      {canRecord && (
        <>
          {/* Recording Section */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">
                {language === 'ar' ? 'تسجيل صوتي' : 'Voice Recording'}
              </h3>
              
              <div className="flex items-center gap-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="flex-shrink-0"
                  disabled={isCloning}
                >
                  {isRecording ? <Square className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {isRecording 
                    ? (language === 'ar' ? 'إيقاف' : 'Stop') 
                    : (language === 'ar' ? 'تسجيل' : 'Record')
                  }
                </Button>
                
                <div className="text-lg font-mono">
                  {formatTime(recordingTime)} / 3:00
                </div>
                
                {recordingTime > 0 && recordingTime < 30 && (
                  <span className="text-xs text-amber-600">
                    {language === 'ar' ? 'الحد الأدنى 30 ثانية' : 'Min 30 seconds'}
                  </span>
                )}
                
                {recordingTime >= 30 && recordingTime <= 180 && (
                  <span className="text-xs text-green-600">
                    {language === 'ar' ? 'مدة مناسبة' : 'Good duration'}
                  </span>
                )}
              </div>

              {audioBlob && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={isPlaying ? pauseAudio : playAudio}
                    variant="outline"
                    size="sm"
                    disabled={isCloning}
                  >
                    {isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                    {isPlaying 
                      ? (language === 'ar' ? 'إيقاف مؤقت' : 'Pause') 
                      : (language === 'ar' ? 'تشغيل' : 'Play')
                    }
                  </Button>
                  <Button 
                    onClick={deleteRecording} 
                    variant="outline" 
                    size="sm"
                    disabled={isCloning}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </Button>
                </div>
              )}
            </div>

            {/* Voice Name Input */}
            <div className="space-y-2">
              <Label htmlFor="voice-name">
                {language === 'ar' ? 'اسم الصوت' : 'Voice Name'}
              </Label>
              <Input
                id="voice-name"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: صوتي الهادئ' : 'e.g., My Calm Voice'}
                maxLength={50}
                disabled={isCloning}
              />
            </div>

            {/* Clone Button */}
            <Button
              onClick={createVoiceClone}
              disabled={!hasValidAudio || !voiceName.trim() || isCloning}
              className="w-full"
            >
              {isCloning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'ar' ? 'جاري الإنشاء...' : 'Creating Clone...'}
                </>
              ) : (
                <>
                  {language === 'ar' ? 'إنشاء النسخة' : 'Create Clone'}
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1" disabled={isCloning}>
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        <Button 
          onClick={onNext} 
          className="flex-1"
          disabled={existingVoices.length === 0 || isCloning}
        >
          {language === 'ar' ? 'التالي ← استخدم صوتك' : 'Next → Use Your Voice'}
        </Button>
      </div>
    </div>
  );
}
