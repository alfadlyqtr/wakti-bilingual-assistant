import React, { forwardRef } from 'react';
import { motion, AnimatePresence, Variants, HTMLMotionProps, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// ANIMATION VARIANTS
// Reusable animation configurations for Framer Motion
// ============================================================================

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

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: { duration: 0.2 }
  }
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

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: 'spring',
      stiffness: 400,
      damping: 15
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
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

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(10px)' },
  visible: { 
    opacity: 1, 
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    filter: 'blur(10px)',
    transition: { duration: 0.3 }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02
    }
  }
};

// ============================================================================
// VARIANT MAP
// ============================================================================

const variantMap = {
  fadeInUp,
  fadeIn,
  fadeInDown,
  scaleIn,
  popIn,
  slideInRight,
  slideInLeft,
  blurIn,
};

type VariantName = keyof typeof variantMap;

// ============================================================================
// ANIMATED CONTAINER
// Base animation wrapper component
// ============================================================================

interface AnimatedContainerProps {
  children: React.ReactNode;
  variant?: VariantName;
  className?: string;
  delay?: number;
  duration?: number;
  as?: keyof JSX.IntrinsicElements;
  once?: boolean;
}

export function AnimatedContainer({
  children,
  variant = 'fadeInUp',
  className,
  delay = 0,
  duration,
  as = 'div',
  once = true,
}: AnimatedContainerProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = variantMap[variant];
  const MotionComponent = motion[as as keyof typeof motion] as any;
  
  if (shouldReduceMotion) {
    const Component = as;
    return <Component className={className}>{children}</Component>;
  }
  
  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className={className}
      transition={duration ? { duration, delay } : { delay }}
      viewport={once ? { once: true } : undefined}
    >
      {children}
    </MotionComponent>
  );
}

// ============================================================================
// ANIMATED LIST
// Staggered animation for list items
// ============================================================================

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  fast?: boolean;
}

export function AnimatedList({ children, className, itemClassName, fast = false }: AnimatedListProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return (
      <div className={className}>
        {children.map((child, index) => (
          <div key={index} className={itemClassName}>{child}</div>
        ))}
      </div>
    );
  }
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fast ? staggerFast : staggerContainer}
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

// ============================================================================
// ANIMATED PRESENCE WRAPPER
// Conditional rendering with animations
// ============================================================================

interface AnimatedPresenceWrapperProps {
  children: React.ReactNode;
  show: boolean;
  variant?: VariantName;
  className?: string;
  mode?: 'wait' | 'sync' | 'popLayout';
}

export function AnimatedPresenceWrapper({
  children,
  show,
  variant = 'fadeIn',
  className,
  mode = 'wait',
}: AnimatedPresenceWrapperProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = variantMap[variant];
  
  if (shouldReduceMotion) {
    return show ? <div className={className}>{children}</div> : null;
  }
  
  return (
    <AnimatePresence mode={mode}>
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

// ============================================================================
// HOVER SCALE
// Interactive hover scaling effect
// ============================================================================

interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  tapScale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.05, tapScale = 0.98, className }: HoverScaleProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// HOVER LIFT
// Card lift effect on hover
// ============================================================================

interface HoverLiftProps {
  children: React.ReactNode;
  className?: string;
  liftAmount?: number;
}

export function HoverLift({ children, className, liftAmount = 4 }: HoverLiftProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      whileHover={{ 
        y: -liftAmount,
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
      }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// PAGE TRANSITION
// Full page transition wrapper
// ============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <div className={cn('w-full', className)}>{children}</div>;
  }
  
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

// ============================================================================
// SKELETON PULSE
// Loading skeleton with pulse animation
// ============================================================================

interface SkeletonPulseProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full' | 'none';
}

export function SkeletonPulse({ className, rounded = 'md' }: SkeletonPulseProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
    none: '',
  }[rounded];
  
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
      className={cn('bg-muted', roundedClass, className)}
    />
  );
}

// ============================================================================
// TYPING INDICATOR
// Chat typing dots animation
// ============================================================================

interface TypingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function TypingIndicator({ size = 'md', color }: TypingIndicatorProps) {
  const sizeClass = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];
  
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
          className={cn(sizeClass, 'rounded-full', color || 'bg-primary')}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SUCCESS CHECK
// Animated success checkmark
// ============================================================================

interface SuccessCheckProps {
  size?: number;
  color?: string;
}

export function SuccessCheck({ size = 24, color }: SuccessCheckProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={color || 'text-emerald-500'}
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

// ============================================================================
// PULSE RING
// Notification/status pulse ring
// ============================================================================

interface PulseRingProps {
  size?: number;
  color?: string;
  className?: string;
}

export function PulseRing({ size = 12, color = 'bg-red-500', className }: PulseRingProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span 
        className={cn('rounded-full', color)}
        style={{ width: size, height: size }}
      />
      <motion.span
        className={cn('absolute inset-0 rounded-full', color)}
        animate={{
          scale: [1, 2],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </span>
  );
}

// ============================================================================
// FLOATING ELEMENT
// Subtle floating animation
// ============================================================================

interface FloatingProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  distance?: number;
}

export function Floating({ children, className, duration = 3, distance = 6 }: FloatingProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      animate={{
        y: [0, -distance, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// SHIMMER
// Loading shimmer effect
// ============================================================================

interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div 
      className={cn(
        'bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer',
        className
      )}
    />
  );
}

// ============================================================================
// RIPPLE BUTTON
// Button with ripple effect on click
// ============================================================================

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<{ x: number; y: number; id: number }[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      
      setRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
      
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        onClick={handleClick}
        {...props}
      >
        {children}
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              left: ripple.x - 10,
              top: ripple.y - 10,
              width: 20,
              height: 20,
            }}
          />
        ))}
      </button>
    );
  }
);

RippleButton.displayName = 'RippleButton';

// ============================================================================
// ANIMATED COUNTER
// Number counting animation
// ============================================================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 1, className }: AnimatedCounterProps) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }
    
    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      
      setDisplayValue(Math.round(startValue + difference * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration, shouldReduceMotion]);
  
  return <span className={className}>{displayValue}</span>;
}
