
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Send, 
  Mic, 
  MicOff, 
  MessageSquare, 
  Sparkles, 
  Settings, 
  Brain,
  User,
  History,
  Zap
} from 'lucide-react';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { UserKnowledgeSetup } from '@/components/wakti-ai-v2/UserKnowledgeSetup';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function WaktiAIV2() {
  const { theme, language } = useTheme();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [showUserSetup, setShowUserSetup] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadConversations();
    checkUserKnowledge();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkUserKnowledge = async () => {
    try {
      const knowledge = await WaktiAIV2Service.getUserKnowledge();
      if (!knowledge || knowledge.interests.length === 0) {
        setShowUserSetup(true);
      }
    } catch (error) {
      console.error('Error checking user knowledge:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const convs = await WaktiAIV2Service.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const msgs = await WaktiAIV2Service.getConversationMessages(conversationId);
      setMessages(msgs);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  };

  const sendMessage = async (text?: string, inputType: 'text' | 'voice' = 'text') => {
    const messageText = text || message;
    if (!messageText.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      inputType
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    try {
      const response = await WaktiAIV2Service.sendMessage(
        messageText,
        currentConversationId || undefined,
        language,
        inputType
      );

      // Update user context if provided
      if (response.userContext) {
        setUserContext(response.userContext);
      }

      const assistantMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        imageUrl: response.actionResult?.imageUrl
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation ID if it's a new conversation
      if (response.isNewConversation && response.conversationId) {
        setCurrentConversationId(response.conversationId);
        loadConversations(); // Refresh conversations list
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(
        language === 'ar' 
          ? 'خطأ في إرسال الرسالة. يرجى المحاولة مرة أخرى.'
          : 'Error sending message. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      toast.success(
        language === 'ar' 
          ? 'بدأ التسجيل... اضغط مرة أخرى للتوقف'
          : 'Recording started... Click again to stop'
      );
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(
        language === 'ar' 
          ? 'خطأ في بدء التسجيل. يرجى التحقق من الأذونات.'
          : 'Error starting recording. Please check permissions.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceMessage = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          const transcription = await WaktiAIV2Service.transcribeVoice(base64Audio, language);
          if (transcription.text) {
            await sendMessage(transcription.text, 'voice');
          } else {
            toast.error(
              language === 'ar' 
                ? 'لم يتم التعرف على أي نص. يرجى المحاولة مرة أخرى.'
                : 'No text recognized. Please try again.'
            );
          }
        } catch (error) {
          console.error('Error transcribing voice:', error);
          toast.error(
            language === 'ar' 
              ? 'خطأ في تحويل الصوت إلى نص.'
              : 'Error converting voice to text.'
          );
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing voice message:', error);
    }
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowConversations(false);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
      
      toast.success(
        language === 'ar' ? 'تم حذف المحادثة' : 'Conversation deleted'
      );
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error(
        language === 'ar' ? 'خطأ في حذف المحادثة' : 'Error deleting conversation'
      );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Enhanced Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="h-8 w-8 text-primary" />
              <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {language === 'ar' ? 'وكتي الذكي المطور' : 'WAKTI AI Enhanced'}
              </h1>
              {userContext?.userName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {language === 'ar' ? `مرحباً ${userContext.userName}` : `Hello ${userContext.userName}`}
                  {userContext.conversationCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      <History className="h-3 w-3 mr-1" />
                      {userContext.conversationCount}
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {userContext?.modelUsed && (
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {userContext.modelUsed}
              </Badge>
            )}
            
            <Dialog open={showUserSetup} onOpenChange={setShowUserSetup}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {language === 'ar' ? 'إعدادات الذكاء الاصطناعي' : 'AI Settings'}
                  </DialogTitle>
                </DialogHeader>
                <UserKnowledgeSetup onComplete={() => setShowUserSetup(false)} />
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowConversations(!showConversations)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            <Button onClick={startNewConversation} size="sm">
              {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Enhanced Conversations Sidebar */}
        {showConversations && (
          <div className="w-80 border-r bg-muted/50">
            <div className="p-4">
              <ConversationsList
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelectConversation={(id) => {
                  loadConversationMessages(id);
                  setShowConversations(false);
                }}
                onDeleteConversation={deleteConversation}
              />
            </div>
          </div>
        )}

        {/* Enhanced Chat Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="relative inline-block mb-4">
                    <Brain className="h-16 w-16 text-primary mx-auto" />
                    <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    {language === 'ar' ? 'وكتي الذكي المطور' : 'Enhanced WAKTI AI'}
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {language === 'ar' 
                      ? 'مساعدك الذكي المطور والشخصي. أستطيع تذكر محادثاتنا وأصبحت أكثر ذكاءً وتخصصاً لك.'
                      : 'Your enhanced and personalized AI assistant. I can remember our conversations and have become smarter and more specialized for you.'
                    }
                  </p>
                  
                  {userContext && (
                    <Card className="max-w-md mx-auto mb-6">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {language === 'ar' ? 'معلوماتك' : 'Your Profile'}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{language === 'ar' ? `الاسم: ${userContext.userName}` : `Name: ${userContext.userName}`}</p>
                          <p>{language === 'ar' ? `المحادثات: ${userContext.conversationCount}` : `Conversations: ${userContext.conversationCount}`}</p>
                          {userContext.interests?.length > 0 && (
                            <p>{language === 'ar' ? `الاهتمامات: ${userContext.interests.join(', ')}` : `Interests: ${userContext.interests.join(', ')}`}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                    <Button
                      variant="outline"
                      className="p-4 h-auto text-left"
                      onClick={() => sendMessage(
                        language === 'ar' 
                          ? 'مرحباً، كيف يمكنك مساعدتي اليوم؟'
                          : 'Hello, how can you help me today?'
                      )}
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {language === 'ar' ? 'ابدأ محادثة' : 'Start chatting'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'تحدث معي' : 'Let\'s talk'}
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="p-4 h-auto text-left"
                      onClick={() => sendMessage(
                        language === 'ar' 
                          ? 'أنشئ لي صورة لقط جميل'
                          : 'Generate an image of a beautiful cat'
                      )}
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {language === 'ar' ? 'إنشاء صورة' : 'Generate Image'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'بالذكاء الاصطناعي' : 'AI-powered'}
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Enhanced Input Area */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={
                      language === 'ar' 
                        ? 'اكتب رسالتك هنا... أو استخدم الميكروفون'
                        : 'Type your message here... or use the microphone'
                    }
                    disabled={isLoading}
                    className="pr-12"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                  className={cn(
                    "transition-colors",
                    isRecording && "bg-red-500 text-white hover:bg-red-600"
                  )}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  onClick={() => sendMessage()}
                  disabled={!message.trim() || isLoading}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                {language === 'ar' 
                  ? 'مدعوم بالذكاء الاصطناعي المطور من TMW'
                  : 'Powered by Enhanced AI from TMW'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
