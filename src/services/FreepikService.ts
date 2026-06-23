import { supabase } from '@/integrations/supabase/client';

const GENERATED_IMAGE_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-text2image';
const ALLOWED_RATIOS = new Set([
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto'
]);

export interface GeneratedImageResource {
  id: string;
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

export interface GeneratedImageSearchFilters {
  aspect_ratio?: string;
}

export interface GeneratedImageSearchResponse {
  data: GeneratedImageResource[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

function normalizeAspectRatio(value?: string): string {
  if (value && ALLOWED_RATIOS.has(value)) {
    return value;
  }
  return '16:9';
}

class GeneratedImageServiceClass {
  async searchImages(
    term: string,
    filters: GeneratedImageSearchFilters = {},
    page: number = 1,
    limit: number = 4,
  ): Promise<{ success: boolean; data?: GeneratedImageSearchResponse; error?: string }> {
    try {
      const prompt = (term || '').trim();
      if (!prompt) {
        return { success: false, error: 'Prompt is required' };
      }

      const safeLimit = Math.max(1, Math.min(Math.floor(Number(limit) || 4), 8));
      const aspectRatio = normalizeAspectRatio(filters.aspect_ratio);

      const results = await Promise.all(
        Array.from({ length: safeLimit }, async (_, index) => {
          const variantPrompt = index === 0 ? prompt : `${prompt} variation ${index + 1}`;
          const response = await fetch(GENERATED_IMAGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: variantPrompt,
              quality: 'best_fast',
              aspect_ratio: aspectRatio,
              model: 'nano-banana-2',
            }),
          });

          const payload = await response.json().catch(() => ({} as any));
          const url = typeof payload?.url === 'string' ? payload.url : '';
          if (!response.ok || !url) {
            return null;
          }

          return {
            id: `${Date.now()}-${index}`,
            title: variantPrompt,
            url,
            image: {
              source: { url },
              type: 'generated',
              orientation: aspectRatio,
            },
            author: {
              name: 'Nano Banana',
            },
          } as GeneratedImageResource;
        })
      );

      const images = results.filter((item): item is GeneratedImageResource => Boolean(item));
      if (images.length === 0) {
        return { success: false, error: 'No generated images returned' };
      }

      return {
        success: true,
        data: {
          data: images,
          meta: {
            current_page: page,
            last_page: 1,
            per_page: safeLimit,
            total: images.length,
          },
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to generate images' };
    }
  }

  async checkUserUploads(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        return { success: false, count: 0, error: error.message };
      }

      const imageFiles = (data || []).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
      });

      return { success: true, count: imageFiles.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || 'Failed to check user uploads' };
    }
  }

  async getUserPhotos(userId: string): Promise<{ success: boolean; photos?: Array<{ filename: string; url: string; }>; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const imageFiles = (data || []).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
      });

      const photos = imageFiles.map(file => {
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(`${userId}/${file.name}`);

        return {
          filename: file.name,
          url: urlData.publicUrl,
        };
      });

      return { success: true, photos };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to get user photos' };
    }
  }
}

export const GeneratedImageService = new GeneratedImageServiceClass();
