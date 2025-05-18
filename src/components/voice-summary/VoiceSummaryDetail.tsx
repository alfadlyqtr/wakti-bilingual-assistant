import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Copy, Volume, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { withRetry } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VoiceSummaryData {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  audio_url: string;
  summary_audio_url: string | null;
  created_at: string;
  type: string;
  host?: string;
  attendees?: string;
  location?: string;
}

export default function VoiceSummaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme, language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  
  const [summary, setSummary] = useState<VoiceSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch summary data
  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('voice_summaries')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        setSummary(data);
      } catch (error) {
        console.error('Error fetching summary:', error);
        showError(language === 'ar' ? 'فشل في تحميل الملخص' : 'Failed to load summary');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchSummary();
    }
  }, [id, showError, language]);
  
  // Handle audio playback
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }
    };
  }, [audioElement]);
  
  const handleBackClick = () => {
    navigate('/voice-summary');
  };
  
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(language === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard'))
      .catch(() => showError(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy'));
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
      
      console.log('Generating transcript for recording:', summary.audio_url);
      
      // Call the transcribe-audio edge function with the recording ID
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: summary.audio_url,
            summaryId: summary.id
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }
      
      const { text } = await response.json();
      
      // Refresh the summary data to get the updated transcript
      const { data: updatedSummary, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('id', id)
        .single();
        
      if (summaryError) throw summaryError;
      
      setSummary(updatedSummary);
      showSuccess(language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Transcript generated successfully');
    } catch (error) {
      console.error('Error generating transcript:', error);
      showError(language === 'ar' 
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
            summaryId: summary.id,
            transcript: summary.transcript
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
        .eq('id', id)
        .single();
        
      if (summaryError) throw summaryError;
      
      setSummary(updatedSummary);
      showSuccess(language === 'ar' ? 'تم إنشاء الملخص بنجاح' : 'Summary generated successfully');
    } catch (error) {
      console.error('Error generating summary:', error);
      showError(language === 'ar' 
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
      showError(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      setIsPlaying(false);
    };
    
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing audio:', error);
        showError(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      });
      
    setAudioElement(audio);
  };
  
  const handlePause = () => {
    if (audioElement) {
      audioElement.pause();
    }
    setIsPlaying(false);
  };
  
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft />
          </Button>
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
  
  if (!summary) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="icon" onClick={handleBackClick}>
          <ArrowLeft />
        </Button>
        <p className="text-center mt-8">
          {language === 'ar' ? 'الملخص غير موجود' : 'Summary not found'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBackClick}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold truncate">{summary.title}</h1>
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
      </div>
      
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
              <div className="whitespace-pre-wrap text-sm">
                {summary.summary}
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
              <dd>{new Date(summary.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
