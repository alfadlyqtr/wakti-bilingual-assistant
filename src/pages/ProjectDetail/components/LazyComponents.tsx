// Lazy-loaded components for ProjectDetail
// Part of Group A Enhancement: Performance - Code Splitting

import { lazy } from 'react';

// Heavy components that should be lazy-loaded
// These are only loaded when needed, reducing initial bundle size

/**
 * BackendDashboard - Server-side data management dashboard
 * Size: ~100KB+ (includes tables, charts, forms)
 */
export const BackendDashboard = lazy(() => 
  import('@/components/projects/backend/BackendDashboard').then(module => ({
    default: module.BackendDashboard
  }))
);

/**
 * StockPhotoSelector - Freepik/Unsplash image browser
 * Size: ~80KB+ (includes image grid, search, API integration)
 */
export const StockPhotoSelector = lazy(() =>
  import('@/components/projects/StockPhotoSelector').then(module => ({
    default: module.StockPhotoSelector
  }))
);

/**
 * BookingFormWizard - Multi-step booking service setup
 * Size: ~60KB+ (includes form steps, validation, preview)
 */
export const BookingFormWizard = lazy(() =>
  import('@/components/projects/BookingFormWizard').then(module => ({
    default: module.BookingFormWizard
  }))
);

/**
 * ContactFormWizard - Multi-step contact form builder
 * Size: ~50KB+ (includes form builder, field config, preview)
 */
export const ContactFormWizard = lazy(() =>
  import('@/components/projects/ContactFormWizard').then(module => ({
    default: module.ContactFormWizard
  }))
);

/**
 * ClarifyingQuestionsModal - AI question dialog
 * Size: ~30KB (includes animations, form handling)
 */
export const ClarifyingQuestionsModal = lazy(() =>
  import('@/components/projects/ClarifyingQuestionsModal').then(module => ({
    default: module.ClarifyingQuestionsModal
  }))
);

/**
 * MigrationApprovalDialog - Database migration approval UI
 * Size: ~25KB (includes SQL preview, diff viewer)
 */
export const MigrationApprovalDialog = lazy(() =>
  import('@/components/projects/MigrationApprovalDialog').then(module => ({
    default: module.MigrationApprovalDialog
  }))
);

/**
 * ElementEditPopover - Visual edit mode popover
 * Size: ~40KB (includes style editor, color picker)
 */
export const ElementEditPopover = lazy(() =>
  import('@/components/projects/ElementEditPopover').then(module => ({
    default: module.ElementEditPopover
  }))
);

/**
 * SandpackStudio - Full code editor and preview
 * Already lazy-loaded in the main file, but we include for consistency
 * Size: ~200KB+ (includes CodeMirror, Sandpack runtime)
 */
export const SandpackStudio = lazy(() =>
  import('@/components/projects/SandpackStudio')
);

// Re-export type for convenience
export type { BookingFormConfig, BookingService } from '@/components/projects/BookingFormWizard';
export type { ContactFormConfig } from '@/components/projects/ContactFormWizard';
export type { ClarifyingQuestion } from '@/components/projects/ClarifyingQuestionsModal';
