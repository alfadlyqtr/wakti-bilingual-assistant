
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Search, ImagePlus, Wand2, MessageSquare, Mail, FileText, PenTool } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

interface TextGeneratorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
}

export default function TextGeneratorPopup({ 
  open, 
  onOpenChange, 
  onTextGenerated 
}: TextGeneratorPopupProps) {
  const { language } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const categories = [
    {
      id: 'email',
      name: language === 'ar' ? 'البريد الإلكتروني' : 'Email',
      icon: Mail,
      prompts: [
        language === 'ar' ? 'كتابة رد مهذب على بريد إلكتروني' : 'Write a polite email reply',
        language === 'ar' ? 'صياغة بريد إلكتروني رسمي' : 'Draft a formal email',
        language === 'ar' ? 'كتابة رسالة شكر' : 'Write a thank you message'
      ]
    },
    {
      id: 'social',
      name: language === 'ar' ? 'وسائل التواصل' : 'Social Media',
      icon: MessageSquare,
      prompts: [
        language === 'ar' ? 'كتابة منشور جذاب' : 'Write an engaging post',
        language === 'ar' ? 'صياغة تعليق مدروس' : 'Draft a thoughtful comment',
        language === 'ar' ? 'إنشاء وصف للصورة' : 'Create an image caption'
      ]
    },
    {
      id: 'business',
      name: language === 'ar' ? 'الأعمال' : 'Business',
      icon: FileText,
      prompts: [
        language === 'ar' ? 'كتابة اقتراح مشروع' : 'Write a project proposal',
        language === 'ar' ? 'صياغة تقرير' : 'Draft a report',
        language === 'ar' ? 'إنشاء جدول أعمال اجتماع' : 'Create a meeting agenda'
      ]
    },
    {
      id: 'creative',
      name: language === 'ar' ? 'الإبداع' : 'Creative',
      icon: PenTool,
      prompts: [
        language === 'ar' ? 'كتابة قصة قصيرة' : 'Write a short story',
        language === 'ar' ? 'إنشاء قصيدة' : 'Create a poem',
        language === 'ar' ? 'صياغة نص إبداعي' : 'Draft creative content'
      ]
    }
  ];

  const handlePromptSelect = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-text', {
        body: { 
          prompt: prompt,
          language: language 
        }
      });

      if (error) throw error;

      const generatedText = data?.text || prompt;
      onTextGenerated(generatedText, 'compose', true);
      onOpenChange(false);
    } catch (error) {
      console.error('Text generation error:', error);
      onTextGenerated(prompt, 'compose', false);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-text', {
        body: { 
          prompt: customPrompt,
          language: language 
        }
      });

      if (error) throw error;

      const generatedText = data?.text || customPrompt;
      onTextGenerated(generatedText, 'compose', true);
      onOpenChange(false);
    } catch (error) {
      console.error('Text generation error:', error);
      onTextGenerated(customPrompt, 'compose', false);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
      setCustomPrompt('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg text-white">
              <Wand2 className="w-5 h-5" />
            </div>
            {language === 'ar' ? 'مولد النصوص الذكي' : 'Smart Text Generator'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Categories */}
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                className="h-auto p-4 flex-col gap-2"
                onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
              >
                <category.icon className="w-5 h-5" />
                <span className="text-sm">{category.name}</span>
              </Button>
            ))}
          </div>

          {/* Quick Prompts */}
          {selectedCategory && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">
                {language === 'ar' ? 'اقتراحات سريعة:' : 'Quick Suggestions:'}
              </h3>
              <div className="grid gap-2">
                {categories
                  .find(cat => cat.id === selectedCategory)
                  ?.prompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="justify-start text-left h-auto p-3"
                      onClick={() => handlePromptSelect(prompt)}
                      disabled={isGenerating}
                    >
                      {prompt}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">
              {language === 'ar' ? 'أو اكتب طلبك الخاص:' : 'Or write your custom request:'}
            </h3>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={language === 'ar' 
                ? 'اكتب ما تريد إنشاءه هنا...' 
                : 'Describe what you want to generate...'
              }
              className="w-full h-24 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button 
              onClick={handleCustomGenerate}
              disabled={!customPrompt.trim() || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
