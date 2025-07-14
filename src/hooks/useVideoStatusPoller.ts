
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
      
      // Check database for task status
      const { data: dbData, error: dbError } = await supabase
        .from('video_generation_tasks')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (dbError) {
        console.error('❌ DB POLL ERROR:', dbError);
        return { status: 'processing' };
      }

      console.log('🔍 DB STATUS RESULT:', dbData.status);

      if (dbData.status === 'processing') {
        // Check Runware status for processing tasks
        const { data: runwareData, error: runwareError } = await supabase.functions.invoke('runware-status-poller', {
          body: { task_id: taskId }
        });

        if (runwareError) {
          console.error('❌ RUNWARE POLL ERROR:', runwareError);
          return { status: 'processing' };
        }

        console.log('🔍 RUNWARE STATUS RESULT:', runwareData);
        
        if (runwareData.status === 'completed' && runwareData.video_url) {
          showSuccess('🎉 Your video is ready!');
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'completed', video_url: runwareData.video_url };
        } else if (runwareData.status === 'failed') {
          showError(`Video generation failed: ${runwareData.error_message || 'Unknown error'}`);
          setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
          return { status: 'failed', error_message: runwareData.error_message };
        }
      } else if (dbData.status === 'completed' && dbData.video_url) {
        showSuccess('🎉 Your video is ready!');
        setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
        return { status: 'completed', video_url: dbData.video_url };
      } else if (dbData.status === 'failed') {
        showError(`Video generation failed: ${dbData.error_message || 'Unknown error'}`);
        setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
        return { status: 'failed', error_message: dbData.error_message };
      }
      
      return { status: 'processing' };
    } catch (error) {
      console.error('❌ STATUS POLL ERROR:', error);
      return { status: 'processing' };
    }
  }, [showSuccess, showError]);

  const addTask = useCallback((task: VideoTask) => {
    console.log('➕ ADDING TASK TO POLLER:', task.task_id);
    setActiveTasks(prev => [...prev.filter(t => t.task_id !== task.task_id), task]);
  }, []);

  const removeTask = useCallback((taskId: string) => {
    console.log('➖ REMOVING TASK FROM POLLER:', taskId);
    setActiveTasks(prev => prev.filter(task => task.task_id !== taskId));
  }, []);

  // Polling effect
  useEffect(() => {
    if (activeTasks.length === 0) return;

    console.log('🔄 POLLING ACTIVE TASKS:', activeTasks.length);

    const interval = setInterval(() => {
      activeTasks.forEach(task => {
        if (task.status === 'processing') {
          pollTaskStatus(task.task_id);
        }
      });
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [activeTasks, pollTaskStatus]);

  // Update task status
  const updateTaskStatus = useCallback((taskId: string, status: 'processing' | 'completed' | 'failed', video_url?: string, error_message?: string) => {
    setActiveTasks(prev => prev.map(task => 
      task.task_id === taskId 
        ? { ...task, status, video_url, error_message }
        : task
    ));
  }, []);

  return {
    activeTasks,
    addTask,
    removeTask,
    pollTaskStatus,
    updateTaskStatus
  };
}
