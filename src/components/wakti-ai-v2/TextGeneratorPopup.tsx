
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wand2, Reply, FileText, Separator } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface TextGeneratorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
}

const TextGeneratorPopup: React.FC<TextGeneratorPopupProps> = ({
  isOpen,
  onClose,
  onTextGenerated
}) => {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isLoading, setIsLoading] = useState(false);
  
  // Compose tab state
  const [composePrompt, setComposePrompt] = useState('');
  const [contentType, setContentType] = useState('');
  const [tone, setTone] = useState('');
  const [length, setLength] = useState('');
  
  // Reply tab state - ENHANCED: Split into keywords and original message
  const [keywords, setKeywords] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [replyTone, setReplyTone] = useState('');
  const [replyLength, setReplyLength] = useState('');

  // ENHANCED: Updated content types with new Arabic option
  const contentTypes = {
    email: language === 'ar' ? 'بريد إلكتروني' : 'Email',
    letter: language === 'ar' ? 'خطاب' : 'Letter',
    report: language === 'ar' ? 'تقرير' : 'Report',
    article: language === 'ar' ? 'مقال' : 'Article',
    social_post: language === 'ar' ? 'منشور اجتماعي' : 'Social Media Post',
    official_letter: language === 'ar' ? 'كتاب رسمي' : 'Official Letter' // NEW
  };

  // ENHANCED: Updated tones with new romantic option
  const tones = {
    professional: language === 'ar' ? 'مهني' : 'Professional',
    casual: language === 'ar' ? 'عادي' : 'Casual',
    formal: language === 'ar' ? 'رسمي' : 'Formal',
    friendly: language === 'ar' ? 'ودود' : 'Friendly',
    persuasive: language === 'ar' ? 'مقنع' : 'Persuasive',
    romantic: language === 'ar' ? 'رومانسي' : 'Romantic' // NEW
  };

  const lengths = {
    short: language === 'ar' ? 'قصير' : 'Short',
    medium: language === 'ar' ? 'متوسط' : 'Medium',
    long: language === 'ar' ? 'طويل' : 'Long'
  };

  const generateText = async () => {
    if (activeTab === 'compose' && !composePrompt.trim()) {
      showError(language === 'ar' ? 'يرجى إدخال الموضوع أو الفكرة' : 'Please enter a topic or idea');
      return;
    }
    
    if (activeTab === 'reply' && !originalMessage.trim()) {
      showError(language === 'ar' ? 'يرجى إدخال الرسالة الأصلية' : 'Please enter the original message');
      return;
    }

    setIsLoading(true);
    
    try {
      let prompt = '';
      
      if (activeTab === 'compose') {
        // Build compose prompt
        prompt = language === 'ar' ? 
          `اكتب ${contentType ? contentTypes[contentType] : 'نص'} حول: ${composePrompt}` :
          `Write a ${contentType ? contentTypes[contentType] : 'text'} about: ${composePrompt}`;
        
        if (tone) {
          prompt += language === 'ar' ? 
            `\nالنبرة: ${tones[tone]}` : 
            `\nTone: ${tones[tone]}`;
        }
        
        if (length) {
          prompt += language === 'ar' ? 
            `\nالطول: ${lengths[length]}` : 
            `\nLength: ${lengths[length]}`;
        }
      } else {
        // ENHANCED: Build reply prompt with keywords and original message
        prompt = language === 'ar' ? 
          'اكتب رداً على الرسالة التالية:' : 
          'Write a reply to the following message:';
        
        prompt += `\n\n${language === 'ar' ? 'الرسالة الأصلية:' : 'Original Message:'}\n${originalMessage}`;
        
        // ENHANCED: Include keywords if provided
        if (keywords.trim()) {
          prompt += `\n\n${language === 'ar' ? 'النقاط المهمة للتضمين:' : 'Key Points to Include:'}\n${keywords}`;
        }
        
        if (replyTone) {
          prompt += language === 'ar' ? 
            `\nالنبرة: ${tones[replyTone]}` : 
            `\nTone: ${tones[replyTone]}`;
        }
        
        if (replyLength) {
          prompt += language === 'ar' ? 
            `\nالطول: ${lengths[replyLength]}` : 
            `\nLength: ${lengths[replyLength]}`;
        }
      }

      console.log('🎯 FIXED: Using text-generator function (DeepSeek primary)');
      
      // FIXED: Use text-generator function instead of unified-ai-brain
      const { data, error } = await supabase.functions.invoke('text-generator', {
        body: {
          prompt: prompt,
          mode: activeTab,
          language: language
        }
      });

      if (error) {
        console.error('Text generation error:', error);
        throw new Error(error.message || 'Text generation failed');
      }

      if (!data?.generatedText) {
        throw new Error('No text generated');
      }

      onTextGenerated(data.generatedText, activeTab as 'compose' | 'reply');
      showSuccess(language === 'ar' ? 'تم إنشاء النص بنجاح!' : 'Text generated successfully!');
      onClose();
      
      // Reset form
      setComposePrompt('');
      setKeywords('');
      setOriginalMessage('');
      setContentType('');
      setTone('');
      setReplyTone('');
      setLength('');
      setReplyLength('');
      
    } catch (error: any) {
      console.error('Text generation error:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء النص' : 'Failed to generate text'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            {language === 'ar' ? 'منشئ النصوص الذكي' : 'Smart Text Generator'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </TabsTrigger>
            <TabsTrigger value="reply" className="flex items-center gap-2">
              <Reply className="w-4 h-4" />
              {language === 'ar' ? 'رد' : 'Reply'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div>
              <Label htmlFor="compose-prompt">
                {language === 'ar' ? 'الموضوع أو الفكرة' : 'Topic or Idea'}
              </Label>
              <Textarea
                id="compose-prompt"
                placeholder={language === 'ar' ? 'اكتب الموضوع أو الفكرة التي تريد إنشاء نص حولها...' : 'Enter the topic or idea you want to write about...'}
                value={composePrompt}
                onChange={(e) => setComposePrompt(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contentTypes).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النبرة' : 'Select tone'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tones).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={language === 'ar' ? 'اختر الطول' : 'Select length'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(lengths).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reply" className="space-y-4">
            {/* ENHANCED: Split message box with keywords and original message */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="keywords">
                  {language === 'ar' ? 'النقاط المهمة أو الكلمات المفتاحية' : 'Key Points or Keywords'}
                </Label>
                <Textarea
                  id="keywords"
                  placeholder={language === 'ar' ? 'اكتب النقاط المهمة أو الكلمات المفتاحية التي تريد تضمينها في الرد...' : 'Enter key points or keywords you want to include in the reply...'}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              {/* ENHANCED: Visual divider */}
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'و' : 'and'}
                </span>
                <Separator className="flex-1" />
              </div>

              <div>
                <Label htmlFor="original-message">
                  {language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'}
                </Label>
                <Textarea
                  id="original-message"
                  placeholder={language === 'ar' ? 'الصق الرسالة الأصلية التي تريد الرد عليها...' : 'Paste the original message you want to reply to...'}
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={replyTone} onValueChange={setReplyTone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النبرة' : 'Select tone'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tones).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={replyLength} onValueChange={setReplyLength}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={language === 'ar' ? 'اختر الطول' : 'Select length'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(lengths).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={generateText} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {language === 'ar' ? 'إنشاء النص' : 'Generate Text'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TextGeneratorPopup;
