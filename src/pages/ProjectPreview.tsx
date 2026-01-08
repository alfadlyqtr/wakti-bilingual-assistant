import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProjectData {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  files: Record<string, string>;
}

export default function ProjectPreview() {
  const { subdomain } = useParams<{ subdomain: string }>();
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

      // Fetch project by subdomain
      const { data: projectData, error: projectError } = await supabase
        .from('projects' as any)
        .select('id, name, subdomain, status')
        .eq('subdomain', subdomainParam.toLowerCase())
        .eq('status', 'published')
        .single();

      if (projectError || !projectData) {
        setError('Project not found');
        return;
      }

      // Fetch project files
      const { data: filesData, error: filesError } = await supabase
        .from('project_files' as any)
        .select('path, content')
        .eq('project_id', projectData.id);

      if (filesError) {
        setError('Failed to load project files');
        return;
      }

      // Build files map
      const files: Record<string, string> = {};
      for (const file of filesData || []) {
        const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
        files[path] = file.content;
      }

      setProject({
        ...projectData,
        files,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Generate publishable HTML from project files
  const generateHtml = (files: Record<string, string>, projectName: string): string => {
    const jsFiles = Object.keys(files).filter(f => f.endsWith('.js') && f !== '/App.js');
    const cssFiles = Object.keys(files).filter(f => f.endsWith('.css'));
    
    const inlineCss = cssFiles.map(f => files[f]).join('\n');
    
    // Sort JS files: data/utils first
    const sortedJsFiles = [...jsFiles].sort((a, b) => {
      const aIsData = a.includes('data') || a.includes('utils') || a.includes('mock') || a.includes('config');
      const bIsData = b.includes('data') || b.includes('utils') || b.includes('mock') || b.includes('config');
      if (aIsData && !bIsData) return -1;
      if (!aIsData && bIsData) return 1;
      return 0;
    });
    
    const componentScripts = sortedJsFiles.map(filePath => {
      const content = files[filePath];
      const componentName = filePath.replace(/^\//, '').replace(/\.js$/, '').split('/').pop() || 'Component';
      return `
// --- ${filePath} ---
${convertToGlobalComponent(content, componentName)}
`;
    }).join('\n');

    const appJsContent = files['/App.js'] || '';
    const appComponent = convertToGlobalComponent(appJsContent, 'App');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    body { margin: 0; padding: 0; min-height: 100vh; background: #fff; }
    #root { min-height: 100vh; }
    ${inlineCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, Fragment } = React;
    
    // Framer Motion shim
    const motion = new Proxy({}, {
      get: (_, tag) => (props) => {
        const { initial, animate, exit, transition, whileHover, whileTap, whileInView, variants, ...rest } = props;
        return React.createElement(tag, rest);
      }
    });
    const AnimatePresence = ({ children }) => children;
    
    // Lucide icons shim
    const createIcon = (name, paths) => (props) => React.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: props.size || 24,
      height: props.size || 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props.className || '',
      ...props
    }, paths.map((d, i) => React.createElement('path', { key: i, d })));
    
    const ChevronRight = createIcon('ChevronRight', ['M9 18l6-6-6-6']);
    const ChevronLeft = createIcon('ChevronLeft', ['M15 18l-6-6 6-6']);
    const Menu = createIcon('Menu', ['M3 12h18', 'M3 6h18', 'M3 18h18']);
    const X = createIcon('X', ['M18 6L6 18', 'M6 6l12 12']);
    const Check = createIcon('Check', ['M20 6L9 17l-5-5']);
    const Star = createIcon('Star', ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z']);
    const Heart = createIcon('Heart', ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z']);
    const ArrowRight = createIcon('ArrowRight', ['M5 12h14', 'M12 5l7 7-7 7']);
    const Phone = createIcon('Phone', ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z']);
    const Mail = createIcon('Mail', ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6']);
    const MapPin = createIcon('MapPin', ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
    const Clock = createIcon('Clock', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2']);
    const User = createIcon('User', ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']);
    const Search = createIcon('Search', ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35']);
    const ShoppingCart = createIcon('ShoppingCart', ['M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6']);
    const Play = createIcon('Play', ['M5 3l14 9-14 9V3z']);
    const Pause = createIcon('Pause', ['M6 4h4v16H6z', 'M14 4h4v16h-4z']);
    
    ${componentScripts}
    
    ${appComponent}
    
    // Render the app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading project...</p>
        </div>
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

  // Render the project in an iframe for isolation
  const htmlContent = generateHtml(project.files, project.name);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  return (
    <iframe
      src={blobUrl}
      title={project.name}
      className="w-full h-screen border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}

// Helper functions
function convertToGlobalComponent(code: string, componentName: string): string {
  let converted = code;
  
  // Remove import statements
  converted = converted.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  converted = converted.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  
  // Remove export default and convert to global assignment
  converted = converted.replace(/export\s+default\s+function\s+(\w+)/g, 'const $1 = function');
  converted = converted.replace(/export\s+default\s+(\w+);?/g, '');
  converted = converted.replace(/export\s+function\s+(\w+)/g, 'const $1 = function');
  converted = converted.replace(/export\s+const\s+/g, 'const ');
  converted = converted.replace(/export\s+\{[^}]*\};?/g, '');
  
  return converted;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
