
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Mic, Search, MessageSquare, Expand, Download, Copy, PenTool, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { BrowsingIndicator } from './BrowsingIndicator';
import { SearchResultActions } from './SearchResultActions';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { toast } from 'sonner';

interface ChatBubbleProps {
  message: AIMessage;
  onSearchConfirm?: (messageContent: string) => void;
  onSwitchToChat?: () => void;
  activeTrigger?: string;
  isTextGenerated?: boolean;
}

export function ChatBubble({ message, onSearchConfirm, onSwitchToChat, activeTrigger, isTextGenerated }: ChatBubbleProps) {
  const { theme, language } = useTheme();
  const isUser = message.role === 'user';
  const isArabic = language === 'ar';

  // Check if this message requires search confirmation (80% quota reached)
  const showSearchButton = !isUser && 
    message.quotaStatus?.usagePercentage >= 80 && 
    message.quotaStatus?.usagePercentage < 100 && 
    !message.browsingUsed &&
    onSearchConfirm;

  // Show chat mode switch button if we're in search mode and user sent a general chat message
  const showChatModeSwitch = !isUser && 
    activeTrigger === 'search' && 
    message.content.includes('⚠️') && 
    onSwitchToChat;

  // Check if we should show search-related features - NOW INCLUDES both search and advanced_search
  const isSearchResult = !isUser && 
    (activeTrigger === 'search' || activeTrigger === 'advanced_search') && 
    (message.browsingUsed || message.quotaStatus);

  const handleSearchConfirm = () => {
    if (onSearchConfirm) {
      onSearchConfirm(message.content);
    }
  };

  const handleSwitchToChat = () => {
    if (onSwitchToChat) {
      onSwitchToChat();
    }
  };

  const handleExpandImage = () => {
    if (message.imageUrl) {
      window.open(message.imageUrl, '_blank');
    }
  };

  const handleDownloadImage = async () => {
    if (message.imageUrl) {
      try {
        const response = await fetch(message.imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `wakti-generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading image:', error);
      }
    }
  };

  const handleCopyTextGenerated = async () => {
    console.log('📋 Copy text generated button clicked');
    
    try {
      // Enhanced copy function with multiple fallbacks
      await copyToClipboard(message.content);
      
      toast.success(language === 'ar' ? 'تم نسخ النص المولد' : 'Generated text copied');
    } catch (error) {
      console.error('❌ Error copying text generated:', error);
      toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };

  // Enhanced copy function with multiple fallback methods
  const copyToClipboard = async (text: string) => {
    console.log('📋 Attempting to copy text:', text.substring(0, 50) + '...');
    
    // Method 1: Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        console.log('✅ Successfully copied using Clipboard API');
        return;
      } catch (error) {
        console.warn('⚠️ Clipboard API failed, trying fallback:', error);
      }
    }
    
    // Method 2: execCommand fallback
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('contenteditable', 'true');
      
      document.body.appendChild(textArea);
      
      // For mobile compatibility
      if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
        textArea.contentEditable = 'true';
        textArea.readOnly = false;
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        textArea.setSelectionRange(0, text.length);
      } else {
        textArea.select();
        textArea.setSelectionRange(0, text.length);
      }
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        console.log('✅ Successfully copied using execCommand');
        return;
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (error) {
      console.warn('⚠️ execCommand method failed:', error);
    }
    
    // Method 3: Manual selection prompt
    throw new Error('All copy methods failed. Please select and copy manually.');
  };

  const handleCopyMessage = async () => {
    console.log('📋 Copy message button clicked');
    
    try {
      await copyToClipboard(message.content);
      
      toast.success(language === 'ar' ? 'تم نسخ الرسالة' : 'Message copied');
      
    } catch (error) {
      console.error('❌ Error copying message:', error);
      
      toast.error(
        language === 'ar' 
          ? 'تعذر نسخ النص. يرجى تحديد النص ونسخه يدوياً' 
          : 'Unable to copy text. Please select and copy manually'
      );
    }
  };

  const handleExportPDF = async () => {
    try {
      const { generatePDF } = await import('@/utils/pdfUtils');
      
      const pdfOptions = {
        title: language === 'ar' ? 'نتيجة البحث' : 'Search Result',
        content: {
          text: message.content
        },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          type: activeTrigger === 'advanced_search' 
            ? (language === 'ar' ? 'بحث متقدم' : 'Advanced Search')
            : (language === 'ar' ? 'بحث أساسي' : 'Basic Search'),
          host: 'WAKTI AI'
        },
        language: language as 'en' | 'ar'
      };

      const pdfBlob = await generatePDF(pdfOptions);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `wakti-search-result-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(language === 'ar' ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error(language === 'ar' ? 'فشل في تصدير PDF' : 'Failed to export PDF');
    }
  };

  return (
    <div className={cn(
      "flex gap-3 max-w-4xl",
      isUser ? (isArabic ? "justify-start" : "justify-end") : "justify-start"
    )}>
      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "max-w-[80%]" : "max-w-[85%]"
      )}>
        {/* Message Bubble */}
        <div className={cn(
          "relative px-4 py-3 rounded-2xl shadow-sm",
          isUser 
            ? "bg-primary text-primary-foreground ml-auto" 
            : "bg-muted/50 text-foreground border",
          isUser 
            ? (isArabic ? "rounded-br-md" : "rounded-bl-md")
            : "rounded-bl-md"
        )}>
          {/* Voice Input Indicator */}
          {message.inputType === 'voice' && isUser && (
            <div className="flex items-center gap-1 mb-2 text-xs opacity-70">
              <Mic className="h-3 w-3" />
              <span>{language === 'ar' ? 'رسالة صوتية' : 'Voice message'}</span>
            </div>
          )}

          {/* Message Text */}
          <div className={cn(
            "whitespace-pre-wrap break-words",
            isArabic ? "text-right" : "text-left"
          )}>
            {message.content}
          </div>

          {/* Intent Badge */}
          {message.intent && !isUser && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                {message.intent}
              </span>
              {message.confidence && (
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  message.confidence === 'high' ? "bg-green-100 text-green-700" :
                  message.confidence === 'medium' ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                )}>
                  {message.confidence}
                </span>
              )}
            </div>
          )}

          {/* Generated Image with Controls */}
          {message.imageUrl && (
            <div className="mt-3 relative group">
              <img
                src={message.imageUrl}
                alt="Generated content"
                className="max-w-full rounded-lg border shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Image Controls - Show on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExpandImage}
                  className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white border-0"
                  title={language === 'ar' ? 'توسيع الصورة' : 'Expand image'}
                >
                  <Expand className="h-3 w-3" />
                </Button>
                
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadImage}
                  className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white border-0"
                  title={language === 'ar' ? 'تحميل الصورة' : 'Download image'}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {(showSearchButton || showChatModeSwitch) && (
            <div className="mt-3 pt-2 border-t border-border/30 flex gap-2">
              {/* Mini Search Button - Only shown when 80% quota reached */}
              {showSearchButton && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSearchConfirm}
                  className="flex items-center gap-2 text-xs h-8 px-3"
                >
                  <Search className="h-3 w-3" />
                  {language === 'ar' ? 'البحث للحصول على معلومات حديثة؟' : 'Search for current info?'}
                </Button>
              )}

              {/* Chat Mode Switch Button */}
              {showChatModeSwitch && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSwitchToChat}
                  className="flex items-center gap-2 text-xs h-8 px-3 bg-blue-500 hover:bg-blue-600"
                >
                  <MessageSquare className="h-3 w-3" />
                  {language === 'ar' ? 'التبديل إلى وضع المحادثة' : 'Switch to Chat Mode'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Browsing Indicator - Show for both search and advanced_search */}
        {isSearchResult && (
          <div className={cn(
            "ml-2",
            isUser && "mr-2"
          )}>
            <BrowsingIndicator
              browsingUsed={message.browsingUsed}
              quotaStatus={message.quotaStatus ? {
                ...message.quotaStatus,
                remaining: message.quotaStatus.limit - message.quotaStatus.count
              } : undefined}
              sources={message.browsingData?.sources}
              imageUrl={message.imageUrl}
              size="sm"
            />
          </div>
        )}

        {/* Mode-specific Copy and Export Actions - Outside the bubble */}
        {!isUser && (
          <div className={cn(
            "flex items-center gap-2 ml-2",
            isUser && "mr-2"
          )}>
            {/* Chat Mode - Simple Copy */}
            {activeTrigger === 'chat' && !isTextGenerated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyMessage}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-all duration-200"
                title={language === 'ar' ? 'نسخ الرسالة' : 'Copy message'}
              >
                <Copy className="h-3 w-3 mr-1" />
                {language === 'ar' ? 'نسخ' : 'Copy'}
              </Button>
            )}

            {/* Search Mode - Copy Only */}
            {activeTrigger === 'search' && message.browsingUsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyMessage}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-all duration-200"
                title={language === 'ar' ? 'نسخ نتيجة البحث' : 'Copy search result'}
              >
                <Copy className="h-3 w-3 mr-1" />
                {language === 'ar' ? 'نسخ' : 'Copy'}
              </Button>
            )}

            {/* Advanced Search Mode - Copy and Export PDF */}
            {activeTrigger === 'advanced_search' && message.browsingUsed && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-all duration-200"
                  title={language === 'ar' ? 'نسخ نتيجة البحث المتقدم' : 'Copy advanced search result'}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {language === 'ar' ? 'نسخ' : 'Copy'}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportPDF}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-all duration-200"
                  title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {language === 'ar' ? 'PDF' : 'PDF'}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Enhanced Text Generation Indicator and Copy Button */}
        {isTextGenerated && !isUser && (
          <div className={cn(
            "flex items-center justify-between ml-2",
            isUser && "mr-2"
          )}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <PenTool className="h-3 w-3" />
                <span>{language === 'ar' ? 'WAKTI AI نص مولد' : 'WAKTI AI Text Gen.'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(message.timestamp, 'HH:mm')}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTextGenerated}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all duration-200 hover:scale-110"
              title={language === 'ar' ? 'نسخ النص المولد' : 'Copy generated text'}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Regular Timestamp - Only show if not text generated */}
        {!isTextGenerated && (
          <div className={cn(
            "text-xs text-muted-foreground px-2",
            isUser ? (isArabic ? "text-left" : "text-right") : "text-left"
          )}>
            {format(message.timestamp, 'HH:mm')}
          </div>
        )}
      </div>
    </div>
  );
}
