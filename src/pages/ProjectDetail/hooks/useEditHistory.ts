import { useState, useCallback, useRef } from 'react';

interface HistoryEntry {
  id: string;
  timestamp: number;
  files: Record<string, string>;
  description: string;
}

interface UseEditHistoryOptions {
  maxHistory?: number;
}

interface UseEditHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;
  entries: HistoryEntry[];
  pushState: (files: Record<string, string>, description: string) => void;
  undo: () => Record<string, string> | null;
  redo: () => Record<string, string> | null;
  clear: () => void;
  getHistory: () => HistoryEntry[];
}

/**
 * Hook for managing undo/redo history for visual edits
 * Uses a past/present/future stack pattern
 */
export function useEditHistory({ 
  maxHistory = 50 
}: UseEditHistoryOptions = {}): UseEditHistoryReturn {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const currentRef = useRef<HistoryEntry | null>(null);

  const generateId = () => `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Push a new state to history (called before applying changes)
   */
  const pushState = useCallback((files: Record<string, string>, description: string) => {
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: Date.now(),
      files: { ...files },
      description,
    };

    // If we have a current state, push it to past
    if (currentRef.current) {
      setPast(prev => {
        const newPast = [...prev, currentRef.current!];
        // Limit history size
        if (newPast.length > maxHistory) {
          return newPast.slice(-maxHistory);
        }
        return newPast;
      });
    }

    // Clear future on new action (branching)
    setFuture([]);
    
    // Set new current
    currentRef.current = entry;
  }, [maxHistory]);

  /**
   * Undo: Move current to future, restore from past
   */
  const undo = useCallback((): Record<string, string> | null => {
    if (past.length === 0) return null;

    const newPast = [...past];
    const previousState = newPast.pop()!;

    // Push current to future
    if (currentRef.current) {
      setFuture(prev => [currentRef.current!, ...prev]);
    }

    // Restore previous state
    currentRef.current = previousState;
    setPast(newPast);

    return previousState.files;
  }, [past]);

  /**
   * Redo: Move from future to current, push current to past
   */
  const redo = useCallback((): Record<string, string> | null => {
    if (future.length === 0) return null;

    const newFuture = [...future];
    const nextState = newFuture.shift()!;

    // Push current to past
    if (currentRef.current) {
      setPast(prev => [...prev, currentRef.current!]);
    }

    // Restore next state
    currentRef.current = nextState;
    setFuture(newFuture);

    return nextState.files;
  }, [future]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
    currentRef.current = null;
  }, []);

  /**
   * Get full history for display
   */
  const getHistory = useCallback((): HistoryEntry[] => {
    const all: HistoryEntry[] = [...past];
    if (currentRef.current) {
      all.push(currentRef.current);
    }
    return all;
  }, [past]);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historyLength: past.length + (currentRef.current ? 1 : 0),
    currentIndex: past.length,
    entries: getHistory(),
    pushState,
    undo,
    redo,
    clear,
    getHistory,
  };
}
