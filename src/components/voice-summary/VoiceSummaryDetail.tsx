import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioWaveform, Calendar, Download, ExternalLink, FileText, MapPin, Mic, Play, Users } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface RecordingDetail {
  id: string;
  title: string;
  type: string;
  host?: string;
  attendees?: string;
  location?: string;
  created_at: string;
  expires_at: string;
  audio_url: string;
  transcript?: string;
  summary?: string;
  summary_audio_url?: string;
  summary_voice?: "male" | "female";
  summary_language?: "english" | "arabic";
  highlighted_timestamps?: { time: number; note: string }[];
}

export default function VoiceSummaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("transcript");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editingTranscript, setEditingTranscript] = useState("");
  const [transcriptEdited, setTranscriptEdited] = useState(false);
  
  // Voice options for TTS
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
  const [voiceLanguage, setVoiceLanguage] = useState<"english" | "arabic">("english");

  const { data: recording, isLoading } = useQuery({
    queryKey: ["voice-recording", id],
    queryFn: async () => {
      if (!id) throw new Error("Recording ID is required");
      
      const { data, error } = await supabase
        .from("voice_recordings" as any)
        .select("*")
        .eq("id", id)
        .single();
        
      if (error) throw error;
      return data as unknown as RecordingDetail;
    },
  });

  useEffect(() => {
    if (recording?.transcript && !editingTranscript) {
      setEditingTranscript(recording.transcript);
    }
  }, [recording, editingTranscript]);

  useEffect(() => {
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  const handlePlay = () => {
    if (recording?.summary_audio_url) {
      audio.src = recording.summary_audio_url;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(error => {
        console.error('Error playing audio:', error);
        toast({
          title: "Playback error",
          description: "Could not play the audio. Please try again.",
          variant: "destructive",
        });
      });
    }
  };

  const handlePause = () => {
    audio.pause();
    setIsPlaying(false);
  };

  const handleGenerateSummary = async () => {
    if (!editingTranscript || !id) return;
    
    toast({
      title: "Generating summary",
      description: "Please wait while we create your summary...",
    });
    
    try {
      // Call the edge function to generate summary
      const { data, error } = await supabase.functions.invoke("generate-summary", {
        body: {
          recordingId: id,
          transcript: editingTranscript,
          metadata: {
            title: recording?.title,
            type: recording?.type,
            host: recording?.host,
            attendees: recording?.attendees,
            location: recording?.location,
          }
        }
      });
      
      if (error) throw error;
      
      // Update the UI
      setActiveTab("summary");
      toast({
        title: "Summary created",
        description: "Your smart summary has been generated successfully.",
      });
      
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateTTS = async () => {
    if (!recording?.summary || !id) return;
    
    toast({
      title: "Generating voice",
      description: "Please wait while we create the audio version...",
    });
    
    try {
      // Call the edge function to generate text-to-speech
      const { data, error } = await supabase.functions.invoke("generate-tts", {
        body: {
          recordingId: id,
          text: recording.summary,
          voice: voiceGender,
          language: voiceLanguage,
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Audio created",
        description: "Your summary has been converted to speech.",
      });
      
    } catch (error) {
      console.error('Error generating TTS:', error);
      toast({
        title: "Error",
        description: "Failed to generate audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyText = (text?: string) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied",
        description: "Text copied to clipboard.",
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Error",
        description: "Failed to copy text. Please try again.",
        variant: "destructive",
      });
    });
  };

  const handleExportPDF = () => {
    toast({
      title: "Exporting PDF",
      description: "Your PDF is being prepared...",
    });
    
    // In a real implementation, you would call an edge function
    // to generate and return a PDF file
  };

  const handleDownloadAudio = (url?: string) => {
    if (!url) return;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recording?.title || 'audio'}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateExpiryTime = (expiryDate?: string) => {
    if (!expiryDate) return "";
    
    const now = new Date();
    const expiry = parseISO(expiryDate);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${daysLeft} days remaining`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-64 bg-muted rounded w-full"></div>
          <div className="h-12 bg-muted rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <AudioWaveform className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Recording not found</h2>
        <p className="text-muted-foreground mb-6">The recording you're looking for doesn't exist or has expired</p>
        <Button onClick={() => navigate('/voice-summary')}>
          Back to Recordings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => navigate('/voice-summary')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">{recording.title}</h1>
        </div>
        <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
          {calculateExpiryTime(recording.expires_at)}
        </Badge>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Recording metadata */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge>{recording.type}</Badge>
            {recording.created_at && (
              <Badge variant="outline">
                {formatDistanceToNow(parseISO(recording.created_at), { addSuffix: true })}
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            {recording.host && <div><span className="font-medium">Host:</span> {recording.host}</div>}
            {recording.attendees && <div><span className="font-medium">Attendees:</span> {recording.attendees}</div>}
            {recording.location && <div><span className="font-medium">Location:</span> {recording.location}</div>}
          </div>
        </div>
        
        {/* Download original audio */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => handleDownloadAudio(recording.audio_url)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Original Recording
          </Button>
        </div>

        {/* Tabs for transcript and summary */}
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" className="mt-4">
            {recording.transcript ? (
              <>
                <div className="mb-4">
                  <Textarea 
                    value={editingTranscript} 
                    onChange={(e) => {
                      setEditingTranscript(e.target.value);
                      setTranscriptEdited(e.target.value !== recording.transcript);
                    }}
                    className="min-h-[200px]"
                  />
                  {transcriptEdited && (
                    <div className="flex justify-end mt-2">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                        Edited
                      </Badge>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full mb-4"
                  onClick={handleGenerateSummary} 
                  disabled={!editingTranscript}
                >
                  Create Summary
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <AudioWaveform className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Transcript is being processed...
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            {recording.summary ? (
              <>
                <div className="bg-muted/30 rounded-lg p-4 mb-4">
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{recording.summary}</pre>
                  </div>
                </div>
                
                <div className="flex flex-col gap-4">
                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => handleCopyText(recording.summary)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Text
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                  </div>
                  
                  {/* Text-to-Speech section */}
                  <div className="mt-6 border border-border rounded-lg p-4">
                    <h3 className="font-medium mb-4">Play Summary</h3>
                    
                    {/* Voice options */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm font-normal mb-2 block">Voice</Label>
                        <RadioGroup 
                          value={voiceGender} 
                          onValueChange={(v) => setVoiceGender(v as "male" | "female")}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id="male" />
                            <Label htmlFor="male">Male</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id="female" />
                            <Label htmlFor="female">Female</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="text-sm font-normal mb-2 block">Language</Label>
                        <RadioGroup 
                          value={voiceLanguage} 
                          onValueChange={(v) => setVoiceLanguage(v as "english" | "arabic")}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="english" id="english" />
                            <Label htmlFor="english">English</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="arabic" id="arabic" />
                            <Label htmlFor="arabic">Arabic</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                    
                    {recording.summary_audio_url ? (
                      <div className="space-y-4">
                        {/* Audio player */}
                        <div className="flex items-center space-x-4">
                          <Button 
                            variant="outline"
                            size="icon"
                            onClick={isPlaying ? handlePause : handlePlay}
                          >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          
                          <div className="flex-1 space-y-1">
                            <div className="bg-secondary h-2 rounded-full w-full">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${(currentTime / duration) * 100}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleDownloadAudio(recording.summary_audio_url)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Audio
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={handleGenerateTTS}
                        disabled={!recording.summary}
                      >
                        Generate Audio
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <AudioWaveform className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="font-medium mb-2">No summary available</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Create a summary from the transcript first
                </p>
                <Button onClick={() => setActiveTab("transcript")}>
                  Go to Transcript
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
