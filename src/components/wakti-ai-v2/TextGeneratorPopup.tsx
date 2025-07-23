
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Copy, Wand2, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TextGeneratorPopupProps {
  onClose: () => void;
  onInsertText: (text: string) => void;
}

const contentTypes = [
  'email', 'letter', 'essay', 'article', 'report', 'summary', 'story', 'poem', 'script', 'speech',
  'social_media', 'blog_post', 'product_description', 'review', 'announcement', 'invitation'
];

const toneOptions = [
  'professional', 'casual', 'formal', 'friendly', 'persuasive', 'informative', 'creative', 'humorous',
  'serious', 'optimistic', 'neutral', 'academic', 'conversational'
];

const lengthOptions = [
  { value: 'short', label: 'Short (1-2 paragraphs)' },
  { value: 'medium', label: 'Medium (3-4 paragraphs)' },
  { value: 'long', label: 'Long (5+ paragraphs)' },
  { value: 'custom', label: 'Custom word count' }
];

export function TextGeneratorPopup({ onClose, onInsertText }: TextGeneratorPopupProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  
  // Form state
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [contentType, setContentType] = useState('');
  const [tone, setTone] = useState('');
  const [length, setLength] = useState('');
  const [customWordCount, setCustomWordCount] = useState('');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!topic.trim()) {
      setError('Topic or Idea is required');
      return false;
    }
    if (!contentType) {
      setError('Content Type is required');
      return false;
    }
    if (!tone) {
      setError('Tone is required');
      return false;
    }
    if (!length) {
      setError('Length is required');
      return false;
    }
    if (length === 'custom' && !customWordCount) {
      setError('Custom word count is required');
      return false;
    }
    return true;
  };

  const buildPrompt = () => {
    let prompt = `Generate a ${contentType} with the following specifications:

TOPIC/IDEA: ${topic}

TONE: ${tone}

LENGTH: ${length === 'custom' ? `approximately ${customWordCount} words` : length}

CONTENT TYPE: ${contentType}`;

    if (keyPoints.trim()) {
      prompt += `\n\nKEY POINTS TO INCLUDE:\n${keyPoints}`;
    }

    if (originalMessage.trim()) {
      prompt += `\n\nORIGINAL MESSAGE TO REPLY TO:\n${originalMessage}`;
    }

    prompt += `\n\nIMPORTANT REQUIREMENTS:
- Strictly follow the specified tone: ${tone}
- Ensure content matches the ${contentType} format
- Avoid marketing buzzwords and clichés
- Write naturally and authentically
- Respect the specified length: ${length === 'custom' ? `${customWordCount} words` : length}
- Stay focused on the topic: ${topic}`;

    if (keyPoints.trim()) {
      prompt += `\n- Address all key points mentioned: ${keyPoints}`;
    }

    if (originalMessage.trim()) {
      prompt += `\n- This is a reply to: ${originalMessage}`;
    }

    return prompt;
  };

  const generateText = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setError('');

    try {
      const prompt = buildPrompt();
      console.log('🔄 Generating text with prompt:', prompt);

      const { data, error } = await supabase.functions.invoke('text-generator', {
        body: { 
          prompt,
          user_id: user?.id 
        }
      });

      if (error) {
        console.error('❌ Text generation error:', error);
        throw error;
      }

      if (data?.text) {
        console.log('✅ Text generated successfully');
        setGeneratedText(data.text);
        toast.success('Text generated successfully!');
      } else {
        throw new Error('No text generated');
      }

    } catch (error) {
      console.error('❌ Text generation failed:', error);
      setError('Failed to generate text. Please try again.');
      toast.error('Failed to generate text');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      toast.success('Text copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy text');
    }
  };

  const insertText = () => {
    onInsertText(generatedText);
    onClose();
  };

  const resetForm = () => {
    setTopic('');
    setKeyPoints('');
    setOriginalMessage('');
    setContentType('');
    setTone('');
    setLength('');
    setCustomWordCount('');
    setGeneratedText('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Smart Text Generator
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Panel - Input Form */}
          <div className="w-1/2 p-6 border-r border-border overflow-y-auto">
            <div className="space-y-6">
              {/* Topic/Idea - Required */}
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-sm font-medium">
                  Topic or Idea *
                </Label>
                <Input
                  id="topic"
                  placeholder="Enter your main topic or idea..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Key Points */}
              <div className="space-y-2">
                <Label htmlFor="keyPoints" className="text-sm font-medium">
                  Key Points or Keywords
                </Label>
                <Textarea
                  id="keyPoints"
                  placeholder="Enter key points you want to include..."
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>

              {/* Original Message */}
              <div className="space-y-2">
                <Label htmlFor="originalMessage" className="text-sm font-medium">
                  Original Message (if replying)
                </Label>
                <Textarea
                  id="originalMessage"
                  placeholder="Paste the original message you're replying to..."
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>

              {/* Content Type - Required */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Content Type *</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tone - Required */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tone *</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Length - Required */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Length *</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    {lengthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Word Count */}
              {length === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customWordCount" className="text-sm font-medium">
                    Word Count *
                  </Label>
                  <Input
                    id="customWordCount"
                    type="number"
                    placeholder="Enter desired word count"
                    value={customWordCount}
                    onChange={(e) => setCustomWordCount(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={generateText}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel - Generated Text */}
          <div className="w-1/2 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generated Text</h3>
              {generatedText && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button size="sm" onClick={insertText}>
                    Insert
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 border border-border rounded-lg p-4 overflow-y-auto">
              {generatedText ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {generatedText}
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-8">
                  Fill in the form and click "Generate" to create your text
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
