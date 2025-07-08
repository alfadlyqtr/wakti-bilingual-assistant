
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

  // ENHANCED: Speak message content with improved Arabic support
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
      
      // FIXED: Better Arabic detection and voice selection
      const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message.content);
      
      // Wait for voices to load
      const getVoices = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) {
          resolve(voices);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            resolve(window.speechSynthesis.getVoices());
          };
        }
      });

      const voices = await getVoices();
      
      if (isArabic) {
        // Find Arabic voice
        const arabicVoice = voices.find(voice => 
          voice.lang.startsWith('ar') || 
          voice.name.toLowerCase().includes('arabic') ||
          voice.name.toLowerCase().includes('عربي')
        );
        
        if (arabicVoice) {
          utterance.voice = arabicVoice;
        }
        utterance.lang = "ar-SA";
        utterance.rate = 0.8; // Slower for Arabic
      } else {
        // Find English voice
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('male'))
        );
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        utterance.lang = "en-US";
        utterance.rate = 0.9;
      }
      
      // Set voice properties
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Handle speech events
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        toast.error(language === 'ar' ? 'خطأ' : 'Error', {
          description: language === 'ar' ? 'فشل في قراءة الرسالة' : 'Failed to speak message',
        });
      };

      window.speechSynthesis.speak(utterance);
      
      toast.success(language === 'ar' ? 'جاري القراءة...' : 'Speaking...', {
        description: isArabic 
          ? 'يتم قراءة الرسالة بالعربية' 
          : 'Reading message aloud',
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
          {/* Message bubble with FIXED alignment */}
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

              {/* FIXED: Message content with proper alignment */}
              <div 
                className={`text-sm whitespace-pre-wrap ${isUser ? 'text-right' : 'text-left'}`}
                dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
              />

              {/* Image display - STANDARDIZED for both user and AI messages */}
              {Array.isArray(message.attachedFiles) && message.attachedFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-xs">
                  {message.attachedFiles.map((file: any, idx: number) =>
                    file.type && file.type.startsWith('image/') ? (
                      <img
                        key={idx}
                        src={file.preview || file.url || file.publicUrl}
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

              {/* RESTORED: Mini action buttons for ALL messages (user and AI) */}
              <div className="flex items-center gap-1 mt-2 pt-1 border-t border-border/30">
                {/* Mini Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-muted/60 transition-colors"
                  title={language === 'ar' ? 'نسخ' : 'Copy'}
                >
                  <Copy className={`w-3 h-3 ${isUser ? 'text-white/70 hover:text-white' : 'text-muted-foreground'}`} />
                </button>
                
                {/* RESTORED: Mini Speak Button for ALL messages */}
                <button
                  onClick={handleSpeak}
                  className={`p-1 rounded-md hover:bg-muted/60 transition-colors ${isSpeaking ? 'bg-primary/20' : ''}`}
                  title={language === 'ar' ? 'تحدث' : 'Speak'}
                >
                  <Speaker className={`w-3 h-3 ${
                    isSpeaking 
                      ? 'text-primary' 
                      : isUser 
                        ? 'text-white/70 hover:text-white' 
                        : 'text-muted-foreground'
                  }`} />
                </button>
              </div>

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
                    <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border-l-2 border-green-400">
                      <span className="text-green-600 dark:text-green-400">
                        🤔 {message.buddyChat.followUpQuestion}
                      </span>
                    </div>
                  )}

                  {/* Quick actions */}
                  {message.buddyChat.quickActions && message.buddyChat.quickActions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.buddyChat.quickActions.map((action: string, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => {
                            // Handle quick action click - could dispatch to parent component
                            console.log('Quick action clicked:', action);
                          }}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Related topics */}
                  {message.buddyChat.relatedTopics && message.buddyChat.relatedTopics.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {language === 'ar' ? 'مواضيع ذات صلة:' : 'Related topics:'} 
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.buddyChat.relatedTopics.map((topic: string, index: number) => (
                          <Link
                            key={index}
                            to={`/search?q=${encodeURIComponent(topic)}`}
                            className="text-primary hover:underline"
                          >
                            #{topic}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
