import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Trash2, X } from 'lucide-react';
import { ChatMessage } from '@/components/wakti-ai-v2/ChatMessage';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { useTheme } from '@/providers/ThemeProvider';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { QuickActionsGrid } from '@/components/wakti-ai-v2/QuickActionsGrid';
import { SimplifiedFileUpload } from '@/components/wakti-ai-v2/SimplifiedFileUpload';
import { VideoUploadInterface } from '@/components/wakti-ai-v2/VideoUploadInterface';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  trigger?: string;
  files?: any[];
}

export default function WaktiAIV2() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [activeTrigger, setActiveTrigger] = useState('chat');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { language } = useTheme();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

  // Function to handle sending messages
  const handleSendMessage = async (message: string, trigger: string = 'chat', files?: any[]) => {
    if (message.trim() === '' && (!files || files.length === 0)) return;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: message, trigger, files };
    setSessionMessages(prevMessages => [...prevMessages, userMessage]);
    setMessage('');

    try {
      // Construct the request body
      const requestBody = {
        message,
        trigger,
        language,
        files: files ? files : []
      };

      // Log the request body for debugging
      console.log('➡️ REQUEST:', requestBody);

      // Make the API request
      const response = await fetch('/api/wakti-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Check if the response is successful
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse the response as JSON
      const data = await response.json();

      // Log the response data for debugging
      console.log('⬅️ RESPONSE:', data);

      // Add the assistant's response to the messages
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setSessionMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error: any) {
      // Log any errors
      console.error('🚨 ERROR:', error);

      // Add an error message to the chat
      const errorMessage: Message = { role: 'assistant', content: `Error: ${error.message}` };
      setSessionMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      // Set loading to false
      setIsLoading(false);
    }
  };

  // Function to clear the chat
  const clearChat = () => {
    setSessionMessages([]);
  };

  // Simplified File Upload Functions
  const handleFilesUploaded = (files: any[]) => {
    console.log('📁 FILES UPLOADED:', files);
    setUploadedFiles(files);
  };

  const updateFiles = (files: any[]) => {
    console.log('🔄 FILES UPDATED:', files);
    setUploadedFiles(files);
  };

  const removeFile = (fileId: string) => {
    console.log('❌ FILE REMOVED:', fileId);
    setUploadedFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
  };

  const handleVideoGenerated = (videoUrl: string) => {
    console.log('🎬 VIDEO GENERATED:', videoUrl);
    const videoMessage: Message = { role: 'assistant', content: videoUrl, trigger: 'video' };
    setSessionMessages(prevMessages => [...prevMessages, videoMessage]);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-950">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {language === 'ar' ? 'وقتي AI' : 'Wakti AI'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={clearChat}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <QuickActionsPanel
            onTriggerChange={setActiveTrigger}
            activeTrigger={activeTrigger}
            onSendMessage={handleSendMessage}
            onTextGenerated={(text) => setMessage(text)}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {sessionMessages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {language === 'ar' ? 'مرحباً بك في وقتي AI' : 'Welcome to Wakti AI'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  {language === 'ar' 
                    ? 'اسأل أي شيء، ابحث في الويب، أنشئ صور، أو حول صورك إلى فيديوهات مذهلة'
                    : 'Ask anything, search the web, generate images, or turn your photos into amazing videos'
                  }
                </p>
              </div>
            ) : (
              sessionMessages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  message={msg}
                  isTyping={isLoading && index === sessionMessages.length - 1 && msg.role === 'assistant'}
                />
              ))
            )}
            {isLoading && sessionMessages[sessionMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 max-w-xs shadow-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Video Upload Interface - Show only in video mode */}
        {activeTrigger === 'video' && showVideoUpload && (
          <div className="px-3 pb-3">
            <div className="max-w-4xl mx-auto">
              <VideoUploadInterface
                onClose={() => setShowVideoUpload(false)}
                onVideoGenerated={handleVideoGenerated}
              />
            </div>
          </div>
        )}

        {/* Simplified File Upload Component - Only show for non-video modes */}
        {activeTrigger !== 'video' && (
          <SimplifiedFileUpload
            onFilesUploaded={handleFilesUploaded}
            onUpdateFiles={updateFiles}
            uploadedFiles={uploadedFiles}
            onRemoveFile={removeFile}
            isUploading={isUploading}
            disabled={isLoading}
            onAutoSwitchMode={(mode) => {
              console.log('🔍 UPLOAD AUTO-SWITCH: Switching to', mode);
              setActiveTrigger(mode);
            }}
          />
        )}

        {/* Chat Input */}
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading}
          sessionMessages={sessionMessages}
          onSendMessage={handleSendMessage}
          onClearChat={clearChat}
          onOpenPlusDrawer={() => setShowQuickActions(true)}
          activeTrigger={activeTrigger}
          onTriggerChange={setActiveTrigger}
          showVideoUpload={showVideoUpload}
          setShowVideoUpload={setShowVideoUpload}
        />
      </div>

      {/* Quick Actions Drawer */}
      {showQuickActions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:w-auto sm:min-w-[400px] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
              </h2>
              <Button onClick={() => setShowQuickActions(false)} variant="ghost" size="sm">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <QuickActionsGrid onClose={() => setShowQuickActions(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
