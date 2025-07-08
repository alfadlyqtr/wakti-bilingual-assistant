
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

  // ENHANCED: Debug task confirmation state
  useEffect(() => {
    console.log('🔍 CHAT MESSAGES: Task confirmation state update', {
      showTaskConfirmation,
      hasPendingTaskData: !!pendingTaskData,
      hasPendingReminderData: !!pendingReminderData,
      taskConfirmationLoading,
      pendingTaskDetails: pendingTaskData
    });
  }, [showTaskConfirmation, pendingTaskData, pendingReminderData, taskConfirmationLoading]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // Enhanced welcome message
  const renderWelcomeMessage = () => {
    if (!isNewConversation || sessionMessages.length > 0) return null;

    const userName = personalTouch?.nickname || userProfile?.display_name || (language === 'ar' ? 'صديقي' : 'friend');
    
    return (
      <div className="flex gap-3 justify-start mb-6">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="max-w-[80%]">
          <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border">
            <div className="text-sm leading-relaxed">
              {language === 'ar' 
                ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور والوثائق** - ارفع أي صورة وسأصفها لك بدقة فائقة\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images & Documents** - Upload any image and I'll describe it with extreme accuracy\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Message */}
        {renderWelcomeMessage()}
        
        {/* Chat Messages using enhanced ChatBubble component */}
        {sessionMessages.map((message, index) => (
          <ChatBubble 
            key={message.id} 
            message={message} 
            userProfile={userProfile}
            activeTrigger={activeTrigger}
          />
        ))}
        
        {/* Enhanced Loading Indicator */}
        {isLoading && <TypingIndicator />}
        
        {/* ENHANCED: Task Confirmation Display with better debugging and conditional rendering */}
        {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
          <div className="flex justify-center mb-4">
            <div className="w-full max-w-md">
              {/* ENHANCED DEBUG INFO (Remove in production) */}
              <div className="text-xs text-muted-foreground mb-2 p-2 bg-yellow-50 rounded border">
                🔍 DEBUG: Task Confirmation Active
                <br />Show: {showTaskConfirmation ? 'true' : 'false'}
                <br />Task Data: {pendingTaskData ? 'present' : 'missing'}
                <br />Reminder Data: {pendingReminderData ? 'present' : 'missing'}
                <br />Loading: {taskConfirmationLoading ? 'true' : 'false'}
              </div>
              
              <TaskConfirmationCard
                type={pendingTaskData ? 'task' : 'reminder'}
                data={pendingTaskData || pendingReminderData}
                onConfirm={() => {
                  console.log('🎯 TASK CONFIRMATION: User confirmed creation');
                  if (pendingTaskData) {
                    onTaskConfirmation(pendingTaskData);
                  } else {
                    onReminderConfirmation(pendingReminderData);
                  }
                }}
                onCancel={() => {
                  console.log('🎯 TASK CONFIRMATION: User cancelled creation');
                  onCancelTaskConfirmation();
                }}
                isLoading={taskConfirmationLoading}
              />
            </div>
          </div>
        )}
        
        {/* ENHANCED DEBUG: Show when task confirmation should appear but doesn't */}
        {showTaskConfirmation && !pendingTaskData && !pendingReminderData && (
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              ⚠️ DEBUG: Task confirmation is true but no pending data found
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
