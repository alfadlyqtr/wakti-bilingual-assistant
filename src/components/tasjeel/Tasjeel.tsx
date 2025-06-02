import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Trash2, 
  Upload,
  FileText,
  Volume2,
  Clock,
  Calendar,
  Settings,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  Globe,
  Lock,
  Zap,
  Brain,
  Volume,
  VolumeX,
  Timer,
  BarChart3,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import AudioControls from './AudioControls';
import PreviousRecordings from './PreviousRecordings';
import { Recording } from './types';

const Tasjeel = () => {
  // State variables
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const isArabic = language === 'ar';
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingNotes, setRecordingNotes] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isPlannedRecording, setIsPlannedRecording] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [reminderBefore, setReminderBefore] = useState('5');
  const [privacyLevel, setPrivacyLevel] = useState<'private' | 'contacts' | 'public'>('private');
  const [maxDuration, setMaxDuration] = useState(60);
  const [autoStop, setAutoStop] = useState(false);
  const [quickSummary, setQuickSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [aiFeatures, setAiFeatures] = useState({
    transcription: true,
    summary: true,
    keyPoints: false,
    sentiment: false,
    translation: false
  });
  const [enhancedFeatures, setEnhancedFeatures] = useState({
    noiseReduction: false,
    autoLeveling: false,
    backgroundMusicRemoval: false
  });
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3');
  const [qualitySettings, setQualitySettings] = useState({
    bitrate: '128',
    sampleRate: '44100',
    channels: 'stereo'
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load recordings from Supabase
  useEffect(() => {
    loadRecordings();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadRecordings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('audio_recordings')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error('Error loading recordings:', error);
      toast.error(isArabic ? 'فشل في تحميل التسجيلات' : 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setCurrentAudioUrl(audioUrl);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
        if (autoStop && seconds >= maxDuration) {
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(isArabic ? 'فشل في بدء التسجيل' : 'Failed to start recording');
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current as NodeJS.Timeout);
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current as NodeJS.Timeout);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  // Play audio
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);

      let seconds = 0;
      playbackTimerRef.current = setInterval(() => {
        seconds++;
        setPlaybackTime(seconds);
      }, 1000);
    }
  };

  // Pause audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      clearInterval(playbackTimerRef.current as NodeJS.Timeout);
    }
  };

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false);
    clearInterval(playbackTimerRef.current as NodeJS.Timeout);
    setPlaybackTime(0);
  };

  // Upload recording to Supabase
  const uploadRecording = async () => {
    if (!currentAudioUrl) {
      toast.error(isArabic ? 'لا يوجد تسجيل للرفع' : 'No recording to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const audioBlob = await fetch(currentAudioUrl).then(r => r.blob());
      const file = new File([audioBlob], `${recordingTitle || 'recording'}-${Date.now()}.${exportFormat}`, { type: `audio/${exportFormat}` });
      
      const { data, error, progress } = await supabase.storage
        .from('audio-recordings')
        .upload(`${user?.id}/${file.name}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Monitor upload progress
      progress((uploadProgress) => {
        setUploadProgress(uploadProgress.progress);
      });

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(`${user?.id}/${file.name}`);

      // Save recording details to Supabase
      const { error: dbError } = await supabase
        .from('audio_recordings')
        .insert([
          {
            user_id: user?.id,
            title: recordingTitle || 'Untitled Recording',
            notes: recordingNotes || null,
            audio_url: publicUrlData.publicUrl,
            duration: recordingTime,
            privacy_level: privacyLevel,
            ai_features: aiFeatures,
            enhanced_features: enhancedFeatures,
            export_format: exportFormat,
            quality_settings: qualitySettings
          }
        ]);

      if (dbError) throw dbError;

      toast.success(isArabic ? 'تم رفع التسجيل بنجاح' : 'Recording uploaded successfully');
      loadRecordings();
      resetRecordingState();
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast.error(isArabic ? 'فشل في رفع التسجيل' : 'Failed to upload recording');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete recording from Supabase
  const deleteRecording = async (recordingId: string) => {
    try {
      setIsLoading(true);
      const { data: recordingToDelete, error: selectError } = await supabase
        .from('audio_recordings')
        .select('audio_url')
        .eq('id', recordingId)
        .single();

      if (selectError) throw selectError;

      // Extract file path from audio_url
      const filePath = recordingToDelete.audio_url.replace(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio-recordings/`, "");

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('audio-recordings')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete recording from database
      const { error: deleteError } = await supabase
        .from('audio_recordings')
        .delete()
        .eq('id', recordingId);

      if (deleteError) throw deleteError;

      toast.success(isArabic ? 'تم حذف التسجيل بنجاح' : 'Recording deleted successfully');
      loadRecordings();
      resetRecordingState();
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error(isArabic ? 'فشل في حذف التسجيل' : 'Failed to delete recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset recording state
  const resetRecordingState = () => {
    setCurrentAudioUrl(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    setRecordingTitle('');
    setRecordingNotes('');
    setSelectedRecording(null);
    setIsPlannedRecording(false);
    setScheduleDateTime('');
    setReminderBefore('5');
    setPrivacyLevel('private');
    setMaxDuration(60);
    setAutoStop(false);
    setQuickSummary('');
    setIsProcessing(false);
    setProcessingStage('');
    setAiFeatures({
      transcription: true,
      summary: true,
      keyPoints: false,
      sentiment: false,
      translation: false
    });
    setEnhancedFeatures({
      noiseReduction: false,
      autoLeveling: false,
      backgroundMusicRemoval: false
    });
    setExportFormat('mp3');
    setQualitySettings({
      bitrate: '128',
      sampleRate: '44100',
      channels: 'stereo'
    });
  };

  // Process recording with AI
  const processRecordingWithAI = async () => {
    if (!currentAudioUrl) {
      toast.error(isArabic ? 'لا يوجد تسجيل للمعالجة' : 'No recording to process');
      return;
    }

    setIsProcessing(true);
    setProcessingStage(isArabic ? 'جاري التحضير...' : 'Preparing...');

    try {
      // Simulate processing steps
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingStage(isArabic ? 'جاري النسخ...' : 'Transcribing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProcessingStage(isArabic ? 'جاري التلخيص...' : 'Summarizing...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingStage(isArabic ? 'جاري استخراج النقاط الرئيسية...' : 'Extracting key points...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setQuickSummary(isArabic ? 'تمت معالجة التسجيل بنجاح!' : 'Recording processed successfully!');
      toast.success(isArabic ? 'تمت معالجة التسجيل بنجاح' : 'Recording processed successfully');
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error(isArabic ? 'فشل في معالجة التسجيل' : 'Failed to process recording');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {isArabic ? 'تسجيل' : 'Tasjeel'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isArabic ? 'تسجيل صوتي ذكي' : 'Smart Audio Recording'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isRecording ? 'destructive' : 'secondary'} className="animate-pulse">
            {isRecording ? (
              isArabic ? 'جاري التسجيل' : 'Recording'
            ) : (
              isArabic ? 'جاهز' : 'Ready'
            )}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="record" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              {isArabic ? 'تسجيل' : 'Record'}
            </TabsTrigger>
            <TabsTrigger value="recordings" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {isArabic ? 'التسجيلات' : 'Recordings'}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {isArabic ? 'الإعدادات' : 'Settings'}
            </TabsTrigger>
          </TabsList>

          {/* Record Tab */}
          <TabsContent value="record" className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Recording Controls */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold">
                    {isArabic ? 'التحكم في التسجيل' : 'Recording Controls'}
                  </h2>
                  <Badge variant="outline">
                    {isArabic ? 'الوضع التجريبي' : 'Beta'}
                  </Badge>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    {/* Record Button */}
                    {!isRecording && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={startRecording}
                        disabled={isLoading}
                      >
                        <Mic className="mr-2 h-5 w-5" />
                        {isArabic ? 'تسجيل' : 'Record'}
                      </Button>
                    )}

                    {/* Pause/Resume Buttons */}
                    {isRecording && (
                      <>
                        {isPaused ? (
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={resumeRecording}
                            disabled={isLoading}
                          >
                            <Play className="mr-2 h-5 w-5" />
                            {isArabic ? 'استئناف' : 'Resume'}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={pauseRecording}
                            disabled={isLoading}
                          >
                            <Pause className="mr-2 h-5 w-5" />
                            {isArabic ? 'إيقاف مؤقت' : 'Pause'}
                          </Button>
                        )}
                      </>
                    )}

                    {/* Stop Button */}
                    {isRecording && (
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={stopRecording}
                        disabled={isLoading}
                      >
                        <Square className="mr-2 h-5 w-5" />
                        {isArabic ? 'إيقاف' : 'Stop'}
                      </Button>
                    )}
                  </div>

                  {/* Recording Timer */}
                  <div className="flex items-center justify-center">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {isArabic ? 'وقت التسجيل:' : 'Recording Time:'}
                    </span>
                    <span className="font-medium">
                      {format(new Date(recordingTime * 1000), 'mm:ss')}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Audio Preview */}
              {currentAudioUrl && (
                <Card className="space-y-4">
                  <div className="flex items-center justify-between p-4">
                    <h2 className="text-lg font-semibold">
                      {isArabic ? 'معاينة الصوت' : 'Audio Preview'}
                    </h2>
                  </div>
                  <Separator />
                  <div className="p-4 space-y-4">
                    <audio
                      ref={audioRef}
                      src={currentAudioUrl}
                      onEnded={handleAudioEnded}
                      className="w-full"
                    />
                    <AudioControls
                      isPlaying={isPlaying}
                      playbackTime={playbackTime}
                      duration={recordingTime}
                      onPlay={playAudio}
                      onPause={pauseAudio}
                    />
                  </div>
                </Card>
              )}

              {/* Recording Details */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold">
                    {isArabic ? 'تفاصيل التسجيل' : 'Recording Details'}
                  </h2>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <Label htmlFor="title">
                      {isArabic ? 'العنوان' : 'Title'}
                    </Label>
                    <Input
                      type="text"
                      id="title"
                      placeholder={isArabic ? 'أدخل عنوان التسجيل' : 'Enter recording title'}
                      value={recordingTitle}
                      onChange={(e) => setRecordingTitle(e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">
                      {isArabic ? 'ملاحظات' : 'Notes'}
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder={isArabic ? 'أضف ملاحظات حول التسجيل' : 'Add notes about the recording'}
                      value={recordingNotes}
                      onChange={(e) => setRecordingNotes(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* AI Processing */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold">
                    {isArabic ? 'معالجة الذكاء الاصطناعي' : 'AI Processing'}
                  </h2>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* AI Features */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {isArabic ? 'الميزات' : 'Features'}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="transcription"
                          checked={aiFeatures.transcription}
                          onCheckedChange={(checked) => setAiFeatures({ ...aiFeatures, transcription: checked })}
                        />
                        <Label htmlFor="transcription">
                          {isArabic ? 'نسخ' : 'Transcription'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="summary"
                          checked={aiFeatures.summary}
                          onCheckedChange={(checked) => setAiFeatures({ ...aiFeatures, summary: checked })}
                        />
                        <Label htmlFor="summary">
                          {isArabic ? 'ملخص' : 'Summary'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="keyPoints"
                          checked={aiFeatures.keyPoints}
                          onCheckedChange={(checked) => setAiFeatures({ ...aiFeatures, keyPoints: checked })}
                        />
                        <Label htmlFor="keyPoints">
                          {isArabic ? 'نقاط رئيسية' : 'Key Points'}
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Features */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {isArabic ? 'ميزات محسنة' : 'Enhanced Features'}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="noiseReduction"
                          checked={enhancedFeatures.noiseReduction}
                          onCheckedChange={(checked) => setEnhancedFeatures({ ...enhancedFeatures, noiseReduction: checked })}
                        />
                        <Label htmlFor="noiseReduction">
                          {isArabic ? 'تقليل الضوضاء' : 'Noise Reduction'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="autoLeveling"
                          checked={enhancedFeatures.autoLeveling}
                          onCheckedChange={(checked) => setEnhancedFeatures({ ...enhancedFeatures, autoLeveling: checked })}
                        />
                        <Label htmlFor="autoLeveling">
                          {isArabic ? 'تسوية تلقائية' : 'Auto Leveling'}
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Process Button */}
                  <Button
                    variant="secondary"
                    onClick={processRecordingWithAI}
                    disabled={isLoading || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {processingStage || (isArabic ? 'جاري المعالجة...' : 'Processing...')}
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        {isArabic ? 'معالجة مع الذكاء الاصطناعي' : 'Process with AI'}
                      </>
                    )}
                  </Button>

                  {/* Quick Summary */}
                  {quickSummary && (
                    <Alert className="mt-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        {quickSummary}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>

              {/* Upload */}
              {currentAudioUrl && (
                <Card className="space-y-4">
                  <div className="flex items-center justify-between p-4">
                    <h2 className="text-lg font-semibold">
                      {isArabic ? 'رفع التسجيل' : 'Upload Recording'}
                    </h2>
                  </div>
                  <Separator />
                  <div className="p-4 space-y-4">
                    {/* Privacy Level */}
                    <div>
                      <Label htmlFor="privacy">
                        {isArabic ? 'مستوى الخصوصية' : 'Privacy Level'}
                      </Label>
                      <Select value={privacyLevel} onValueChange={(value) => setPrivacyLevel(value as 'private' | 'contacts' | 'public')}>
                        <SelectTrigger>
                          <SelectValue placeholder={isArabic ? 'اختر مستوى الخصوصية' : 'Select privacy level'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">
                            {isArabic ? 'خاص' : 'Private'}
                          </SelectItem>
                          <SelectItem value="contacts">
                            {isArabic ? 'جهات الاتصال' : 'Contacts'}
                          </SelectItem>
                          <SelectItem value="public">
                            {isArabic ? 'عام' : 'Public'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Upload Button */}
                    <Button
                      variant="primary"
                      onClick={uploadRecording}
                      disabled={isLoading || isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isArabic ? 'جاري الرفع...' : 'Uploading...'}
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {isArabic ? 'رفع' : 'Upload'}
                        </>
                      )}
                    </Button>

                    {/* Upload Progress */}
                    {isUploading && (
                      <Progress value={uploadProgress} />
                    )}
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Recordings Tab */}
          <TabsContent value="recordings" className="flex-1 p-4 overflow-y-auto">
            <PreviousRecordings
              recordings={recordings}
              selectedRecording={selectedRecording}
              onSelectRecording={setSelectedRecording}
              onDeleteRecording={deleteRecording}
              isLoading={isLoading}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Recording Settings */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold">
                    {isArabic ? 'إعدادات التسجيل' : 'Recording Settings'}
                  </h2>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* Max Duration */}
                  <div>
                    <Label htmlFor="maxDuration">
                      {isArabic ? 'الحد الأقصى للمدة (ثواني)' : 'Max Duration (seconds)'}
                    </Label>
                    <Input
                      type="number"
                      id="maxDuration"
                      placeholder="60"
                      value={maxDuration.toString()}
                      onChange={(e) => setMaxDuration(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Auto Stop */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="autoStop">
                      {isArabic ? 'إيقاف تلقائي' : 'Auto Stop'}
                    </Label>
                    <Switch
                      id="autoStop"
                      checked={autoStop}
                      onCheckedChange={setAutoStop}
                    />
                  </div>
                </div>
              </Card>

              {/* Export Settings */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold">
                    {isArabic ? 'إعدادات التصدير' : 'Export Settings'}
                  </h2>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* Export Format */}
                  <div>
                    <Label htmlFor="exportFormat">
                      {isArabic ? 'تنسيق التصدير' : 'Export Format'}
                    </Label>
                    <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'mp3' | 'wav' | 'ogg')}>
                      <SelectTrigger>
                        <SelectValue placeholder={isArabic ? 'اختر تنسيق التصدير' : 'Select export format'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3</SelectItem>
                        <SelectItem value="wav">WAV</SelectItem>
                        <SelectItem value="ogg">OGG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quality Settings */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {isArabic ? 'إعدادات الجودة' : 'Quality Settings'}
                    </h3>
                    {/* Bitrate */}
                    <div>
                      <Label htmlFor="bitrate">
                        {isArabic ? 'معدل البت' : 'Bitrate'}
                      </Label>
                      <Select value={qualitySettings.bitrate} onValueChange={(value) => setQualitySettings({ ...qualitySettings, bitrate: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="128" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="96">96 kbps</SelectItem>
                          <SelectItem value="128">128 kbps</SelectItem>
                          <SelectItem value="192">192 kbps</SelectItem>
                          <SelectItem value="256">256 kbps</SelectItem>
                          <SelectItem value="320">320 kbps</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sample Rate */}
                    <div>
                      <Label htmlFor="sampleRate">
                        {isArabic ? 'معدل العينة' : 'Sample Rate'}
                      </Label>
                      <Select value={qualitySettings.sampleRate} onValueChange={(value) => setQualitySettings({ ...qualitySettings, sampleRate: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="44100" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22050">22050 Hz</SelectItem>
                          <SelectItem value="44100">44100 Hz</SelectItem>
                          <SelectItem value="48000">48000 Hz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Channels */}
                    <div>
                      <Label htmlFor="channels">
                        {isArabic ? 'القنوات' : 'Channels'}
                      </Label>
                      <Select value={qualitySettings.channels} onValueChange={(value) => setQualitySettings({ ...qualitySettings, channels: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={isArabic ? 'ستيريو' : 'Stereo'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mono">{isArabic ? 'أحادي' : 'Mono'}</SelectItem>
                          <SelectItem value="stereo">{isArabic ? 'ستيريو' : 'Stereo'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Tasjeel;
