import React, { useEffect, useState } from 'react';
import { Code2, Scissors, CircleUser, Calendar, Clock, Stars, Sparkles } from 'lucide-react';

interface SandpackSkeletonProps {
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isRTL?: boolean;
}

export function SandpackSkeleton({ 
  isLoading = true, 
  isError = false, 
  errorMessage,
  isRTL = false 
}: SandpackSkeletonProps) {
  // Show enhanced loading with slideshow instead of error
  if (isError || isLoading) {
    return <EnhancedProjectLoader isRTL={isRTL} />;
  }
  
  // Waiting state (no files yet)
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Code2 className="w-6 h-6 text-white animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-400 animate-pulse">
        {isRTL ? 'في انتظار الكود...' : 'Waiting for code...'}
      </p>
    </div>
  );
}

interface SlideInfo {
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  icon: React.ReactNode;
  bgClass: string;
}

function EnhancedProjectLoader({ isRTL = false }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progressBar, setProgressBar] = useState(0);
  
  // Define slideshow content for barber shop/general website building
  const slides: SlideInfo[] = [
    {
      title: 'Creating your pages',
      titleAr: 'إنشاء صفحاتك',
      description: 'Building responsive home, services, and contact pages',
      descriptionAr: 'بناء صفحات رئيسية وخدمات واتصال متجاوبة',
      icon: <Code2 className="w-6 h-6 text-white" />,
      bgClass: 'from-indigo-600 to-purple-600'
    },
    {
      title: 'Styling your website',
      titleAr: 'تصميم موقعك',
      description: 'Applying modern styles with seamless animations',
      descriptionAr: 'تطبيق أنماط حديثة مع رسوم متحركة سلسة',
      icon: <Stars className="w-6 h-6 text-white" />,
      bgClass: 'from-amber-500 to-orange-600'
    },
    {
      title: 'Setting up services',
      titleAr: 'إعداد الخدمات',
      description: 'Creating your services menu with pricing options',
      descriptionAr: 'إنشاء قائمة الخدمات الخاصة بك مع خيارات التسعير',
      icon: <Scissors className="w-6 h-6 text-white" />,
      bgClass: 'from-blue-600 to-cyan-500'
    },
    {
      title: 'Building booking system',
      titleAr: 'بناء نظام الحجز',
      description: 'Setting up appointment scheduling with backend',
      descriptionAr: 'إعداد جدولة المواعيد مع الخادم الخلفي',
      icon: <Calendar className="w-6 h-6 text-white" />,
      bgClass: 'from-green-600 to-emerald-500'
    },
    {
      title: 'Finalizing your project',
      titleAr: 'وضع اللمسات الأخيرة',
      description: 'Connecting everything and optimizing performance',
      descriptionAr: 'توصيل كل شيء وتحسين الأداء',
      icon: <Sparkles className="w-6 h-6 text-white" />,
      bgClass: 'from-purple-600 to-pink-500'
    },
  ];
  
  // Cycle through slides every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    
    // Progress bar animation (0-100% over 4 seconds)
    const progressInterval = setInterval(() => {
      setProgressBar((prev) => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 40); // 40ms * 100 = 4000ms (4 seconds)
    
    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [slides.length]);
  
  const currentInfo = slides[currentSlide];
  
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      {/* Main content area */}
      <div className="w-full max-w-md mx-auto px-4">
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-8 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-linear" 
            style={{ width: `${progressBar}%` }}
          />
        </div>
        
        {/* Current slide icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentInfo.bgClass} flex items-center justify-center shadow-lg shadow-indigo-500/30`}>
            {currentInfo.icon}
          </div>
        </div>
        
        {/* Slide title and description */}
        <h3 className="text-center text-lg font-medium text-white mb-2">
          {isRTL ? currentInfo.titleAr : currentInfo.title}
        </h3>
        <p className="text-center text-sm text-gray-400 mb-8">
          {isRTL ? currentInfo.descriptionAr : currentInfo.description}
        </p>
        
        {/* Status indicators */}
        <div className="flex justify-center space-x-1.5 mb-4">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'bg-indigo-500 scale-125' : 'bg-gray-700'}`} 
            />
          ))}
        </div>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          {isRTL ? 'قد يستغرق هذا حتى 3 دقائق' : 'This may take up to 3 minutes'}
        </p>
      </div>
    </div>
  );
}

  // Waiting state (no files yet)
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Code2 className="w-6 h-6 text-white animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-400 animate-pulse">
        {isRTL ? 'في انتظار الكود...' : 'Waiting for code...'}
      </p>
    </div>
  );
}

/**
 * Skeleton loader for the preview panel during Sandpack initialization
 */
export function SandpackPreviewSkeleton({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col p-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-zinc-800/50 rounded-lg mb-4" />
      
      {/* Content skeleton */}
      <div className="flex-1 flex gap-4">
        {/* Sidebar skeleton */}
        <div className="w-1/4 space-y-3">
          <div className="h-8 bg-zinc-800/50 rounded" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-3/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 bg-zinc-800/30 rounded-lg p-4">
          <div className="h-6 bg-zinc-700/50 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-700/30 rounded w-full mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-5/6 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-4/6 mb-4" />
          
          <div className="h-32 bg-zinc-700/20 rounded mb-4" />
          
          <div className="h-4 bg-zinc-700/30 rounded w-2/3 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-1/2" />
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
        <span className="text-xs text-zinc-500">
          {isRTL ? 'جارٍ تهيئة المعاينة...' : 'Initializing preview...'}
        </span>
      </div>
    </div>
  );
}
