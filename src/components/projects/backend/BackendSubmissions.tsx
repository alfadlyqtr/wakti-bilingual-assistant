import React from 'react';
import { Mail, Eye, Trash2, Clock, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FormSubmission {
  id: string;
  form_name: string;
  data: Record<string, any>;
  status: string;
  created_at: string;
}

interface BackendSubmissionsProps {
  submissions: FormSubmission[];
  isRTL: boolean;
  onView: (submission: FormSubmission) => void;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}

export function BackendSubmissions({ submissions, isRTL, onView, onDelete, onMarkRead }: BackendSubmissionsProps) {
  if (submissions.length === 0) {
    return (
      <div className="p-8 text-center">
        <Mail className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'لا توجد رسائل بعد' : 'No submissions yet'}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {isRTL ? 'ستظهر هنا عند وصول رسائل جديدة' : 'Messages will appear here when received'}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50 dark:divide-white/10">
      {submissions.map((submission) => {
        const isUnread = submission.status === 'unread';
        const name = submission.data?.name || submission.data?.email || 'Anonymous';
        const message = submission.data?.message || JSON.stringify(submission.data).slice(0, 100);
        
        return (
          <div 
            key={submission.id}
            className={cn(
              "p-4 hover:bg-muted/30 dark:hover:bg-white/5 transition-colors cursor-pointer",
              isUnread && "bg-indigo-500/5"
            )}
            onClick={() => onView(submission)}
          >
            <div className={cn("flex items-start justify-between gap-4", isRTL && "flex-row-reverse")}>
              <div className={cn("flex items-start gap-3 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                <div className={cn(
                  "p-2 rounded-full shrink-0",
                  isUnread ? "bg-indigo-500/20" : "bg-muted/50"
                )}>
                  <User className={cn(
                    "h-4 w-4",
                    isUnread ? "text-indigo-500" : "text-muted-foreground"
                  )} />
                </div>
                
                <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-sm truncate",
                      isUnread ? "font-semibold text-foreground" : "text-foreground/80"
                    )}>
                      {name}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {message}
                  </p>
                  
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    {format(new Date(submission.created_at), 'MMM d, h:mm a')}
                    <span className="px-1.5 py-0.5 rounded bg-muted/50 dark:bg-white/10">
                      {submission.form_name}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {isUnread && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(submission.id);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(submission.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
