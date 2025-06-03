import React, { useState, useEffect } from 'react';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRSharedAccessExtended, TRSnoozeRequest } from '@/services/trSharedService';
import { SharedTaskCard } from './SharedTaskCard';
import { SnoozeRequestPanel } from './SnoozeRequestPanel';
import { ActivityFeedWidget } from './ActivityFeedWidget';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Activity } from 'lucide-react';

interface SharedTaskActivityMonitorProps {
  tasks: TRTask[];
  onTasksChanged: () => void;
}

export const SharedTaskActivityMonitor: React.FC<SharedTaskActivityMonitorProps> = ({
  tasks,
  onTasksChanged
}) => {
  const [activeAssignees, setActiveAssignees] = useState<TRSharedAccessExtended[]>([]);
  const [snoozeRequests, setSnoozeRequests] = useState<TRSnoozeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const sharedTasks = tasks.filter(task => task.is_shared);

  useEffect(() => {
    if (sharedTasks.length > 0) {
      loadActivityData();
      setupRealtimeSubscriptions();
    } else {
      setLoading(false);
    }
  }, [sharedTasks.length]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      
      // Load assignees and snooze requests for all shared tasks
      const [assigneesData, snoozeData] = await Promise.all([
        Promise.all(sharedTasks.map(task => TRSharedService.getActiveVisitors(task.id))),
        Promise.all(sharedTasks.map(task => TRSharedService.getSnoozeRequests(task.id)))
      ]);

      // Flatten the arrays
      const allAssignees = assigneesData.flat();
      const allSnoozeRequests = snoozeData.flat();

      // Deduplicate assignees globally by session_id and name
      const uniqueAssignees = allAssignees.reduce((acc, assignee) => {
        const key = `${assignee.task_id}-${assignee.session_id || assignee.viewer_name}`;
        const existing = acc.find(a => 
          `${a.task_id}-${a.session_id || a.viewer_name}` === key
        );
        
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

      setActiveAssignees(uniqueAssignees);
      setSnoozeRequests(allSnoozeRequests.filter(req => req.status === 'pending'));
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channels = sharedTasks.map(task =>
      TRSharedService.subscribeToTaskUpdates(task.id, () => {
        loadActivityData();
      })
    );

    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  };

  const handleSnoozeRequestUpdate = async (requestId: string, status: 'approved' | 'denied') => {
    try {
      await TRSharedService.updateSnoozeRequest(requestId, status);
      loadActivityData();
      onTasksChanged();
    } catch (error) {
      console.error('Error updating snooze request:', error);
    }
  };

  const totalActiveAssignees = activeAssignees.length;
  const pendingSnoozeRequests = snoozeRequests.length;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">Loading activity data...</p>
      </div>
    );
  }

  if (sharedTasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No Shared Tasks</p>
        <p className="text-sm">Share a task to start monitoring assignee activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Activity Overview */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/20 rounded-lg p-3 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-blue-600" />
          <div className="text-lg font-semibold">{totalActiveAssignees}</div>
          <div className="text-xs text-muted-foreground">Active Assignees</div>
        </div>
        
        <div className="bg-secondary/20 rounded-lg p-3 text-center">
          <Activity className="w-5 h-5 mx-auto mb-1 text-green-600" />
          <div className="text-lg font-semibold">{sharedTasks.length}</div>
          <div className="text-xs text-muted-foreground">Shared Tasks</div>
        </div>
        
        <div className="bg-secondary/20 rounded-lg p-3 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-orange-600" />
          <div className="text-lg font-semibold">{pendingSnoozeRequests}</div>
          <div className="text-xs text-muted-foreground">Snooze Requests</div>
        </div>
      </div>

      {/* Snooze Requests Panel */}
      {pendingSnoozeRequests > 0 && (
        <SnoozeRequestPanel 
          snoozeRequests={snoozeRequests}
          onRequestUpdate={handleSnoozeRequestUpdate}
        />
      )}

      {/* Shared Tasks List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Your Shared Tasks</h3>
        {sharedTasks.map(task => (
          <SharedTaskCard
            key={task.id}
            task={task}
            assignees={activeAssignees.filter(v => v.task_id === task.id)}
            onTaskUpdated={onTasksChanged}
          />
        ))}
      </div>

      {/* Activity Feed */}
      <ActivityFeedWidget sharedTasks={sharedTasks} />
    </div>
  );
};
