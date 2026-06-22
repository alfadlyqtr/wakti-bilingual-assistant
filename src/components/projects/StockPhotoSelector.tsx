import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { FreepikService, FreepikResource } from '@/services/FreepikService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Image, Check, Upload, Filter, Camera, Grid2X2, Grid3X3, LayoutGrid, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StockPhotoSelectorProps {
  userId: string;
  projectId?: string;
  onSelectPhoto: (photo: { url: string; title: string }) => void;
  onSelectPhotos?: (photos: { url: string; title: string }[]) => void; // Multi-select
  multiSelect?: boolean;
  onClose: () => void;
  searchTerm?: string;
  initialTab?: 'stock' | 'user' | 'saved';
  showOnlyUserPhotos?: boolean; // Hide stock photos tab entirely
}

interface BackendPhoto {
  id: string;
  filename: string;
  url: string;
  storage_path: string;
  file_type: string | null;
}

interface SavedImage {
  id: string;
  image_url: string;
  prompt: string | null;
  submode?: string | null;
  created_at: string;
}

type GridSize = 'small' | 'medium' | 'large';

function isUsableImageUrl(value?: string | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value) && !/freepik\.com\/(?:[^\s]+\/)?search/i.test(value);
}

function resolvePhotoDisplayUrl(photo: FreepikResource): string {
  const candidates = [
    photo.image?.source?.url,
    photo.url,
    (photo as any)?.thumbnail,
    (photo as any)?.previewUrl,
    (photo as any)?.image?.thumbnail?.url,
    (photo as any)?.image?.url,
  ];

  return candidates.find((candidate) => isUsableImageUrl(candidate)) || '';
}

function resolvePhotoSelectionUrl(photo: FreepikResource): string {
  const candidates = [
    photo.url,
    photo.image?.source?.url,
    (photo as any)?.previewUrl,
    (photo as any)?.thumbnail,
    (photo as any)?.image?.url,
    (photo as any)?.image?.thumbnail?.url,
  ];

  return candidates.find((candidate) => isUsableImageUrl(candidate)) || '';
}

export function StockPhotoSelector({ 
  userId, 
  projectId,
  onSelectPhoto,
  onSelectPhotos,
  multiSelect = false,
  onClose, 
  searchTerm = '', 
  initialTab = 'stock',
  showOnlyUserPhotos = false
}: StockPhotoSelectorProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  const [portalReady, setPortalReady] = useState(false);
  // If showOnlyUserPhotos, force user tab
  const [activeTab, setActiveTab] = useState<'stock' | 'user' | 'saved'>(showOnlyUserPhotos ? 'user' : initialTab);
  const [searchQuery, setSearchQuery] = useState(''); // Always start empty - user must type search
  const [isSearching, setIsSearching] = useState(false);
  const [stockPhotos, setStockPhotos] = useState<FreepikResource[]>([]);
  const [backendPhotos, setBackendPhotos] = useState<BackendPhoto[]>([]);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<{ url: string; title: string }[]>([]); // Multi-select
  // Allow user to switch between single/multi inside the modal (defaults to prop)
  const [multiSelectEnabled, setMultiSelectEnabled] = useState<boolean>(multiSelect);
  const [orientation, setOrientation] = useState<'all' | 'landscape' | 'portrait' | 'square'>('all');
  const [contentType, setContentType] = useState<'all' | 'photo' | 'vector'>('photo');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [noPhotosFound, setNoPhotosFound] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stockError, setStockError] = useState('');
  // Load gridSize from localStorage for persistence
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const stored = localStorage.getItem('stockPhotoSelectorGridSize');
    return (stored === 'small' || stored === 'medium' || stored === 'large') ? stored : 'medium';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist gridSize to localStorage
  useEffect(() => {
    localStorage.setItem('stockPhotoSelectorGridSize', gridSize);
  }, [gridSize]);

  // Grid size classes
  const gridClasses: Record<GridSize, string> = {
    small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2',
    medium: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
    large: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
  };

  // Selection count for display
  const selectionCount = multiSelectEnabled ? selectedPhotos.length : (selectedPhoto ? 1 : 0);

  // Load backend photos on mount
  useEffect(() => {
    if (projectId) {
      loadBackendPhotos();
    }
    if (activeTab === 'saved') {
      loadSavedImages();
    }
  }, [projectId, activeTab]);

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    if (!searchTerm?.trim()) return;
    setSearchQuery(searchTerm.trim());
  }, [searchTerm]);

  // Removed: auto-search on mount - user must manually search

  const loadSavedImages = async () => {
    setIsLoadingSaved(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setIsLoadingSaved(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('user_generated_images' as any)
        .select('id, image_url, prompt, submode, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50) as any;
        
      if (error) throw error;
      const filtered = ((data || []) as SavedImage[]).filter((image) => {
        if (!image.image_url) return false;
        const submode = image.submode || '';
        return ['text2image', 'image2image', 'draw', 'visual-ads'].includes(submode);
      });
      setSavedImages(filtered);
    } catch (err) {
      console.error('Error loading saved images:', err);
      toast.error(isRTL ? 'فشل في تحميل الصور المحفوظة' : 'Failed to load saved images');
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const loadBackendPhotos = async () => {
    if (!projectId) {
      setNoPhotosFound(true);
      return;
    }
    
    setIsLoadingPhotos(true);
    setNoPhotosFound(false);
    
    try {
      // Fetch from project_uploads table (backend uploads)
      const { data, error } = await supabase
        .from('project_uploads')
        .select('id, filename, storage_path, file_type, user_id')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error loading backend photos:', error);
        toast.error(isRTL ? 'فشل في تحميل الصور' : 'Failed to load photos');
        setNoPhotosFound(true);
        return;
      }

      if (!data || data.length === 0) {
        setNoPhotosFound(true);
        setBackendPhotos([]);
        return;
      }

      // Filter for image files only
      const imageFiles = data.filter(file => {
        const ext = file.filename?.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '') ||
               file.file_type?.startsWith('image/');
      });

      if (imageFiles.length === 0) {
        setNoPhotosFound(true);
        setBackendPhotos([]);
        return;
      }

      // Get public URLs for each image (stable for inserting into code)
      const photosWithUrls = imageFiles.map((file) => {
        const { data: urlData } = supabase.storage
          .from('project-uploads')
          .getPublicUrl(file.storage_path);

        return {
          id: file.id,
          filename: file.filename,
          url: urlData?.publicUrl || '',
          storage_path: file.storage_path,
          file_type: file.file_type
        };
      });

      const validPhotos = photosWithUrls.filter(p => p.url);
      setBackendPhotos(validPhotos);
      setNoPhotosFound(validPhotos.length === 0);
    } catch (err) {
      console.error('Error loading backend photos:', err);
      setNoPhotosFound(true);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Fixed: Accept explicit page parameter to avoid stale state issues
  const handleSearch = async (pageToLoad: number = 1) => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setStockPhotos([]);
    setStockError('');
    
    try {
      const filters: any = {};
      
      if (orientation !== 'all') {
        filters.orientation = {};
        filters.orientation[orientation] = 1;
      }
      
      if (contentType !== 'all') {
        filters.content_type = {};
        filters.content_type[contentType] = 1;
      }
      
      const result = await FreepikService.searchImages(
        searchQuery,
        filters,
        pageToLoad, // Use the passed parameter, not stale state
        12,
        language === 'ar' ? 'ar-SA' : 'en-US',
        projectId
      );
      
      if (result.success && result.data) {
        // Dedupe results by photo ID to prevent duplicates
        const uniquePhotos = result.data.data?.filter((photo, index, self) => 
          index === self.findIndex(p => p.id === photo.id)
        ) || [];
        setStockPhotos(uniquePhotos);
        setTotalPages(result.data.meta.last_page || 1);
      } else {
        console.error('Failed to search photos:', result.error);
        setStockError(result.error || 'Failed to search photos');
        toast.error(isRTL ? 'فشل في البحث عن الصور' : 'Failed to search photos');
      }
    } catch (err) {
      console.error('Error searching photos:', err);
      setStockError(err instanceof Error ? err.message : 'Failed to search photos');
    } finally {
      setIsSearching(false);
    }
  };

  // Fixed: Update state and pass new page directly to handleSearch
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    handleSearch(newPage); // Pass explicit page to avoid stale state
  };

  const handleSelectPhoto = (photo: { url: string; title: string }) => {
    if (multiSelectEnabled) {
      setSelectedPhotos(prev => {
        const exists = prev.some(p => p.url === photo.url);
        if (exists) {
          return prev.filter(p => p.url !== photo.url);
        }
        return [...prev, photo];
      });
    } else {
      setSelectedPhoto(photo);
    }
  };

  const isPhotoSelected = (url: string) => {
    if (multiSelectEnabled) {
      return selectedPhotos.some(p => p.url === url);
    }
    return selectedPhoto?.url === url;
  };

  const handleConfirmSelection = () => {
    // If parent expects multi-select, always return an array (even if user toggled Single)
    if (multiSelect) {
      const photosToSend = selectedPhotos.length > 0
        ? selectedPhotos
        : (selectedPhoto ? [selectedPhoto] : []);

      if (photosToSend.length === 0) return;

      if (onSelectPhotos) {
        onSelectPhotos(photosToSend);
      } else {
        onSelectPhoto(photosToSend[0]);
      }
      onClose();
      return;
    }

    // Single-select mode
    if (selectedPhoto) {
      onSelectPhoto(selectedPhoto);
      onClose();
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'stock' | 'user' | 'saved');
    if (value === 'user' && backendPhotos.length === 0 && !isLoadingPhotos && projectId) {
      loadBackendPhotos();
    } else if (value === 'saved' && savedImages.length === 0 && !isLoadingSaved) {
      loadSavedImages();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectId) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Validate file is an image
        if (!file.type.startsWith('image/')) {
          toast.error(isRTL ? 'يُسمح فقط بالصور' : 'Only images are allowed');
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(isRTL ? 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)' : 'File too large (max 10MB)');
          continue;
        }

        // Get the current user ID first to construct the correct path
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          toast.error(isRTL ? 'يرجى تسجيل الدخول' : 'Please log in');
          continue;
        }

        const timestamp = Date.now();
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        // Path format: {userId}/{projectId}/{timestamp}_{filename}
        const storagePath = `${user.id}/${projectId}/${timestamp}-${safeFilename}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(isRTL ? 'فشل في رفع الملف' : 'Failed to upload file');
          continue;
        }

        // Save to database (user is already defined above)
        const { error: dbError } = await supabase
          .from('project_uploads')
          .insert({
            project_id: projectId,
            user_id: user.id,
            filename: file.name,
            storage_path: storagePath,
            file_type: file.type,
            size_bytes: file.size
          });

        if (dbError) {
          console.error('DB error:', dbError);
          // Try to clean up the uploaded file
          await supabase.storage.from('project-uploads').remove([storagePath]);
          toast.error(isRTL ? 'فشل في حفظ الملف' : 'Failed to save file');
          continue;
        }

        toast.success(isRTL ? 'تم رفع الصورة بنجاح' : 'Photo uploaded successfully');
      }

      // Reload photos
      await loadBackendPhotos();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(isRTL ? 'حدث خطأ أثناء الرفع' : 'Upload error occurred');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!portalReady || typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div 
        className={cn(
          "bg-background shadow-lg w-full flex flex-col",
          "h-[100dvh] rounded-none", // Full screen on mobile
          "sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:max-w-7xl"
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header - Safe area aware */}
        <div className="flex items-center justify-between p-4 border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {multiSelectEnabled 
                ? (isRTL ? 'اختيار صور متعددة' : 'Select Multiple Photos')
                : (isRTL ? 'اختيار صورة' : 'Select Photo')
              }
            </h2>
            <button
              type="button"
              onClick={() => {
                const next = !multiSelectEnabled;
                setMultiSelectEnabled(next);
                if (next) {
                  // single -> multi
                  if (selectedPhoto) {
                    setSelectedPhotos([selectedPhoto]);
                    setSelectedPhoto(null);
                  }
                } else {
                  // multi -> single
                  setSelectedPhoto(selectedPhoto || selectedPhotos[0] || null);
                  setSelectedPhotos([]);
                }
              }}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border",
                multiSelectEnabled
                  ? "bg-primary text-primary-foreground border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border"
              )}
            >
              {isRTL ? (multiSelectEnabled ? 'متعدد' : 'فردي') : (multiSelectEnabled ? 'Multi' : 'Single')}
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <Tabs defaultValue={showOnlyUserPhotos ? 'user' : 'stock'} value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 sm:px-4 pt-2 shrink-0">
            <TabsList className={cn("w-full h-10 sm:h-11", showOnlyUserPhotos && "hidden")}>
              <TabsTrigger value="stock" className="flex-1 text-xs sm:text-sm gap-1.5 sm:gap-2">
                <Image className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isRTL ? 'صور مخزنة' : 'Stock Photos'}
              </TabsTrigger>
              <TabsTrigger value="user" className="flex-1 text-xs sm:text-sm gap-1.5 sm:gap-2">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isRTL ? 'صوري' : 'My Photos'}
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 text-xs sm:text-sm gap-1.5 sm:gap-2">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isRTL ? 'الصور المولّدة' : 'Saved Photos'}
              </TabsTrigger>
            </TabsList>
            {showOnlyUserPhotos && (
              <div className="text-sm text-muted-foreground py-2 text-center">
                {isRTL ? 'اختر من صورك المرفوعة' : 'Select from your uploaded photos'}
              </div>
            )}
          </div>
          
          {/* Stock Photos Tab */}
          <TabsContent value="stock" className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden">
            {/* Search & Filters - Mobile optimized */}
            <div className="p-3 sm:p-4 border-b shrink-0 space-y-2 sm:space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={isRTL ? 'البحث عن الصور...' : 'Search photos...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); handleSearch(1); } }}
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <Button onClick={() => { setPage(1); handleSearch(1); }} disabled={isSearching} className="h-10 w-10 sm:h-11 sm:w-11 p-0">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Filters and View Toggle */}
              <div className="flex items-center justify-between gap-2 pb-1">
                {/* Filters - Horizontal scroll on mobile */}
                <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    <select
                      className="text-xs sm:text-sm bg-background border rounded-md px-2 py-1.5"
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as any)}
                    >
                      <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                      <option value="landscape">{isRTL ? 'أفقي' : 'Landscape'}</option>
                      <option value="portrait">{isRTL ? 'عمودي' : 'Portrait'}</option>
                      <option value="square">{isRTL ? 'مربع' : 'Square'}</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <select
                      className="text-xs sm:text-sm bg-background border rounded-md px-2 py-1.5"
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as any)}
                    >
                      <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                      <option value="photo">{isRTL ? 'صورة' : 'Photo'}</option>
                      <option value="vector">{isRTL ? 'فيكتور' : 'Vector'}</option>
                    </select>
                  </div>
                </div>

                {/* View Size Toggle */}
                <div className="flex items-center gap-1 shrink-0 border rounded-lg p-0.5 bg-muted/30">
                  <button
                    onClick={() => setGridSize('small')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      gridSize === 'small' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isRTL ? 'صغير' : 'Small'}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGridSize('medium')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      gridSize === 'medium' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isRTL ? 'متوسط' : 'Medium'}
                  >
                    <Grid2X2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGridSize('large')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      gridSize === 'large' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isRTL ? 'كبير' : 'Large'}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Selection Counter */}
              {multiSelectEnabled && selectionCount > 0 && (
                <div className="flex items-center justify-center py-1">
                  <span className="text-xs sm:text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {isRTL 
                      ? `${selectionCount} ${selectionCount === 1 ? 'صورة مختارة' : 'صور مختارة'}`
                      : `${selectionCount} ${selectionCount === 1 ? 'photo' : 'photos'} selected`}
                  </span>
                </div>
              )}
            </div>
            
            {/* Photos Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {isSearching ? (
                <div className="flex items-center justify-center h-48 sm:h-64">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                </div>
              ) : stockPhotos.length > 0 ? (
                <div className={cn("grid", gridClasses[gridSize])}>
                  {stockPhotos.map((photo) => {
                    const displayUrl = resolvePhotoDisplayUrl(photo);
                    const selectionUrl = resolvePhotoSelectionUrl(photo);
                    const selected = isPhotoSelected(selectionUrl);

                    return (
                      <div 
                        key={photo.id}
                        className={cn(
                          "relative overflow-hidden cursor-pointer transition-all active:scale-[0.98] bg-muted/20",
                          gridSize === 'large' ? "aspect-video rounded-xl" : "aspect-[4/3] rounded-lg",
                          selected
                            ? "ring-2 ring-primary ring-offset-1 ring-offset-background" 
                            : "border border-border/50"
                        )}
                        onClick={() => {
                          if (!selectionUrl) return;
                          handleSelectPhoto({
                            url: selectionUrl,
                            title: photo.title
                          });
                        }}
                      >
                        {displayUrl ? (
                          <div className="w-full h-full p-2 bg-muted/20">
                            <img 
                              src={displayUrl} 
                              alt={photo.title}
                              className="w-full h-full object-contain rounded-md"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (selectionUrl && target.src !== selectionUrl) {
                                  target.src = selectionUrl;
                                  return;
                                }
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                            {photo.title}
                          </div>
                        )}
                        {/* Selection overlay */}
                        {selected && (
                          <div className="absolute inset-0 bg-primary/20" />
                        )}
                        {/* Checkmark badge */}
                        {selected && (
                          <div className={cn(
                            "absolute bg-primary text-primary-foreground rounded-full shadow-lg",
                            gridSize === 'small' ? "top-1 right-1 p-0.5" : "top-2 right-2 p-1.5"
                          )}>
                            <Check className={gridSize === 'small' ? "h-3 w-3" : "h-4 w-4"} strokeWidth={3} />
                          </div>
                        )}
                        {/* Title on large view */}
                        {gridSize === 'large' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-sm font-medium truncate">{photo.title}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Image className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {stockError
                      ? (isRTL ? 'البحث في Freepik غير متاح الآن' : 'Freepik search is unavailable right now')
                      : (isRTL ? 'لم يتم العثور على صور. جرب كلمات بحث مختلفة.' : 'No photos found. Try different search terms.')}
                  </p>
                  {stockError && (
                    <p className="text-xs text-muted-foreground/70 mt-2 max-w-xl">{stockError}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Search className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isRTL ? 'ابحث عن صور من مكتبة Freepik' : 'Search for photos from the Freepik library'}
                  </p>
                </div>
              )}
            </div>
            
            {/* Pagination */}
            {stockPhotos.length > 0 && (
              <div className="p-3 sm:p-4 border-t flex items-center justify-between shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                >
                  {isRTL ? 'السابق' : 'Previous'}
                </Button>
                <span className="text-xs sm:text-sm">
                  {isRTL ? `${page} / ${totalPages}` : `${page} / ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                >
                  {isRTL ? 'التالي' : 'Next'}
                </Button>
              </div>
            )}
          </TabsContent>
          
          {/* My Photos Tab */}
          <TabsContent value="user" className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Photos Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {isLoadingPhotos || isUploading ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                    {isUploading 
                      ? (isRTL ? 'جاري رفع الصورة...' : 'Uploading photo...') 
                      : (isRTL ? 'جاري التحميل...' : 'Loading...')}
                  </p>
                </div>
              ) : backendPhotos.length > 0 ? (
                <div className={cn("grid", gridClasses[gridSize])}>
                  {backendPhotos.map((photo) => (
                    <div 
                      key={photo.id}
                      className={cn(
                        "relative overflow-hidden cursor-pointer transition-all active:scale-[0.98]",
                        gridSize === 'large' ? "aspect-video rounded-xl" : "aspect-[4/3] rounded-lg",
                        isPhotoSelected(photo.url) 
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-background" 
                          : "border border-border/50"
                      )}
                      onClick={() => handleSelectPhoto({
                        url: photo.url,
                        title: photo.filename
                      })}
                    >
                      <img 
                        src={photo.url} 
                        alt={photo.filename}
                        className="w-full h-full object-contain bg-muted/20 p-2"
                      />
                      {/* Selection overlay */}
                      {isPhotoSelected(photo.url) && (
                        <div className="absolute inset-0 bg-primary/20" />
                      )}
                      {/* Checkmark badge */}
                      {isPhotoSelected(photo.url) && (
                        <div className={cn(
                          "absolute bg-primary text-primary-foreground rounded-full shadow-lg",
                          gridSize === 'small' ? "top-1 right-1 p-0.5" : "top-2 right-2 p-1.5"
                        )}>
                          <Check className={gridSize === 'small' ? "h-3 w-3" : "h-4 w-4"} strokeWidth={3} />
                        </div>
                      )}
                      {/* Filename on large view */}
                      {gridSize === 'large' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <p className="text-white text-sm font-medium truncate">{photo.filename}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Upload More Button in Grid */}
                  <button
                    onClick={handleUploadClick}
                    className={cn(
                      "border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors",
                      gridSize === 'large' ? "aspect-video rounded-xl" : "aspect-[4/3] rounded-lg"
                    )}
                  >
                    <Upload className={gridSize === 'small' ? "h-4 w-4 text-muted-foreground" : "h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground"} />
                    {gridSize !== 'small' && (
                      <span className="text-xs text-muted-foreground">
                        {isRTL ? 'رفع المزيد' : 'Upload More'}
                      </span>
                    )}
                  </button>
                </div>
              ) : noPhotosFound ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    {isRTL ? 'لم يتم العثور على صور مرفوعة. يرجى تحميل الصور.' : 'No uploaded photos found. Please upload photos.'}
                  </p>
                  <Button 
                    onClick={handleUploadClick}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {isRTL ? 'رفع صور' : 'Upload Photos'}
                  </Button>
                </div>
              ) : !projectId ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Image className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isRTL ? 'يرجى تفعيل الخادم أولاً' : 'Please enable the backend first'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center">
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4 animate-spin" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isRTL ? 'جاري التحقق من الصور...' : 'Checking for photos...'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Saved Photos Tab */}
          <TabsContent value="saved" className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden">
            {/* Photos Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {isLoadingSaved ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </p>
                </div>
              ) : savedImages.length > 0 ? (
                <div className={cn("grid", gridClasses[gridSize])}>
                  {savedImages.map((photo) => (
                    <div 
                      key={photo.id}
                      className={cn(
                        "relative overflow-hidden cursor-pointer transition-all active:scale-[0.98]",
                        gridSize === 'large' ? "aspect-video rounded-xl" : "aspect-[4/3] rounded-lg",
                        isPhotoSelected(photo.image_url) 
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-background" 
                          : "border border-border/50"
                      )}
                      onClick={() => handleSelectPhoto({
                        url: photo.image_url,
                        title: photo.prompt || (isRTL ? 'صورة مولّدة' : 'AI Generated Photo')
                      })}
                    >
                      <img 
                        src={photo.image_url} 
                        alt={photo.prompt || 'Generated image'}
                        className="w-full h-full object-contain bg-muted/20 p-2"
                      />
                      {/* Selection overlay */}
                      {isPhotoSelected(photo.image_url) && (
                        <div className="absolute inset-0 bg-primary/20" />
                      )}
                      {/* Checkmark badge */}
                      {isPhotoSelected(photo.image_url) && (
                        <div className={cn(
                          "absolute bg-primary text-primary-foreground rounded-full shadow-lg",
                          gridSize === 'small' ? "top-1 right-1 p-0.5" : "top-2 right-2 p-1.5"
                        )}>
                          <Check className={gridSize === 'small' ? "h-3 w-3" : "h-4 w-4"} strokeWidth={3} />
                        </div>
                      )}
                      {/* Prompt on large view */}
                      {gridSize === 'large' && photo.prompt && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <p className="text-white text-sm font-medium truncate">{photo.prompt}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isRTL ? 'لا توجد صور مولّدة ومحفوظة. أنشئ صوراً في استوديو الذكاء الاصطناعي أولاً.' : 'No AI generated photos found. Create images in the AI Studio first.'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Footer Actions - Safe area aware */}
        <div className="p-4 border-t shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background">
          {multiSelectEnabled ? (
            <div className="flex flex-col gap-3">
              {/* Selection counter - always visible with status */}
              <div className="text-center text-sm font-medium">
                {selectedPhotos.length > 0 ? (
                  <span className="text-primary">
                    {isRTL 
                      ? `${selectedPhotos.length} ${selectedPhotos.length === 1 ? 'صورة مختارة' : 'صور مختارة'}` 
                      : `${selectedPhotos.length} ${selectedPhotos.length === 1 ? 'photo' : 'photos'} selected`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {isRTL ? 'لم يتم اختيار أي صور' : 'No photos selected'}
                  </span>
                )}
              </div>
              {/* Full-width buttons for mobile */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  className="flex-1 h-12 text-base font-medium rounded-xl"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button 
                  onClick={handleConfirmSelection}
                  disabled={selectedPhotos.length === 0}
                  className="flex-1 h-12 text-base font-medium rounded-xl"
                >
                  {isRTL ? 'تأكيد' : 'Confirm'}
                  {selectedPhotos.length > 0 && ` (${selectedPhotos.length})`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 h-12 text-base font-medium rounded-xl"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleConfirmSelection}
                disabled={!selectedPhoto}
                className="flex-1 h-12 text-base font-medium rounded-xl"
              >
                {isRTL ? 'اختيار' : 'Select'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
