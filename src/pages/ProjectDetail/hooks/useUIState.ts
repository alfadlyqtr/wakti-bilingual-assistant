import { useState, useCallback, useEffect, useRef } from 'react';

interface UseUIStateOptions {
  isRTL: boolean;
}

interface UseUIStateReturn {
  // Panel state
  leftPanelWidth: number;
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  leftPanelMode: 'chat' | 'code';
  setLeftPanelMode: React.Dispatch<React.SetStateAction<'chat' | 'code'>>;
  rightPanelMode: 'preview' | 'code' | 'both';
  setRightPanelMode: React.Dispatch<React.SetStateAction<'preview' | 'code' | 'both'>>;
  isDraggingDivider: boolean;
  
  // Device view
  deviceView: 'desktop' | 'tablet' | 'mobile';
  setDeviceView: React.Dispatch<React.SetStateAction<'desktop' | 'tablet' | 'mobile'>>;
  
  // Mobile state
  mobileTab: 'chat' | 'preview';
  setMobileTab: React.Dispatch<React.SetStateAction<'chat' | 'preview'>>;
  
  // Main tabs
  mainTab: 'builder' | 'server';
  setMainTab: React.Dispatch<React.SetStateAction<'builder' | 'server'>>;
  
  // Modals and drawers
  instructionsDrawerOpen: boolean;
  setInstructionsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showPublishModal: boolean;
  setShowPublishModal: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Message pagination
  visibleMessagesCount: number;
  setVisibleMessagesCount: React.Dispatch<React.SetStateAction<number>>;
  
  // Divider handlers
  handleDividerPointerDown: (e: React.PointerEvent) => void;
  handleDividerPointerMove: (e: React.PointerEvent) => void;
  handleDividerPointerUp: (e: React.PointerEvent) => void;
}

const MESSAGES_PER_PAGE = 10;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 720;

export function useUIState({ isRTL }: UseUIStateOptions): UseUIStateReturn {
  // Left panel width with localStorage persistence
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wakti-coder-leftPanelWidth');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH && parsed <= MAX_PANEL_WIDTH) return parsed;
      }
      return window.innerWidth >= 1024 ? 480 : 420;
    }
    return 420;
  });
  
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const dividerDragRef = useRef({ active: false, startX: 0, startWidth: 0 });
  
  // Panel modes
  const [leftPanelMode, setLeftPanelMode] = useState<'chat' | 'code'>('chat');
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'code' | 'both'>('preview');
  
  // Device view - default to mobile on mobile devices
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile';
    }
    return 'desktop';
  });
  
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('preview');
  
  // Main tab state (Builder vs Server)
  const [mainTab, setMainTab] = useState<'builder' | 'server'>('builder');
  
  // Modals and drawers
  const [instructionsDrawerOpen, setInstructionsDrawerOpen] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  // Message pagination
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(MESSAGES_PER_PAGE);

  // Persist left panel width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wakti-coder-leftPanelWidth', String(leftPanelWidth));
    }
  }, [leftPanelWidth]);

  // Divider drag handlers
  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dividerDragRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: leftPanelWidth,
    };
    setIsDraggingDivider(true);
    const divider = e.currentTarget as HTMLElement;
    divider.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftPanelWidth]);

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dividerDragRef.current.active) return;
    const deltaX = e.clientX - dividerDragRef.current.startX;
    let newWidth = dividerDragRef.current.startWidth + deltaX;
    newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth));
    setLeftPanelWidth(newWidth);
  }, []);

  const handleDividerPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dividerDragRef.current.active) return;
    dividerDragRef.current.active = false;
    setIsDraggingDivider(false);
    const divider = e.currentTarget as HTMLElement;
    if (divider.hasPointerCapture(e.pointerId)) {
      divider.releasePointerCapture(e.pointerId);
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return {
    leftPanelWidth,
    setLeftPanelWidth,
    leftPanelMode,
    setLeftPanelMode,
    rightPanelMode,
    setRightPanelMode,
    isDraggingDivider,
    deviceView,
    setDeviceView,
    mobileTab,
    setMobileTab,
    mainTab,
    setMainTab,
    instructionsDrawerOpen,
    setInstructionsDrawerOpen,
    showPublishModal,
    setShowPublishModal,
    visibleMessagesCount,
    setVisibleMessagesCount,
    handleDividerPointerDown,
    handleDividerPointerMove,
    handleDividerPointerUp,
  };
}
