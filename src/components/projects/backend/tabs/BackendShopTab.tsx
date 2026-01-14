import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Package, Tag, Percent, Settings, Plus, Search, Filter, 
  Download, Trash2, Edit, Check, X, AlertCircle, Eye, Image as ImageIcon,
  ChevronDown, MoreHorizontal, RefreshCw, TrendingUp, DollarSign, Archive,
  Upload, Copy, ExternalLink, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BackendShopTabProps {
  orders: any[];
  inventory: any[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

type ShopInnerTab = 'orders' | 'inventory' | 'categories' | 'discounts' | 'settings';

const INNER_TABS: { id: ShopInnerTab; icon: any; label: string; labelAr: string }[] = [
  { id: 'orders', icon: ShoppingCart, label: 'Orders', labelAr: 'الطلبات' },
  { id: 'inventory', icon: Package, label: 'Inventory', labelAr: 'المخزون' },
  { id: 'categories', icon: Tag, label: 'Categories', labelAr: 'الفئات' },
  { id: 'discounts', icon: Percent, label: 'Discounts', labelAr: 'الخصومات' },
  { id: 'settings', icon: Settings, label: 'Settings', labelAr: 'الإعدادات' },
];

interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  stock_quantity: number;
  track_inventory: boolean;
  category: string;
  image_url?: string;
  sku: string;
  status: 'active' | 'draft' | 'archived';
  variants?: { name: string; options: string[] }[];
}

interface Category {
  id?: string;
  name: string;
  description?: string;
  image_url?: string;
}

interface Discount {
  id?: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase?: number;
  usage_limit?: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
}

interface ShopSettings {
  currency: string;
  tax_rate: number;
  enable_tax: boolean;
  shipping_enabled: boolean;
  free_shipping_threshold?: number;
}

export function BackendShopTab({ orders, inventory, projectId, isRTL, onRefresh }: BackendShopTabProps) {
  const [activeInnerTab, setActiveInnerTab] = useState<ShopInnerTab>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  
  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [settings, setSettings] = useState<ShopSettings>({
    currency: 'QAR',
    tax_rate: 0,
    enable_tax: false,
    shipping_enabled: true,
    free_shipping_threshold: 200
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stats
  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const lowStockItems = inventory.filter(i => (i.data?.stock_quantity || 0) < 10).length;

  useEffect(() => {
    fetchCategories();
    fetchDiscounts();
    fetchSettings();
  }, [projectId]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('project_collections')
      .select('*')
      .eq('project_id', projectId)
      .eq('collection_name', 'categories');
    setCategories((data || []).map(d => ({ id: d.id, ...(d.data as Record<string, any> || {}) })) as Category[]);
  };

  const fetchDiscounts = async () => {
    const { data } = await supabase
      .from('project_collections')
      .select('*')
      .eq('project_id', projectId)
      .eq('collection_name', 'discounts');
    setDiscounts((data || []).map(d => ({ id: d.id, ...(d.data as Record<string, any> || {}) })) as Discount[]);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('project_collections')
      .select('*')
      .eq('project_id', projectId)
      .eq('collection_name', 'shop_settings')
      .single();
    if (data?.data) setSettings(data.data as unknown as ShopSettings);
  };

  const t = (en: string, ar: string) => isRTL ? ar : en;

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyer_info?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered products
  const products: Product[] = inventory.map(i => ({ id: i.id, ...i.data }));
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === '' || 
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('project_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      toast.success(t('Order status updated', 'تم تحديث حالة الطلب'));
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to update order', 'فشل تحديث الطلب'));
    }
  };

  const handleSaveProduct = async (product: Product) => {
    setSaving(true);
    try {
      const productData = { ...product };
      delete productData.id;
      
      // Store products in project_collections instead of project_inventory
      if (editingProduct?.id) {
        const { error } = await supabase
          .from('project_collections')
          .update({ data: JSON.parse(JSON.stringify(productData)) })
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success(t('Product updated', 'تم تحديث المنتج'));
      } else {
        const user = await supabase.auth.getUser();
        const { error } = await supabase
          .from('project_collections')
          .insert([{
            project_id: projectId,
            user_id: user.data.user?.id || '',
            collection_name: 'products',
            data: JSON.parse(JSON.stringify(productData))
          }]);
        if (error) throw error;
        toast.success(t('Product added', 'تمت إضافة المنتج'));
      }
      setShowAddProduct(false);
      setEditingProduct(null);
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to save product', 'فشل حفظ المنتج'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('project_collections')
        .delete()
        .eq('id', productId);
      if (error) throw error;
      toast.success(t('Product deleted', 'تم حذف المنتج'));
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to delete product', 'فشل حذف المنتج'));
    }
  };

  const handleSaveCategory = async (category: Category) => {
    setSaving(true);
    try {
      if (category.id) {
        const { error } = await supabase
          .from('project_collections')
          .update({ data: JSON.parse(JSON.stringify(category)) })
          .eq('id', category.id);
        if (error) throw error;
      } else {
        const user = await supabase.auth.getUser();
        const { error } = await supabase
          .from('project_collections')
          .insert([{
            project_id: projectId,
            user_id: user.data.user?.id || '',
            collection_name: 'categories',
            data: JSON.parse(JSON.stringify(category))
          }]);
        if (error) throw error;
      }
      toast.success(t('Category saved', 'تم حفظ الفئة'));
      setShowAddCategory(false);
      fetchCategories();
    } catch (err) {
      toast.error(t('Failed to save category', 'فشل حفظ الفئة'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDiscount = async (discount: Discount) => {
    setSaving(true);
    try {
      if (discount.id) {
        const { error } = await supabase
          .from('project_collections')
          .update({ data: JSON.parse(JSON.stringify(discount)) })
          .eq('id', discount.id);
        if (error) throw error;
      } else {
        const user = await supabase.auth.getUser();
        const { error } = await supabase
          .from('project_collections')
          .insert([{
            project_id: projectId,
            user_id: user.data.user?.id || '',
            collection_name: 'discounts',
            data: JSON.parse(JSON.stringify({ ...discount, used_count: 0 }))
          }]);
        if (error) throw error;
      }
      toast.success(t('Discount saved', 'تم حفظ الخصم'));
      setShowAddDiscount(false);
      fetchDiscounts();
    } catch (err) {
      toast.error(t('Failed to save discount', 'فشل حفظ الخصم'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('project_collections')
        .select('id')
        .eq('project_id', projectId)
        .eq('collection_name', 'shop_settings')
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('project_collections')
          .update({ data: JSON.parse(JSON.stringify(settings)) })
          .eq('id', existing.id);
      } else {
        const user = await supabase.auth.getUser();
        await supabase
          .from('project_collections')
          .insert([{
            project_id: projectId,
            user_id: user.data.user?.id || '',
            collection_name: 'shop_settings',
            data: JSON.parse(JSON.stringify(settings))
          }]);
      }
      toast.success(t('Settings saved', 'تم حفظ الإعدادات'));
    } catch (err) {
      toast.error(t('Failed to save settings', 'فشل حفظ الإعدادات'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-pink-500" />
          {t('Shop Management', 'إدارة المتجر')}
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{t('Revenue', 'الإيرادات')}</span>
          </div>
          <p className="text-lg font-bold text-emerald-500">{settings.currency} {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">{t('Pending', 'قيد الانتظار')}</span>
          </div>
          <p className="text-lg font-bold text-amber-500">{pendingOrders}</p>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">{t('Low Stock', 'مخزون منخفض')}</span>
          </div>
          <p className="text-lg font-bold text-red-500">{lowStockItems}</p>
        </div>
      </div>

      {/* Inner Tab Navigation */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
        {INNER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveInnerTab(tab.id); setSearchQuery(''); setStatusFilter('all'); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeInnerTab === tab.id 
                ? "bg-pink-500 text-white shadow-lg" 
                : "text-muted-foreground hover:bg-white/10"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {isRTL ? tab.labelAr : tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeInnerTab === 'orders' && (
          <OrdersTab 
            orders={filteredOrders}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onUpdateStatus={handleUpdateOrderStatus}
            onViewOrder={setEditingOrder}
            isRTL={isRTL}
            currency={settings.currency}
          />
        )}
        
        {activeInnerTab === 'inventory' && (
          <InventoryTab 
            products={filteredProducts}
            categories={categories}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onAddProduct={() => { setEditingProduct(null); setShowAddProduct(true); }}
            onEditProduct={(p) => { setEditingProduct(p); setShowAddProduct(true); }}
            onDeleteProduct={handleDeleteProduct}
            isRTL={isRTL}
            currency={settings.currency}
          />
        )}
        
        {activeInnerTab === 'categories' && (
          <CategoriesTab 
            categories={categories}
            onAddCategory={() => setShowAddCategory(true)}
            onDeleteCategory={async (id) => {
              await supabase.from('project_collections').delete().eq('id', id);
              fetchCategories();
              toast.success(t('Category deleted', 'تم حذف الفئة'));
            }}
            isRTL={isRTL}
          />
        )}
        
        {activeInnerTab === 'discounts' && (
          <DiscountsTab 
            discounts={discounts}
            onAddDiscount={() => setShowAddDiscount(true)}
            onToggleDiscount={async (id, active) => {
              const discount = discounts.find(d => d.id === id);
              if (discount) {
                await handleSaveDiscount({ ...discount, is_active: active });
              }
            }}
            onDeleteDiscount={async (id) => {
              await supabase.from('project_collections').delete().eq('id', id);
              fetchDiscounts();
              toast.success(t('Discount deleted', 'تم حذف الخصم'));
            }}
            isRTL={isRTL}
            currency={settings.currency}
          />
        )}
        
        {activeInnerTab === 'settings' && (
          <SettingsTab 
            settings={settings}
            setSettings={setSettings}
            onSave={handleSaveSettings}
            saving={saving}
            isRTL={isRTL}
          />
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <ProductModal 
        open={showAddProduct}
        onClose={() => { setShowAddProduct(false); setEditingProduct(null); }}
        product={editingProduct}
        categories={categories}
        onSave={handleSaveProduct}
        saving={saving}
        isRTL={isRTL}
        projectId={projectId}
      />

      {/* Add Category Modal */}
      <CategoryModal 
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleSaveCategory}
        saving={saving}
        isRTL={isRTL}
      />

      {/* Add Discount Modal */}
      <DiscountModal 
        open={showAddDiscount}
        onClose={() => setShowAddDiscount(false)}
        onSave={handleSaveDiscount}
        saving={saving}
        isRTL={isRTL}
        currency={settings.currency}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal 
        open={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onUpdateStatus={handleUpdateOrderStatus}
        isRTL={isRTL}
        currency={settings.currency}
      />
    </div>
  );
}

// ========== Orders Tab ==========
function OrdersTab({ orders, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onUpdateStatus, onViewOrder, isRTL, currency }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('Search orders...', 'بحث في الطلبات...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All', 'الكل')}</SelectItem>
            <SelectItem value="pending">{t('Pending', 'قيد الانتظار')}</SelectItem>
            <SelectItem value="processing">{t('Processing', 'قيد المعالجة')}</SelectItem>
            <SelectItem value="completed">{t('Completed', 'مكتمل')}</SelectItem>
            <SelectItem value="cancelled">{t('Cancelled', 'ملغي')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-pink-500/10 mb-4">
            <ShoppingCart className="h-10 w-10 text-pink-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Orders Yet', 'لا توجد طلبات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('When customers make purchases, orders will appear here', 'عندما يقوم العملاء بالشراء، ستظهر الطلبات هنا')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <div 
              key={order.id} 
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => onViewOrder(order)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">#{order.order_number}</span>
                  <Badge variant={
                    order.status === 'completed' ? 'default' :
                    order.status === 'pending' ? 'secondary' :
                    order.status === 'processing' ? 'outline' : 'destructive'
                  } className={cn(
                    "text-xs",
                    order.status === 'completed' && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
                    order.status === 'pending' && "bg-amber-500/20 text-amber-500 border-amber-500/30",
                    order.status === 'processing' && "bg-blue-500/20 text-blue-500 border-blue-500/30"
                  )}>
                    {order.status}
                  </Badge>
                </div>
                <span className="font-bold text-foreground">{currency} {order.total_amount?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{order.buyer_info?.name || t('Guest Customer', 'عميل ضيف')}</span>
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Inventory Tab ==========
function InventoryTab({ products, categories, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onAddProduct, onEditProduct, onDeleteProduct, isRTL, currency }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('Search products...', 'بحث في المنتجات...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Button onClick={onAddProduct} className="bg-pink-500 hover:bg-pink-600 text-white gap-1">
          <Plus className="h-4 w-4" />
          {t('Add', 'إضافة')}
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-pink-500/10 mb-4">
            <Package className="h-10 w-10 text-pink-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Products Yet', 'لا توجد منتجات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">
            {t('Add your first product to start selling', 'أضف منتجك الأول للبدء في البيع')}
          </p>
          <Button onClick={onAddProduct} className="bg-pink-500 hover:bg-pink-600 text-white gap-2">
            <Plus className="h-4 w-4" />
            {t('Add Product', 'إضافة منتج')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product: Product) => (
            <div 
              key={product.id} 
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Product Image */}
                <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground truncate">{product.name}</h4>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      product.status === 'active' && "border-emerald-500/30 text-emerald-500",
                      product.status === 'draft' && "border-amber-500/30 text-amber-500",
                      product.status === 'archived' && "border-muted-foreground/30"
                    )}>
                      {product.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{currency} {product.price?.toFixed(2)}</span>
                    <span>•</span>
                    <span className={cn(
                      product.stock_quantity < 10 && "text-amber-500",
                      product.stock_quantity === 0 && "text-red-500"
                    )}>
                      {product.stock_quantity} {t('in stock', 'في المخزون')}
                    </span>
                    {product.sku && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-xs">{product.sku}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditProduct(product)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('Edit', 'تعديل')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(product.sku || '')}>
                      <Copy className="h-4 w-4 mr-2" />
                      {t('Copy SKU', 'نسخ SKU')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDeleteProduct(product.id)}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Categories Tab ==========
function CategoriesTab({ categories, onAddCategory, onDeleteCategory, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAddCategory} className="bg-pink-500 hover:bg-pink-600 text-white gap-1">
          <Plus className="h-4 w-4" />
          {t('Add Category', 'إضافة فئة')}
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-pink-500/10 mb-4">
            <Tag className="h-10 w-10 text-pink-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Categories', 'لا توجد فئات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('Create categories to organize your products', 'أنشئ فئات لتنظيم منتجاتك')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat: Category) => (
            <div key={cat.id} className="p-4 rounded-xl bg-white/5 border border-white/10 group relative">
              <h4 className="font-medium text-foreground">{cat.name}</h4>
              {cat.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDeleteCategory(cat.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Discounts Tab ==========
function DiscountsTab({ discounts, onAddDiscount, onToggleDiscount, onDeleteDiscount, isRTL, currency }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAddDiscount} className="bg-pink-500 hover:bg-pink-600 text-white gap-1">
          <Plus className="h-4 w-4" />
          {t('Create Discount', 'إنشاء خصم')}
        </Button>
      </div>

      {discounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-pink-500/10 mb-4">
            <Percent className="h-10 w-10 text-pink-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Discounts', 'لا توجد خصومات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('Create discount codes to offer special prices', 'أنشئ أكواد خصم لتقديم أسعار خاصة')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.map((discount: Discount) => (
            <div key={discount.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/20">
                    <Percent className="h-4 w-4 text-pink-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{discount.code}</span>
                      <Badge variant="outline" className={discount.is_active ? "border-emerald-500/30 text-emerald-500" : ""}>
                        {discount.type === 'percentage' ? `${discount.value}%` : `${currency} ${discount.value}`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('Used', 'مستخدم')}: {discount.used_count || 0}
                      {discount.usage_limit && ` / ${discount.usage_limit}`}
                      {discount.expires_at && ` • ${t('Expires', 'ينتهي')}: ${new Date(discount.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={discount.is_active}
                    onCheckedChange={(checked) => onToggleDiscount(discount.id, checked)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDeleteDiscount(discount.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Settings Tab ==========
function SettingsTab({ settings, setSettings, onSave, saving, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">{t('Currency & Pricing', 'العملة والتسعير')}</h4>
        <div className="space-y-3">
          <div>
            <Label>{t('Currency', 'العملة')}</Label>
            <Select value={settings.currency} onValueChange={(v) => setSettings({ ...settings, currency: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QAR">QAR - Qatari Riyal</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                <SelectItem value="AED">AED - UAE Dirham</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div>
              <p className="font-medium">{t('Enable Tax', 'تفعيل الضريبة')}</p>
              <p className="text-xs text-muted-foreground">{t('Apply tax to orders', 'تطبيق الضريبة على الطلبات')}</p>
            </div>
            <Switch 
              checked={settings.enable_tax}
              onCheckedChange={(checked) => setSettings({ ...settings, enable_tax: checked })}
            />
          </div>
          
          {settings.enable_tax && (
            <div>
              <Label>{t('Tax Rate (%)', 'نسبة الضريبة (%)')}</Label>
              <Input 
                type="number"
                value={settings.tax_rate}
                onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 mt-1"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">{t('Shipping', 'الشحن')}</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div>
              <p className="font-medium">{t('Enable Shipping', 'تفعيل الشحن')}</p>
              <p className="text-xs text-muted-foreground">{t('Offer shipping options', 'عرض خيارات الشحن')}</p>
            </div>
            <Switch 
              checked={settings.shipping_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, shipping_enabled: checked })}
            />
          </div>
          
          {settings.shipping_enabled && (
            <div>
              <Label>{t('Free Shipping Threshold', 'حد الشحن المجاني')}</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{settings.currency}</span>
                <Input 
                  type="number"
                  value={settings.free_shipping_threshold || ''}
                  onChange={(e) => setSettings({ ...settings, free_shipping_threshold: parseFloat(e.target.value) || undefined })}
                  className="bg-white/5 border-white/10 pl-12"
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Button onClick={onSave} disabled={saving} className="w-full bg-pink-500 hover:bg-pink-600 text-white">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('Save Settings', 'حفظ الإعدادات')}
      </Button>
    </div>
  );
}

// ========== Product Modal ==========
function ProductModal({ open, onClose, product, categories, onSave, saving, isRTL, projectId }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  const [form, setForm] = useState<Product>({
    name: '',
    description: '',
    price: 0,
    compare_at_price: undefined,
    currency: 'QAR',
    stock_quantity: 0,
    track_inventory: true,
    category: '',
    image_url: '',
    sku: '',
    status: 'active',
    variants: []
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm(product);
    } else {
      setForm({
        name: '',
        description: '',
        price: 0,
        compare_at_price: undefined,
        currency: 'QAR',
        stock_quantity: 0,
        track_inventory: true,
        category: '',
        image_url: '',
        sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
        status: 'active',
        variants: []
      });
    }
  }, [product, open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `products/${projectId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('project-uploads')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('project-uploads').getPublicUrl(filePath);
      setForm({ ...form, image_url: data.publicUrl });
    } catch (err) {
      toast.error(t('Failed to upload image', 'فشل رفع الصورة'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? t('Edit Product', 'تعديل المنتج') : t('Add Product', 'إضافة منتج')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Product Image */}
          <div>
            <Label>{t('Product Image', 'صورة المنتج')}</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
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
                <p className="text-xs text-muted-foreground mt-1">
                  {t('PNG, JPG up to 5MB', 'PNG, JPG حتى 5 ميغابايت')}
                </p>
              </div>
            </div>
          </div>
          
          {/* Name */}
          <div>
            <Label>{t('Product Name', 'اسم المنتج')} *</Label>
            <Input 
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('e.g. iPhone 15 Pro', 'مثال: آيفون 15 برو')}
              className="mt-1"
            />
          </div>
          
          {/* Description */}
          <div>
            <Label>{t('Description', 'الوصف')}</Label>
            <Textarea 
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('Describe your product...', 'صف منتجك...')}
              className="mt-1 min-h-[80px]"
            />
          </div>
          
          {/* Price Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Price', 'السعر')} *</Label>
              <Input 
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('Compare at Price', 'السعر قبل الخصم')}</Label>
              <Input 
                type="number"
                value={form.compare_at_price || ''}
                onChange={(e) => setForm({ ...form, compare_at_price: parseFloat(e.target.value) || undefined })}
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>
          
          {/* Stock & SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Stock Quantity', 'الكمية')}</Label>
              <Input 
                type="number"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('SKU', 'رمز المنتج')}</Label>
              <Input 
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          
          {/* Category */}
          <div>
            <Label>{t('Category', 'الفئة')}</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t('Select category', 'اختر فئة')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: Category) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Status */}
          <div>
            <Label>{t('Status', 'الحالة')}</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
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
        
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button 
            onClick={() => onSave(form)}
            disabled={saving || !form.name}
            className="bg-pink-500 hover:bg-pink-600 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {product ? t('Save Changes', 'حفظ التغييرات') : t('Add Product', 'إضافة المنتج')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Category Modal ==========
function CategoryModal({ open, onClose, onSave, saving, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  const [form, setForm] = useState<Category>({ name: '', description: '' });

  useEffect(() => {
    if (open) setForm({ name: '', description: '' });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Add Category', 'إضافة فئة')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('Category Name', 'اسم الفئة')} *</Label>
            <Input 
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('e.g. Electronics', 'مثال: إلكترونيات')}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t('Description', 'الوصف')}</Label>
            <Textarea 
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button 
            onClick={() => onSave(form)}
            disabled={saving || !form.name}
            className="bg-pink-500 hover:bg-pink-600 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Add Category', 'إضافة الفئة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Discount Modal ==========
function DiscountModal({ open, onClose, onSave, saving, isRTL, currency }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  const [form, setForm] = useState<Discount>({
    code: '',
    type: 'percentage',
    value: 10,
    usage_limit: undefined,
    expires_at: undefined,
    is_active: true,
    used_count: 0
  });

  useEffect(() => {
    if (open) {
      setForm({
        code: `SAVE${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        type: 'percentage',
        value: 10,
        usage_limit: undefined,
        expires_at: undefined,
        is_active: true,
        used_count: 0
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Create Discount', 'إنشاء خصم')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('Discount Code', 'كود الخصم')} *</Label>
            <Input 
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="mt-1 font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Type', 'النوع')}</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('Percentage', 'نسبة مئوية')}</SelectItem>
                  <SelectItem value="fixed">{t('Fixed Amount', 'مبلغ ثابت')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.type === 'percentage' ? t('Discount %', 'نسبة الخصم') : t(`Amount (${currency})`, `المبلغ (${currency})`)}</Label>
              <Input 
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Usage Limit', 'حد الاستخدام')}</Label>
              <Input 
                type="number"
                value={form.usage_limit || ''}
                onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || undefined })}
                placeholder={t('Unlimited', 'غير محدود')}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('Expires On', 'تاريخ الانتهاء')}</Label>
              <Input 
                type="date"
                value={form.expires_at || ''}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value || undefined })}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button 
            onClick={() => onSave(form)}
            disabled={saving || !form.code}
            className="bg-pink-500 hover:bg-pink-600 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Create Discount', 'إنشاء الخصم')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Order Details Modal ==========
function OrderDetailsModal({ open, onClose, order, onUpdateStatus, isRTL, currency }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  if (!order) return null;
  
  const items = order.items || [];
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.order_number}</span>
            <Badge variant={
              order.status === 'completed' ? 'default' :
              order.status === 'pending' ? 'secondary' : 'destructive'
            } className={cn(
              order.status === 'completed' && "bg-emerald-500/20 text-emerald-500",
              order.status === 'pending' && "bg-amber-500/20 text-amber-500"
            )}>
              {order.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="p-3 rounded-lg bg-white/5">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('Customer', 'العميل')}</h4>
            <p className="font-medium">{order.buyer_info?.name || t('Guest', 'ضيف')}</p>
            {order.buyer_info?.email && <p className="text-sm text-muted-foreground">{order.buyer_info.email}</p>}
            {order.buyer_info?.phone && <p className="text-sm text-muted-foreground">{order.buyer_info.phone}</p>}
          </div>
          
          {/* Items */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('Items', 'المنتجات')}</h4>
            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{t('Qty', 'الكمية')}: {item.quantity}</p>
                  </div>
                  <span className="font-medium">{currency} {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
            <span className="font-medium">{t('Total', 'الإجمالي')}</span>
            <span className="text-xl font-bold text-pink-500">{currency} {order.total_amount?.toFixed(2)}</span>
          </div>
          
          {/* Status Actions */}
          <div className="space-y-2">
            <Label>{t('Update Status', 'تحديث الحالة')}</Label>
            <div className="flex gap-2">
              {['pending', 'processing', 'completed', 'cancelled'].map(status => (
                <Button
                  key={status}
                  variant={order.status === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { onUpdateStatus(order.id, status); onClose(); }}
                  className={cn(
                    order.status === status && status === 'completed' && 'bg-emerald-500 hover:bg-emerald-600',
                    order.status === status && status === 'pending' && 'bg-amber-500 hover:bg-amber-600',
                    order.status === status && status === 'cancelled' && 'bg-red-500 hover:bg-red-600'
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
