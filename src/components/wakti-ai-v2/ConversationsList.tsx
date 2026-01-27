
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Clock, Plus, RefreshCw, Trash, Eraser, CheckCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SavedConversationsService } from '@/services/SavedConversationsService';
import { toast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

interface ConversationsListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
  onClose?: () => void;
  onNewConversation?: () => void;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading?: boolean;
}

export function ConversationsList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRefresh,
  onClose,
  onNewConversation,
  onClearChat,
  sessionMessages,
  isLoading
}: ConversationsListProps) {
  const { language, toggleLanguage } = useTheme();
  const [isClearing, setIsClearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudConvos, setCloudConvos] = useState<Array<{ id: string; title: string; message_count: number; last_message_at: string }>>([]);

  // Limit to 5 conversations
  const limitedConversations = conversations.slice(0, 5);

  const handleSelectConversation = (id: string) => {
    console.log('🔍 CONVERSATIONS: User selecting conversation:', id);
    onSelectConversation(id);
    onClose?.();
  };

  const handleDeleteConversation = async (id: string) => {
    console.log('🔍 CONVERSATIONS: User deleting conversation:', id);
    try {
      await onDeleteConversation(id);
      onRefresh();
    } catch (error) {
      console.error('🔍 CONVERSATIONS: Error deleting conversation:', error);
    }
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const handleNewConversation = () => {
    console.log('🆕 CONVERSATIONS: User explicitly starting new conversation');
    onNewConversation?.();
    onClose?.();
  };

  const handleSaveConversation = async () => {
    try {
      if (sessionMessages.length === 0) return;
      setIsSaving(true);
      const id = await SavedConversationsService.saveCurrentConversation(sessionMessages, currentConversationId || undefined);
      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم حفظ المحادثة سحابيًا. يمكنك استعادتها على أي جهاز.' : 'Conversation saved to cloud. You can retrieve it on any device.'
      });
      try { await fetchCloudConvos(); } catch {}
    } catch (e: any) {
      console.error('💾 Save failed:', e);
      toast({
        title: language === 'ar' ? 'فشل الحفظ' : 'Save failed',
        description: e?.message || (language === 'ar' ? 'تعذر حفظ المحادثة.' : 'Could not save the conversation.'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearChat = () => {
    console.log('🧹 CONVERSATIONS: User clearing current chat');
    onClearChat();
    onClose?.();
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      // Delete all conversations one by one
      for (const conversation of limitedConversations) {
        await onDeleteConversation(conversation.id);
      }
      onRefresh();
      onClose?.();
    } catch (error) {
      console.error('🔍 CONVERSATIONS: Error clearing all conversations:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const fetchCloudConvos = async () => {
    try {
      const list = await SavedConversationsService.listSavedConversations();
      setCloudConvos(Array.isArray(list) ? list : []);
    } catch (e) {
      // silent; user might be offline or not authenticated yet
    }
  };

  useEffect(() => {
    fetchCloudConvos();
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return language === 'ar' ? 'الآن' : 'Now';
    } else if (diffInHours < 24) {
      return language === 'ar' ? `منذ ${diffInHours} ساعة` : `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return language === 'ar' ? `منذ ${diffInDays} يوم` : `${diffInDays}d ago`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {language === 'ar' ? 'المحادثات المحفوظة' : 'Saved Conversations'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full font-medium">
              {limitedConversations.length}/5
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="h-7 px-2 text-xs"
            >
              {language === 'ar' ? 'En' : 'ع'}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleNewConversation}
            className="flex-1 h-8 text-xs font-medium"
          >
            <Plus className="h-3 w-3 mr-1" />
            {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
          </Button>
          {/* Save Conversation to Cloud */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveConversation}
            disabled={isSaving || sessionMessages.length === 0}
            className="h-8 px-3 text-xs"
            title={language === 'ar' ? 'حفظ المحادثة سحابيًا' : 'Save conversation to cloud'}
          >
            <Save className="h-3 w-3 mr-1" />
            {language === 'ar' ? 'حفظ' : 'Save'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          {/* Clear Current Chat Button - Only show if there are active messages */}
          {sessionMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              className="h-8 px-3 text-xs text-orange-600 hover:text-orange-700"
              title={language === 'ar' ? 'مسح الدردشة الحالية' : 'Clear current chat'}
            >
              <Eraser className="h-3 w-3" />
            </Button>
          )}

          {limitedConversations.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                  disabled={isClearing}
                  title={language === 'ar' ? 'حذف جميع المحادثات' : 'Delete all conversations'}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'ar' ? 'حذف جميع المحادثات' : 'Clear All Conversations'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'ar' 
                      ? 'هل أنت متأكد من حذف جميع المحادثات المحفوظة؟ لا يمكن التراجع عن هذا الإجراء.'
                      : 'Are you sure you want to delete all saved conversations? This action cannot be undone.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {language === 'ar' ? 'حذف الكل' : 'Clear All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* ENHANCED: Persistence Info Card with User Control Information */}
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border">
          <div className="flex items-center gap-1 mb-2">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              {language === 'ar' ? 'استمرارية الدردشة' : 'Chat Persistence'}
            </span>
          </div>
          <div className="space-y-1 leading-relaxed">
            <p>
              {language === 'ar' 
                ? '• المحادثة الحالية تُحفظ تلقائياً وتستمر عند إعادة فتح التطبيق'
                : '• Current chat auto-saves and continues when you reopen the app'
              }
            </p>
            <p>
              {language === 'ar' 
                ? '• استخدم "محادثة جديدة" فقط لبدء محادثة منفصلة تماماً'
                : '• Use "New Chat" only to start a completely separate conversation'
              }
            </p>
            <p>
              {language === 'ar' 
                ? '• يتم حفظ آخر 5 محادثات لمدة 24 ساعة'
                : '• Last 5 conversations saved for 24 hours'
              }
            </p>
          </div>
        </div>
      </div>
      
      {/* Conversations List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {/* Cloud-saved conversations */}
          {cloudConvos.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">{language === 'ar' ? 'المحادثات المحفوظة سحابيًا' : 'Saved to Cloud'}</div>
              <div className="space-y-1">
                {cloudConvos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-md border gap-2 hover:bg-accent/50 cursor-pointer transition-colors">
                    <div 
                      className="min-w-0 flex-1"
                      onClick={async () => {
                        try {
                          console.log('☁️ Loading cloud conversation:', c.id);
                          const loaded = await SavedConversationsService.loadSavedConversation(c.id);
                          if (loaded && loaded.messages && Array.isArray(loaded.messages)) {
                            console.log('✅ Cloud conversation loaded:', loaded.messages.length, 'messages');
                            
                            // Save current conversation before switching
                            if (currentConversationId && sessionMessages.length > 0) {
                              const { EnhancedFrontendMemory } = await import('@/services/EnhancedFrontendMemory');
                              EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
                            }
                            
                            // Convert cloud messages to proper format with Date objects
                            const convertedMessages = loaded.messages.map((msg: any) => ({
                              ...msg,
                              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                            }));
                            
                            // Use the original cloud conversation ID to keep updates tied to the same record
                            const { EnhancedFrontendMemory } = await import('@/services/EnhancedFrontendMemory');
                            
                            // IMPORTANT: Archive it first so handleSelectConversation can find it
                            EnhancedFrontendMemory.archiveCurrentConversation(convertedMessages, c.id);
                            
                            // Now use the existing handler to load it (it will find it in archived conversations)
                            onSelectConversation(c.id);
                            
                            // Close the drawer after selection
                            onClose?.();
                            
                            toast({
                              title: language === 'ar' ? 'تم التحميل ✓' : 'Loaded ✓',
                              description: language === 'ar' ? `تم تحميل ${loaded.messages.length} رسالة من السحابة` : `Loaded ${loaded.messages.length} messages from cloud`
                            });
                          } else {
                            toast({
                              title: language === 'ar' ? 'خطأ' : 'Error',
                              description: language === 'ar' ? 'لم يتم العثور على المحادثة' : 'Conversation not found',
                              variant: 'destructive'
                            });
                          }
                        } catch (err: any) {
                          console.error('❌ Failed to load cloud conversation:', err);
                          toast({
                            title: language === 'ar' ? 'فشل التحميل' : 'Load failed',
                            description: err?.message || (language === 'ar' ? 'تعذر تحميل المحادثة' : 'Could not load conversation'),
                            variant: 'destructive'
                          });
                        }
                      }}
                    >
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString(language === 'ar' ? 'ar' : 'en')}</div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="text-xs px-2 py-1 rounded-md border hover:bg-blue-50 text-blue-700 border-blue-200"
                        onClick={async () => {
                          const proposed = window.prompt(language === 'ar' ? 'أدخل اسماً جديداً' : 'Enter a new name', c.title) || '';
                          const newTitle = proposed.trim();
                          if (!newTitle || newTitle === c.title) return;
                          const prev = [...cloudConvos];
                          setCloudConvos(prev.map(cc => cc.id === c.id ? { ...cc, title: newTitle } : cc));
                          try {
                            await SavedConversationsService.updateTitle(c.id, newTitle);
                            toast({ title: language === 'ar' ? 'تمت إعادة التسمية' : 'Renamed' });
                          } catch (err) {
                            setCloudConvos(prev); // revert
                            toast({ title: language === 'ar' ? 'تعذر إعادة التسمية' : 'Rename failed', variant: 'destructive' });
                          }
                        }}
                        title={language === 'ar' ? 'إعادة تسمية' : 'Rename'}
                      >
                        {language === 'ar' ? 'إعادة تسمية' : 'Rename'}
                      </button>
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Cloud</div>
                      <button
                        className="text-xs px-2 py-1 rounded-md border hover:bg-red-50 text-red-700 border-red-200"
                        onClick={async () => {
                          const prev = [...cloudConvos];
                          setCloudConvos(prev.filter(cc => cc.id !== c.id));
                          try {
                            await SavedConversationsService.deleteSavedConversation(c.id);
                            toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
                          } catch (err) {
                            setCloudConvos(prev); // revert
                            toast({ title: language === 'ar' ? 'تعذر الحذف' : 'Delete failed', variant: 'destructive' });
                          }
                        }}
                        title={language === 'ar' ? 'حذف' : 'Delete'}
                      >
                        {language === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {limitedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group relative p-3 rounded-lg border cursor-pointer transition-all duration-200",
                "hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm",
                currentConversationId === conversation.id && "bg-primary/5 border-primary/50 shadow-sm ring-1 ring-primary/20"
              )}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {conversation.title}
                    </p>
                    {currentConversationId === conversation.id && (
                      <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />
                        {language === 'ar' ? 'نشط' : 'Active'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(conversation.last_message_at).toLocaleDateString(
                        language === 'ar' ? 'ar' : 'en',
                        { 
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }
                      )}
                    </span>
                    <span className="opacity-70">
                      • {formatRelativeTime(conversation.last_message_at)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conversation.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          
          {limitedConversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">
                {language === 'ar' ? 'لا توجد محادثات محفوظة بعد' : 'No saved conversations yet'}
              </p>
              <p className="text-xs opacity-70">
                {language === 'ar' ? 'ستُحفظ محادثاتك تلقائياً هنا' : 'Your conversations will be saved here automatically'}
              </p>
            </div>
          )}

          {conversations.length >= 5 && (
            <div className="text-center py-3 px-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {language === 'ar' 
                  ? '⚠️ وصلت للحد الأقصى (5 محادثات)'
                  : '⚠️ Maximum limit reached (5 conversations)'
                }
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {language === 'ar' 
                  ? 'المحادثات الجديدة ستحل محل الأقدم'
                  : 'New chats will replace oldest ones'
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
