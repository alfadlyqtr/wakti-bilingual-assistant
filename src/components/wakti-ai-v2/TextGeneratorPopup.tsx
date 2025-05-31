import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenTool, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TextGeneratorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (text: string, mode: 'compose' | 'reply') => void;
}

interface FormData {
  mode: 'compose' | 'reply';
  contentType: string;
  tone: string;
  length: string;
  format: string;
  to: string;
  from: string;
  topic: string;
  originalMessage: string;
  replyType: string;
}

export function TextGeneratorPopup({ open, onOpenChange, onGenerated }: TextGeneratorPopupProps) {
  const { language } = useTheme();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    mode: 'compose',
    contentType: '',
    tone: '',
    length: '',
    format: '',
    to: '',
    from: '',
    topic: '',
    originalMessage: '',
    replyType: ''
  });

  const contentTypes = [
    { value: 'Text Message', label: language === 'ar' ? 'رسالة نصية' : 'Text Message' },
    { value: 'Email', label: language === 'ar' ? 'بريد إلكتروني' : 'Email' },
    { value: 'Report', label: language === 'ar' ? 'تقرير' : 'Report' },
    { value: 'Essay', label: language === 'ar' ? 'مقال' : 'Essay' },
    { value: 'Poem', label: language === 'ar' ? 'قصيدة' : 'Poem' },
    { value: 'Story', label: language === 'ar' ? 'قصة' : 'Story' }
  ];

  const tones = [
    { value: 'Formal', label: language === 'ar' ? 'رسمي' : 'Formal' },
    { value: 'Friendly', label: language === 'ar' ? 'ودود' : 'Friendly' },
    { value: 'Supportive', label: language === 'ar' ? 'داعم' : 'Supportive' },
    { value: 'Professional', label: language === 'ar' ? 'مهني' : 'Professional' },
    { value: 'Casual', label: language === 'ar' ? 'غير رسمي' : 'Casual' },
    { value: 'Enthusiastic', label: language === 'ar' ? 'متحمس' : 'Enthusiastic' }
  ];

  const lengths = [
    { value: 'Short', label: language === 'ar' ? 'قصير' : 'Short' },
    { value: 'Medium', label: language === 'ar' ? 'متوسط' : 'Medium' },
    { value: 'Long', label: language === 'ar' ? 'طويل' : 'Long' }
  ];

  const formats = [
    { value: 'Plain', label: language === 'ar' ? 'عادي' : 'Plain' },
    { value: 'Bullet Points', label: language === 'ar' ? 'نقاط' : 'Bullet Points' },
    { value: 'Paragraphs', label: language === 'ar' ? 'فقرات' : 'Paragraphs' }
  ];

  const replyTypes = [
    { value: 'Text Message', label: language === 'ar' ? 'رسالة نصية' : 'Text Message' },
    { value: 'Email', label: language === 'ar' ? 'بريد إلكتروني' : 'Email' }
  ];

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    if (formData.mode === 'compose') {
      return formData.contentType && formData.tone && formData.length && formData.format;
    } else {
      return formData.originalMessage.trim() && formData.replyType && formData.tone && formData.length && formData.format;
    }
  };

  const handleGenerate = async () => {
    console.log('🔍 TextGenerator: Generate button clicked');
    
    if (!isFormValid()) {
      console.log('🔍 TextGenerator: Form validation failed');
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    console.log('🔍 TextGenerator: Starting generation process...');

    try {
      const payload = {
        mode: formData.mode,
        ...(formData.mode === 'compose' ? {
          contentType: formData.contentType,
          topic: formData.topic
        } : {
          originalMessage: formData.originalMessage,
          replyType: formData.replyType
        }),
        tone: formData.tone,
        length: formData.length,
        format: formData.format,
        to: formData.to,
        from: formData.from
      };

      console.log('🔍 TextGenerator: Calling text-generator function with payload:', payload);

      const { data, error } = await supabase.functions.invoke('text-generator', {
        body: payload
      });

      console.log('🔍 TextGenerator: Function response:', { data, error });

      if (error) {
        console.error('🔍 TextGenerator: Supabase function error:', error);
        throw new Error(error.message || 'Function call failed');
      }

      if (data?.error) {
        console.error('🔍 TextGenerator: Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (data?.generatedText) {
        console.log('🔍 TextGenerator: Text generated successfully');
        onGenerated(data.generatedText, formData.mode);
        onOpenChange(false);
        
        // Reset form
        setFormData({
          mode: 'compose',
          contentType: '',
          tone: '',
          length: '',
          format: '',
          to: '',
          from: '',
          topic: '',
          originalMessage: '',
          replyType: ''
        });

        toast({
          title: language === 'ar' ? 'نجح!' : 'Success!',
          description: language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Text generated successfully',
        });
      } else {
        console.error('🔍 TextGenerator: No generated text in response:', data);
        throw new Error('No generated text received');
      }
    } catch (error: any) {
      console.error('🔍 TextGenerator: Generation error:', error);
      
      let errorMessage = error.message || (language === 'ar' ? 'فشل في إنشاء النص' : 'Failed to generate text');
      
      // Check for specific error types
      if (errorMessage.includes('not configured')) {
        errorMessage = language === 'ar' ? 'خطأ في إعداد النظام - يرجى المحاولة لاحقاً' : 'System configuration error - please try again later';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = language === 'ar' ? 'خطأ في الاتصال - يرجى التحقق من الإنترنت' : 'Connection error - please check your internet';
      }
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {language === 'ar' ? 'مولد النصوص' : 'Text Generator'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={formData.mode} onValueChange={(value) => updateFormData('mode', value)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose" className="flex items-center gap-1">
              <PenTool className="h-3 w-3" />
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </TabsTrigger>
            <TabsTrigger value="reply" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {language === 'ar' ? 'رد' : 'Reply'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع المحتوى' : 'Content Type'} *</Label>
              <Select value={formData.contentType} onValueChange={(value) => updateFormData('contentType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر نوع المحتوى' : 'Select content type'} />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الموضوع (اختياري)' : 'Topic (Optional)'}</Label>
              <Input
                value={formData.topic}
                onChange={(e) => updateFormData('topic', e.target.value)}
                placeholder={language === 'ar' ? 'ما الذي تريد الكتابة عنه؟' : 'What do you want to write about?'}
              />
            </div>
          </TabsContent>

          <TabsContent value="reply" className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'} *</Label>
              <Textarea
                value={formData.originalMessage}
                onChange={(e) => updateFormData('originalMessage', e.target.value)}
                placeholder={language === 'ar' ? 'الصق الرسالة التي تريد الرد عليها...' : 'Paste the message you want to reply to...'}
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع الرد' : 'Reply Type'} *</Label>
              <Select value={formData.replyType} onValueChange={(value) => updateFormData('replyType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر نوع الرد' : 'Select reply type'} />
                </SelectTrigger>
                <SelectContent>
                  {replyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Common fields for both modes */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'النبرة' : 'Tone'} *</Label>
              <Select value={formData.tone} onValueChange={(value) => updateFormData('tone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'نبرة' : 'Tone'} />
                </SelectTrigger>
                <SelectContent>
                  {tones.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الطول' : 'Length'} *</Label>
              <Select value={formData.length} onValueChange={(value) => updateFormData('length', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'طول' : 'Length'} />
                </SelectTrigger>
                <SelectContent>
                  {lengths.map((length) => (
                    <SelectItem key={length.value} value={length.value}>
                      {length.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'التنسيق' : 'Format'} *</Label>
            <Select value={formData.format} onValueChange={(value) => updateFormData('format', value)}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر التنسيق' : 'Select format'} />
              </SelectTrigger>
              <SelectContent>
                {formats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'إلى' : 'To'}</Label>
              <Input
                value={formData.to}
                onChange={(e) => updateFormData('to', e.target.value)}
                placeholder={language === 'ar' ? 'المستقبل' : 'Recipient'}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'من' : 'From'}</Label>
              <Input
                value={formData.from}
                onChange={(e) => updateFormData('from', e.target.value)}
                placeholder={language === 'ar' ? 'المرسل' : 'Sender'}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!isFormValid() || isGenerating}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
              </>
            ) : (
              <>
                <PenTool className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إنشاء النص' : 'Generate Text'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
