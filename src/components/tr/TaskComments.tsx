
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Reply, Send } from 'lucide-react';
import { TRSharedService, TRTaskComment } from '@/services/trSharedService';
import { format } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';

interface TaskCommentsProps {
  taskId: string;
  visitorName: string;
  sessionId: string;
}

export const TaskComments: React.FC<TaskCommentsProps> = ({
  taskId,
  visitorName,
  sessionId
}) => {
  const { language } = useTheme();
  const [comments, setComments] = useState<TRTaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
    
    // Set up real-time subscription for comments
    const channel = TRSharedService.subscribeToTaskComments(taskId, () => {
      loadComments();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const loadComments = async () => {
    try {
      const commentsData = await TRSharedService.getTaskComments(taskId);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await TRSharedService.addTaskComment(
        taskId,
        visitorName,
        sessionId,
        newComment.trim()
      );
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      await TRSharedService.addTaskComment(
        taskId,
        visitorName,
        sessionId,
        replyText.trim(),
        parentId
      );
      setReplyText('');
      setReplyTo(null);
      toast.success('Reply added');
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM dd, HH:mm');
  };

  const getReplies = (parentId: string) => {
    return comments.filter(comment => comment.parent_id === parentId);
  };

  const topLevelComments = comments.filter(comment => !comment.parent_id);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h3 className="font-medium">Comments ({comments.length})</h3>
      </div>

      {/* Add new comment */}
      <div className="space-y-3">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="resize-none"
        />
        <Button
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || submitting}
          size="sm"
          className="w-full sm:w-auto"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Adding...' : 'Add Comment'}
        </Button>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {topLevelComments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          topLevelComments.map((comment) => (
            <Card key={comment.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Comment header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {comment.commenter_name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(comment.created_at)}
                    </span>
                  </div>
                </div>

                {/* Comment content */}
                <p className="text-sm leading-relaxed">{comment.content}</p>

                {/* Reply button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className="text-xs h-8"
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>

                {/* Reply form */}
                {replyTo === comment.id && (
                  <div className="space-y-2 ml-4 border-l-2 border-muted pl-4">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyText.trim() || submitting}
                        size="sm"
                        className="text-xs"
                      >
                        Reply
                      </Button>
                      <Button
                        onClick={() => {
                          setReplyTo(null);
                          setReplyText('');
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {getReplies(comment.id).map((reply) => (
                  <div key={reply.id} className="ml-6 border-l-2 border-muted pl-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {reply.commenter_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(reply.created_at)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{reply.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
