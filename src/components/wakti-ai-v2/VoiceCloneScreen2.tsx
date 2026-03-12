
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, Loader2, AlertCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
  user_email?: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
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
  const [isDeletingVoice, setIsDeletingVoice] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  
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
        .select('id, voice_name, voice_id, user_email, created_at, expires_at, last_used_at')
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
      
      // Use WebM format for recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 180) { // Max 3 minutes as per ElevenLabs requirements
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
    console.log('🎤 FRONTEND: Starting voice clone creation...');
    
    if (!voiceName.trim()) {
      console.log('🎤 FRONTEND: Voice name validation failed');
      toast.error(language === 'ar' ? 'يرجى إدخال اسم للصوت' : 'Please enter a voice name');
      return;
    }

    if (!audioBlob) {
      console.log('🎤 FRONTEND: Audio blob validation failed');
      toast.error(language === 'ar' ? 'يرجى تسجيل ملف صوتي' : 'Please record an audio file');
      return;
    }

    // Validate minimum duration (at least 60 seconds for better quality)
    if (recordingTime < 60) {
      console.log('🎤 FRONTEND: Duration too short:', recordingTime);
      toast.error(language === 'ar' ? 'التسجيل يجب أن يكون دقيقة واحدة على الأقل للحصول على جودة أفضل' : 'Recording must be at least 1 minute for better quality');
      return;
    }

    // Validate maximum duration (3 minutes as per ElevenLabs requirements)
    if (recordingTime > 180) {
      console.log('🎤 FRONTEND: Duration too long:', recordingTime);
      toast.error(language === 'ar' ? 'التسجيل يجب أن يكون أقل من 3 دقائق' : 'Recording must be less than 3 minutes');
      return;
    }

    setIsCloning(true);

    try {
      // Get current user for debugging
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🎤 FRONTEND: Current user:', user ? `${user.id} (${user.email})` : 'NOT AUTHENTICATED');
      
      if (!user) {
        throw new Error('User not authenticated - please login again');
      }

      // FIXED: Create proper File object with correct naming
      const audioFile = new File([audioBlob], `voice-clone-${Date.now()}.webm`, {
        type: audioBlob.type || 'audio/webm'
      });

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('voiceName', voiceName.trim());

      console.log('🎤 FRONTEND: Prepared request data:', {
        audioSize: audioFile.size,
        voiceName: voiceName.trim(),
        duration: recordingTime,
        audioType: audioFile.type,
        formDataKeys: Array.from(formData.keys())
      });

      console.log('🎤 FRONTEND: Calling voice-clone function...');
      const startTime = Date.now();

      const { data, error } = await supabase.functions.invoke('voice-clone', {
        body: formData,
      });

      const endTime = Date.now();
      console.log(`🎤 FRONTEND: Function call completed in ${endTime - startTime}ms`);
      console.log('🎤 FRONTEND: Response data:', data);
      console.log('🎤 FRONTEND: Response error:', error);

      if (error) {
        console.error('🎤 FRONTEND: Voice clone error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('🎤 FRONTEND: Function returned failure:', data);
        if (data?.error === 'TRIAL_LIMIT_REACHED') {
          window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: data?.feature || 'voice_clone' } }));
          setIsCloning(false);
          return;
        }
        throw new Error(data?.error || 'Voice cloning failed');
      }

      console.log('🎤 FRONTEND: Voice clone success:', data);
      toast.success(language === 'ar' ? 'تم إنشاء نسخة الصوت بنجاح! يمكنك الآن استخدامها في التطبيق.' : 'Voice clone created successfully! You can now use it in the app.');

      // Reload voices and reset form
      console.log('🎤 FRONTEND: Reloading voices and resetting form...');
      await loadExistingVoices();
      setVoiceName('');
      deleteRecording();

    } catch (error: any) {
      console.error('Error creating voice clone:', error);
      const errorMessage = error?.message || error?.error || 'Failed to create voice clone';
      
      // Provide more specific error messages
      if (errorMessage.includes('Audio file too large')) {
        toast.error(language === 'ar' ? 'الملف الصوتي كبير جداً (الحد الأقصى 10 ميجابايت)' : 'Audio file too large (max 10MB)');
      } else if (errorMessage.includes('Invalid file type')) {
        toast.error(language === 'ar' ? 'نوع الملف غير صالح' : 'Invalid file type');
      } else if (errorMessage.includes('Row Level Security')) {
        toast.error(language === 'ar' ? 'خطأ في الصلاحيات، يرجى إعادة تسجيل الدخول' : 'Permission error, please re-login');
      } else if (errorMessage.includes('ElevenLabs') || errorMessage.includes('API')) {
        toast.error(language === 'ar' ? 'خطأ في خدمة نسخ الصوت، يرجى المحاولة مرة أخرى' : 'Voice cloning service error, please try again');
      } else {
        toast.error(language === 'ar' ? 'فشل في إنشاء نسخة الصوت: ' + errorMessage : 'Failed to create voice clone: ' + errorMessage);
      }
    } finally {
      setIsCloning(false);
    }
  };

  const deleteVoiceClone = async (voiceId: string, voiceName: string) => {
    setIsDeletingVoice(voiceId);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete voice');
      }

      setExistingVoices(prev => prev.filter(voice => voice.voice_id !== voiceId));
      toast.success(language === 'ar' 
        ? `تم حذف الصوت "${voiceName}" بنجاح` 
        : `Voice "${voiceName}" deleted successfully`
      );

    } catch (error: any) {
      console.error('Error deleting voice:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في حذف الصوت' : 'Failed to delete voice'));
    } finally {
      setIsDeletingVoice(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDaysRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiryDate = new Date(expiresAt);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const canRecord = existingVoices.length < 2;
  const hasValidAudio = audioBlob && recordingTime >= 60 && recordingTime <= 180;

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
    <div className="space-y-4">
      {/* Header - compact */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'استنساخ صوتك' : 'Clone Your Voice'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {language === 'ar' 
            ? `الأصوات ${existingVoices.length}/2 • يتم حذف الأصوات غير المستخدمة بعد 60 يومًا`
            : `Voices ${existingVoices.length}/2 • Unused voices auto-delete after 60 days`}
        </p>
      </div>

      {/* Tips - collapsible, minimal chrome */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowTips(v => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showTips
            ? (language === 'ar' ? 'إخفاء نصائح التسجيل' : 'Hide recording tips')
            : (language === 'ar' ? 'عرض نصائح التسجيل' : 'Show recording tips')}
        </button>
        {showTips && (
          <div className="mt-2 text-left mx-auto max-w-prose">
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
              <li>{language === 'ar' ? 'سجّل دقيقة واحدة على الأقل (بحد أقصى 3 دقائق)' : 'Record at least 1 minute (max 3 minutes)'}</li>
              <li>{language === 'ar' ? 'حافظ على نبرة متسقة' : 'Keep a consistent tone'}</li>
              <li>{language === 'ar' ? 'مكان هادئ بدون ضوضاء' : 'Quiet room, low noise'}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Auto-deletion notice removed per request */}

      {/* Existing Voices - compact row list */}
      {existingVoices.length > 0 && (
        <div className="space-y-1">
          {existingVoices.map((voice) => {
            const daysRemaining = getDaysRemaining(voice.expires_at);
            const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
            return (
              <div key={voice.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/60">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <div className="flex-1 truncate">
                  <span className="font-medium">{voice.voice_name}</span>
                  {daysRemaining !== null && (
                    <span className="ml-2 text-muted-foreground">
                      {daysRemaining > 0 ? (
                        <span className={isExpiringSoon ? 'text-amber-600' : ''}>
                          {language === 'ar' ? `${daysRemaining} يومًا متبقيًا` : `${daysRemaining} days left`}
                        </span>
                      ) : (
                        <span className="text-red-600">{language === 'ar' ? 'منتهي' : 'Expired'}</span>
                      )}
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => deleteVoiceClone(voice.voice_id, voice.voice_name)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  disabled={isDeletingVoice === voice.voice_id}
                >
                  {isDeletingVoice === voice.voice_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Voice Limit Warning */}
      {!canRecord && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {language === 'ar' 
              ? 'لقد وصلت إلى الحد الأقصى من صوتين. احذف صوتاً لإنشاء صوت جديد.' 
              : "You've reached your 2-voice limit. Delete a voice to create a new one."
            }
          </p>
        </div>
      )}

      {canRecord && (
        <>
          {/* Slim Recorder Row */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  size="sm"
                  className="px-3"
                  disabled={isCloning}
                >
                  {isRecording ? <Square className="h-3.5 w-3.5 mr-2" /> : <Mic className="h-3.5 w-3.5 mr-2" />}
                  {isRecording ? (language === 'ar' ? 'إيقاف' : 'Stop') : (language === 'ar' ? 'تسجيل' : 'Record')}
                </Button>
                <div className="text-sm font-mono">{formatTime(recordingTime)} / 3:00</div>
              </div>
              <div className="flex items-center gap-2">
                {recordingTime > 0 && recordingTime < 60 && (
                  <span className="text-xs text-amber-600">{language === 'ar' ? 'الحد الأدنى 1 دقيقة' : 'Min 1 min'}</span>
                )}
                {recordingTime >= 60 && recordingTime <= 180 && (
                  <span className="text-xs text-green-600">{language === 'ar' ? 'مدة ممتازة' : 'Great length'}</span>
                )}
              </div>
            </div>
            {/* Inline controls moved to dedicated section below */}
          </div>

          {/* Name + Create */}
          <div className="space-y-2">
            <Label htmlFor="voice-name">{language === 'ar' ? 'اسم الصوت' : 'Voice Name'}</Label>
            <Input
              id="voice-name"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: صوتي الهادئ' : 'e.g., My Calm Voice'}
              maxLength={50}
              disabled={isCloning}
            />
            <Button onClick={createVoiceClone} disabled={!hasValidAudio || !voiceName.trim() || isCloning} className="w-full">
              {isCloning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}
                </>
              ) : (
                <>{language === 'ar' ? 'إنشاء نسخة الصوت' : 'Create Voice Clone'}</>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Your Recording section */}
      {audioBlob && (
        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-medium mb-2">{language === 'ar' ? 'تسجيلك' : 'Your Recording'}</h3>
          <div className="flex items-center gap-2">
            <Button onClick={isPlaying ? pauseAudio : playAudio} variant="outline" size="sm" disabled={isCloning}>
              {isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              {isPlaying ? (language === 'ar' ? 'إيقاف مؤقت' : 'Pause') : (language === 'ar' ? 'تشغيل' : 'Play')}
            </Button>
            <Button onClick={deleteRecording} variant="outline" size="sm" disabled={isCloning}>
              <Trash2 className="h-3 w-3 mr-1" />{language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
            <a
              className="ml-auto text-xs underline text-muted-foreground flex items-center gap-1"
              href={audioBlob ? URL.createObjectURL(audioBlob) : undefined}
              download={`voice-sample.webm`}
              onClick={(e) => { if (!audioBlob) e.preventDefault(); }}
            >
              <Download className="h-3 w-3" /> {language === 'ar' ? 'تنزيل' : 'Download'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
