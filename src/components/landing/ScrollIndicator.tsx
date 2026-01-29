import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface ScrollIndicatorProps {
  className?: string;
}

export function ScrollIndicator({ className }: ScrollIndicatorProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.6 }}
    >
      <motion.div
        animate={{ 
          y: [0, 8, 0],
          opacity: [0.4, 1, 0.4]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="flex flex-col items-center gap-1"
      >
        <span className="text-xs font-light tracking-[0.2em] uppercase text-white/50">
          Scroll
        </span>
        <ChevronDown className="h-5 w-5 text-[#e9ceb0]/70" />
      </motion.div>
    </motion.div>
  );
}
