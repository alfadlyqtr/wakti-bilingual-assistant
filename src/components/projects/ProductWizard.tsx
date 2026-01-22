import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  ShoppingBag, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  LayoutGrid, 
  Grid3X3,
  List,
  Plus,
  Trash2,
  DollarSign,
  Package,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  inStock: boolean;
}

export interface ProductDisplayConfig {
  layout: 'grid' | 'list' | 'masonry';
  columns: 2 | 3 | 4;
  showPrice: boolean;
  showDescription: boolean;
  showAddToCart: boolean;
  showCategories: boolean;
  design: {
    borderRadius: 'rounded' | 'sharp' | 'pill';
    colorScheme: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
    cardStyle: 'minimal' | 'bordered' | 'shadow';
  };
}

interface ProductWizardProps {
  existingProducts: Product[];
  onComplete: (config: ProductDisplayConfig, structuredPrompt: string, newProducts?: Product[]) => void;
  onCancel: () => void;
  onSkipWizard: () => void;
  originalPrompt: string;
  projectId?: string;
}

const DEFAULT_CATEGORIES = ['All', 'Featured', 'New Arrivals', 'Sale'];

export function ProductWizard({ existingProducts, onComplete, onCancel, onSkipWizard, originalPrompt, projectId }: ProductWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: Products
  const [products, setProducts] = useState<Product[]>(existingProducts);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', 
    price: 0, 
    description: '', 
    category: 'Featured',
    inStock: true 
  });
  
  // Step 2: Layout
  const [layout, setLayout] = useState<'grid' | 'list' | 'masonry'>('grid');
  const [columns, setColumns] = useState<2 | 3 | 4>(3);
  const [showPrice, setShowPrice] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showAddToCart, setShowAddToCart] = useState(true);
  const [showCategories, setShowCategories] = useState(true);
  
  // Step 3: Design
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [colorScheme, setColorScheme] = useState<'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');
  const [cardStyle, setCardStyle] = useState<'minimal' | 'bordered' | 'shadow'>('shadow');

  const COLOR_SCHEMES = [
    { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo', labelAr: 'نيلي' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Green', labelAr: 'أخضر' },
    { id: 'rose', color: 'bg-rose-500', label: 'Rose', labelAr: 'وردي' },
    { id: 'amber', color: 'bg-amber-500', label: 'Amber', labelAr: 'كهرماني' },
    { id: 'slate', color: 'bg-slate-600', label: 'Slate', labelAr: 'رمادي' },
  ];

  const handleAddProduct = () => {
    if (!newProduct.name?.trim()) return;
    const id = `new_${Date.now()}`;
    const product: Product = {
      id,
      name: newProduct.name.trim(),
      price: newProduct.price || 0,
      description: newProduct.description || '',
      category: newProduct.category || 'Featured',
      inStock: newProduct.inStock ?? true
    };
    setProducts(prev => [...prev, product]);
    setNewProduct({ name: '', price: 0, description: '', category: 'Featured', inStock: true });
    setShowAddProduct(false);
  };

  const handleRemoveProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleComplete = () => {
    const config: ProductDisplayConfig = {
      layout,
      columns,
      showPrice,
      showDescription,
      showAddToCart,
      showCategories,
      design: {
        borderRadius,
        colorScheme,
        cardStyle,
      }
    };

    const newlyCreatedProducts = products.filter(p => p.id.startsWith('new_'));

    let prompt = `Build a beautiful e-commerce product display with these EXACT specifications:

PRODUCTS TO DISPLAY:
${products.length > 0 ? products.map(p => `- ${p.name} ($${p.price}) - ${p.category}${p.description ? `: ${p.description}` : ''}`).join('\n') : 'Fetch products from backend API'}

LAYOUT:
- Display style: ${layout === 'grid' ? `Grid layout with ${columns} columns` : layout === 'list' ? 'List layout (vertical cards)' : `Masonry layout with ${columns} columns`}
- ${showCategories ? 'Include category filter tabs at the top' : 'No category filtering'}
- ${showPrice ? 'Show product prices prominently' : 'Hide prices'}
- ${showDescription ? 'Show product descriptions' : 'Hide descriptions'}
- ${showAddToCart ? 'Include "Add to Cart" button on each product' : 'No add to cart button'}

DESIGN:
- Card style: ${cardStyle} (${cardStyle === 'minimal' ? 'clean, no borders' : cardStyle === 'bordered' ? 'subtle border' : 'elevated with shadow'})
- Border radius: ${borderRadius}
- Color scheme: ${colorScheme} (use ${colorScheme}-500 for buttons and accents)
- Product images should use Freepik API with relevant queries
- Add hover effects on cards (scale, shadow change)
- Responsive: ${columns} columns on desktop, 2 on tablet, 1 on mobile

BACKEND INTEGRATION:
- Fetch products from: { projectId: "{{PROJECT_ID}}", action: "collection/products" }
- Add to cart: { projectId: "{{PROJECT_ID}}", action: "cart/add", data: { productId, quantity: 1 } }
- Show loading skeleton while fetching
- Handle empty state gracefully

CRITICAL - DO NOT:
- Do NOT hardcode product data (fetch from API)
- Do NOT create supabaseClient.js
- Do NOT write any API keys

Original request: ${originalPrompt}`;

    onComplete(config, prompt, newlyCreatedProducts.length > 0 ? newlyCreatedProducts : undefined);
  };

  const layoutOptions = [
    { id: 'grid', icon: <Grid3X3 className="h-5 w-5" />, label: 'Grid', labelAr: 'شبكة' },
    { id: 'list', icon: <List className="h-5 w-5" />, label: 'List', labelAr: 'قائمة' },
    { id: 'masonry', icon: <LayoutGrid className="h-5 w-5" />, label: 'Masonry', labelAr: 'متداخل' },
  ];

  const renderStep = () => {
    // Step 1: Products
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {isRTL ? 'منتجاتك' : 'Your Products'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'أضف منتجات لعرضها' : 'Add products to display'}
              </p>
            </div>
          </div>
          
          {/* Add New Product Form */}
          {showAddProduct ? (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <p className="text-xs font-medium text-primary">
                {isRTL ? 'إضافة منتج جديد' : 'Add New Product'}
              </p>
              <Input
                placeholder={isRTL ? 'اسم المنتج' : 'Product name'}
                value={newProduct.name || ''}
                onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">{isRTL ? 'السعر' : 'Price'}</Label>
                  <Input
                    type="number"
                    value={newProduct.price || 0}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">{isRTL ? 'الفئة' : 'Category'}</Label>
                  <select
                    value={newProduct.category || 'Featured'}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                  >
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Textarea
                placeholder={isRTL ? 'وصف المنتج (اختياري)' : 'Product description (optional)'}
                value={newProduct.description || ''}
                onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                className="text-sm min-h-[60px]"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddProduct(false)} className="flex-1 h-8 text-xs">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button size="sm" onClick={handleAddProduct} disabled={!newProduct.name?.trim()} className="flex-1 h-8 text-xs bg-primary">
                  <Plus className="h-3 w-3 mr-1" />
                  {isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddProduct(true)}
              className="w-full h-9 border-dashed text-xs"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? 'إضافة منتج جديد' : 'Add New Product'}
            </Button>
          )}
          
          {products.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${product.price} • {product.category}
                    </p>
                  </div>
                  {product.id.startsWith('new_') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{isRTL ? 'لا توجد منتجات بعد' : 'No products yet'}</p>
              <p className="text-xs mt-1">{isRTL ? 'أضف منتجاتك أعلاه أو سيتم جلبها من الباك إند' : 'Add products above or they will be fetched from backend'}</p>
            </div>
          )}
        </div>
      );
    }

    // Step 2: Layout
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اختر تخطيط العرض' : 'Choose display layout'}
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {layoutOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setLayout(opt.id as typeof layout)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  layout === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {opt.icon}
                <span className="text-xs font-medium">
                  {isRTL ? opt.labelAr : opt.label}
                </span>
              </button>
            ))}
          </div>

          {layout !== 'list' && (
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'عدد الأعمدة' : 'Columns'}</Label>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map(col => (
                  <button
                    key={col}
                    onClick={() => setColumns(col)}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg border transition-all",
                      columns === col
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">{isRTL ? 'خيارات العرض' : 'Display Options'}</Label>
            <div className="space-y-2">
              {[
                { key: 'showPrice', label: isRTL ? 'إظهار السعر' : 'Show Price', state: showPrice, setter: setShowPrice },
                { key: 'showDescription', label: isRTL ? 'إظهار الوصف' : 'Show Description', state: showDescription, setter: setShowDescription },
                { key: 'showAddToCart', label: isRTL ? 'زر إضافة للسلة' : 'Add to Cart Button', state: showAddToCart, setter: setShowAddToCart },
                { key: 'showCategories', label: isRTL ? 'فلتر الفئات' : 'Category Filter', state: showCategories, setter: setShowCategories },
              ].map(opt => (
                <div key={opt.key} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <Label className="text-xs">{opt.label}</Label>
                  <Switch checked={opt.state} onCheckedChange={opt.setter} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Design
    if (step === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تخصيص التصميم' : 'Customize design'}
          </p>
          
          <div className="space-y-3">
            {/* Card Style */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط البطاقة' : 'Card Style'}</Label>
              <div className="flex gap-2">
                {(['minimal', 'bordered', 'shadow'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setCardStyle(style)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium rounded-lg border transition-all",
                      cardStyle === style
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') : 
                     style === 'bordered' ? (isRTL ? 'محدد' : 'Bordered') : 
                     (isRTL ? 'مظلل' : 'Shadow')}
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط الحواف' : 'Border Style'}</Label>
              <div className="flex gap-2">
                {(['rounded', 'sharp', 'pill'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setBorderRadius(r)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium border transition-all",
                      r === 'sharp' ? 'rounded-none' : r === 'pill' ? 'rounded-full' : 'rounded-lg',
                      borderRadius === r
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {r === 'rounded' ? (isRTL ? 'مدور' : 'Rounded') : 
                     r === 'sharp' ? (isRTL ? 'حاد' : 'Sharp') : 
                     (isRTL ? 'دائري' : 'Pill')}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نظام الألوان' : 'Color Scheme'}</Label>
              <div className="flex gap-2">
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    onClick={() => setColorScheme(scheme.id as typeof colorScheme)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all",
                      colorScheme === scheme.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full", scheme.color)} />
                    <span className="text-[10px]">{isRTL ? scheme.labelAr : scheme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div className="text-xs font-semibold mb-2">
                {isRTL ? 'معاينة' : 'Preview'}
              </div>
              <div className={cn(
                "grid gap-2",
                layout === 'list' ? 'grid-cols-1' : `grid-cols-${columns}`
              )}>
                {[1, 2, 3].slice(0, layout === 'list' ? 2 : columns).map(i => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 bg-background",
                      borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'pill' ? 'rounded-2xl' : 'rounded-lg',
                      cardStyle === 'bordered' ? 'border border-border' : cardStyle === 'shadow' ? 'shadow-md' : ''
                    )}
                  >
                    <div className="aspect-square bg-muted rounded mb-1 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="h-2 bg-muted rounded w-3/4 mb-1" />
                    {showPrice && <div className="h-2 bg-primary/30 rounded w-1/2" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 p-4 bg-card border border-border rounded-2xl shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-emerald-500" />
          <div>
            <h3 className="font-semibold text-sm">
              {isRTL ? 'معالج المنتجات' : 'Product Wizard'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'إعداد متجرك الإلكتروني' : 'Set up your e-commerce store'}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isRTL ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
        </span>
      </div>
      
      {/* Step Content */}
      {renderStep()}
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
            className="text-xs"
          >
            {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </Button>
          
          {step === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSkipWizard}
              className="text-xs border-dashed"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {isRTL ? 'دع الذكاء يتولى' : 'Let AI Handle It'}
            </Button>
          )}
        </div>
        
        {step < totalSteps ? (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {isRTL ? 'إنشاء المتجر' : 'Generate Store'}
          </Button>
        )}
      </div>
    </div>
  );
}
