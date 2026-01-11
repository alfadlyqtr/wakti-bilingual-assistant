import React, { useState, useEffect } from 'react';
import { Server, Upload, Mail, Database, Users, Loader2, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { BackendEmptyState } from './BackendEmptyState';
import { BackendUploadsTab } from './tabs/BackendUploadsTab';
import { BackendInboxTab } from './tabs/BackendInboxTab';
import { BackendDataTab } from './tabs/BackendDataTab';
import { BackendUsersTab } from './tabs/BackendUsersTab';

interface BackendDashboardProps {
  projectId: string;
  isRTL: boolean;
}

interface BackendStatus {
  enabled: boolean;
  enabled_at: string | null;
  features: Record<string, any>;
  allowed_origins: string[];
}

export function BackendDashboard({ projectId, isRTL }: BackendDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [activeTab, setActiveTab] = useState('uploads');
  
  // Data states
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [collections, setCollections] = useState<Record<string, any[]>>({});
  const [collectionSchemas, setCollectionSchemas] = useState<Record<string, any>>({});
  const [uploads, setUploads] = useState<any[]>([]);
  const [siteUsers, setSiteUsers] = useState<any[]>([]);

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

  return (
    <div className={cn("h-full flex flex-col", isRTL && "rtl")}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-4 border-b border-border/50 shrink-0",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 via-accent/15 to-secondary/20 shadow-sm">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h2 className="text-lg font-bold text-foreground">
              {isRTL ? 'لوحة السيرفر' : 'Backend Dashboard'}
            </h2>
            <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {isRTL ? 'السيرفر نشط' : 'Server Active'}
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                {isRTL ? 'جاهز للاستخدام' : 'Ready to use'}
              </span>
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => fetchAllData()}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {!refreshing && (isRTL ? 'تحديث' : 'Refresh')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start px-4 py-2 h-auto bg-transparent border-b border-border/30 rounded-none shrink-0">
          <TabsTrigger 
            value="uploads" 
            className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl px-4 py-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'الملفات' : 'Uploads'}</span>
            {uploads.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-muted/50">{uploads.length}</span>
            )}
          </TabsTrigger>
          
          <TabsTrigger 
            value="inbox" 
            className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl px-4 py-2"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'الرسائل' : 'Inbox'}</span>
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-primary text-primary-foreground">{unreadCount}</span>
            )}
          </TabsTrigger>
          
          <TabsTrigger 
            value="data" 
            className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl px-4 py-2"
          >
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'البيانات' : 'Data'}</span>
            {collectionsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-muted/50">{collectionsCount}</span>
            )}
          </TabsTrigger>
          
          <TabsTrigger 
            value="users" 
            className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl px-4 py-2"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'المستخدمون' : 'Users'}</span>
            {siteUsers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-muted/50">{siteUsers.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="uploads" className="mt-0 h-full">
            <BackendUploadsTab 
              uploads={uploads}
              projectId={projectId}
              isRTL={isRTL}
              onRefresh={fetchAllData}
            />
          </TabsContent>
          
          <TabsContent value="inbox" className="mt-0 h-full">
            <BackendInboxTab 
              submissions={submissions}
              isRTL={isRTL}
              onDelete={handleDeleteSubmission}
              onMarkRead={handleMarkRead}
            />
          </TabsContent>
          
          <TabsContent value="data" className="mt-0 h-full">
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
          </TabsContent>
          
          <TabsContent value="users" className="mt-0 h-full">
            <BackendUsersTab 
              users={siteUsers}
              isRTL={isRTL}
              onSuspend={handleSuspendUser}
              onActivate={handleActivateUser}
              onDelete={handleDeleteUser}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
