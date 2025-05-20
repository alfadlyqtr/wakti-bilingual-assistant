
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/providers/ThemeProvider";
import { RecordingType, useRecordingStore } from './hooks/useRecordingStore';

interface IntakeFormProps {
  onSubmit: () => void;
}

const IntakeForm: React.FC<IntakeFormProps> = ({ onSubmit }) => {
  const { language } = useTheme();
  const { title, recordingType, setTitle, setRecordingType } = useRecordingStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const getPlaceholder = () => {
    if (language === 'ar') {
      return 'عنوان التسجيل (اختياري)';
    }
    return 'Recording title (optional)';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recording-title">
          {language === 'ar' ? 'العنوان' : 'Title'}
        </Label>
        <Input
          id="recording-title"
          placeholder={getPlaceholder()}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recording-type">
          {language === 'ar' ? 'النوع' : 'Type'}
        </Label>
        <Select
          value={recordingType}
          onValueChange={(value) => setRecordingType(value as RecordingType)}
        >
          <SelectTrigger id="recording-type" className="w-full">
            <SelectValue 
              placeholder={language === 'ar' ? 'اختر نوع التسجيل' : 'Select recording type'} 
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="note">{language === 'ar' ? 'ملاحظة' : 'Note'}</SelectItem>
            <SelectItem value="summary">{language === 'ar' ? 'ملخص' : 'Summary'}</SelectItem>
            <SelectItem value="meeting">{language === 'ar' ? 'اجتماع' : 'Meeting'}</SelectItem>
            <SelectItem value="lecture">{language === 'ar' ? 'محاضرة' : 'Lecture'}</SelectItem>
            <SelectItem value="idea">{language === 'ar' ? 'فكرة' : 'Idea'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit">
          {language === 'ar' ? 'بدء التسجيل' : 'Start Recording'}
        </Button>
      </div>
    </form>
  );
};

export default IntakeForm;
