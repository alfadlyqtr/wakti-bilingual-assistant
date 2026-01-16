import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// Animation variants for reuse
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 }
  }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { opacity: 0 }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.15 }
  }
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: 50,
    transition: { duration: 0.2 }
  }
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: -50,
    transition: { duration: 0.2 }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2 }
  }
};

interface AnimatedContainerProps {
  children: React.ReactNode;
  variant?: 'fadeInUp' | 'fadeIn' | 'scaleIn' | 'slideInRight' | 'slideInLeft';
  className?: string;
  delay?: number;
  duration?: number;
  as?: keyof JSX.IntrinsicElements;
}

const variantMap = {
  fadeInUp,
  fadeIn,
  scaleIn,
  slideInRight,
  slideInLeft,
};

export function AnimatedContainer({
  children,
  variant = 'fadeInUp',
  className,
  delay = 0,
  duration,
  as = 'div',
}: AnimatedContainerProps) {
  const variants = variantMap[variant];
  const MotionComponent = motion[as as keyof typeof motion] as any;
  
  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className={className}
      transition={duration ? { duration, delay } : { delay }}
    >
      {children}
    </MotionComponent>
  );
}

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
}

export function AnimatedList({ children, className, itemClassName }: AnimatedListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={staggerItem}
          className={itemClassName}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface AnimatedPresenceWrapperProps {
  children: React.ReactNode;
  show: boolean;
  variant?: 'fadeInUp' | 'fadeIn' | 'scaleIn' | 'slideInRight' | 'slideInLeft';
  className?: string;
}

export function AnimatedPresenceWrapper({
  children,
  show,
  variant = 'fadeIn',
  className,
}: AnimatedPresenceWrapperProps) {
  const variants = variantMap[variant];
  
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hover animations for interactive elements
interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.05, className }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn('w-full', className)}
    >
      {children}
    </motion.div>
  );
}

// Skeleton loading animation
interface SkeletonPulseProps {
  className?: string;
}

export function SkeletonPulse({ className }: SkeletonPulseProps) {
  return (
    <motion.div
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={cn('bg-zinc-200 dark:bg-zinc-800 rounded', className)}
    />
  );
}

// Typing indicator animation
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 p-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -5, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
          className="w-2 h-2 bg-indigo-500 rounded-full"
        />
      ))}
    </div>
  );
}

// Success checkmark animation
export function SuccessCheck() {
  return (
    <motion.svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-emerald-500"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
      />
      <motion.path
        d="M8 12l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      />
    </motion.svg>
  );
}
