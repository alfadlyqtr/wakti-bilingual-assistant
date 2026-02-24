// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse, TRSharedAccess } from '@/services/trSharedService';
import { 
  Users, MessageCircle, CheckCircle, ExternalLink, Clock, 
  RefreshCw, Pause, AlertCircle, Mail, User, 
  Calendar, Check, X, EyeIcon, ChevronDown, ChevronRight,
  Link2, Hash, Copy, Loader2
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InAppSharedTaskViewer } from './InAppSharedTaskViewer';
import { supabase } from '@/integrations/supabase/client';

interface ActivityMonitorProps {
  tasks: TRTask[];
  onTasksChanged: () => void;
  incomingShareLink?: string | null;
  taskCodes?: { [taskId: string]: string };
  onCopyLink?: (task: TRTask) => void;
  onGenerateCode?: (taskId: string) => void;
  generatingCode?: string | null;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({
  tasks,
  onTasksChanged,
  incomingShareLink = null,
  taskCodes = {},
  onCopyLink,
  onGenerateCode,
  generatingCode = null,
}) => {
  const { language } = useTheme();
  const [responses, setResponses] = useState<{ [taskId: string]: TRSharedResponse[] }>({});
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: TRSubtask[] }>({});
  const [visitors, setVisitors] = useState<{ [taskId: string]: TRSharedAccess[] }>({});
  const [joinRequests, setJoinRequests] = useState<{ [taskId: string]: { id: string; assignee_name: string; requested_at: string }[] }>({});
  const [approvedAssignees, setApprovedAssignees] = useState<{ [taskId: string]: { id: string; assignee_name: string; responded_at: string | null }[] }>({});
  const [taskPeople, setTaskPeople] = useState<{ [taskId: string]: { owner: { name: string; userId: string } | null; participants: { name: string; source: 'app' | 'link'; lastActivity: string | null }[] } }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  
  // Collapsible state for task cards — starts with ALL collapsed, user toggles persist
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(() =>
    new Set(tasks.filter(t => t.is_shared && t.share_link).map(t => t.id))
  );

  // Owner display name (fetched from profile)
  const [ownerName, setOwnerName] = useState<string>('You');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', user.id)
        .single();
      const fullName = [data?.first_name, data?.last_name].filter(Boolean).join(' ');
      const name = data?.display_name || fullName || user.email?.split('@')[0] || 'You';
      
      setOwnerName(name);
    });
  }, []);

  // In-app shared task viewer (for Wakti users opening a share link)
  const [activeShareLink, setActiveShareLink] = useState<string | null>(incomingShareLink);

  // Sync if incomingShareLink changes (e.g. URL param update)
  useEffect(() => {
    if (incomingShareLink) setActiveShareLink(incomingShareLink);
  }, [incomingShareLink]);
  
  const loadingRef = useRef(false);
  
  // Active view for each task
  const [activeViews, setActiveViews] = useState<{ [taskId: string]: string }>({});

  // Collapsed sections inside subtasks tab: { taskId: { pending: bool, completed: bool } }
  const [subtaskSections, setSubtaskSections] = useState<{ [taskId: string]: { pending: boolean; completed: boolean } }>({});
  const [approvalTabs, setApprovalTabs] = useState<{ [taskId: string]: 'pending' | 'handled' }>({});

  const toggleSubtaskSection = (taskId: string, section: 'pending' | 'completed') => {
    setSubtaskSections(prev => ({
      ...prev,
      [taskId]: {
        pending: prev[taskId]?.pending ?? true,
        completed: prev[taskId]?.completed ?? true,
        [section]: !(prev[taskId]?.[section] ?? true),
      }
    }));
  };

  // Memoize shared tasks to prevent unnecessary re-calculations
  const sharedTasks = useMemo(() => {
    const shared = tasks.filter(task => task.is_shared && task.share_link);
    return shared;
  }, [tasks]);

  // Parse snooze request status from content
  const parseSnoozeStatus = useCallback((content: string | undefined) => {
    if (!content) return null;
    try {
      const parsed = JSON.parse(content);
      return parsed.status;
    } catch {
      return null;
    }
  }, []);

  // Load all responses and subtasks for shared tasks
  const loadAllData = useCallback(async (isRefresh = false) => {
    // Prevent concurrent loading
    if (loadingRef.current) {
      return;
    }

    if (sharedTasks.length === 0) {
      setLoading(false);
      setResponses({});
      setSubtasks({});
      setVisitors({});
      return;
    }

    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allResponses: { [taskId: string]: TRSharedResponse[] } = {};
      const allSubtasks: { [taskId: string]: TRSubtask[] } = {};
      const allVisitors: { [taskId: string]: TRSharedAccess[] } = {};
      const allJoinRequests: { [taskId: string]: { id: string; assignee_name: string; requested_at: string }[] } = {};
      const allApprovedAssignees: { [taskId: string]: { id: string; assignee_name: string; responded_at: string | null }[] } = {};
      
      const taskIds = sharedTasks.map(t => t.id);
      const { data: assignmentData } = await supabase
        .from('tr_task_assignments')
        .select('id, task_id, assignee_name, requested_at, responded_at, status')
        .in('task_id', taskIds)
        .in('status', ['pending', 'approved']);
      ((assignmentData || []) as any[]).forEach((r: any) => {
        if (r.status === 'pending') {
          if (!allJoinRequests[r.task_id]) allJoinRequests[r.task_id] = [];
          allJoinRequests[r.task_id].push({ id: r.id, assignee_name: r.assignee_name, requested_at: r.requested_at });
        } else if (r.status === 'approved') {
          if (!allApprovedAssignees[r.task_id]) allApprovedAssignees[r.task_id] = [];
          allApprovedAssignees[r.task_id].push({ id: r.id, assignee_name: r.assignee_name, responded_at: r.responded_at });
        }
      });

      const allPeople: typeof taskPeople = {};
      for (const task of sharedTasks) {
        // Load all data in parallel for each task
        const [taskResponses, taskSubtasks, taskVisitors, people] = await Promise.all([
          TRSharedService.getTaskResponses(task.id),
          TRSharedService.getTaskSubtasks(task.id),
          TRSharedService.getTaskVisitors(task.id),
          TRSharedService.getTaskPeople(task.id),
        ]);
        
        allResponses[task.id] = taskResponses;
        allSubtasks[task.id] = taskSubtasks;
        allVisitors[task.id] = taskVisitors;
        allPeople[task.id] = people;
      }
      
      setResponses(allResponses);
      setSubtasks(allSubtasks);
      setVisitors(allVisitors);
      setJoinRequests(allJoinRequests);
      setApprovedAssignees(allApprovedAssignees);
      setTaskPeople(allPeople);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading activity data:', error);
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [sharedTasks]);

  // Initial load and real-time subscriptions
  useEffect(() => {
    loadAllData();
    
    // Set up real-time subscriptions if we have shared tasks
    if (sharedTasks.length === 0) {
      return;
    }

    const channels: any[] = [];
    
    sharedTasks.forEach(task => {
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, () => {
        // Add a small delay to ensure database changes are committed
        setTimeout(() => {
          loadAllData(true);
        }, 500);
      });
      channels.push(channel);
    });

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(() => {
      loadAllData(true);
    }, 30000);

    return () => {
      channels.forEach(channel => channel.unsubscribe());
      clearInterval(interval);
    };
  }, [sharedTasks.length, loadAllData]);

  // Set default active view for each task
  useEffect(() => {
    const initialViews: { [taskId: string]: string } = {};
    
    sharedTasks.forEach(task => {
      if (!activeViews[task.id]) {
        initialViews[task.id] = 'all';
      }
    });
    
    if (Object.keys(initialViews).length > 0) {
      setActiveViews(prev => ({...prev, ...initialViews}));
    }
  }, [sharedTasks, activeViews]);

  // Uncheck requests are informational only; owner manually unchecks from their task view.

  const getTaskStats = useCallback((taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const taskSubtaskList = subtasks[taskId] || [];
    const taskVisitors = visitors[taskId] || [];
    const taskJoinRequests = joinRequests[taskId] || [];
    
    // Get unique assignees
    const uniqueAssignees = [...new Set(taskResponses.map(r => r.visitor_name))];
    
    // Count completed subtasks based on owner truth from tr_subtasks
    const completedSubtasksCount = taskSubtaskList.filter(s => s.completed).length;
    
    // Count task completions (main task, not subtasks)
    const taskCompletions = taskResponses.filter(
      r => r.response_type === 'completion' && r.is_completed && !r.subtask_id
    );
    
    // Count comments and requests
    const comments = taskResponses.filter(r => r.response_type === 'comment');
    const snoozeRequests = taskResponses.filter(r => r.response_type === 'snooze_request');
    const uncheckRequests = taskResponses.filter(r => r.response_type === 'uncheck_request');
    const completionRequests = taskResponses.filter(r => r.response_type === 'completion_request');
    
    const taskApprovedAssignees = approvedAssignees[taskId] || [];
    // Use unified people from getTaskPeople (single source of truth)
    const unifiedPeople = taskPeople[taskId];
    const allPeopleNames = unifiedPeople
      ? unifiedPeople.participants.map(p => p.name)
      : [...new Set([
          ...taskApprovedAssignees.map(a => a.assignee_name),
          ...uniqueAssignees,
        ])].filter(name => name !== ownerName && name !== 'Owner' && name !== 'Owner (You)');

    return {
      assignees: allPeopleNames,
      approvedAssigneesList: taskApprovedAssignees,
      unifiedPeople: unifiedPeople || null,
      completedSubtasksCount,
      taskCompletionsCount: taskCompletions.length,
      totalSubtasksCount: taskSubtaskList.length,
      comments: comments,
      snoozeRequests: snoozeRequests,
      uncheckRequests: uncheckRequests,
      completionRequests: completionRequests,
      joinRequests: taskJoinRequests,
      allResponses: taskResponses,
      subtasks: taskSubtaskList,
      visitors: taskVisitors
    };
  }, [responses, subtasks, visitors, joinRequests, approvedAssignees, taskPeople]);

  const formatRelativeTime = useCallback((dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  }, []);

  const getActivityIcon = useCallback((responseType: string) => {
    switch (responseType) {
      case 'completion':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-600" />;
      case 'snooze_request':
        return <Pause className="h-4 w-4 text-orange-600" />;
      case 'completion_request':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  }, []);

  const getActivityDescription = useCallback((activity: TRSharedResponse, taskSubtasks: TRSubtask[]) => {
    // Find subtask title if this is a subtask completion
    let subtaskTitle = '';
    if (activity.subtask_id) {
      const subtask = taskSubtasks.find(s => s.id === activity.subtask_id);
      subtaskTitle = subtask ? subtask.title : 'a subtask';
    }
    
    switch (activity.response_type) {
      case 'completion':
        if (activity.subtask_id) {
          return activity.is_completed 
            ? `completed subtask: "${subtaskTitle}"` 
            : `marked subtask as incomplete: "${subtaskTitle}"`;
        }
        return activity.is_completed ? 'marked main task as complete' : 'marked main task as incomplete';
      case 'comment':
        return `commented: "${activity.content?.substring(0, 50)}${activity.content && activity.content.length > 50 ? '...' : ''}"`;
      case 'snooze_request':
        return `requested snooze${activity.content ? `: "${activity.content.substring(0, 30)}..."` : ''}`;
      case 'completion_request':
        return 'requested to mark task as complete';
      default:
        return 'performed an action';
    }
  }, []);

  const openSharedTask = useCallback((shareLink: string) => {
    window.open(`/shared-task/${shareLink}`, '_blank');
  }, []);

  const copyShareLink = useCallback((shareLink: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared-task/${shareLink}`);
    toast.success(t('linkCopied', language));
  }, [language]);

  const handleReply = async (taskId: string) => {
    if (!replyContent.trim() || !replyingTo) {
      return;
    }

    try {
      await TRSharedService.addComment(taskId, ownerName, replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
      toast.success(t('reply', language) + ' sent');
      loadAllData(true);
    } catch (error) {
      console.error('Error replying to comment:', error);
      toast.error('Failed to send reply');
    }
  };

  const handleRefresh = () => {
    loadAllData(true);
  };

  const handleViewChange = (taskId: string, view: string) => {
    setActiveViews(prev => ({...prev, [taskId]: view}));
  };

  const handleSnoozeRequest = async (
    taskId: string, 
    requestId: string, 
    action: 'approved' | 'denied'
  ) => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(requestId));
    
    try {
      if (action === 'approved') {
        await TRSharedService.approveSnoozeRequest(requestId, taskId);
        toast.success('Snooze request approved - task has been snoozed until tomorrow', {
          duration: 4000,
          position: 'bottom-center'
        });
        onTasksChanged(); // Refresh task list to show snoozed status
      } else {
        await TRSharedService.denySnoozeRequest(requestId);
        toast.success('Snooze request denied', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
      
      // Force immediate refresh with a delay to ensure database changes are committed
      setTimeout(() => {
        loadAllData(true);
      }, 1000);
      
    } catch (error) {
      console.error(`Error ${action} snooze request:`, error);
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'deny'} snooze request`, {
        duration: 3000,
        position: 'bottom-center'
      });
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleCompletionRequest = async (
    taskId: string, 
    requestId: string, 
    visitorName: string,
    action: 'approved' | 'denied'
  ) => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(requestId));
    
    try {
      if (action === 'approved') {
        await TRSharedService.approveCompletionRequest(requestId, taskId, visitorName);
        toast.success(`Task marked as completed by ${visitorName}`, {
          duration: 4000,
          position: 'bottom-center'
        });
        onTasksChanged(); // Refresh task list to show completed status
      } else {
        await TRSharedService.denyCompletionRequest(requestId);
        toast.success('Completion request denied', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
      
      // Force immediate refresh with a delay to ensure database changes are committed
      setTimeout(() => {
        loadAllData(true);
      }, 1000);
      
    } catch (error) {
      console.error(`Error ${action} completion request:`, error);
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'deny'} completion request`, {
        duration: 3000,
        position: 'bottom-center'
      });
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleJoinRequest = async (requestId: string, action: 'approved' | 'denied') => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    try {
      await supabase
        .from('tr_task_assignments')
        .update({ status: action, responded_at: new Date().toISOString() })
        .eq('id', requestId);
      toast.success(action === 'approved'
        ? (language === 'ar' ? 'تم قبول الطلب' : 'Join request approved')
        : (language === 'ar' ? 'تم رفض الطلب' : 'Join request denied'),
        { duration: 3000, position: 'bottom-center' }
      );
      setTimeout(() => loadAllData(true), 500);
    } catch (error) {
      console.error('Error handling join request:', error);
      toast.error('Failed to process join request');
    } finally {
      setProcessingRequests(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  // Toggle subtask completion when pressed - instant optimistic update
  const handleSubtaskToggle = async (taskId: string, subtaskId: string, currentCompleted: boolean) => {
    // Optimistic update - toggle local state immediately
    setSubtasks(prev => ({
      ...prev,
      [taskId]: prev[taskId]?.map(s => 
        s.id === subtaskId ? { ...s, completed: !currentCompleted } : s
      ) || []
    }));
    
    // Fire API call in background - no loading states, no refresh
    try {
      await TRSharedService.markSubtaskCompleted(taskId, subtaskId, ownerName, !currentCompleted);
      // Silently succeed - UI already updated
    } catch (error) {
      // Revert on failure
      setSubtasks(prev => ({
        ...prev,
        [taskId]: prev[taskId]?.map(s => 
          s.id === subtaskId ? { ...s, completed: currentCompleted } : s
        ) || []
      }));
      toast.error(language === 'ar' ? 'فشل التحديث' : 'Update failed', { duration: 2000 });
    }
  };

  // Mark all pending subtasks as completed at once
  const handleMarkAllDone = async (taskId: string, pendingSubtasks: TRSubtask[]) => {
    if (pendingSubtasks.length === 0) return;
    
    // Optimistic update - mark all as completed immediately
    setSubtasks(prev => ({
      ...prev,
      [taskId]: prev[taskId]?.map(s => 
        pendingSubtasks.some(p => p.id === s.id) ? { ...s, completed: true } : s
      ) || []
    }));
    
    // Fire API calls in background
    try {
      await Promise.all(
        pendingSubtasks.map(subtask => 
          TRSharedService.markSubtaskCompleted(taskId, subtask.id, ownerName, true)
        )
      );
      toast.success(
        language === 'ar' ? `تم إنجاز ${pendingSubtasks.length} مهام فرعية` : `${pendingSubtasks.length} subtasks marked done`,
        { duration: 2000 }
      );
    } catch (error) {
      // Revert on failure
      setSubtasks(prev => ({
        ...prev,
        [taskId]: prev[taskId]?.map(s => 
          pendingSubtasks.some(p => p.id === s.id) ? { ...s, completed: false } : s
        ) || []
      }));
      toast.error(language === 'ar' ? 'فشل تحديث بعض المهام' : 'Failed to update some subtasks', { duration: 2000 });
    }
  };

  // Assignee requests task completion (requires owner approval)
  const handleRequestTaskCompletion = async (taskId: string) => {
    try {
      await TRSharedService.requestTaskCompletion(taskId, ownerName);
      toast.success(
        language === 'ar' ? 'تم إرسال طلب إكمال المهمة للمالك' : 'Completion request sent to owner',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Error requesting task completion:', error);
      toast.error(language === 'ar' ? 'فشل إرسال الطلب' : 'Failed to send request', { duration: 2000 });
    }
  };

  // Owner marks main task as completed directly (no approval needed)
  const handleMarkTaskCompleted = async (taskId: string) => {
    try {
      await TRSharedService.markTaskCompleted(taskId, ownerName, true);
      toast.success(
        language === 'ar' ? 'تم إكمال المهمة بنجاح' : 'Task marked as completed',
        { duration: 3000 }
      );
      onTasksChanged?.();
    } catch (error) {
      console.error('Error marking task completed:', error);
      toast.error(language === 'ar' ? 'فشل تحديث المهمة' : 'Failed to update task', { duration: 2000 });
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

  // Render snooze request status badge
  const renderSnoozeRequestStatus = (request: TRSharedResponse) => {
    const status = parseSnoozeStatus(request.content);
    const isProcessing = processingRequests.has(request.id);
    
    if (isProcessing) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          {t('processing', language)}...
        </Badge>
      );
    }
    
    if (status === 'approved') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          {t('approved', language)}
        </Badge>
      );
    }
    
    if (status === 'denied') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
          {t('denied', language)}
        </Badge>
      );
    }
    
    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={() => handleSnoozeRequest(request.task_id, request.id, 'approved')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <Check className="h-3 w-3 mr-1" />
          {t('approve', language)}
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleSnoozeRequest(request.task_id, request.id, 'denied')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <X className="h-3 w-3 mr-1" />
          {t('deny', language)}
        </Button>
      </div>
    );
  };

  // Render completion request status badge
  const renderCompletionRequestStatus = (request: TRSharedResponse) => {
    const status = parseSnoozeStatus(request.content); // reuse same parser
    const isProcessing = processingRequests.has(request.id);
    
    if (isProcessing) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          {t('processing', language)}...
        </Badge>
      );
    }
    
    if (status === 'approved') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          {t('approved', language)}
        </Badge>
      );
    }
    
    if (status === 'denied') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
          {t('denied', language)}
        </Badge>
      );
    }
    
    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={() => handleCompletionRequest(request.task_id, request.id, request.visitor_name, 'approved')}
          className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
          disabled={isProcessing}
        >
          <Check className="h-3 w-3 mr-1" />
          Approve & Complete
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleCompletionRequest(request.task_id, request.id, request.visitor_name, 'denied')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <X className="h-3 w-3 mr-1" />
          {t('deny', language)}
        </Button>
      </div>
    );
  };

  const toggleCardCollapse = useCallback((taskId: string) => {
    setCollapsedCards(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(taskId)) {
        newCollapsed.delete(taskId);
      } else {
        newCollapsed.add(taskId);
      }
      return newCollapsed;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200/40 dark:border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/60">{t('loading', language)}</p>
      </div>
    );
  }

  if (sharedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10
          flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
          <Users className="h-9 w-9 text-indigo-400 dark:text-indigo-500" />
        </div>
        <p className="text-base font-bold text-foreground mb-2">{t('noSharedTasks', language)}</p>
        <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">{t('shareTaskToStartMonitoring', language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── In-app shared task viewer (Wakti users opening a share link) ── */}
      {activeShareLink && (
        <InAppSharedTaskViewer
          shareLink={activeShareLink}
          onDismiss={() => setActiveShareLink(null)}
        />
      )}

      {/* Header with refresh */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] font-medium text-muted-foreground/60">
          {t('lastUpdated', language)}: {formatRelativeTime(lastUpdate.toISOString())}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold
            bg-indigo-100 dark:bg-indigo-500/20
            text-indigo-600 dark:text-indigo-400
            hover:bg-indigo-200 dark:hover:bg-indigo-500/30
            disabled:opacity-50 transition-all touch-manipulation active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? `${t('refreshing', language)}...` : t('refresh', language)}
        </button>
      </div>

      {/* Dialog for assignee details */}
      <Dialog open={!!selectedVisitor} onOpenChange={() => setSelectedVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('assigneeDetails', language)}</DialogTitle>
            <DialogDescription>
              {t('activityInformation', language)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedVisitor && sharedTasks.map(task => {
              const stats = getTaskStats(task.id);
              // Find activities for this visitor
              const visitorActivities = stats.allResponses.filter(r => 
                r.visitor_name === selectedVisitor
              );
              // Find visitor access info
              const visitorInfo = stats.visitors.find(v => v.viewer_name === selectedVisitor);
              
              if (!visitorActivities.length && !visitorInfo) return null;
              
              return (
                <Card key={`visitor-${task.id}`} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <Avatar>
                        <AvatarFallback>{getInitials(selectedVisitor)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{selectedVisitor}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {visitorInfo ? `${t('lastSeen', language)} ${formatRelativeTime(visitorInfo.last_accessed)}` : t('noAccessData', language)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'completion' && a.is_completed).length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('completions', language)}</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'comment').length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('comments', language)}</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'snooze_request').length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('requests', language)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{t('recentActivity', language)}</h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {visitorActivities.slice(0, 10).map(activity => (
                            <div key={activity.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-2">
                              {getActivityIcon(activity.response_type)}
                              <div>
                                <div className="text-xs text-muted-foreground">
                                  {formatRelativeTime(activity.created_at)}
                                </div>
                                <p className="text-xs mt-1">
                                  {getActivityDescription(activity, stats.subtasks)}
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {visitorActivities.length === 0 && (
                            <div className="text-center py-2 text-muted-foreground text-xs">
                              {t('noActivityRecorded', language)}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {sharedTasks.map((task) => {
        const stats = getTaskStats(task.id);
        const activeView = activeViews[task.id] || 'assignees';
        const isCollapsed = collapsedCards.has(task.id);
        
        // Deduplicate completion requests by visitor_name for the count
        const uniquePendingCompletionRequests = stats.completionRequests.filter(r => {
          const status = parseSnoozeStatus(r.content);
          return status !== 'approved' && status !== 'denied';
        }).reduce((acc, curr) => {
          if (!acc.find(r => r.visitor_name === curr.visitor_name)) {
            acc.push(curr);
          }
          return acc;
        }, [] as typeof stats.completionRequests);

        const pendingCount = uniquePendingCompletionRequests.length
          + stats.snoozeRequests.filter(r => !parseSnoozeStatus(r.content)).length
          + stats.uncheckRequests.length
          + stats.joinRequests.length;
        const isOverdue = task.due_date && new Date(`${task.due_date}T${task.due_time || '23:59:59'}`) < new Date() && !task.completed;

        return (
          <Collapsible key={task.id} open={!isCollapsed} onOpenChange={() => toggleCardCollapse(task.id)}>
            <div className={`rounded-2xl overflow-hidden
              bg-white dark:bg-[#0f1318]
              border-2 ${pendingCount > 0 ? 'border-orange-300 dark:border-orange-500/40' : task.completed ? 'border-emerald-300 dark:border-emerald-500/30' : isOverdue ? 'border-red-300 dark:border-red-500/30' : 'border-slate-200 dark:border-white/[0.08]'}
              shadow-[0_4px_24px_hsla(0,0%,0%,0.08),0_1px_6px_hsla(0,0%,0%,0.05)]
              dark:shadow-[0_4px_24px_hsla(0,0%,0%,0.5),0_1px_6px_hsla(0,0%,0%,0.4)]
              transition-all duration-200`}>

              {/* ── Top action bar: code + link + generate ── */}
              {(onCopyLink || onGenerateCode) && (() => {
                const code = taskCodes[task.id] || (task as TRTask & { task_code?: string }).task_code;
                const isGen = generatingCode === task.id;
                return (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    {code ? (
                      /* Code exists: show pill + small refresh icon + link */
                      <>
                        <button
                          title="Copy code"
                          onClick={() => { navigator.clipboard.writeText(code); toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!'); }}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl
                            bg-[#060541]/8 dark:bg-blue-500/15
                            border border-[#060541]/20 dark:border-blue-400/30
                            text-[12px] font-black tracking-widest text-[#060541] dark:text-blue-300
                            hover:bg-[#060541]/12 dark:hover:bg-blue-500/25
                            shadow-[0_1px_3px_hsla(243,84%,14%,0.1)]
                            transition-all touch-manipulation active:scale-95">
                          {code}
                          <Copy className="h-3 w-3 opacity-50" />
                        </button>
                        <div className="flex-1" />
                        {onCopyLink && (
                          <button
                            title="Copy share link"
                            onClick={() => onCopyLink(task)}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl
                              bg-slate-100 dark:bg-white/[0.07]
                              border border-slate-200 dark:border-white/[0.1]
                              text-[11px] font-bold text-slate-600 dark:text-slate-300
                              hover:bg-slate-200 dark:hover:bg-white/[0.12]
                              shadow-[0_1px_3px_hsla(0,0%,0%,0.08)]
                              transition-all touch-manipulation active:scale-95">
                            <Link2 className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'رابط' : 'Link'}
                          </button>
                        )}
                      </>
                    ) : (
                      /* No code yet: show generate button */
                      <>
                        <span className="text-[11px] text-muted-foreground/40 italic flex-1">
                          {language === 'ar' ? 'لا يوجد كود بعد' : 'No code yet'}
                        </span>
                        {onCopyLink && (
                          <button
                            title="Copy share link"
                            onClick={() => onCopyLink(task)}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl
                              bg-slate-100 dark:bg-white/[0.07]
                              border border-slate-200 dark:border-white/[0.1]
                              text-[11px] font-bold text-slate-600 dark:text-slate-300
                              hover:bg-slate-200 dark:hover:bg-white/[0.12]
                              shadow-[0_1px_3px_hsla(0,0%,0%,0.08)]
                              transition-all touch-manipulation active:scale-95">
                            <Link2 className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'رابط' : 'Link'}
                          </button>
                        )}
                        {onGenerateCode && (
                          <button
                            title="Generate code"
                            onClick={() => onGenerateCode(task.id)}
                            disabled={!!isGen}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl
                              bg-[#060541] dark:bg-blue-600
                              text-[11px] font-bold text-white
                              hover:bg-[#060541]/85 dark:hover:bg-blue-500
                              shadow-[0_2px_8px_hsla(243,84%,14%,0.35)]
                              disabled:opacity-50 transition-all touch-manipulation active:scale-95">
                            {isGen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hash className="h-3.5 w-3.5" />}
                            {language === 'ar' ? 'كود' : 'Get Code'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── Card header (collapsible trigger) ── */}
              <CollapsibleTrigger asChild>
                <button className="w-full text-left px-4 py-3.5 flex items-center gap-3
                  hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors touch-manipulation">

                  {/* Status dot */}
                  <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full
                    ${task.completed
                      ? 'bg-emerald-400 shadow-[0_0_6px_hsla(142,76%,55%,0.5)]'
                      : 'bg-indigo-400 dark:bg-indigo-500 shadow-[0_0_6px_hsla(240,80%,60%,0.4)]'
                    }`} />

                  {/* Title + badges */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-foreground leading-tight truncate" dir="auto">
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {/* Shared badge */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        <Users className="h-2.5 w-2.5" />
                        {t('sharedTask', language)}
                      </span>
                      {/* Due date */}
                      {task.due_date && (() => {
                        return (
                          <>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                              bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                              <Clock className="h-2.5 w-2.5" />
                              {format(parseISO(task.due_date), 'MMM dd')} {task.due_time && `, ${task.due_time}`}
                            </span>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg
                                bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 uppercase tracking-wider">
                                {language === 'ar' ? 'متأخر' : 'Overdue'}
                              </span>
                            )}
                          </>
                        );
                      })()}
                      {/* Completion stamp */}
                      {task.completed && (() => {
                        const latest = stats.allResponses
                          .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        const who = latest?.visitor_name || 'Someone';
                        const when = latest?.created_at ? format(parseISO(latest.created_at), 'MMM dd, HH:mm') : '';
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                            bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-2.5 w-2.5" />
                            {who}{when ? ` · ${when}` : ''}
                          </span>
                        );
                      })()}
                      {/* Subtask progress */}
                      {stats.totalSubtasksCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                          bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                          <CheckCircle className="h-2.5 w-2.5" />
                          {stats.completedSubtasksCount}/{stats.totalSubtasksCount}
                        </span>
                      )}
                      {/* Assignees */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                        <Users className="h-2.5 w-2.5" />
                        {stats.assignees.length}
                      </span>
                      {/* Comments */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {stats.comments.length}
                      </span>
                      {/* Pending requests badge */}
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                          bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400
                          shadow-[0_0_8px_hsla(25,95%,55%,0.2)]">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {pendingCount} {t('pending', language)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                    bg-slate-100 dark:bg-white/[0.08]
                    border border-slate-200 dark:border-white/[0.08]
                    shadow-[0_1px_3px_hsla(0,0%,0%,0.08)]
                    transition-transform duration-200
                    ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-0">

                  {/* ── Per-card mini tab bar ── */}
                  <div className="flex items-stretch gap-1 px-3 py-2.5 border-t border-slate-100 dark:border-white/[0.06]">
                    {/* Approvals pill — always visible */}
                    <button onClick={() => handleViewChange(task.id, 'approvals')}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 py-1.5 rounded-xl text-[10px] font-bold
                        transition-all touch-manipulation active:scale-95
                        ${activeView === 'approvals'
                          ? 'bg-orange-500 text-white shadow-[0_2px_8px_hsla(25,95%,55%,0.4)]'
                          : 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15] text-slate-700 dark:text-slate-200 hover:border-slate-400 shadow-[0_1px_4px_hsla(0,0%,0%,0.1)]'}`}>
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="leading-tight text-center">{language === 'ar' ? 'موافقات' : 'Approve'}</span>
                      {pendingCount > 0 && (
                        <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                          ${activeView === 'approvals' ? 'bg-white/30 text-white' : 'bg-orange-500 text-white'}`}>
                          {pendingCount}
                        </span>
                      )}
                    </button>

                    {/* Main tabs as solid pills */}
                    {[
                      {
                        key: 'assignees',
                        icon: <Users className="h-3 w-3" />,
                        label: language === 'ar' ? 'المشاركون' : 'People',
                        badge: stats.assignees.length > 0 ? String(stats.assignees.length) : null,
                        activeBg: 'bg-[#060541] dark:bg-blue-600',
                        activeShadow: 'shadow-[0_2px_8px_hsla(243,84%,14%,0.4)]',
                        inactiveBg: 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15]',
                        inactiveText: 'text-slate-700 dark:text-slate-200',
                        badgeActive: 'bg-white/25 text-white',
                        badgeInactive: 'bg-slate-200 dark:bg-white/[0.2] text-slate-700 dark:text-slate-200',
                      },
                      ...(stats.totalSubtasksCount > 0 ? [{
                        key: 'subtasks',
                        icon: <CheckCircle className="h-3 w-3" />,
                        label: language === 'ar' ? 'المهام' : 'Tasks',
                        badge: `${stats.completedSubtasksCount}/${stats.totalSubtasksCount}`,
                        activeBg: 'bg-emerald-500 dark:bg-emerald-600',
                        activeShadow: 'shadow-[0_2px_8px_hsla(142,76%,45%,0.4)]',
                        inactiveBg: 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15]',
                        inactiveText: 'text-slate-700 dark:text-slate-200',
                        badgeActive: 'bg-white/25 text-white',
                        badgeInactive: 'bg-slate-200 dark:bg-white/[0.2] text-slate-700 dark:text-slate-200',
                      }] : []),
                      {
                        key: 'comments',
                        icon: <MessageCircle className="h-3 w-3" />,
                        label: language === 'ar' ? 'تعليقات' : 'Chat',
                        badge: stats.comments.length > 0 ? String(stats.comments.length) : null,
                        activeBg: 'bg-sky-500 dark:bg-sky-600',
                        activeShadow: 'shadow-[0_2px_8px_hsla(199,89%,48%,0.4)]',
                        inactiveBg: 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15]',
                        inactiveText: 'text-slate-700 dark:text-slate-200',
                        badgeActive: 'bg-white/25 text-white',
                        badgeInactive: 'bg-slate-200 dark:bg-white/[0.2] text-slate-700 dark:text-slate-200',
                      },
                      {
                        key: 'activity',
                        icon: <Clock className="h-3 w-3" />,
                        label: language === 'ar' ? 'النشاط' : 'Log',
                        badge: null,
                        activeBg: 'bg-slate-700 dark:bg-slate-500',
                        activeShadow: 'shadow-[0_2px_8px_hsla(0,0%,0%,0.3)]',
                        inactiveBg: 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15]',
                        inactiveText: 'text-slate-700 dark:text-slate-200',
                        badgeActive: 'bg-white/25 text-white',
                        badgeInactive: 'bg-slate-200 dark:bg-white/[0.2] text-slate-700 dark:text-slate-200',
                      },
                    ].map(tab => {
                      const isActive = activeView === tab.key;
                      return (
                        <button key={tab.key} onClick={() => handleViewChange(task.id, tab.key)}
                          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 py-1.5 rounded-xl text-[10px] font-bold
                            transition-all touch-manipulation active:scale-95
                            ${isActive
                              ? `${tab.activeBg} text-white ${tab.activeShadow}`
                              : `${tab.inactiveBg} ${tab.inactiveText} hover:border-slate-400 dark:hover:border-white/[0.25] shadow-[0_1px_4px_hsla(0,0%,0%,0.1)]`
                            }`}>
                          <span className="flex-shrink-0">{tab.icon}</span>
                          <span className="leading-tight text-center">{tab.label}</span>
                          {tab.badge && (
                            <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                              ${isActive ? tab.badgeActive : tab.badgeInactive}`}>
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-3 pb-4 px-1">

                    {/* ── APPROVALS tab ── */}
                    {activeView === 'approvals' && (() => {
                      const approvalTab = approvalTabs[task.id] || 'pending';
                      
                      const pendingRequests = {
                        join: stats.joinRequests,
                        completion: stats.completionRequests.filter(r => {
                          const status = parseSnoozeStatus(r.content);
                          return status !== 'approved' && status !== 'denied';
                        }),
                        snooze: stats.snoozeRequests.filter(r => !parseSnoozeStatus(r.content)),
                        uncheck: stats.uncheckRequests
                      };
                      
                      const handledRequests = {
                        join: [], // Handled join requests are in approvedAssignees or deleted if denied
                        completion: stats.completionRequests.filter(r => {
                          const status = parseSnoozeStatus(r.content);
                          return status === 'approved' || status === 'denied';
                        }),
                        snooze: stats.snoozeRequests.filter(r => parseSnoozeStatus(r.content)),
                        uncheck: [] // Uncheck requests are deleted when handled
                      };
                      
                      const hasPending = pendingCount > 0;
                      const hasHandled = handledRequests.completion.length > 0 || handledRequests.snooze.length > 0;
                      
                      return (
                      <div className="space-y-3 pt-1">
                        {/* Inner Tabs */}
                        <div className="flex gap-3 px-1">
                          <button onClick={() => setApprovalTabs(prev => ({ ...prev, [task.id]: 'pending' }))}
                            className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5
                              ${approvalTab === 'pending' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
                            <div className={`w-1 h-3 rounded-full ${approvalTab === 'pending' ? 'bg-orange-500' : 'bg-muted-foreground/20'}`} />
                            {language === 'ar' ? 'معلق' : 'Pending'} ({pendingCount})
                          </button>
                          <button onClick={() => setApprovalTabs(prev => ({ ...prev, [task.id]: 'handled' }))}
                            className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5
                              ${approvalTab === 'handled' ? 'text-slate-600 dark:text-slate-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
                            <div className={`w-1 h-3 rounded-full ${approvalTab === 'handled' ? 'bg-slate-500' : 'bg-muted-foreground/20'}`} />
                            {language === 'ar' ? 'تم الرد' : 'Handled'} ({handledRequests.completion.length + handledRequests.snooze.length})
                          </button>
                        </div>

                        {approvalTab === 'pending' && (
                          <>
                            {pendingCount === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.05]">
                                <CheckCircle className="h-8 w-8 text-emerald-400 mb-2 opacity-50" />
                                <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300 mb-1">{language === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending requests'}</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">{language === 'ar' ? 'أنت على اطلاع دائم بكل شيء' : 'You are all caught up'}</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* ── Join requests ── */}
                                {pendingRequests.join.map(jr => {
                                  const isProcessing = processingRequests.has(jr.id);
                                  return (
                                    <div key={jr.id} className="rounded-xl p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/30">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                                          {jr.assignee_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{jr.assignee_name}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(jr.requested_at), 'MMM dd, HH:mm')}</span>
                                      </div>
                                      <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mb-2">
                                        {language === 'ar' ? 'يريد الانضمام إلى هذه المهمة' : 'Wants to join this task'}
                                      </p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleJoinRequest(jr.id, 'approved')}
                                          disabled={isProcessing}
                                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold
                                            bg-emerald-500 hover:bg-emerald-600 text-white
                                            disabled:opacity-50 transition-all active:scale-95">
                                          {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          {language === 'ar' ? 'قبول' : 'Approve'}
                                        </button>
                                        <button
                                          onClick={() => handleJoinRequest(jr.id, 'denied')}
                                          disabled={isProcessing}
                                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold
                                            bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30
                                            text-red-600 dark:text-red-400
                                            disabled:opacity-50 transition-all active:scale-95">
                                          <X className="h-3 w-3" />
                                          {language === 'ar' ? 'رفض' : 'Deny'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* ── Completion requests ── */}
                                {(() => {
                                  // Deduplicate by visitor_name to avoid showing multiple pending requests for the same person
                                  const uniqueRequests = pendingRequests.completion.reduce((acc, curr) => {
                                    if (!acc.find(r => r.visitor_name === curr.visitor_name)) {
                                      acc.push(curr);
                                    }
                                    return acc;
                                  }, [] as typeof pendingRequests.completion);

                                  return uniqueRequests.map(request => (
                                    <div key={request.id} className="rounded-xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/30">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-500/30 flex items-center justify-center text-[10px] font-black text-amber-700 dark:text-amber-300 flex-shrink-0">
                                          {request.visitor_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                                      </div>
                                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">{language === 'ar' ? 'طلب إكمال المهمة' : 'Requesting task completion'}</p>
                                      {renderCompletionRequestStatus(request)}
                                    </div>
                                  ));
                                })()}

                                {/* ── Snooze requests ── */}
                                {pendingRequests.snooze.map(request => (
                                  <div key={request.id} className="rounded-xl p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-500/30 flex items-center justify-center text-[10px] font-black text-orange-700 dark:text-orange-300 flex-shrink-0">
                                        {request.visitor_name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                      <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                                    </div>
                                    {request.content && !parseSnoozeStatus(request.content) && (
                                      <p className="text-[12px] text-muted-foreground mb-2" dir="auto">{t('reason', language)}: {request.content}</p>
                                    )}
                                    {renderSnoozeRequestStatus(request)}
                                  </div>
                                ))}

                                {/* ── Uncheck requests ── */}
                                {pendingRequests.uncheck.map(request => {
                                  const st = stats.subtasks.find(s => s.id === request.subtask_id);
                                  return (
                                    <div key={request.id} className="rounded-xl p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/30">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-700 dark:text-blue-300 flex-shrink-0">
                                          {request.visitor_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                                      </div>
                                      <p className="text-[12px] text-blue-700 dark:text-blue-400">{language === 'ar' ? 'طلب إلغاء تحديد' : 'Requesting uncheck'}: "{st?.title || 'subtask'}"</p>
                                      {request.content && <p className="text-[12px] text-muted-foreground mt-1">{t('reason', language)}: {request.content}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}

                        {approvalTab === 'handled' && (
                          <>
                            {!hasHandled ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.05]">
                                <Clock className="h-8 w-8 text-slate-400 mb-2 opacity-50" />
                                <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300 mb-1">{language === 'ar' ? 'لا توجد طلبات سابقة' : 'No handled requests'}</p>
                              </div>
                            ) : (
                              <div className="space-y-2 opacity-75">
                                {/* ── Handled Completion requests ── */}
                                {handledRequests.completion.map(request => {
                                  const status = parseSnoozeStatus(request.content);
                                  const isApproved = status === 'approved';
                                  return (
                                    <div key={request.id} className={`rounded-xl p-3 border ${isApproved ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200/50' : 'bg-red-50 dark:bg-red-500/5 border-red-200/50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isApproved ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                                          {request.visitor_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                                      </div>
                                      {isApproved && (
                                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mb-2">{language === 'ar' ? 'طلب إكمال المهمة' : 'Requesting task completion'}</p>
                                      )}
                                      {!isApproved && (
                                        <p className="text-[11px] text-red-700 dark:text-red-400 mb-2">{language === 'ar' ? 'طلب إكمال المهمة' : 'Requesting task completion'}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        {isApproved ? (
                                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {language === 'ar' ? 'تم القبول' : 'Approved'}</span>
                                        ) : (
                                          <span className="text-[11px] font-bold text-red-600 flex items-center gap-1"><X className="h-3 w-3" /> {language === 'ar' ? 'تم الرفض' : 'Denied'}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* ── Handled Snooze requests ── */}
                                {handledRequests.snooze.map(request => {
                                  const statusObj = parseSnoozeStatus(request.content);
                                  const status = statusObj?.status;
                                  const isApproved = status === 'approved';
                                  return (
                                    <div key={request.id} className={`rounded-xl p-3 border ${isApproved ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200/50' : 'bg-red-50 dark:bg-red-500/5 border-red-200/50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isApproved ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                                          {request.visitor_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 mb-1">{language === 'ar' ? 'طلب تأجيل' : 'Snooze request'}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        {isApproved ? (
                                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {language === 'ar' ? 'تم القبول' : 'Approved'}</span>
                                        ) : (
                                          <span className="text-[11px] font-bold text-red-600 flex items-center gap-1"><X className="h-3 w-3" /> {language === 'ar' ? 'تم الرفض' : 'Denied'}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                    })()}

                    {/* ── ASSIGNEES tab ── */}
                    {activeView === 'assignees' && (
                      <div className="space-y-2 pt-1">
                        {stats.assignees.length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد مشاركون بعد' : 'No assignees yet'}</p>
                        ) : stats.assignees.map(assignee => {
                          const acts = stats.allResponses.filter(r => r.visitor_name === assignee);
                          const lastAct = acts.length > 0 ? [...acts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                          const doneCount = stats.subtasks.filter(s => s.completed && stats.allResponses.some(r => r.subtask_id === s.id && r.visitor_name === assignee && r.is_completed)).length;
                          const isApproved = stats.approvedAssigneesList?.some(a => a.assignee_name === assignee);
                          return (
                            <div key={assignee} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[13px] font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                {assignee.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[13px] font-bold text-foreground truncate" dir="auto">{assignee}</p>
                                  {isApproved && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                      {language === 'ar' ? 'مقبول' : 'Approved'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground/50">
                                  {lastAct ? formatRelativeTime(lastAct.created_at) : (language === 'ar' ? 'لا نشاط بعد' : 'No activity yet')}
                                  {stats.totalSubtasksCount > 0 && acts.length > 0 && ` · ${doneCount}/${stats.totalSubtasksCount} subtasks`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── SUBTASKS tab ── */}
                    {activeView === 'subtasks' && (() => {
                      const pending = stats.subtasks.filter(s => !s.completed);
                      const completed = stats.subtasks.filter(s => s.completed);
                      const isTaskOwner = task.user_id === currentUserId;
                      const hasPendingSubtasks = pending.length > 0;
                      const renderSubtask = (subtask: typeof stats.subtasks[0]) => {
                        const completions = stats.allResponses.filter(r => r.response_type === 'completion' && r.subtask_id === subtask.id && r.is_completed);
                        const allWho = [...new Set(completions.map(c => c.visitor_name))];
                        const latest = completions.length > 0 ? [...completions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                        const isCompleted = !!subtask.completed;
                        return (
                          <button key={subtask.id} 
                            onClick={() => handleSubtaskToggle(task.id, subtask.id, isCompleted)}
                            className={`w-full text-left rounded-xl px-3 py-2.5 flex items-start gap-3 touch-manipulation active:scale-[0.98] transition-transform ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]'}`}>
                            <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${isCompleted ? 'bg-emerald-500' : 'border-2 border-slate-300 dark:border-white/20'}`}>
                              {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12px] font-semibold ${isCompleted ? 'line-through text-muted-foreground/60' : 'text-foreground'}`} dir="auto">{subtask.title}</p>
                              {isCompleted && latest && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1" dir="auto">
                                  <Users className="h-2.5 w-2.5 flex-shrink-0" />
                                  {allWho.join(', ')} · {format(parseISO(latest.created_at), 'MMM dd, HH:mm')}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      };
                      const isPendingOpen = subtaskSections[task.id]?.pending ?? true;
                      const isCompletedOpen = subtaskSections[task.id]?.completed ?? true;
                      return (
                        <div className="space-y-2 pt-1">
                          {/* Mark All Done button - shown when there are pending subtasks */}
                          {hasPendingSubtasks && (
                            <button
                              onClick={() => handleMarkAllDone(task.id, pending)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                                bg-emerald-500 hover:bg-emerald-600 text-white
                                text-[12px] font-bold transition-all active:scale-[0.98] touch-manipulation">
                              <Check className="h-4 w-4" />
                              {language === 'ar' ? 'تحديد الكل كمكتمل' : 'Mark All Done'}
                            </button>
                          )}
                          
                          {/* Mark Task Completed - for owner (direct, no approval) */}
                          {isTaskOwner && hasPendingSubtasks && (
                            <button
                              onClick={() => handleMarkTaskCompleted(task.id)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                                bg-blue-500 hover:bg-blue-600 text-white
                                text-[12px] font-bold transition-all active:scale-[0.98] touch-manipulation">
                              <CheckCircle className="h-4 w-4" />
                              {language === 'ar' ? 'إكمال المهمة' : 'Mark Task Completed'}
                            </button>
                          )}
                          
                          {/* Request Task Completion - for assignees only (not owner) */}
                          {!isTaskOwner && hasPendingSubtasks && (() => {
                            const hasPendingRequest = stats.completionRequests.some(r => {
                              if (r.visitor_name !== ownerName) return false;
                              const status = parseSnoozeStatus(r.content);
                              return status !== 'approved' && status !== 'denied';
                            });
                            
                            return (
                              <button
                                onClick={() => handleRequestTaskCompletion(task.id)}
                                disabled={hasPendingRequest}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                                  text-[12px] font-bold transition-all active:scale-[0.98] touch-manipulation
                                  ${hasPendingRequest 
                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 opacity-80 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                                <AlertCircle className="h-4 w-4" />
                                {hasPendingRequest 
                                  ? (language === 'ar' ? 'تم الطلب، في انتظار الموافقة' : 'Requested, awaiting approval')
                                  : (language === 'ar' ? 'طلب إكمال المهمة' : 'Request Task Completion')}
                              </button>
                            );
                          })()}
                          
                          {pending.length > 0 && (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => toggleSubtaskSection(task.id, 'pending')}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                  bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08]
                                  transition-colors touch-manipulation active:scale-[0.98]">
                                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${isPendingOpen ? '' : '-rotate-90'}`} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-1 text-left">
                                  {language === 'ar' ? 'معلق' : 'Pending'} · {pending.length}
                                </span>
                              </button>
                              {isPendingOpen && <div className="space-y-1.5">{pending.map(renderSubtask)}</div>}
                            </div>
                          )}
                          {completed.length > 0 && (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => toggleSubtaskSection(task.id, 'completed')}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                  bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15
                                  transition-colors touch-manipulation active:scale-[0.98]">
                                <ChevronDown className={`h-3.5 w-3.5 text-emerald-500 transition-transform duration-200 ${isCompletedOpen ? '' : '-rotate-90'}`} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex-1 text-left">
                                  {language === 'ar' ? 'مكتمل' : 'Completed'} · {completed.length}
                                </span>
                              </button>
                              {isCompletedOpen && <div className="space-y-1.5">{completed.map(renderSubtask)}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── COMMENTS tab ── */}
                    {activeView === 'comments' && (
                      <div className="space-y-2 pt-1">
                        {stats.comments.length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {stats.comments.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(comment => (
                              <div key={comment.id} className="rounded-xl p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-400 flex-shrink-0">
                                    {comment.visitor_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[12px] font-bold text-foreground" dir="auto">{comment.visitor_name}</span>
                                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{formatRelativeTime(comment.created_at)}</span>
                                </div>
                                <div className="bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2 text-[13px] text-foreground border border-slate-200/50 dark:border-white/[0.06]" dir="auto">
                                  {comment.content}
                                </div>
                                {replyingTo === comment.id ? (
                                  <div className="mt-2 space-y-2">
                                    <Textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder={`${t('typeYourReply', language)}...`} rows={2} className="text-sm" />
                                    <div className="flex gap-2 justify-end">
                                      <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyContent(''); }}>{t('cancel', language)}</Button>
                                      <Button size="sm" onClick={() => handleReply(task.id)} disabled={!replyContent.trim()}>{t('reply', language)}</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setReplyingTo(comment.id)} className="mt-1.5 text-[11px] font-bold text-purple-500 hover:text-purple-600 flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{t('reply', language)}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── ACTIVITY tab ── */}
                    {activeView === 'activity' && (
                      <div className="space-y-1.5 pt-1">
                        {stats.allResponses.filter(r => r.response_type !== 'comment' && r.response_type !== 'visit').length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{t('noActivityYet', language)}</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                            {stats.allResponses.filter(r => r.response_type !== 'comment' && r.response_type !== 'visit').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30).map(activity => (
                              <div key={activity.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                {getActivityIcon(activity.response_type)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-foreground" dir="auto">{activity.visitor_name}</span>
                                    <span className="text-[10px] text-muted-foreground/50 ml-auto">{format(parseISO(activity.created_at), 'MMM dd, HH:mm')}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground" dir="auto">{getActivityDescription(activity, stats.subtasks)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </CardContent>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
};
