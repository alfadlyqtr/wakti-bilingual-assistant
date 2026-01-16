// ============================================================================
// HOOKS BARREL EXPORT
// Single entry point for all custom hooks
// ============================================================================

// Mobile & Responsive
export { useIsMobile } from './use-mobile';

// Toast & Notifications
export { useToast, toast } from './use-toast';
export { useToastHelper } from './useToastHelper';
export { useGiftNotifications } from './useGiftNotifications';
export { useNotificationHistory } from './useNotificationHistory';
export { useRsvpNotifications } from './useRsvpNotifications';

// AI & Quota Management
export { useAIQuotaManagement } from './useAIQuotaManagement';
export { useQuotaManagement } from './useQuotaManagement';
export { useExtendedQuotaManagement } from './useExtendedQuotaManagement';
export { useSearchQuotaManagement } from './useSearchQuotaManagement';

// Agent & Debug
export { useAgentExecution } from './useAgentExecution';
export { useDebugContext, DebugContextProvider } from './useDebugContext';
export { useErrorRecovery } from './useErrorRecovery';

// Data Hooks
export { useDashboardData } from './useDashboardData';
export { useCalendarData } from './useCalendarData';
export { useOptimizedCalendarData } from './useOptimizedCalendarData';
export { useTRData } from './useTRData';
export { useOptimizedTRData } from './useOptimizedTRData';
export { useUserProfile } from './useUserProfile';
export { useUserStatistics } from './useUserStatistics';

// Admin Hooks
export { useAdminDashboardStats } from './useAdminDashboardStats';
export { useRealTimeAdminData } from './useRealTimeAdminData';

// Maw3d (Events)
export { useOptimizedMaw3dEvents } from './useOptimizedMaw3dEvents';

// File & Upload
export { useFileUpload } from './useFileUpload';
export { useOptimizedFileUpload } from './useOptimizedFileUpload';
export { useSimplifiedFileUpload } from './useSimplifiedFileUpload';

// Media & Audio/Video
export { useAudioSession } from './useAudioSession';
export { useVoiceRecording } from './useVoiceRecording';
export { useBrowserSpeechRecognition } from './useBrowserSpeechRecognition';
export { useCanvasVideo } from './useCanvasVideo';
export { useFFmpegVideo } from './useFFmpegVideo';
export { useImglyVideo } from './useImglyVideo';
export { useDrawAfterBG } from './useDrawAfterBG';

// Messages & Presence
export { useUnreadMessages } from './useUnreadMessages';
export { useUnreadCounts } from './useUnreadCounts';
export { usePresence } from './usePresence';

// UI Utilities
export { useAutoExpandingTextarea } from './useAutoExpandingTextarea';
export { useAutoScroll } from './useAutoScroll';
export { useDebounced } from './useDebounced';
export { useWidgetManager } from './useWidgetManager';
