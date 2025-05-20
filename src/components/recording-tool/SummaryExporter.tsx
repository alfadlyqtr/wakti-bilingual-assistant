
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { useRecordingStore } from './hooks/useRecordingStore';
import { toast } from 'sonner';

// Note: We'll use an existing PDF generation utility if you have one
// or can implement a simple one here

const SummaryExporter: React.FC = () => {
  const { language } = useTheme();
  const { title, recordingType, transcription, summary, audioUrl, summaryAudioUrl } = useRecordingStore();
  
  const [isExporting, setIsExporting] = useState(false);
  
  const exportAsPDF = async () => {
    try {
      setIsExporting(true);
      
      // Simple fallback if we don't have access to PDF generation libraries
      const content = `
${title || (language === 'ar' ? 'تسجيل بدون عنوان' : 'Untitled Recording')}
${new Date().toLocaleDateString()}

${language === 'ar' ? 'النوع:' : 'Type:'} ${recordingType}

${language === 'ar' ? 'النص:' : 'Transcript:'}
${transcription || (language === 'ar' ? 'لا يوجد نص' : 'No transcript available')}

${language === 'ar' ? 'الملخص:' : 'Summary:'}
${summary || (language === 'ar' ? 'لا يوجد ملخص' : 'No summary available')}
      `;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'recording'}-export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(language === 'ar' ? 'تم تصدير المحتوى بنجاح' : 'Content exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(language === 'ar' ? 'فشل في تصدير المحتوى' : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  const downloadOriginalAudio = () => {
    if (!audioUrl) {
      toast.error(language === 'ar' ? 'ملف الصوت غير متوفر' : 'Audio file not available');
      return;
    }
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${title || 'recording'}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const downloadSummaryAudio = () => {
    if (!summaryAudioUrl) {
      toast.error(language === 'ar' ? 'ملف صوت الملخص غير متوفر' : 'Summary audio file not available');
      return;
    }
    
    const a = document.createElement('a');
    a.href = summaryAudioUrl;
    a.download = `${title || 'summary'}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {language === 'ar' ? 'تصدير وتنزيل' : 'Export and Download'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={exportAsPDF}
            disabled={isExporting || (!transcription && !summary)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {isExporting
              ? (language === 'ar' ? 'جارٍ التصدير...' : 'Exporting...')
              : (language === 'ar' ? 'تصدير كملف نصي' : 'Export as Text')}
          </Button>
          
          <Button
            variant="outline"
            onClick={downloadOriginalAudio}
            disabled={!audioUrl}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {language === 'ar' ? 'تنزيل التسجيل' : 'Download Recording'}
          </Button>
          
          {summaryAudioUrl && (
            <Button
              variant="outline"
              onClick={downloadSummaryAudio}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {language === 'ar' ? 'تنزيل صوت الملخص' : 'Download Summary Audio'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SummaryExporter;
