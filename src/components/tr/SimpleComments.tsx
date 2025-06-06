
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { toast } from 'sonner';
import { MessageCircle, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

  // Filter and sort comments by newest first
  const comments = responses
    .filter(r => r.response_type === 'comment')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  console.log('All responses:', responses);
  console.log('Filtered comments:', comments);

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
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-3 w-3" />
                <span className="text-sm font-medium">{comment.visitor_name}</span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(comment.created_at), 'MMM dd, HH:mm')}
                </span>
              </div>
              <p className="text-sm break-words">{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* No comments message */}
      {comments.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No comments yet. Be the first to add one!
        </div>
      )}
    </div>
  );
};
