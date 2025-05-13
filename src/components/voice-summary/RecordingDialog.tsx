import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mic, Upload, AudioWaveform, Pause, Play, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Type for the voice recording data
interface VoiceRecordingData {
  title: string;
  type: string;
  host?: string;
  attendees?: string;
  location?: string;
  audio_url: string;
  expires_at: string;
  clean_audio?: boolean;
}

export default function RecordingDialog({ isOpen, onClose }: RecordingDialogProps) {
  const [tab, setTab] = useState("record");
  const [recordingStep, setRecordingStep] = useState<"metadata" | "recording" | "transcribing" | "summarizing">("metadata");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    type: "Meeting",
    host: "",
    attendees: "",
    location: "",
    cleanAudio: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSkip = () => {
    setRecordingStep("recording");
  };

  const handleStartRecording = async () => {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        handleUploadRecording(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please check your browser permissions.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all audio tracks
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setRecordingStep("transcribing");
  };

  const handleUploadRecording = async (audioBlob: Blob) => {
    try {
      // Format title or use timestamp if empty
      const title = formData.title || `Recording_${new Date().toISOString()}`;
      const filePath = `recordings/${Date.now()}_${title.replace(/\s+/g, '_')}.mp3`;
      
      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/mp3',
          cacheControl: '3600',
        });

      if (storageError) {
        throw storageError;
      }

      // Get the URL for the uploaded file
      const { data: publicUrl } = supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);

      // Calculate expiration date (10 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 10);
      
      // Save metadata to database using type casting to match DB schema
      const voiceRecordingData: VoiceRecordingData = {
        title: formData.title,
        type: formData.type,
        host: formData.host || null,
        attendees: formData.attendees || null,
        location: formData.location || null,
        audio_url: publicUrl.publicUrl,
        expires_at: expiresAt.toISOString(),
        clean_audio: formData.cleanAudio,
      };
      
      const { data: recordingData, error: dbError } = await supabase
        .from("voice_recordings" as any)
        .insert(voiceRecordingData as any)
        .select('id')
        .single();

      if (dbError) {
        throw dbError;
      }

      // Start audio transcription
      if (recordingData?.id) {
        try {
          await supabase.functions.invoke("transcribe-audio", {
            body: { 
              audioUrl: publicUrl.publicUrl,
              recordingId: recordingData.id
            }
          });
        } catch (error) {
          console.error('Error invoking transcribe function:', error);
          // Continue anyway as this is async
        }
      }

      toast({
        title: "Recording saved",
        description: "Your recording has been uploaded successfully and is being processed.",
      });

      // Invalidate query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["voice-recordings"] });
      
      // Close dialog
      onClose();
      
      // Navigate to the recording detail page if we have an ID
      if (recordingData?.id) {
        navigate(`/voice-summary/${recordingData.id}`);
      }
      
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your recording. Please try again.",
        variant: "destructive",
      });
      setRecordingStep("metadata");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    if (!file.type.includes('audio')) {
      toast({
        title: "Invalid file",
        description: "Please upload an audio file (mp3, wav, etc.)",
        variant: "destructive",
      });
      return;
    }

    try {
      setRecordingStep("transcribing");
      
      // Format title or use filename if empty
      const title = formData.title || file.name;
      const filePath = `recordings/${Date.now()}_${file.name}`;
      
      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, file);

      if (storageError) {
        throw storageError;
      }
      
      const { data: publicUrl } = supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);

      // Calculate expiration date (10 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 10);

      // Save metadata to database using type casting for DB schema
      const voiceRecordingData: VoiceRecordingData = {
        title: title,
        type: formData.type,
        host: formData.host || null,
        attendees: formData.attendees || null,
        location: formData.location || null,
        audio_url: publicUrl.publicUrl,
        expires_at: expiresAt.toISOString(),
      };

      const { data: recordingData, error: dbError } = await supabase
        .from("voice_recordings" as any)
        .insert(voiceRecordingData as any)
        .select('id')
        .single();

      if (dbError) {
        throw dbError;
      }

      // Start audio transcription
      if (recordingData?.id) {
        try {
          await supabase.functions.invoke("transcribe-audio", {
            body: { 
              audioUrl: publicUrl.publicUrl,
              recordingId: recordingData.id
            }
          });
        } catch (error) {
          console.error('Error invoking transcribe function:', error);
          // Continue anyway as this is async
        }
      }

      toast({
        title: "File uploaded",
        description: "Your audio file has been uploaded successfully and is being processed.",
      });
      
      // Invalidate query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["voice-recordings"] });
      
      // Close dialog
      onClose();
      
      // Navigate to the recording detail page if we have an ID
      if (recordingData?.id) {
        navigate(`/voice-summary/${recordingData.id}`);
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
      setRecordingStep("metadata");
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hrs > 0 ? String(hrs).padStart(2, '0') : null,
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // Reset the dialog state when it closes
  const handleDialogClose = () => {
    setTab("record");
    setRecordingStep("metadata");
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {recordingStep === "metadata" && "Voice Summary"}
            {recordingStep === "recording" && "Recording Audio"}
            {recordingStep === "transcribing" && "Transcribing Audio"}
            {recordingStep === "summarizing" && "Creating Summary"}
          </DialogTitle>
        </DialogHeader>
        
        {recordingStep === "metadata" && (
          <>
            <Tabs defaultValue="record" value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="record">Record</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
              </TabsList>
              
              <TabsContent value="record" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title (Optional)</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Untitled Recording"
                      value={formData.title}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => handleSelectChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Lecture">Lecture</SelectItem>
                        <SelectItem value="Brainstorm">Brainstorm</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="host">Host (Optional)</Label>
                    <Input
                      id="host"
                      name="host"
                      placeholder="Host name"
                      value={formData.host}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="attendees">Attendees (Optional)</Label>
                    <Input
                      id="attendees"
                      name="attendees"
                      placeholder="Separate names with commas"
                      value={formData.attendees}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="Where this took place"
                      value={formData.location}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cleanAudio">Clean Audio (noise reduction)</Label>
                    <Switch
                      id="cleanAudio"
                      checked={formData.cleanAudio}
                      onCheckedChange={(checked) => handleSwitchChange('cleanAudio', checked)}
                    />
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <div className="space-x-2">
                      <Button variant="outline" onClick={handleSkip}>
                        Skip
                      </Button>
                      <Button onClick={() => setRecordingStep("recording")}>
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="upload" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title (Optional)</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Name your upload"
                      value={formData.title}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => handleSelectChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Lecture">Lecture</SelectItem>
                        <SelectItem value="Brainstorm">Brainstorm</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Upload Audio File</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-4">
                        MP3 or WAV format, max 2 hours
                      </p>
                      <Input
                        id="audio-upload"
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('audio-upload')?.click()}
                      >
                        Select File
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button disabled type="submit">
                      Upload
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
        
        {recordingStep === "recording" && (
          <div className="space-y-6">
            <div className="flex justify-center mt-4 mb-2">
              <div className="rounded-full bg-background shadow-lg p-6">
                {isRecording ? (
                  <Pause
                    className="h-12 w-12 text-destructive animate-pulse"
                    onClick={handleStopRecording}
                  />
                ) : (
                  <Mic
                    className="h-12 w-12 text-primary"
                    onClick={handleStartRecording}
                  />
                )}
              </div>
            </div>
            
            <div className="text-center text-xl font-mono">
              {formatTime(recordingTime)}
            </div>
            
            <div className="flex justify-center">
              <AudioWaveform className="h-12 w-full text-primary" />
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              {!isRecording ? "Press the microphone to start recording" : "Recording in progress..."}
            </div>
            
            {isRecording && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="bg-background/50 border-destructive text-destructive"
                  onClick={handleStopRecording}
                >
                  Stop Recording
                </Button>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              {isRecording && (
                <Button variant="outline" disabled>
                  Highlight This Moment
                </Button>
              )}
            </div>
          </div>
        )}
        
        {recordingStep === "transcribing" && (
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <div className="animate-pulse">
                <AudioWaveform className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium">Processing Audio</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Transcribing your recording using Whisper AI...
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-xs bg-secondary/30 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full w-3/4 animate-[grow_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
