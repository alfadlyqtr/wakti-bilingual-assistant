import React, { useState, useEffect, useRef } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { Terminal, Trash2, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ConsoleLog {
  id: string;
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  data: any[];
  timestamp: number;
}

interface SandpackConsolePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  maxHeight?: number;
}

export function SandpackConsolePanel({ isOpen, onToggle, maxHeight = 200 }: SandpackConsolePanelProps) {
  const { sandpack } = useSandpack();
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);

  // Listen for console messages from the preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // CRITICAL: Clone event.data to avoid readonly property errors
      // Sandpack freezes event.data in some cases
      let eventData: any;
      try {
        eventData = event.data ? JSON.parse(JSON.stringify(event.data)) : {};
      } catch (e) {
        eventData = {};
      }
      
      if (eventData?.type === 'console' && eventData?.log) {
        const { method, data } = eventData.log;
        const newLog: ConsoleLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          method: method || 'log',
          data: data || [],
          timestamp: Date.now(),
        };
        
        setLogs(prev => [...prev.slice(-100), newLog]); // Keep last 100 logs
        
        if (method === 'error') {
          setErrorCount(prev => prev + 1);
        } else if (method === 'warn') {
          setWarnCount(prev => prev + 1);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  // Clear logs when sandpack restarts
  useEffect(() => {
    if (sandpack.status === 'initial' || sandpack.status === 'idle') {
      setLogs([]);
      setErrorCount(0);
      setWarnCount(0);
    }
  }, [sandpack.status]);

  const clearLogs = () => {
    setLogs([]);
    setErrorCount(0);
    setWarnCount(0);
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const getMethodIcon = (method: ConsoleLog['method']) => {
    switch (method) {
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'warn':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'info':
        return <Info className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return null;
    }
  };

  const getMethodColor = (method: ConsoleLog['method']) => {
    switch (method) {
      case 'error':
        return 'text-red-400 bg-red-500/10';
      case 'warn':
        return 'text-amber-400 bg-amber-500/10';
      case 'info':
        return 'text-blue-400 bg-blue-500/10';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="border-t border-white/10 bg-[#0c0f14]">
      {/* Console Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          )}
          <Terminal className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Console</span>
          
          {/* Error/Warning badges */}
          {(errorCount > 0 || warnCount > 0) && (
            <div className="flex items-center gap-1.5 ml-2">
              {errorCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded">
                  {errorCount} error{errorCount > 1 ? 's' : ''}
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                  {warnCount} warning{warnCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
        
        {isOpen && logs.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearLogs();
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
          </button>
        )}
      </button>

      {/* Console Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: maxHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="overflow-y-auto font-mono text-xs"
              style={{ maxHeight }}
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8 text-gray-500">
                  <span>No console output</span>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-2 px-3 py-1.5",
                        getMethodColor(log.method)
                      )}
                    >
                      <span className="shrink-0 mt-0.5">
                        {getMethodIcon(log.method)}
                      </span>
                      <span className="flex-1 break-all whitespace-pre-wrap">
                        {log.data.map(formatValue).join(' ')}
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-600">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
