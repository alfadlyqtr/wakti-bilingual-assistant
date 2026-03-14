import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, X, ImageIcon } from 'lucide-react';

interface SavedImage {
  id: string;
  image_url: string;
  prompt: string | null;
  created_at: string;
}

interface SavedImagesPickerProps {
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

export function SavedImagesPicker({ onSelect, onClose }: SavedImagesPickerProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImages = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('user_generated_images')
          .select('id, image_url, prompt, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setImages(data || []);
      } catch (err: any) {
        console.error('Failed to load saved images:', err);
        toast.error(language === 'ar' ? 'فشل تحميل الصور' : 'Failed to load images');
      } finally {
        setLoading(false);
      }
    };
    loadImages();
  }, [user?.id, language]);

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0c0f14] rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">
              {language === 'ar' ? 'اختر من الصور المحفوظة' : 'Pick from Saved Images'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="w-12 h-12 text-white/20 mb-3" />
              <p className="text-white/50">
                {language === 'ar' ? 'لا توجد صور محفوظة' : 'No saved images'}
              </p>
              <p className="text-white/30 text-sm mt-1">
                {language === 'ar' ? 'قم بإنشاء صور في الاستوديو أولاً' : 'Create images in Studio first'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => handleSelect(img.image_url)}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 transition-all active:scale-95 group border border-white/10 hover:border-orange-400/50"
                >
                  <img
                    src={img.image_url}
                    alt={img.prompt || 'Generated image'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {img.prompt && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-[10px] text-white/80 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.prompt}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
