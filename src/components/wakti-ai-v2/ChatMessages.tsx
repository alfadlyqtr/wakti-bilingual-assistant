
import React, { useEffect, useRef } from 'react';
import { MessageSquare, Bot, User, Calendar, Clock, CheckCircle, Loader2, Volume2, Copy } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { Badge } from '@/components/ui/badge';

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
  isNewConversation
}: ChatMessagesProps) {
  const { language } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle video update events
  useEffect(() => {
    const handleVideoUpdate = (event: CustomEvent) => {
      console.log('🎬 CHAT UPDATE: Received video update event', event.detail);
      
      const { taskId, videoUrl, status, error, content } = event.detail;
      
      // Update parent component messages through custom event
      const updateMessageEvent = new CustomEvent('updateSessionMessage', {
        detail: {
          filter: (msg: AIMessage) => {
            // Look for message that contains the task ID or mentions video generation
            return msg.content?.includes(taskId) || 
                   (msg.content?.includes('Video generation started') && 
                    msg.content?.includes('🎬'));
          },
          update: (msg: AIMessage) => {
            console.log('🎬 CHAT UPDATE: Found message to update', msg.id);
            
            if (status === 'completed' && videoUrl) {
              return {
                ...msg,
                content: content || `🎬 Video generated successfully!\n\n<video controls width="400" style="max-width: 100%; border-radius: 8px;">\n<source src="${videoUrl}" type="video/mp4">\nYour browser does not support the video tag.\n</video>`
              };
            } else if (status === 'failed') {
              return {
                ...msg,
                content: content || `❌ Video generation failed: ${error}`
              };
            } else if (status === 'processing') {
              return {
                ...msg,
                content: content
              };
            }
            return msg;
          }
        }
      });
      
      window.dispatchEvent(updateMessageEvent);
    };
    
    // Listen for video update events
    window.addEventListener('updateVideoMessage', handleVideoUpdate as EventListener);
    
    // Cleanup listener
    return () => {
      window.removeEventListener('updateVideoMessage', handleVideoUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // Native TTS function
  const handleSpeak = (text: string) => {
    // Stop any currently playing speech
    speechSynthesis.cancel();
    
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
                ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
              }
            </div>
            
            {/* Mini Buttons */}
            <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex gap-1">
                {/* Copy Button */}
                <button
                  onClick={() => navigator.clipboard.writeText(language === 'ar' 
                    ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                    : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
                  )}
                  className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                >
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
                
                {/* Native TTS Button */}
                <button
                  onClick={() => handleSpeak(language === 'ar' 
                    ? `مرحباً ${userName}! أنا WAKTI AI، مساعدك الذكي المطور. يمكنني إنشاء المهام والتذكيرات، تحليل الصور، البحث والاستكشاف، والمحادثة الذكية. ما الذي يمكنني مساعدتك به اليوم؟`
                    : `Hello ${userName}! I'm WAKTI AI, your advanced AI assistant. I can help you create tasks and reminders, analyze images, search and explore topics, and have smart conversations. What can I help you with today?`
                  )}
                  className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'قراءة بالصوت الطبيعي للجهاز' : 'Read with native device voice'}
                >
                  <Volume2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to render message content with HTML support for videos
  const renderMessageContent = (content: string) => {
    // Check if content contains HTML (video tags, styling, etc.)
    if (content.includes('<video') || content.includes('<div style') || content.includes('<style>')) {
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: content }}
          className="prose prose-sm max-w-none"
        />
      );
    }
    
    // Regular text content
    return (
      <div className="whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Message */}
        {renderWelcomeMessage()}
        
        {/* Chat Messages with proper alignment, image previews, and mini buttons */}
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
                {/* Mode Badge - For both user and AI messages */}
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                    {message.intent === 'vision' ? '👁️ Vision' : 
                     message.intent === 'search' ? '🔍 Search' :
                     message.intent === 'image' ? '🎨 Image' :
                     message.intent === 'video' ? '🎬 Video' : 
                     message.inputType === 'voice' ? '🎤 Voice' :
                     message.inputType === 'vision' ? '👁️ Vision' :
                     '💬 Chat'}
                  </Badge>
                </div>
                
                <div className="text-sm leading-relaxed">
                  {renderMessageContent(message.content)}
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
                
                {/* Mini Buttons Bar - Both User and AI */}
                <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex gap-1">
                    {/* Copy Button */}
                    <button
                      onClick={() => navigator.clipboard.writeText(message.content)}
                      className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                      title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                    >
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                    
                    {/* Native TTS Button */}
                    <button
                      onClick={() => handleSpeak(message.content)}
                      className="p-1.5 rounded-md hover:bg-background/80 transition-colors"
                      title={language === 'ar' ? 'قراءة بالصوت الطبيعي للجهاز' : 'Read with native device voice'}
                    >
                      <Volume2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
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
  );
}
