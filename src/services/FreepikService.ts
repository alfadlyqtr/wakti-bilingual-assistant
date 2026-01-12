import { supabase } from '@/integrations/supabase/client';

// Define types for Freepik API responses
export interface FreepikResource {
  id: number;
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

export interface FreepikSearchResponse {
  data: FreepikResource[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
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

class FreepikServiceClass {
  private apiKey: string | null = null;

  constructor() {
    // The API key will be fetched from Supabase environment variables
    this.initApiKey();
  }

  private async initApiKey() {
    try {
      // Fetch API key from Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('get-api-keys', {
        body: { service: 'freepik' }
      });

      if (error) {
        console.error('Failed to fetch Freepik API key:', error);
        return;
      }

      this.apiKey = data?.apiKey || null;
    } catch (err) {
      console.error('Error initializing Freepik API key:', err);
    }
  }

  /**
   * Search for images on Freepik
   * @param term Search term
   * @param filters Optional filters
   * @param page Page number (starts at 1)
   * @param limit Results per page
   * @param language Language code (e.g., 'en-US')
   */
  async searchImages(
    term: string,
    filters: FreepikSearchFilters = {},
    page: number = 1,
    limit: number = 10,
    language: string = 'en-US'
  ): Promise<{ success: boolean; data?: FreepikSearchResponse; error?: string }> {
    try {
      if (!this.apiKey) {
        await this.initApiKey();
        if (!this.apiKey) {
          return { success: false, error: 'API key not available' };
        }
      }

      // Call Freepik API via Supabase Edge Function to protect API key
      const { data, error } = await supabase.functions.invoke('freepik-search', {
        body: {
          term,
          filters,
          page,
          limit,
          language
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
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
