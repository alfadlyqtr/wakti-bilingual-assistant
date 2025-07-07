
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { SimpleTaskRedirect } from './SimpleTaskRedirect';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, Database, HardDrive } from 'lucide-react';
import { HybridMemoryService } from '@/services/HybridMemoryService';

interface ChatMessagesProps {
  sessionMessages: any[];
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

export const ChatMessages = ({
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
}: ChatMessagesProps) => {
  const { language } = useTheme();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages.length, isLoading]);

  // HYBRID MEMORY: Get memory stats for display
  const memoryStats = userProfile?.id ? HybridMemoryService.getMemoryStats(userProfile.id) : null;

  const getWelcomeMessage = () => {
    if (language === 'ar') {
      return personalTouch?.nickname 
        ? `مرحباً ${personalTouch.nickname}! أنا WAKTI AI، مساعدك الذكي المدعوم بنموذج Claude 3.5 Haiku فائق السرعة. كيف يمكنني مساعدتك اليوم؟`
        : 'مرحباً! أنا WAKTI AI، مساعدك الذكي المدعوم بنموذج Claude 3.5 Haiku فائق السرعة. كيف يمكنني مساعدتك اليوم؟';
    }
    
    return personalTouch?.nickname 
      ? `Hey ${personalTouch.nickname}! I'm WAKTI AI, your intelligent assistant powered by ultra-fast Claude 3.5 Haiku. How can I help you today?`
      : 'Hello! I\'m WAKTI AI, your intelligent assistant powered by ultra-fast Claude 3.5 Haiku. How can I help you today?';
  };

  return (
    <div className="flex flex-col h-full">
      {/* ENHANCED: Speed & Memory Status Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 border-b border-border/50 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
              <Zap className="w-3 h-3 mr-1" />
              Haiku Speed (4x faster)
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <Brain className="w-3 h-3 mr-1" />
              Hybrid Memory
            </Badge>
          </div>
          
          {memoryStats && (
            <div className="flex items-center gap-2 text-muted-foreground">
              {memoryStats.layersActive?.browser && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Browser</span>
                </div>
              )}
              {memoryStats.layersActive?.session && (
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-blue-500" />
                  <span>Session ({memoryStats.sessionMessages})</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3 text-purple-500" />
                <span>Database</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome Message */}
          {isNewConversation && sessionMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-2xl p-6 border border-border/50">
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative">
                      <Brain className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold mb-2 text-foreground">
                    {language === 'ar' ? 'WAKTI AI - فائق السرعة' : 'WAKTI AI - Ultra Fast'}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {getWelcomeMessage()}
                  </p>
                  
                  {/* Speed & Memory Features */}
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Zap className="w-4 h-4" />
                      <span>{language === 'ar' ? '4x أسرع' : '4x Faster'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Brain className="w-4 h-4" />
                      <span>{language === 'ar' ? 'ذاكرة ذكية' : 'Smart Memory'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                      <Database className="w-4 h-4" />
                      <span>{language === 'ar' ? 'سياق دائم' : 'Permanent Context'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <HardDrive className="w-4 h-4" />
                      <span>{language === 'ar' ? 'يعمل بلا اتصال' : 'Works Offline'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {sessionMessages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              activeTrigger={activeTrigger}
              userProfile={userProfile}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}

          {/* Task Confirmation - Fixed prop name from taskData to data */}
          {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
            <EditableTaskConfirmationCard
              type={pendingReminderData ? 'reminder' : 'task'}
              data={pendingTaskData || pendingReminderData}
              onConfirm={pendingTaskData ? onTaskConfirmation : onReminderConfirmation}
              onCancel={onCancelTaskConfirmation}
              isLoading={taskConfirmationLoading}
            />
          )}

          <div ref={endOfMessagesRef} />
        </div>
      </ScrollArea>
    </div>
  );
};
