import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgentStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
  result?: string;
  duration?: number;
  startedAt?: number;
}

export interface AgentExecutionResult {
  success: boolean;
  files?: Record<string, string>;
  summary?: string;
  error?: string;
  steps: AgentStep[];
}

interface UseAgentExecutionOptions {
  projectId: string;
  currentFiles: Record<string, string>;
  onFilesUpdated?: (files: Record<string, string>) => void;
  onStepUpdate?: (steps: AgentStep[]) => void;
}

export function useAgentExecution({
  projectId,
  currentFiles,
  onFilesUpdated,
  onStepUpdate,
}: UseAgentExecutionOptions) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generateId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
      // Call the projects-generate edge function in agent mode
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/projects-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            projectId,
            mode: 'agent',
            prompt,
            currentFiles,
            conversationHistory: context?.conversationHistory,
            debugContext: context?.debugContext,
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
    const executedTools: string[] = [];

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

          // Handle tool execution events
          if (event.type === 'tool_start') {
            const stepId = addStep({
              title: getToolTitle(event.tool),
              description: event.description,
              status: 'in_progress',
              tool: event.tool,
              startedAt: Date.now(),
            });
            executedTools.push(stepId);
          } else if (event.type === 'tool_end') {
            const lastStepId = executedTools[executedTools.length - 1];
            if (lastStepId) {
              updateStep(lastStepId, {
                status: event.success ? 'completed' : 'failed',
                result: event.result,
                duration: Date.now() - (steps.find(s => s.id === lastStepId)?.startedAt || Date.now()),
              });
            }
          } else if (event.type === 'file_written') {
            resultFiles[event.path] = event.content;
          } else if (event.type === 'complete') {
            summary = event.summary || '';
            if (event.files) {
              resultFiles = { ...resultFiles, ...event.files };
            }
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
      steps,
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
