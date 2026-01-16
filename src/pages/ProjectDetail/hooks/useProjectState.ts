// useProjectState - Core project state management
// Part of Group A Enhancement: Performance & Code Quality

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Project, ProjectFile, BackendContext, UploadedAsset, DEFAULT_BACKEND_CONTEXT } from '../types';

interface UseProjectStateProps {
  projectId: string | undefined;
  userId: string | undefined;
  isRTL: boolean;
}

export function useProjectState({ projectId, userId, isRTL }: UseProjectStateProps) {
  const navigate = useNavigate();
  
  // Core project state
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  const [codeContent, setCodeContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Backend context
  const [backendContext, setBackendContext] = useState<BackendContext | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  
  // Track if generation already started
  const generationStartedRef = useRef(false);
  
  // Fetch project data
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    
    try {
      // Fetch project metadata
      const { data: projectData, error: projectError } = await (supabase
        .from('projects' as any)
        .select('*')
        .eq('id', projectId)
        .single() as any);
      
      if (projectError) throw projectError;
      if (!projectData) {
        toast.error(isRTL ? 'المشروع غير موجود' : 'Project not found');
        navigate('/projects');
        return;
      }
      
      setProject(projectData as Project);
      
      // Fetch project files
      const { data: filesData, error: filesError } = await (supabase
        .from('project_files' as any)
        .select('*')
        .eq('project_id', projectId) as any);
      
      if (filesError) {
        console.error('Error fetching project files:', filesError);
      } else {
        setFiles((filesData || []) as ProjectFile[]);
      }
      
      // Build files map from rows
      const mapFromRows: Record<string, string> = {};
      const filesList = (filesData || []) as ProjectFile[];
      for (const row of filesList) {
        const p = row.path?.startsWith('/') ? row.path : `/${row.path}`;
        mapFromRows[p] = row.content;
      }
      
      // Legacy support: projects used to store JSON blob in path='index.html'
      if (Object.keys(mapFromRows).length === 0) {
        const legacyIndexFile = filesList.find((f: ProjectFile) => f.path === 'index.html');
        if (legacyIndexFile?.content) {
          try {
            const parsed = JSON.parse(legacyIndexFile.content);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setGeneratedFiles(parsed);
              setCodeContent(parsed["/App.js"] || Object.values(parsed)[0] || "");
            } else {
              setCodeContent(legacyIndexFile.content);
            }
          } catch {
            setCodeContent(legacyIndexFile.content);
          }
        }
      } else {
        setGeneratedFiles(mapFromRows);
        setCodeContent(mapFromRows["/App.js"] || Object.values(mapFromRows)[0] || "");
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      toast.error(isRTL ? 'فشل في تحميل المشروع' : 'Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [projectId, isRTL, navigate]);
  
  // Save code to database
  const saveCode = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setSaving(true);
      
      const filesToSave: Record<string, string> =
        Object.keys(generatedFiles).length > 0
          ? { ...generatedFiles }
          : { "/App.js": codeContent };
      
      // Ensure /App.js reflects editor text
      filesToSave["/App.js"] = codeContent;
      
      const rows = Object.entries(filesToSave).map(([path, content]) => ({
        project_id: projectId,
        path,
        content,
      }));
      
      const { error } = await (supabase
        .from('project_files' as any)
        .upsert(rows, { onConflict: 'project_id,path' }) as any);
      
      if (error) throw error;
      
      // Refresh local rows list
      setFiles(prev => {
        const byPath = new Map<string, ProjectFile>();
        for (const f of prev) byPath.set(f.path, f);
        for (const [path, content] of Object.entries(filesToSave)) {
          const existing = byPath.get(path);
          if (existing) byPath.set(path, { ...existing, content });
          else byPath.set(path, { id: `local-${Date.now()}-${path}`, project_id: projectId, path, content });
        }
        return Array.from(byPath.values());
      });
      
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!');
    } catch (err) {
      console.error('Error saving:', err);
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [projectId, generatedFiles, codeContent, isRTL]);
  
  // Fetch uploaded assets for AI context
  const fetchUploadedAssets = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('project_uploads')
        .select('filename, storage_path, file_type')
        .eq('project_id', projectId);
      
      if (error) {
        console.error('Error fetching uploaded assets:', error);
        return;
      }
      
      if (data && data.length > 0) {
        const assets = data.map((upload: any) => {
          const { data: urlData } = supabase.storage.from('project-uploads').getPublicUrl(upload.storage_path);
          return {
            filename: upload.filename,
            url: urlData.publicUrl,
            file_type: upload.file_type
          };
        });
        setUploadedAssets(assets);
        console.log('[ProjectDetail] Loaded', assets.length, 'uploaded assets for AI context');
      }
    } catch (err) {
      console.error('Exception fetching uploaded assets:', err);
    }
  }, [projectId]);
  
  // Fetch backend context
  const fetchBackendContext = useCallback(async (): Promise<BackendContext | null> => {
    if (!projectId) return null;
    
    const defaultContext: BackendContext = {
      enabled: false,
      collections: [],
      formSubmissionsCount: 0,
      uploadsCount: 0,
      siteUsersCount: 0,
      products: [],
      productsCount: 0,
      ordersCount: 0,
      hasShopSetup: false,
      services: [],
      servicesCount: 0,
      bookingsCount: 0,
      hasBookingsSetup: false,
      chatRoomsCount: 0,
      commentsCount: 0,
    };
    
    try {
      // Check if backend is enabled
      const { data: backendData } = await supabase
        .from('project_backends')
        .select('enabled')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (!backendData?.enabled) {
        setBackendContext(defaultContext);
        return defaultContext;
      }
      
      // Fetch collections with counts
      const { data: collectionsData } = await supabase
        .from('project_collections')
        .select('collection_name, data')
        .eq('project_id', projectId);
      
      const collectionCounts: Record<string, number> = {};
      (collectionsData || []).forEach((item: any) => {
        collectionCounts[item.collection_name] = (collectionCounts[item.collection_name] || 0) + 1;
      });
      
      const collections = Object.entries(collectionCounts).map(([name, itemCount]) => ({ name, itemCount }));
      
      // Fetch counts in parallel
      const [
        { count: formSubmissionsCount },
        { count: uploadsCount },
        { count: siteUsersCount },
        { data: productsData },
        { count: inventoryCount },
        { count: ordersCount },
        { data: servicesData },
        { count: bookingsCount },
        { count: chatRoomsCount },
        { count: commentsCount }
      ] = await Promise.all([
        supabase.from('project_form_submissions').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_uploads').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_site_users').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_collections').select('data').eq('project_id', projectId).eq('collection_name', 'products').limit(10),
        supabase.from('project_inventory').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('collection_name', 'products'),
        supabase.from('project_orders').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_collections').select('data').eq('project_id', projectId).eq('collection_name', 'booking_services').limit(10),
        supabase.from('project_bookings').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_chat_rooms').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_comments').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      ]);
      
      const products = (productsData || []).map((p: any) => ({
        name: p.data?.name || p.data?.title || 'Unnamed Product',
        price: p.data?.price || 0,
        image: p.data?.image || p.data?.imageUrl,
        category: p.data?.category,
      }));
      
      const services = (servicesData || []).map((s: any) => ({
        name: s.data?.name || s.data?.title || 'Unnamed Service',
        duration: s.data?.duration || 30,
        price: s.data?.price || 0,
      }));
      
      const context: BackendContext = {
        enabled: true,
        collections,
        formSubmissionsCount: formSubmissionsCount || 0,
        uploadsCount: uploadsCount || 0,
        siteUsersCount: siteUsersCount || 0,
        products,
        productsCount: inventoryCount || 0,
        ordersCount: ordersCount || 0,
        hasShopSetup: (inventoryCount || 0) > 0,
        services,
        servicesCount: services.length,
        bookingsCount: bookingsCount || 0,
        hasBookingsSetup: services.length > 0,
        chatRoomsCount: chatRoomsCount || 0,
        commentsCount: commentsCount || 0,
      };
      
      setBackendContext(context);
      return context;
    } catch (err) {
      console.error('Error fetching backend context:', err);
      setBackendContext(defaultContext);
      return defaultContext;
    }
  }, [projectId]);
  
  // Refresh preview (force Sandpack re-render)
  const refreshPreview = useCallback(() => {
    setCodeContent(prev => prev + ' ');
    setTimeout(() => setCodeContent(prev => prev.trim()), 10);
  }, []);
  
  return {
    // State
    project,
    files,
    generatedFiles,
    codeContent,
    loading,
    saving,
    backendContext,
    uploadedAssets,
    generationStartedRef,
    
    // Setters
    setProject,
    setFiles,
    setGeneratedFiles,
    setCodeContent,
    setLoading,
    setSaving,
    setBackendContext,
    setUploadedAssets,
    
    // Actions
    fetchProject,
    saveCode,
    fetchUploadedAssets,
    fetchBackendContext,
    refreshPreview,
  };
}
