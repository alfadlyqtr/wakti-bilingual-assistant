import { useState, useCallback, useRef, useEffect } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import type { GeneratedFiles } from '../types';

interface UseSandpackFilesOptions {
  projectId: string | undefined;
  files: GeneratedFiles;
}

interface UseSandpackFilesReturn {
  activeFile: string;
  openTabs: string[];
  setActiveFile: (path: string) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  updateFileIncrementally: (path: string, content: string) => void;
}

/**
 * Custom hook for managing Sandpack file state with persistence
 * and incremental updates (no full re-renders)
 */
export function useSandpackFiles({ projectId, files }: UseSandpackFilesOptions): UseSandpackFilesReturn {
  // Load persisted state from localStorage
  const getStorageKey = (key: string) => `wakti-coder-${projectId}-${key}`;
  
  const [activeFile, setActiveFileState] = useState<string>(() => {
    if (typeof window !== 'undefined' && projectId) {
      const saved = localStorage.getItem(getStorageKey('activeFile'));
      if (saved && files[saved]) return saved;
    }
    return '/App.js';
  });

  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(getStorageKey('openTabs'));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed.filter(tab => files[tab]);
        }
      } catch {}
    }
    return ['/App.js'];
  });

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(getStorageKey('activeFile'), activeFile);
      localStorage.setItem(getStorageKey('openTabs'), JSON.stringify(openTabs));
    }
  }, [activeFile, openTabs, projectId]);

  // Set active file with persistence
  const setActiveFile = useCallback((path: string) => {
    setActiveFileState(path);
  }, []);

  // Open a file (add to tabs if not already open)
  const openFile = useCallback((path: string) => {
    setActiveFileState(path);
    setOpenTabs(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
  }, []);

  // Close a tab
  const closeTab = useCallback((path: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(p => p !== path);
      // If we're closing the active tab, switch to another
      if (activeFile === path && newTabs.length > 0) {
        setActiveFileState(newTabs[0]);
      }
      return newTabs.length > 0 ? newTabs : ['/App.js'];
    });
  }, [activeFile]);

  // Placeholder for incremental file update (will be implemented in SandpackWrapper)
  const updateFileIncrementally = useCallback((path: string, content: string) => {
    // This will be overridden by the SandpackWrapper component
    // which has access to the sandpack context
    console.log('[useSandpackFiles] Incremental update for:', path);
  }, []);

  return {
    activeFile,
    openTabs,
    setActiveFile,
    openFile,
    closeTab,
    updateFileIncrementally,
  };
}

/**
 * Hook to use inside SandpackProvider for incremental file updates
 * This prevents full re-renders by using sandpack.updateFile() instead of key changes
 */
export function useIncrementalFileUpdater(files: GeneratedFiles) {
  const { sandpack } = useSandpack();
  const prevFilesRef = useRef<GeneratedFiles>({});

  useEffect(() => {
    // Check for file changes and update incrementally
    Object.entries(files).forEach(([path, content]) => {
      if (prevFilesRef.current[path] !== content) {
        console.log('[IncrementalFileUpdater] Updating file:', path);
        try {
          sandpack.updateFile(path, content);
        } catch (err) {
          console.error('[IncrementalFileUpdater] Error updating file:', path, err);
        }
      }
    });

    // Check for deleted files
    Object.keys(prevFilesRef.current).forEach(path => {
      if (!(path in files)) {
        console.log('[IncrementalFileUpdater] File removed:', path);
        try {
          sandpack.deleteFile(path);
        } catch (err) {
          console.error('[IncrementalFileUpdater] Error deleting file:', path, err);
        }
      }
    });

    // Update ref for next comparison
    prevFilesRef.current = { ...files };
  }, [files, sandpack]);

  return null;
}
