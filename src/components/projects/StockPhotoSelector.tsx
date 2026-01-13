import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { FreepikService, FreepikResource } from '@/services/FreepikService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Image, Check, Upload, Filter, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StockPhotoSelectorProps {
  userId: string;
  projectId?: string;
  onSelectPhoto: (photo: { url: string; title: string }) => void;
  onSelectPhotos?: (photos: { url: string; title: string }[]) => void; // Multi-select
  multiSelect?: boolean;
  onClose: () => void;
  searchTerm?: string;
  initialTab?: 'stock' | 'user';
}

interface BackendPhoto {
  id: string;
  filename: string;
  url: string;
  storage_path: string;
  file_type: string | null;
}

export function StockPhotoSelector({ 
  userId, 
  projectId,
  onSelectPhoto,
  onSelectPhotos,
  multiSelect = false,
  onClose, 
  searchTerm = '', 
  initialTab = 'stock' 
}: StockPhotoSelectorProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  const [activeTab, setActiveTab] = useState<'stock' | 'user'>(initialTab);
  const [searchQuery, setSearchQuery] = useState(''); // Always start empty - user must type search
  const [isSearching, setIsSearching] = useState(false);
  const [stockPhotos, setStockPhotos] = useState<FreepikResource[]>([]);
  const [backendPhotos, setBackendPhotos] = useState<BackendPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<{ url: string; title: string }[]>([]); // Multi-select
  const [orientation, setOrientation] = useState<'all' | 'landscape' | 'portrait' | 'square'>('all');
  const [contentType, setContentType] = useState<'all' | 'photo' | 'vector'>('photo');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [noPhotosFound, setNoPhotosFound] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load backend photos on mount
  useEffect(() => {
    if (projectId) {
      loadBackendPhotos();
    }
  }, [projectId]);

  // Removed: auto-search on mount - user must manually search

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

      // Get signed URLs for each image
      const photosWithUrls = await Promise.all(
        imageFiles.map(async (file) => {
          const { data: urlData } = await supabase.storage
            .from('project-uploads')
            .createSignedUrl(file.storage_path, 3600); // 1 hour expiry
          
          return {
            id: file.id,
            filename: file.filename,
            url: urlData?.signedUrl || '',
            storage_path: file.storage_path,
            file_type: file.file_type
          };
        })
      );

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setStockPhotos([]);
    
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
        page,
        12,
        language === 'ar' ? 'ar-SA' : 'en-US'
      );
      
      if (result.success && result.data) {
        setStockPhotos(result.data.data || []);
        setTotalPages(result.data.meta.last_page || 1);
      } else {
        console.error('Failed to search photos:', result.error);
        toast.error(isRTL ? 'فشل في البحث عن الصور' : 'Failed to search photos');
      }
    } catch (err) {
      console.error('Error searching photos:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    handleSearch();
  };

  const handleSelectPhoto = (photo: { url: string; title: string }) => {
    if (multiSelect) {
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
    if (multiSelect) {
      return selectedPhotos.some(p => p.url === url);
    }
    return selectedPhoto?.url === url;
  };

  const handleConfirmSelection = () => {
    if (multiSelect && selectedPhotos.length > 0) {
      if (onSelectPhotos) {
        onSelectPhotos(selectedPhotos);
      } else {
        // Fallback - send first photo
        onSelectPhoto(selectedPhotos[0]);
      }
      onClose();
    } else if (selectedPhoto) {
      onSelectPhoto(selectedPhoto);
      onClose();
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'stock' | 'user');
    if (value === 'user' && backendPhotos.length === 0 && !isLoadingPhotos && projectId) {
      loadBackendPhotos();
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
        const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-stretch sm:items-center justify-center p-0 sm:p-4 isolate">
      <div 
        className={cn(
          "bg-background shadow-lg w-full flex flex-col",
          "h-[100dvh] rounded-none", // Full screen on mobile
          "sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:max-w-3xl"
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header - Safe area aware */}
        <div className="flex items-center justify-between p-4 border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 className="text-lg font-semibold">
            {multiSelect 
              ? (isRTL ? 'اختيار صور متعددة' : 'Select Multiple Photos')
              : (isRTL ? 'اختيار صورة' : 'Select Photo')
            }
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <Tabs defaultValue="stock" value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="px-3 sm:px-4 pt-2 shrink-0">
            <TabsList className="w-full h-10 sm:h-11">
              <TabsTrigger value="stock" className="flex-1 text-xs sm:text-sm gap-1.5 sm:gap-2">
                <Image className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isRTL ? 'صور مخزنة' : 'Stock Photos'}
              </TabsTrigger>
              <TabsTrigger value="user" className="flex-1 text-xs sm:text-sm gap-1.5 sm:gap-2">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isRTL ? 'صوري' : 'My Photos'}
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Stock Photos Tab */}
          <TabsContent value="stock" className="flex-1 flex flex-col min-h-0 mt-0">
            {/* Search & Filters - Mobile optimized */}
            <div className="p-3 sm:p-4 border-b shrink-0 space-y-2 sm:space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={isRTL ? 'البحث عن الصور...' : 'Search photos...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="h-10 w-10 sm:h-11 sm:w-11 p-0">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Filters - Horizontal scroll on mobile */}
              <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 scrollbar-none">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {isRTL ? 'الاتجاه:' : 'Orientation:'}
                  </span>
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
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {isRTL ? 'النوع:' : 'Type:'}
                  </span>
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
            </div>
            
            {/* Photos Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {isSearching ? (
                <div className="flex items-center justify-center h-48 sm:h-64">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                </div>
              ) : stockPhotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {stockPhotos.map((photo) => (
                    <div 
                      key={photo.id}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all active:scale-[0.98]",
                        isPhotoSelected(photo.image.source.url) 
                          ? "ring-3 ring-primary ring-offset-2 ring-offset-background" 
                          : "border border-border/50"
                      )}
                      onClick={() => handleSelectPhoto({
                        url: photo.image.source.url,
                        title: photo.title
                      })}
                    >
                      <img 
                        src={photo.image.source.url} 
                        alt={photo.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Selection overlay */}
                      {isPhotoSelected(photo.image.source.url) && (
                        <div className="absolute inset-0 bg-primary/20" />
                      )}
                      {/* Checkmark badge */}
                      {isPhotoSelected(photo.image.source.url) && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                  <Image className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isRTL ? 'لم يتم العثور على صور. جرب كلمات بحث مختلفة.' : 'No photos found. Try different search terms.'}
                  </p>
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
          <TabsContent value="user" className="flex-1 flex flex-col min-h-0 mt-0">
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
                <div className="grid grid-cols-2 gap-3">
                  {backendPhotos.map((photo) => (
                    <div 
                      key={photo.id}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all active:scale-[0.98]",
                        isPhotoSelected(photo.url) 
                          ? "ring-3 ring-primary ring-offset-2 ring-offset-background" 
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
                        className="w-full h-full object-cover"
                      />
                      {/* Selection overlay */}
                      {isPhotoSelected(photo.url) && (
                        <div className="absolute inset-0 bg-primary/20" />
                      )}
                      {/* Checkmark badge */}
                      {isPhotoSelected(photo.url) && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Upload More Button in Grid */}
                  <button
                    onClick={handleUploadClick}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {isRTL ? 'رفع المزيد' : 'Upload More'}
                    </span>
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
        </Tabs>
        
        {/* Footer Actions - Safe area aware */}
        <div className="p-4 border-t shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background">
          {multiSelect ? (
            <div className="flex flex-col gap-3">
              {/* Selection counter */}
              {selectedPhotos.length > 0 && (
                <div className="text-center text-sm font-medium text-primary">
                  {isRTL ? `${selectedPhotos.length} صور مختارة` : `${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''} selected`}
                </div>
              )}
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
}
