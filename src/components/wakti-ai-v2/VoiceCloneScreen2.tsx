import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, Loader2, Upload, Send } from 'lucide-react';
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
  audio_file_url?: string;
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
  const [voiceDescription, setVoiceDescription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloningStep, setCloningStep] = useState('');
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
    
    // Optimistic UI update - remove immediately
    setExistingVoices(prev => prev.filter(voice => voice.voice_id !== voiceId));
    
    try {
      console.log('🗑️ === Voice Deletion Request ===');
      console.log('🗑️ Voice ID:', voiceId);
      console.log('🗑️ Voice Name:', voiceName);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      // Use direct fetch for DELETE request
      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-clone', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU'
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

      const data = await response.json();
      console.log('🗑️ Delete response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete voice');
      }

      // Show success message
      const successMessage = data.message || `Voice "${voiceName}" deleted successfully`;
      toast.success(language === 'ar' 
        ? `تم حذف الصوت "${voiceName}" بنجاح` 
        : successMessage
      );

      console.log('🗑️ Voice deleted successfully:', data);

      // Wait a moment then refresh to ensure consistency
      setTimeout(() => {
        loadExistingVoices();
      }, 1000);

    } catch (error: any) {
      console.error('🗑️ Error deleting voice:', error);
      
      // Restore voice to list on error
      loadExistingVoices();
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (errorMessage.includes('Voice not found') || errorMessage.includes('access denied')) {
        errorMessage = language === 'ar' 
          ? 'الصوت غير موجود أو تم حذفه مسبقاً' 
          : 'Voice not found or already deleted';
      } else if (errorMessage.includes('Database deletion failed')) {
        errorMessage = language === 'ar' 
          ? 'فشل في حذف الصوت من قاعدة البيانات' 
          : 'Failed to remove voice from database';
      } else if (errorMessage.includes('Failed to delete voice')) {
        errorMessage = language === 'ar' 
          ? 'فشل في حذف الصوت' 
          : 'Failed to delete voice';
      }
      
      toast.error(errorMessage);
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

    if (!voiceDescription.trim() || voiceDescription.trim().length < 20) {
      toast.error(language === 'ar' ? 'يرجى إدخال وصف للصوت (على الأقل 20 حرف)' : 'Please enter a voice description (at least 20 characters)');
      return;
    }

    if (voiceDescription.trim().length > 1000) {
      toast.error(language === 'ar' ? 'وصف الصوت يجب أن يكون أقل من 1000 حرف' : 'Voice description must be less than 1000 characters');
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

    // Check voice limit before proceeding
    if (existingVoices.length >= 3) {
      toast.error(language === 'ar' ? 'لقد وصلت إلى الحد الأقصى من 3 أصوات' : 'You have reached the maximum of 3 voices');
      return;
    }

    setIsCloning(true);
    setCloningStep(language === 'ar' ? 'جاري التحضير...' : 'Preparing...');

    try {
      console.log('🎙️ === Voice Cloning Request - SIMPLE FLOW ===');
      console.log('🎙️ Voice Name:', voiceName.trim());
      console.log('🎙️ Voice Description Length:', voiceDescription.trim().length);
      console.log('🎙️ Audio Blob Size:', audioBlob.size);
      console.log('🎙️ Recording Duration:', recordingTime);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      // Step 1: Show recording step (already done)
      setCloningStep(language === 'ar' ? '✓ تسجيل مكتمل' : '✓ Recording Complete');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Show saving step
      setCloningStep(language === 'ar' ? '💾 حفظ الملف الصوتي...' : '💾 Saving Audio File...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-sample.wav');
      formData.append('voiceName', voiceName.trim());
      formData.append('voiceDescription', voiceDescription.trim());

      // Step 3: Show sending step
      setCloningStep(language === 'ar' ? '🚀 إرسال إلى ElevenLabs...' : '🚀 Sending to ElevenLabs...');

      // Use direct fetch for FormData upload
      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-clone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU'
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('🎙️ Clone response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Voice cloning failed');
      }

      setCloningStep(language === 'ar' ? '✅ تم إنشاء النسخة بنجاح!' : '✅ Voice Clone Created Successfully!');
      
      toast.success(language === 'ar' ? 'تم إنشاء نسخة الصوت بنجاح' : 'Voice clone created successfully');

      console.log('🎙️ Voice cloned successfully:', data);

      // Reload voices and reset form
      await loadExistingVoices();
      setVoiceName('');
      setVoiceDescription('');
      deleteRecording();

    } catch (error: any) {
      console.error('🎙️ Error creating voice clone:', error);
      let errorMessage = error.message || (language === 'ar' ? 'فشل في إنشاء نسخة الصوت' : 'Failed to create voice clone');
      
      // Handle specific error cases
      if (errorMessage.includes('Voice limit reached')) {
        errorMessage = language === 'ar' 
          ? 'وصلت إلى الحد الأقصى من 3 أصوات. احذف صوتاً موجوداً أولاً' 
          : 'Voice limit reached. Delete an existing voice first';
      } else if (errorMessage.includes('Voice service API key not configured')) {
        errorMessage = language === 'ar' 
          ? 'مفتاح خدمة الصوت غير مكون' 
          : 'Voice service not configured';
      }
      
      setCloningStep(language === 'ar' ? '❌ فشل في العملية' : '❌ Process Failed');
      toast.error(errorMessage);
    } finally {
      setTimeout(() => {
        setIsCloning(false);
        setCloningStep('');
      }, 2000);
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
          {language === 'ar' ? 'التدفق البسيط: تسجيل → حفظ → إرسال' : 'Simple Flow: Record → Save → Send'}
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
                  {language === 'ar' ? '🟢 مستنسخ ومحفوظ' : '🟢 Cloned & Saved'}
                </span>
                {voice.audio_file_url && (
                  <span className="text-xs text-blue-500">
                    💾 {language === 'ar' ? 'محفوظ' : 'Stored'}
                  </span>
                )}
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
                        ? `هل أنت متأكد من حذف الصوت "${voice.voice_name}"؟ هذا الإجراء لا يمكن التراجع عنه وسيحذف الملف المحفوظ أيضاً.`
                        : `Are you sure you want to delete the voice "${voice.voice_name}"? This action cannot be undone and will also delete the saved audio file.`
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
          {/* Simple Flow Progress */}
          {isCloning && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    {language === 'ar' ? 'التدفق البسيط قيد التنفيذ' : 'Simple Flow in Progress'}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300">{cloningStep}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recording Section */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-sm font-bold">1</span>
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
                    disabled={isCloning}
                  >
                    {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {isPlaying 
                      ? (language === 'ar' ? 'إيقاف مؤقت' : 'Pause') 
                      : (language === 'ar' ? 'تشغيل' : 'Play')
                    }
                  </Button>
                  <Button onClick={deleteRecording} variant="outline" size="sm" disabled={isCloning}>
                    <Trash2 className="h-3 w-3" />
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </Button>
                  {hasValidAudio && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {language === 'ar' ? 'جاهز للحفظ' : 'Ready to Save'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Voice Details Section */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-sm font-bold">2</span>
                {language === 'ar' ? 'تفاصيل الصوت' : 'Voice Details'}
              </h3>

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

              <div className="space-y-2">
                <Label htmlFor="voice-description">
                  {language === 'ar' ? 'وصف الصوت' : 'Voice Description'}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="voice-description"
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: صوت هادئ ومريح، مناسب للقراءة والمحادثة اليومية' : 'e.g., A calm and soothing voice, perfect for reading and daily conversation'}
                  className="min-h-[80px] resize-none"
                  minLength={20}
                  maxLength={1000}
                  disabled={isCloning}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {language === 'ar' ? 'الحد الأدنى 20 حرف، الأقصى 1000' : 'Min 20 chars, Max 1000'}
                  </span>
                  <span className={voiceDescription.length < 20 ? 'text-red-500' : voiceDescription.length > 1000 ? 'text-red-500' : 'text-green-600'}>
                    {voiceDescription.length}/1000
                  </span>
                </div>
              </div>
            </div>

            {/* Simple Flow Action Button */}
            <div className="p-4 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50/50">
              <div className="text-center space-y-3">
                <h3 className="font-medium flex items-center justify-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-bold">3</span>
                  {language === 'ar' ? 'تنفيذ التدفق البسيط' : 'Execute Simple Flow'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'سيتم: حفظ الملف الصوتي → إرساله إلى ElevenLabs → حفظ النتيجة' : 'Will: Save audio file → Send to ElevenLabs → Save result'}
                </p>
                <Button
                  onClick={createVoiceClone}
                  disabled={!hasValidAudio || !voiceName.trim() || !voiceDescription.trim() || voiceDescription.trim().length < 20 || voiceDescription.trim().length > 1000 || isCloning}
                  className="w-full"
                  size="lg"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {language === 'ar' ? 'جاري التنفيذ...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'بدء التدفق البسيط' : 'Start Simple Flow'}
                    </>
                  )}
                </Button>
              </div>
            </div>
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
