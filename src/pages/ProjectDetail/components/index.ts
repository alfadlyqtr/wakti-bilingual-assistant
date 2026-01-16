// ProjectDetail Components - Barrel export
// Part of Group A Enhancement: Code Quality

export { ThinkingTimer } from './ThinkingTimer';
export { ChatSkeleton } from './ChatSkeleton';
export { PreviewSkeleton } from './PreviewSkeleton';
export { ErrorBanner } from './ErrorBanner';
export { SuspenseFallback, FullPageLoader, InlineLoader } from './SuspenseFallback';

// Lazy-loaded heavy components
export {
  BackendDashboard,
  StockPhotoSelector,
  BookingFormWizard,
  ContactFormWizard,
  ClarifyingQuestionsModal,
  MigrationApprovalDialog,
  ElementEditPopover,
  SandpackStudio,
} from './LazyComponents';

// Re-export types from LazyComponents
export type { 
  BookingFormConfig, 
  BookingService,
  ContactFormConfig,
  ClarifyingQuestion,
} from './LazyComponents';
