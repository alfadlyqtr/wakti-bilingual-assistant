
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mic, Square, Upload, FileAudio, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';
import WaveformVisualizer from "./WaveformVisualizer";
import HighlightedTimestamps, { Highlight } from "./HighlightedTimestamps";
import { getBestSupportedMimeType, getFileExtension, generateRecordingPath, formatRecordingTime } from "@/utils/audioUtils";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated?: (recording: any) => void;
}

export default function RecordingDialog({ isOpen, onClose, onRecordingCreated }: RecordingDialogProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingFormat, setRecordingFormat] = useState<string>('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  
  // UI states
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [location, setLocation] = useState("");
  const [cleanAudio, setCleanAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Processing states
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaveComplete, setIsSaveComplete] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl, audioStream]);

  // Generate title from transcript
  useEffect(() => {
    if (transcript && !title.trim()) {
      generateTitleSuggestion(transcript);
    }
  }, [transcript, title]);

  const startRecording = async () => {
    try {
      // Get current user - needed for saving the recording
      if (!user) {
        toast.error(language === 'ar' ? 'يجب تسجيل الدخول لاستخدام الإدخال الصوتي' : 'Login required for voice input');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setAudioStream(stream);
      
      // Use the supported MIME type - prioritize MP3
      const mimeType = getBestSupportedMimeType();
      console.log(`Using MIME type for recording: ${mimeType}`);
      setRecordingFormat(mimeType);
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log(`Recording complete: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        
        // Process transcription if desired
        processTranscription(audioBlob);
      };
      
      audioChunksRef.current = [];
      mediaRecorderRef.current.start(1000); // Collect data in 1-second chunks
      setIsRecording(true);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
      
      toast.info(language === 'ar' ? 'بدأ التسجيل... تحدث الآن' : 'Recording started... speak now');
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error(language === 'ar' 
        ? 'يرجى السماح بالوصول إلى الميكروفون للاستفادة من ميزة الإدخال الصوتي'
        : 'Please allow microphone access to use voice input feature');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      setAudioStream(null);
      
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.info(language === 'ar' ? 'جارِ معالجة التسجيل' : 'Processing recording');
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      setAudioStream(null);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Reset recording state
      audioChunksRef.current = [];
      setRecordingTime(0);
      setHighlights([]);
      
      toast.info(language === 'ar' ? 'تم إلغاء التسجيل' : 'Recording cancelled');
    }
  };
  
  const addHighlight = () => {
    setHighlights(prev => [...prev, { timestamp: recordingTime }]);
    toast.success(
      language === 'ar' 
        ? `تمت إضافة علامة عند ${formatRecordingTime(recordingTime)}` 
        : `Highlight added at ${formatRecordingTime(recordingTime)}`
    );
  };
  
  const removeHighlight = (index: number) => {
    setHighlights(prev => prev.filter((_, i) => i !== index));
  };

  const processTranscription = async (blob: Blob) => {
    if (!user) return;
    
    try {
      console.log(`Processing audio blob for transcription: ${blob.size} bytes, type: ${blob.type}`);
      
      // Create a form data object
      const formData = new FormData();
      formData.append('audio', blob, `recording.${getFileExtension(blob.type)}`);
      
      // Get auth session for API call
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('No auth session');
      }
      
      setIsTranscribing(true);
      
      // Call the transcribe-audio edge function directly with the blob
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription error response:', errorText);
        throw new Error(`Transcription failed: ${errorText}`);
      }
      
      const { text } = await response.json();
      setTranscript(text);
      setIsTranscribing(false);
    } catch (err) {
      console.error('Error getting transcript:', err);
      setIsTranscribing(false);
      toast.error(language === 'ar' 
        ? `فشل في الحصول على النص: ${err.message}` 
        : `Failed to transcribe: ${err.message}`);
    }
  };
  
  const generateTitleSuggestion = async (text: string) => {
    // Generate a simple title based on the transcript content
    setIsGeneratingSuggestion(true);
    try {
      // Split the transcript into sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Take the first sentence or part of it if it's long
      let suggestion = sentences[0]?.trim() || text.substring(0, 30);
      
      // If it's too long, truncate it to a reasonable length
      if (suggestion.length > 50) {
        suggestion = suggestion.substring(0, 47) + '...';
      }
      
      // Ensure the first letter is capitalized
      suggestion = suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
      
      setSuggestedTitle(suggestion);
    } catch (err) {
      console.error('Error generating title suggestion:', err);
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check if file is an audio file
      if (!file.type.startsWith('audio/')) {
        toast.error(language === 'ar' 
          ? 'يرجى تحديد ملف صوتي' 
          : 'Please select an audio file');
        return;
      }
      
      console.log(`Selected file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      setSelectedFile(file);
      setRecordingFormat(file.type);
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioBlob(file);
      
      // Try to generate transcript from the uploaded file too
      processTranscription(file);
    }
  };
  
  const handleSaveRecording = async () => {
    if (!user) {
      toast.error(language === 'ar' 
        ? 'يجب تسجيل الدخول لحفظ التسجيل' 
        : 'You must be logged in to save a recording');
      return;
    }
    
    if (!audioBlob) {
      toast.error(language === 'ar' 
        ? 'لا يوجد تسجيل للحفظ' 
        : 'No recording to save');
      return;
    }
    
    // Title is no longer mandatory - use a default if not provided
    const recordingTitle = title.trim() || suggestedTitle || (language === 'ar' ? 'تسجيل جديد' : 'New Recording');
    
    try {
      setIsUploading(true);
      
      // Create unique ID for the recording
      const recordingId = uuidv4();
      
      // Create standardized file path in storage
      const filePath = generateRecordingPath(user.id, recordingId);
      console.log(`Saving recording to path: ${filePath}`);
      
      // Upload the audio file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/mpeg', // Always use MP3 content type
          upsert: false
        });
      
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      
      // Get public URL for the file
      const { data: publicUrlData } = await supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);
      
      // Create a new voice_summaries entry in the database
      const { data: recordingData, error: recordingError } = await supabase
        .from('voice_summaries')
        .insert({
          id: recordingId,
          title: recordingTitle,
          audio_url: publicUrlData.publicUrl,
          type: 'meeting',
          host: user.id,
          user_id: user.id,
          attendees: attendees || null,
          location: location || null,
          transcript: transcript || null,
          clean_audio: cleanAudio,
          highlighted_timestamps: highlights.length > 0 ? highlights : null,
          expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
        })
        .select()
        .single();
      
      if (recordingError) {
        throw new Error(recordingError.message);
      }
      
      // Mark save as complete
      setIsSaveComplete(true);
      
      // If transcript wasn't already generated, trigger transcription function
      if (!transcript) {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ recordingId: filePath, summaryId: recordingId })
          });
        } catch (functionError) {
          console.error('Error triggering transcription function:', functionError);
          // Continue execution - the error in triggering the function shouldn't block the user
        }
      }
      
      // Show success message
      toast.success(language === 'ar' 
        ? 'تم حفظ التسجيل بنجاح' 
        : 'Recording saved successfully');
      
      // Notify the parent component
      if (onRecordingCreated && recordingData) {
        onRecordingCreated(recordingData);
      }
      
      // Briefly wait to ensure UI updates before closing dialog
      setTimeout(() => {
        handleDialogClose();
      }, 1000);
      
    } catch (err) {
      console.error('Error saving recording:', err);
      toast.error(language === 'ar' 
        ? `فشل في حفظ التسجيل: ${err.message}` 
        : `Failed to save recording: ${err.message}`);
      setIsUploading(false);
    }
  };
  
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setSelectedFile(null);
    setTranscript(null);
    setSuggestedTitle(null);
    setHighlights([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDialogClose = () => {
    if (isUploading) {
      return; // Prevent closing while uploading
    }
    
    resetRecording();
    setTitle("");
    setAttendees("");
    setLocation("");
    setCleanAudio(false);
    setIsUploading(false);
    setIsSaveComplete(false);
    onClose();
  };
  
  const useSuggestedTitle = () => {
    if (suggestedTitle) {
      setTitle(suggestedTitle);
      setSuggestedTitle(null); // Clear the suggestion after using it
    }
  };

  // Determine if we're in a loading state
  const isLoading = isUploading || isTranscribing;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          handleDialogClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{language === 'ar' ? 'تسجيل جديد' : 'New Recording'}</span>
            {!isUploading && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleDialogClose}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">
              {language === 'ar' ? 'العنوان' : 'Title'} 
            </Label>
            <div className="relative">
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={language === 'ar' ? 'عنوان التسجيل (اختياري)' : 'Recording title (optional)'}
                disabled={isLoading}
              />
              {suggestedTitle && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === 'ar' ? 'العنوان المقترح: ' : 'Suggested title: '}
                    <span className="font-medium text-primary">{suggestedTitle}</span>
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={useSuggestedTitle} 
                    className="h-6 px-2 text-xs"
                  >
                    {language === 'ar' ? 'استخدم' : 'Use'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="attendees">
              {language === 'ar' ? 'الحضور' : 'Attendees'} ({language === 'ar' ? 'اختياري' : 'optional'})
            </Label>
            <Input
              id="attendees"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder={language === 'ar' ? 'أسماء مفصولة بفواصل' : 'Names separated by commas'}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">
              {language === 'ar' ? 'الموقع' : 'Location'} ({language === 'ar' ? 'اختياري' : 'optional'})
            </Label>
            <Input
              id="location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={language === 'ar' ? 'مكان التسجيل' : 'Recording location'}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="clean-audio"
              checked={cleanAudio}
              onCheckedChange={setCleanAudio}
              disabled={isLoading}
            />
            <Label htmlFor="clean-audio">
              {language === 'ar' ? 'تحسين جودة الصوت' : 'Clean Audio'} 
              <span className="text-xs text-muted-foreground block">
                {language === 'ar' ? 'إزالة الضوضاء والخلفية' : 'Remove noise and background sounds'}
              </span>
            </Label>
          </div>
          
          <div className="border rounded-md p-4">
            <div className="space-y-3">
              {!audioBlob ? (
                <>
                  {!isRecording ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startRecording}
                        className="flex items-center gap-1 w-full sm:w-auto"
                        disabled={isLoading}
                      >
                        <Mic className="h-4 w-4 mr-1" />
                        {language === 'ar' ? 'بدء التسجيل' : 'Start Recording'}
                      </Button>
                      
                      <div className="relative w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 w-full sm:w-auto"
                          disabled={isLoading}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'تحميل ملف' : 'Upload File'}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleFileChange}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                          <Mic className="h-8 w-8 text-red-500" />
                        </div>
                      </div>
                      
                      <div className="text-lg font-mono">
                        {formatRecordingTime(recordingTime)}
                      </div>
                      
                      {/* Waveform visualization */}
                      <div className="w-full h-16 bg-muted/20 rounded-md overflow-hidden">
                        <WaveformVisualizer 
                          isRecording={isRecording} 
                          audioStream={audioStream}
                        />
                      </div>
                      
                      {/* Highlight timestamps */}
                      <HighlightedTimestamps 
                        highlights={highlights}
                        onRemove={removeHighlight}
                        recordingTime={recordingTime}
                        onAddHighlight={addHighlight}
                        isRecording={isRecording}
                      />
                      
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={stopRecording}
                          className="flex items-center gap-1"
                          disabled={isLoading}
                        >
                          <Square className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording'}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={cancelRecording}
                          className="flex items-center gap-1"
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <FileAudio className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : 'recording.mp3'}
                  </div>
                  
                  <audio src={audioUrl || ''} controls className="w-full" />
                  
                  {/* Display highlights if any */}
                  {highlights.length > 0 && (
                    <HighlightedTimestamps 
                      highlights={highlights}
                      onRemove={removeHighlight}
                    />
                  )}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetRecording}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {language === 'ar' ? 'إعادة التسجيل' : 'Record Again'}
                  </Button>
                </div>
              )}
              
              {isTranscribing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{language === 'ar' ? 'جاري معالجة النص...' : 'Processing transcription...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDialogClose}
            disabled={isLoading}
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleSaveRecording}
            disabled={!audioBlob || isLoading}
            className={isLoading ? 'opacity-70' : ''}
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{language === 'ar' ? 'جار الحفظ...' : 'Saving...'}</span>
              </div>
            ) : (
              language === 'ar' ? 'حفظ التسجيل' : 'Save Recording'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
