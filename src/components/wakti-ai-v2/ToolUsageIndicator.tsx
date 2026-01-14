import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Wrench, Search, Image, MessageSquare, Database, Globe, Zap, CheckCircle2, Clock } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface ToolCall {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ReactNode;
  duration?: number; // ms
  status: 'completed' | 'running' | 'pending';
}

interface ToolUsageIndicatorProps {
  toolsUsed?: number;
  toolCalls?: ToolCall[];
  thinkingDuration?: number; // seconds
  isComplete?: boolean;
  className?: string;
}

// Default tool icons mapping
const getToolIcon = (toolName: string) => {
  const lower = toolName.toLowerCase();
  if (lower.includes('search') || lower.includes('web') || lower.includes('browse')) {
    return <Globe className="w-3 h-3" />;
  }
  if (lower.includes('image') || lower.includes('vision') || lower.includes('generate')) {
    return <Image className="w-3 h-3" />;
  }
  if (lower.includes('database') || lower.includes('supabase') || lower.includes('query')) {
    return <Database className="w-3 h-3" />;
  }
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('chat')) {
    return <MessageSquare className="w-3 h-3" />;
  }
  return <Wrench className="w-3 h-3" />;
};

export function ToolUsageIndicator({
  toolsUsed = 0,
  toolCalls = [],
  thinkingDuration,
  isComplete = true,
  className = ''
}: ToolUsageIndicatorProps) {
  const { language } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no tools used
  if (toolsUsed === 0 && toolCalls.length === 0) return null;

  const actualToolCount = toolCalls.length || toolsUsed;

  return (
    <div className={`mt-2 ${className}`}>
      {/* Collapsed view - clickable header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        {/* Thinking duration badge */}
        {thinkingDuration !== undefined && thinkingDuration > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              {language === 'ar' 
                ? `فكر لـ ${thinkingDuration.toFixed(1)} ث`
                : `Thought for ${thinkingDuration.toFixed(1)}s`
              }
            </span>
          </span>
        )}

        {/* Tools used badge */}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          <Zap className="w-3 h-3" />
          <span>
            {language === 'ar'
              ? `${actualToolCount} أدوات مستخدمة`
              : `${actualToolCount} tool${actualToolCount !== 1 ? 's' : ''} used`
            }
          </span>
        </span>

        {/* Show all/hide toggle */}
        {toolCalls.length > 0 && (
          <span className="flex items-center gap-1 text-primary/70 group-hover:text-primary transition-colors">
            {isExpanded ? (
              <>
                <span>{language === 'ar' ? 'إخفاء' : 'Hide'}</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>{language === 'ar' ? 'عرض الكل' : 'Show all'}</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </span>
        )}
      </button>

      {/* Expanded view - tool list */}
      <AnimatePresence>
        {isExpanded && toolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-primary/20">
              {toolCalls.map((tool, index) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-2 py-1 text-xs"
                >
                  {/* Tool icon */}
                  <span className={`p-1 rounded ${
                    tool.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                    tool.status === 'running' ? 'bg-yellow-500/10 text-yellow-600' :
                    'bg-muted/50 text-muted-foreground'
                  }`}>
                    {tool.icon || getToolIcon(tool.name)}
                  </span>

                  {/* Tool name */}
                  <span className="text-foreground/80">
                    {language === 'ar' ? tool.nameAr : tool.name}
                  </span>

                  {/* Status indicator */}
                  {tool.status === 'completed' && (
                    <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />
                  )}
                  {tool.status === 'running' && (
                    <span className="ml-auto flex items-center gap-1 text-yellow-600">
                      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                    </span>
                  )}

                  {/* Duration if available */}
                  {tool.duration !== undefined && (
                    <span className="text-muted-foreground text-[10px] ml-auto">
                      {tool.duration}ms
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion badge */}
      {isComplete && actualToolCount > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>
              {language === 'ar'
                ? `اكتمل بعد ${actualToolCount} استدعاءات`
                : `Agent completed after ${actualToolCount} tool call${actualToolCount !== 1 ? 's' : ''}`
              }
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export default ToolUsageIndicator;
