import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { FreepikService, FreepikResource } from '@/services/FreepikService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Image, Check, Upload, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StockPhotoSelectorProps {
  userId: string;
  onSelectPhoto: (photo: { url: string; title: string }) => void;
  onClose: () => void;
  searchTerm?: string;
  initialTab?: 'stock' | 'user';
}

export function StockPhotoSelector({ userId, onSelectPhoto, onClose, searchTerm = '', initialTab = 'stock' }: StockPhotoSelectorProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  const [activeTab, setActiveTab] = useState<'stock' | 'user'>(initialTab);
  const [searchQuery, setSearchQuery] = useState(searchTerm);
  const [isSearching, setIsSearching] = useState(false);
  const [stockPhotos, setStockPhotos] = useState<FreepikResource[]>([]);
  const [userPhotos, setUserPhotos] = useState<Array<{ filename: string; url: string }>>([]);
  const [isLoadingUserPhotos, setIsLoadingUserPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [orientation, setOrientation] = useState<'all' | 'landscape' | 'portrait' | 'square'>('all');
  const [contentType, setContentType] = useState<'all' | 'photo' | 'vector'>('photo');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [noUserPhotosFound, setNoUserPhotosFound] = useState(false);

  // Load user photos on mount
  useEffect(() => {
    loadUserPhotos();
  }, [userId]);

  // Initial search if term provided
  useEffect(() => {
    if (searchTerm) {
      handleSearch();
    }
  }, [searchTerm]);

  const loadUserPhotos = async () => {
    setIsLoadingUserPhotos(true);
    setNoUserPhotosFound(false);
    
    try {
      const result = await FreepikService.getUserPhotos(userId);
      
      if (result.success) {
        setUserPhotos(result.photos || []);
        if ((result.photos?.length || 0) === 0) {
          setNoUserPhotosFound(true);
        }
      } else {
        console.error('Failed to load user photos:', result.error);
        toast.error(isRTL ? 'فشل في تحميل الصور' : 'Failed to load photos');
        setNoUserPhotosFound(true);
      }
    } catch (err) {
      console.error('Error loading user photos:', err);
      setNoUserPhotosFound(true);
    } finally {
      setIsLoadingUserPhotos(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setStockPhotos([]);
    
    try {
      // Build filters based on selected options
      const filters: any = {};
      
      // Orientation filter
      if (orientation !== 'all') {
        filters.orientation = {};
        filters.orientation[orientation] = 1;
      }
      
      // Content type filter
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
    setSelectedPhoto(photo);
  };

  const handleConfirmSelection = () => {
    if (selectedPhoto) {
      onSelectPhoto(selectedPhoto);
      onClose();
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'stock' | 'user');
    if (value === 'user' && userPhotos.length === 0 && !isLoadingUserPhotos) {
      loadUserPhotos();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-background rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {isRTL ? 'اختيار صورة' : 'Select Photo'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <Tabs defaultValue="stock" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="px-4 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="stock" className="flex-1">
                <Image className="h-4 w-4 mr-2" />
                {isRTL ? 'صور مخزنة' : 'Stock Photos'}
              </TabsTrigger>
              <TabsTrigger value="user" className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                {isRTL ? 'صوري' : 'My Photos'}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="stock" className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={isRTL ? 'البحث عن الصور...' : 'Search photos...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {isRTL ? 'الاتجاه:' : 'Orientation:'}
                  </span>
                  <select
                    className="text-sm bg-background border rounded-md p-1"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as any)}
                    aria-label={isRTL ? 'اختر الاتجاه' : 'Select orientation'}
                    title={isRTL ? 'اختر الاتجاه' : 'Select orientation'}
                  >
                    <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                    <option value="landscape">{isRTL ? 'أفقي' : 'Landscape'}</option>
                    <option value="portrait">{isRTL ? 'عمودي' : 'Portrait'}</option>
                    <option value="square">{isRTL ? 'مربع' : 'Square'}</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {isRTL ? 'النوع:' : 'Type:'}
                  </span>
                  <select
                    className="text-sm bg-background border rounded-md p-1"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as any)}
                    aria-label={isRTL ? 'اختر النوع' : 'Select type'}
                    title={isRTL ? 'اختر النوع' : 'Select type'}
                  >
                    <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                    <option value="photo">{isRTL ? 'صورة' : 'Photo'}</option>
                    <option value="vector">{isRTL ? 'فيكتور' : 'Vector'}</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isSearching ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : stockPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stockPhotos.map((photo) => (
                    <div 
                      key={photo.id}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-all",
                        selectedPhoto?.url === photo.image.source.url && "ring-2 ring-primary"
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
                      {selectedPhoto?.url === photo.image.source.url && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Image className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {isRTL ? 'لم يتم العثور على صور. جرب كلمات بحث مختلفة.' : 'No photos found. Try different search terms.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {isRTL ? 'ابحث عن صور من مكتبة Freepik' : 'Search for photos from the Freepik library'}
                  </p>
                </div>
              )}
            </div>
            
            {stockPhotos.length > 0 && (
              <div className="p-4 border-t flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  {isRTL ? 'السابق' : 'Previous'}
                </Button>
                <span className="text-sm">
                  {isRTL ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  {isRTL ? 'التالي' : 'Next'}
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="user" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingUserPhotos ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : userPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {userPhotos.map((photo, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-all",
                        selectedPhoto?.url === photo.url && "ring-2 ring-primary"
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
                      {selectedPhoto?.url === photo.url && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : noUserPhotosFound ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {isRTL ? 'لم يتم العثور على صور مرفوعة. يرجى تحميل الصور أولاً.' : 'No uploaded photos found. Please upload photos first.'}
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      toast.info(isRTL ? 'يرجى تحميل الصور من صفحة المشروع' : 'Please upload photos from the project page');
                      onClose();
                    }}
                  >
                    {isRTL ? 'تحميل الصور' : 'Upload Photos'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground">
                    {isRTL ? 'جاري التحقق من الصور المرفوعة...' : 'Checking for uploaded photos...'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleConfirmSelection}
            disabled={!selectedPhoto}
          >
            {isRTL ? 'اختيار' : 'Select'}
          </Button>
        </div>
      </div>
    </div>
  );
}
