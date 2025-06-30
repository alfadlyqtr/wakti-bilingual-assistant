
import { useCallback, useRef } from 'react';

export function useDebounced<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        fn(...args);
        timeoutRef.current = null;
      }, delay);
    }) as T,
    [fn, delay]
  );
}
