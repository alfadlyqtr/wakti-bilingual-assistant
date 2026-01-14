import React, { useState } from 'react';
import { 
  MessageSquare, Search, Check, X, Trash2, Flag, Reply, Send,
  MoreHorizontal, RefreshCw, Eye, AlertTriangle, ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Note: Comments are stored with metadata in the existing fields. 
// status and is_flagged are tracked via the data stored in existing columns.

interface BackendCommentsTabProps {
  comments: any[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

export function BackendCommentsTab({ comments, projectId, isRTL, onRefresh }: BackendCommentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedComment, setSelectedComment] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const t = (en: string, ar: string) => isRTL ? ar : en;

  // Filter comments
  const filteredComments = comments.filter(comment => {
    const matchesSearch = searchQuery === '' || 
      comment.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.author_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || comment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats - using simple presence checks since status/is_flagged may not exist
  const pendingComments = 0; // Comments don't have status field in current schema
  const approvedComments = comments.length;
  const flaggedComments = 0;

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
      toast.success(t('Comment deleted', 'تم حذف التعليق'));
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to delete comment', 'فشل حذف التعليق'));
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedComment) return;
    
    setSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('project_comments')
        .insert([{
          project_id: projectId,
          site_user_id: user.user?.id,
          item_type: selectedComment.item_type,
          item_id: selectedComment.item_id,
          parent_id: selectedComment.id,
          author_name: 'Owner',
          content: replyText.trim()
        }]);
      
      if (error) throw error;
      
      toast.success(t('Reply sent', 'تم إرسال الرد'));
      setReplyText('');
      setSelectedComment(null);
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to send reply', 'فشل إرسال الرد'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-500" />
          {t('Comment Moderation', 'إدارة التعليقات')}
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">{t('Pending', 'قيد الانتظار')}</span>
          </div>
          <p className="text-lg font-bold text-amber-500">{pendingComments}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <ThumbsUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{t('Approved', 'مقبول')}</span>
          </div>
          <p className="text-lg font-bold text-emerald-500">{approvedComments}</p>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Flag className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">{t('Flagged', 'مميز')}</span>
          </div>
          <p className="text-lg font-bold text-red-500">{flaggedComments}</p>
        </div>
      </div>

      {/* Note: Bulk actions removed since status field not in current DB schema */}

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('Search comments...', 'بحث في التعليقات...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All', 'الكل')}</SelectItem>
            <SelectItem value="pending">{t('Pending', 'قيد الانتظار')}</SelectItem>
            <SelectItem value="approved">{t('Approved', 'مقبول')}</SelectItem>
            <SelectItem value="rejected">{t('Rejected', 'مرفوض')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comments List */}
      {filteredComments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-orange-500/10 mb-4">
            <MessageSquare className="h-10 w-10 text-orange-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Comments Yet', 'لا توجد تعليقات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('When users comment on your site content, they will appear here for moderation', 'عندما يعلق المستخدمون على محتوى موقعك، ستظهر هنا للمراجعة')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredComments.map((comment: any) => (
            <div 
              key={comment.id} 
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-orange-500">
                    {(comment.author_name || 'A')[0].toUpperCase()}
                  </span>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {comment.author_name || t('Anonymous', 'مجهول')}
                    </span>
                  </div>
                  
                  <p className="text-sm text-foreground mb-2">{comment.content}</p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t('on', 'على')} {comment.item_type}</span>
                    <span>•</span>
                    <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="gap-1 h-7"
                      onClick={() => setSelectedComment(comment)}
                    >
                      <Reply className="h-3.5 w-3.5" />
                      {t('Reply', 'رد')}
                    </Button>
                  </div>
                </div>
                
                {/* Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => handleDelete(comment.id)}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!selectedComment} onOpenChange={() => setSelectedComment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Reply to Comment', 'الرد على التعليق')}</DialogTitle>
          </DialogHeader>
          
          {selectedComment && (
            <div className="space-y-4">
              {/* Original Comment */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm font-medium mb-1">{selectedComment.author_name}</p>
                <p className="text-sm text-muted-foreground">{selectedComment.content}</p>
              </div>
              
              {/* Reply Input */}
              <div>
                <Textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('Write your reply...', 'اكتب ردك...')}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedComment(null)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1"
            >
              <Send className="h-4 w-4" />
              {t('Send Reply', 'إرسال الرد')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
