// Project-related type interfaces for the AI Coder

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

export type GeneratedFiles = Record<string, string>;

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

export interface UploadedAsset {
  filename: string;
  url: string;
  file_type: string | null;
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
