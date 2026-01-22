import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Image as ImageIcon, 
  Download, 
  Plus, 
  Loader2, 
  X, 
  Heart,
  ExternalLink,
  Check,
  Save,
  Grid3X3,
  LayoutList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FreepikImage {
  id: number;
  title: string;
  url: string;
  thumbnail: string;
  size: string;
  orientation: string;
  type: string;
  author: string;
  authorAvatar: string;
  freepikUrl: string;
  downloads: number;
  likes: number;
}

interface StockPhotoBrowserProps {
  projectId: string;
  isRTL?: boolean;
  onInsertImage?: (imageUrl: string, title: string) => void;
  onSaveToBackend?: (image: FreepikImage) => Promise<void>;
  onClose?: () => void;
  className?: string;
}

const BACKEND_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api';

export function StockPhotoBrowser({
  projectId,
  isRTL = false,
  onInsertImage,
  onSaveToBackend,
  onClose,
  className = ''
}: StockPhotoBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<FreepikImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<FreepikImage | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const searchImages = useCallback(async (query: string, pageNum: number = 1) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'freepik/images',
          data: { 
            query: query.trim(), 
            page: pageNum, 
            limit: 20,
            filters: { type: 'photo' }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to search images');
      }

      const data = await response.json();
      
      if (pageNum === 1) {
        setImages(data.images || []);
      } else {
        setImages(prev => [...prev, ...(data.images || [])]);
      }
      
      setPage(pageNum);
      setTotalPages(data.lastPage || 1);
    } catch (error) {
      console.error('Search error:', error);
      toast.error(isRTL ? 'فشل البحث عن الصور' : 'Failed to search images');
    } finally {
      setLoading(false);
    }
  }, [projectId, isRTL]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchImages(searchQuery, 1);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loading) {
      searchImages(searchQuery, page + 1);
    }
  };

  const handleInsert = (image: FreepikImage) => {
    if (onInsertImage) {
      onInsertImage(image.url, image.title);
      toast.success(isRTL ? 'تم إدراج الصورة' : 'Image inserted');
    }
  };

  const handleSaveToBackend = async (image: FreepikImage) => {
    if (savedIds.has(image.id)) {
      toast.info(isRTL ? 'الصورة محفوظة مسبقاً' : 'Image already saved');
      return;
    }

    setSavingId(image.id);
    try {
      if (onSaveToBackend) {
        await onSaveToBackend(image);
      } else {
        // Default: Save to project media collection
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            action: 'data/create',
            collection: 'media',
            data: {
              title: image.title,
              url: image.url,
              thumbnail: image.thumbnail,
              type: 'stock_photo',
              source: 'freepik',
              freepik_id: image.id,
              author: image.author,
              metadata: {
                size: image.size,
                orientation: image.orientation,
                downloads: image.downloads,
                likes: image.likes
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save image');
        }
      }

      setSavedIds(prev => new Set([...prev, image.id]));
      toast.success(isRTL ? 'تم حفظ الصورة في الباك اند' : 'Image saved to backend');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(isRTL ? 'فشل حفظ الصورة' : 'Failed to save image');
    } finally {
      setSavingId(null);
    }
  };

  const suggestedSearches = [
    { en: 'business', ar: 'أعمال' },
    { en: 'technology', ar: 'تكنولوجيا' },
    { en: 'nature', ar: 'طبيعة' },
    { en: 'food', ar: 'طعام' },
    { en: 'people', ar: 'أشخاص' },
    { en: 'abstract', ar: 'تجريدي' },
  ];

  return (
    <div className={cn("flex flex-col h-full bg-background", className)} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-cyan-500" />
          <h2 className="font-semibold text-sm">
            {isRTL ? 'مكتبة الصور' : 'Stock Photos'}
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500">
            Freepik
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === 'grid' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title={isRTL ? 'عرض شبكي' : 'Grid view'}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === 'list' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title={isRTL ? 'عرض قائمة' : 'List view'}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'ابحث عن صور...' : 'Search for photos...'}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button type="submit" size="sm" disabled={loading || !searchQuery.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </form>

        {/* Suggested searches */}
        {images.length === 0 && !loading && (
          <div className="flex flex-wrap gap-2">
            {suggestedSearches.map((term) => (
              <button
                key={term.en}
                onClick={() => {
                  setSearchQuery(term.en);
                  searchImages(term.en, 1);
                }}
                className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {isRTL ? term.ar : term.en}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {loading && images.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'ابحث عن صور من Freepik' : 'Search for photos from Freepik'}
            </p>
          </div>
        ) : (
          <>
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                : "space-y-2"
            )}>
              <AnimatePresence>
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group relative rounded-lg overflow-hidden border border-border bg-muted/30",
                      viewMode === 'list' && "flex items-center gap-3 p-2"
                    )}
                  >
                    {/* Image */}
                    <div 
                      className={cn(
                        "relative cursor-pointer",
                        viewMode === 'grid' ? "aspect-square" : "w-20 h-20 flex-shrink-0 rounded overflow-hidden"
                      )}
                      onClick={() => setSelectedImage(image)}
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={image.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Overlay on hover (grid view) */}
                      {viewMode === 'grid' && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleInsert(image); }}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title={isRTL ? 'إدراج في الموقع' : 'Insert into site'}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSaveToBackend(image); }}
                            disabled={savingId === image.id}
                            className={cn(
                              "p-2 rounded-full transition-colors",
                              savedIds.has(image.id) 
                                ? "bg-green-500/30 text-green-400"
                                : "bg-white/20 hover:bg-white/30 text-white"
                            )}
                            title={isRTL ? 'حفظ في الباك اند' : 'Save to backend'}
                          >
                            {savingId === image.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : savedIds.has(image.id) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Info (list view) */}
                    {viewMode === 'list' && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{image.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {image.author} • {image.size}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" /> {image.downloads}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {image.likes}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions (list view) */}
                    {viewMode === 'list' && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleInsert(image)}
                          className="h-8 px-2"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveToBackend(image)}
                          disabled={savingId === image.id}
                          className={cn("h-8 px-2", savedIds.has(image.id) && "text-green-500")}
                        >
                          {savingId === image.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : savedIds.has(image.id) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load More */}
            {page < totalPages && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isRTL ? 'تحميل المزيد' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="w-full max-h-[50vh] object-contain bg-black"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                <h3 className="font-semibold">{selectedImage.title}</h3>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" /> {selectedImage.downloads}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" /> {selectedImage.likes}
                  </span>
                  <span>{selectedImage.size}</span>
                  <span className="capitalize">{selectedImage.orientation}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{isRTL ? 'بواسطة' : 'By'}:</span>
                  <span className="font-medium">{selectedImage.author}</span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => { handleInsert(selectedImage); setSelectedImage(null); }}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isRTL ? 'إدراج في الموقع' : 'Insert into Site'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSaveToBackend(selectedImage)}
                    disabled={savingId === selectedImage.id || savedIds.has(selectedImage.id)}
                  >
                    {savingId === selectedImage.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : savedIds.has(selectedImage.id) ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {isRTL ? 'محفوظة' : 'Saved'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {isRTL ? 'حفظ' : 'Save'}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(selectedImage.freepikUrl, '_blank')}
                    title={isRTL ? 'فتح في Freepik' : 'Open in Freepik'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StockPhotoBrowser;
