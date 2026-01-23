import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Search, 
  Image as ImageIcon,
  X,
  Check,
  Loader2,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Grid3X3,
  LayoutList,
  Eye,
  Trash2,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FreepikService, FreepikResource } from '@/services/FreepikService';

interface SiteImage {
  src: string;
  alt: string;
  location: string; // e.g., "Hero Section", "Gallery", "About"
  file?: string; // which file it's in
}

interface BackendImage {
  id: string;
  filename: string;
  url: string;
  storage_path: string;
  created_at?: string;
}

interface SmartMediaManagerProps {
  projectId: string;
  generatedFiles?: Record<string, string>;
  onInsertImage: (imageUrl: string, imageAlt: string) => void;
  onClose: () => void;
  initialTab?: 'site' | 'stock' | 'upload';
  isRTL?: boolean;
}

export function SmartMediaManager({ 
  projectId, 
  generatedFiles,
  onInsertImage, 
  onClose,
  initialTab = 'site',
  isRTL = false
}: SmartMediaManagerProps) {
  const { language } = useTheme();
  const isRTLMode = isRTL || language === 'ar';
  
  const [activeTab, setActiveTab] = useState<'site' | 'stock' | 'upload'>(initialTab);
  
  // Site Images State
  const [siteImages, setSiteImages] = useState<SiteImage[]>([]);
  const [loadingSiteImages, setLoadingSiteImages] = useState(true);
  
  // Stock Photos State
  const [searchQuery, setSearchQuery] = useState('');
  const [stockPhotos, setStockPhotos] = useState<FreepikResource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [stockTotalPages, setStockTotalPages] = useState(1);
  
  // Upload State
  const [backendImages, setBackendImages] = useState<BackendImage[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Selection State - support multiple selection
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDownloadingStock, setIsDownloadingStock] = useState(false);

  // Extract images from generated files on mount
  useEffect(() => {
    extractSiteImages();
    loadBackendImages();
  }, [generatedFiles, projectId]);

  // Extract images from the generated site code
  const extractSiteImages = () => {
    setLoadingSiteImages(true);
    const images: SiteImage[] = [];
    
    if (!generatedFiles) {
      setLoadingSiteImages(false);
      return;
    }

    // Regex patterns to find images in code
    const imgSrcPattern = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
    const bgImagePattern = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
    const srcSetPattern = /src=\{([^}]+)\}/gi;
    const imageVarPattern = /(?:image|img|photo|pic|banner|hero|logo)\s*[:=]\s*["']([^"']+)["']/gi;

    Object.entries(generatedFiles).forEach(([filename, content]) => {
      if (!content || typeof content !== 'string') return;
      
      // Determine location based on filename
      const getLocation = (file: string): string => {
        const lower = file.toLowerCase();
        if (lower.includes('hero')) return 'Hero Section';
        if (lower.includes('gallery')) return 'Gallery';
        if (lower.includes('about')) return 'About Section';
        if (lower.includes('service')) return 'Services';
        if (lower.includes('team')) return 'Team Section';
        if (lower.includes('testimonial')) return 'Testimonials';
        if (lower.includes('footer')) return 'Footer';
        if (lower.includes('header') || lower.includes('nav')) return 'Header';
        if (lower.includes('product')) return 'Products';
        if (lower.includes('contact')) return 'Contact';
        return 'Page Content';
      };

      // Find <img> tags
      let match;
      while ((match = imgSrcPattern.exec(content)) !== null) {
        const src = match[1];
        const alt = match[2] || '';
        if (src && !src.startsWith('data:') && !images.find(i => i.src === src)) {
          images.push({
            src,
            alt: alt || extractAltFromUrl(src),
            location: getLocation(filename),
            file: filename
          });
        }
      }

      // Find background images
      while ((match = bgImagePattern.exec(content)) !== null) {
        const src = match[1];
        if (src && !src.startsWith('data:') && !images.find(i => i.src === src)) {
          images.push({
            src,
            alt: 'Background Image',
            location: getLocation(filename),
            file: filename
          });
        }
      }

      // Find image variables/constants
      while ((match = imageVarPattern.exec(content)) !== null) {
        const src = match[1];
        if (src && src.startsWith('http') && !images.find(i => i.src === src)) {
          images.push({
            src,
            alt: extractAltFromUrl(src),
            location: getLocation(filename),
            file: filename
          });
        }
      }
    });

    // Save any new images to the backend
    const saveNewImages = async () => {
      const existingImages = await supabase
        .from('project_images')
        .select('url')
        .eq('project_id', projectId);

      if (existingImages.error) {
        console.error('Error loading existing images:', existingImages.error);
        return;
      }

      const existingUrls = new Set((existingImages.data || []).map(img => img.url));
      const newImages = images.filter(img => !existingUrls.has(img.src));

      if (newImages.length > 0) {
        const { error } = await supabase.from('project_images').insert(
          newImages.map(img => ({
            project_id: projectId,
            url: img.src,
            alt_text: img.alt,
            location: img.location,
            file_path: img.file,
            source: img.src.includes('placehold.co') ? 'placeholder' :
                   img.src.includes('freepik.com') ? 'freepik' : 'site'
          }))
        );

        if (error) {
          console.error('Error saving images to backend:', error);
          toast.error(isRTLMode ? 'فشل حفظ الصور' : 'Failed to save images');
        } else {
          console.log(`Saved ${newImages.length} new images to backend`);
        }
      }
    };

    // Save images and update state
    saveNewImages();
    setSiteImages(images);
    setLoadingSiteImages(false);
  };

  // Helper to extract alt text from URL
  const extractAltFromUrl = (url: string): string => {
    try {
      const parts = url.split('/').pop()?.split('?')[0] || '';
      return parts.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').slice(0, 50);
    } catch {
      return 'Image';
    }
  };

  // Load images from backend storage
  const loadBackendImages = async () => {
    setLoadingBackend(true);
    try {
      const { data, error } = await supabase
        .from('project_uploads' as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const images: BackendImage[] = (data || [])
        .filter((f: any) => {
          const ext = f.filename?.toLowerCase().split('.').pop();
          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
        })
        .map((f: any) => {
          const { data: urlData } = supabase.storage
            .from('project-uploads')
            .getPublicUrl(f.storage_path);
          return {
            id: f.id,
            filename: f.filename,
            url: urlData?.publicUrl || '',
            storage_path: f.storage_path,
            created_at: f.created_at
          };
        });

      setBackendImages(images);
    } catch (err) {
      console.error('Error loading backend images:', err);
    } finally {
      setLoadingBackend(false);
    }
  };

  // Search Freepik stock photos
  const handleStockSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const result = await FreepikService.searchImages(
        searchQuery,
        { content_type: { photo: 1 } },
        page,
        12,
        isRTLMode ? 'ar-SA' : 'en-US'
      );

      if (result.success && result.data) {
        setStockPhotos(result.data.data || []);
        setStockTotalPages(result.data.meta?.last_page || 1);
        setStockPage(page);
      } else {
        toast.error(isRTLMode ? 'فشل البحث عن الصور' : 'Failed to search photos');
      }
    } catch (err) {
      console.error('Stock search error:', err);
      toast.error(isRTLMode ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const storagePath = `${projectId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        // Save to project_uploads table
        await supabase
          .from('project_uploads' as any)
          .insert({
            project_id: projectId,
            filename: file.name,
            storage_path: storagePath,
            file_type: file.type,
            file_size: file.size
          } as any);

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      toast.success(isRTLMode ? 'تم رفع الملفات بنجاح!' : 'Files uploaded successfully!');
      loadBackendImages();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(isRTLMode ? 'فشل رفع الملفات' : 'Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete backend image
  const handleDeleteImage = async (image: BackendImage) => {
    try {
      await supabase.storage.from('project-uploads').remove([image.storage_path]);
      await supabase.from('project_uploads' as any).delete().eq('id', image.id);
      setBackendImages(prev => prev.filter(i => i.id !== image.id));
      toast.success(isRTLMode ? 'تم حذف الصورة' : 'Image deleted');
    } catch (err) {
      toast.error(isRTLMode ? 'فشل حذف الصورة' : 'Failed to delete image');
    }
  };

  // Copy image URL
  const copyImageUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(isRTLMode ? 'تم نسخ الرابط' : 'URL copied!');
  };

  // Suggested search terms based on site content
  const suggestedSearches = [
    { en: 'business team', ar: 'فريق عمل' },
    { en: 'modern office', ar: 'مكتب حديث' },
    { en: 'professional service', ar: 'خدمة احترافية' },
    { en: 'happy customers', ar: 'عملاء سعداء' },
    { en: 'technology', ar: 'تكنولوجيا' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-lg overflow-hidden" dir={isRTLMode ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">
              {isRTLMode ? '🖼️ مدير الوسائط الذكي' : '🖼️ Smart Media Manager'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRTLMode ? 'تصفح، ابحث، ارفع الصور' : 'Browse, search, upload images'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="px-4 pt-3">
          <TabsList className="w-full h-10 bg-muted/50">
            <TabsTrigger value="site" className="flex-1 text-xs gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {isRTLMode ? 'صور الموقع' : 'Site Images'}
              {siteImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/20 rounded-full">
                  {siteImages.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex-1 text-xs gap-1.5">
              <Search className="h-3.5 w-3.5" />
              {isRTLMode ? 'صور مجانية' : 'Stock Photos'}
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 text-xs gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {isRTLMode ? 'رفع' : 'Upload'}
              {backendImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/20 rounded-full">
                  {backendImages.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Site Images Tab */}
        <TabsContent value="site" className="p-4 pt-3 min-h-[300px] max-h-[400px] overflow-y-auto">
          {loadingSiteImages ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : siteImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {isRTLMode ? 'لا توجد صور في الموقع حالياً' : 'No images found on the site yet'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {isRTLMode ? 'ابحث عن صور مجانية أو ارفع صورك' : 'Search stock photos or upload your own'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {isRTLMode ? `${siteImages.length} صورة في الموقع` : `${siteImages.length} images on site`}
                </p>
                <Button variant="ghost" size="sm" onClick={extractSiteImages} className="h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {isRTLMode ? 'تحديث' : 'Refresh'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {siteImages.map((img, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "group relative rounded-lg overflow-hidden border transition-all cursor-pointer",
                      selectedImages.includes(img.src) 
                        ? "ring-2 ring-primary border-primary" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => {
                      setSelectedImages(prev => 
                        prev.includes(img.src) 
                          ? prev.filter(url => url !== img.src)
                          : [...prev, img.src]
                      );
                    }}
                  >
                    <div className="aspect-video bg-muted">
                      <img 
                        src={img.src} 
                        alt={img.alt}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/400x300/1a1a2e/eaeaea?text=${encodeURIComponent(img.alt.slice(0, 20))}`;
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-[10px] text-white font-medium truncate">{img.alt}</p>
                      <p className="text-[9px] text-white/70">{img.location}</p>
                    </div>
                    {selectedImages.includes(img.src) && (
                      <div className="absolute top-2 right-2 p-1 rounded-full bg-primary">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Stock Photos Tab */}
        <TabsContent value="stock" className="p-4 pt-3 min-h-[300px] max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {/* Search */}
            <div className="flex gap-2">
              <Input
                placeholder={isRTLMode ? 'ابحث عن صور...' : 'Search photos...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStockSearch(1)}
                className="h-9 text-sm"
              />
              <Button 
                onClick={() => handleStockSearch(1)} 
                disabled={isSearching}
                size="sm"
                className="h-9 px-3"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Suggested Searches */}
            {stockPhotos.length === 0 && !isSearching && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {isRTLMode ? 'اقتراحات:' : 'Suggestions:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchQuery(isRTLMode ? term.ar : term.en);
                        handleStockSearch(1);
                      }}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    >
                      {isRTLMode ? term.ar : term.en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {isSearching ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : stockPhotos.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {stockPhotos.map((photo) => {
                    const photoUrl = photo.image?.source?.url || '';
                    return (
                      <div 
                        key={photo.id}
                        className={cn(
                          "group relative rounded-lg overflow-hidden border transition-all cursor-pointer",
                          selectedImages.includes(photoUrl) 
                            ? "ring-2 ring-primary border-primary" 
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => {
                          if (!photoUrl) return;
                          setSelectedImages(prev => 
                            prev.includes(photoUrl) 
                              ? prev.filter(url => url !== photoUrl)
                              : [...prev, photoUrl]
                          );
                        }}
                      >
                        <div className="aspect-video bg-muted">
                          <img 
                            src={photoUrl} 
                            alt={photo.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                          <p className="text-[10px] text-white font-medium truncate">{photo.title}</p>
                          <p className="text-[9px] text-white/70">Freepik</p>
                        </div>
                        {selectedImages.includes(photoUrl) && (
                          <div className="absolute top-2 right-2 p-1 rounded-full bg-primary">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {stockTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={stockPage <= 1}
                      onClick={() => handleStockSearch(stockPage - 1)}
                      className="h-7 text-xs"
                    >
                      {isRTLMode ? 'السابق' : 'Prev'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {stockPage} / {stockTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={stockPage >= stockTotalPages}
                      onClick={() => handleStockSearch(stockPage + 1)}
                      className="h-7 text-xs"
                    >
                      {isRTLMode ? 'التالي' : 'Next'}
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="p-4 pt-3 min-h-[300px] max-h-[400px] overflow-y-auto">
          <div className="space-y-4">
            {/* Upload Zone */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
                isUploading ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              {isUploading ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {isRTLMode ? 'جاري الرفع...' : 'Uploading...'}
                  </p>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {isRTLMode ? 'اضغط أو اسحب الصور هنا' : 'Click or drag images here'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRTLMode ? 'JPG, PNG, GIF حتى 10MB' : 'JPG, PNG, GIF up to 10MB'}
                  </p>
                </>
              )}
            </div>

            {/* Backend Images */}
            {loadingBackend ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : backendImages.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {isRTLMode ? 'الصور المرفوعة:' : 'Uploaded images:'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {backendImages.map((img) => (
                    <div 
                      key={img.id}
                      className={cn(
                        "group relative rounded-lg overflow-hidden border transition-all cursor-pointer",
                        selectedImages.includes(img.url) 
                          ? "ring-2 ring-primary border-primary" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => {
                        setSelectedImages(prev => 
                          prev.includes(img.url) 
                            ? prev.filter(url => url !== img.url)
                            : [...prev, img.url]
                        );
                      }}
                    >
                      <div className="aspect-square bg-muted">
                        <img 
                          src={img.url} 
                          alt={img.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyImageUrl(img.url); }}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30"
                          title={isRTLMode ? 'نسخ الرابط' : 'Copy URL'}
                        >
                          <Copy className="h-3 w-3 text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }}
                          className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500"
                          title={isRTLMode ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="h-3 w-3 text-white" />
                        </button>
                      </div>
                      {selectedImages.includes(img.url) && (
                        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                {isRTLMode ? 'لم يتم رفع أي صور بعد' : 'No images uploaded yet'}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          {isRTLMode ? 'إلغاء' : 'Cancel'}
        </Button>
        
        <div className="flex items-center gap-2">
          {selectedImages.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyImageUrl(selectedImages[0])}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              {isRTLMode ? 'نسخ الرابط' : 'Copy URL'}
            </Button>
          )}
          <Button
            size="sm"
            disabled={selectedImages.length === 0 || isDownloadingStock}
            onClick={async () => {
              if (selectedImages.length > 0) {
                // Insert all selected images
                for (const imgUrl of selectedImages) {
                  onInsertImage(imgUrl, 'Image');
                }
                toast.success(isRTLMode ? `✨ تم إدراج ${selectedImages.length} صورة!` : `✨ ${selectedImages.length} image(s) inserted!`);
                onClose();
              }
            }}
            className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isDownloadingStock ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            {isRTLMode ? `إدراج (${selectedImages.length})` : `Insert (${selectedImages.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SmartMediaManager;
