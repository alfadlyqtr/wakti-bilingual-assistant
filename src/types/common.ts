// ============================================================================
// COMMON SHARED TYPES
// Reusable type definitions used across the application
// ============================================================================

/**
 * Supported languages
 */
export type Language = 'en' | 'ar';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Status types used across entities
 */
export type Status = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';

/**
 * Priority levels
 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Device view types
 */
export type DeviceView = 'desktop' | 'tablet' | 'mobile';

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper
 */
export type Optional<T> = T | undefined;

/**
 * Deep partial type helper
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * ID types for type safety
 */
export type UserId = string & { readonly __brand: 'UserId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type MessageId = string & { readonly __brand: 'MessageId' };
export type ConversationId = string & { readonly __brand: 'ConversationId' };

/**
 * Timestamp type (ISO string)
 */
export type ISOTimestamp = string;

/**
 * Date only type (YYYY-MM-DD)
 */
export type DateString = string;

/**
 * Time only type (HH:MM or HH:MM:SS)
 */
export type TimeString = string;

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

/**
 * User-owned entity
 */
export interface UserOwnedEntity extends BaseEntity {
  user_id: string;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Pagination result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Sort params
 */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter params (generic)
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Search params
 */
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: FilterParams;
  sort?: SortParams;
}

/**
 * Selection state
 */
export interface SelectionState<T = string> {
  selected: T[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

/**
 * Loading state
 */
export interface LoadingState {
  isLoading: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
}

/**
 * Error state
 */
export interface ErrorState {
  error: Error | null;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Combined async state
 */
export interface AsyncState<T> extends LoadingState, ErrorState {
  data: T | null;
}

/**
 * Action result
 */
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Confirmation dialog props
 */
export interface ConfirmationProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

/**
 * Toast notification props
 */
export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * File metadata
 */
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  path?: string;
  url?: string;
}

/**
 * Upload progress
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Bilingual text (for AR/EN support)
 */
export interface BilingualText {
  en: string;
  ar: string;
}

/**
 * Get text by language helper type
 */
export type GetBilingualText = (text: BilingualText, language: Language) => string;
