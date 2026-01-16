import { useState, useCallback, useRef } from 'react';

export interface AgentStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
  result?: string;
  duration?: number;
  startedAt?: number;
  // Enhanced for parallel execution
  dependsOn?: string[];
  parallelGroup?: string;
}

export interface AgentExecutionResult {
  success: boolean;
  files?: Record<string, string>;
  summary?: string;
  error?: string;
  steps: AgentStep[];
  toolsExecuted?: string[];
}

interface ToolExecution {
  tool: string;
  args: Record<string, any>;
  result?: any;
  error?: string;
  duration?: number;
}

interface UseAgentExecutionOptions {
  projectId: string;
  currentFiles: Record<string, string>;
  onFilesUpdated?: (files: Record<string, string>) => void;
  onStepUpdate?: (steps: AgentStep[]) => void;
  onToolExecuted?: (tool: ToolExecution) => void;
  debugContext?: any;
}

export function useAgentExecution({
  projectId,
  currentFiles,
  onFilesUpdated,
  onStepUpdate,
  onToolExecuted,
  debugContext,
}: UseAgentExecutionOptions) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toolsExecuted, setToolsExecuted] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const stepsRef = useRef<AgentStep[]>([]);

  const generateId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Keep ref in sync for closure access
  stepsRef.current = steps;

  const updateStep = useCallback((stepId: string, update: Partial<AgentStep>) => {
    setSteps(prev => {
      const updated = prev.map(s => s.id === stepId ? { ...s, ...update } : s);
      onStepUpdate?.(updated);
      return updated;
    });
  }, [onStepUpdate]);

  const addStep = useCallback((step: Omit<AgentStep, 'id'>) => {
    const newStep: AgentStep = { ...step, id: generateId() };
    setSteps(prev => {
      const updated = [...prev, newStep];
      onStepUpdate?.(updated);
      return updated;
    });
    return newStep.id;
  }, [onStepUpdate]);

  const recordToolExecution = useCallback((tool: string, args: Record<string, any>, result?: any, error?: string, duration?: number) => {
    setToolsExecuted(prev => [...prev, tool]);
    onToolExecuted?.({ tool, args, result, error, duration });
  }, [onToolExecuted]);

  /**
   * Execute agent mode with real AI generation
   * Connects to the projects-generate edge function with mode='agent'
   */
  const executeAgent = useCallback(async (
    prompt: string,
    context?: {
      conversationHistory?: Array<{ role: string; content: string }>;
      debugContext?: any;
      uploadedAssets?: any[];
      images?: Array<{ type: string; data: string }>;
    }
  ): Promise<AgentExecutionResult> => {
    if (!projectId) {
      return { success: false, error: 'No project ID', steps: [] };
    }

    setIsExecuting(true);
    setError(null);
    setSteps([]);
    abortRef.current = new AbortController();

    // Initial planning step
    const planStepId = addStep({
      title: 'Analyzing request',
      description: 'Understanding what needs to be done',
      status: 'in_progress',
      tool: 'thinking',
      startedAt: Date.now(),
    });

    try {
      // Get auth token if available
      let authToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
        }
      } catch {}

      // Call the projects-generate edge function in agent mode
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/projects-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            projectId,
            mode: 'agent',
            prompt,
            currentFiles,
            conversationHistory: context?.conversationHistory,
            debugContext: debugContext || context?.debugContext,
            uploadedAssets: context?.uploadedAssets,
            images: context?.images,
          }),
          signal: abortRef.current.signal,
        }
      );

      // Complete planning step
      updateStep(planStepId, {
        status: 'completed',
        duration: Date.now() - (steps.find(s => s.id === planStepId)?.startedAt || Date.now()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      // Check if streaming response
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response with tool calls
        return await handleStreamingResponse(response);
      } else {
        // Handle JSON response
        const data = await response.json();
        return handleJsonResponse(data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateStep(planStepId, { status: 'failed', result: 'Cancelled by user' });
        return { success: false, error: 'Execution cancelled', steps };
      }

      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      updateStep(planStepId, { status: 'failed', result: errorMsg });
      
      return { success: false, error: errorMsg, steps };
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [projectId, currentFiles, addStep, updateStep, steps]);

  /**
   * Handle streaming SSE response with tool execution updates
   */
  const handleStreamingResponse = async (response: Response): Promise<AgentExecutionResult> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let resultFiles: Record<string, string> = {};
    let summary = '';
    const executedToolSteps: Map<string, string> = new Map(); // tool -> stepId
    const toolExecutionQueue: Array<{ tool: string; stepId: string; startedAt: number }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          // Handle different event types
          switch (event.type) {
            case 'thinking':
            case 'plan': {
              // AI is planning - update thinking step
              const existingThinking = stepsRef.current.find(s => s.tool === 'thinking' && s.status === 'in_progress');
              if (existingThinking) {
                updateStep(existingThinking.id, { description: event.content || event.plan });
              }
              break;
            }

            case 'tool_start': {
              const stepId = addStep({
                title: getToolTitle(event.tool),
                description: event.description || event.args?.path || '',
                status: 'in_progress',
                tool: event.tool,
                startedAt: Date.now(),
                parallelGroup: event.parallelGroup,
              });
              executedToolSteps.set(event.tool + (event.id || ''), stepId);
              toolExecutionQueue.push({ tool: event.tool, stepId, startedAt: Date.now() });
              break;
            }

            case 'tool_end': {
              const toolKey = event.tool + (event.id || '');
              const stepId = executedToolSteps.get(toolKey) || toolExecutionQueue[toolExecutionQueue.length - 1]?.stepId;
              if (stepId) {
                const queueItem = toolExecutionQueue.find(t => t.stepId === stepId);
                const duration = queueItem ? Date.now() - queueItem.startedAt : 0;
                
                updateStep(stepId, {
                  status: event.success !== false ? 'completed' : 'failed',
                  result: event.result || event.error,
                  duration,
                });
                
                recordToolExecution(event.tool, event.args || {}, event.result, event.error, duration);
              }
              break;
            }

            case 'file_written':
            case 'file_updated': {
              resultFiles[event.path] = event.content;
              // Also update any write_file step with this path
              const writeStep = stepsRef.current.find(s => 
                s.tool === 'write_file' && 
                s.status === 'in_progress' && 
                s.description?.includes(event.path)
              );
              if (writeStep) {
                updateStep(writeStep.id, { status: 'completed', result: `Wrote ${event.path}` });
              }
              break;
            }

            case 'search_replace_success': {
              const srStep = stepsRef.current.find(s => 
                s.tool === 'search_replace' && s.status === 'in_progress'
              );
              if (srStep) {
                updateStep(srStep.id, { status: 'completed', result: event.message || 'Code updated' });
              }
              break;
            }

            case 'error': {
              // Mark current in-progress step as failed
              const inProgress = stepsRef.current.find(s => s.status === 'in_progress');
              if (inProgress) {
                updateStep(inProgress.id, { status: 'failed', result: event.message || event.error });
              }
              break;
            }

            case 'complete':
            case 'task_complete': {
              summary = event.summary || event.message || '';
              if (event.files) {
                resultFiles = { ...resultFiles, ...event.files };
              }
              // Add completion step
              addStep({
                title: 'Complete',
                description: summary.slice(0, 100),
                status: 'completed',
                tool: 'task_complete',
              });
              break;
            }

            default:
              // Log unknown event types for debugging
              console.log('[AgentExecution] Unknown event:', event.type, event);
          }
        } catch {
          // Ignore parse errors for partial JSON
        }
      }
    }

    // Update files if we got any
    if (Object.keys(resultFiles).length > 0) {
      onFilesUpdated?.(resultFiles);
    }

    return {
      success: true,
      files: resultFiles,
      summary,
      steps: stepsRef.current,
      toolsExecuted: Array.from(executedToolSteps.keys()),
    };
  };

  /**
   * Handle non-streaming JSON response
   */
  const handleJsonResponse = (data: any): AgentExecutionResult => {
    // Add execution step
    const execStepId = addStep({
      title: 'Applying changes',
      description: 'Writing files',
      status: 'in_progress',
      tool: 'write_file',
      startedAt: Date.now(),
    });

    const files = data.files || {};
    const summary = data.summary || data.resultSummary || '';

    // Update files
    if (Object.keys(files).length > 0) {
      onFilesUpdated?.(files);
    }

    updateStep(execStepId, {
      status: 'completed',
      result: `Updated ${Object.keys(files).length} file(s)`,
      duration: 100,
    });

    // Add completion step
    addStep({
      title: 'Complete',
      description: summary,
      status: 'completed',
      tool: 'task_complete',
    });

    return {
      success: true,
      files,
      summary,
      steps,
    };
  };

  /**
   * Cancel ongoing execution
   */
  const cancelExecution = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  /**
   * Reset agent state
   */
  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
    setIsExecuting(false);
  }, []);

  return {
    isExecuting,
    steps,
    error,
    executeAgent,
    cancelExecution,
    reset,
  };
}

// Helper to get human-readable tool titles
function getToolTitle(tool: string): string {
  const titles: Record<string, string> = {
    read_file: 'Reading file',
    list_files: 'Listing files',
    write_file: 'Writing file',
    search_replace: 'Updating code',
    insert_code: 'Inserting code',
    delete_file: 'Deleting file',
    task_complete: 'Completing task',
    thinking: 'Thinking',
  };
  return titles[tool] || tool;
}
