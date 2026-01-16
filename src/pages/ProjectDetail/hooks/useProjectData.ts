import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Project, ProjectFile, GeneratedFiles, BackendContext, UploadedAsset } from '../types';

interface UseProjectDataOptions {
  projectId: string | undefined;
  userId: string | undefined;
}

interface UseProjectDataReturn {
  project: Project | null;
  files: ProjectFile[];
  generatedFiles: GeneratedFiles;
  backendContext: BackendContext | null;
  uploadedAssets: UploadedAsset[];
  loading: boolean;
  saving: boolean;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  setFiles: React.Dispatch<React.SetStateAction<ProjectFile[]>>;
  setGeneratedFiles: React.Dispatch<React.SetStateAction<GeneratedFiles>>;
  setBackendContext: React.Dispatch<React.SetStateAction<BackendContext | null>>;
  fetchProject: () => Promise<void>;
  saveProject: (updates: Partial<Project>) => Promise<boolean>;
  saveFiles: (files: GeneratedFiles) => Promise<boolean>;
  refreshBackendContext: () => Promise<BackendContext | null>;
}

export function useProjectData({ projectId, userId }: UseProjectDataOptions): UseProjectDataReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles>({});
  const [backendContext, setBackendContext] = useState<BackendContext | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Memoized fetch project function
  const fetchProject = useCallback(async () => {
    if (!projectId || !userId) return;
    
    setLoading(true);
    try {
      // Fetch project metadata
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        return;
      }

      setProject(projectData as Project);

      // Fetch project files
      const { data: filesData, error: filesError } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId);

      if (filesError) {
        console.error('Error fetching files:', filesError);
        return;
      }

      const typedFiles = filesData as ProjectFile[];
      setFiles(typedFiles);

      // Build generated files map
      const filesMap: GeneratedFiles = {};
      typedFiles.forEach((file) => {
        filesMap[file.path] = file.content;
      });
      setGeneratedFiles(filesMap);

    } catch (err) {
      console.error('Exception fetching project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  // Save project metadata
  const saveProject = useCallback(async (updates: Partial<Project>): Promise<boolean> => {
    if (!projectId) return false;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) {
        console.error('Error saving project:', error);
        return false;
      }

      setProject(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err) {
      console.error('Exception saving project:', err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // Save files to database
  const saveFiles = useCallback(async (newFiles: GeneratedFiles): Promise<boolean> => {
    if (!projectId) return false;

    setSaving(true);
    try {
      // Delete existing files
      await supabase
        .from('project_files')
        .delete()
        .eq('project_id', projectId);

      // Insert new files
      const fileRows = Object.entries(newFiles).map(([path, content]) => ({
        project_id: projectId,
        path: path.startsWith('/') ? path : `/${path}`,
        content,
      }));

      if (fileRows.length > 0) {
        const { error } = await supabase
          .from('project_files')
          .insert(fileRows);

        if (error) {
          console.error('Error saving files:', error);
          return false;
        }
      }

      setGeneratedFiles(newFiles);
      return true;
    } catch (err) {
      console.error('Exception saving files:', err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // Fetch uploaded assets
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
      }
    } catch (err) {
      console.error('Exception fetching uploaded assets:', err);
    }
  }, [projectId]);

  // Refresh backend context
  const refreshBackendContext = useCallback(async (): Promise<BackendContext | null> => {
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
      const [formSubmissions, uploads, siteUsers, products, orders, services, bookings, chatRooms, comments] = await Promise.all([
        supabase.from('project_form_submissions').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_uploads').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_site_users').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_collections').select('data').eq('project_id', projectId).eq('collection_name', 'products').limit(10),
        supabase.from('project_orders').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_collections').select('data').eq('project_id', projectId).eq('collection_name', 'booking_services').limit(10),
        supabase.from('project_bookings').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_chat_rooms').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_comments').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      ]);

      const productsArray = ((products.data || []) as any[]).map((p) => ({
        name: p.data?.name || p.data?.title || 'Unnamed Product',
        price: p.data?.price || 0,
        image: p.data?.image || p.data?.imageUrl,
        category: p.data?.category,
      }));

      const servicesArray = ((services.data || []) as any[]).map((s) => ({
        name: s.data?.name || s.data?.title || 'Unnamed Service',
        duration: s.data?.duration || 30,
        price: s.data?.price || 0,
      }));

      const nextContext: BackendContext = {
        enabled: true,
        collections,
        formSubmissionsCount: formSubmissions.count || 0,
        uploadsCount: uploads.count || 0,
        siteUsersCount: siteUsers.count || 0,
        products: productsArray,
        productsCount: productsArray.length,
        ordersCount: orders.count || 0,
        hasShopSetup: productsArray.length > 0,
        services: servicesArray,
        servicesCount: servicesArray.length,
        bookingsCount: bookings.count || 0,
        hasBookingsSetup: servicesArray.length > 0,
        chatRoomsCount: chatRooms.count || 0,
        commentsCount: comments.count || 0,
      };

      setBackendContext(nextContext);
      return nextContext;
    } catch (err) {
      console.error('Exception fetching backend context:', err);
      return null;
    }
  }, [projectId]);

  // Fetch data on mount
  useEffect(() => {
    if (projectId && userId) {
      fetchProject();
      fetchUploadedAssets();
      refreshBackendContext();
    }
  }, [projectId, userId, fetchProject, fetchUploadedAssets, refreshBackendContext]);

  return {
    project,
    files,
    generatedFiles,
    backendContext,
    uploadedAssets,
    loading,
    saving,
    setProject,
    setFiles,
    setGeneratedFiles,
    setBackendContext,
    fetchProject,
    saveProject,
    saveFiles,
    refreshBackendContext,
  };
}
