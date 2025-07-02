import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Mic, MicOff, Play, Pause, Trash2, Upload, ArrowLeft, ArrowRight, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

export function VoiceCloneScreen2({ onNext, onBack, voices, onVoicesUpdate }: VoiceCloneScreen2Props) {
  const { language } = useTheme();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voiceToDelete, setVoiceToDelete] = useState<VoiceClone | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-stop recording at 60 seconds
  useEffect(() => {
    if (recordingTime >= 60) {
      stopRecording();
    }
  }, [recordingTime]);

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
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: language === 'ar' ? 'خطأ في التسجيل' : 'Recording Error',
        description: language === 'ar' ? 'فشل في بدء التسجيل. تأكد من السماح بالوصول للميكروفون.' : 'Failed to start recording. Please allow microphone access.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Check minimum duration
      if (recordingTime < 30) {
        toast({
          title: language === 'ar' ? 'تسجيل قصير' : 'Recording Too Short',
          description: language === 'ar' ? 'يجب أن يكون التسجيل 30 ثانية على الأقل للحصول على جودة جيدة.' : 'Recording should be at least 30 seconds for good quality.',
          variant: 'destructive',
        });
      }
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadVoiceClone = async () => {
    if (!audioBlob || !voiceName.trim()) {
      toast({
        title: language === 'ar' ? 'بيانات مفقودة' : 'Missing Data',
        description: language === 'ar' ? 'يرجى إدخال اسم الصوت وتسجيل الصوت.' : 'Please enter voice name and record audio.',
        variant: 'destructive',
      });
      return;
    }

    if (recordingTime < 30) {
      toast({
        title: language === 'ar' ? 'تسجيل قصير' : 'Recording Too Short',
        description: language === 'ar' ? 'يجب أن يكون التسجيل 30 ثانية على الأقل.' : 'Recording must be at least 30 seconds.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('voice_name', voiceName.trim());
      formData.append('voice_description', voiceDescription.trim());
      formData.append('audio_file', audioBlob, 'recording.webm');

      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-clone', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: language === 'ar' ? 'تم إنشاء النسخة بنجاح' : 'Voice Clone Created',
          description: language === 'ar' ? 'تم إنشاء نسخة من صوتك بنجاح!' : 'Your voice clone has been created successfully!',
        });

        // Reset form
        setAudioBlob(null);
        setAudioUrl(null);
        setVoiceName('');
        setVoiceDescription('');
        setRecordingTime(0);
        
        // Refresh voices list
        onVoicesUpdate();
      } else {
        throw new Error(data.error || 'Failed to create voice clone');
      }
    } catch (error: any) {
      console.error('Voice clone error:', error);
      toast({
        title: language === 'ar' ? 'خطأ في إنشاء النسخة' : 'Voice Clone Error',
        description: error.message || (language === 'ar' ? 'فشل في إنشاء نسخة الصوت.' : 'Failed to create voice clone.'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteVoice = async (voice: VoiceClone) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-clone', {
        body: { voice_id: voice.voice_id },
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: language === 'ar' ? 'تم حذف الصوت' : 'Voice Deleted',
          description: language === 'ar' ? 'تم حذف نسخة الصوت بنجاح.' : 'Voice clone has been deleted successfully.',
        });
        onVoicesUpdate();
      } else {
        throw new Error(data.error || 'Failed to delete voice');
      }
    } catch (error: any) {
      console.error('Delete voice error:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الحذف' : 'Delete Error',
        description: error.message || (language === 'ar' ? 'فشل في حذف نسخة الصوت.' : 'Failed to delete voice clone.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Recording Section */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'تسجيل الصوت' : 'Record Your Voice'}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'سجل صوتك لمدة 30-60 ثانية' : 'Record your voice for 30-60 seconds'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recording Controls */}
            <div className="flex flex-col items-center space-y-4">
              <div className="text-center">
                <div className="text-2xl font-mono text-slate-700 dark:text-slate-300">
                  {formatTime(recordingTime)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? '(الحد الأقصى: 1:00)' : '(Max: 1:00)'}
                </div>
              </div>
              
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                size="lg"
                className={`w-16 h-16 rounded-full ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-accent-blue hover:bg-accent-blue/80 text-white'
                }`}
              >
                {isRecording ? <StopCircle className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              
              {audioUrl && (
                <Button
                  onClick={togglePlayback}
                  variant="outline"
                  className="border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span className="ml-2">{language === 'ar' ? 'تشغيل المعاينة' : 'Preview'}</span>
                </Button>
              )}
            </div>

            {/* Voice Details Form */}
            {audioBlob && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'ar' ? 'اسم الصوت *' : 'Voice Name *'}
                  </label>
                  <Input
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل اسم الصوت' : 'Enter voice name'}
                    className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'ar' ? 'وصف الصوت (اختياري)' : 'Voice Description (Optional)'}
                  </label>
                  <Textarea
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder={language === 'ar' ? 'وصف مختصر للصوت' : 'Brief description of the voice'}
                    className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300"
                    rows={2}
                  />
                </div>
                
                <Button
                  onClick={uploadVoiceClone}
                  disabled={isUploading || !voiceName.trim()}
                  className="w-full bg-accent-green hover:bg-accent-green/80 text-white"
                >
                  {isUploading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'إنشاء نسخة الصوت' : 'Create Voice Clone'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Voices Section */}
        {voices.length > 0 && (
          <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'الأصوات المحفوظة' : 'Saved Voices'}
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {language === 'ar' ? `${voices.length} من الأصوات المحفوظة` : `${voices.length} saved voices`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {voices.map((voice) => (
                  <div key={voice.id} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">
                        {voice.voice_name}
                      </h4>
                      {voice.voice_description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {voice.voice_description}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {new Date(voice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setVoiceToDelete(voice);
                        setDeleteDialogOpen(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex space-x-3 rtl:space-x-reverse">
          <Button 
            onClick={onBack}
            variant="outline"
            className="flex-1 border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'السابق' : 'Back'}
          </Button>
          
          <Button 
            onClick={onNext}
            className="flex-1 bg-accent-blue hover:bg-accent-blue/80 text-white"
          >
            {language === 'ar' ? 'التالي' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف نسخة الصوت' : 'Delete Voice Clone'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من حذف "${voiceToDelete?.voice_name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${voiceToDelete?.voice_name}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (voiceToDelete) {
                  deleteVoice(voiceToDelete);
                }
                setDeleteDialogOpen(false);
                setVoiceToDelete(null);
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}