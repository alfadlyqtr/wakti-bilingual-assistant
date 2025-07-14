import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Plus, Trash2, Calendar, FileText, Search, Image, Video, Bot, Zap, BookOpen, PenTool } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatDrawersProps {
  showConversations: boolean;
  setShowConversations: (show: boolean) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  conversations: any[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  fetchConversations: () => void;
  onSendMessage: (message: string, trigger: string) => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
  onNewConversation: () => void;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading: boolean;
  onOpenVideoDialog?: () => void;
}

export function ChatDrawers({
  showConversations,
  setShowConversations,
  showQuickActions,
  setShowQuickActions,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  fetchConversations,
  onSendMessage,
  activeTrigger,
  onTriggerChange,
  onTextGenerated,
  onNewConversation,
  onClearChat,
  sessionMessages,
  isLoading,
  onOpenVideoDialog
}: ChatDrawersProps) {
  const { language } = useTheme();

  const handleSelect = (id: string) => {
    onSelectConversation(id);
    setShowConversations(false);
  };

  const handleDelete = async (id: string) => {
    await onDeleteConversation(id);
    await fetchConversations();
  };

  const formatDate = (date: Date) => {
    const locale = language === 'ar' ? ar : undefined;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  // Quick Actions
  const quickActions = [
    {
      id: 'search',
      icon: Search,
      title: language === 'ar' ? 'بحث ذكي' : 'Smart Search',
      description: language === 'ar' ? 'ابحث في الإنترنت بذكاء' : 'Search the web intelligently',
      action: () => {
        onTriggerChange('search');
        setShowQuickActions(false);
      }
    },
    {
      id: 'image',
      icon: Image,
      title: language === 'ar' ? 'إنشاء صورة' : 'Create Image',
      description: language === 'ar' ? 'أنشئ صوراً مذهلة بالذكاء الاصطناعي' : 'Generate amazing AI images',
      action: () => {
        onTriggerChange('image');
        setShowQuickActions(false);
      }
    },
    {
      id: 'video',
      icon: Video,
      title: language === 'ar' ? 'إنشاء فيديو' : 'Create Video',
      description: language === 'ar' ? 'حول صورة إلى فيديو متحرك' : 'Turn image into animated video',
      action: () => {
        if (onOpenVideoDialog) {
          onOpenVideoDialog();
        }
        setShowQuickActions(false);
      }
    },
    {
      id: 'compose',
      icon: PenTool,
      title: language === 'ar' ? 'كتابة نص' : 'Text Generation',
      description: language === 'ar' ? 'اكتب نصوص إبداعية ومهنية' : 'Generate creative and professional text',
      action: () => {
        // Add text generation logic here
        setShowQuickActions(false);
      }
    },
    {
      id: 'tutor',
      icon: BookOpen,
      title: language === 'ar' ? 'مدرس شخصي' : 'AI Tutor',
      description: language === 'ar' ? 'تعلم أي موضوع مع مدرس ذكي' : 'Learn anything with an AI tutor',
      action: () => {
        onSendMessage(language === 'ar' ? 'أريد أن أتعلم موضوعاً جديداً' : 'I want to learn something new', 'chat');
        setShowQuickActions(false);
      }
    }
  ];

  return (
    <>
      {/* Conversations Drawer */}
      <Drawer open={showConversations} onOpenChange={setShowConversations}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {language === 'ar' ? '💬 المحادثات' : '💬 Conversations'}
            </DrawerTitle>
          </DrawerHeader>
          
          <ScrollArea className="flex-1 px-4 pb-4">
            <Button onClick={onNewConversation} variant="outline" className="w-full justify-start mb-3">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'محادثة جديدة' : 'New Conversation'}
            </Button>
            
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm">
                {language === 'ar' ? 'لا توجد محادثات' : 'No conversations'}
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className="relative">
                    <Button
                      onClick={() => handleSelect(conversation.id)}
                      variant="ghost"
                      className={`w-full justify-start rounded-md hover:bg-accent hover:text-accent-foreground ${currentConversationId === conversation.id ? 'bg-accent text-accent-foreground' : ''}`}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      <span className="truncate">{conversation.title || 'Untitled'}</span>
                    </Button>
                    <Button
                      onClick={() => handleDelete(conversation.id)}
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{language === 'ar' ? 'حذف' : 'Delete'}</span>
                    </Button>
                    <div className="absolute bottom-1 right-2 text-xs text-muted-foreground">{formatDate(new Date(conversation.updated_at))}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Quick Actions Drawer */}
      <Drawer open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {language === 'ar' ? '⚡ الإجراءات السريعة' : '⚡ Quick Actions'}
            </DrawerTitle>
          </DrawerHeader>
          
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  onClick={action.action}
                  variant="ghost"
                  className="h-auto p-4 flex items-start gap-3 text-left justify-start"
                  disabled={isLoading}
                >
                  <action.icon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{action.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{action.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
