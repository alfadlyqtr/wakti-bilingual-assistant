
import { useEffect, useRef, useState } from 'react';

interface UseAutoScrollProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  containerRef: React.RefObject<HTMLElement>;
  language?: string; // Add language prop for speed adjustment
}

export const useAutoScroll = ({ isPlaying, currentTime, duration, containerRef, language }: UseAutoScrollProps) => {
  const [isAutoScrollActive, setIsAutoScrollActive] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const lastScrollTimeRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();

  // Calculate scroll position based on audio progress
  const calculateScrollPosition = (time: number, totalDuration: number) => {
    if (!containerRef.current || totalDuration === 0) return 0;
    
    const container = containerRef.current;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    let progress = time / totalDuration;
    
    // Slow down Arabic scrolling by 15%
    if (language === 'ar') {
      progress = progress * 0.85;
    }
    
    return Math.min(maxScrollTop * progress, maxScrollTop);
  };

  // Smooth scroll animation
  const smoothScrollTo = (targetPosition: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const startPosition = container.scrollTop;
    const distance = targetPosition - startPosition;
    const startTime = performance.now();
    const duration = 100; // Animation duration in ms

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      container.scrollTop = startPosition + (distance * easeOut);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Handle user scroll detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleUserScroll = () => {
      const now = Date.now();
      lastScrollTimeRef.current = now;
      
      if (!userHasScrolled) {
        setUserHasScrolled(true);
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Reset user scroll flag after 3 seconds of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setUserHasScrolled(false);
      }, 3000);
    };

    container.addEventListener('scroll', handleUserScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleUserScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (!isPlaying || userHasScrolled || duration === 0) {
      setIsAutoScrollActive(false);
      return;
    }

    setIsAutoScrollActive(true);
    const targetPosition = calculateScrollPosition(currentTime, duration);
    smoothScrollTo(targetPosition);
  }, [isPlaying, currentTime, duration, userHasScrolled, language]);

  // Reset user scroll flag when audio starts
  useEffect(() => {
    if (isPlaying && currentTime === 0) {
      setUserHasScrolled(false);
    }
  }, [isPlaying, currentTime]);

  return {
    isAutoScrollActive: isAutoScrollActive && !userHasScrolled,
    userHasScrolled
  };
};
