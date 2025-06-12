import React, { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessagesProps {
  sessionMessages: any[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: any;
  userProfile: any;
}

export function ChatMessages({ 
  sessionMessages, 
  isLoading, 
  activeTrigger, 
  scrollAreaRef,
  userProfile 
}: ChatMessagesProps) {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [sessionMessages, isLoading]);

  // Clear chat memory when starting a completely new conversation (no messages)
  useEffect(() => {
    if (sessionMessages.length === 0) {
      const clearMemory = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            WaktiAIV2Service.clearChatMemory(user.id);
            console.log('🧠 Chat memory cleared for new conversation');
          }
        } catch (error) {
          console.error('Error clearing chat memory:', error);
        }
      };
      
      clearMemory();
    }
  }, [sessionMessages.length]);

  const handleTaskConfirmation = async (taskData: any) => {
    try {
      console.log('Confirming task creation:', taskData);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await WaktiAIV2Service.sendMessage(
        '',
        user.id,
        language,
        null, 
        'text',
        [],
        false,
        'chat',
        null,
        [],
        null,
        null,
        true,
        false,
        taskData,
        null
      );

      if (response.error) {
        throw new Error(response.error);
      }

      showSuccess(
        language === 'ar' ? 'تم إنشاء المهمة بنجاح!' : 'Task created successfully!'
      );

      // Add follow-up success message to chat
      const successMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant' as const,
        content: language === 'ar' 
          ? `✅ تم إنشاء المهمة بنجاح! يرجى زيارة صفحة المهام والتذكيرات`
          : `✅ Task created successfully! Please visit T & R page`,
        timestamp: new Date(),
        intent: 'task_created_success',
        confidence: 'high' as const,
        actionTaken: true
      };

      // Update session messages with success message
      const updatedMessages = [...sessionMessages];
      
      // Remove the last message if it was a task preview
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      if (lastMessage?.intent === 'task_preview') {
        updatedMessages[updatedMessages.length - 1] = successMessage;
      } else {
        updatedMessages.push(successMessage);
      }

      // Save updated session
      WaktiAIV2Service.saveChatSession(updatedMessages, null);
      
      // Force a page refresh to update the session
      window.location.reload();

    } catch (error: any) {
      console.error('Task confirmation failed:', error);
      showSuccess(
        error.message || (language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task')
      );
    }
  };

  const handleReminderConfirmation = async (reminderData: any) => {
    try {
      console.log('Confirming reminder creation:', reminderData);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await WaktiAIV2Service.sendMessage(
        '',
        user.id,
        language,
        null,
        'text',
        [],
        false,
        'chat',
        null,
        [],
        null,
        null,
        false,
        true,
        null,
        reminderData
      );

      if (response.error) {
        throw new Error(response.error);
      }

      showSuccess(
        language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!'
      );

      // Add follow-up success message to chat
      const successMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant' as const,
        content: language === 'ar' 
          ? `✅ تم إنشاء التذكير بنجاح! يرجى زيارة صفحة المهام والتذكيرات`
          : `✅ Reminder created successfully! Please visit T & R page`,
        timestamp: new Date(),
        intent: 'reminder_created_success',
        confidence: 'high' as const,
        actionTaken: true
      };

      // Update session messages with success message
      const updatedMessages = [...sessionMessages];
      
      // Remove the last message if it was a reminder preview
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      if (lastMessage?.intent === 'reminder_preview') {
        updatedMessages[updatedMessages.length - 1] = successMessage;
      } else {
        updatedMessages.push(successMessage);
      }

      // Save updated session
      WaktiAIV2Service.saveChatSession(updatedMessages, null);
      
      // Force a page refresh to update the session
      window.location.reload();

    } catch (error: any) {
      console.error('Reminder confirmation failed:', error);
      showSuccess(
        error.message || (language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder')
      );
    }
  };

  const handleCancelConfirmation = () => {
    // Simply refresh to remove the confirmation card
    window.location.reload();
  };

  // Fixed height component that fills available space
  return (
    <div className="h-full w-full">
      <ScrollArea ref={scrollAreaRef} className="h-full w-full">
        <div className="p-2 pb-6 min-h-full">
          <div className="w-full space-y-4">
            {sessionMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-muted-foreground text-sm">
                  {language === 'ar' 
                    ? 'ابدأ محادثة جديدة...' 
                    : 'Start a new conversation...'
                  }
                </div>
              </div>
            )}
            
            {sessionMessages.map((message, index) => (
              <ChatBubble
                key={message.id || index}
                message={message}
                userProfile={userProfile}
                activeTrigger={activeTrigger}
              />
            ))}

            {isLoading && (
              <div className="flex justify-start px-2">
                <TypingIndicator />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
