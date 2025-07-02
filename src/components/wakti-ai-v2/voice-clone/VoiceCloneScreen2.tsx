import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Play, Pause, Trash2, Upload } from 'lucide-react';

interface VoiceClone {
  id: string;
  voice_id: string;
  voice_name: string;
  voice_description: string;
  created_at: string;
}

interface VoiceCloneScreen2Props {
  onNext: () => void;
  onBack: () => void;
  voices: VoiceClone[];
  onVoicesUpdate: () => void;
  onRecordingComplete: (hasRecordings: boolean) => void;
}

export function VoiceCloneScreen2({ 
  onNext, 
  onBack, 
  voices, 
  onVoicesUpdate,
  onRecordingComplete 
}: VoiceCloneScreen2Props) {
  const { language } = useTheme();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      console.log('📱 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      console.log('📱 Microphone access granted');
      
      // Use audio/webm;codecs=opus for better compatibility
      const mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📱 Audio chunk received:', event.data.size, 'bytes');
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('📱 Recording stopped, processing audio...');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('📱 Audio blob created:', blob.size, 'bytes, type:', blob.type);
        
        setAudioBlob(blob);
        
        // Create URL for playback
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('📱 Audio track stopped');
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('📱 MediaRecorder error:', event);
        toast({
          title: language === 'ar' ? 'خطأ في التسجيل' : 'Recording Error',
          description: language === 'ar' ? 'حدث خطأ أثناء التسجيل' : 'An error occurred during recording',
          variant: 'destructive',
        });
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      
      console.log('📱 Recording started');

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 60 seconds
          if (newTime >= 60) {
            stopRecording();
            return 60;
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('📱 Error starting recording:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الوصول للميكروفون' : 'Microphone Access Error',
        description: language === 'ar' 
          ? 'لا يمكن الوصول للميكروفون. تأكد من السماح بالوصول.' 
          : 'Cannot access microphone. Please allow microphone access.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('📱 Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const createVoiceClone = async () => {
    if (!audioBlob || !voiceName.trim()) {
      toast({
        title: language === 'ar' ? 'بيانات ناقصة' : 'Missing Information',
        description: language === 'ar' 
          ? 'يرجى إدخال اسم الصوت والتأكد من وجود تسجيل صوتي' 
          : 'Please enter a voice name and ensure you have a recording',
        variant: 'destructive',
      });
      return;
    }

    if (recordingTime < 30) {
      toast({
        title: language === 'ar' ? 'تسجيل قصير' : 'Recording Too Short',
        description: language === 'ar' 
          ? 'يجب أن يكون التسجيل 30 ثانية على الأقل' 
          : 'Recording must be at least 30 seconds long',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    
    try {
      console.log('🎙️ Creating voice clone...', {
        voiceName,
        voiceDescription,
        audioBlobSize: audioBlob.size,
        audioBlobType: audioBlob.type,
        recordingTime
      });

      const formData = new FormData();
      formData.append('voice_name', voiceName.trim());
      if (voiceDescription.trim()) {
        formData.append('voice_description', voiceDescription.trim());
      }
      
      // Create file with proper name and extension
      const fileName = `voice-clone-${Date.now()}.webm`;
      const audioFile = new File([audioBlob], fileName, { 
        type: audioBlob.type || 'audio/webm' 
      });
      
      formData.append('audio_file', audioFile);

      console.log('🎙️ Sending request to edge function...');

      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-clone', {
        body: formData,
      });

      console.log('🎙️ Edge function response:', { data, error });

      if (error) {
        console.error('🎙️ Edge function error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create voice clone');
      }

      console.log('🎙️ Voice clone created successfully:', data.voice);

      toast({
        title: language === 'ar' ? 'تم إنشاء نسخة الصوت' : 'Voice Clone Created',
        description: language === 'ar' 
          ? 'تم إنشاء نسخة الصوت بنجاح' 
          : 'Voice clone created successfully',
      });

      // Reset form
      setVoiceName('');
      setVoiceDescription('');
      deleteRecording();
      
      // Update voices list
      await onVoicesUpdate();
      onRecordingComplete(true);
      
      // Move to next step
      onNext();

    } catch (error: any) {
      console.error('🎙️ Voice clone creation error:', error);
      
      let errorMessage = language === 'ar' 
        ? 'فشل في إنشاء نسخة الصوت' 
        : 'Failed to create voice clone';
      
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast({
        title: language === 'ar' ? 'خطأ في إنشاء نسخة الصوت' : 'Voice Clone Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'تسجيل الصوت' : 'Record Your Voice'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!audioBlob ? (
              <div className="text-center space-y-4">
                <div className="text-4xl mb-4">
                  {formatTime(recordingTime)}
                </div>
                
                {recordingTime > 0 && (
                  <Progress 
                    value={(recordingTime / 60) * 100} 
                    className="w-full"
                  />
                )}
                
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-accent-blue hover:bg-accent-blue/80'
                  } text-white`}
                  disabled={isCreating}
                >
                  {isRecording ? (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording'}
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'بدء التسجيل' : 'Start Recording'}
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {language === 'ar' 
                    ? 'الحد الأدنى: 30 ثانية، الحد الأقصى: دقيقة واحدة'
                    : 'Minimum: 30 seconds, Maximum: 1 minute'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      {language === 'ar' ? 'تم التسجيل' : 'Recording Complete'}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {formatTime(recordingTime)}
                    </p>
                  </div>
                  <div className="flex space-x-2 rtl:space-x-reverse">
                    <Button
                      onClick={playRecording}
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      onClick={deleteRecording}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'اسم الصوت *' : 'Voice Name *'}
                    </label>
                    <Input
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      placeholder={language === 'ar' ? 'اسم مميز لنسخة الصوت' : 'A unique name for your voice clone'}
                      className="bg-white/50 dark:bg-black/50"
                      disabled={isCreating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'وصف الصوت (اختياري)' : 'Voice Description (Optional)'}
                    </label>
                    <Textarea
                      value={voiceDescription}
                      onChange={(e) => setVoiceDescription(e.target.value)}
                      placeholder={language === 'ar' ? 'وصف قصير للصوت...' : 'Brief description of the voice...'}
                      className="bg-white/50 dark:bg-black/50"
                      rows={3}
                      disabled={isCreating}
                    />
                  </div>
                </div>
              </div>
            )}

            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
          </CardContent>
        </Card>

        <div className="flex space-x-3 rtl:space-x-reverse">
          <Button 
            onClick={onBack}
            variant="outline"
            className="flex-1 border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-white/10"
            disabled={isCreating || isRecording}
          >
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          
          {audioBlob && (
            <Button 
              onClick={createVoiceClone}
              className="flex-1 bg-accent-blue hover:bg-accent-blue/80 text-white"
              disabled={isCreating || !voiceName.trim() || recordingTime < 30}
            >
              {isCreating ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}
                </>
              ) : (
                language === 'ar' ? 'إنشاء نسخة الصوت' : 'Create Voice Clone'
              )}
            </Button>
          )}
          
          {!audioBlob && voices.length > 0 && (
            <Button 
              onClick={onNext}
              className="flex-1 bg-accent-blue hover:bg-accent-blue/80 text-white"
              disabled={isRecording}
            >
              {language === 'ar' ? 'التالي' : 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
