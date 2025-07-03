
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'سجل صوتك' : 'Record Your Voice'}
        </h2>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'يمكنك إنشاء حتى صوتين' : 'You can create up to 2 voices'}
          </p>
          <p className="text-xs font-medium">
            {language === 'ar' 
              ? `أصواتك (${existingVoices.length}/2)`
              : `Your Voices (${existingVoices.length}/2)`
            }
          </p>
        </div>
      </div>

      {/* Audio Quality Guidelines */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">
              {language === 'ar' ? 'متطلبات ElevenLabs للجودة المثلى:' : 'ElevenLabs Requirements for Best Quality:'}
            </p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>{language === 'ar' ? 'سجل لمدة دقيقة واحدة على الأقل (3 دقائق كحد أقصى)' : 'Record at least 1 minute (max 3 minutes)'}</li>
              <li>{language === 'ar' ? 'تحدث بنبرة ثابتة ومتسقة' : 'Keep consistent tone and performance'}</li>
              <li>{language === 'ar' ? 'سجل في مكان هادئ بدون ضوضاء خلفية' : 'Record in quiet environment without background noise'}</li>
              <li>{language === 'ar' ? 'تجنب الصدى والتشويه' : 'Avoid reverb and artifacts'}</li>
              <li>{language === 'ar' ? 'حافظ على مستوى صوت مثالي' : 'Maintain ideal volume levels'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Voice Expiration Warning */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">
              {language === 'ar' ? 'تنبيه: الحذف التلقائي' : 'Notice: Auto-Deletion'}
            </p>
            <p className="text-xs mt-1">
              {language === 'ar' 
                ? 'الأصوات غير المستخدمة لمدة 60 يوماً سيتم حذفها تلقائياً. استخدم أصواتك بانتظام للاحتفاظ بها.'
                : 'Voices unused for 60 days will be automatically deleted. Use your voices regularly to keep them active.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Existing Voices */}
      {existingVoices.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">
            {language === 'ar' ? 'أصواتك المحفوظة' : 'Your Saved Voices'}
          </h3>
          {existingVoices.map((voice) => {
            const daysRemaining = getDaysRemaining(voice.expires_at);
            const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
            
            return (
              <div key={voice.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium">{voice.voice_name}</span>
                  {daysRemaining !== null && (
                    <div className="text-xs text-muted-foreground">
                      {daysRemaining > 0 ? (
                        <span className={isExpiringSoon ? 'text-amber-600' : ''}>
                          {language === 'ar' 
                            ? `${daysRemaining} أيام متبقية`
                            : `${daysRemaining} days remaining`
                          }
                        </span>
                      ) : (
                        <span className="text-red-600">
                          {language === 'ar' ? 'منتهي الصلاحية' : 'Expired'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  {language === 'ar' ? 'جاهز' : 'Ready'}
                </span>
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
                
                {recordingTime > 0 && recordingTime < 60 && (
                  <span className="text-xs text-amber-600">
                    {language === 'ar' ? 'الحد الأدنى دقيقة واحدة' : 'Min 1 minute'}
                  </span>
                )}
                
                {recordingTime >= 60 && recordingTime <= 180 && (
                  <span className="text-xs text-green-600">
                    {language === 'ar' ? 'مدة ممتازة!' : 'Perfect duration!'}
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
                  {language === 'ar' ? 'جاري الإنشاء بواسطة ElevenLabs...' : 'Creating with ElevenLabs...'}
                </>
              ) : (
                <>
                  {language === 'ar' ? 'إنشاء النسخة' : 'Create Voice Clone'}
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
