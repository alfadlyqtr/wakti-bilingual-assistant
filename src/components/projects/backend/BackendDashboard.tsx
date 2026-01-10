import React, { useState, useEffect } from 'react';
import { Server, Mail, Database, FileUp, Users, Loader2, CheckCircle2, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { BackendEmptyState } from './BackendEmptyState';
import { BackendSection } from './BackendSection';
import { BackendSubmissions } from './BackendSubmissions';
import { BackendCollectionView } from './BackendCollectionView';
import { BackendUploads } from './BackendUploads';
import { BackendSiteUsers } from './BackendSiteUsers';

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

  const copyApiEndpoint = () => {
    const endpoint = `${window.location.origin.replace('lovable.dev', 'supabase.co')}/functions/v1/project-backend-api`;
    navigator.clipboard.writeText(endpoint);
    toast.success(isRTL ? 'تم النسخ!' : 'Copied!');
  };

  // Handlers for submissions
  const handleViewSubmission = (submission: any) => {
    // TODO: Open modal with full submission details
    console.log('View submission:', submission);
  };

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
  const handleAddItem = (collectionName: string) => {
    // TODO: Open add modal
    console.log('Add to collection:', collectionName);
  };

  const handleEditItem = (item: any) => {
    // TODO: Open edit modal
    console.log('Edit item:', item);
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

  // Upload handlers
  const handleDownloadFile = (upload: any) => {
    // TODO: Get signed URL and download
    console.log('Download:', upload);
  };

  const handleDeleteFile = async (id: string) => {
    const { error } = await supabase
      .from('project_uploads')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setUploads(prev => prev.filter(u => u.id !== id));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    }
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!backendStatus?.enabled) {
    return <BackendEmptyState isRTL={isRTL} onEnable={enableBackend} isEnabling={enabling} />;
  }

  const unreadCount = submissions.filter(s => s.status === 'unread').length;
  const totalUploadSize = uploads.reduce((sum, u) => sum + (u.size_bytes || 0), 0);

  return (
    <div className={cn("h-full flex flex-col", isRTL && "rtl")}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border/50 dark:border-white/10 shrink-0",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20">
            <Server className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isRTL ? 'لوحة السيرفر' : 'Server Dashboard'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {isRTL ? 'نشط' : 'Active'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fetchAllData()}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Form Submissions */}
        <BackendSection
          icon={Mail}
          title={isRTL ? 'الرسائل' : 'Form Submissions'}
          count={submissions.length}
          subtitle={unreadCount > 0 ? (isRTL ? `${unreadCount} غير مقروءة` : `${unreadCount} unread`) : undefined}
          defaultOpen={submissions.length > 0}
          isRTL={isRTL}
        >
          <BackendSubmissions 
            submissions={submissions}
            isRTL={isRTL}
            onView={handleViewSubmission}
            onDelete={handleDeleteSubmission}
            onMarkRead={handleMarkRead}
          />
        </BackendSection>

        {/* Dynamic Collections */}
        {Object.entries(collections).map(([name, items]) => (
          <BackendSection
            key={name}
            icon={Database}
            title={collectionSchemas[name]?.display_name || name}
            count={items.length}
            defaultOpen={false}
            isRTL={isRTL}
          >
            <BackendCollectionView 
              collectionName={name}
              displayName={collectionSchemas[name]?.display_name}
              items={items}
              schema={collectionSchemas[name]?.schema}
              isRTL={isRTL}
              onAdd={() => handleAddItem(name)}
              onEdit={handleEditItem}
              onDelete={(id) => handleDeleteItem(id, name)}
              onExport={(format) => handleExport(name, items, format)}
            />
          </BackendSection>
        ))}

        {/* Uploads */}
        <BackendSection
          icon={FileUp}
          title={isRTL ? 'الملفات' : 'Uploads'}
          count={uploads.length}
          subtitle={`${(totalUploadSize / (1024 * 1024)).toFixed(1)} MB`}
          defaultOpen={false}
          isRTL={isRTL}
        >
          <BackendUploads 
            uploads={uploads}
            totalSize={totalUploadSize}
            isRTL={isRTL}
            onDownload={handleDownloadFile}
            onDelete={handleDeleteFile}
          />
        </BackendSection>

        {/* Site Users */}
        <BackendSection
          icon={Users}
          title={isRTL ? 'مستخدمو الموقع' : 'Site Users'}
          count={siteUsers.length}
          defaultOpen={false}
          isRTL={isRTL}
        >
          <BackendSiteUsers 
            users={siteUsers}
            isRTL={isRTL}
            onSuspend={handleSuspendUser}
            onActivate={handleActivateUser}
            onDelete={handleDeleteUser}
          />
        </BackendSection>
      </div>
    </div>
  );
}
