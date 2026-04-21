import { useState, useCallback, useEffect } from 'react';
import type { GeneratedFiles } from '../types';

// NOTE: useIncrementalFileUpdater has been moved to a separate file
// (useIncrementalFileUpdater.ts) to prevent module-level useSandpack() calls
// when this file is imported outside of SandpackProvider context.

interface UseSandpackFilesOptions {
  projectId: string | undefined;
  files: GeneratedFiles;
}

interface UseSandpackFilesReturn {
  activeFile: string;
  openTabs: string[];
  setActiveFile: (path: string) => void;
  setOpenTabs: (paths: string[]) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  updateFileIncrementally: (path: string, content: string) => void;
}

const ENTRY_FILE_CANDIDATES = [
  '/src/App.tsx',
  '/src/App.jsx',
  '/src/App.js',
  '/App.tsx',
  '/App.jsx',
  '/App.js',
  '/src/main.tsx',
  '/src/main.jsx',
  '/src/main.js',
  '/index.js',
] as const;

const getPreferredFile = (files: GeneratedFiles) => {
  for (const path of ENTRY_FILE_CANDIDATES) {
    if (files[path] !== undefined) return path;
  }

  const availablePaths = Object.keys(files);
  return availablePaths[0] || '/App.js';
};

const normalizeTabs = (paths: string[], files: GeneratedFiles, fallbackPath: string) => {
  const unique = Array.from(new Set(paths)).filter(path => files[path] !== undefined);
  if (unique.length > 0) return unique;
  return files[fallbackPath] !== undefined ? [fallbackPath] : [];
};

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
    return getPreferredFile(files);
  });

  const [openTabs, setOpenTabsState] = useState<string[]>(() => {
    const fallbackFile = getPreferredFile(files);
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(getStorageKey('openTabs'));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return normalizeTabs(parsed, files, fallbackFile);
        }
      } catch {}
    }
    return normalizeTabs([fallbackFile], files, fallbackFile);
  });

  useEffect(() => {
    const fallbackFile = getPreferredFile(files);
    if (files[activeFile] === undefined && fallbackFile !== activeFile) {
      setActiveFileState(fallbackFile);
    }
  }, [activeFile, files]);

  useEffect(() => {
    const fallbackFile = files[activeFile] !== undefined ? activeFile : getPreferredFile(files);
    setOpenTabsState(prev => normalizeTabs(prev, files, fallbackFile));
  }, [activeFile, files]);

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(getStorageKey('activeFile'), activeFile);
      localStorage.setItem(getStorageKey('openTabs'), JSON.stringify(openTabs));
    }
  }, [activeFile, openTabs, projectId]);

  // Set active file with persistence
  const setActiveFile = useCallback((path: string) => {
    setOpenTabsState(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
    setActiveFileState(path);
  }, []);

  const setOpenTabs = useCallback((paths: string[]) => {
    const fallbackFile = files[activeFile] !== undefined ? activeFile : getPreferredFile(files);
    setOpenTabsState(normalizeTabs(paths, files, fallbackFile));
  }, [activeFile, files]);

  // Open a file (add to tabs if not already open)
  const openFile = useCallback((path: string) => {
    setActiveFileState(path);
    setOpenTabsState(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
  }, []);

  // Close a tab
  const closeTab = useCallback((path: string) => {
    setOpenTabsState(prev => {
      const newTabs = prev.filter(p => p !== path);
      const fallbackFile = getPreferredFile(files);
      // If we're closing the active tab, switch to another
      if (activeFile === path && newTabs.length > 0) {
        setActiveFileState(newTabs[0]);
      } else if (activeFile === path) {
        setActiveFileState(fallbackFile);
      }
      return normalizeTabs(newTabs, files, fallbackFile);
    });
  }, [activeFile, files]);

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
    setOpenTabs,
    openFile,
    closeTab,
    updateFileIncrementally,
  };
}

// useIncrementalFileUpdater has been moved to ./useIncrementalFileUpdater.ts
// Import it directly from that file when inside SandpackProvider context.
