
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TRTask } from '@/services/trService';
import { TRSharedAccessExtended, TRSharedService, TRVisitorCompletion } from '@/services/trSharedService';
import { Users, Eye, Copy, ExternalLink, CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SharedTaskCardProps {
  task: TRTask;
  visitors: TRSharedAccessExtended[];
  onTaskUpdated: () => void;
}

export const SharedTaskCard: React.FC<SharedTaskCardProps> = ({
  task,
  visitors,
  onTaskUpdated
}) => {
  const [completions, setCompletions] = useState<TRVisitorCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompletions();
  }, [task.id]);

  const loadCompletions = async () => {
    try {
      const completionsData = await TRSharedService.getVisitorCompletions(task.id);
      setCompletions(completionsData);
    } catch (error) {
      console.error('Error loading completions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (task.share_link) {
      const shareUrl = `${window.location.origin}/shared-task/${task.share_link}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleOpenSharedTask = () => {
    if (task.share_link) {
      const shareUrl = `${window.location.origin}/shared-task/${task.share_link}`;
      window.open(shareUrl, '_blank');
    }
  };

  const taskCompletions = completions.filter(c => c.completion_type === 'task' && c.is_completed);
  const uniqueCompletionNames = [...new Set(taskCompletions.map(c => c.visitor_name))];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Task Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{task.title}</h4>
            <p className="text-sm text-muted-foreground">
              Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
              {task.due_time && ` at ${task.due_time}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {visitors.length > 0 ? (
              <Badge variant="secondary" className="text-xs">
                <Eye className="h-3 w-3 mr-1" />
                {visitors.length} viewing
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                No visitors
              </Badge>
            )}
          </div>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Completed by:</span>
            <span className="font-medium">
              {uniqueCompletionNames.length > 0 ? uniqueCompletionNames.length : 0}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {task.completed ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${task.completed ? 'text-green-600' : ''}`}>
              {task.completed ? 'Complete' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Visitor Completions */}
        {uniqueCompletionNames.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Completed by visitors:</p>
            <div className="flex flex-wrap gap-1">
              {uniqueCompletionNames.map(name => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Current Visitors */}
        {visitors.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Currently viewing:</p>
            <div className="flex flex-wrap gap-1">
              {visitors.map(visitor => (
                <Badge key={visitor.id} variant="secondary" className="text-xs">
                  {visitor.viewer_name || 'Anonymous'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopyLink}
            className="flex-1"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Link
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenSharedTask}
            className="flex-1"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
