import { supabase } from '@/integrations/supabase/client';

// Define types for Freepik API responses
const BACKEND_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api';
const PROJECT_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface FreepikResource {
  id: number | string;
  title: string;
  url: string;
  image: {
    source: {
      url: string;
    };
    type: string;
    orientation: string;
  };
  author: {
    name: string;
  };
}

export interface FreepikSearchFilters {
  orientation?: {
    landscape?: number;
    portrait?: number;
    square?: number;
    panoramic?: number;
  };
  content_type?: {
    photo?: number;
    vector?: number;
    psd?: number;
  };
  people?: {
    include?: number;
    exclude?: number;
  };
  color?: string;
}

export interface FreepikSearchResponse {
  data: FreepikResource[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface BackendFreepikImage {
  id?: number | string;
  title?: string;
  url?: string;
  thumbnail?: string;
  orientation?: string;
  type?: string;
  author?: string;
  freepikUrl?: string;
}

function mapBackendImageToResource(image: BackendFreepikImage, index: number): FreepikResource {
  const imageUrl = image.url || image.thumbnail || '';
  const previewUrl = image.thumbnail || image.url || '';

  return {
    id: image.id ?? `freepik-${index}`,
    title: image.title || 'Freepik image',
    url: imageUrl || image.freepikUrl || previewUrl,
    image: {
      source: {
        url: previewUrl || imageUrl,
      },
      type: image.type || 'photo',
      orientation: image.orientation || 'landscape',
    },
    author: {
      name: image.author || 'Freepik',
    },
  };
}

function normalizeFilters(filters: FreepikSearchFilters): Record<string, string> {
  const orientation = Object.entries(filters.orientation || {}).find(([, value]) => Boolean(value))?.[0];
  const contentType = Object.entries(filters.content_type || {}).find(([, value]) => Boolean(value))?.[0];

  return {
    ...(orientation ? { orientation } : {}),
    ...(contentType ? { type: contentType } : {}),
    ...(filters.color ? { color: filters.color } : {}),
  };
}

function resolveProjectId(projectId?: string): string | null {
  if (projectId?.trim()) {
    return projectId.trim();
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const match = window.location.pathname.match(PROJECT_ID_PATTERN);
  return match?.[0] || null;
}

class FreepikServiceClass {
  /**
   * Search for images on Freepik
   * @param term Search term
   * @param filters Optional filters
   * @param page Page number (starts at 1)
   * @param limit Results per page
   * @param language Language code (e.g., 'en-US')
   * @param projectId Project ID
   */
  async searchImages(
    term: string,
    filters: FreepikSearchFilters = {},
    page: number = 1,
    limit: number = 10,
    language: string = 'en-US',
    projectId?: string
  ): Promise<{ success: boolean; data?: FreepikSearchResponse; error?: string }> {
    try {
      const resolvedProjectId = resolveProjectId(projectId);
      if (!resolvedProjectId) {
        return { success: false, error: 'Project ID not available' };
      }

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: resolvedProjectId,
          action: 'freepik/images',
          data: {
            query: term,
            page,
            limit,
            language,
            filters: normalizeFilters(filters),
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = `Freepik search failed (${response.status})`;

        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorData?.message || errorMessage;
        } catch {
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      const mappedImages = Array.isArray(data?.images)
        ? data.images
            .map((image: BackendFreepikImage, index: number) => mapBackendImageToResource(image, index))
            .filter((image: FreepikResource) => Boolean(image.image?.source?.url))
        : [];

      return {
        success: true,
        data: {
          data: mappedImages,
          meta: {
            current_page: Number(data?.page) || page,
            last_page: Number(data?.lastPage) || 1,
            per_page: limit,
            total: Number(data?.total) || mappedImages.length,
          },
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to search Freepik' };
    }
  }

  /**
   * Check if user has uploaded photos
   * @param userId User ID
   * @returns Object with success flag and count of uploaded photos
   */
  async checkUserUploads(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Check for user uploads in the 'uploads' storage bucket under user's folder
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error checking user uploads:', error);
        return { success: false, count: 0, error: error.message };
      }

      // Filter for image files only
      const imageFiles = (data || []).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
      });

      return { success: true, count: imageFiles.length };
    } catch (err: any) {
      console.error('Error in checkUserUploads:', err);
      return { success: false, count: 0, error: err.message || 'Failed to check user uploads' };
    }
  }

  /**
   * Get user uploaded photos
   * @param userId User ID
   * @returns Object with success flag and array of user photos
   */
  async getUserPhotos(userId: string): Promise<{ 
    success: boolean; 
    photos?: Array<{ filename: string; url: string; }>; 
    error?: string 
  }> {
    try {
      // Get user uploads from the 'uploads' storage bucket
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error getting user photos:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { success: true, photos: [] };
      }

      // Filter for image files and convert to public URLs
      const imageFiles = data.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
      });

      const photos = imageFiles.map(file => {
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(`${userId}/${file.name}`);
        
        return {
          filename: file.name,
          url: urlData.publicUrl
        };
      });

      return { success: true, photos };
    } catch (err: any) {
      console.error('Error in getUserPhotos:', err);
      return { success: false, error: err.message || 'Failed to get user photos' };
    }
  }
}

export const FreepikService = new FreepikServiceClass();
