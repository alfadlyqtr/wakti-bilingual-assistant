import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ThinkingTimerProps {
  startTime: number;
  isRTL: boolean;
}

export function ThinkingTimer({ startTime, isRTL }: ThinkingTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    setElapsedSeconds(initialElapsed);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const label = isRTL ? `فكّر لمدة ${elapsedSeconds} ث` : `Thought for ${elapsedSeconds}s`;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 shadow-sm",
        isRTL ? "flex-row-reverse" : ""
      )}
    >
      <div className="relative">
        <motion.div 
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 bg-amber-500/40 rounded-full" 
        />
        <Lightbulb className="h-3.5 w-3.5 text-amber-500 relative z-10" />
      </div>
      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        {label}
      </span>
    </motion.div>
  );
}
