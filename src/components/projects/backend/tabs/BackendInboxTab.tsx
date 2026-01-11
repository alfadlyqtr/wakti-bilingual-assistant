import React, { useState } from 'react';
import { Mail, MailOpen, Trash2, Eye, Calendar, User, FileText, Download, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface FormSubmission {
  id: string;
  form_name: string | null;
  data: Record<string, any>;
  status: string | null;
  created_at: string | null;
}

interface BackendInboxTabProps {
  submissions: FormSubmission[];
  isRTL: boolean;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}

export function BackendInboxTab({ submissions, isRTL, onDelete, onMarkRead }: BackendInboxTabProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const unreadCount = submissions.filter(s => s.status === 'unread').length;

  const filteredSubmissions = submissions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'unread') return s.status === 'unread';
    return s.status === 'read';
  });

  const getSubmitterName = (data: Record<string, any>) => {
    return data.name || data.full_name || data.firstName || data.email?.split('@')[0] || 'Anonymous';
  };

  const getSubmitterEmail = (data: Record<string, any>) => {
    return data.email || data.contact_email || null;
  };

  const getMessagePreview = (data: Record<string, any>) => {
    const message = data.message || data.content || data.body || data.description || '';
    return message.length > 80 ? message.substring(0, 80) + '...' : message;
  };

  const exportToCSV = () => {
    if (submissions.length === 0) return;
    
    const allKeys = new Set<string>();
    submissions.forEach(s => Object.keys(s.data).forEach(k => allKeys.add(k)));
    const headers = ['id', 'form_name', 'status', 'created_at', ...Array.from(allKeys)];
    
    const rows = submissions.map(s => 
      headers.map(h => {
        if (h === 'id') return s.id;
        if (h === 'form_name') return s.form_name || '';
        if (h === 'status') return s.status || '';
        if (h === 'created_at') return s.created_at || '';
        return JSON.stringify(s.data[h] || '');
      }).join(',')
    );
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    if (submission.status === 'unread') {
      onMarkRead(submission.id);
    }
  };

  return (
    <div className={cn("space-y-4", isRTL && "rtl")}>
      {/* Header with filters */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          {/* Filter Pills */}
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              filter === 'all' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {isRTL ? 'الكل' : 'All'} ({submissions.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              filter === 'unread' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {isRTL ? 'غير مقروء' : 'Unread'} ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              filter === 'read' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {isRTL ? 'مقروء' : 'Read'} ({submissions.length - unreadCount})
          </button>
        </div>

        {submissions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {isRTL ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        )}
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
            <Mail className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">
            {filter === 'all' 
              ? (isRTL ? 'لا توجد رسائل بعد' : 'No submissions yet')
              : filter === 'unread'
                ? (isRTL ? 'لا توجد رسائل غير مقروءة' : 'No unread submissions')
                : (isRTL ? 'لا توجد رسائل مقروءة' : 'No read submissions')
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubmissions.map((submission) => {
            const isUnread = submission.status === 'unread';
            const name = getSubmitterName(submission.data);
            const email = getSubmitterEmail(submission.data);
            const preview = getMessagePreview(submission.data);

            return (
              <div
                key={submission.id}
                className={cn(
                  "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer",
                  isUnread 
                    ? "bg-primary/5 border-primary/20 hover:border-primary/40" 
                    : "bg-card border-border/50 hover:border-border",
                  "hover:shadow-md"
                )}
                onClick={() => handleViewSubmission(submission)}
              >
                <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                  {/* Status Icon */}
                  <div className={cn(
                    "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                    isUnread 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {isUnread ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
                  </div>

                  {/* Content */}
                  <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                    <div className={cn("flex items-center gap-2 mb-1", isRTL && "flex-row-reverse")}>
                      <span className={cn(
                        "font-semibold text-sm",
                        isUnread ? "text-foreground" : "text-foreground/80"
                      )}>
                        {name}
                      </span>
                      {submission.form_name && (
                        <span className="px-2 py-0.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
                          {submission.form_name}
                        </span>
                      )}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    
                    {email && (
                      <p className="text-xs text-muted-foreground mb-1">{email}</p>
                    )}
                    
                    {preview && (
                      <p className={cn(
                        "text-sm line-clamp-2",
                        isUnread ? "text-foreground/80" : "text-muted-foreground"
                      )}>
                        {preview}
                      </p>
                    )}

                    <div className={cn("flex items-center gap-2 mt-2 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                      <Calendar className="h-3 w-3" />
                      {submission.created_at && format(new Date(submission.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={cn(
                    "shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                    isRTL && "flex-row-reverse"
                  )}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSubmission(submission);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
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
      )}

      {/* Submission Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg" title={selectedSubmission?.form_name || 'Submission Details'}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <FileText className="h-5 w-5 text-primary" />
              {selectedSubmission?.form_name || (isRTL ? 'تفاصيل الرسالة' : 'Submission Details')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-4 py-4">
              {/* Timestamp */}
              <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                <Calendar className="h-3.5 w-3.5" />
                {selectedSubmission.created_at && format(new Date(selectedSubmission.created_at), 'EEEE, MMMM d, yyyy h:mm a')}
              </div>

              {/* Data Fields */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {Object.entries(selectedSubmission.data).map(([key, value]) => (
                  <div key={key} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <div className={cn("mt-1 text-sm text-foreground whitespace-pre-wrap", isRTL && "text-right")}>
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button
              variant="outline"
              onClick={() => setSelectedSubmission(null)}
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
            {selectedSubmission && (
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(selectedSubmission.id);
                  setSelectedSubmission(null);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {isRTL ? 'حذف' : 'Delete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
