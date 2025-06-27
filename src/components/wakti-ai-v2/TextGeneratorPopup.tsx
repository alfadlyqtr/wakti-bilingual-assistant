
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wand2, Reply, FileText, Copy, RotateCcw, CheckCircle } from 'lucide-react';
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
  const [generatedText, setGeneratedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Compose tab state
  const [composePrompt, setComposePrompt] = useState('');
  const [contentType, setContentType] = useState('');
  const [tone, setTone] = useState('');
  const [length, setLength] = useState('');
  
  // Reply tab state
  const [keywords, setKeywords] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [replyTone, setReplyTone] = useState('');
  const [replyLength, setReplyLength] = useState('');

  // RESTORED: All content types including poem and story
  const contentTypes = {
    email: language === 'ar' ? 'بريد إلكتروني' : 'Email',
    letter: language === 'ar' ? 'خطاب' : 'Letter',
    report: language === 'ar' ? 'تقرير' : 'Report',
    article: language === 'ar' ? 'مقال' : 'Article',
    social_post: language === 'ar' ? 'منشور اجتماعي' : 'Social Media Post',
    official_letter: language === 'ar' ? 'كتاب رسمي' : 'Official Letter',
    poem: language === 'ar' ? 'قصيدة' : 'Poem', // RESTORED
    story: language === 'ar' ? 'قصة' : 'Story' // RESTORED
  };

  // RESTORED: All tones including romantic
  const tones = {
    professional: language === 'ar' ? 'مهني' : 'Professional',
    casual: language === 'ar' ? 'عادي' : 'Casual',
    formal: language === 'ar' ? 'رسمي' : 'Formal',
    friendly: language === 'ar' ? 'ودود' : 'Friendly',
    persuasive: language === 'ar' ? 'مقنع' : 'Persuasive',
    romantic: language === 'ar' ? 'رومانسي' : 'Romantic'
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
        // Build reply prompt with keywords and original message
        prompt = language === 'ar' ? 
          'اكتب رداً على الرسالة التالية:' : 
          'Write a reply to the following message:';
        
        prompt += `\n\n${language === 'ar' ? 'الرسالة الأصلية:' : 'Original Message:'}\n${originalMessage}`;
        
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

      console.log('🎯 Text Generator: Using DeepSeek for generation');
      
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

      setGeneratedText(data.generatedText);
      setActiveTab('generated'); // Switch to generated text tab
      showSuccess(language === 'ar' ? 'تم إنشاء النص بنجاح!' : 'Text generated successfully!');
      
    } catch (error: any) {
      console.error('Text generation error:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء النص' : 'Failed to generate text'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setIsCopied(true);
      showSuccess(language === 'ar' ? 'تم نسخ النص!' : 'Text copied!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      showError(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };

  const handleUseText = () => {
    onTextGenerated(generatedText, activeTab as 'compose' | 'reply');
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
    setGeneratedText('');
  };

  const handleRegenerate = () => {
    setGeneratedText('');
    generateText();
  };

  const handleClose = () => {
    // Reset all states
    setActiveTab('compose');
    setGeneratedText('');
    setComposePrompt('');
    setKeywords('');
    setOriginalMessage('');
    setContentType('');
    setTone('');
    setReplyTone('');
    setLength('');
    setReplyLength('');
    setIsCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="w-5 h-5" />
            {language === 'ar' ? 'منشئ النصوص الذكي' : 'Smart Text Generator'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="compose" className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </TabsTrigger>
            <TabsTrigger value="reply" className="flex items-center gap-2 text-sm">
              <Reply className="w-4 h-4" />
              {language === 'ar' ? 'رد' : 'Reply'}
            </TabsTrigger>
            <TabsTrigger value="generated" className="flex items-center gap-2 text-sm" disabled={!generatedText}>
              <Wand2 className="w-4 h-4" />
              {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="compose-prompt" className="text-sm font-medium">
                {language === 'ar' ? 'الموضوع أو الفكرة' : 'Topic or Idea'}
              </Label>
              <Textarea
                id="compose-prompt"
                placeholder={language === 'ar' ? 'اكتب الموضوع أو الفكرة التي تريد إنشاء نص حولها...' : 'Enter the topic or idea you want to write about...'}
                value={composePrompt}
                onChange={(e) => setComposePrompt(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="mt-2">
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
                <Label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-2">
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
                <Label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="mt-2">
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

          <TabsContent value="reply" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="keywords" className="text-sm font-medium">
                  {language === 'ar' ? 'النقاط المهمة أو الكلمات المفتاحية' : 'Key Points or Keywords'}
                </Label>
                <Textarea
                  id="keywords"
                  placeholder={language === 'ar' ? 'اكتب النقاط المهمة أو الكلمات المفتاحية التي تريد تضمينها في الرد...' : 'Enter key points or keywords you want to include in the reply...'}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={2}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'و' : 'and'}
                </span>
                <Separator className="flex-1" />
              </div>

              <div>
                <Label htmlFor="original-message" className="text-sm font-medium">
                  {language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'}
                </Label>
                <Textarea
                  id="original-message"
                  placeholder={language === 'ar' ? 'الصق الرسالة الأصلية التي تريد الرد عليها...' : 'Paste the original message you want to reply to...'}
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={replyTone} onValueChange={setReplyTone}>
                  <SelectTrigger className="mt-2">
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
                <Label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={replyLength} onValueChange={setReplyLength}>
                  <SelectTrigger className="mt-2">
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

          <TabsContent value="generated" className="space-y-4 mt-4">
            {generatedText ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">
                      {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyText}
                        className="flex items-center gap-2"
                      >
                        {isCopied ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {language === 'ar' ? 'نسخ' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {language === 'ar' ? 'إعادة إنشاء' : 'Regenerate'}
                      </Button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                    {generatedText}
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleUseText} className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4" />
                    {language === 'ar' ? 'استخدام النص' : 'Use Text'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'ar' ? 'لا يوجد نص مُولد بعد' : 'No generated text yet'}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {activeTab !== 'generated' && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TextGeneratorPopup;
