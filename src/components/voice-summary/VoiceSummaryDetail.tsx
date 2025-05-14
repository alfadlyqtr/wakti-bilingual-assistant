
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic, FileText, Volume2, DownloadCloud, Edit2, Save,
  User, MapPin, Clock, Copy, CheckCircle, Loader2, PlayCircle,
  PauseCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function VoiceSummaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [recording, setRecording] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transcript");
  const [editMode, setEditMode] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  
  const locale = language === 'ar' ? arSA : enUS;

  useEffect(() => {
    if (!id) return;
    
    async function fetchRecordingDetails() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('voice_summaries')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) {
          console.error('Error fetching recording details:', error);
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' 
              ? 'فشل في جلب تفاصيل التسجيل' 
              : 'Failed to fetch recording details',
            variant: "destructive"
          });
          navigate('/voice-summary');
          return;
        }
        
        setRecording(data);
        setEditedTranscript(data.transcription_text || '');
      } catch (err) {
        console.error('Error in fetchRecordingDetails:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchRecordingDetails();
  }, [id, navigate, language]);
  
  useEffect(() => {
    if (recording?.transcription_status === 'pending') {
      // If transcription is pending, poll for updates every 5 seconds
      const interval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('voice_summaries')
            .select('*')
            .eq('id', id)
            .single();
            
          if (!error && data) {
            setRecording(data);
            setEditedTranscript(data.transcription_text || '');
            
            // If transcription is complete, stop polling
            if (data.transcription_status === 'completed') {
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error('Error polling for transcription updates:', err);
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [id, recording?.transcription_status]);
  
  useEffect(() => {
    // Cleanup audio player on unmount
    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = "";
        setAudioPlayer(null);
      }
    };
  }, []);
  
  const handleSaveTranscript = async () => {
    if (!id || !editedTranscript.trim()) return;
    
    try {
      setIsUpdating(true);
      
      const { error } = await supabase
        .from('voice_summaries')
        .update({ 
          transcription_text: editedTranscript,
          transcription_status: 'edited'
        })
        .eq('id', id);
        
      if (error) {
        throw new Error(error.message);
      }
      
      // Update local recording state
      setRecording({
        ...recording,
        transcription_text: editedTranscript,
        transcription_status: 'edited'
      });
      
      setEditMode(false);
      
      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' 
          ? 'تم حفظ النص المعدل بنجاح' 
          : 'Edited transcript saved successfully',
      });
    } catch (err) {
      console.error('Error saving transcript:', err);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? `فشل في حفظ النص: ${err.message}` 
          : `Failed to save transcript: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleCopyText = (text: string) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' 
          ? 'تم نسخ النص إلى الحافظة' 
          : 'Text copied to clipboard',
      });
    });
  };
  
  const handleGenerateSummary = async () => {
    if (!id || !recording?.transcription_text) return;
    
    try {
      setIsGeneratingSummary(true);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ 
          recordingId: id,
          language
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error generating summary');
      }
      
      const data = await response.json();
      
      // Update local recording state
      setRecording({
        ...recording,
        summary_text: data.summary
      });
      
      setActiveTab("summary");
      
      toast({
        title: language === 'ar' ? 'تم إنشاء الملخص' : 'Summary Generated',
        description: language === 'ar' 
          ? 'تم إنشاء ملخص النص بنجاح' 
          : 'Text summary generated successfully',
      });
    } catch (err) {
      console.error('Error generating summary:', err);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? `فشل في إنشاء الملخص: ${err.message}` 
          : `Failed to generate summary: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const handleGenerateTTS = async (voiceGender: string) => {
    if (!id || !recording?.summary_text) return;
    
    try {
      setIsGeneratingTTS(true);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ 
          recordingId: id,
          voiceGender
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error generating audio');
      }
      
      const data = await response.json();
      
      // Update local recording state
      setRecording({
        ...recording,
        summary_audio_url: data.audioUrl,
        voice_gender: voiceGender
      });
      
      toast({
        title: language === 'ar' ? 'تم إنشاء الصوت' : 'Audio Generated',
        description: language === 'ar' 
          ? 'تم إنشاء الملخص الصوتي بنجاح' 
          : 'Audio summary generated successfully',
      });
    } catch (err) {
      console.error('Error generating TTS:', err);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? `فشل في إنشاء الصوت: ${err.message}` 
          : `Failed to generate audio: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingTTS(false);
    }
  };
  
  const handlePlayPause = () => {
    if (!recording?.summary_audio_url) return;
    
    if (!audioPlayer) {
      // Create new audio player if it doesn't exist
      const player = new Audio(recording.summary_audio_url);
      player.onplay = () => setIsAudioPlaying(true);
      player.onpause = () => setIsAudioPlaying(false);
      player.onended = () => setIsAudioPlaying(false);
      setAudioPlayer(player);
      player.play();
    } else {
      if (isAudioPlaying) {
        audioPlayer.pause();
      } else {
        audioPlayer.play();
      }
    }
  };
  
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? 'فشل تنزيل الملف' 
          : 'Failed to download file',
        variant: "destructive"
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-muted-foreground mb-2">
          {language === 'ar' ? 'لم يتم العثور على التسجيل' : 'Recording not found'}
        </div>
        <Button 
          variant="outline"
          onClick={() => navigate('/voice-summary')}
        >
          {language === 'ar' ? 'العودة إلى التسجيلات' : 'Back to Recordings'}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-full">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-medium text-lg line-clamp-1">
                {recording.title || (language === 'ar' ? 'تسجيل بدون عنوان' : 'Untitled Recording')}
              </h2>
            </div>
            
            <Badge 
              variant={recording.transcription_status === 'completed' ? "default" : "outline"}
              className="ml-2 flex items-center gap-1"
            >
              {recording.transcription_status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : recording.transcription_status === 'pending' ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <Edit2 className="h-4 w-4 text-blue-500" />
              )}
              <span>
                {recording.transcription_status === 'completed' ? (
                  language === 'ar' ? 'مكتمل' : 'Completed'
                ) : recording.transcription_status === 'pending' ? (
                  language === 'ar' ? 'قيد المعالجة' : 'Processing'
                ) : (
                  language === 'ar' ? 'تم التعديل' : 'Edited'
                )}
              </span>
            </Badge>
          </div>
          
          <div className="text-xs text-muted-foreground mb-3">
            {formatDistanceToNow(new Date(recording.created_at), { 
              addSuffix: true, 
              locale 
            })}
          </div>
          
          <Separator className="my-3" />
          
          <div className="space-y-2 text-sm">
            {recording.metadata?.attendees?.length > 0 && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground mr-1">
                    {language === 'ar' ? 'الحضور:' : 'Attendees:'}
                  </span>
                  <span>{Array.isArray(recording.metadata.attendees) ? recording.metadata.attendees.join(', ') : recording.metadata.attendees}</span>
                </div>
              </div>
            )}
            
            {recording.metadata?.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground mr-1">
                    {language === 'ar' ? 'الموقع:' : 'Location:'}
                  </span>
                  <span>{recording.metadata.location}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-muted-foreground mr-1">
                  {language === 'ar' ? 'ينتهي في:' : 'Expires:'}
                </span>
                <span>{formatDistanceToNow(new Date(recording.expires_at), { 
                  addSuffix: true, 
                  locale 
                })}</span>
              </div>
            </div>
          </div>
          
          {recording.recording_url && (
            <div className="mt-3 flex items-center gap-2">
              <audio src={recording.recording_url} controls className="w-full h-8" />
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => handleDownload(recording.recording_url, `recording-${recording.id}.mp3`)}
              >
                <DownloadCloud className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transcript">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>{language === 'ar' ? 'النص المنسوخ' : 'Transcript'}</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="summary">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-4 w-4" />
              <span>{language === 'ar' ? 'الملخص' : 'Summary'}</span>
            </div>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="transcript" className="space-y-4">
          {recording.transcription_status === 'pending' ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <div className="text-center text-muted-foreground">
                {language === 'ar' ? 'جاري تحويل الصوت إلى نص...' : 'Converting audio to text...'}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {language === 'ar' ? 'النص المنسوخ' : 'Transcript'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {editMode ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditMode(false);
                            setEditedTranscript(recording.transcription_text);
                          }}
                          disabled={isUpdating}
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveTranscript}
                          disabled={isUpdating}
                          className="flex items-center gap-1"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          {language === 'ar' ? 'حفظ' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyText(recording.transcription_text)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditMode(true)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {editMode ? (
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="min-h-[200px]"
                    placeholder={language === 'ar' ? 'اكتب النص هنا...' : 'Type transcript here...'}
                    disabled={isUpdating}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{recording.transcription_text}</div>
                )}
              </CardContent>
            </Card>
          )}
          
          {recording.transcription_status === 'completed' && !recording.summary_text && (
            <Button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="w-full"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'ar' ? 'جاري إنشاء الملخص...' : 'Generating Summary...'}
                </>
              ) : (
                <>
                  {language === 'ar' ? 'إنشاء ملخص النص' : 'Generate Summary'}
                </>
              )}
            </Button>
          )}
        </TabsContent>
        
        <TabsContent value="summary" className="space-y-4">
          {!recording.summary_text ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-center text-muted-foreground mb-4">
                {language === 'ar' 
                  ? 'لم يتم إنشاء ملخص بعد. يرجى إنشاء ملخص من علامة التبويب النص المنسوخ.'
                  : 'No summary generated yet. Please generate a summary from the Transcript tab.'}
              </div>
              <Button 
                variant="outline"
                onClick={() => setActiveTab("transcript")}
              >
                {language === 'ar' ? 'الذهاب إلى النص المنسوخ' : 'Go to Transcript'}
              </Button>
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {language === 'ar' ? 'ملخص النص' : 'Summary'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyText(recording.summary_text)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="whitespace-pre-wrap">{recording.summary_text}</div>
                
                {recording.summary_audio_url ? (
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={handlePlayPause}
                    >
                      {isAudioPlaying ? (
                        <>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إيقاف' : 'Pause'}
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'تشغيل' : 'Play'}
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(recording.summary_audio_url, `summary-${recording.id}.mp3`)}
                    >
                      <DownloadCloud className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex-1"></div>
                    
                    <Badge variant="outline">
                      {recording.voice_gender === 'male' 
                        ? (language === 'ar' ? 'صوت ذكر' : 'Male Voice') 
                        : (language === 'ar' ? 'صوت أنثى' : 'Female Voice')}
                    </Badge>
                  </div>
                ) : (
                  <div className="pt-2 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateTTS('male')}
                      disabled={isGeneratingTTS}
                    >
                      {isGeneratingTTS ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Volume2 className="h-4 w-4 mr-1" />
                      )}
                      {language === 'ar' ? 'صوت ذكر' : 'Male Voice'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateTTS('female')}
                      disabled={isGeneratingTTS}
                    >
                      {isGeneratingTTS ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Volume2 className="h-4 w-4 mr-1" />
                      )}
                      {language === 'ar' ? 'صوت أنثى' : 'Female Voice'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
