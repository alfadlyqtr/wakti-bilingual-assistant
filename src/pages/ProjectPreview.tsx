import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';

interface ProjectData {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  filesJson: string | null;
}

interface ProjectPreviewProps {
  subdomain?: string;
}

export default function ProjectPreview({ subdomain: propSubdomain }: ProjectPreviewProps) {
  const { subdomain: paramSubdomain } = useParams<{ subdomain: string }>();
  const subdomain = propSubdomain || paramSubdomain;
  
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subdomain) {
      fetchProject(subdomain);
    }
  }, [subdomain]);

  const fetchProject = async (subdomainParam: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: projectData, error: projectError } = await supabase
        .from('projects' as any)
        .select('id, name, subdomain, status, bundled_code')
        .eq('subdomain', subdomainParam.toLowerCase())
        .eq('status', 'published')
        .single() as { data: { id: string; name: string; subdomain: string; status: string; bundled_code: string | null } | null; error: any };

      if (projectError || !projectData) {
        setError('Project not found');
        return;
      }

      setProject({
        id: projectData.id,
        name: projectData.name,
        subdomain: projectData.subdomain,
        status: projectData.status,
        filesJson: projectData.bundled_code || null,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="text-6xl mb-6">🔍</div>
          <h1 className="text-3xl font-bold mb-4">Project Not Found</h1>
          <p className="text-gray-300 mb-8">
            The project you're looking for doesn't exist or hasn't been published yet.
          </p>
          <a 
            href="https://wakti.qa" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-colors"
          >
            Go to Wakti
          </a>
        </div>
      </div>
    );
  }

  if (!project.filesJson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="text-6xl mb-6">📦</div>
          <h1 className="text-2xl font-bold mb-4">Project Not Ready</h1>
          <p className="text-gray-300 mb-8">
            This project needs to be re-published.
          </p>
          <a 
            href="https://wakti.qa/projects" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-colors"
          >
            Open Editor
          </a>
        </div>
      </div>
    );
  }

  // Parse the files JSON
  let files: Record<string, string>;
  try {
    files = JSON.parse(project.filesJson);
  } catch (e) {
    console.error('Failed to parse files JSON:', e);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Invalid Project Data</h1>
          <p className="text-gray-300 mb-8">
            The project data is corrupted. Please re-publish.
          </p>
        </div>
      </div>
    );
  }

  // Convert files to Sandpack format (keys without leading slash)
  const sandpackFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    sandpackFiles[cleanPath] = content;
  }

  // Ensure we have an App.js entry point
  if (!sandpackFiles['/App.js'] && !sandpackFiles['/App.jsx']) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Missing Entry Point</h1>
          <p className="text-gray-300 mb-8">
            No App.js found in the project files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SandpackProvider
        template="react"
        files={sandpackFiles}
        options={{
          externalResources: ['https://cdn.tailwindcss.com'],
        }}
        customSetup={{
          entry: '/App.js',
        }}
      >
        <SandpackPreview
          style={{ width: '100%', height: '100%' }}
          showNavigator={false}
          showRefreshButton={false}
          showOpenInCodeSandbox={false}
        />
      </SandpackProvider>
    </div>
  );
}
