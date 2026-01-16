// Project Detail Types - Extracted from ProjectDetail.tsx monolith
// Part of Group A Enhancement: Code Quality & Performance

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string | null;
  status: string;
  published_url: string | null;
  deployment_id: string | null;
  thumbnail_url?: string | null;
  subdomain?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
}

export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface GenerationJob {
  id: string;
  project_id: string;
  status: GenerationJobStatus;
  mode: 'create' | 'edit';
  error: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  snapshot?: Record<string, string>; // Project files snapshot for reverting
}

export type DeviceView = 'desktop' | 'tablet' | 'mobile';
export type LeftPanelMode = 'chat' | 'code';
export type MainTab = 'builder' | 'server';
export type RightPanelMode = 'preview' | 'code' | 'both';

export interface ImageAttachment {
  file: File;
  preview: string;
  pdfDataUrl?: string; // For PDF files
}

export interface SelectedElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
  computedStyle?: {
    color: string;
    backgroundColor: string;
    fontSize: string;
  };
}

export interface AIError {
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  severity: 'error' | 'warning' | 'info';
  technicalDetails?: string;
  suggestedAction?: string;
  suggestedActionAr?: string;
}

export interface BackendContext {
  enabled: boolean;
  collections: Array<{ name: string; itemCount: number; schema?: any }>;
  formSubmissionsCount: number;
  uploadsCount: number;
  siteUsersCount: number;
  // E-commerce data
  products: Array<{ name: string; price: number; image?: string; category?: string }>;
  productsCount: number;
  ordersCount: number;
  hasShopSetup: boolean;
  // Booking data
  services: Array<{ name: string; duration: number; price: number }>;
  servicesCount: number;
  bookingsCount: number;
  hasBookingsSetup: boolean;
  // Chat & Comments
  chatRoomsCount: number;
  commentsCount: number;
}

export interface UploadedAsset {
  filename: string;
  url: string;
  file_type: string | null;
}

export interface EditedFileTracking {
  id: string;
  fileName: string;
  status: 'editing' | 'edited';
}

export interface GenerationStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

export interface PendingMigration {
  title: string;
  titleAr?: string;
  sqlPreview: string;
  description?: string;
  descriptionAr?: string;
}

export interface CreationPromptInfo {
  userPrompt: string;
  themeId: string;
  themeInstructions: string;
  finalPrompt: string;
}

export interface PendingElementImageEdit {
  elementInfo: SelectedElementInfo | null;
  originalPrompt: string;
}

// Default context for backend
export const DEFAULT_BACKEND_CONTEXT: BackendContext = {
  enabled: false,
  collections: [],
  formSubmissionsCount: 0,
  uploadsCount: 0,
  siteUsersCount: 0,
  products: [],
  productsCount: 0,
  ordersCount: 0,
  hasShopSetup: false,
  services: [],
  servicesCount: 0,
  bookingsCount: 0,
  hasBookingsSetup: false,
  chatRoomsCount: 0,
  commentsCount: 0,
};
