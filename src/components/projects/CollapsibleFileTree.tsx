import React, { useState, useMemo } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { 
  ChevronDown, 
  ChevronRight, 
  FileCode, 
  FileJson, 
  FileType, 
  Folder, 
  FolderOpen,
  FileText,
  Image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface CollapsibleFileTreeProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CollapsibleFileTree({ isCollapsed = false, onToggleCollapse }: CollapsibleFileTreeProps) {
  const { sandpack } = useSandpack();
  const { files, activeFile, openFile } = sandpack;
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  // Build tree structure from flat file paths
  const fileTree = useMemo(() => {
    const root: FileNode = { name: 'root', path: '/', type: 'folder', children: [] };
    
    // Sort files: App.js first, then by path
    const sortedPaths = Object.keys(files).sort((a, b) => {
      if (a === '/App.js') return -1;
      if (b === '/App.js') return 1;
      return a.localeCompare(b);
    });

    sortedPaths.forEach(filePath => {
      // Skip node_modules and hidden files
      if (filePath.includes('node_modules') || filePath.startsWith('/.')) return;
      
      const parts = filePath.split('/').filter(Boolean);
      let currentNode = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath += '/' + part;
        const isFile = index === parts.length - 1;
        
        if (!currentNode.children) currentNode.children = [];
        
        let child = currentNode.children.find(c => c.name === part);
        if (!child) {
          child = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
          };
          currentNode.children.push(child);
        }
        
        if (!isFile) {
          currentNode = child;
        }
      });
    });

    // Sort children: folders first, then files
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };
    sortChildren(root);

    return root;
  }, [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <FileCode className="w-4 h-4 text-amber-400" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-yellow-400" />;
      case 'css':
      case 'scss':
      case 'less':
        return <FileType className="w-4 h-4 text-blue-400" />;
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image className="w-4 h-4 text-green-400" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    if (node.path === '/') {
      return node.children?.map(child => renderNode(child, 0));
    }

    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors",
              "text-gray-400 hover:text-white hover:bg-white/5"
            )}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          
          <AnimatePresence>
            {isExpanded && node.children && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                {node.children.map(child => renderNode(child, depth + 1))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => openFile(node.path)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors",
          isActive 
            ? "bg-amber-500/15 text-amber-400 border-l-2 border-amber-500" 
            : "text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
        )}
        style={{ paddingLeft: `${20 + depth * 12}px` }}
      >
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-10 h-full border-r border-white/10 bg-[#0f172a]/50 flex flex-col items-center py-3">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          title="Expand file tree"
        >
          <Folder className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 md:w-64 h-full border-r border-white/10 bg-[#0f172a]/50 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Files
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            title="Collapse file tree"
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {renderNode(fileTree)}
      </div>
    </div>
  );
}
