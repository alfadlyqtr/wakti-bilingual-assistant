
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Copy, FileText } from "lucide-react";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useToast } from "@/hooks/use-toast";
import { generateSummaryPDF } from "@/utils/pdfUtils";

interface SummaryExporterProps {
  summaryId?: string;
}

export const SummaryExporter: React.FC<SummaryExporterProps> = ({ summaryId }) => {
  const { 
    title, 
    type, 
    audioUrl,
    summary, 
    summaryAudioUrl, 
    transcription 
  } = useRecordingStore();
  
  const { toast } = useToast();
  const { language } = useTheme();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t("copied_to_clipboard", language),
        description: `${label} ${t("copied_successfully", language)}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("copy_failed", language),
      });
    }
  };

  const exportAsPDF = () => {
    try {
      const pdfBlob = generateSummaryPDF({
        title: title || "Untitled",
        content: {
          transcript: transcription,
          summary: summary,
        },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
          type: type,
        },
        language: language as 'en' | 'ar',
      });
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'recording'}_summary.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: t("export_successful", language),
        description: t("pdf_downloaded_successfully", language),
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({
        variant: "destructive",
        title: t("export_failed", language),
      });
    }
  };

  const downloadAudio = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!transcription || !summary) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-wrap gap-3 justify-center py-6">
        {transcription && (
          <Button
            variant="outline"
            onClick={() => copyToClipboard(transcription, t("transcription", language))}
            className="flex gap-2"
          >
            <Copy className="h-4 w-4" />
            {t("copy_transcript", language)}
          </Button>
        )}
        
        {summary && (
          <Button
            variant="outline"
            onClick={() => copyToClipboard(summary, t("summary", language))}
            className="flex gap-2"
          >
            <Copy className="h-4 w-4" />
            {t("copy_summary", language)}
          </Button>
        )}
        
        <Button onClick={exportAsPDF} className="flex gap-2">
          <FileText className="h-4 w-4" />
          {t("export_pdf", language)}
        </Button>
        
        {audioUrl && (
          <Button
            variant="outline"
            onClick={() => downloadAudio(audioUrl, `${title || 'recording'}.mp3`)}
            className="flex gap-2"
          >
            <Download className="h-4 w-4" />
            {t("download_recording", language)}
          </Button>
        )}
        
        {summaryAudioUrl && (
          <Button
            variant="outline"
            onClick={() => downloadAudio(summaryAudioUrl, `${title || 'summary'}.mp3`)}
            className="flex gap-2"
          >
            <Download className="h-4 w-4" />
            {t("download_summary_audio", language)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
