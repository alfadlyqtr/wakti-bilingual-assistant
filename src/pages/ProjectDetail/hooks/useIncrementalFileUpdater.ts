import { useRef, useEffect } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import type { GeneratedFiles } from '../types';

/**
 * Hook to use inside SandpackProvider for incremental file updates
 * This prevents full re-renders by using sandpack.updateFile() instead of key changes
 * 
 * ⚠️ IMPORTANT: This hook MUST be used inside a SandpackProvider context.
 * Do NOT import this from barrel exports - import directly from this file
 * only in components that are wrapped in SandpackProvider.
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
