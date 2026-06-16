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
import type { BackendContext, UploadedAsset } from '../types';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
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
  responseMessage?: string;
  resultType?: 'direct_result' | 'direct_message' | 'polled_job';
  rawResult?: EdgeAgentStartResponse | null;
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

export type AgentExecutionMode = 'surgical_edit' | 'design_rebuild';

export interface UseAgentModeOptions {
  projectId: string;
  /** Called when the agent job finishes successfully with an updated file map. */
  onFilesChanged?: (files: Record<string, string>) => void;
  /** Called when the agent job fails or is cancelled. */
  onError?: (message: string) => void;
  /** Poll interval in ms (default: 1500). */
  pollIntervalMs?: number;
}

export interface AgentRunExtras {
  userInstructions?: string;
  lang?: 'en' | 'ar';
  images?: string[];
  assetIntent?: 'layout' | 'style' | 'content';
  executionMode?: AgentExecutionMode;
  uploadedAssets?: UploadedAsset[];
  backendContext?: BackendContext;
  debugContext?: unknown;
  fixerMode?: boolean;
  fixerContext?: {
    errorMessage: string;
    previousAttempts: number;
    recentEdits?: string[];
    chatHistory?: string;
    missingPackage?: string | null;
    errorType?: 'missing-dependency' | 'runtime';
  };
}

export interface UseAgentModeReturn {
  currentPlan: AgentPlan | null;
  isRunning: boolean;
  /** Kick off an agent run. Returns the final plan (resolved) or throws on failure. */
  runAgent: (
    prompt: string,
    currentFiles: Record<string, string>,
    extras?: AgentRunExtras,
  ) => Promise<AgentPlan>;
  /** Cancel the currently-running agent, if any. */
  cancel: () => void;
  /** Plans that have already completed in this session. */
  planHistory: AgentPlan[];
  clearHistory: () => void;
}

interface EdgeJobStatus {
  id?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  error?: string;
  result_summary?: string;
  created_at?: string;
  prompt?: string;
}

interface EdgeStatusResponse {
  ok?: boolean;
  error?: string;
  job?: EdgeJobStatus;
}

interface EdgeAgentToolCall {
  tool: string;
  args?: unknown;
  result?: {
    success?: boolean;
    error?: string;
    summary?: string;
    path?: string;
    filepath?: string;
    deletedPath?: string;
    [key: string]: unknown;
  } | null;
}

interface EdgeAgentResultPayload {
  success?: boolean;
  type?: string;
  title?: string;
  message?: string;
  error?: string;
  suggestion?: string;
  candidates?: Array<{ file: string; preview: string; line?: number }>;
  filesChanged?: string[];
  summary?: string;
  smokeTestResult?: {
    passed?: boolean;
    criticalErrors?: string[];
  };
  toolCalls?: EdgeAgentToolCall[];
}

interface EdgeAgentStartResponse {
  ok?: boolean;
  mode?: string;
  message?: string;
  error?: string;
  jobId?: string;
  result?: EdgeAgentResultPayload;
  fixerMode?: boolean;
  fixerFailed?: boolean;
  toolCalls?: Array<{ tool: string; success: boolean }>;
  duration?: number;
}

type AgentRunError = Error & {
  agentResponse?: EdgeAgentStartResponse | null;
  agentAlreadyRecorded?: boolean;
};

/**
 * Real client for the AI Coder agent. Wraps the `projects-generate` edge
 * function (mode: 'agent') and exposes live progress.
 */
export function useAgentMode(opts: UseAgentModeOptions): UseAgentModeReturn {
  const { projectId, onFilesChanged, onError, pollIntervalMs = 1500 } = opts;

  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [planHistory, setPlanHistory] = useState<AgentPlan[]>([]);

  const currentPlanRef = useRef<AgentPlan | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentPlanRef.current = currentPlan;
  }, [currentPlan]);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const mapToolCallsToTasks = (raw?: EdgeAgentToolCall[] | null): AgentTask[] =>
    (raw || [])
      .filter((call) => call.tool !== 'task_complete')
      .map((call, index) => {
        const result = call.result || undefined;
        const resultPath = typeof result?.path === 'string'
          ? result.path
          : typeof result?.filepath === 'string'
          ? result.filepath
          : typeof result?.deletedPath === 'string'
          ? result.deletedPath
          : undefined;

        return {
          id: `tool-${index}`,
          title: call.tool.replace(/_/g, ' '),
          description: resultPath || '',
          status: result?.success === false ? 'failed' : 'completed',
          tool: call.tool,
          result: typeof result?.summary === 'string' ? result.summary : resultPath,
          error: typeof result?.error === 'string' ? result.error : undefined,
        };
      });

  const mapSummaryToolCallsToTasks = (raw?: Array<{ tool: string; success: boolean }> | null): AgentTask[] =>
    (raw || []).map((call, index) => ({
      id: `summary-tool-${index}`,
      title: call.tool.replace(/_/g, ' '),
      description: '',
      status: call.success ? 'completed' : 'failed',
      tool: call.tool,
    }));

  const buildPollingTasks = (job: EdgeJobStatus | null | undefined): AgentTask[] => {
    if (!job) return [];

    return [
      {
        id: job.id || 'agent-job',
        title: 'Agent job',
        description: job.result_summary || '',
        status:
          job.status === 'succeeded'
            ? 'completed'
            : job.status === 'failed'
            ? 'failed'
            : 'in_progress',
        result: job.result_summary || undefined,
        error: job.error || undefined,
      },
    ];
  };

  const loadProjectFiles = useCallback(async (): Promise<Record<string, string>> => {
    const res = await supabase.functions.invoke('projects-generate', {
      body: { action: 'get_files', projectId },
    });

    if (res.error) {
      throw new Error(res.error.message || 'Failed to load project files');
    }

    return ((res.data as { files?: Record<string, string> } | null)?.files || {}) as Record<string, string>;
  }, [projectId]);

  const createAgentError = useCallback(
    (message: string, agentResponse?: EdgeAgentStartResponse | null, agentAlreadyRecorded = false): AgentRunError => {
      const error = new Error(message) as AgentRunError;
      error.agentResponse = agentResponse || null;
      error.agentAlreadyRecorded = agentAlreadyRecorded;
      return error;
    },
    [],
  );

  const isRecoverableStartError = useCallback((message: string): boolean => {
    return /504|timeout|gateway|failed to fetch|err_failed|network|cors|aborted/i.test(message);
  }, []);

  const normalizePromptForMatching = useCallback((value: string): string => {
    return value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const getPromptTokens = useCallback((value: string): string[] => {
    const normalized = normalizePromptForMatching(value);
    if (!normalized) return [];

    const uniqueTokens = new Set<string>();
    for (const token of normalized.split(' ')) {
      if (token.length < 4) continue;
      uniqueTokens.add(token);
      if (uniqueTokens.size >= 8) break;
    }

    return [...uniqueTokens];
  }, [normalizePromptForMatching]);

  const findRecentAgentJob = useCallback(async (startedAtMs: number, promptForMatch: string): Promise<EdgeJobStatus | null> => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const thresholdIso = new Date(startedAtMs - 15000).toISOString();
    const { data, error } = await (supabase
      .from('project_generation_jobs' as any)
      .select('id, status, error, result_summary, created_at, prompt')
      .eq('project_id', projectId)
      .eq('mode', 'edit')
      .gte('created_at', thresholdIso)
      .order('created_at', { ascending: false })
      .limit(5) as any);

    if (error) {
      console.warn('[useAgentMode] Failed to find recent fallback job:', error);
      return null;
    }

    const promptTokens = getPromptTokens(promptForMatch);
    if (promptTokens.length === 0) {
      return null;
    }

    const rows = (data || []) as EdgeJobStatus[];
    const bestMatch = rows
      .filter((job) => typeof job.id === 'string' && job.id.length > 0)
      .map((job) => {
        const normalizedJobPrompt = normalizePromptForMatching(job.prompt || '');
        const score = promptTokens.reduce((acc, token) => (
          normalizedJobPrompt.includes(token) ? acc + 1 : acc
        ), 0);

        return { job, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (!bestMatch) return null;

    const minimumRequiredScore = Math.min(2, promptTokens.length);
    if (bestMatch.score < minimumRequiredScore) {
      return null;
    }

    return bestMatch.job;
  }, [getPromptTokens, normalizePromptForMatching, projectId]);

  const runAgent = useCallback(
    async (
      prompt: string,
      currentFiles: Record<string, string>,
      extras?: AgentRunExtras,
    ): Promise<AgentPlan> => {
      // Cancel any previous run
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      clearPollTimer();

      let startData: EdgeAgentStartResponse | null = null;

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
        const startAttemptedAt = Date.now();
        let recoveredJob: EdgeJobStatus | null = null;

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
              images: extras?.images,
              assetIntent: extras?.assetIntent,
              executionMode: extras?.executionMode,
              uploadedAssets: extras?.uploadedAssets,
              backendContext: extras?.backendContext,
              debugContext: extras?.debugContext,
              fixerMode: extras?.fixerMode,
              fixerContext: extras?.fixerContext,
            },
          });

          if (startRes.error) {
            const startMessage = startRes.error.message || 'Failed to start agent';
            if (!isRecoverableStartError(startMessage)) {
              throw new Error(startMessage);
            }

            recoveredJob = await findRecentAgentJob(startAttemptedAt, prompt);
            if (!recoveredJob?.id) {
              throw new Error(startMessage);
            }

            console.warn('[useAgentMode] Agent start request failed, but a recent job was found. Continuing with polling.', recoveredJob.id);
            startData = {
              ok: true,
              jobId: recoveredJob.id,
              message: 'Recovered agent job after temporary start failure.',
            };
          } else {
            startData = (startRes.data || {}) as EdgeAgentStartResponse;
          }
        } catch (startErr) {
          const startMessage = startErr instanceof Error ? startErr.message : String(startErr);
          if (!isRecoverableStartError(startMessage)) {
            throw startErr;
          }

          recoveredJob = await findRecentAgentJob(startAttemptedAt, prompt);
          if (!recoveredJob?.id) {
            throw startErr;
          }

          console.warn('[useAgentMode] Agent start threw a temporary error, but a recent job was found. Continuing with polling.', recoveredJob.id);
          startData = {
            ok: true,
            jobId: recoveredJob.id,
            message: 'Recovered agent job after temporary start failure.',
          };
        }

        if (startData.ok === false) {
          const failedPlan: AgentPlan = {
            ...initial,
            id: startData.jobId || `agent-${Date.now()}`,
            status: 'failed',
            completedAt: Date.now(),
            tasks: mapSummaryToolCallsToTasks(startData.toolCalls),
            toolCalls: (startData.toolCalls || []).map((call) => ({
              tool: call.tool,
              success: call.success,
            })),
            summary: startData.error || startData.message,
            responseMessage: startData.message,
            resultType: 'direct_message',
            rawResult: startData,
          };

          setCurrentPlan(failedPlan);
          setPlanHistory((prev) => [...prev, failedPlan]);
          setIsRunning(false);
          activeJobIdRef.current = null;

          throw createAgentError(
            startData.error || startData.message || 'Agent request failed',
            startData,
            true,
          );
        }

        if (startData.result) {
          const completedPlan: AgentPlan = {
            ...initial,
            id: startData.jobId || `agent-${Date.now()}`,
            status: startData.result.success === false ? 'failed' : 'completed',
            completedAt: Date.now(),
            tasks: mapToolCallsToTasks(startData.result.toolCalls),
            toolCalls: (startData.result.toolCalls || []).map((call) => ({
              tool: call.tool,
              success: call.result?.success !== false,
            })),
            filesChanged: startData.result.filesChanged || [],
            summary: startData.result.summary,
            responseMessage: startData.message || startData.result.message,
            resultType: 'direct_result',
            rawResult: startData,
          };

          setCurrentPlan(completedPlan);
          setPlanHistory((prev) => [...prev, completedPlan]);
          setIsRunning(false);
          activeJobIdRef.current = null;

          if (startData.result.success === false) {
            const msg = startData.result.error || startData.result.summary || 'Agent failed';
            onError?.(msg);
            throw createAgentError(msg, startData, true);
          }

          if ((startData.result.filesChanged || []).length > 0 && onFilesChanged) {
            const files = await loadProjectFiles();
            onFilesChanged(files);
          }

          return completedPlan;
        }

        if (startData.message && !startData.jobId) {
          const completedPlan: AgentPlan = {
            ...initial,
            id: startData.jobId || `agent-${Date.now()}`,
            status: 'completed',
            completedAt: Date.now(),
            tasks: [
              {
                id: 'agent-message',
                title: 'Agent response',
                description: '',
                status: 'completed',
                result: startData.message,
              },
            ],
            responseMessage: startData.message,
            resultType: 'direct_message',
            rawResult: startData,
          };

          setCurrentPlan(completedPlan);
          setPlanHistory((prev) => [...prev, completedPlan]);
          setIsRunning(false);
          activeJobIdRef.current = null;
          return completedPlan;
        }

        const jobId = startData.jobId;
        if (!jobId) throw new Error('No jobId returned from projects-generate');

        activeJobIdRef.current = jobId;
        const executing: AgentPlan = {
          ...initial,
          id: jobId,
          status: 'executing',
          tasks: [
            {
              id: jobId,
              title: 'Agent job',
              description: '',
              status: 'in_progress',
            },
          ],
          resultType: 'polled_job',
          rawResult: startData,
        };
        setCurrentPlan(executing);

        return await new Promise<AgentPlan>((resolve, reject) => {
          let consecutiveFailures = 0;
          const poll = async () => {
            if (abortRef.current?.signal.aborted) {
              reject(createAgentError('cancelled', startData));
              return;
            }
            try {
              const res = await supabase.functions.invoke('projects-generate', {
                body: { action: 'status', jobId },
              });
              if (res.error) throw new Error(res.error.message || 'Status check failed');
              const data = (res.data || {}) as EdgeStatusResponse;
              const job = data.job;
              if (!job) throw new Error(data.error || 'Agent job not found');

              consecutiveFailures = 0; // Reset counter on success

              const next: AgentPlan = {
                ...executing,
                tasks: buildPollingTasks(job),
                summary: job.result_summary || undefined,
              };

              if (job.status === 'succeeded' || job.status === 'completed') {
                next.status = 'completed';
                next.completedAt = Date.now();
                setCurrentPlan(next);
                setPlanHistory((prev) => [...prev, next]);
                if (onFilesChanged) {
                  const files = await loadProjectFiles();
                  onFilesChanged(files);
                }
                setIsRunning(false);
                activeJobIdRef.current = null;
                clearPollTimer();
                resolve(next);
                return;
              }

              if (job.status === 'failed') {
                next.status = 'failed';
                next.completedAt = Date.now();
                setCurrentPlan(next);
                setPlanHistory((prev) => [...prev, next]);
                const msg = job.error || 'Agent failed';
                onError?.(msg);
                setIsRunning(false);
                activeJobIdRef.current = null;
                clearPollTimer();
                reject(new Error(msg));
                return;
              }

              // Still running — keep polling
              setCurrentPlan(next);
              pollTimerRef.current = setTimeout(poll, pollIntervalMs);
            } catch (err) {
              consecutiveFailures++;
              console.warn(`[useAgentMode] Status check failed (attempt ${consecutiveFailures}/3):`, err);
              
              if (consecutiveFailures < 3) {
                // Keep polling despite temporary status check failure
                pollTimerRef.current = setTimeout(poll, pollIntervalMs);
              } else {
                setIsRunning(false);
                activeJobIdRef.current = null;
                clearPollTimer();
                const msg = err instanceof Error ? err.message : String(err);
                onError?.(msg);
                reject(err);
              }
            }
          };
          poll();
        });
      } catch (err) {
        const handledErr = err as AgentRunError;
        if (!handledErr.agentAlreadyRecorded) {
          setCurrentPlan((prev) =>
            prev ? { ...prev, status: 'failed', completedAt: Date.now(), rawResult: startData } : null,
          );
          setPlanHistory((prev) => {
            const failedPlan: AgentPlan = {
              ...(currentPlanRef.current || initial),
              status: 'failed',
              completedAt: Date.now(),
              rawResult: startData,
            };
            return [...prev, failedPlan];
          });
        }
        setIsRunning(false);
        activeJobIdRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
        throw err;
      }
    },
    [projectId, onFilesChanged, onError, pollIntervalMs, loadProjectFiles, createAgentError, findRecentAgentJob, isRecoverableStartError],
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
