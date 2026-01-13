import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

interface ThinkingTimerProps {
  startTime: number | null;
  isActive: boolean;
  isRTL?: boolean;
}

export const ThinkingTimer: React.FC<ThinkingTimerProps> = ({
  startTime,
  isActive,
  isRTL = false
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      return;
    }

    // Calculate initial elapsed time
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    setElapsedSeconds(initialElapsed);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  if (!isActive || !startTime) {
    return null;
  }

  const label = isRTL ? `فكّر لمدة ${elapsedSeconds} ث` : `Thought for ${elapsedSeconds}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <Lightbulb className="h-4 w-4 text-yellow-500" />
      <span>{label}</span>
    </motion.div>
  );
};

export default ThinkingTimer;
