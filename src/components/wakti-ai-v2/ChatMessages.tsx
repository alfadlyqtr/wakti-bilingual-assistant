
import React, { useEffect, useRef } from 'react';
import { MessageSquare, Bot, User, Calendar, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';

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

  // FIXED: Show welcome message for new conversations
  const renderWelcomeMessage = () => {
    if (!isNewConversation || sessionMessages.length > 0) return null;

    const userName = personalTouch?.nickname || userProfile?.display_name || (language === 'ar' ? 'صديقي' : 'friend');
    
    return (
      <div className="flex justify-start mb-6">
        <div className="flex gap-3 max-w-[80%]">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border">
            <div className="text-sm leading-relaxed">
              {language === 'ar' 
                ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
              }
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
        
        {/* Chat Messages with proper alignment and image previews */}
        {sessionMessages.map((message, index) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className="flex gap-3 max-w-[80%]">
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              
              <div className={`rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border'
              }`}>
                <div className="text-sm leading-relaxed">
                  {renderMessageContent(message.content)}
                </div>
                
                {/* FIXED: Image Preview in Chat Messages */}
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
