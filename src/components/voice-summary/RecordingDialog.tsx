
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Upload, FileAudio, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated?: (recording: any) => void;
}

export default function RecordingDialog({ isOpen, onClose, onRecordingCreated }: RecordingDialogProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [location, setLocation] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Generate title from transcript
  useEffect(() => {
    if (transcript && !title.trim()) {
      generateTitleSuggestion(transcript);
    }
  }, [transcript, title]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        
        // Quick check for transcript of the recording
        getTranscript(audioBlob);
      };
      
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({
        variant: "destructive",
        description: language === 'ar' 
          ? 'فشل في الوصول إلى الميكروفون' 
          : 'Failed to access the microphone',
      });
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setIsRecording(false);
      
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Reset recording state
      audioChunksRef.current = [];
      setRecordingTime(0);
      
      toast({
        description: language === 'ar' 
          ? 'تم إلغاء التسجيل' 
          : 'Recording cancelled',
      });
    }
  };
  
  const getTranscript = async (blob: Blob) => {
    if (!user) return;
    
    try {
      // Create a form data object
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      // Get auth session for API call
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('No auth session');
      }
      
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
        throw new Error('Transcription failed');
      }
      
      const { text } = await response.json();
      setTranscript(text);
    } catch (err) {
      console.error('Error getting transcript:', err);
    }
  };
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check if file is an audio file
      if (!file.type.startsWith('audio/')) {
        toast({
          variant: "destructive",
          description: language === 'ar' 
            ? 'يرجى تحديد ملف صوتي' 
            : 'Please select an audio file',
        });
        return;
      }
      
      setSelectedFile(file);
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioBlob(file);
      
      // Try to generate transcript from the uploaded file too
      getTranscript(file);
    }
  };
  
  const handleSaveRecording = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        description: language === 'ar' 
          ? 'يجب تسجيل الدخول لحفظ التسجيل' 
          : 'You must be logged in to save a recording',
      });
      return;
    }
    
    if (!audioBlob) {
      toast({
        variant: "destructive",
        description: language === 'ar' 
          ? 'لا يوجد تسجيل للحفظ' 
          : 'No recording to save',
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        variant: "destructive",
        description: language === 'ar' 
          ? 'يرجى إدخال عنوان للتسجيل' 
          : 'Please enter a title for the recording',
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create unique ID for the recording
      const recordingId = uuidv4();
      
      // Create file path in storage
      const fileExt = selectedFile 
        ? selectedFile.name.split('.').pop() 
        : 'webm';
      
      const filePath = `voice_summaries/${user.id}/${recordingId}/recording.${fileExt}`;
      
      // Upload the audio file to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, audioBlob);
      
      if (storageError) {
        throw new Error(storageError.message);
      }
      
      // Get public URL for the file
      const { data: publicUrlData } = await supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);
      
      // Create metadata object
      const metadata = {
        location: location || null,
        attendees: attendees ? attendees.split(',').map(a => a.trim()) : [],
      };
      
      // Create a new voice_summaries entry in the database
      const { data: recordingData, error: recordingError } = await supabase
        .from('voice_summaries')
        .insert({
          id: recordingId,
          title: title,
          audio_url: publicUrlData.publicUrl,
          type: 'meeting',
          host: user.id,
          user_id: user.id,
          attendees: attendees || null,
          location: location || null,
          transcript: transcript || null,
          summary: null,
          expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
        })
        .select()
        .single();
      
      if (recordingError) {
        throw new Error(recordingError.message);
      }
      
      // Notify the parent component
      if (onRecordingCreated && recordingData) {
        onRecordingCreated(recordingData);
      }
      
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
      toast({
        description: language === 'ar' 
          ? 'تم حفظ التسجيل بنجاح' 
          : 'Recording saved successfully',
      });
      
      // Close the dialog
      onClose();
      
    } catch (err) {
      console.error('Error saving recording:', err);
      toast({
        variant: "destructive",
        description: language === 'ar' 
          ? `فشل في حفظ التسجيل: ${err.message}` 
          : `Failed to save recording: ${err.message}`,
      });
    } finally {
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDialogClose = () => {
    resetRecording();
    setTitle("");
    setAttendees("");
    setLocation("");
    onClose();
  };
  
  const useSuggestedTitle = () => {
    if (suggestedTitle) {
      setTitle(suggestedTitle);
      setSuggestedTitle(null); // Clear the suggestion after using it
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تسجيل جديد' : 'New Recording'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">
              {language === 'ar' ? 'العنوان' : 'Title'} *
            </Label>
            <div className="relative">
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={language === 'ar' ? 'عنوان التسجيل' : 'Recording title'}
                disabled={isUploading}
                required
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
              disabled={isUploading}
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
              disabled={isUploading}
            />
          </div>
          
          <div className="border rounded-md p-4">
            <div className="space-y-3">
              {!audioBlob ? (
                <>
                  {!isRecording ? (
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startRecording}
                        className="flex items-center gap-1"
                        disabled={isUploading}
                      >
                        <Mic className="h-4 w-4 mr-1" />
                        {language === 'ar' ? 'بدء التسجيل' : 'Start Recording'}
                      </Button>
                      
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1"
                          disabled={isUploading}
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
                          disabled={isUploading}
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
                      
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={stopRecording}
                          className="flex items-center gap-1"
                          disabled={isUploading}
                        >
                          <Square className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording'}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={cancelRecording}
                          className="flex items-center gap-1"
                          disabled={isUploading}
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
                    {selectedFile ? selectedFile.name : 'recording.webm'}
                  </div>
                  
                  <audio src={audioUrl || ''} controls className="w-full" />
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetRecording}
                    className="w-full"
                    disabled={isUploading}
                  >
                    {language === 'ar' ? 'إعادة التسجيل' : 'Record Again'}
                  </Button>
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
            disabled={isUploading}
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleSaveRecording}
            disabled={!audioBlob || !title.trim() || isUploading}
            className={isUploading ? 'opacity-70 cursor-not-allowed' : ''}
          >
            {isUploading 
              ? (language === 'ar' ? 'جار الحفظ...' : 'Saving...') 
              : (language === 'ar' ? 'حفظ التسجيل' : 'Save Recording')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
