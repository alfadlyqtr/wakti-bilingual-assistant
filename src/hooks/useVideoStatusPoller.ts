
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from './use-toast-helper';

interface VideoTask {
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  video_url?: string;
  error_message?: string;
  model_used?: string;
}

export function useVideoStatusPoller() {
  const [activeTasks, setActiveTasks] = useState<VideoTask[]>([]);
  const { showSuccess, showError } = useToastHelper();

  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      console.log('🔍 POLLING STATUS:', taskId);
      
      // Check if it's a Runware task (starts with runware or has specific format)
      const isRunwareTask = taskId.includes('-') && taskId.length > 20;
      
      if (isRunwareTask) {
        // Poll Runware status
        const { data, error } = await supabase.functions.invoke('runware-status-poller', {
          body: { task_id: taskId }
        });

        if (error) throw error;

        console.log('🔍 RUNWARE STATUS RESULT:', data);
        
        if (data.status === 'completed' && data.video_url) {
          showSuccess('🎉 Your Runware video is ready!');
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'completed', video_url: data.video_url };
        } else if (data.status === 'failed') {
          showError(`Video generation failed: ${data.error_message || 'Unknown error'}`);
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'failed', error_message: data.error_message };
        }
      } else {
        // Check database for other video tasks
        const { data: dbData, error: dbError } = await supabase
          .from('video_generation_tasks')
          .select('*')
          .eq('task_id', taskId)
          .single();

        if (dbError) throw dbError;

        if (dbData.status === 'completed' && dbData.video_url) {
          showSuccess('🎉 Your video is ready!');
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'completed', video_url: dbData.video_url };
        } else if (dbData.status === 'failed') {
          showError(`Video generation failed: ${dbData.error_message || 'Unknown error'}`);
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'failed', error_message: dbData.error_message };
        }
      }
      
      return { status: 'processing' };
    } catch (error) {
      console.error('❌ STATUS POLL ERROR:', error);
      return { status: 'processing' };
    }
  }, [showSuccess, showError]);

  const addTask = useCallback((task: VideoTask) => {
    setActiveTasks(prev => [...prev.filter(t => t.task_id !== task.task_id), task]);
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
  }, []);

  // Polling effect
  useEffect(() => {
    if (activeTasks.length === 0) return;

    const interval = setInterval(() => {
      activeTasks.forEach(task => {
        if (task.status === 'processing') {
          pollTaskStatus(task.task_id);
        }
      });
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [activeTasks, pollTaskStatus]);

  return {
    activeTasks,
    addTask,
    removeTask,
    pollTaskStatus
  };
}
