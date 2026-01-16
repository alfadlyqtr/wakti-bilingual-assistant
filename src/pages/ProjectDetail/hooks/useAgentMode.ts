import { useState, useCallback, useRef } from 'react';

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
  id: string;
  goal: string;
  tasks: AgentTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

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

interface UseAgentModeReturn {
  // Planning
  currentPlan: AgentPlan | null;
  isPlanning: boolean;
  isPlanExecuting: boolean;
  createPlan: (goal: string, context: ConversationContext) => Promise<AgentPlan>;
  executePlan: () => Promise<void>;
  cancelPlan: () => void;
  
  // Task tracking
  currentTask: AgentTask | null;
  taskProgress: number;
  updateTaskStatus: (taskId: string, status: AgentTask['status'], result?: string) => void;
  
  // Context memory
  context: ConversationContext;
  updateContext: (update: Partial<ConversationContext>) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  
  // History
  planHistory: AgentPlan[];
  clearHistory: () => void;
}

/**
 * Hook for managing Agent Mode with multi-step planning,
 * context memory, and task chaining
 */
export function useAgentMode(initialContext?: Partial<ConversationContext>): UseAgentModeReturn {
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isPlanExecuting, setIsPlanExecuting] = useState(false);
  const [planHistory, setPlanHistory] = useState<AgentPlan[]>([]);
  const [context, setContext] = useState<ConversationContext>({
    recentMessages: [],
    projectContext: {
      files: [],
      technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
      currentFile: undefined,
    },
    userPreferences: {
      language: 'en',
      isRTL: false,
    },
    ...initialContext,
  });
  
  const executionAbortRef = useRef<AbortController | null>(null);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Create a multi-step plan from a user goal
   */
  const createPlan = useCallback(async (goal: string, ctx: ConversationContext): Promise<AgentPlan> => {
    setIsPlanning(true);
    
    try {
      // Analyze the goal and break it into tasks
      const tasks = await analyzeTasks(goal, ctx);
      
      const plan: AgentPlan = {
        id: generateId(),
        goal,
        tasks,
        status: 'planning',
        createdAt: Date.now(),
      };
      
      setCurrentPlan(plan);
      return plan;
    } finally {
      setIsPlanning(false);
    }
  }, []);

  /**
   * Execute the current plan step by step
   */
  const executePlan = useCallback(async () => {
    if (!currentPlan) return;
    
    setIsPlanExecuting(true);
    executionAbortRef.current = new AbortController();
    
    const updatedPlan: AgentPlan = { ...currentPlan, status: 'executing' };
    setCurrentPlan(updatedPlan);
    
    try {
      for (let i = 0; i < updatedPlan.tasks.length; i++) {
        if (executionAbortRef.current.signal.aborted) break;
        
        const task = updatedPlan.tasks[i];
        
        // Update task to in_progress
        const tasksWithProgress = [...updatedPlan.tasks];
        tasksWithProgress[i] = { 
          ...task, 
          status: 'in_progress',
          startedAt: Date.now(),
        };
        setCurrentPlan({ ...updatedPlan, tasks: tasksWithProgress });
        
        // Simulate task execution (replace with actual AI calls)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mark task as completed
        tasksWithProgress[i] = {
          ...tasksWithProgress[i],
          status: 'completed',
          completedAt: Date.now(),
          result: `Completed: ${task.title}`,
        };
        setCurrentPlan({ ...updatedPlan, tasks: tasksWithProgress });
      }
      
      // Plan completed
      const completedPlan: AgentPlan = {
        ...updatedPlan,
        status: 'completed',
        completedAt: Date.now(),
      };
      setCurrentPlan(completedPlan);
      setPlanHistory(prev => [...prev, completedPlan]);
      
    } catch (error) {
      setCurrentPlan({
        ...updatedPlan,
        status: 'failed',
        completedAt: Date.now(),
      });
    } finally {
      setIsPlanExecuting(false);
      executionAbortRef.current = null;
    }
  }, [currentPlan]);

  /**
   * Cancel current plan execution
   */
  const cancelPlan = useCallback(() => {
    if (executionAbortRef.current) {
      executionAbortRef.current.abort();
    }
    setIsPlanExecuting(false);
    setCurrentPlan(prev => prev ? { ...prev, status: 'failed' } : null);
  }, []);

  /**
   * Update a specific task's status
   */
  const updateTaskStatus = useCallback((
    taskId: string, 
    status: AgentTask['status'], 
    result?: string
  ) => {
    setCurrentPlan(prev => {
      if (!prev) return null;
      
      const tasks = prev.tasks.map(task => 
        task.id === taskId 
          ? { ...task, status, result, completedAt: status === 'completed' ? Date.now() : undefined }
          : task
      );
      
      return { ...prev, tasks };
    });
  }, []);

  /**
   * Update conversation context
   */
  const updateContext = useCallback((update: Partial<ConversationContext>) => {
    setContext(prev => ({ ...prev, ...update }));
  }, []);

  /**
   * Add a message to context memory
   */
  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setContext(prev => ({
      ...prev,
      recentMessages: [
        ...prev.recentMessages.slice(-19), // Keep last 20 messages
        { role, content },
      ],
    }));
  }, []);

  /**
   * Clear plan history
   */
  const clearHistory = useCallback(() => {
    setPlanHistory([]);
  }, []);

  // Calculate current task and progress
  const currentTask = currentPlan?.tasks.find(t => t.status === 'in_progress') || null;
  const completedTasks = currentPlan?.tasks.filter(t => t.status === 'completed').length || 0;
  const totalTasks = currentPlan?.tasks.length || 0;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    currentPlan,
    isPlanning,
    isPlanExecuting,
    createPlan,
    executePlan,
    cancelPlan,
    currentTask,
    taskProgress,
    updateTaskStatus,
    context,
    updateContext,
    addMessage,
    planHistory,
    clearHistory,
  };
}

/**
 * Analyze a goal and break it into executable tasks
 */
async function analyzeTasks(goal: string, context: ConversationContext): Promise<AgentTask[]> {
  const generateId = () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  // Smart task decomposition based on goal keywords
  const lowerGoal = goal.toLowerCase();
  const tasks: AgentTask[] = [];
  
  // File/Component creation
  if (lowerGoal.includes('create') || lowerGoal.includes('add') || lowerGoal.includes('new')) {
    tasks.push({
      id: generateId(),
      title: 'Analyze requirements',
      description: 'Understand the structure and dependencies needed',
      status: 'pending',
    });
    tasks.push({
      id: generateId(),
      title: 'Create component/file structure',
      description: 'Generate the necessary files and boilerplate',
      status: 'pending',
    });
  }
  
  // Styling/UI changes
  if (lowerGoal.includes('style') || lowerGoal.includes('design') || lowerGoal.includes('ui') || lowerGoal.includes('color')) {
    tasks.push({
      id: generateId(),
      title: 'Update styling',
      description: 'Apply CSS/Tailwind changes',
      status: 'pending',
    });
  }
  
  // Logic/Feature implementation
  if (lowerGoal.includes('function') || lowerGoal.includes('logic') || lowerGoal.includes('feature')) {
    tasks.push({
      id: generateId(),
      title: 'Implement core logic',
      description: 'Write the main functionality',
      status: 'pending',
    });
    tasks.push({
      id: generateId(),
      title: 'Add error handling',
      description: 'Ensure proper error boundaries and validation',
      status: 'pending',
    });
  }
  
  // Integration
  if (lowerGoal.includes('api') || lowerGoal.includes('database') || lowerGoal.includes('supabase')) {
    tasks.push({
      id: generateId(),
      title: 'Setup data integration',
      description: 'Connect to backend/API',
      status: 'pending',
    });
  }
  
  // Default tasks if none matched
  if (tasks.length === 0) {
    tasks.push({
      id: generateId(),
      title: 'Analyze request',
      description: 'Understand user requirements',
      status: 'pending',
    });
    tasks.push({
      id: generateId(),
      title: 'Implement changes',
      description: 'Apply requested modifications',
      status: 'pending',
    });
    tasks.push({
      id: generateId(),
      title: 'Verify and test',
      description: 'Ensure changes work correctly',
      status: 'pending',
    });
  }
  
  // Always add verification task
  tasks.push({
    id: generateId(),
    title: 'Final verification',
    description: 'Review and validate all changes',
    status: 'pending',
  });
  
  return tasks;
}
