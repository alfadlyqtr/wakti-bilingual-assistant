import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { Check, Clock, Bot, User as UserIcon, Search, Globe, CheckCircle2, TrendingUp, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrowsingIndicator } from './BrowsingIndicator';
import { SearchResultActions } from './SearchResultActions';

// Updated trigger types with stylized art
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling' | 'stylized';

interface ChatBubbleProps {
  message: AIMessage;
  onSearchConfirm?: (messageContent: string) => void;
  activeTrigger?: TriggerMode;
  imageMode?: ImageMode;
}

export function ChatBubble({ message, onSearchConfirm, activeTrigger, imageMode }: ChatBubbleProps) {
  const { language } = useTheme();
  
  const isUser = message.role === 'user';
  const showSearchConfirmation = message.requiresSearchConfirmation && onSearchConfirm;
  
  // Determine if this is a PhotoMaker related message
  const isPhotoMakerMessage = message.imageUrl && activeTrigger === 'image' && imageMode === 'photomaker';
  
  // Determine if this is an Image Upscaling related message
  const isUpscalingMessage = message.imageUrl && activeTrigger === 'image' && imageMode === 'upscaling';

  // Determine if this is a Stylized Art related message
  const isStylizedMessage = message.imageUrl && activeTrigger === 'image' && imageMode === 'stylized';

  return (
    <div className={cn(
      "flex gap-3 max-w-4xl",
      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium",
        isUser 
          ? "bg-blue-500" 
          : "bg-gradient-to-br from-purple-500 to-blue-600"
      )}>
        {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "text-right" : "text-left"
      )}>
        {/* Message Bubble */}
        <div className={cn(
          "inline-block max-w-full px-4 py-3 rounded-2xl shadow-sm",
          isUser
            ? "bg-blue-500 text-white rounded-br-md"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md"
        )}>
          {/* Message Text */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {/* Image Display for PhotoMaker */}
          {isPhotoMakerMessage && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <img 
                src={message.imageUrl} 
                alt="Generated personal image"
                className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'ar' ? 'صورة شخصية مولدة بالذكاء الاصطناعي' : 'AI-generated personal image'}
              </p>
            </div>
          )}

          {/* Image Display for Upscaling */}
          {isUpscalingMessage && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <img 
                src={message.imageUrl} 
                alt="Upscaled image"
                className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'ar' ? 'صورة محسنة الجودة بالذكاء الاصطناعي' : 'AI-enhanced quality image'}
              </p>
            </div>
          )}

          {/* Image Display for Stylized Art */}
          {isStylizedMessage && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <img 
                src={message.imageUrl} 
                alt="Stylized art image"
                className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'ar' ? 'فن مخصص مولد بالذكاء الاصطناعي' : 'AI-generated stylized art'}
              </p>
            </div>
          )}

          {/* Regular Image Display */}
          {message.imageUrl && !isPhotoMakerMessage && !isUpscalingMessage && !isStylizedMessage && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <img 
                src={message.imageUrl} 
                alt="Generated image"
                className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'ar' ? 'صورة مولدة بالذكاء الاصطناعي' : 'AI-generated image'}
              </p>
            </div>
          )}

          {/* Search Confirmation */}
          {showSearchConfirmation && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {language === 'ar' ? 'هل تريد البحث عن معلومات حديثة؟' : 'Would you like me to search for current information?'}
              </p>
              <Button
                size="sm"
                onClick={() => onSearchConfirm(message.content)}
                className="h-7 px-3 text-xs"
              >
                <Search className="w-3 h-3 mr-1" />
                {language === 'ar' ? 'نعم، ابحث' : 'Yes, search'}
              </Button>
            </div>
          )}
        </div>

        {/* Message Metadata */}
        <div className={cn(
          "flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400",
          isUser ? "justify-end" : "justify-start"
        )}>
          {/* Timestamp */}
          <span>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>

          {/* Message Status for User Messages */}
          {isUser && (
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3" />
            </div>
          )}

          {/* AI Metadata for Assistant Messages */}
          {!isUser && (
            <div className="flex items-center gap-2">
              {/* Intent Badge */}
              {message.intent && (
                <Badge variant="secondary" className="text-xs py-0 px-1">
                  {message.intent}
                </Badge>
              )}

              {/* Browsing Indicator */}
              {message.browsingUsed && (
                <BrowsingIndicator />
              )}

              {/* PhotoMaker Indicator */}
              {isPhotoMakerMessage && (
                <Badge variant="outline" className="text-xs py-0 px-1 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                  <UserIcon className="w-3 h-3 mr-1" />
                  {language === 'ar' ? 'صانع الصور الشخصية' : 'PhotoMaker'}
                </Badge>
              )}

              {/* Image Upscaling Indicator */}
              {isUpscalingMessage && (
                <Badge variant="outline" className="text-xs py-0 px-1 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {language === 'ar' ? 'تحسين الصور' : 'Image Upscaled'}
                </Badge>
              )}

              {/* Stylized Art Indicator */}
              {isStylizedMessage && (
                <Badge variant="outline" className="text-xs py-0 px-1 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                  <Palette className="w-3 h-3 mr-1" />
                  {language === 'ar' ? 'فن مخصص' : 'Stylized Art'}
                </Badge>
              )}

              {/* Image Generation Indicator */}
              {message.imageUrl && !isPhotoMakerMessage && !isUpscalingMessage && !isStylizedMessage && (
                <Badge variant="outline" className="text-xs py-0 px-1">
                  {language === 'ar' ? 'صورة' : 'Image'}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Search Results Actions */}
        {message.browsingData?.sources && (
          <SearchResultActions 
            content={message.content}
            sources={message.browsingData.sources}
            query={message.browsingData.query}
          />
        )}

        {/* Quota Status */}
        {message.quotaStatus && (
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>
              {language === 'ar' ? 'استخدام البحث:' : 'Search usage:'} {message.quotaStatus.count}/{message.quotaStatus.limit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
