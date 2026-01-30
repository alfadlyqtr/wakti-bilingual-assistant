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
        <span 
          className="text-sm font-medium tracking-[0.25em] uppercase"
          style={{
            background: "linear-gradient(135deg, #e9ceb0 0%, #ffffff 50%, #e9ceb0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 15px rgba(233, 206, 176, 0.6)"
          }}
        >
          SCROLL
        </span>
        <ChevronDown 
          className="h-6 w-6" 
          style={{ 
            color: "#e9ceb0", 
            filter: "drop-shadow(0 0 8px rgba(233, 206, 176, 0.7))" 
          }} 
        />
      </motion.div>
    </motion.div>
  );
}
