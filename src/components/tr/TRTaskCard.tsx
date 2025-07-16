
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TRTask } from '@/services/trService';
import { Calendar, Clock, Share, CheckSquare, Square } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface TRTaskCardProps {
  task: TRTask;
  onTaskUpdated: () => void;
  viewMode: 'grid' | 'list';
}

export const TRTaskCard: React.FC<TRTaskCardProps> = ({
  task,
  onTaskUpdated,
  viewMode
}) => {
  const { language } = useTheme();

  const handleToggleComplete = async () => {
    // TODO: Implement task completion toggle
    console.log('Toggle task completion:', task.id);
    onTaskUpdated();
  };

  const handleShare = () => {
    // TODO: Implement task sharing
    console.log('Share task:', task.id);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className={`${viewMode === 'list' ? 'flex items-center' : ''}`}>
      <CardHeader className={`${viewMode === 'list' ? 'flex-1 pb-2' : 'pb-3'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base leading-tight break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </CardTitle>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)} text-white`}>
                {task.priority}
              </Badge>
              
              <Badge variant="outline" className="text-xs">
                {task.task_type === 'one-time' ? t('oneTime', language) : t('repeated', language)}
              </Badge>
              
              {task.is_shared && (
                <Badge variant="outline" className="text-xs">
                  {t('shared', language)}
                </Badge>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleComplete}
            className="shrink-0"
          >
            {task.completed ? (
              <CheckSquare className="h-4 w-4 text-green-600" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {task.due_date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Calendar className="w-4 h-4" />
            <span>
              {format(parseISO(task.due_date), 'MMM dd, yyyy')}
              {task.due_time && (
                <>
                  <Clock className="w-3 h-3 ml-2 inline" />
                  <span className="ml-1">{task.due_time}</span>
                </>
              )}
            </span>
          </div>
        )}
      </CardHeader>

      {viewMode === 'grid' && (
        <CardContent className="pt-0">
          {task.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex gap-2">
            {task.is_shared && (
              <Button
                onClick={handleShare}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                <Share className="h-4 w-4 mr-2" />
                {t('shareLink', language)}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
