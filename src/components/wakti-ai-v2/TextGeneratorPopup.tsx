import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenTool, MessageSquare, Loader2, Brain, CheckCircle, AlertTriangle, Copy, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface TextGeneratorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
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
}

interface MessageAnalysis {
  messageType: string;
  intent: string;
  mainPoints: string[];
  questionsAsked: string[];
  urgency: string;
  tone: string;
  suggestedQuestions: AnalysisQuestion[];
}

interface AnalysisQuestion {
  id: string;
  question: string;
  options: string[];
  selectedOption?: string;
}

export function TextGeneratorPopup({ open, onOpenChange, onGenerated }: TextGeneratorPopupProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [messageAnalysis, setMessageAnalysis] = useState<MessageAnalysis | null>(null);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('compose');
  const [formData, setFormData] = useState<FormData>({
    mode: 'compose',
    contentType: '',
    tone: '',
    length: '',
    format: '',
    to: '',
    from: '',
    topic: '',
    originalMessage: ''
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
    { value: 'Numbered List', label: language === 'ar' ? 'قائمة مرقمة' : 'Numbered List' },
    { value: 'Paragraphs', label: language === 'ar' ? 'فقرات' : 'Paragraphs' }
  ];

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const analyzeMessageSimple = (message: string) => {
    const lowerText = message.toLowerCase();
    
    // Basic analysis without any task detection
    const analysis: MessageAnalysis = {
      messageType: "message",
      intent: "communication",
      mainPoints: [message.substring(0, 100) + (message.length > 100 ? "..." : "")],
      questionsAsked: [],
      urgency: "medium",
      tone: "neutral",
      suggestedQuestions: [
        {
          id: 'q1',
          question: language === 'ar' ? 'ما هو هدف ردك؟' : 'What is your reply goal?',
          options: language === 'ar' 
            ? ['موافقة', 'رفض', 'طلب معلومات', 'تقديم تحديث']
            : ['Accept', 'Decline', 'Ask for info', 'Provide update']
        }
      ]
    };

    // Detect basic patterns
    if (lowerText.includes("urgent") || lowerText.includes("asap")) {
      analysis.urgency = "high";
    }
    
    if (lowerText.includes("thank") || lowerText.includes("please")) {
      analysis.tone = "polite";
    }
    
    if (lowerText.includes("?")) {
      analysis.intent = "inquiry";
      analysis.questionsAsked = ["Question detected in message"];
    }

    return analysis;
  };

  const analyzeMessage = async (message: string) => {
    if (!message.trim()) return;
    
    setIsAnalyzing(true);
    setLastError(null);
    
    try {
      console.log('📝 TextGenerator: Starting simple message analysis...');
      
      // Use simple local analysis instead of external API
      const analysis = analyzeMessageSimple(message);
      setMessageAnalysis(analysis);
      
      // Auto-suggest tone based on analysis
      if (analysis.tone && !formData.tone) {
        const suggestedTone = tones.find(t => 
          t.value.toLowerCase() === analysis.tone.toLowerCase()
        );
        if (suggestedTone) {
          updateFormData('tone', suggestedTone.value);
        }
      }
      
      console.log('📝 TextGenerator: Simple analysis completed:', analysis);
    } catch (error: any) {
      console.error('📝 TextGenerator: Analysis error:', error);
      setLastError(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMessagePaste = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateFormData('originalMessage', value);
    
    // Auto-analyze when message is pasted or typed (with debounce)
    if (value.trim().length > 20) {
      setTimeout(() => {
        if (value === formData.originalMessage) {
          analyzeMessage(value);
        }
      }, 1000);
    } else {
      setMessageAnalysis(null);
    }
  };

  const updateQuestionAnswer = (questionId: string, selectedOption: string) => {
    if (!messageAnalysis) return;
    
    setMessageAnalysis(prev => ({
      ...prev!,
      suggestedQuestions: prev!.suggestedQuestions.map(q => 
        q.id === questionId ? { ...q, selectedOption } : q
      )
    }));
  };

  const isFormValid = () => {
    if (formData.mode === 'compose') {
      return formData.contentType && formData.tone && formData.length;
    } else {
      return formData.originalMessage.trim() && formData.tone && formData.length;
    }
  };

  const createEnhancedPrompt = (): string => {
    if (formData.mode === 'compose') {
      return `Generate a ${formData.contentType} about: ${formData.topic || 'the specified topic'}

TONE: ${formData.tone}
LENGTH: ${formData.length}
${formData.format ? `FORMAT: ${formData.format}` : ''}
${formData.to ? `To: ${formData.to}` : ''}
${formData.from ? `From: ${formData.from}` : ''}

IMPORTANT: Do not use asterisks (*) for formatting. Use clean, readable text without asterisk emphasis.`;
    } else {
      // Enhanced reply prompt with analysis context
      let prompt = `Reply to this message: "${formData.originalMessage}"

REPLY REQUIREMENTS:
- TONE: ${formData.tone}
- LENGTH: ${formData.length}
${formData.format ? `- FORMAT: ${formData.format}` : ''}
${formData.to ? `- To: ${formData.to}` : ''}
${formData.from ? `- From: ${formData.from}` : ''}

IMPORTANT: Do not use asterisks (*) for formatting. Use clean, readable text without asterisk emphasis.`;

      // Add analysis context if available
      if (messageAnalysis) {
        prompt += `

CONTEXT FROM ANALYSIS:
- Original message type: ${messageAnalysis.messageType}
- Intent: ${messageAnalysis.intent}
- Key points to address: ${messageAnalysis.mainPoints.join(', ')}
${messageAnalysis.questionsAsked.length > 0 ? `- Questions to answer: ${messageAnalysis.questionsAsked.join(', ')}` : ''}
- Urgency level: ${messageAnalysis.urgency}`;

        // Add user's answers to contextual questions
        const answeredQuestions = messageAnalysis.suggestedQuestions.filter(q => q.selectedOption);
        if (answeredQuestions.length > 0) {
          prompt += `

USER PREFERENCES:`;
          answeredQuestions.forEach(q => {
            prompt += `\n- ${q.question}: ${q.selectedOption}`;
          });
        }
      }

      return prompt;
    }
  };

  const handleGenerate = async () => {
    if (!isFormValid()) {
      toast.error(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    if (!user?.id) {
      toast.error(language === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please log in first');
      return;
    }

    setIsGenerating(true);
    setLastError(null);

    try {
      const enhancedPrompt = createEnhancedPrompt();
      console.log('📝 TextGenerator: Starting text generation...');
      console.log('📝 Generation input:', {
        promptLength: enhancedPrompt.length,
        mode: formData.mode,
        hasAnalysis: !!messageAnalysis
      });

      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('text-generator', {
        body: {
          prompt: enhancedPrompt,
          mode: formData.mode,
          language: language,
          messageAnalysis: messageAnalysis
        }
      });

      const duration = Date.now() - startTime;
      console.log(`📝 TextGenerator: Generation request completed in ${duration}ms`);

      if (error) {
        console.error('📝 TextGenerator: Generation error:', error);
        throw new Error(`Generation failed: ${error.message || 'Unknown error'}`);
      }

      console.log('📝 TextGenerator: Generation response:', {
        hasData: !!data,
        success: data?.success,
        hasGeneratedText: !!data?.generatedText,
        dataKeys: data ? Object.keys(data) : []
      });

      if (data.success && data.generatedText) {
        console.log('📝 TextGenerator: Generation successful, length:', data.generatedText.length);
        
        // Store the generated text and switch to the Generated Text tab
        setGeneratedText(data.generatedText);
        setActiveTab('generated');
        setLastError(null);

        toast.success(language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Text generated successfully');
      } else {
        const errorMsg = data?.error || 'No generated text received';
        console.error('📝 TextGenerator: Generation failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('📝 TextGenerator: Generation comprehensive error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      const errorMessage = error.message || (language === 'ar' ? 'فشل في إنشاء النص' : 'Failed to generate text');
      setLastError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      toast.success(language === 'ar' ? 'تم نسخ النص' : 'Text copied to clipboard');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };

  const handleUseInChat = () => {
    onGenerated(generatedText, formData.mode, true);
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
      originalMessage: ''
    });
    setMessageAnalysis(null);
    setGeneratedText('');
    setActiveTab('compose');
    setLastError(null);

    toast.success(language === 'ar' ? 'تم إرسال النص إلى المحادثة' : 'Text sent to chat');
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value !== 'generated') {
      setFormData(prev => ({ ...prev, mode: value as 'compose' | 'reply' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {language === 'ar' ? 'مولد النصوص الذكي' : 'Smart Text Generator'}
          </DialogTitle>
        </DialogHeader>

        {/* Error Display */}
        {lastError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {language === 'ar' ? 'خطأ' : 'Error'}
              </span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{lastError}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-1">
              <PenTool className="h-3 w-3" />
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </TabsTrigger>
            <TabsTrigger value="reply" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {language === 'ar' ? 'رد ذكي' : 'Smart Reply'}
            </TabsTrigger>
            {generatedText && (
              <TabsTrigger value="generated" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                <Label>{language === 'ar' ? 'التنسيق' : 'Format'}</Label>
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
            </div>

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
              <Label>{language === 'ar' ? 'الموضوع (اختياري)' : 'Topic (Optional)'}</Label>
              <Textarea
                value={formData.topic}
                onChange={(e) => updateFormData('topic', e.target.value)}
                placeholder={language === 'ar' ? 'يرجى تقديم النقاط الرئيسية حول ما تريد الكتابة عنه' : 'Please provide key points on what you want to write about'}
                className="min-h-16 max-h-24 resize-none"
              />
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
          </TabsContent>

          <TabsContent value="reply" className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'} *
                {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                {messageAnalysis && <Brain className="h-3 w-3 text-green-500" />}
              </Label>
              <Textarea
                value={formData.originalMessage}
                onChange={handleMessagePaste}
                placeholder={language === 'ar' ? 'الصق الرسالة التي تريد الرد عليها...' : 'Paste the message you want to reply to...'}
                className="min-h-20"
              />
              {isAnalyzing && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {language === 'ar' ? 'جاري تحليل الرسالة...' : 'Analyzing message...'}
                </p>
              )}
            </div>

            {/* Smart Analysis Results */}
            {messageAnalysis && (
              <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'تم التحليل بنجاح' : 'Analysis Complete'}
                  </span>
                </div>
                
                <div className="text-xs space-y-1">
                  <p><span className="font-medium">{language === 'ar' ? 'النوع:' : 'Type:'}</span> {messageAnalysis.messageType}</p>
                  <p><span className="font-medium">{language === 'ar' ? 'الهدف:' : 'Intent:'}</span> {messageAnalysis.intent}</p>
                  <p><span className="font-medium">{language === 'ar' ? 'الأولوية:' : 'Priority:'}</span> {messageAnalysis.urgency}</p>
                </div>

                {/* Dynamic Questions */}
                {messageAnalysis.suggestedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      {language === 'ar' ? 'أسئلة للمساعدة في الرد:' : 'Questions to help with reply:'}
                    </p>
                    {messageAnalysis.suggestedQuestions.map((question) => (
                      <div key={question.id} className="space-y-1">
                        <Label className="text-xs">{question.question}</Label>
                        <Select 
                          value={question.selectedOption || ''} 
                          onValueChange={(value) => updateQuestionAnswer(question.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={language === 'ar' ? 'اختر إجابة' : 'Select answer'} />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options.map((option) => (
                              <SelectItem key={option} value={option} className="text-xs">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
          </TabsContent>

          {/* New Generated Text Tab */}
          {generatedText && (
            <TabsContent value="generated" className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h3 className="font-medium">
                    {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
                  </h3>
                </div>
                
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {generatedText}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleCopyToClipboard}
                    variant="outline" 
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'نسخ النص' : 'Copy Text'}
                  </Button>
                  <Button 
                    onClick={handleUseInChat}
                    className="flex-1"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'استخدام في المحادثة' : 'Use in Chat'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Generate Button - Only show on Compose and Reply tabs */}
        {activeTab !== 'generated' && (
          <div className="flex gap-3 pt-4">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={!isFormValid() || isGenerating || isAnalyzing}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
