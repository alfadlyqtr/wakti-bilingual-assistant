
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  Edit, Save, Copy, FilePdf, AlertCircle, 
  Clock, Calendar, Mic, FileText, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getRecordingStatus } from "@/lib/utils";
import { formatRecordingTime } from "@/utils/audioUtils";
import SummaryAudioPlayer from "./SummaryAudioPlayer";
import * as voiceSummaryService from "@/services/voiceSummaryService";
import { isValidDate } from "@/lib/utils";

const VoiceSummaryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  
  const [recording, setRecording] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'pending' | 'transcribing' | 'processing' | 'complete'>('pending');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  
  useEffect(() => {
    if (!id) {
      navigate('/voice-summary');
      return;
    }

    const fetchRecording = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('voice_summaries')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) {
          console.error("Error fetching recording:", error);
          setErrorMessage(error.message);
          return;
        }
        
        if (!data) {
          setErrorMessage(language === 'ar' ? 'التسجيل غير موجود' : 'Recording not found');
          return;
        }
        
        setRecording(data);
        setEditedTranscript(data.transcript || "");
        
        // Determine recording status
        const status = getRecordingStatus(data);
        setRecordingStatus(status);
        
        // Set up polling for processing recordings
        if (status === 'pending' || status === 'processing' || status === 'transcribing') {
          const intervalId = setInterval(fetchLatestStatus, 5000);
          return () => clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Error in fetchRecording:", err);
        setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء جلب التسجيل' : 'An error occurred while fetching the recording');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecording();
  }, [id, navigate, language]);
  
  const fetchLatestStatus = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error || !data) {
        console.error("Error fetching latest status:", error);
        return;
      }
      
      setRecording(data);
      
      // Update status
      const status = getRecordingStatus(data);
      setRecordingStatus(status);
      
      // If completed, stop polling
      if (status === 'complete') {
        toast.success(language === 'ar' ? 'اكتمل التسجيل' : 'Recording completed');
      }
    } catch (err) {
      console.error("Error fetching latest status:", err);
    }
  };
  
  const handleTranscriptEdit = () => {
    setIsEditingTranscript(true);
  };
  
  const handleSaveTranscript = async () => {
    if (!id) return;
    
    try {
      setIsProcessing(true);
      
      const { success, error } = await voiceSummaryService.updateTranscript(id, editedTranscript);
      
      if (!success) {
        console.error("Error updating transcript:", error);
        toast.error(language === 'ar' ? 'فشل في حفظ النص' : 'Failed to save transcript');
        return;
      }
      
      // Update local state with edited transcript
      setRecording({ ...recording, transcript: editedTranscript });
      setIsEditingTranscript(false);
      toast.success(language === 'ar' ? 'تم حفظ النص بنجاح' : 'Transcript saved successfully');
      
      // Request summary regeneration after transcript edit
      const { success: regenSuccess, error: regenError } = await voiceSummaryService.regenerateSummary(id);
      
      if (regenSuccess) {
        toast.info(language === 'ar' ? 'جارٍ إعادة إنشاء الملخص...' : 'Regenerating summary...');
        
        // Start polling for summary updates
        const intervalId = setInterval(async () => {
          await fetchLatestStatus();
          // Check if summary is ready
          if (recording && recording.summary) {
            clearInterval(intervalId);
          }
        }, 5000);
        
        // Clean up interval after 2 minutes if summary isn't ready
        setTimeout(() => clearInterval(intervalId), 120000);
      } else if (regenError) {
        console.error("Error regenerating summary:", regenError);
      }
      
    } catch (err) {
      console.error("Error saving transcript:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء حفظ النص' : 'An error occurred while saving the transcript');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancelEdit = () => {
    setEditedTranscript(recording?.transcript || "");
    setIsEditingTranscript(false);
  };
  
  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(language === 'ar' ? 'تم نسخ النص إلى الحافظة' : 'Copied to clipboard');
    } catch (err) {
      console.error("Error copying to clipboard:", err);
      toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };
  
  const handleExportPDF = async () => {
    if (!id) return;
    
    try {
      setIsProcessing(true);
      
      const { pdfBlob, error } = await voiceSummaryService.exportSummaryAsPDF(id);
      
      if (error || !pdfBlob) {
        console.error("Error exporting PDF:", error);
        toast.error(language === 'ar' ? 'فشل في تصدير الملخص كملف PDF' : 'Failed to export summary as PDF');
        return;
      }
      
      // Create a download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wakti-summary-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(language === 'ar' ? 'تم تصدير الملخص بنجاح' : 'Summary exported successfully');
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تصدير الملخص' : 'An error occurred while exporting the summary');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const getStatusBadge = () => {
    switch (recordingStatus) {
      case 'complete':
        return <Badge variant="success">{language === 'ar' ? 'مكتمل' : 'Complete'}</Badge>;
      case 'processing':
        return <Badge variant="warning">{language === 'ar' ? 'قيد المعالجة' : 'Processing'}</Badge>;
      case 'transcribing':
        return <Badge variant="warning">{language === 'ar' ? 'قيد التحويل' : 'Transcribing'}</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</Badge>;
    }
  };
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || !isValidDate(dateString)) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  // Determine if we're in error state 
  const hasTranscriptError = recording?.transcript_error;
  const hasSummaryError = recording?.summary_error;
  const hasError = hasTranscriptError || hasSummaryError;

  // Check if we have missing data
  const isTranscriptMissing = recordingStatus === 'complete' && !recording?.transcript;
  const isSummaryMissing = recordingStatus === 'complete' && !recording?.summary;
  
  // Set direction based on language
  const rtlProps = language === 'ar' ? { dir: 'rtl' } : {};
  
  // Handle retry for failed transcript or summary
  const handleRetry = async () => {
    if (!id) return;
    
    try {
      setIsProcessing(true);
      
      if (hasTranscriptError) {
        // For failed transcription, we need to restart the process
        toast.info(language === 'ar' ? 'جارٍ إعادة محاولة التحويل...' : 'Retrying transcription...');
        
        const { text, error } = await voiceSummaryService.transcribeAudio(id);
        
        if (error) {
          console.error("Error retrying transcription:", error);
          toast.error(language === 'ar' ? 'فشل في إعادة محاولة التحويل' : 'Failed to retry transcription');
          return;
        }
        
        // Start polling for updates
        const intervalId = setInterval(fetchLatestStatus, 5000);
        
        // Clean up interval after 2 minutes if still processing
        setTimeout(() => clearInterval(intervalId), 120000);
      }
      
      if (hasSummaryError || isSummaryMissing) {
        // For failed summary, use the regeneration function
        toast.info(language === 'ar' ? 'جارٍ إعادة إنشاء الملخص...' : 'Regenerating summary...');
        
        const { success, error } = await voiceSummaryService.regenerateSummary(id);
        
        if (!success) {
          console.error("Error regenerating summary:", error);
          toast.error(language === 'ar' ? 'فشل في إعادة إنشاء الملخص' : 'Failed to regenerate summary');
          return;
        }
        
        // Start polling for updates
        const intervalId = setInterval(fetchLatestStatus, 5000);
        
        // Clean up interval after 2 minutes if still processing
        setTimeout(() => clearInterval(intervalId), 120000);
      }
    } catch (err) {
      console.error("Error retrying:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إعادة المحاولة' : 'An error occurred while retrying');
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (errorMessage || !recording) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">{language === 'ar' ? 'حدث خطأ' : 'An Error Occurred'}</h2>
        <p className="text-muted-foreground mb-6">{errorMessage}</p>
        <Button onClick={() => navigate('/voice-summary')}>
          {language === 'ar' ? 'العودة إلى التسجيلات' : 'Back to Recordings'}
        </Button>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full w-full">
      <div className="container max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6" {...rtlProps}>
          <div>
            <h1 className="text-2xl font-bold">{recording.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge()}
              <span className="text-sm text-muted-foreground">
                {formatDate(recording.created_at)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Error notification */}
        {hasError && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-start gap-3" {...rtlProps}>
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">{language === 'ar' ? 'خطأ في المعالجة' : 'Processing Error'}</h3>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {hasTranscriptError 
                      ? (language === 'ar' ? 'فشل في تحويل الصوت إلى نص: ' : 'Failed to transcribe audio: ') + recording.transcript_error
                      : hasSummaryError 
                        ? (language === 'ar' ? 'فشل في إنشاء الملخص: ' : 'Failed to generate summary: ') + recording.summary_error
                        : language === 'ar' ? 'حدث خطأ أثناء المعالجة' : 'An error occurred during processing'
                    }
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2" 
                    onClick={handleRetry}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        {language === 'ar' ? 'جارٍ إعادة المحاولة...' : 'Retrying...'}
                      </>
                    ) : (
                      language === 'ar' ? 'إعادة المحاولة' : 'Retry'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Transcript section */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center" {...rtlProps}>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'النص المكتوب' : 'Transcript'}
              </CardTitle>
              <div className="flex gap-2">
                {recording.transcript && !isEditingTranscript && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(recording.transcript)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTranscriptEdit}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </Button>
                  </>
                )}
                {isEditingTranscript && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isProcessing}
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveTranscript}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recordingStatus === 'transcribing' || recordingStatus === 'pending' ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'جارٍ تحويل الصوت إلى نص...' : 'Transcribing audio...'}
                </p>
              </div>
            ) : isTranscriptMissing || !recording.transcript ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'لا يوجد نص متاح' : 'No transcript available'}
                </p>
                {recordingStatus === 'complete' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleRetry}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      language === 'ar' ? 'إعادة المحاولة' : 'Retry Transcription'
                    )}
                  </Button>
                )}
              </div>
            ) : isEditingTranscript ? (
              <Textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                className={`min-h-[200px] w-full p-3 text-base ${language === 'ar' ? 'text-right' : ''}`}
                placeholder={language === 'ar' ? 'أدخل النص المعدل هنا...' : 'Enter edited transcript here...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            ) : (
              <div 
                className="prose max-w-none dark:prose-invert"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <p className="whitespace-pre-wrap text-pretty">
                  {recording.transcript}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Summary Section */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center" {...rtlProps}>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'الملخص' : 'Summary'}
              </CardTitle>
              <div className="flex gap-2">
                {recording.summary && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(recording.summary)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportPDF}
                      disabled={isProcessing}
                    >
                      <FilePdf className="h-4 w-4 mr-1" />
                      <span>{language === 'ar' ? 'PDF' : 'PDF'}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recordingStatus === 'processing' || recordingStatus === 'pending' || recordingStatus === 'transcribing' ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'جارٍ إنشاء الملخص...' : 'Generating summary...'}
                </p>
              </div>
            ) : isSummaryMissing || !recording.summary ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'لا يوجد ملخص متاح' : 'No summary available'}
                </p>
                {recordingStatus === 'complete' && recording.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleRetry}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      language === 'ar' ? 'إنشاء الملخص' : 'Generate Summary'
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="prose max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap text-pretty" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  {recording.summary}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Audio Player */}
        {recording.summary && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <SummaryAudioPlayer
                recordingId={id}
                summaryText={recording.summary}
                existingAudioUrl={recording.summary_audio_url}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
};

export default VoiceSummaryDetail;
