
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/providers/ThemeProvider';
import { Copy, Download, ExternalLink, Calendar, Clock, MapPin, User, CheckCircle, XCircle, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { SimpleTaskRedirect } from './SimpleTaskRedirect';
import { cn } from '@/lib/utils';
import { ImageModal } from './ImageModal';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ChatBubbleProps {
  message: any;
  userProfile: any;
  activeTrigger: string;
}

export function ChatBubble({ message, userProfile, activeTrigger }: ChatBubbleProps) {
  const { language } = useTheme();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we're in return mode from Maw3D
  const isReturnMode = searchParams.get('return') === 'maw3d';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!');
  };

  const downloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-ai-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(language === 'ar' ? 'تم تحميل الصورة!' : 'Image downloaded!');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to download image');
    }
  };

  const useAsMaw3dBackground = (imageUrl: string) => {
    // Redirect to Maw3D create page with the image URL
    const params = new URLSearchParams({
      bg_image: imageUrl,
      bg_type: 'ai'
    });
    
    navigate(`/maw3d-create?${params.toString()}`);
    toast.success(language === 'ar' ? 'جاري تطبيق الخلفية...' : 'Applying background...');
  };

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const isUser = message.role === 'user';

  // Show copy button for AI messages in chat and search modes (not image mode)
  const shouldShowCopyButton = !isUser && message.content && activeTrigger !== 'image';

  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "flex max-w-[85%] gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          {isUser ? (
            userProfile?.avatar_url ? (
              <AvatarImage src={userProfile.avatar_url} alt="User" />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {userProfile?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            )
          ) : (
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
              AI
            </AvatarFallback>
          )}
        </Avatar>

        {/* Message Content */}
        <div className="flex flex-col space-y-1 min-w-0">
          {/* Message Bubble */}
          <div className={cn(
            "px-4 py-3 rounded-2xl shadow-sm relative",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}>
            {/* Image Content */}
            {message.imageUrl && (
              <div className="mb-3">
                <div 
                  className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setImageModalOpen(true)}
                >
                  <img 
                    src={message.imageUrl} 
                    alt="Generated content"
                    className="w-full max-w-sm rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {/* Image Action Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(message.imageUrl)}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'نسخ' : 'Copy'}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadImage(message.imageUrl)}
                    className="h-7 px-2 text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'تحميل' : 'Download'}
                  </Button>

                  {/* Maw3D Background Button - show when in image mode and we have return parameter */}
                  {activeTrigger === 'image' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => useAsMaw3dBackground(message.imageUrl)}
                      className="h-7 px-2 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300"
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      {language === 'ar' ? 'استخدم كخلفية' : 'Use as Maw3D BG'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Text Content */}
            {message.content && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
            )}

            {/* Intent and Confidence Badges */}
            {!isUser && (message.intent || message.confidence) && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/20">
                {message.intent && (
                  <Badge variant="secondary" className="text-xs">
                    {message.intent}
                  </Badge>
                )}
                {message.confidence && (
                  <Badge 
                    variant={message.confidence === 'high' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {message.confidence}
                  </Badge>
                )}
              </div>
            )}

            {/* Copy Button for AI messages in chat/search modes - positioned at bottom */}
            {shouldShowCopyButton && (
              <div className="flex justify-end mt-3 pt-2 border-t border-border/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(message.content)}
                  className="h-6 px-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {language === 'ar' ? 'نسخ' : 'Copy'}
                </Button>
              </div>
            )}
          </div>

          {/* Simple Task Redirect - Show for task-related intents */}
          {!isUser && (message.intent === 'task_preview' || message.intent === 'task_creation' || message.intent?.includes('task')) && (
            <SimpleTaskRedirect />
          )}

          {/* Timestamp */}
          <div className={cn(
            "text-xs text-muted-foreground px-1",
            isUser ? "text-right" : "text-left"
          )}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {message.imageUrl && (
        <ImageModal
          isOpen={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          imageUrl={message.imageUrl}
        />
      )}
    </div>
  );
}
