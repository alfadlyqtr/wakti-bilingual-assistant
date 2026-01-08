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

      // Fetch the bundled code file
      const { data: bundledFile } = await supabase
        .from('project_files' as any)
        .select('content')
        .eq('project_id', projectData.id)
        .eq('path', '/__bundled__.json')
        .single() as { data: { content: string } | null };

      let bundledCode = null;
      if (bundledFile?.content) {
        try {
          bundledCode = JSON.parse(bundledFile.content);
        } catch (e) {
          console.error('Failed to parse bundled code:', e);
        }
      }

      setProject({
        ...projectData,
        bundledCode,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Generate publishable HTML from bundled code
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
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    body { margin: 0; padding: 0; min-height: 100vh; background: #fff; }
    #root { min-height: 100vh; }
    .error-container { 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      padding: 20px;
    }
    .error-box { 
      text-align: center; 
      color: white; 
      max-width: 400px;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      background: rgba(239, 68, 68, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    .error-title { font-size: 24px; font-weight: bold; margin-bottom: 12px; }
    .error-message { color: #9ca3af; margin-bottom: 20px; }
    .error-details { 
      background: rgba(0,0,0,0.3); 
      padding: 12px; 
      border-radius: 8px; 
      text-align: left;
      margin-bottom: 20px;
    }
    .error-details code { 
      color: #f87171; 
      font-size: 12px; 
      word-break: break-all;
    }
    .error-btn {
      display: inline-block;
      padding: 10px 24px;
      background: white;
      color: #111827;
      border-radius: 9999px;
      font-weight: 600;
      text-decoration: none;
    }
    ${bundledCss}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    // Global error handler to catch runtime errors
    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Runtime error:', message, error);
      var root = document.getElementById('root');
      if (root) {
        root.innerHTML = '<div class="error-container"><div class="error-box">' +
          '<div class="error-icon">⚠️</div>' +
          '<div class="error-title">Oops! Something went wrong</div>' +
          '<div class="error-message">There was an error running this project. Please try regenerating it in the editor.</div>' +
          '<div class="error-details"><code>' + message + '</code></div>' +
          '<a href="https://wakti.qa/projects" class="error-btn">Open Editor</a>' +
          '</div></div>';
      }
      return true;
    };
  </script>
  
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
    
    // react-i18next shim - provides basic translation functionality
    const useTranslation = () => ({
      t: (key) => key, // Return the key as-is (or could parse _en/_ar suffixes)
      i18n: { 
        language: 'en', 
        changeLanguage: () => Promise.resolve(),
        dir: () => 'ltr'
      }
    });
    
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
    const Sparkles = createIcon('Sparkles', ['M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z', 'M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z']);
    const Gift = createIcon('Gift', ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z']);
    const Smile = createIcon('Smile', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01']);
    const Book = createIcon('Book', ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z']);
    const BookOpen = createIcon('BookOpen', ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z']);
    const Languages = createIcon('Languages', ['M5 8l6 6', 'M4 14l6-6 2-3', 'M2 5h12', 'M7 2v3', 'M22 22l-5-10-5 10', 'M14 18h6']);
    const Globe = createIcon('Globe', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']);
    const Settings = createIcon('Settings', ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z']);
    const Home = createIcon('Home', ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']);
    const Plus = createIcon('Plus', ['M12 5v14', 'M5 12h14']);
    const Minus = createIcon('Minus', ['M5 12h14']);
    const Trash = createIcon('Trash', ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2']);
    const Edit = createIcon('Edit', ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']);
    const Copy = createIcon('Copy', ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1']);
    const Download = createIcon('Download', ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']);
    const Upload = createIcon('Upload', ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12']);
    const Share = createIcon('Share', ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13']);
    const ExternalLink = createIcon('ExternalLink', ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3']);
    const Info = createIcon('Info', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 16v-4', 'M12 8h.01']);
    const AlertCircle = createIcon('AlertCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01']);
    const CheckCircle = createIcon('CheckCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9 12l2 2 4-4']);
    const XCircle = createIcon('XCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M15 9l-6 6', 'M9 9l6 6']);
    const Calendar = createIcon('Calendar', ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18']);
    const Image = createIcon('Image', ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21']);
    const Video = createIcon('Video', ['M23 7l-7 5 7 5V7z', 'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z']);
    const Music = createIcon('Music', ['M9 18V5l12-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z']);
    const Mic = createIcon('Mic', ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8']);
    const Camera = createIcon('Camera', ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']);
    const Send = createIcon('Send', ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z']);
    const MessageCircle = createIcon('MessageCircle', ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z']);
    const Bell = createIcon('Bell', ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0']);
    const Lock = createIcon('Lock', ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4']);
    const Unlock = createIcon('Unlock', ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 9.9-1']);
    const Eye = createIcon('Eye', ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
    const EyeOff = createIcon('EyeOff', ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24', 'M1 1l22 22']);
    const Filter = createIcon('Filter', ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z']);
    const MoreHorizontal = createIcon('MoreHorizontal', ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z']);
    const MoreVertical = createIcon('MoreVertical', ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z']);
    const RefreshCw = createIcon('RefreshCw', ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15']);
    const RotateCw = createIcon('RotateCw', ['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10']);
    const Loader = createIcon('Loader', ['M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83', 'M2 12h4', 'M18 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83']);
    const Zap = createIcon('Zap', ['M13 2L3 14h9l-1 8 10-12h-9l1-8z']);
    const Award = createIcon('Award', ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12']);
    const Target = createIcon('Target', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z']);
    const TrendingUp = createIcon('TrendingUp', ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6']);
    const TrendingDown = createIcon('TrendingDown', ['M23 18l-9.5-9.5-5 5L1 6', 'M17 18h6v-6']);
    const DollarSign = createIcon('DollarSign', ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']);
    const CreditCard = createIcon('CreditCard', ['M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M1 10h22']);
    const Bookmark = createIcon('Bookmark', ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z']);
    const Tag = createIcon('Tag', ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01']);
    const Folder = createIcon('Folder', ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z']);
    const File = createIcon('File', ['M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M13 2v7h7']);
    const FileText = createIcon('FileText', ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8']);
    const Paperclip = createIcon('Paperclip', ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48']);
    const Link = createIcon('Link', ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']);
    const Wifi = createIcon('Wifi', ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01']);
    const Battery = createIcon('Battery', ['M17 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M23 13v-2']);
    const Sun = createIcon('Sun', ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42']);
    const Moon = createIcon('Moon', ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']);
    const Cloud = createIcon('Cloud', ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z']);
    const Droplet = createIcon('Droplet', ['M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z']);
    const Thermometer = createIcon('Thermometer', ['M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z']);
    const Wind = createIcon('Wind', ['M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2']);
    const Umbrella = createIcon('Umbrella', ['M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7']);
    const Coffee = createIcon('Coffee', ['M18 8h1a4 4 0 0 1 0 8h-1', 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z', 'M6 1v3', 'M10 1v3', 'M14 1v3']);
    const Briefcase = createIcon('Briefcase', ['M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16']);
    const Truck = createIcon('Truck', ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z']);
    const Package = createIcon('Package', ['M16.5 9.4l-9-5.19', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12']);
    const Box = createIcon('Box', ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12']);
    const Layers = createIcon('Layers', ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5']);
    const Grid = createIcon('Grid', ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z']);
    const List = createIcon('List', ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01']);
    const Layout = createIcon('Layout', ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M3 9h18', 'M9 21V9']);
    const Sidebar = createIcon('Sidebar', ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M9 3v18']);
    const Terminal = createIcon('Terminal', ['M4 17l6-6-6-6', 'M12 19h8']);
    const Code = createIcon('Code', ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6']);
    const Hash = createIcon('Hash', ['M4 9h16', 'M4 15h16', 'M10 3L8 21', 'M16 3l-2 18']);
    const AtSign = createIcon('AtSign', ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28']);
    const Percent = createIcon('Percent', ['M19 5L5 19', 'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z']);
    const Activity = createIcon('Activity', ['M22 12h-4l-3 9L9 3l-3 9H2']);
    const BarChart = createIcon('BarChart', ['M12 20V10', 'M18 20V4', 'M6 20v-4']);
    const PieChart = createIcon('PieChart', ['M21.21 15.89A10 10 0 1 1 8 2.83', 'M22 12A10 10 0 0 0 12 2v10z']);
    const Compass = createIcon('Compass', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z']);
    const Map = createIcon('Map', ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z', 'M8 2v16', 'M16 6v16']);
    const Navigation = createIcon('Navigation', ['M3 11l19-9-9 19-2-8-8-2z']);
    const Crosshair = createIcon('Crosshair', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M22 12h-4', 'M6 12H2', 'M12 6V2', 'M12 22v-4']);
    const Move = createIcon('Move', ['M5 9l-3 3 3 3', 'M9 5l3-3 3 3', 'M15 19l-3 3-3-3', 'M19 9l3 3-3 3', 'M2 12h20', 'M12 2v20']);
    const Maximize = createIcon('Maximize', ['M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3']);
    const Minimize = createIcon('Minimize', ['M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3']);
    const ZoomIn = createIcon('ZoomIn', ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M11 8v6', 'M8 11h6']);
    const ZoomOut = createIcon('ZoomOut', ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M8 11h6']);
    const SkipBack = createIcon('SkipBack', ['M19 20L9 12l10-8v16z', 'M5 19V5']);
    const SkipForward = createIcon('SkipForward', ['M5 4l10 8-10 8V4z', 'M19 5v14']);
    const Rewind = createIcon('Rewind', ['M11 19l-9-7 9-7v14z', 'M22 19l-9-7 9-7v14z']);
    const FastForward = createIcon('FastForward', ['M13 19l9-7-9-7v14z', 'M2 19l9-7-9-7v14z']);
    const Volume = createIcon('Volume', ['M11 5L6 9H2v6h4l5 4V5z']);
    const Volume1 = createIcon('Volume1', ['M11 5L6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07']);
    const Volume2 = createIcon('Volume2', ['M11 5L6 9H2v6h4l5 4V5z', 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07']);
    const VolumeX = createIcon('VolumeX', ['M11 5L6 9H2v6h4l5 4V5z', 'M23 9l-6 6', 'M17 9l6 6']);
    const Headphones = createIcon('Headphones', ['M3 18v-6a9 9 0 0 1 18 0v6', 'M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z']);
    const Radio = createIcon('Radio', ['M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14']);
    const Tv = createIcon('Tv', ['M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z', 'M17 2l-5 5-5-5']);
    const Monitor = createIcon('Monitor', ['M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8 21h8', 'M12 17v4']);
    const Smartphone = createIcon('Smartphone', ['M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z', 'M12 18h.01']);
    const Tablet = createIcon('Tablet', ['M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z', 'M12 18h.01']);
    const Watch = createIcon('Watch', ['M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M12 9v3l1.5 1.5', 'M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83']);
    const Printer = createIcon('Printer', ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z']);
    const Server = createIcon('Server', ['M20 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M20 12H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z', 'M6 8h.01', 'M6 16h.01']);
    const Database = createIcon('Database', ['M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z', 'M2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5', 'M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5']);
    const HardDrive = createIcon('HardDrive', ['M22 12H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z', 'M6 16h.01', 'M10 16h.01']);
    const Cpu = createIcon('Cpu', ['M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 14h3', 'M1 9h3', 'M1 14h3']);
    const Power = createIcon('Power', ['M18.36 6.64a9 9 0 1 1-12.73 0', 'M12 2v10']);
    const ToggleLeft = createIcon('ToggleLeft', ['M16 5H8a7 7 0 0 0 0 14h8a7 7 0 0 0 0-14z', 'M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
    const ToggleRight = createIcon('ToggleRight', ['M16 5H8a7 7 0 0 0 0 14h8a7 7 0 0 0 0-14z', 'M16 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
    const Sliders = createIcon('Sliders', ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6']);
    const Tool = createIcon('Tool', ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']);
    const Wrench = createIcon('Wrench', ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']);
    const Scissors = createIcon('Scissors', ['M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M20 4L8.12 15.88', 'M14.47 14.48L20 20', 'M8.12 8.12L12 12']);
    const Anchor = createIcon('Anchor', ['M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 22V8', 'M5 12H2a10 10 0 0 0 20 0h-3']);
    const Flag = createIcon('Flag', ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7']);
    const Inbox = createIcon('Inbox', ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z']);
    const Archive = createIcon('Archive', ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4']);
    const Trash2 = createIcon('Trash2', ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6']);
    const Save = createIcon('Save', ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8']);
    const LogIn = createIcon('LogIn', ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'M10 17l5-5-5-5', 'M15 12H3']);
    const LogOut = createIcon('LogOut', ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9']);
    const UserPlus = createIcon('UserPlus', ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6']);
    const UserMinus = createIcon('UserMinus', ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 11h-6']);
    const UserCheck = createIcon('UserCheck', ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M17 11l2 2 4-4']);
    const UserX = createIcon('UserX', ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M18 8l5 5', 'M23 8l-5 5']);
    const Users = createIcon('Users', ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']);
    const ThumbsUp = createIcon('ThumbsUp', ['M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3']);
    const ThumbsDown = createIcon('ThumbsDown', ['M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17']);
    const MessageSquare = createIcon('MessageSquare', ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']);
    const HelpCircle = createIcon('HelpCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01']);
    const AlertTriangleIcon = createIcon('AlertTriangle', ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01']);
    const ShieldIcon = createIcon('Shield', ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']);
    const Key = createIcon('Key', ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4']);
    const Fingerprint = createIcon('Fingerprint', ['M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4', 'M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2', 'M17.29 21.02c.12-.6.43-2.3.5-3.02', 'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4', 'M8.65 22c.21-.66.45-1.32.57-2', 'M14 13.12c0 2.38 0 6.38-1 8.88', 'M2 16h.01', 'M21.8 16c.2-2 .131-5.354 0-6', 'M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2']);
    
    // ========== BUNDLED PROJECT CODE ==========
    ${bundledJs}
    
    // Render the app after Babel transforms
    try {
      if (typeof App === 'function') {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
      } else {
        throw new Error('App component not found');
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
