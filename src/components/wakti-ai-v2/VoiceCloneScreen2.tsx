import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
      const { data, error } = await supabase
        .from('user_voice_clones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingVoices(data || []);
    } catch (error) {
      console.error('Error loading voices:', error);
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
      setExistingVoices(prev => prev.filter(voice => voice.voice_id !== voiceId));

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
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

    // Validate minimum duration for recorded audio
    if (recordingTime < 30) {
      toast.error(language === 'ar' ? 'التسجيل يجب أن يكون 30 ثانية على الأقل' : 'Recording must be at least 30 seconds');
      return;
    }

    setIsCloning(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('voiceName', voiceName.trim());

      const { data, error } = await supabase.functions.invoke('voice-clone', {
        body: formData,
      });

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم إنشاء نسخة الصوت بنجاح' : 'Voice clone created successfully');

      // Reload voices and reset form
      await loadExistingVoices();
      setVoiceName('');
      deleteRecording();

    } catch (error: any) {
      console.error('Error creating voice clone:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في إنشاء نسخة الصوت' : 'Failed to create voice clone'));
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
  const hasValidAudio = audioBlob && recordingTime >= 30;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
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

      {/* Existing Voices with Delete Functionality */}
      {existingVoices.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">
            {language === 'ar' ? 'أصواتك المحفوظة' : 'Your Saved Voices'}
          </h3>
          {existingVoices.map((voice) => (
            <div key={voice.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{voice.voice_name}</span>
                <span className="text-xs text-muted-foreground">
                  {language === 'ar' ? '🟢 مستنسخ' : '🟢 Cloned'}
                </span>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeletingVoice === voice.voice_id}
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
                >
                  {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isRecording 
                    ? (language === 'ar' ? 'إيقاف' : 'Stop') 
                    : (language === 'ar' ? 'تسجيل' : 'Record')
                  }
                </Button>
                
                <div className="text-lg font-mono">
                  {formatTime(recordingTime)} / 1:00
                </div>
                
                {recordingTime < 30 && recordingTime > 0 && (
                  <span className="text-xs text-amber-600">
                    {language === 'ar' ? 'الحد الأدنى 30 ثانية' : 'Min 30 seconds'}
                  </span>
                )}
              </div>

              {audioBlob && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={isPlaying ? pauseAudio : playAudio}
                    variant="outline"
                    size="sm"
                  >
                    {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {isPlaying 
                      ? (language === 'ar' ? 'إيقاف مؤقت' : 'Pause') 
                      : (language === 'ar' ? 'تشغيل' : 'Play')
                    }
                  </Button>
                  <Button onClick={deleteRecording} variant="outline" size="sm">
                    <Trash2 className="h-3 w-3" />
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
        <Button onClick={onBack} variant="outline" className="flex-1">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        <Button 
          onClick={onNext} 
          className="flex-1"
          disabled={existingVoices.length === 0}
        >
          {language === 'ar' ? 'التالي ← استخدم صوتك' : 'Next → Use Your Voice'}
        </Button>
      </div>
    </div>
  );
}
