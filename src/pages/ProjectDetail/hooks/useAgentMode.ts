/**
 * useAgentMode
 * ----------------------------------------------------------------------------
 * Thin, real client for the AI Coder agent. Invokes the
 * `projects-generate` edge function with `mode: 'agent'` and polls for
 * real backend progress (tool calls, files changed, errors).
 *
 * Replaces the previous stubbed implementation that simulated fake tasks
 * with setTimeout. Any future UI component that wants reusable agent
 * orchestration should use THIS hook instead of duplicating the logic.
 *
 * NOTE: `ProjectDetail.tsx` still has its own inline agent wiring and does
 * NOT currently consume this hook. That is intentional — keeping the
 * existing page stable. Future components should use `useAgentMode`.
 * ----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentPlan {
  id: string; // jobId returned by the edge function
  goal: string;
  tasks: AgentTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  toolCalls?: Array<{ tool: string; success: boolean }>;
  filesChanged?: string[];
  summary?: string;
}

/**
 * Kept for backward-compat with the previous stub's type exports.
 * Not required by the new implementation but still exported via the
 * hooks barrel (`src/pages/ProjectDetail/hooks/index.ts`).
 */
export interface ConversationContext {
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectContext: {
    files: string[];
    technologies: string[];
    currentFile?: string;
  };
  userPreferences: {
    language: string;
    isRTL: boolean;
  };
}

export interface UseAgentModeOptions {
  projectId: string;
  /** Called when the agent job finishes successfully with an updated file map. */
  onFilesChanged?: (files: Record<string, string>) => void;
  /** Called when the agent job fails or is cancelled. */
  onError?: (message: string) => void;
  /** Poll interval in ms (default: 1500). */
  pollIntervalMs?: number;
}

export interface UseAgentModeReturn {
  currentPlan: AgentPlan | null;
  isRunning: boolean;
  /** Kick off an agent run. Returns the final plan (resolved) or throws on failure. */
  runAgent: (
    prompt: string,
    currentFiles: Record<string, string>,
    extras?: { userInstructions?: string; lang?: 'en' | 'ar' },
  ) => Promise<AgentPlan>;
  /** Cancel the currently-running agent, if any. */
  cancel: () => void;
  /** Plans that have already completed in this session. */
  planHistory: AgentPlan[];
  clearHistory: () => void;
}

interface EdgeJobStatus {
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  tasks?: Array<{
    id?: string;
    title?: string;
    tool?: string;
    description?: string;
    status?: AgentTask['status'];
    result?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
  }>;
  toolCalls?: Array<{ tool: string; success: boolean }>;
  filesChanged?: string[];
  files?: Record<string, string>;
  summary?: string;
  error?: string;
}

/**
 * Real client for the AI Coder agent. Wraps the `projects-generate` edge
 * function (mode: 'agent') and exposes live progress.
 */
export function useAgentMode(opts: UseAgentModeOptions): UseAgentModeReturn {
  const { projectId, onFilesChanged, onError, pollIntervalMs = 1500 } = opts;

  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [planHistory, setPlanHistory] = useState<AgentPlan[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const mapTasks = (raw: EdgeJobStatus['tasks']): AgentTask[] =>
    (raw || []).map((t, i) => ({
      id: t.id || `task-${i}`,
      title: t.title || t.tool || 'Task',
      description: t.description || '',
      status: t.status || 'pending',
      result: t.result,
      error: t.error,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    }));

  const runAgent = useCallback(
    async (
      prompt: string,
      currentFiles: Record<string, string>,
      extras?: { userInstructions?: string; lang?: 'en' | 'ar' },
    ): Promise<AgentPlan> => {
      // Cancel any previous run
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      clearPollTimer();

      const initial: AgentPlan = {
        id: '',
        goal: prompt,
        tasks: [],
        status: 'planning',
        createdAt: Date.now(),
      };
      setCurrentPlan(initial);
      setIsRunning(true);

      try {
        const startRes = await supabase.functions.invoke('projects-generate', {
          body: {
            action: 'start',
            mode: 'agent',
            projectId,
            prompt,
            currentFiles,
            userInstructions: extras?.userInstructions,
            lang: extras?.lang || 'en',
          },
        });
        if (startRes.error) {
          throw new Error(startRes.error.message || 'Failed to start agent');
        }
        const jobId = (startRes.data as { jobId?: string } | null)?.jobId;
        if (!jobId) throw new Error('No jobId returned from projects-generate');

        activeJobIdRef.current = jobId;
        const executing: AgentPlan = { ...initial, id: jobId, status: 'executing' };
        setCurrentPlan(executing);

        return await new Promise<AgentPlan>((resolve, reject) => {
          const poll = async () => {
            if (abortRef.current?.signal.aborted) {
              reject(new Error('cancelled'));
              return;
            }
            try {
              const res = await supabase.functions.invoke('projects-generate', {
                body: { action: 'status', jobId },
              });
              if (res.error) throw new Error(res.error.message || 'Status check failed');
              const data = (res.data || {}) as EdgeJobStatus;

              const tasks = mapTasks(data.tasks);
              const next: AgentPlan = {
                ...executing,
                tasks,
                toolCalls: data.toolCalls,
                filesChanged: data.filesChanged,
                summary: data.summary,
              };

              if (data.status === 'succeeded' || data.status === 'completed') {
                next.status = 'completed';
                next.completedAt = Date.now();
                setCurrentPlan(next);
                setPlanHistory((prev) => [...prev, next]);
                if (data.files && onFilesChanged) onFilesChanged(data.files);
                setIsRunning(false);
                activeJobIdRef.current = null;
                resolve(next);
                return;
              }

              if (data.status === 'failed') {
                next.status = 'failed';
                next.completedAt = Date.now();
                setCurrentPlan(next);
                setPlanHistory((prev) => [...prev, next]);
                const msg = data.error || 'Agent failed';
                onError?.(msg);
                setIsRunning(false);
                activeJobIdRef.current = null;
                reject(new Error(msg));
                return;
              }

              // Still running — keep polling
              setCurrentPlan(next);
              pollTimerRef.current = setTimeout(poll, pollIntervalMs);
            } catch (err) {
              setIsRunning(false);
              activeJobIdRef.current = null;
              const msg = err instanceof Error ? err.message : String(err);
              onError?.(msg);
              reject(err);
            }
          };
          poll();
        });
      } catch (err) {
        setCurrentPlan((prev) =>
          prev ? { ...prev, status: 'failed', completedAt: Date.now() } : null,
        );
        setIsRunning(false);
        activeJobIdRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
        throw err;
      }
    },
    [projectId, onFilesChanged, onError, pollIntervalMs],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    clearPollTimer();
    activeJobIdRef.current = null;
    setCurrentPlan((prev) =>
      prev ? { ...prev, status: 'cancelled', completedAt: Date.now() } : null,
    );
    setIsRunning(false);
  }, []);

  const clearHistory = useCallback(() => {
    setPlanHistory([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearPollTimer();
    };
  }, []);

  return {
    currentPlan,
    isRunning,
    runAgent,
    cancel,
    planHistory,
    clearHistory,
  };
}
