import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  Clock, 
  Calendar, 
  User, 
  Share2, 
  AlertTriangle,
  ArrowLeft,
  Pause
} from 'lucide-react';
import { format } from 'date-fns';
import { VisitorNameModal } from '@/components/tr/VisitorNameModal';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  user_id: string;
  shared_with: string[] | null;
  is_shared: boolean;
  shared_secret: string | null;
  snooze_requests: any[] | null;
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

const getVisitorName = () => localStorage.getItem('visitorName');
const setVisitorName = (name: string) => localStorage.setItem('visitorName', name);

export const SharedTaskView: React.FC = () => {
  const { secret } = useParams<{ secret: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(1);
  const [isVisitor, setIsVisitor] = useState(!!getVisitorName());
  const [showVisitorNameModal, setShowVisitorNameModal] = useState(!getVisitorName());

  useEffect(() => {
    const fetchTask = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!secret) throw new Error("Task secret not provided");

        const { data: taskData, error: taskError } = await supabase
          .from('my_tasks')
          .select('*')
          .eq('shared_secret', secret)
          .single();

        if (taskError) throw taskError;
        if (!taskData) throw new Error("Task not found");

        setTask(taskData);

        const { data: subtasksData, error: subtasksError } = await supabase
          .from('sub_tasks')
          .select('*')
          .eq('task_id', taskData.id);

        if (subtasksError) throw subtasksError;

        setSubtasks(subtasksData || []);
      } catch (err: any) {
        console.error("Error fetching task:", err);
        setError(err.message || "Failed to load task");
        toast.error(err.message || "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [secret]);

  const handleSubtaskToggle = async (subtaskId: string, currentStatus: boolean) => {
    if (!task) return;

    try {
      const newStatus = !currentStatus;

      // Optimistically update UI
      setSubtasks(prevSubtasks =>
        prevSubtasks.map(subtask =>
          subtask.id === subtaskId ? { ...subtask, is_completed: newStatus } : subtask
        )
      );

      // Update in database
      const { error } = await supabase
        .from('sub_tasks')
        .update({ is_completed: newStatus })
        .eq('id', subtaskId);

      if (error) {
        throw error;
      }

      // Log the completion (or uncompletion)
      const visitorName = getVisitorName() || 'Anonymous';
      const logText = `${visitorName} marked subtask ${subtaskId} as ${newStatus ? 'complete' : 'incomplete'}`;
      console.log(logText);

      // Send real-time event to task owner
      supabase
        .from('task_activity')
        .insert([{
          task_id: task.id,
          user_id: task.user_id,
          activity_type: 'subtask_update',
          description: logText,
          metadata: {
            subtask_id: subtaskId,
            completed: newStatus,
            visitor_name: visitorName
          }
        }])
        .then(() => console.log('Realtime event sent'));

    } catch (err: any) {
      console.error("Error updating subtask:", err);
      toast.error(err.message || "Failed to update subtask");

      // Revert UI on failure
      setSubtasks(prevSubtasks =>
        prevSubtasks.map(subtask =>
          subtask.id === subtaskId ? { ...subtask, is_completed: currentStatus } : subtask
        )
      );
    }
  };

  const handleSnoozeRequest = async () => {
    if (!task) return;

    try {
      const visitorName = getVisitorName() || 'Anonymous';
      const snoozeRequest = {
        days: snoozeDays,
        requested_by: visitorName,
        status: 'pending',
        requested_at: new Date().toISOString()
      };

      // Optimistically update UI
      const updatedSnoozeRequests = task.snooze_requests ? [...task.snooze_requests, snoozeRequest] : [snoozeRequest];

      // Update in database
      const { error } = await supabase
        .from('my_tasks')
        .update({ snooze_requests: updatedSnoozeRequests })
        .eq('id', task.id);

      if (error) {
        throw error;
      }

      // Update local state
      setTask(prevTask => prevTask ? { ...prevTask, snooze_requests: updatedSnoozeRequests } : null);

      // Log the snooze request
      const logText = `${visitorName} requested a ${snoozeDays}-day snooze`;
      console.log(logText);

      // Send real-time event to task owner
      supabase
        .from('task_activity')
        .insert([{
          task_id: task.id,
          user_id: task.user_id,
          activity_type: 'snooze_request',
          description: logText,
          metadata: {
            days: snoozeDays,
            visitor_name: visitorName
          }
        }])
        .then(() => console.log('Realtime event sent'));

      toast.success(`Snooze requested for ${snoozeDays} days`);
    } catch (err: any) {
      console.error("Error requesting snooze:", err);
      toast.error(err.message || "Failed to request snooze");
    } finally {
      setShowSnoozeDialog(false);
    }
  };

  const handleVisitorNameSubmit = async (name: string) => {
    setVisitorName(name);
    setIsVisitor(true);
    setShowVisitorNameModal(false);
    toast.success(`Welcome, ${name}!`);
  };

  if (loading) {
    return <p>Loading task...</p>;
  }

  if (error || !task) {
    return <p>Error: {error || "Task not found"}</p>;
  }

  return (
    <div className="container mx-auto p-4">
      {showVisitorNameModal && (
        <VisitorNameModal
          isOpen={showVisitorNameModal}
          onSubmit={handleVisitorNameSubmit}
          taskTitle={task.title}
        />
      )}

      <Button variant="ghost" onClick={() => navigate('/tr')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Tasks
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {task.title}
            {task.status === 'completed' && (
              <CheckCircle className="text-green-500 h-5 w-5" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>{task.description}</p>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                Due Date: {task.due_date ? format(new Date(task.due_date), 'PPP') : 'No due date'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Created: {format(new Date(task.created_at), 'PPP')}</span>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Task Owner: {task.user_id}</span>
            </div>

            {task.priority && (
              <Badge>Priority: {task.priority}</Badge>
            )}

            {task.snooze_requests && task.snooze_requests.length > 0 && (
              <div className="mt-2">
                <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                <span>Snooze Requests:</span>
                <ul>
                  {task.snooze_requests.map((request: any, index: number) => (
                    <li key={index}>
                      Requested by {request.requested_by} for {request.days} days
                      (Status: {request.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div>
            <h3 className="text-lg font-semibold mb-2">Subtasks</h3>
            {subtasks.length === 0 ? (
              <p>No subtasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`subtask-${subtask.id}`}
                        checked={subtask.is_completed}
                        onCheckedChange={(checked) => handleSubtaskToggle(subtask.id, subtask.is_completed)}
                        disabled={!isVisitor}
                      />
                      <Label htmlFor={`subtask-${subtask.id}`} className={subtask.is_completed ? 'line-through text-muted-foreground' : ''}>
                        {subtask.title}
                      </Label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between items-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!isVisitor}>
                  <Pause className="mr-2 h-4 w-4" />
                  Request Snooze
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Task Snooze</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="days" className="text-right">
                      Days
                    </Label>
                    <Input
                      type="number"
                      id="days"
                      value={snoozeDays}
                      onChange={(e) => setSnoozeDays(Number(e.target.value))}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <Button onClick={handleSnoozeRequest}>Request Snooze</Button>
              </DialogContent>
            </Dialog>

            <Button variant="secondary">
              <Share2 className="mr-2 h-4 w-4" />
              Share Task
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
