
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, FileText, CheckCircle, Clock, DownloadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VoiceSummaryArchiveProps {
  recordings: any[];
}

export default function VoiceSummaryArchive({ recordings }: VoiceSummaryArchiveProps) {
  const navigate = useNavigate();
  const { language } = useTheme();

  const locale = language === 'ar' ? arSA : enUS;

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'completed':
        return language === 'ar' ? 'مكتمل' : 'Completed';
      case 'pending':
        return language === 'ar' ? 'قيد المعالجة' : 'Processing';
      case 'edited':
        return language === 'ar' ? 'تم التعديل' : 'Edited';
      default:
        return language === 'ar' ? 'غير معروف' : 'Unknown';
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
    }
  };

  return (
    <div className="space-y-3">
      {recordings.map((recording) => (
        <Card 
          key={recording.id}
          className="hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => navigate(`/voice-summary/${recording.id}`)}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-base line-clamp-1">
                    {recording.title || (language === 'ar' ? 'تسجيل بدون عنوان' : 'Untitled Recording')}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(recording.created_at), { 
                      addSuffix: true, 
                      locale 
                    })}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {recording.recording_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(recording.recording_url, `recording-${recording.id}.mp3`);
                    }}
                  >
                    <DownloadCloud className="h-4 w-4" />
                  </Button>
                )}
                <Badge 
                  variant={recording.transcription_status === 'completed' ? "default" : "outline"}
                  className="ml-2 flex items-center gap-1"
                >
                  {getStatusIcon(recording.transcription_status)}
                  <span>{getStatusText(recording.transcription_status)}</span>
                </Badge>
              </div>
            </div>
            
            {recording.transcription_text && (
              <div className="mt-2 border-t pt-2 border-border/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <FileText className="h-3 w-3" />
                  <span>{language === 'ar' ? 'النص' : 'Transcript'}</span>
                </div>
                <p className="text-sm line-clamp-2">{recording.transcription_text}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
