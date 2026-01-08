import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ProjectData {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  bundledCode: { css: string; js: string } | null;
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

      // Parse bundled_code from the project data
      let bundledCode = null;
      if (projectData.bundled_code) {
        try {
          bundledCode = JSON.parse(projectData.bundled_code);
        } catch (e) {
          console.error('Failed to parse bundled code:', e);
        }
      }

      setProject({
        id: projectData.id,
        name: projectData.name,
        subdomain: projectData.subdomain,
        status: projectData.status,
        bundledCode,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Generate publishable HTML from server-built bundle
  const generateHtml = (bundledCode: { css: string; js: string }, projectName: string): string => {
    const { css: bundledCss, js: bundledJs } = bundledCode;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&family=Cairo:wght@300;400;500;600;700&family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Inter', 'Tajawal', 'Cairo', system-ui, sans-serif; }
    body { margin: 0; padding: 0; min-height: 100vh; }
    #root { min-height: 100vh; }
    .font-oswald { font-family: 'Oswald', sans-serif; }
    .font-cairo { font-family: 'Cairo', sans-serif; }
    .error-container { 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      padding: 20px;
    }
    .error-box { text-align: center; color: white; max-width: 400px; }
    .error-icon { width: 64px; height: 64px; margin: 0 auto 20px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .error-title { font-size: 24px; font-weight: bold; margin-bottom: 12px; }
    .error-message { color: #9ca3af; margin-bottom: 20px; }
    .error-details { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: left; margin-bottom: 20px; }
    .error-details code { color: #f87171; font-size: 12px; word-break: break-all; }
    .error-btn { display: inline-block; padding: 10px 24px; background: white; color: #111827; border-radius: 9999px; font-weight: 600; text-decoration: none; }
    ${bundledCss}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Runtime error:', message, error);
      var root = document.getElementById('root');
      if (root) {
        root.innerHTML = '<div class="error-container"><div class="error-box">' +
          '<div class="error-icon">⚠️</div>' +
          '<div class="error-title">Oops! Something went wrong</div>' +
          '<div class="error-message">There was an error running this project.</div>' +
          '<div class="error-details"><code>' + message + '</code></div>' +
          '<a href="https://wakti.qa/projects" class="error-btn">Open Editor</a>' +
          '</div></div>';
      }
      return true;
    };
  </script>
  
  <script type="text/babel" data-presets="react">
    // Server-built bundle with all shims included
    ${bundledJs}
    
    // Render the app
    try {
      if (typeof App !== 'undefined') {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        // Handle both default export and named App
        const AppComponent = App.default || App;
        root.render(<AppComponent />);
      } else {
        throw new Error('App component not found in bundle');
      }
    } catch (err) {
      console.error('Render error:', err);
      document.getElementById('root').innerHTML = '<div class="error-container"><div class="error-box">' +
        '<div class="error-icon">⚠️</div>' +
        '<div class="error-title">Failed to render app</div>' +
        '<div class="error-message">' + err.message + '</div>' +
        '<a href="https://wakti.qa/projects" class="error-btn">Open Editor</a>' +
        '</div></div>';
    }
  </script>
</body>
</html>`;
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

  // Check if bundled code exists
  if (!project.bundledCode) {
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

  // Render the project in an iframe for isolation
  const htmlContent = generateHtml(project.bundledCode, project.name);
  const blob = new Blob([htmlContent], { type: 'text/html' });
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

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
