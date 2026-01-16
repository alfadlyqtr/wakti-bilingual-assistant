import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ResizeDimensions, SelectedElementInfo } from '../../types';

interface ResizeHandlesProps {
  element: SelectedElementInfo;
  onResize: (dimensions: ResizeDimensions) => void;
  onResizeEnd?: (dimensions: ResizeDimensions) => void;
}

type HandlePosition = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  n: 'cursor-ns-resize',
  s: 'cursor-ns-resize',
  e: 'cursor-ew-resize',
  w: 'cursor-ew-resize',
  ne: 'cursor-nesw-resize',
  sw: 'cursor-nesw-resize',
  nw: 'cursor-nwse-resize',
  se: 'cursor-nwse-resize',
};

const HANDLE_POSITIONS: Record<HandlePosition, string> = {
  n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
  nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
};

export function ResizeHandles({ element, onResize, onResizeEnd }: ResizeHandlesProps) {
  const [isDragging, setIsDragging] = useState<HandlePosition | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const currentDimensions = useRef({ width: 0, height: 0 });

  // Get initial dimensions from element rect
  const initialWidth = element.rect?.width || 100;
  const initialHeight = element.rect?.height || 100;

  const handleMouseDown = (handle: HandlePosition) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(handle);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: initialWidth,
      height: initialHeight,
    };
    currentDimensions.current = {
      width: initialWidth,
      height: initialHeight,
    };
    
    document.body.style.cursor = HANDLE_CURSORS[handle].replace('cursor-', '');
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      let newWidth = startPos.current.width;
      let newHeight = startPos.current.height;

      // Calculate new dimensions based on which handle is being dragged
      if (isDragging.includes('e')) newWidth += deltaX;
      if (isDragging.includes('w')) newWidth -= deltaX;
      if (isDragging.includes('s')) newHeight += deltaY;
      if (isDragging.includes('n')) newHeight -= deltaY;

      // Enforce minimum size
      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      currentDimensions.current = { width: newWidth, height: newHeight };
      onResize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      if (onResizeEnd) {
        onResizeEnd(currentDimensions.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, onResizeEnd]);

  const handles: HandlePosition[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          onMouseDown={handleMouseDown(handle)}
          className={cn(
            "absolute w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-lg z-[301]",
            HANDLE_POSITIONS[handle],
            HANDLE_CURSORS[handle],
            isDragging === handle && "bg-indigo-400 scale-125"
          )}
        />
      ))}
    </>
  );
}
