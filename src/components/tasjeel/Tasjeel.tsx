
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Share2,
  Clock,
  FileAudio,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import AudioControls from './AudioControls';
import SavedRecordings from './SavedRecordings';

// Define Recording interface locally since it's not in types.ts
interface Recording {
  id: string;
  title: string;
  url: string;
  duration: number;
  created_at: Date;
  blob?: Blob;
  transcription?: string | null;
}

export default function Tasjeel() {
  const { theme, language } = useTheme();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.addEventListener('ended', () => {
      setIsPlaying(false);
    });
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', () => {
          setIsPlaying(false);
        });
      }
    };
  }, []);
  
  // Load recordings on mount
  useEffect(() => {
    loadRecordings();
  }, [user]);
  
  const loadRecordings = async () => {
    if (!user) {
      setRecordings([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      const formattedRecordings: Recording[] = data.map(item => ({
        id: item.id,
        title: item.title || format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
        url: item.url,
        duration: item.duration || 0,
        created_at: new Date(item.created_at),
        transcription: item.transcription || null
      }));
      
      setRecordings(formattedRecordings);
    } catch (error) {
      console.error('Error loading recordings:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل التسجيلات' : 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const newRecording: Recording = {
          id: Date.now().toString(),
          title: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          url: audioUrl,
          duration: recordingTime,
          created_at: new Date(),
          blob: audioBlob,
          transcription: null
        };
        
        setCurrentRecording(newRecording);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      
      // Start timer
      startTimer();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording');
    }
  };
  
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        
        // Resume timer
        startTimer();
      }
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };
  
  const resetRecording = () => {
    setCurrentRecording(null);
    setRecordingTime(0);
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const playRecording = (recording: Recording) => {
    if (audioRef.current) {
      // Stop current audio if playing
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Play new recording
      audioRef.current.src = recording.url;
      audioRef.current.play();
      setIsPlaying(true);
      setCurrentRecording(recording);
    }
  };
  
  const pausePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const saveRecording = async () => {
    if (!currentRecording || !currentRecording.blob || !user) {
      toast.error(language === 'ar' ? 'لا يوجد تسجيل للحفظ' : 'No recording to save');
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Upload to storage
      const fileName = `recordings/${user.id}/${Date.now()}.wav`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(fileName, currentRecording.blob);
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('user-content')
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;
      
      // Save to database
      const { data, error } = await supabase
        .from('recordings')
        .insert([
          {
            user_id: user.id,
            title: currentRecording.title,
            url: publicUrl,
            duration: currentRecording.duration,
            file_path: fileName
          }
        ])
        .select();
      
      if (error) {
        throw error;
      }
      
      toast.success(language === 'ar' ? 'تم حفظ التسجيل بنجاح' : 'Recording saved successfully');
      
      // Refresh recordings list
      await loadRecordings();
      
      // Reset current recording
      resetRecording();
      
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
    } finally {
      setIsUploading(false);
    }
  };
  
  const deleteRecording = async (id: string) => {
    try {
      setIsDeleting(true);
      
      // Find recording to get file path
      const recording = recordings.find(r => r.id === id);
      if (!recording) return;
      
      // Delete from database
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Refresh recordings list
      await loadRecordings();
      
      toast.success(language === 'ar' ? 'تم حذف التسجيل بنجاح' : 'Recording deleted successfully');
      
      // Reset current recording if it was the one deleted
      if (currentRecording && currentRecording.id === id) {
        resetRecording();
      }
      
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error(language === 'ar' ? 'فشل في حذف التسجيل' : 'Failed to delete recording');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const downloadRecording = (recording: Recording) => {
    if (!recording.url) return;
    
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `${recording.title || 'recording'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Recording Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <span>{language === 'ar' ? 'تسجيل صوتي جديد' : 'New Voice Recording'}</span>
                </div>
                {isRecording && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">
                    {language === 'ar' ? 'جاري التسجيل' : 'Recording'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Recording Controls */}
              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                {/* Timer Display */}
                <div className="text-4xl font-mono font-bold">
                  {formatTime(recordingTime)}
                </div>
                
                {/* Recording Controls */}
                <div className="flex items-center gap-4">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      size="lg"
                      className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600"
                    >
                      <Mic className="h-8 w-8" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={pauseRecording}
                        size="lg"
                        variant="outline"
                        className="h-14 w-14 rounded-full border-2"
                      >
                        {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
                      </Button>
                      
                      <Button
                        onClick={stopRecording}
                        size="lg"
                        variant="destructive"
                        className="h-16 w-16 rounded-full"
                      >
                        <Square className="h-8 w-8" />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Recording Status */}
                <div className="text-sm text-muted-foreground">
                  {isRecording
                    ? (isPaused
                      ? (language === 'ar' ? 'تم إيقاف التسجيل مؤقتًا' : 'Recording paused')
                      : (language === 'ar' ? 'جاري التسجيل...' : 'Recording in progress...'))
                    : (language === 'ar' ? 'اضغط على زر الميكروفون لبدء التسجيل' : 'Press the microphone button to start recording')}
                </div>
              </div>
              
              {/* Current Recording Preview */}
              {currentRecording && !isRecording && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-medium mb-4">
                    {language === 'ar' ? 'معاينة التسجيل' : 'Recording Preview'}
                  </h3>
                  
                  <AudioControls
                    recording={currentRecording}
                    isPlaying={isPlaying && currentRecording.id === currentRecording.id}
                    onPlay={() => playRecording(currentRecording)}
                    onPause={pausePlayback}
                    onDelete={resetRecording}
                  />
                  
                  <div className="flex justify-end mt-4 gap-2">
                    <Button
                      variant="outline"
                      onClick={resetRecording}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {language === 'ar' ? 'تجاهل' : 'Discard'}
                    </Button>
                    
                    <Button
                      onClick={saveRecording}
                      className="gap-2"
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {language === 'ar' ? 'حفظ التسجيل' : 'Save Recording'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Saved Recordings */}
          <SavedRecordings
            recordings={recordings}
            currentRecording={currentRecording}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onPlay={playRecording}
            onPause={pausePlayback}
            onDelete={deleteRecording}
            onDownload={downloadRecording}
          />
        </div>
      </div>
    </div>
  );
}
