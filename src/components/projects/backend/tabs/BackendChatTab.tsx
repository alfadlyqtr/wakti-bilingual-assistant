import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Search, Users, Send, Eye, Trash2, MoreHorizontal,
  RefreshCw, Clock, User, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BackendChatTabProps {
  rooms: any[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

interface Message {
  id: string;
  content: string;
  role: string;
  created_at: string;
  sender_id?: string;
}

export function BackendChatTab({ rooms, projectId, isRTL, onRefresh }: BackendChatTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const t = (en: string, ar: string) => isRTL ? ar : en;

  // Filter rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = searchQuery === '' || 
      room.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const loadMessages = async (roomId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('project_chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages((data || []).map(m => ({
        id: m.id,
        content: m.content,
        role: m.role,
        created_at: m.created_at,
        sender_id: m.sender_id || undefined
      })));
    } catch (err) {
      toast.error(t('Failed to load messages', 'فشل تحميل الرسائل'));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleOpenRoom = (room: any) => {
    setSelectedRoom(room);
    loadMessages(room.id);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedRoom) return;
    
    setSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: projectId,
          room_id: selectedRoom.id,
          content: replyText.trim(),
          role: 'owner',
          sender_id: user.user?.id
        });
      
      if (error) throw error;
      
      setReplyText('');
      loadMessages(selectedRoom.id);
      
      // Update room's last message
      await supabase
        .from('project_chat_rooms')
        .update({ 
          updated_at: new Date().toISOString(),
          metadata: { 
            ...selectedRoom.metadata,
            last_message: replyText.trim().substring(0, 50)
          }
        })
        .eq('id', selectedRoom.id);
      
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to send message', 'فشل إرسال الرسالة'));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      // Delete messages first
      await supabase
        .from('project_chat_messages')
        .delete()
        .eq('room_id', roomId);
      
      // Then delete room
      await supabase
        .from('project_chat_rooms')
        .delete()
        .eq('id', roomId);
      
      toast.success(t('Chat deleted', 'تم حذف المحادثة'));
      setSelectedRoom(null);
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to delete chat', 'فشل حذف المحادثة'));
    }
  };

  // Stats
  const totalMessages = rooms.reduce((sum, r) => sum + (r.metadata?.message_count || 0), 0);
  const activeRooms = rooms.filter(r => {
    const lastUpdate = new Date(r.updated_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastUpdate > dayAgo;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-teal-500" />
          {t('Chat Management', 'إدارة المحادثات')}
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-4 w-4 text-teal-500" />
            <span className="text-xs text-muted-foreground">{t('Rooms', 'الغرف')}</span>
          </div>
          <p className="text-lg font-bold text-teal-500">{rooms.length}</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Send className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">{t('Messages', 'الرسائل')}</span>
          </div>
          <p className="text-lg font-bold text-blue-500">{totalMessages}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{t('Active', 'نشط')}</span>
          </div>
          <p className="text-lg font-bold text-emerald-500">{activeRooms}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder={t('Search chats...', 'بحث في المحادثات...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white/5 border-white/10"
        />
      </div>

      {/* Chat Rooms List */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-teal-500/10 mb-4">
            <MessageCircle className="h-10 w-10 text-teal-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Chat Rooms', 'لا توجد محادثات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('When users start conversations on your site, they will appear here', 'عندما يبدأ المستخدمون محادثات على موقعك، ستظهر هنا')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRooms.map((room: any) => (
            <div 
              key={room.id} 
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleOpenRoom(room)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-teal-500/20">
                  <User className="h-4 w-4 text-teal-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground truncate">
                      {room.name || t('Direct Chat', 'محادثة مباشرة')}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {new Date(room.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {room.metadata?.last_message || t('No messages yet', 'لا توجد رسائل')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-teal-500/20">
                  <User className="h-4 w-4 text-teal-500" />
                </div>
                <span>{selectedRoom?.name || t('Chat', 'محادثة')}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => handleDeleteRoom(selectedRoom?.id)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('Delete Chat', 'حذف المحادثة')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogTitle>
          </DialogHeader>
          
          {/* Messages */}
          <ScrollArea className="flex-1 py-4 min-h-[300px]">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t('No messages yet', 'لا توجد رسائل')}</p>
              </div>
            ) : (
              <div className="space-y-3 px-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "max-w-[80%] p-3 rounded-2xl",
                      msg.role === 'owner' 
                        ? "bg-teal-500 text-white ml-auto rounded-br-md"
                        : "bg-white/10 rounded-bl-md"
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      msg.role === 'owner' ? "text-teal-100" : "text-muted-foreground"
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {/* Reply Input */}
          <div className="border-t border-white/10 pt-3 flex gap-2">
            <Textarea 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('Type your reply...', 'اكتب ردك...')}
              className="min-h-[60px] bg-white/5 border-white/10 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
            />
            <Button 
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              className="bg-teal-500 hover:bg-teal-600 text-white self-end"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
