import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Copy, Volume, Pause, Clock, FileText, FileText as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { formatRecordingTime } from "@/utils/audioUtils";
import { Highlight } from "./HighlightedTimestamps";
import SummaryAudioPlayer from "./SummaryAudioPlayer";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-mobile";

interface VoiceSummaryData {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  audio_url: string;
  summary_audio_url: string | null;
  created_at: string;
  expires_at: string;
  type: string;
  host?: string;
  attendees?: string;
  location?: string;
  highlighted_timestamps?: Highlight[] | null;
  is_ready?: boolean;
}

interface VoiceSummaryDetailDialogProps {
  recordingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceSummaryDetailDialog({
  recordingId,
  isOpen,
  onClose
}: VoiceSummaryDetailDialogProps) {
  console.log('VoiceSummaryDetailDialog render:', { recordingId, isOpen });
  
  const { theme, language } = useTheme();
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  const [summary, setSummary] = useState<VoiceSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const locale = language === 'ar' ? arSA : enUS;

  // New state for polling incomplete records
  const [isPolling, setIsPolling] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const MAX_POLLING_ATTEMPTS = 30; // 30 attempts at 2-second intervals = 1 minute

  // Reset states when dialog is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
      setIsLoading(true);
      setPollingAttempts(0);
      setIsPolling(false);
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
        setAudioElement(null);
      }
    }
  }, [isOpen, audioElement]);

  // Fetch summary data
  useEffect(() => {
    const fetchSummary = async () => {
      if (!recordingId || !isOpen) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('voice_summaries')
          .select('*')
          .eq('id', recordingId)
          .single();
          
        if (error) throw error;

        console.log("[VoiceSummaryDetailDialog] Fetched summary data:", data);
        
        // Check if the record is fully ready
        const isReady = data.is_ready === true || (
          data.transcript && 
          data.summary && 
          data.summary_audio_url
        );

        setSummary(data);
        
        // If not ready, start polling
        if (!isReady && pollingAttempts < MAX_POLLING_ATTEMPTS) {
          setIsPolling(true);
        } else {
          setIsPolling(false);
        }
      } catch (error) {
        console.error('[VoiceSummaryDetailDialog] Error fetching summary:', error);
        toast.error(language === 'ar' ? 'فشل في تحميل الملخص' : 'Failed to load summary');
        setIsPolling(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (recordingId && isOpen) {
      fetchSummary();
    }
    
    // Set up polling for incomplete records
    let pollingInterval: NodeJS.Timeout | null = null;
    
    if (isPolling && recordingId && pollingAttempts < MAX_POLLING_ATTEMPTS && isOpen) {
      pollingInterval = setInterval(() => {
        fetchSummary();
        setPollingAttempts(prev => prev + 1);
      }, 2000);
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [recordingId, isOpen, language, isPolling, pollingAttempts]);
  
  // Handle audio playback
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }
    };
  }, [audioElement]);
  
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(language === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard'))
      .catch(() => toast.error(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy'));
  };
  
  const generateTranscript = async () => {
    if (!summary) return;
    
    setIsGeneratingTranscript(true);
    try {
      // Get auth session for API call
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('No auth session');
      }
      
      // Construct standardized file path for the storage
      const userId = summary.host || 'unknown';
      const filePath = `voice_recordings/${userId}/${summary.id}/recording.mp3`;
      console.log('Generating transcript for recording path:', filePath);
      
      // Call the transcribe-audio edge function
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: filePath,
            summaryId: summary.id
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }
      
      // Refresh the summary data to get the updated transcript
      const { data: updatedSummary, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('id', recordingId)
        .single();
        
      if (summaryError) throw summaryError;
      
      setSummary(updatedSummary);
      toast.success(language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Transcript generated successfully');
    } catch (error) {
      console.error('Error generating transcript:', error);
      toast.error(language === 'ar' 
        ? 'فشل في إنشاء النص'
        : 'Failed to generate transcript');
    } finally {
      setIsGeneratingTranscript(false);
    }
  };
  
  const generateSummary = async () => {
    if (!summary || !summary.transcript) return;
    
    setIsGeneratingSummary(true);
    try {
      // Get auth session for API call
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('No auth session');
      }
      
      // Call the summarize endpoint
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-summary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: summary.id
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Summary generation failed');
      }
      
      // Refresh the summary data
      const { data: updatedSummary, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('id', recordingId)
        .single();
        
      if (summaryError) throw summaryError;
      
      setSummary(updatedSummary);
      toast.success(language === 'ar' ? 'تم إنشاء الملخص بنجاح' : 'Summary generated successfully');
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error(language === 'ar' 
        ? 'فشل في إنشاء الملخص'
        : 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const handlePlay = (audioUrl: string) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
    }
    
    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlaying(false);
    audio.onpause = () => setIsPlaying(false);
    audio.onerror = () => {
      toast.error(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      setIsPlaying(false);
    };
    
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing audio:', error);
        toast.error(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      });
      
    setAudioElement(audio);
  };
  
  const handlePause = () => {
    if (audioElement) {
      audioElement.pause();
    }
    setIsPlaying(false);
  };

  const handleExportPDF = () => {
    toast.info(language === 'ar' 
      ? 'سيتم تنفيذ تصدير PDF في تحديث قادم'
      : 'PDF export will be implemented in a future update');
  };
  
  const calculateDaysRemaining = (expiresAt: string): number => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const handleAudioGenerated = (url: string) => {
    if (summary) {
      setSummary({
        ...summary,
        summary_audio_url: url
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-1/3" />
          </div>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        </div>
      );
    }
    
    if (isPolling) {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {summary?.title || (language === 'ar' ? 'جاري التحميل...' : 'Loading...')}
            </h1>
          </div>
          
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin mb-4">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <p className="text-center mb-2">
              {language === 'ar'
                ? 'جاري معالجة التسجيل، يرجى الانتظار...'
                : 'Processing recording, please wait...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? 'قد يستغرق هذا بضع دقائق'
                : 'This may take a few minutes'}
            </p>
          </div>
        </div>
      );
    }
    
    if (!summary) {
      return (
        <div className="p-4">
          <p className="text-center mt-8">
            {language === 'ar' ? 'الملخص غير موجود' : 'Summary not found'}
          </p>
        </div>
      );
    }

    const daysRemaining = calculateDaysRemaining(summary.expires_at);
    
    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold truncate">{summary.title}</h1>
          
          <div className="text-sm text-muted-foreground">
            {daysRemaining > 0 ? (
              <span>
                {language === 'ar' 
                  ? `${daysRemaining} أيام متبقية`
                  : `${daysRemaining} days remaining`}
              </span>
            ) : (
              <span className="text-destructive">
                {language === 'ar' ? 'انتهت الصلاحية' : 'Expired'}
              </span>
            )}
          </div>
        </div>
        
        {/* Audio controls */}
        <div className="flex items-center gap-2 my-4">
          {isPlaying ? (
            <Button 
              variant="outline"
              onClick={handlePause}
              className="gap-1"
            >
              <Pause className="h-4 w-4" />
              {language === 'ar' ? 'إيقاف' : 'Pause'}
            </Button>
          ) : (
            <Button 
              variant="outline"
              onClick={() => handlePlay(summary.audio_url)}
              className="gap-1"
            >
              <Volume className="h-4 w-4" />
              {language === 'ar' ? 'استماع للتسجيل' : 'Play Recording'}
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="gap-1"
          >
            <FileIcon className="h-4 w-4" />
            {language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
          </Button>
        </div>
        
        {/* Highlighted timestamps section */}
        {summary.highlighted_timestamps && summary.highlighted_timestamps.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {language === 'ar' ? 'لحظات مهمة' : 'Key Moments'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.highlighted_timestamps.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 bg-primary/10 py-1 px-2 rounded-full"
                    role="button"
                    onClick={() => {
                      if (audioElement) {
                        audioElement.currentTime = highlight.timestamp;
                        audioElement.play()
                          .then(() => setIsPlaying(true))
                          .catch(console.error);
                      } else if (summary.audio_url) {
                        const audio = new Audio(summary.audio_url);
                        audio.currentTime = highlight.timestamp;
                        audio.onended = () => setIsPlaying(false);
                        audio.onpause = () => setIsPlaying(false);
                        audio.play()
                          .then(() => {
                            setIsPlaying(true);
                            setAudioElement(audio);
                          })
                          .catch(console.error);
                      }
                    }}
                  >
                    <Clock className="h-3 w-3" />
                    <span>{formatRecordingTime(highlight.timestamp)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Transcript section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>{language === 'ar' ? 'النص' : 'Transcript'}</span>
              {summary.transcript && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleCopyText(summary.transcript || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.transcript ? (
              <div className="whitespace-pre-wrap text-sm">
                {summary.transcript}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-3">
                  {language === 'ar' ? 'لم يتم إنشاء نص بعد' : 'No transcript generated yet'}
                </p>
                <Button 
                  onClick={generateTranscript} 
                  disabled={isGeneratingTranscript}
                >
                  {isGeneratingTranscript ? 
                    (language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...') : 
                    (language === 'ar' ? 'إنشاء النص' : 'Generate Transcript')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Summary section */}
        {summary.transcript && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{language === 'ar' ? 'الملخص' : 'Summary'}</span>
                {summary.summary && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleCopyText(summary.summary || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.summary ? (
                <div>
                  <div className="whitespace-pre-wrap text-sm mb-4">
                    {summary.summary}
                  </div>
                  
                  {/* Audio Player for Summary */}
                  <div className="mt-4 pt-4 border-t">
                    <SummaryAudioPlayer 
                      recordingId={summary.id}
                      summaryText={summary.summary}
                      existingAudioUrl={summary.summary_audio_url}
                      onAudioGenerated={handleAudioGenerated}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">
                    {language === 'ar' ? 'لم يتم إنشاء ملخص بعد' : 'No summary generated yet'}
                  </p>
                  <Button 
                    onClick={generateSummary} 
                    disabled={isGeneratingSummary}
                  >
                    {isGeneratingSummary ? 
                      (language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...') : 
                      (language === 'ar' ? 'إنشاء ملخص' : 'Generate Summary')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Details section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {language === 'ar' ? 'التفاصيل' : 'Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="font-medium">{language === 'ar' ? 'النوع' : 'Type'}</dt>
                <dd>{summary.type}</dd>
              </div>
              
              {summary.host && (
                <div className="flex justify-between">
                  <dt className="font-medium">{language === 'ar' ? 'المضيف' : 'Host'}</dt>
                  <dd>{summary.host}</dd>
                </div>
              )}
              
              {summary.attendees && (
                <div className="flex justify-between">
                  <dt className="font-medium">{language === 'ar' ? 'الحضور' : 'Attendees'}</dt>
                  <dd>{summary.attendees}</dd>
                </div>
              )}
              
              {summary.location && (
                <div className="flex justify-between">
                  <dt className="font-medium">{language === 'ar' ? 'المكان' : 'Location'}</dt>
                  <dd>{summary.location}</dd>
                </div>
              )}
              
              <div className="flex justify-between">
                <dt className="font-medium">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</dt>
                <dd>{formatDistanceToNow(new Date(summary.created_at), { addSuffix: true, locale })}</dd>
              </div>
              
              <div className="flex justify-between">
                <dt className="font-medium">{language === 'ar' ? 'تاريخ انتهاء الصلاحية' : 'Expires'}</dt>
                <dd>{formatDistanceToNow(new Date(summary.expires_at), { addSuffix: true, locale })}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Temporarily simplify to just use Dialog for testing
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle>{summary?.title || (language === 'ar' ? 'تفاصيل التسجيل' : 'Recording Details')}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );

  /* Original conditional rendering that we'll restore after debugging
  // Use a Sheet on mobile and Dialog on desktop
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full p-0 sm:max-w-full overflow-y-auto">
          <SheetHeader className="p-4 border-b sticky top-0 bg-background z-10">
            <SheetTitle>{summary?.title || (language === 'ar' ? 'تفاصيل التسجيل' : 'Recording Details')}</SheetTitle>
          </SheetHeader>
          <div className="p-4 overflow-y-auto h-[calc(100vh-80px)]">
            {renderContent()}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{summary?.title || (language === 'ar' ? 'تفاصيل التسجيل' : 'Recording Details')}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
  */
}
