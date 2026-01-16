// ============================================================================
// API RESPONSE TYPES
// Standardized types for API responses
// ============================================================================

import type { ErrorState } from './common';

/**
 * Base API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string; // Only in development
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId?: string;
  timestamp?: string;
  duration?: number;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Supabase response wrapper
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
  count?: number;
  status?: number;
  statusText?: string;
}

/**
 * Supabase error structure
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Edge function response
 */
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  usage?: TokenUsage;
}

/**
 * Token usage for AI responses
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * AI chat response
 */
export interface AIChatResponse {
  success: boolean;
  message?: string;
  response?: string;
  conversationId?: string;
  usage?: TokenUsage;
  model?: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

/**
 * AI generation response
 */
export interface AIGenerationResponse {
  success: boolean;
  files?: Record<string, string>;
  changedFiles?: string[];
  summary?: string;
  toolsUsed?: string[];
  model?: string;
  usage?: TokenUsage;
  error?: string;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  success: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  prompt?: string;
  revisedPrompt?: string;
  error?: string;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  success: boolean;
  path?: string;
  url?: string;
  publicUrl?: string;
  size?: number;
  type?: string;
  error?: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName?: string;
  };
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  error?: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  success: false;
  errors: ValidationError[];
}

/**
 * Single validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Batch operation response
 */
export interface BatchResponse<T = unknown> {
  success: boolean;
  results: BatchResult<T>[];
  successCount: number;
  failureCount: number;
}

/**
 * Single batch result
 */
export interface BatchResult<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

/**
 * Type guard for successful response
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}

/**
 * Type guard for error response
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { error: ApiError } {
  return !response.success && response.error !== undefined;
}

/**
 * Helper to extract data or throw
 */
export function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error?.message || 'Unknown API error');
  }
  return response.data;
}
