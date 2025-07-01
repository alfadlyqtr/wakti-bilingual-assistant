
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { User, Bot, Image as ImageIcon, Search, MessageSquare, Copy, Save, Expand, Speaker } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';
import { ImageModal } from './ImageModal';

interface ChatBubbleProps {
  message: any;
  userProfile?: any;
  activeTrigger?: string;
}

export function ChatBubble({ message, userProfile, activeTrigger }: ChatBubbleProps) {
  const { language } = useTheme();
  const isUser = message.role === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Format message content with enhanced buddy-chat features
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // Handle markdown-style links [text](url)
    let formattedContent = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-500 hover:text-blue-700 underline font-medium">$1</a>'
    );
    
    // Handle line breaks
    formattedContent = formattedContent.replace(/\n/g, '<br />');
    
    return formattedContent;
  };

  // Copy message content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!', {
        description: language === 'ar' ? 'تم نسخ الرسالة إلى الحافظة' : 'Message copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error(language === 'ar' ? 'خطأ' : 'Error', {
        description: language === 'ar' ? 'فشل في نسخ الرسالة' : 'Failed to copy message',
      });
    }
  };

  // Speak message content using browser's native TTS
  const handleSpeak = async () => {
    try {
      if (!message.content || !window.speechSynthesis) {
        toast.error(language === 'ar' ? 'خطأ' : 'Error', {
          description: language === 'ar' ? 'ميزة النطق غير متوفرة' : 'Speech synthesis not available',
        });
        return;
      }

      // Stop any currently speaking text
      window.speechSynthesis.cancel();

      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(message.content);
      
      // Detect Arabic text and set appropriate language
      const isArabic = /[\u0600-\u06FF]/.test(message.content);
      utterance.lang = isArabic ? "ar-SA" : "en-US";
      
      // Set voice properties
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      
      // Handle speech events
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error(language === 'ar' ? 'خطأ' : 'Error', {
          description: language === 'ar' ? 'فشل في قراءة الرسالة' : 'Failed to speak message',
        });
      };

      window.speechSynthesis.speak(utterance);
      
      toast.success(language === 'ar' ? 'جاري القراءة...' : 'Speaking...', {
        description: language === 'ar' ? 'يتم قراءة الرسالة' : 'Reading message aloud',
      });

    } catch (error) {
      console.error('Failed to speak message:', error);
      setIsSpeaking(false);
      toast.error(language === 'ar' ? 'خطأ' : 'Error', {
        description: language === 'ar' ? 'فشل في قراءة الرسالة' : 'Failed to speak message',
      });
    }
  };

  // Get mode indicator icon
  const getModeIcon = () => {
    switch (activeTrigger) {
      case 'search':
        return <Search className="w-3 h-3" />;
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'chat':
      default:
        return <MessageSquare className="w-3 h-3" />;
    }
  };

  // ------ GENERATED IMAGE ACTIONS ------
  const [showImageModal, setShowImageModal] = useState(false);

  // Save image to downloads
  const handleSaveImage = async () => {
    try {
      const response = await fetch(message.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wakti-generated-image-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(language === 'ar' ? 'تم حفظ الصورة' : 'Image saved!');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في حفظ الصورة' : 'Failed to save image');
    }
  };

  // Copy generated image URL
  const handleCopyImageUrl = async () => {
    try {
      await navigator.clipboard.writeText(message.imageUrl);
      toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Image URL copied!');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في نسخ الرابط' : 'Failed to copy image URL');
    }
  };

  // Expand image: just opens the image modal
  const handleExpandImage = () => {
    setShowImageModal(true);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
          }
        `}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Message bubble */}
          <Card className={`
            p-3 max-w-full
            ${isUser 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-card border-border'
            }
          `}>
            <div className="space-y-2">
              {/* Mode indicator for assistant messages */}
              {!isUser && activeTrigger && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  {getModeIcon()}
                  <span className="capitalize">
                    {activeTrigger === 'chat' 
                      ? (language === 'ar' ? 'محادثة' : 'Chat')
                      : activeTrigger === 'search'
                      ? (language === 'ar' ? 'بحث' : 'Search') 
                      : language === 'ar' ? 'صورة' : 'Image'
                    }
                  </span>
                </div>
              )}

              {/* Message content */}
              <div 
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
              />

              {/* Image display - Show images in user bubbles as well, immediate preview */}
              {Array.isArray(message.attachedFiles) && message.attachedFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-xs">
                  {message.attachedFiles.map((file: any, idx: number) =>
                    file.type && file.type.startsWith('image/') ? (
                      <img
                        key={idx}
                        src={file.preview || file.url}
                        alt={file.name || 'Uploaded image'}
                        className="rounded-lg border max-h-40 max-w-[140px] object-contain"
                        style={{ background: '#f6f6f8' }}
                      />
                    ) : null
                  )}
                </div>
              )}

              {/* Image display for assistant bubble (original logic) */}
              {message.imageUrl && (
                <div className="mt-2">
                  <img 
                    src={message.imageUrl} 
                    alt="Generated image" 
                    className="max-w-full h-auto rounded-lg border"
                    style={{ maxHeight: '300px' }}
                  />
                  {/* Mini action buttons for generated images */}
                  <div className="flex flex-row items-center gap-2 mt-2">
                    {/* Save Image */}
                    <button
                      aria-label={language === 'ar' ? 'حفظ' : 'Save image'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleSaveImage}
                      type="button"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    {/* Copy Image URL */}
                    <button
                      aria-label={language === 'ar' ? 'نسخ الرابط' : 'Copy image url'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleCopyImageUrl}
                      type="button"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {/* Expand/Zoom Image */}
                    <button
                      aria-label={language === 'ar' ? 'تكبير' : 'Expand image'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleExpandImage}
                      type="button"
                    >
                      <Expand className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Image Modal for Expand */}
                  <ImageModal
                    isOpen={showImageModal}
                    onClose={() => setShowImageModal(false)}
                    imageUrl={message.imageUrl}
                    prompt={message.content}
                  />
                </div>
              )}

              {/* Enhanced buddy-chat features */}
              {!isUser && message.buddyChat && (
                <div className="mt-3 space-y-2">
                  {/* Cross-mode suggestion */}
                  {message.buddyChat.crossModeSuggestion && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400">
                      <span className="text-blue-600 dark:text-blue-400">
                        💡 {language === 'ar' 
                          ? 'اقتراح: جرب وضع'
                          : 'Suggestion: Try'
                        } {message.buddyChat.crossModeSuggestion} {language === 'ar' ? 'للحصول على نتائج أفضل' : 'mode for better results'}
                      </span>
                    </div>
                  )}

                  {/* Follow-up question */}
                  {message.buddyChat.followUpQuestion && (
                    <div className="text-xs text-muted-foreground italic">
                      {message.buddyChat.followUpQuestion}
                    </div>
                  )}

                  {/* Search follow-up */}
                  {message.buddyChat.searchFollowUp && (
                    <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded">
                      <span className="text-green-600 dark:text-green-400">
                        🔍 {language === 'ar' 
                          ? 'هل تريد المزيد من المعلومات حول هذا الموضوع؟'
                          : 'Want to dive deeper into this topic?'
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Browsing indicator */}
              {message.browsingUsed && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Search className="w-3 h-3" />
                  <span>
                    {language === 'ar' ? 'تم البحث في الويب' : 'Web search used'}
                  </span>
                </div>
              )}

              {/* Action taken indicator */}
              {message.actionTaken && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
                  <span>✅</span>
                  <span>
                    {language === 'ar' ? 'تم تنفيذ إجراء' : 'Action completed'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Action buttons for AI messages - INCREASED MARGIN */}
          {!isUser && (
            <div className="flex items-center gap-1 mt-3">
              {/* Copy button */}
              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3 mr-1" />
                {language === 'ar' ? 'نسخ' : 'Copy'}
              </Button>

              {/* Speak button */}
              <Button
                onClick={handleSpeak}
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-xs transition-colors ${
                  isSpeaking 
                    ? 'text-blue-600 hover:text-blue-700' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={language === 'ar' ? 'قراءة الرسالة' : 'Speak message'}
              >
                <Speaker className={`w-3 h-3 mr-1 ${isSpeaking ? 'animate-pulse' : ''}`} />
                {language === 'ar' ? 'استمع' : 'Speak'}
              </Button>
            </div>
          )}

          {/* Message timestamp */}
          <div className="text-xs text-muted-foreground mt-1 px-1">
            {message.timestamp && new Date(message.timestamp).toLocaleTimeString(
              language === 'ar' ? 'ar-SA' : 'en-US',
              { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: language !== 'ar'
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
