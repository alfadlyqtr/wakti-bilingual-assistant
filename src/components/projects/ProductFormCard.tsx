import React, { useEffect, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, ExternalLink, Package, Sparkles, ArrowRight, ShoppingBag, ChevronDown, Type, ImagePlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { callEdgeFunctionWithRetry, supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CategoryOption {
  id?: string;
  name: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: number | '';
  compare_at_price?: number | '';
  currency: string;
  stock_quantity: number | '';
  track_inventory: boolean;
  category: string;
  image_url?: string;
  sku: string;
  status: 'active' | 'draft' | 'archived';
  variants?: { name: string; options: string[] }[];
}

interface ProductFormCardProps {
  projectId: string;
  isRTL: boolean;
  onCancel: () => void;
  onSaved: (productName: string) => void;
  onOpenInventory: () => void;
}

export function ProductFormCard({ projectId, isRTL, onCancel, onSaved, onOpenInventory }: ProductFormCardProps) {
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [aiDescriptionMode, setAiDescriptionMode] = useState<'text' | 'image' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    currency: 'QAR',
    stock_quantity: '',
    track_inventory: true,
    category: '',
    image_url: '',
    sku: '',
    status: 'active',
    variants: []
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('project_collections')
        .select('*')
        .eq('project_id', projectId)
        .eq('collection_name', 'categories');
      setCategories((data || []).map(d => ({ id: d.id, ...(d.data as Record<string, any> || {}) })) as CategoryOption[]);
    };
    fetchCategories();
  }, [projectId]);

  const buildDescriptionPrompt = () => {
    const lines = [
      'Write a short-to-medium product description (2-4 sentences).',
      'Make it clear, friendly, and sales-ready.',
      form.name ? `Product name: ${form.name}` : '',
      form.category ? `Category: ${form.category}` : '',
      form.price ? `Price: ${form.price} ${form.currency}` : '',
      form.compare_at_price ? `Compare at price: ${form.compare_at_price} ${form.currency}` : '',
      form.sku ? `SKU: ${form.sku}` : '',
      form.description?.trim() ? `Notes from user: ${form.description.trim()}` : ''
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleGenerateDescriptionFromText = async () => {
    if (!form.name.trim()) {
      toast.error(t('Add a product name first', 'أضف اسم المنتج أولاً'));
      return;
    }

    setGeneratingDescription(true);
    setAiDescriptionMode('text');
    try {
      const prompt = buildDescriptionPrompt();
      const response = await callEdgeFunctionWithRetry<{ success?: boolean; generatedText?: string; error?: string }>('text-generator', {
        body: {
          prompt,
          mode: 'compose',
          language: isRTL ? 'ar' : 'en',
          contentType: 'product_description',
          length: 'medium',
          tone: 'friendly'
        },
        maxRetries: 1
      });

      if (response?.success && response.generatedText) {
        setForm(prev => ({ ...prev, description: response.generatedText?.trim() || prev.description }));
        toast.success(t('Description generated!', 'تم إنشاء الوصف!'));
      } else {
        toast.error(response?.error || t('Failed to generate description', 'فشل إنشاء الوصف'));
      }
    } catch (err) {
      toast.error(t('Failed to generate description', 'فشل إنشاء الوصف'));
    } finally {
      setGeneratingDescription(false);
      setAiDescriptionMode(null);
    }
  };

  const handleGenerateDescriptionFromImage = async () => {
    if (!form.image_url) {
      toast.error(t('Upload a product image first', 'ارفع صورة المنتج أولاً'));
      return;
    }

    setGeneratingDescription(true);
    setAiDescriptionMode('image');
    try {
      const visionPrompt = isRTL
        ? `انظر إلى هذه الصورة واكتب وصفاً قصيراً وجذاباً للمنتج (2-4 جمل). اجعله واضحاً وودوداً وجاهزاً للبيع. لا تذكر أي شيء عن الصورة نفسها، فقط صف المنتج.`
        : `Look at this image and write a short, compelling product description (2-4 sentences). Make it clear, friendly, and sales-ready. Don't mention anything about the image itself, just describe the product.`;

      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-vision-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          prompt: visionPrompt,
          language: isRTL ? 'ar' : 'en',
          images: [{ url: form.image_url }],
          options: { max_tokens: 500 }
        })
      });

      if (!response.ok) {
        throw new Error(`Vision API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.token) fullText += parsed.token;
            else if (parsed.content) fullText += parsed.content;
          } catch {}
        }
      }

      if (fullText.trim()) {
        setForm(prev => ({ ...prev, description: fullText.trim() }));
        toast.success(t('Description generated from image!', 'تم إنشاء الوصف من الصورة!'));
      } else {
        toast.error(t('Could not generate description from image', 'تعذر إنشاء الوصف من الصورة'));
      }
    } catch (err) {
      console.error('Vision description error:', err);
      toast.error(t('Failed to generate description from image', 'فشل إنشاء الوصف من الصورة'));
    } finally {
      setGeneratingDescription(false);
      setAiDescriptionMode(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error(t('Please log in to upload images', 'يرجى تسجيل الدخول لرفع الصور'));
        return;
      }

      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      // Use 'products' subfolder to separate from user uploads
      const filePath = `${user.id}/${projectId}/products/${timestamp}-${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from('project-uploads')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('project-uploads').getPublicUrl(filePath);
      setForm(prev => ({ ...prev, image_url: data.publicUrl }));
      
      // NOTE: Do NOT insert into project_uploads table - product images should not appear in Uploads tab
    } catch (err) {
      toast.error(t('Failed to upload image', 'فشل رفع الصورة'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const productData = {
        ...form,
        price: form.price === '' ? 0 : Number(form.price),
        compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
        stock_quantity: form.stock_quantity === '' ? 0 : Number(form.stock_quantity)
      } as Record<string, any>;
      const user = await supabase.auth.getUser();
      const { data: createdProduct, error } = await supabase
        .from('project_collections')
        .insert([
          {
            project_id: projectId,
            user_id: user.data.user?.id || '',
            collection_name: 'products',
            data: JSON.parse(JSON.stringify(productData))
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const { error: inventoryError } = await supabase
        .from('project_inventory')
        .upsert(
          {
            project_id: projectId,
            collection_item_id: createdProduct?.id,
            collection_name: 'products',
            stock_quantity: productData.stock_quantity ?? 0,
            low_stock_threshold: 5,
            track_inventory: productData.track_inventory ?? true,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'project_id,collection_item_id' }
        );

      if (inventoryError) throw inventoryError;

      toast.success(t('Product added', 'تمت إضافة المنتج'));
      onSaved(form.name.trim());
    } catch (err) {
      toast.error(t('Failed to save product', 'فشل حفظ المنتج'));
    } finally {
      setSaving(false);
    }
  };

  // Scroll to show the TOP of this card when it mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cardRef.current) {
        // Use scrollIntoView with block: 'start' to show top of card
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={cardRef} className={cn('w-full space-y-3', isRTL && 'rtl')}>
      {/* Friendly Intro Message - no animation delay for instant visibility */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-500/15 dark:via-teal-500/10 dark:to-cyan-500/15 border border-emerald-500/20 dark:border-emerald-500/30">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/25">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {t("Let's add your product! 🛍️", 'هيا نضيف منتجك! 🛍️')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('Fill in the details below and I\'ll save it to your inventory instantly.', 'املأ التفاصيل أدناه وسأحفظها في مخزونك فوراً.')}
          </p>
        </div>
      </div>

      {/* Product Form Card - no animation delay to prevent glitch */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-white/90 via-white/80 to-white/95 dark:from-[#0f1117] dark:via-[#0c0f14] dark:to-[#0f1117] shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Header with gradient accent */}
        <div className="relative px-4 py-3 border-b border-border/40 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-indigo-500/5 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-indigo-500/10">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                <Package className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t('Add Product', 'إضافة منتج')}</p>
                <p className="text-[11px] text-muted-foreground">{t('Quick add from chat', 'إضافة سريعة من المحادثة')}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground hover:bg-red-500/10 h-8 px-2">
              {t('Close', 'إغلاق')}
            </Button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
        <div>
          <Label>{t('Product Image', 'صورة المنتج')}</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-white/10 border border-dashed border-border/60 flex items-center justify-center overflow-hidden">
              {form.image_url ? (
                <img src={form.image_url} alt={form.name || 'Product'} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {t('Upload Image', 'رفع صورة')}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-1">{t('PNG, JPG up to 5MB', 'PNG, JPG حتى 5 ميغابايت')}</p>
            </div>
          </div>
        </div>

        <div>
          <Label>{t('Product Name', 'اسم المنتج')} *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('e.g. iPhone 15 Pro', 'مثال: آيفون 15 برو')}
            className="mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label>{t('Description', 'الوصف')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={generatingDescription}
                  className="h-7 px-2 text-xs gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  {generatingDescription ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {aiDescriptionMode === 'image' 
                        ? t('Analyzing image...', 'جاري تحليل الصورة...')
                        : t('Generating...', 'جاري الإنشاء...')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('Generate with AI', 'إنشاء بالذكاء')}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={handleGenerateDescriptionFromText}
                  disabled={!form.name.trim()}
                  className="gap-2 cursor-pointer"
                >
                  <Type className="h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t('From Text', 'من النص')}</span>
                    <span className="text-[10px] text-muted-foreground">{t('Uses product name & details', 'يستخدم اسم المنتج والتفاصيل')}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleGenerateDescriptionFromImage}
                  disabled={!form.image_url}
                  className="gap-2 cursor-pointer"
                >
                  <ImagePlus className="h-4 w-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t('From Image', 'من الصورة')}</span>
                    <span className="text-[10px] text-muted-foreground">{t('AI analyzes product photo', 'الذكاء يحلل صورة المنتج')}</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('Describe your product...', 'صف منتجك...')}
            className="mt-1 min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('Price', 'السعر')} *</Label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value === '' ? '' : Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t('Compare at Price', 'السعر قبل الخصم')}</Label>
            <Input
              type="number"
              value={form.compare_at_price ?? ''}
              onChange={(e) => setForm(prev => ({ ...prev, compare_at_price: e.target.value === '' ? '' : Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('Stock Quantity', 'الكمية بالمخزون')}</Label>
            <Input
              type="number"
              value={form.stock_quantity}
              onChange={(e) => setForm(prev => ({ ...prev, stock_quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t('SKU', 'رمز المنتج')}</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <div>
          <Label>{t('Category', 'الفئة')}</Label>
          <Select value={form.category} onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={t('Select category', 'اختر فئة')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('Status', 'الحالة')}</Label>
          <Select value={form.status} onValueChange={(v) => setForm(prev => ({ ...prev, status: v as ProductFormData['status'] }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('Active', 'نشط')}</SelectItem>
              <SelectItem value="draft">{t('Draft', 'مسودة')}</SelectItem>
              <SelectItem value="archived">{t('Archived', 'مؤرشف')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 pt-0 flex flex-col gap-2.5">
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="w-full h-11 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white font-semibold shadow-lg shadow-pink-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <ShoppingBag className="h-4 w-4 mr-2" />
            {t('Add Product', 'إضافة المنتج')}
          </Button>
        </div>
        </div>

      {/* Footer Tip - Add Multiple Products */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-indigo-500/15 dark:border-indigo-500/25 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 dark:bg-indigo-500/20 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {t('Need to add multiple products?', 'تحتاج إضافة منتجات متعددة؟')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('Use the full inventory manager for bulk operations', 'استخدم مدير المخزون الكامل للعمليات المجمعة')}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onOpenInventory} 
          className="h-8 px-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1.5"
        >
          {t('Go there', 'اذهب هناك')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
