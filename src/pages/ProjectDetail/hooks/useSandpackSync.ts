// useSandpackSync - Optimized Sandpack file synchronization
// Part of Group A Enhancement: Performance - Fix Sandpack key strategy

import { useState, useCallback, useRef, useMemo } from 'react';

interface UseSandpackSyncProps {
  projectId: string | undefined;
}

/**
 * Manages Sandpack file synchronization with optimized key strategy.
 * 
 * CRITICAL FIX: Previously used `key={Date.now()}` which forced full rebuilds.
 * Now uses stable project-based key with manual refresh capability.
 */
export function useSandpackSync({ projectId }: UseSandpackSyncProps) {
  // Stable Sandpack key based on project ID
  // Only changes when explicitly refreshed or reverted
  const [sandpackKey, setSandpackKey] = useState(0);
  
  // Track file changes for incremental updates
  const previousFilesRef = useRef<Record<string, string>>({});
  
  /**
   * Generate a stable key for Sandpack that doesn't change on every render.
   * Format: sandpack-{projectId}-{version}
   */
  const stableKey = useMemo(() => {
    return `sandpack-${projectId || 'new'}-${sandpackKey}`;
  }, [projectId, sandpackKey]);
  
  /**
   * Force a full Sandpack refresh.
   * Use sparingly - only for reverting to snapshots or major file changes.
   */
  const forceRefresh = useCallback(() => {
    setSandpackKey(prev => prev + 1);
  }, []);
  
  /**
   * Check if files have changed in a way that requires refresh.
   * Returns true if structure changed (files added/removed).
   * Returns false if only content changed (can use updateFile instead).
   */
  const checkFilesChanged = useCallback((
    newFiles: Record<string, string>
  ): { structureChanged: boolean; contentChanges: Record<string, string> } => {
    const prevFiles = previousFilesRef.current;
    const prevKeys = Object.keys(prevFiles);
    const newKeys = Object.keys(newFiles);
    
    // Check if file structure changed (files added or removed)
    const structureChanged = 
      prevKeys.length !== newKeys.length ||
      !prevKeys.every(key => newKeys.includes(key));
    
    // Find content changes
    const contentChanges: Record<string, string> = {};
    for (const [path, content] of Object.entries(newFiles)) {
      if (prevFiles[path] !== content) {
        contentChanges[path] = content;
      }
    }
    
    // Update ref for next comparison
    previousFilesRef.current = { ...newFiles };
    
    return { structureChanged, contentChanges };
  }, []);
  
  /**
   * Handle file updates with smart refresh strategy.
   * Only forces full rebuild when file structure changes.
   */
  const handleFilesUpdate = useCallback((
    newFiles: Record<string, string>,
    onIncrementalUpdate?: (changes: Record<string, string>) => void
  ) => {
    const { structureChanged, contentChanges } = checkFilesChanged(newFiles);
    
    if (structureChanged) {
      // File structure changed - need full refresh
      console.log('[useSandpackSync] File structure changed, forcing refresh');
      forceRefresh();
    } else if (Object.keys(contentChanges).length > 0 && onIncrementalUpdate) {
      // Only content changed - can use incremental update
      console.log('[useSandpackSync] Content changed in', Object.keys(contentChanges).length, 'files');
      onIncrementalUpdate(contentChanges);
    }
  }, [checkFilesChanged, forceRefresh]);
  
  /**
   * Initialize file tracking without triggering refresh.
   * Call this when loading project files initially.
   */
  const initializeFiles = useCallback((files: Record<string, string>) => {
    previousFilesRef.current = { ...files };
  }, []);
  
  /**
   * Reset file tracking (for when project changes).
   */
  const resetTracking = useCallback(() => {
    previousFilesRef.current = {};
    setSandpackKey(0);
  }, []);
  
  return {
    // State
    sandpackKey,
    stableKey,
    
    // Actions
    forceRefresh,
    handleFilesUpdate,
    initializeFiles,
    resetTracking,
    checkFilesChanged,
    
    // Setter (for manual control)
    setSandpackKey,
  };
}
