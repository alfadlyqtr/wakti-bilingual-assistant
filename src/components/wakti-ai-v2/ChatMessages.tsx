
import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Bot, User, Calendar, Clock, CheckCircle, Loader2, Volume2, Copy, VolumeX, ExternalLink } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { Badge } from '@/components/ui/badge';
import { ImageModal } from './ImageModal';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  userProfile: any;
  personalTouch: any;
  showTaskConfirmation: boolean;
  pendingTaskData: any;
  pendingReminderData: any;
  taskConfirmationLoading: boolean;
  onTaskConfirmation: (taskData: any) => void;
  onReminderConfirmation: (reminderData: any) => void;
  onCancelTaskConfirmation: () => void;
  conversationId: string | null;
  isNewConversation: boolean;
  onUpdateMessage?: (messageId: string, content: string) => void;
}

export function ChatMessages({
  sessionMessages,
  isLoading,
  activeTrigger,
  scrollAreaRef,
  userProfile,
  personalTouch,
  showTaskConfirmation,
  pendingTaskData,
  pendingReminderData,
  taskConfirmationLoading,
  onTaskConfirmation,
  onReminderConfirmation,
  onCancelTaskConfirmation,
  conversationId,
  isNewConversation,
  onUpdateMessage
}: ChatMessagesProps) {
  const { language } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; prompt?: string } | null>(null);

  // ENHANCED: Real-time video updates subscription with better error handling
  useEffect(() => {
    if (!userProfile?.id) return;

    console.log('🎬 CHAT: Setting up video updates subscription for user:', userProfile.id);

    const channel = supabase
      .channel('video-updates-' + userProfile.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_generation_tasks',
          filter: `user_id=eq.${userProfile.id}`
        },
        (payload) => {
          console.log('🎬 CHAT: Video update received:', payload);
          
          const { new: newRecord } = payload;
          
          if (newRecord.status === 'completed' && newRecord.video_url) {
            console.log('🎬 CHAT: Video completed, URL:', newRecord.video_url);
            
            // Create video content with proper HTML5 video tag
            const videoContent = `🎬 **Video generation completed!**\n\nYour video is ready:\n\n<video controls width="400" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">\n<source src="${newRecord.video_url}" type="video/mp4">\nYour browser does not support the video tag.\n</video>\n\n✨ Template: ${newRecord.template}\n⏱️ Duration: ${newRecord.duration}s\n📐 Resolution: ${newRecord.resolution}`;
            
            // Dispatch custom event for message update
            window.dispatchEvent(new CustomEvent('updateVideoMessage', {
              detail: {
                taskId: newRecord.task_id,
                videoUrl: newRecord.video_url,
                status: newRecord.status,
                content: videoContent,
                template: newRecord.template
              }
            }));
            
          } else if (newRecord.status === 'failed') {
            console.log('🎬 CHAT: Video generation failed');
            
            const errorContent = `❌ **Video generation failed**\n\nSorry, there was an issue generating your video. Please try again with different images or template.\n\n🔄 You can try:\n• Different image angles or lighting\n• Another template style\n• Reducing image file sizes`;
            
            window.dispatchEvent(new CustomEvent('updateVideoMessage', {
              detail: {
                taskId: newRecord.task_id,
                status: newRecord.status,
                error: 'Video generation failed',
                content: errorContent
              }
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('🎬 CHAT: Subscription status:', status);
      });

    return () => {
      console.log('🎬 CHAT: Cleaning up video updates subscription');
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id]);

  // Handle video update events
  useEffect(() => {
    const handleVideoUpdate = (event: CustomEvent) => {
      console.log('🎬 CHAT UPDATE: Received video update event', event.detail);
      
      const { taskId, videoUrl, status, error, content, template } = event.detail;
      
      // Find messages that mention video generation and update them
      if (onUpdateMessage) {
        // Look for recent video generation messages
        const recentVideoMessage = sessionMessages
          .slice()
          .reverse()
          .find(msg => 
            msg.content?.includes('Video generation started') || 
            msg.content?.includes('🎬') ||
            msg.intent === 'video'
          );
        
        if (recentVideoMessage) {
          console.log('🎬 CHAT UPDATE: Updating message', recentVideoMessage.id);
          onUpdateMessage(recentVideoMessage.id, content);
        }
      }
    };
    
    // Listen for video update events
    window.addEventListener('updateVideoMessage', handleVideoUpdate as EventListener);
    
    // Cleanup listener
    return () => {
      window.removeEventListener('updateVideoMessage', handleVideoUpdate as EventListener);
    };
  }, [sessionMessages, onUpdateMessage]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // Native TTS function with stop functionality
  const handleSpeak = (text: string, messageId: string) => {
    // If currently speaking this message, stop it
    if (speakingMessageId === messageId) {
      speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    
    // Stop any currently playing speech
    speechSynthesis.cancel();
    setSpeakingMessageId(messageId);
    
    // Create utterance with native TTS
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure for native device voices
    utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    utterance.rate = 0.9;        // Natural speech rate
    utterance.pitch = 1.0;       // Natural pitch
    utterance.volume = 1.0;      // Full volume
    
    // Use device's default voice for the language
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith(language === 'ar' ? 'ar' : 'en') && voice.localService
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    // Handle speech end
    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };
    
    // Speak using native device TTS
    speechSynthesis.speak(utterance);
  };

  // FIXED: Show welcome message for new conversations
  const renderWelcomeMessage = () => {
    if (!isNewConversation || sessionMessages.length > 0) return null;

    const userName = personalTouch?.nickname || userProfile?.display_name || (language === 'ar' ? 'صديقي' : 'friend');
    
    return (
      <div className="flex justify-start mb-6 group">
        <div className="flex gap-3 max-w-[80%]">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border relative">
            {/* Mode Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                💬 Welcome
              </Badge>
            </div>
            
            <div className="text-sm leading-relaxed">
              {language === 'ar' 
                ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🎬 **إنشاء الفيديوهات** - ارفع صورك وسأحولها لفيديوهات مذهلة\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🎬 **Generate Videos** - Upload your photos and I'll turn them into amazing videos\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
              }
            </div>
            
            {/* Mini Buttons - Always Visible */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                {/* Copy Button */}
                <button
                  onClick={() => navigator.clipboard.writeText(language === 'ar' 
                    ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🎬 **إنشاء الفيديوهات** - ارفع صورك وسأحولها لفيديوهات مذهلة\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                    : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🎬 **Generate Videos** - Upload your photos and I'll turn them into amazing videos\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
                  )}
                  className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                >
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
                
                {/* Native TTS Button */}
                <button
                  onClick={() => handleSpeak(language === 'ar' 
                    ? `مرحباً ${userName}! أنا WAKTI AI، مساعدك الذكي المطور. يمكنني إنشاء المهام والتذكيرات، تحليل الصور، إنشاء الفيديوهات، البحث والاستكشاف، والمحادثة الذكية. ما الذي يمكنني مساعدتك به اليوم؟`
                    : `Hello ${userName}! I'm WAKTI AI, your advanced AI assistant. I can help you create tasks and reminders, analyze images, generate videos, search and explore topics, and have smart conversations. What can I help you with today?`, 'welcome'
                  )}
                  className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'قراءة بالصوت الطبيعي للجهاز' : 'Read with native device voice'}
                >
                  {speakingMessageId === 'welcome' ? (
                    <VolumeX className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  ) : (
                    <Volume2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // FIXED: Determine badge based on message content and activeTrigger
  const getMessageBadge = (message: AIMessage, currentActiveTrigger: string) => {
    // For user messages, use the current active trigger or detect from content
    if (message.role === 'user') {
      // Check for explicit image generation keywords
      const content = message.content.toLowerCase();
      if (content.includes('generate image') || content.includes('create image') || content.includes('make image') || content.includes('draw') || content.includes('paint')) {
        return '🎨 Image';
      }
      
      // Check for video generation keywords
      if (content.includes('generate video') || content.includes('create video') || content.includes('make video')) {
        return '🎬 Video';
      }
      
      // Check for explicit search keywords
      if (content.includes('search for') || content.includes('find information') || content.includes('look up') || content.includes('what is')) {
        return '🔍 Search';
      }
      
      // Check for vision (if has attached files)
      if (message.attachedFiles && message.attachedFiles.length > 0) {
        return '👁️ Vision';
      }
      
      // Check for voice input
      if (message.inputType === 'voice') {
        return '🎤 Voice';
      }
      
      // Use current active trigger as fallback
      if (currentActiveTrigger === 'image') return '🎨 Image';
      if (currentActiveTrigger === 'search') return '🔍 Search';
      if (currentActiveTrigger === 'vision') return '👁️ Vision';
      if (currentActiveTrigger === 'video') return '🎬 Video';
      
      return '💬 Chat';
    }
    
    // For assistant messages, use the saved intent or detect from content
    if (message.intent === 'vision') return '👁️ Vision';
    if (message.intent === 'search') return '🔍 Search';
    if (message.intent === 'image') return '🎨 Image';
    if (message.intent === 'video') return '🎬 Video';
    if (message.intent === 'parse_task') return '🎯 Task';
    
    // Detect from content for assistant messages
    const content = message.content.toLowerCase();
    if (content.includes('image generated') || content.includes('here is the image') || message.imageUrl) {
      return '🎨 Image';
    }
    if (content.includes('video generat') || content.includes('🎬') || content.includes('<video')) {
      return '🎬 Video';
    }
    if (content.includes('search results') || content.includes('found the following')) {
      return '🔍 Search';
    }
    if (content.includes('analyzing the image') || content.includes('i can see')) {
      return '👁️ Vision';
    }
    
    return '💬 Chat';
  };

  // ENHANCED: Function to render message content with proper video display
  const renderMessageContent = (message: AIMessage) => {
    const content = message.content;
    
    // Check if content contains HTML (video tags, styling, etc.)
    if (content.includes('<video') || content.includes('<div style') || content.includes('<style>')) {
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: content }}
          className="prose prose-sm max-w-none video-container"
          style={{
            '& video': {
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              maxWidth: '100%',
              height: 'auto'
            }
          }}
        />
      );
    }
    
    // FIXED: Check for generated images (Runware URLs) with modal functionality
    if (message.imageUrl || content.includes('https://im.runware.ai/')) {
      const imageUrl = message.imageUrl || content.match(/https:\/\/im\.runware\.ai\/[^\s\)]+/)?.[0];
      
      if (imageUrl) {
        // Extract prompt from content if available
        const promptMatch = content.match(/prompt:\s*(.+?)(?:\n|$)/i);
        const prompt = promptMatch ? promptMatch[1].trim() : undefined;
        
        return (
          <div className="space-y-3">
            {/* Show text content if any (excluding the URL) */}
            {content && !content.includes(imageUrl) && (
              <div className="whitespace-pre-wrap">
                {content.replace(imageUrl, '').trim()}
              </div>
            )}
            
            {/* Display the actual image with click handler for modal */}
            <div className="relative">
              <img
                src={imageUrl}
                alt="Generated image"
                className="max-w-full h-auto rounded-lg border border-border/50 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImage({ url: imageUrl, prompt })}
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Copy URL button overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(imageUrl);
                  // Could add a toast here if needed
                }}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-md transition-colors"
                title={language === 'ar' ? 'نسخ رابط الصورة' : 'Copy image URL'}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      }
    }
    
    // Regular text content with markdown-style formatting
    return (
      <div className="whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          {renderWelcomeMessage()}
          
          {/* Chat Messages with FIXED badge logic and enhanced video display */}
          {sessionMessages.map((message, index) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 group`}>
              <div className="flex gap-3 max-w-[80%]">
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                
                <div className={`rounded-lg px-4 py-3 relative ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border'
                }`}>
                  {/* FIXED: Mode Badge with proper logic */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                      {getMessageBadge(message, activeTrigger)}
                    </Badge>
                  </div>
                  
                  <div className="text-sm leading-relaxed">
                    {renderMessageContent(message)}
                  </div>
                  
                  {/* Image Preview in Chat Messages */}
                  {message.attachedFiles && message.attachedFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachedFiles.map((file, fileIndex) => (
                        <div key={fileIndex} className="relative">
                          <img
                            src={file.url.startsWith('data:') ? file.url : `data:${file.type};base64,${file.url}`}
                            alt={file.name}
                            className="max-w-xs rounded-lg border border-border/50"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {file.imageType?.name || 'General'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Mini Buttons Bar - Always Visible for Both User and AI */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1">
                      {/* Copy Button */}
                      <button
                        onClick={() => navigator.clipboard.writeText(message.content)}
                        className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                        title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                      >
                        <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      
                      {/* Native TTS Button with Stop Functionality */}
                      <button
                        onClick={() => handleSpeak(message.content, message.id)}
                        className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                        title={speakingMessageId === message.id 
                          ? (language === 'ar' ? 'إيقاف القراءة' : 'Stop reading')
                          : (language === 'ar' ? 'قراءة بالصوت الطبيعي للجهاز' : 'Read with native device voice')
                        }
                      >
                        {speakingMessageId === message.id ? (
                          <VolumeX className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Volume2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Loading Indicator with proper TypingIndicator */}
          {isLoading && <TypingIndicator />}
          
          {/* ENHANCED TASK CONFIRMATION DISPLAY WITH DEBUG LOGGING */}
          {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
            <div className="flex justify-center mb-8 mt-6">
              <TaskConfirmationCard
                type={pendingTaskData ? 'task' : 'reminder'}
                data={pendingTaskData || pendingReminderData}
                onConfirm={() => {
                  console.log('🎯 TASK CONFIRMATION: User confirmed', pendingTaskData || pendingReminderData);
                  if (pendingTaskData) {
                    onTaskConfirmation(pendingTaskData);
                  } else {
                    onReminderConfirmation(pendingReminderData);
                  }
                }}
                onCancel={() => {
                  console.log('❌ TASK CONFIRMATION: User cancelled');
                  onCancelTaskConfirmation();
                }}
                isLoading={taskConfirmationLoading}
              />
            </div>
          )}
          
          {/* Extra spacing before end to ensure visibility */}
          <div className="h-24" />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageUrl={selectedImage.url}
          prompt={selectedImage.prompt}
        />
      )}
    </>
  );
}
