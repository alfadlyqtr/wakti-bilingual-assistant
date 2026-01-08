import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ProjectData {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  bundledHtml: string | null;
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
  const [iframeError, setIframeError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (subdomain) {
      fetchProject(subdomain);
    }
  }, [subdomain]);

  const fetchProject = async (subdomainParam: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project by subdomain (including bundled_code)
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

      // bundled_code is now the full HTML string (not JSON)
      setProject({
        id: projectData.id,
        name: projectData.name,
        subdomain: projectData.subdomain,
        status: projectData.status,
        bundledHtml: projectData.bundled_code || null,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    // Minimal loading - just a subtle spinner, no text that exposes our backend
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

  // Handle iframe load and error detection
  const handleIframeLoad = () => {
    // Listen for errors from the iframe
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // Add error listener to iframe window
        iframe.contentWindow.onerror = (message, source, lineno, colno, error) => {
          console.error('Iframe error:', message, error);
          setIframeError(`Runtime Error: ${message}`);
          return true; // Prevent default error handling
        };
      }
    } catch (e) {
      // Cross-origin restrictions may prevent this
      console.warn('Could not attach error handler to iframe:', e);
    }
  };

  // Check if bundled HTML exists
  if (!project.bundledHtml) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="text-6xl mb-6">📦</div>
          <h1 className="text-2xl font-bold mb-4">Project Not Ready</h1>
          <p className="text-gray-300 mb-8">
            This project needs to be re-published to generate the bundled code.
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

  // Render the project in an iframe for isolation - bundledHtml is already the full HTML
  const blob = new Blob([project.bundledHtml], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  // Show iframe error screen
  if (iframeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center text-white max-w-md px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Oops! Something went wrong</h1>
          <p className="text-gray-300 mb-6">
            There was an error loading this project. The code may have an issue that needs to be fixed in the editor.
          </p>
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-gray-400 mb-1">Error details:</p>
            <code className="text-sm text-red-300 break-all">{iframeError}</code>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setIframeError(null)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <a 
              href="https://wakti.qa/projects" 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-colors"
            >
              Open Editor
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={blobUrl}
      title={project.name}
      className="w-full h-screen border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      onLoad={handleIframeLoad}
    />
  );
}
