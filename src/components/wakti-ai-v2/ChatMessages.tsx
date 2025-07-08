
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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // ENHANCED: Add comprehensive task confirmation logging
  useEffect(() => {
    console.log('📋 CHAT MESSAGES: Task confirmation state changed:', {
      showTaskConfirmation,
      hasPendingTaskData: !!pendingTaskData,
      hasPendingReminderData: !!pendingReminderData,
      pendingTaskData: pendingTaskData ? {
        title: pendingTaskData.title,
        description: pendingTaskData.description,
        hasSubtasks: !!pendingTaskData.subtasks,
        subtaskCount: pendingTaskData.subtasks?.length || 0
      } : null,
      pendingReminderData: pendingReminderData ? {
        title: pendingReminderData.title,
        description: pendingReminderData.description
      } : null,
      shouldRenderConfirmation: showTaskConfirmation && (pendingTaskData || pendingReminderData),
      timestamp: new Date().toISOString()
    });
  }, [showTaskConfirmation, pendingTaskData, pendingReminderData]);

  // Show welcome message for new conversations
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
                ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI، مساعدك الذكي المطور. يمكنني:\n\n🎯 **إنشاء المهام والتذكيرات** - فقط اكتب "أنشئ مهمة" أو "ذكرني"\n🖼️ **تحليل الصور** - ارفع أي صورة وسأصفها لك\n🔍 **البحث والاستكشاف** - اسألني عن أي موضوع\n💬 **المحادثة الذكية** - أتذكر محادثاتنا السابقة\n\nما الذي يمكنني مساعدتك به اليوم؟`
                : `Hello ${userName}! 👋\n\nI'm WAKTI AI, your advanced AI assistant. I can help you with:\n\n🎯 **Create Tasks & Reminders** - Just say "create a task" or "remind me"\n🖼️ **Analyze Images** - Upload any image and I'll describe it\n🔍 **Search & Explore** - Ask me about any topic\n💬 **Smart Conversations** - I remember our previous chats\n\nWhat can I help you with today?`
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ENHANCED: Task confirmation rendering with better debugging
  const renderTaskConfirmation = () => {
    const shouldShow = showTaskConfirmation && (pendingTaskData || pendingReminderData);
    
    console.log('🎯 RENDER TASK CONFIRMATION CHECK:', {
      showTaskConfirmation,
      hasPendingTaskData: !!pendingTaskData,
      hasPendingReminderData: !!pendingReminderData,
      shouldShow,
      pendingTaskTitle: pendingTaskData?.title,
      pendingReminderTitle: pendingReminderData?.title
    });
    
    if (!shouldShow) {
      console.log('❌ TASK CONFIRMATION NOT RENDERED - Missing conditions');
      return null;
    }

    console.log('✅ RENDERING TASK CONFIRMATION CARD');
    
    return (
      <div className="flex justify-center mb-4">
        <TaskConfirmationCard
          type={pendingTaskData ? 'task' : 'reminder'}
          data={pendingTaskData || pendingReminderData}
          onConfirm={() => {
            console.log('🔄 TASK CONFIRMATION BUTTON CLICKED');
            if (pendingTaskData) {
              onTaskConfirmation(pendingTaskData);
            } else {
              onReminderConfirmation(pendingReminderData);
            }
          }}
          onCancel={() => {
            console.log('❌ TASK CONFIRMATION CANCELLED');
            onCancelTaskConfirmation();
          }}
          isLoading={taskConfirmationLoading}
        />
      </div>
    );
  };

  console.log('🖼️ CHAT MESSAGES: Rendering with', {
    messagesCount: sessionMessages.length,
    isLoading,
    showTaskConfirmation,
    hasPendingData: !!(pendingTaskData || pendingReminderData)
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Message */}
        {renderWelcomeMessage()}
        
        {/* Chat Messages using ChatBubble component */}
        {sessionMessages.map((message, index) => (
          <ChatBubble 
            key={message.id} 
            message={message} 
            userProfile={userProfile}
            activeTrigger={activeTrigger}
          />
        ))}
        
        {/* Loading Indicator with proper TypingIndicator */}
        {isLoading && <TypingIndicator />}
        
        {/* ENHANCED: Task Confirmation Display with debugging */}
        {renderTaskConfirmation()}
        
        {/* Development debug info */}
        {process.env.NODE_ENV === 'development' && (showTaskConfirmation || pendingTaskData || pendingReminderData) && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-3 text-xs">
            <div className="font-bold text-yellow-800 mb-2">Task Confirmation Debug Info</div>
            <div>Show Confirmation: {showTaskConfirmation ? '✅' : '❌'}</div>
            <div>Pending Task: {pendingTaskData ? '✅' : '❌'} {pendingTaskData?.title || 'N/A'}</div>
            <div>Pending Reminder: {pendingReminderData ? '✅' : '❌'} {pendingReminderData?.title || 'N/A'}</div>
            <div>Should Render: {(showTaskConfirmation && (pendingTaskData || pendingReminderData)) ? '✅' : '❌'}</div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
