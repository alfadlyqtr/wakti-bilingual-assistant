
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/providers/ThemeProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Edit, CheckCircle, Copy, Play, Pause, Volume } from "lucide-react";
import { useRecordingStore } from './hooks/useRecordingStore';
import { useSummaryHandlers } from './hooks/useSummaryHandlers';
import { toast } from 'sonner';

const SummaryPanel: React.FC = () => {
  const { language } = useTheme();
  const { summary, summaryAudioUrl } = useRecordingStore();
  const { updateSummary, generateTTS, isGeneratingAudio } = useSummaryHandlers();
  
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(summary || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  
  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.remove();
      }
    };
  }, [audio]);
  
  const handleEdit = () => {
    setEditedText(summary || '');
    setEditMode(true);
  };
  
  const handleSave = async () => {
    if (!editedText.trim()) {
      toast.error(language === 'ar' ? 'الملخص لا يمكن أن يكون فارغًا' : 'Summary cannot be empty');
      return;
    }
    
    setIsSaving(true);
    const success = await updateSummary(editedText);
    setIsSaving(false);
    
    if (success) {
      setEditMode(false);
      toast.success(language === 'ar' ? 'تم حفظ الملخص بنجاح' : 'Summary saved successfully');
      
      // Regenerate TTS if summary was changed
      if (editedText !== summary) {
        await generateTTS(editedText);
      }
    } else {
      toast.error(language === 'ar' ? 'فشل في حفظ الملخص' : 'Failed to save summary');
    }
  };
  
  const handleCancel = () => {
    setEditMode(false);
  };
  
  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      toast.success(language === 'ar' ? 'تم نسخ الملخص إلى الحافظة' : 'Copied to clipboard');
    }
  };
  
  const handlePlayPause = () => {
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    
    if (!summaryAudioUrl) {
      toast.error(language === 'ar' ? 'ملف الصوت غير متوفر' : 'Audio file not available');
      return;
    }
    
    // Stop any existing audio
    if (audio) {
      audio.pause();
      audio.remove();
    }
    
    // Create new audio element
    const newAudio = new Audio(summaryAudioUrl);
    setAudio(newAudio);
    
    // Set up event handlers
    newAudio.onended = () => setIsPlaying(false);
    newAudio.onpause = () => setIsPlaying(false);
    newAudio.onerror = () => {
      toast.error(language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio');
      setIsPlaying(false);
    };
    
    // Play the audio
    newAudio.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing audio:', error);
        toast.error(language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio');
      });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>{language === 'ar' ? 'الملخص' : 'Summary'}</span>
          <div className="flex gap-1">
            {!editMode && (
              <>
                {summaryAudioUrl && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handlePlayPause}
                    title={isPlaying 
                      ? (language === 'ar' ? 'إيقاف الصوت' : 'Pause audio')
                      : (language === 'ar' ? 'تشغيل الصوت' : 'Play audio')}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Volume className="h-4 w-4" />}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleCopy}
                  title={language === 'ar' ? 'نسخ الملخص' : 'Copy summary'}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleEdit}
                  title={language === 'ar' ? 'تعديل الملخص' : 'Edit summary'}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editMode ? (
          <div className="space-y-3">
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل الملخص هنا...' : 'Enter summary here...'}
              className="min-h-[200px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span>{language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="whitespace-pre-wrap text-sm mb-4">
              {summary || (
                <span className="text-muted-foreground italic">
                  {language === 'ar' ? 'لم يتم إنشاء ملخص بعد' : 'No summary generated yet'}
                </span>
              )}
            </div>
            
            {summary && !summaryAudioUrl && !isGeneratingAudio && (
              <div className="mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => generateTTS(summary)}
                >
                  <Volume className="mr-2 h-4 w-4" />
                  {language === 'ar' ? 'إنشاء ملف صوتي' : 'Generate audio'}
                </Button>
              </div>
            )}
            
            {isGeneratingAudio && (
              <div className="mt-3 text-sm text-muted-foreground">
                {language === 'ar' ? 'جارٍ إنشاء الصوت...' : 'Generating audio...'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SummaryPanel;
