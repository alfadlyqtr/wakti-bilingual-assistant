import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { ChatHeader } from '@/components/wakti-ai-v2/ChatHeader';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';
import { VisionImageDisplay } from '@/components/wakti-ai-v2/VisionImageDisplay';
import { VisionUploadedFile } from '@/hooks/useVisionFileUpload';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageUrl?: string | null;
  browsingUsed?: boolean | null;
  browsingData?: any | null;
  needsConfirmation?: boolean | null;
  pendingTaskData?: any | null;
  pendingReminderData?: any | null;
  isError?: boolean;
  visionFiles?: VisionUploadedFile[];
}

interface TaskData {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: string;
}

export default function WaktiAIV2() {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState('chat');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [showTaskConfirmation, setShowTaskConfirmation] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<TaskData | null>(null);
  const [pendingReminderData, setPendingReminderData] = useState<TaskData | null>(null);

  const handleSendMessage = async (
    messageText: string, 
    inputType: 'text' | 'voice' = 'text',
    visionFiles: VisionUploadedFile[] = []
  ) => {
    if (!messageText.trim() && visionFiles.length === 0) return;
    
    setIsLoading(true);
    setIsTyping(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: messageText,
        timestamp: Date.now(),
        visionFiles: visionFiles // NEW: Include vision files in message
      };

      setMessages(prev => [...prev, userMessage]);

      // Prepare request payload with vision files
      const requestPayload = {
        message: messageText,
        userId: user.id,
        language,
        conversationId: currentConversationId,
        inputType,
        activeTrigger,
        visionFiles: visionFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          publicUrl: file.publicUrl,
          size: file.size
        })),
        conversationSummary: '',
        recentMessages: messages.slice(-5).map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : '[attachment]'
        })),
        customSystemPrompt: buildSystemPrompt(),
        maxTokens: 600,
        userStyle: 'detailed',
        userTone: 'neutral',
        personalityEnabled: true,
        enableTaskCreation: true
      };

      console.log('🚀 Sending request with vision files:', visionFiles.length);

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: requestPayload
      });

      if (error) throw error;

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        needsConfirmation: data.needsConfirmation,
        pendingTaskData: data.pendingTaskData,
        pendingReminderData: data.pendingReminderData
      };

      setMessages(prev => [...prev, aiMessage]);

      // Handle confirmations or other actions
      if (data.needsConfirmation) {
        setShowTaskConfirmation(true);
        setPendingTaskData(data.pendingTaskData);
        setPendingReminderData(data.pendingReminderData);
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      showError(error.message || 'Failed to send message');
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.'
          : 'Sorry, there was an error processing your message. Please try again.',
        timestamp: Date.now(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const buildSystemPrompt = () => {
    let systemPrompt = language === 'ar' 
      ? `أنت WAKTI AI، مساعد ذكي متقدم يتحدث العربية بطلاقة. أنت مساعد شخصي ذكي ومتطور يساعد المستخدمين في مهامهم اليومية.`
      : `You are WAKTI AI, an advanced AI assistant. You are a smart and sophisticated personal assistant that helps users with their daily tasks.`;

    // Add vision capabilities note if applicable
    systemPrompt += language === 'ar'
      ? `\n\nيمكنك أيضاً تحليل الصور والنصوص المرئية عند إرفاقها في المحادثة.`
      : `\n\nYou can also analyze images and visual text when they are attached to the conversation.`;

    return systemPrompt;
  };

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load initial messages or conversation
    loadInitialMessages();
  }, []);

  const loadInitialMessages = async () => {
    // Placeholder for loading messages from a specific conversation
    // For now, just setting a default message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: language === 'ar'
        ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟'
        : 'Hello! How can I help you today?',
      timestamp: Date.now()
    }]);
  };

  const handleNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: language === 'ar'
        ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟'
        : 'Hello! How can I help you today?',
      timestamp: Date.now()
    }]);
  };

  const handleTextGenerated = (text: string, mode: 'compose' | 'reply', isTextGenerated: boolean = true) => {
    setInputMessage(text);
    if (isTextGenerated) {
      showSuccess(language === 'ar' ? 'تم إنشاء النص!' : 'Text generated!');
    }
  };

  const getInputPlaceholder = () => {
    switch (activeTrigger) {
      case 'search':
        return language === 'ar' ? 'ابحث عن أي شيء...' : 'Search for anything...';
      case 'image':
        return language === 'ar' ? 'اطلب صورة...' : 'Request an image...';
      default:
        return language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...';
    }
  };

  const handleTaskConfirm = async (confirmedTaskData: TaskData) => {
    setIsLoading(true);
    setShowTaskConfirmation(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: confirmedTaskData.title,
          description: confirmedTaskData.description,
          due_date: confirmedTaskData.due_date,
          due_time: confirmedTaskData.due_time,
          priority: confirmedTaskData.priority,
          status: 'open'
        });

      if (error) throw error;

      showSuccess(language === 'ar' ? 'تم إنشاء المهمة بنجاح!' : 'Task created successfully!');

      // Add confirmation message
      const confirmationMessage: ChatMessage = {
        id: `msg_${Date.now()}_confirm`,
        role: 'assistant',
        content: language === 'ar' 
          ? `تم إنشاء المهمة: ${confirmedTaskData.title}`
          : `Task created: ${confirmedTaskData.title}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, confirmationMessage]);

    } catch (error: any) {
      console.error('Error creating task:', error);
      showError(error.message || 'Failed to create task');
    } finally {
      setIsLoading(false);
      setPendingTaskData(null);
      setPendingReminderData(null);
    }
  };

  const handleTaskEdit = () => {
    setShowTaskConfirmation(false);
    // Re-enable editing or show the task details in editable format
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <ChatHeader
        activeTrigger={activeTrigger}
        onTriggerChange={setActiveTrigger}
        onToggleDrawer={() => setShowQuickActions(!showQuickActions)}
        onToggleConversations={() => setShowConversations(!showConversations)}
        onNewConversation={handleNewConversation}
      />

      {/* Notification Bars */}
      <NotificationBars />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <div className="max-w-4xl mx-auto space-y-4">
              <ChatMessages 
                messages={messages}
                isTyping={isTyping}
                onTaskConfirm={handleTaskConfirm}
                onTaskEdit={handleTaskEdit}
                showTaskConfirmation={showTaskConfirmation}
                pendingTaskData={pendingTaskData}
                pendingReminderData={pendingReminderData}
              />
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="max-w-4xl mx-auto">
              <ChatInput
                message={inputMessage}
                setMessage={setInputMessage}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                placeholder={getInputPlaceholder()}
                showVoiceInput={true}
                onVoiceRecognitionStart={() => setIsVoiceRecording(true)}
                onVoiceRecognitionEnd={() => setIsVoiceRecording(false)}
              />
            </div>
          </div>
        </div>

        {/* Drawers */}
        <ChatDrawers
          showQuickActions={showQuickActions}
          showConversations={showConversations}
          onCloseQuickActions={() => setShowQuickActions(false)}
          onCloseConversations={() => setShowConversations(false)}
          onSendMessage={handleSendMessage}
          activeTrigger={activeTrigger}
          onTriggerChange={setActiveTrigger}
          onTextGenerated={handleTextGenerated}
        />
      </div>
    </div>
  );
}
