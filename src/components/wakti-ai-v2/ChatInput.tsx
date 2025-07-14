import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Send, Mic, MicOff, Square, Trash2, Video, FileText, Search, Image } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, trigger: string, files?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onOpenVideoDialog?: () => void;
}

export function ChatInput({ 
  message, 
  setMessage, 
  isLoading, 
  sessionMessages, 
  onSendMessage, 
  onClearChat, 
  onOpenPlusDrawer, 
  activeTrigger, 
  onTriggerChange,
  onOpenVideoDialog 
}: ChatInputProps) {
  const { language } = useTheme();
  const { showError } = useToastHelper();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<any[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        setAudioChunks((prev) => [...prev, event.data]);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        setAudioChunks([]);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error: any) {
      console.error("Error starting recording:", error);
      showError(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSend = () => {
    if (isRecording) {
      stopRecording();
    }

    if (audioURL) {
      onSendMessage(message, 'voice');
      setAudioURL(null);
    } else {
      onSendMessage(message, activeTrigger);
    }

    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    autoGrow(event.target);
  };

  const autoGrow = (field: HTMLTextAreaElement) => {
    field.style.height = '5px';
    field.style.height = (field.scrollHeight) + 'px';
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const triggerButtons = [
    {
      id: 'chat',
      icon: FileText,
      label: language === 'ar' ? 'دردشة' : 'Chat',
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      id: 'search',
      icon: Search,
      label: language === 'ar' ? 'بحث' : 'Search',
      color: 'text-green-600 dark:text-green-400'
    },
    {
      id: 'image',
      icon: Image,
      label: language === 'ar' ? 'صورة' : 'Image',
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      id: 'video',
      icon: Video,
      label: language === 'ar' ? 'فيديو' : 'Video',
      color: 'text-pink-600 dark:text-pink-400'
    }
  ];

  const handleVideoClick = () => {
    if (onOpenVideoDialog) {
      onOpenVideoDialog();
    }
  };

  const handleTriggerClick = (triggerId: string) => {
    if (triggerId === 'video') {
      handleVideoClick();
    } else {
      onTriggerChange(triggerId);
    }
  };

  return (
    <div className="space-y-3">
      {/* Trigger Buttons */}
      <div className="flex justify-center">
        <div className="flex bg-muted/50 rounded-full p-1 gap-1">
          {triggerButtons.map((trigger) => (
            <Button
              key={trigger.id}
              onClick={() => handleTriggerClick(trigger.id)}
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full px-3 py-2 h-auto transition-all duration-200",
                (activeTrigger === trigger.id && trigger.id !== 'video') ? 
                  "bg-background shadow-sm" : 
                  "hover:bg-background/50"
              )}
            >
              <trigger.icon className={cn("h-4 w-4 mr-2", trigger.color)} />
              <span className="text-sm font-medium">{trigger.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTrigger === 'search' 
                ? (language === 'ar' ? 'ابحث عن أي شيء...' : 'Search for anything...')
                : activeTrigger === 'image'
                ? (language === 'ar' ? 'صف الصورة التي تريد إنشاؤها...' : 'Describe the image التي تريد إنشاؤها...')
                : (language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...')
            }
            className="min-h-[50px] max-h-[120px] resize-none pr-12 bg-background border-input"
            disabled={isLoading || isRecording}
          />
          
          {/* Voice Recording Button */}
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant="ghost"
            size="sm"
            className={cn(
              "absolute right-2 top-2 p-1.5 h-auto",
              isRecording ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={isLoading}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={isLoading || isRecording || (!message.trim())}
          size="lg"
          className="h-[50px] px-4"
        >
          <Send className="h-4 w-4" />
        </Button>

        {/* Clear Chat Button */}
        {sessionMessages.length > 0 && (
          <Button
            onClick={onClearChat}
            variant="outline"
            size="lg"
            className="h-[50px] px-4"
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
