
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { toast } from 'sonner';
import { MessageCircle, User, Mail, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface SimpleCommentsProps {
  taskId: string;
  visitorName: string;
  responses: TRSharedResponse[];
}

export const SimpleComments: React.FC<SimpleCommentsProps> = ({
  taskId,
  visitorName,
  responses
}) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      await TRSharedService.addComment(taskId, visitorName, comment.trim());
      setComment('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !replyingTo) return;

    setSubmitting(true);
    try {
      await TRSharedService.addComment(taskId, visitorName, `Reply: ${replyContent.trim()}`);
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply sent');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Filter and sort comments by newest first
  const comments = responses
    .filter(r => r.response_type === 'comment')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <span className="font-medium">Comments ({comments.length})</span>
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="resize-none"
        />
        <Button 
          type="submit" 
          disabled={!comment.trim() || submitting}
          size="sm"
        >
          {submitting ? 'Adding...' : 'Add Comment'}
        </Button>
      </form>

      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-3 max-h-[350px] overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-muted/50 rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{getInitials(comment.visitor_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{comment.visitor_name}</span>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {format(parseISO(comment.created_at), 'MMM dd, HH:mm')}
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setReplyingTo(comment.id === replyingTo ? null : comment.id)}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              </div>

              <div className="bg-background/50 p-2 rounded border">
                <p className="text-sm break-words">{comment.content}</p>
              </div>

              {replyingTo === comment.id && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write your reply..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={!replyContent.trim() || submitting}
                    >
                      {submitting ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No comments message */}
      {comments.length === 0 && (
        <div className="text-center py-6 bg-muted/30 rounded-lg">
          <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No comments yet. Be the first to add one!</p>
        </div>
      )}
    </div>
  );
};
