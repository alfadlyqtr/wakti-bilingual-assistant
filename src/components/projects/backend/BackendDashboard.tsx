import React, { useState, useEffect } from 'react';
import { 
  Server, Upload, Mail, Database, Users, Loader2, CheckCircle2, RefreshCw, Zap, ArrowLeft,
  ShoppingCart, Calendar, MessageCircle, MessageSquare, Shield, Package, Bell, Settings,
  TrendingUp, Clock, FileText, CreditCard, Star, ChevronRight, MoreHorizontal, Eye,
  Plus, Search, Filter, Download, Trash2, Edit, Check, X, AlertCircle, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { BackendEmptyState } from './BackendEmptyState';
import { BackendUploadsTab } from './tabs/BackendUploadsTab';
import { BackendInboxTab } from './tabs/BackendInboxTab';
import { BackendDataTab } from './tabs/BackendDataTab';
import { BackendUsersTab } from './tabs/BackendUsersTab';
import { BackendShopTab } from './tabs/BackendShopTab';
import { BackendBookingsTab } from './tabs/BackendBookingsTab';
import { BackendChatTab } from './tabs/BackendChatTab';
import { BackendCommentsTab } from './tabs/BackendCommentsTab';
import { BackendRolesTab } from './tabs/BackendRolesTab';

// Feature tab configuration with icons and colors
const BASE_FEATURE_TABS = [
  { id: 'uploads', icon: Upload, label: 'Media', labelAr: 'الوسائط', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-500' },
  { id: 'inbox', icon: Mail, label: 'Inbox', labelAr: 'الرسائل', color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-500' },
  { id: 'shop', icon: ShoppingCart, label: 'Shop', labelAr: 'المتجر', color: 'from-pink-500 to-rose-500', bgColor: 'bg-pink-500/10', textColor: 'text-pink-500' },
  { id: 'accounts', icon: Users, label: 'Accounts', labelAr: 'الحسابات', color: 'from-violet-500 to-purple-500', bgColor: 'bg-violet-500/10', textColor: 'text-violet-500' },
];

const ADVANCED_FEATURE_TAB = { id: 'advanced', icon: Database, label: 'Advanced', labelAr: 'متقدم', color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-500' };

const isAdvancedEnabled = () => {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('advanced') === '1';
  } catch {
    return false;
  }
};

type InboxInnerTab = 'submissions' | 'bookings' | 'reviews' | 'messages' | 'comments';

const INBOX_TABS: Array<{ id: InboxInnerTab; icon: any; label: string; labelAr: string }> = [
  { id: 'submissions', icon: Mail, label: 'Submissions', labelAr: 'الطلبات' },
  { id: 'bookings', icon: Calendar, label: 'Bookings', labelAr: 'الحجوزات' },
  { id: 'reviews', icon: Star, label: 'Reviews', labelAr: 'التقييمات' },
  { id: 'messages', icon: MessageCircle, label: 'Messages', labelAr: 'الرسائل' },
  { id: 'comments', icon: MessageSquare, label: 'Comments', labelAr: 'التعليقات' },
];

type AccountsInnerTab = 'users' | 'customers' | 'roles';

const ACCOUNTS_TABS: Array<{ id: AccountsInnerTab; icon: any; label: string; labelAr: string }> = [
  { id: 'users', icon: Users, label: 'Users', labelAr: 'المستخدمون' },
  { id: 'customers', icon: FileText, label: 'Customers', labelAr: 'العملاء' },
  { id: 'roles', icon: Shield, label: 'Roles', labelAr: 'الصلاحيات' },
];

type ShopInnerMode = 'shop' | 'advanced';

interface BackendDashboardProps {
  projectId: string;
  isRTL: boolean;
  onBack?: () => void;
  initialTab?: string;
  onTabChange?: (tabId: string) => void;
  initialShopInnerTab?: 'orders' | 'inventory' | 'categories' | 'discounts' | 'settings';
  refreshKey?: number;
}

interface BackendStatus {
  enabled: boolean;
  enabled_at: string | null;
  features: Record<string, any>;
  allowed_origins: string[];
}

export function BackendDashboard({ projectId, isRTL, onBack, initialTab, onTabChange, initialShopInnerTab, refreshKey }: BackendDashboardProps) {
  const advancedEnabled = isAdvancedEnabled();
  const FEATURE_TABS = advancedEnabled ? [...BASE_FEATURE_TABS, ADVANCED_FEATURE_TAB] : BASE_FEATURE_TABS;

  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const resolveTab = (tab?: string) => {
    if (!tab) return 'uploads';
    if (FEATURE_TABS.some(t => t.id === tab)) return tab;
    if (tab === 'bookings' || tab === 'chat' || tab === 'comments' || tab === 'reviews') return 'inbox';
    if (tab === 'users' || tab === 'customers' || tab === 'roles') return 'accounts';
    if (tab === 'data') return advancedEnabled ? 'advanced' : 'uploads';
    return 'uploads';
  };
  const [activeTab, setActiveTab] = useState(resolveTab(initialTab));
  const [inboxInnerTab, setInboxInnerTab] = useState<InboxInnerTab>(() => {
    if (initialTab === 'bookings') return 'bookings';
    if (initialTab === 'chat') return 'messages';
    if (initialTab === 'comments') return 'comments';
    if (initialTab === 'reviews') return 'reviews';
    return 'submissions';
  });
  const [accountsInnerTab, setAccountsInnerTab] = useState<AccountsInnerTab>(() => {
    if (initialTab === 'users') return 'users';
    if (initialTab === 'roles') return 'roles';
    return 'customers';
  });
  const [shopInnerMode, setShopInnerMode] = useState<ShopInnerMode>('shop');
  
  // Data states
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [collections, setCollections] = useState<Record<string, any[]>>({});
  const [collectionSchemas, setCollectionSchemas] = useState<Record<string, any>>({});
  const [uploads, setUploads] = useState<any[]>([]);
  const [siteUsers, setSiteUsers] = useState<any[]>([]);
  
  // New feature states
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showTabMenu, setShowTabMenu] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(resolveTab(initialTab));
      if (initialTab === 'bookings') setInboxInnerTab('bookings');
      if (initialTab === 'chat') setInboxInnerTab('messages');
      if (initialTab === 'comments') setInboxInnerTab('comments');
      if (initialTab === 'reviews') setInboxInnerTab('reviews');
      if (initialTab === 'users') setAccountsInnerTab('users');
      if (initialTab === 'customers') setAccountsInnerTab('customers');
      if (initialTab === 'roles') setAccountsInnerTab('roles');
    }
  }, [initialTab]);

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const fetchBackendStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('project_backends')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setBackendStatus({
          enabled: data.enabled ?? false,
          enabled_at: data.enabled_at,
          features: (data.features as Record<string, any>) ?? {},
          allowed_origins: (data.allowed_origins as string[]) ?? [],
        });
      } else {
        setBackendStatus(null);
      }
    } catch (err) {
      console.error('Error fetching backend status:', err);
    }
  };

  const fetchAllData = async () => {
    if (!backendStatus?.enabled) return;
    
    setRefreshing(true);
    try {
      // Fetch submissions
      const { data: submissionsData } = await supabase
        .from('project_form_submissions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setSubmissions(submissionsData || []);
      
      // Fetch collections
      const { data: collectionsData } = await supabase
        .from('project_collections')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      // Group by collection_name
      const grouped: Record<string, any[]> = {};
      (collectionsData || []).forEach(item => {
        if (!grouped[item.collection_name]) grouped[item.collection_name] = [];
        grouped[item.collection_name].push(item);
      });

      // Ensure key collections exist even if empty (so tabs can show empty states)
      if (!grouped['reviews']) grouped['reviews'] = [];
      if (!grouped['customer_data']) grouped['customer_data'] = [];
      if (!grouped['products']) grouped['products'] = [];
      if (!grouped['categories']) grouped['categories'] = [];
      setCollections(grouped);
      
      // Fetch collection schemas
      const { data: schemasData } = await supabase
        .from('project_collection_schemas')
        .select('*')
        .eq('project_id', projectId);
      
      const schemasMap: Record<string, any> = {};
      (schemasData || []).forEach(s => {
        schemasMap[s.collection_name] = s;
      });
      setCollectionSchemas(schemasMap);
      
      // Fetch uploads
      const { data: uploadsData } = await supabase
        .from('project_uploads')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });
      setUploads(uploadsData || []);
      
      // Fetch site users
      const { data: usersData } = await supabase
        .from('project_site_users')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setSiteUsers(usersData || []);
      
      // Fetch orders
      const { data: ordersData } = await supabase
        .from('project_orders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setOrders(ordersData || []);
      
      // Fetch inventory
      const { data: inventoryData } = await supabase
        .from('project_inventory')
        .select('*')
        .eq('project_id', projectId);
      setInventory(inventoryData || []);
      
      // Fetch bookings
      const { data: bookingsData } = await supabase
        .from('project_bookings')
        .select('*')
        .eq('project_id', projectId)
        .order('booking_date', { ascending: true });
      setBookings(bookingsData || []);
      
      // Fetch chat rooms
      const { data: chatRoomsData } = await supabase
        .from('project_chat_rooms')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });
      setChatRooms(chatRoomsData || []);
      
      // Fetch comments
      const { data: commentsData } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setComments(commentsData || []);
      
    } catch (err) {
      console.error('Error fetching backend data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchBackendStatus();
      setLoading(false);
    };
    init();
  }, [projectId]);

  useEffect(() => {
    if (backendStatus?.enabled) {
      fetchAllData();
    }
  }, [backendStatus?.enabled]);

  useEffect(() => {
    if (backendStatus?.enabled && refreshKey !== undefined) {
      fetchAllData();
    }
  }, [refreshKey, backendStatus?.enabled]);

  const enableBackend = async () => {
    setEnabling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('project_backends')
        .upsert({
          project_id: projectId,
          user_id: user.id,
          enabled: true,
          enabled_at: new Date().toISOString(),
          features: {},
          allowed_origins: [],
        }, { onConflict: 'project_id' });
      
      if (error) throw error;
      
      await fetchBackendStatus();
      toast.success(isRTL ? 'تم تفعيل السيرفر!' : 'Backend enabled!');
    } catch (err: any) {
      console.error('Error enabling backend:', err);
      toast.error(err.message || (isRTL ? 'فشل في التفعيل' : 'Failed to enable'));
    } finally {
      setEnabling(false);
    }
  };

  // Handlers for submissions
  const handleDeleteSubmission = async (id: string) => {
    const { error } = await supabase
      .from('project_form_submissions')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    }
  };

  const handleMarkRead = async (id: string) => {
    const { error } = await supabase
      .from('project_form_submissions')
      .update({ status: 'read' })
      .eq('id', id);
    
    if (!error) {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'read' } : s));
    }
  };

  // Collection handlers
  const handleAddItem = async (collectionName: string, data: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('project_collections')
      .insert({
        project_id: projectId,
        user_id: user.id,
        collection_name: collectionName,
        data,
      });
    
    if (!error) {
      toast.success(isRTL ? 'تمت الإضافة' : 'Added');
      fetchAllData();
    }
  };

  const handleEditItem = async (item: any, data: Record<string, any>) => {
    const { error } = await supabase
      .from('project_collections')
      .update({ data, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    
    if (!error) {
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      fetchAllData();
    }
  };

  const handleDeleteItem = async (id: string, collectionName: string) => {
    const { error } = await supabase
      .from('project_collections')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setCollections(prev => ({
        ...prev,
        [collectionName]: prev[collectionName]?.filter(i => i.id !== id) || []
      }));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    }
  };

  const handleExport = (collectionName: string, items: any[], format: 'csv' | 'json') => {
    const data = items.map(i => i.data);
    let content: string;
    let filename: string;
    let type: string;
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = `${collectionName}.json`;
      type = 'application/json';
    } else {
      const headers = Object.keys(data[0] || {});
      const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
      content = [headers.join(','), ...rows].join('\n');
      filename = `${collectionName}.csv`;
      type = 'text/csv';
    }
    
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Site user handlers
  const handleSuspendUser = async (id: string) => {
    const { error } = await supabase
      .from('project_site_users')
      .update({ status: 'suspended' })
      .eq('id', id);
    
    if (!error) {
      setSiteUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'suspended' } : u));
      toast.success(isRTL ? 'تم الإيقاف' : 'Suspended');
    }
  };

  const handleActivateUser = async (id: string) => {
    const { error } = await supabase
      .from('project_site_users')
      .update({ status: 'active' })
      .eq('id', id);
    
    if (!error) {
      setSiteUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
      toast.success(isRTL ? 'تم التفعيل' : 'Activated');
    }
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase
      .from('project_site_users')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setSiteUsers(prev => prev.filter(u => u.id !== id));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
        </div>
      </div>
    );
  }

  if (!backendStatus?.enabled) {
    return <BackendEmptyState isRTL={isRTL} onEnable={enableBackend} isEnabling={enabling} />;
  }

  const unreadCount = submissions.filter(s => s.status === 'unread').length;
  const collectionsCount = Object.keys(collections).reduce((sum, key) => sum + collections[key].length, 0);
  const pendingBookingsCount = bookings.filter(b => b.status === 'pending').length;
  const reviewsCount = (collections['reviews'] || []).length;
  const inboxBadgeCount = unreadCount + pendingBookingsCount + reviewsCount + chatRooms.length + comments.length;
  const customersCount = (collections['customer_data'] || []).length;
  const rolesCount = siteUsers.filter(u => u.role && u.role !== 'customer').length;
  const accountsBadgeCount = siteUsers.length + customersCount + rolesCount;

  // Get badge count for each tab
  const getBadgeCount = (tabId: string) => {
    switch (tabId) {
      case 'uploads': return uploads.length;
      case 'inbox': return inboxBadgeCount;
      case 'shop': return orders.length;
      case 'accounts': return accountsBadgeCount;
      case 'advanced': return collectionsCount;
      default: return 0;
    }
  };

  // Get current tab config
  const currentTab = FEATURE_TABS.find(t => t.id === activeTab) || FEATURE_TABS[0];

  return (
    <div className={cn("h-full flex flex-col bg-background dark:bg-[#0c0f14]", isRTL && "rtl")}>
      {/* Premium Header - Mobile Optimized */}
      <div className="shrink-0 bg-gradient-to-r from-background via-background to-background dark:from-[#0c0f14] dark:via-[#0f1318] dark:to-[#0c0f14] border-b border-border/30 dark:border-white/5">
        {/* Top Bar */}
        <div className={cn(
          "flex items-center justify-between px-3 py-3 md:px-4 md:py-4",
          isRTL && "flex-row-reverse"
        )}>
          <div className={cn("flex items-center gap-2 md:gap-3", isRTL && "flex-row-reverse")}>
            {/* Back button */}
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-95 shrink-0"
                title={isRTL ? 'رجوع' : 'Back'}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            
            {/* Server Icon with Glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-xl blur-lg" />
              <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
                <Server className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            
            {/* Title & Status */}
            <div className={isRTL ? "text-right" : "text-left"}>
              <h2 className="text-base md:text-lg font-bold text-foreground">
                {isRTL ? 'لوحة السيرفر' : 'Backend'}
              </h2>
              <div className={cn("flex items-center gap-1.5 text-[10px] md:text-xs", isRTL && "flex-row-reverse")}>
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {isRTL ? 'نشط' : 'Active'}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-amber-500 flex items-center gap-0.5">
                  <Zap className="h-3 w-3" />
                  {isRTL ? `${FEATURE_TABS.length} ميزات` : `${FEATURE_TABS.length} Features`}
                </span>
              </div>
            </div>
          </div>
          
          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 md:w-auto md:px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
            onClick={() => fetchAllData()}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden md:inline ml-2">{isRTL ? 'تحديث' : 'Refresh'}</span>
          </Button>
        </div>

        {/* Feature Selector - Dropdown on Mobile, Grid on Desktop */}
        <div className="px-3 pb-3 md:px-4">
          {/* Mobile: Current Tab Display + Dropdown */}
          <div className="md:hidden">
            <button
              onClick={() => setShowTabMenu(!showTabMenu)}
              className={cn(
                "w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all active:scale-[0.98]",
                `bg-gradient-to-r ${currentTab.color} text-white shadow-lg`
              )}
            >
              <div className="flex items-center gap-3">
                <currentTab.icon className="h-5 w-5" />
                <span className="font-semibold">{isRTL ? currentTab.labelAr : currentTab.label}</span>
                {getBadgeCount(currentTab.id) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white/25 font-bold">
                    {getBadgeCount(currentTab.id)}
                  </span>
                )}
              </div>
              <ChevronRight className={cn("h-5 w-5 transition-transform", showTabMenu && "rotate-90")} />
            </button>
            
            {/* Dropdown Menu */}
            {showTabMenu && (
              <div className="mt-2 p-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="grid grid-cols-3 gap-2">
                  {FEATURE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count = getBadgeCount(tab.id);
                    const isActive = activeTab === tab.id;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { handleTabSelect(tab.id); setShowTabMenu(false); }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95",
                          isActive
                            ? `bg-gradient-to-br ${tab.color} text-white shadow-lg`
                            : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                        )}
                      >
                        <div className="relative">
                          <Icon className="h-5 w-5" />
                          {count > 0 && (
                            <span className="absolute -top-1 -right-2 px-1 min-w-[14px] text-[9px] rounded-full bg-red-500 text-white font-bold">
                              {count > 99 ? '99+' : count}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium">{isRTL ? tab.labelAr : tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop: Grid Layout */}
          <div className="hidden md:grid md:grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1.5">
            {FEATURE_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = getBadgeCount(tab.id);
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(tab.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all active:scale-95",
                    isActive
                      ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1.5 px-1 min-w-[12px] text-[8px] rounded-full bg-red-500 text-white font-bold">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] truncate max-w-full">{isRTL ? tab.labelAr : tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Tab Content with Animation */}
        <div className="p-3 md:p-4 min-h-full">
          {activeTab === 'uploads' && (
            <BackendUploadsTab 
              uploads={uploads}
              projectId={projectId}
              isRTL={isRTL}
              onRefresh={fetchAllData}
            />
          )}
          
          {activeTab === 'inbox' && (
            <div className={cn("space-y-4", isRTL && "rtl")}>
              <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-2 flex-wrap", isRTL && "flex-row-reverse")}>
                  {INBOX_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = inboxInnerTab === tab.id;

                    const count =
                      tab.id === 'submissions' ? unreadCount :
                      tab.id === 'bookings' ? pendingBookingsCount :
                      tab.id === 'reviews' ? reviewsCount :
                      tab.id === 'messages' ? chatRooms.length :
                      comments.length;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setInboxInnerTab(tab.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{isRTL ? tab.labelAr : tab.label}</span>
                        <span className="opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {inboxInnerTab === 'submissions' && (
                <BackendInboxTab
                  submissions={submissions}
                  isRTL={isRTL}
                  onDelete={handleDeleteSubmission}
                  onMarkRead={handleMarkRead}
                />
              )}

              {inboxInnerTab === 'bookings' && (
                <BackendBookingsTab
                  bookings={bookings}
                  projectId={projectId}
                  isRTL={isRTL}
                  onRefresh={fetchAllData}
                />
              )}

              {inboxInnerTab === 'reviews' && (
                <BackendDataTab
                  collections={{ reviews: collections['reviews'] || [] }}
                  schemas={{ reviews: collectionSchemas['reviews'] }}
                  projectId={projectId}
                  isRTL={isRTL}
                  onAdd={handleAddItem}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onExport={handleExport}
                />
              )}

              {inboxInnerTab === 'messages' && (
                <BackendChatTab
                  rooms={chatRooms}
                  projectId={projectId}
                  isRTL={isRTL}
                  onRefresh={fetchAllData}
                />
              )}

              {inboxInnerTab === 'comments' && (
                <BackendCommentsTab
                  comments={comments}
                  projectId={projectId}
                  isRTL={isRTL}
                  onRefresh={fetchAllData}
                />
              )}
            </div>
          )}
          
          {activeTab === 'shop' && (
            <div className={cn("space-y-4", isRTL && "rtl")}>
              <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-2 flex-wrap", isRTL && "flex-row-reverse")}>
                  <button
                    onClick={() => setShopInnerMode('shop')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5",
                      shopInnerMode === 'shop'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span>{isRTL ? 'المتجر' : 'Shop'}</span>
                  </button>
                  <button
                    onClick={() => setShopInnerMode('advanced')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5",
                      shopInnerMode === 'advanced'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{isRTL ? 'متقدم' : 'Advanced'}</span>
                  </button>
                </div>
              </div>

              {shopInnerMode === 'shop' && (
                <BackendShopTab
                  orders={orders}
                  inventory={collections['products'] || []}
                  projectId={projectId}
                  isRTL={isRTL}
                  onRefresh={fetchAllData}
                  initialInnerTab={initialShopInnerTab}
                />
              )}

              {shopInnerMode === 'advanced' && (
                <BackendDataTab
                  collections={{
                    products: collections['products'] || [],
                    categories: collections['categories'] || [],
                  }}
                  schemas={{
                    products: collectionSchemas['products'],
                    categories: collectionSchemas['categories'],
                  }}
                  projectId={projectId}
                  isRTL={isRTL}
                  onAdd={handleAddItem}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onExport={handleExport}
                />
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className={cn("space-y-4", isRTL && "rtl")}>
              <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-2 flex-wrap", isRTL && "flex-row-reverse")}>
                  {ACCOUNTS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = accountsInnerTab === tab.id;

                    const count =
                      tab.id === 'users' ? siteUsers.length :
                      tab.id === 'customers' ? customersCount :
                      rolesCount;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setAccountsInnerTab(tab.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{isRTL ? tab.labelAr : tab.label}</span>
                        <span className="opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {accountsInnerTab === 'users' && (
                <BackendUsersTab
                  users={siteUsers}
                  isRTL={isRTL}
                  onSuspend={handleSuspendUser}
                  onActivate={handleActivateUser}
                  onDelete={handleDeleteUser}
                />
              )}

              {accountsInnerTab === 'customers' && (
                <BackendDataTab
                  collections={{ customer_data: collections['customer_data'] || [] }}
                  schemas={{ customer_data: collectionSchemas['customer_data'] }}
                  projectId={projectId}
                  isRTL={isRTL}
                  onAdd={handleAddItem}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onExport={handleExport}
                />
              )}

              {accountsInnerTab === 'roles' && (
                <BackendRolesTab
                  users={siteUsers}
                  projectId={projectId}
                  isRTL={isRTL}
                  onRefresh={fetchAllData}
                />
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <BackendDataTab
              collections={collections}
              schemas={collectionSchemas}
              projectId={projectId}
              isRTL={isRTL}
              onAdd={handleAddItem}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onExport={handleExport}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Note: Backend tab components are now imported from ./tabs/
