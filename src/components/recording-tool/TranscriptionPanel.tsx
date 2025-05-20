
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/providers/ThemeProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Edit, CheckCircle, Copy } from "lucide-react";
import { useRecordingStore } from './hooks/useRecordingStore';
import { useTranscription } from './hooks/useTranscription';
import { toast } from 'sonner';

const TranscriptionPanel: React.FC = () => {
  const { language } = useTheme();
  const { transcription } = useRecordingStore();
  const { updateTranscript } = useTranscription();
  
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(transcription || '');
  const [isSaving, setIsSaving] = useState(false);
  
  const handleEdit = () => {
    setEditedText(transcription || '');
    setEditMode(true);
  };
  
  const handleSave = async () => {
    if (!editedText.trim()) {
      toast.error(language === 'ar' ? 'النص لا يمكن أن يكون فارغًا' : 'Transcript cannot be empty');
      return;
    }
    
    setIsSaving(true);
    const success = await updateTranscript(editedText);
    setIsSaving(false);
    
    if (success) {
      setEditMode(false);
      toast.success(language === 'ar' ? 'تم حفظ النص بنجاح' : 'Transcript saved successfully');
    } else {
      toast.error(language === 'ar' ? 'فشل في حفظ النص' : 'Failed to save transcript');
    }
  };
  
  const handleCancel = () => {
    setEditMode(false);
  };
  
  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      toast.success(language === 'ar' ? 'تم نسخ النص إلى الحافظة' : 'Copied to clipboard');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>{language === 'ar' ? 'النص' : 'Transcript'}</span>
          <div className="flex gap-1">
            {!editMode && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleCopy}
                  title={language === 'ar' ? 'نسخ النص' : 'Copy transcript'}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleEdit}
                  title={language === 'ar' ? 'تعديل النص' : 'Edit transcript'}
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
              placeholder={language === 'ar' ? 'أدخل النص هنا...' : 'Enter transcript here...'}
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
          <div className="whitespace-pre-wrap text-sm">
            {transcription || (
              <span className="text-muted-foreground italic">
                {language === 'ar' ? 'لم يتم إنشاء نص بعد' : 'No transcript generated yet'}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptionPanel;
