
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TRTask } from '@/services/trService';
import { TRSharedAccessExtended, TRSharedService, TRVisitorCompletion } from '@/services/trSharedService';
import { Users, UserCheck, Copy, ExternalLink, CheckCircle, Circle, ChevronDown, ChevronUp, List } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRSubtask } from '@/services/trService';

interface SharedTaskCardProps {
  task: TRTask;
  assignees: TRSharedAccessExtended[];
  onTaskUpdated: () => void;
}

export const SharedTaskCard: React.FC<SharedTaskCardProps> = ({
  task,
  assignees,
  onTaskUpdated
}) => {
  const { language } = useTheme();
  const [completions, setCompletions] = useState<TRVisitorCompletion[]>([]);
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, [task.id]);

  const loadData = async () => {
    try {
      const [completionsData, subtasksData] = await Promise.all([
        TRSharedService.getVisitorCompletions(task.id),
        TRService.getSubtasks(task.id)
      ]);
      setCompletions(completionsData);
      setSubtasks(subtasksData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (task.share_link) {
      const shareUrl = `${window.location.origin}/shared-task/${task.share_link}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('linkCopied', language));
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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const taskCompletions = completions.filter(c => c.completion_type === 'task' && c.is_completed);
  const uniqueCompletionNames = [...new Set(taskCompletions.map(c => c.visitor_name))];

  // Calculate subtask completion statistics
  const getSubtaskCompletionStats = () => {
    if (subtasks.length === 0) return { completed: 0, total: 0 };
    
    let completedSubtasks = 0;
    subtasks.forEach(subtask => {
      const hasCompletion = completions.some(
        c => c.subtask_id === subtask.id && c.completion_type === 'subtask' && c.is_completed
      );
      if (hasCompletion) completedSubtasks++;
    });
    
    return { completed: completedSubtasks, total: subtasks.length };
  };

  const subtaskStats = getSubtaskCompletionStats();

  // Deduplicate assignees by name and get the most recent access time for each
  const uniqueAssignees = assignees.reduce((acc, assignee) => {
    const name = assignee.viewer_name || 'Anonymous';
    const existing = acc.find(a => a.viewer_name === name);
    
    if (!existing) {
      acc.push(assignee);
    } else {
      // Keep the one with the most recent last_accessed time
      if (new Date(assignee.last_accessed) > new Date(existing.last_accessed)) {
        const index = acc.indexOf(existing);
        acc[index] = assignee;
      }
    }
    
    return acc;
  }, [] as TRSharedAccessExtended[]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Task Header - Always Visible */}
        <div 
          className="flex items-start justify-between gap-2 cursor-pointer"
          onClick={toggleExpanded}
        >
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{task.title}</h4>
            <p className="text-sm text-muted-foreground">
              Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
              {task.due_time && ` at ${task.due_time}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {uniqueAssignees.length > 0 ? (
              <Badge variant="secondary" className="text-xs">
                <UserCheck className="h-3 w-3 mr-1" />
                {uniqueAssignees.length} {language === 'ar' ? 'مكلف' : 'assignee'}{uniqueAssignees.length > 1 ? (language === 'ar' ? 'ين' : 's') : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {language === 'ar' ? 'لا يوجد مكلفون' : 'No assignees'}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Collapsible Content */}
        {isExpanded && (
          <>
            {/* Activity Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('completedBy', language)}:</span>
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
                <span className="text-muted-foreground">{t('status', language)}:</span>
                <span className={`font-medium ${task.completed ? 'text-green-600' : ''}`}>
                  {task.completed ? t('completed', language) : t('pending', language)}
                </span>
              </div>
            </div>

            {/* Subtask Progress */}
            {subtasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}:
                  </span>
                  <Badge variant={subtaskStats.completed === subtaskStats.total ? "default" : "secondary"} className="text-xs">
                    {subtaskStats.completed}/{subtaskStats.total} {language === 'ar' ? 'مكتملة' : 'completed'}
                  </Badge>
                </div>
                
                {/* Individual Subtask Status */}
                <div className="space-y-1 ml-6">
                  {subtasks.map(subtask => {
                    const completedByNames = completions
                      .filter(c => c.subtask_id === subtask.id && c.completion_type === 'subtask' && c.is_completed)
                      .map(c => c.visitor_name);
                    
                    return (
                      <div key={subtask.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {completedByNames.length > 0 ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Circle className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className={completedByNames.length > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                            {subtask.title}
                          </span>
                        </div>
                        {completedByNames.length > 0 && (
                          <span className="text-green-600 text-xs">
                            ✓ {completedByNames.join(', ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assignee Completions */}
            {uniqueCompletionNames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t('completedBy', language)} {language === 'ar' ? 'المكلفين' : 'assignees'}:</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueCompletionNames.map(name => (
                    <Badge key={name} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Current Assignees */}
            {uniqueAssignees.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('assignedTo', language)}:</p>
                <div className="space-y-1">
                  {uniqueAssignees.map(assignee => (
                    <div key={assignee.id} className="flex items-center justify-between bg-secondary/20 rounded-md p-2">
                      <span className="text-sm font-medium">
                        {assignee.viewer_name || 'Anonymous'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(assignee.last_accessed), 'MMM dd, HH:mm')}
                      </span>
                    </div>
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
                {t('copyLink', language)}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOpenSharedTask}
                className="flex-1"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {t('view', language)}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
