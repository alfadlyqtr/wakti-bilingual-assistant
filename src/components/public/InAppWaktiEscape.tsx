import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isInNativeApp } from '@/integrations/natively/browserBridge';

export default function InAppWaktiEscape({
  language,
  variant = 'default',
  containerClassName = 'max-w-4xl',
}: {
  language: 'en' | 'ar';
  variant?: 'default' | 'dark';
  containerClassName?: string;
}): React.ReactElement | null {
  const { user } = useAuth();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isInNativeApp());
  }, []);

  if (!isNative) return null;

  const wrapperClassName =
    variant === 'dark'
      ? 'sticky top-0 z-50 bg-black/20 backdrop-blur border-b border-white/10'
      : 'sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40';

  return (
    <div className={wrapperClassName}>
      <div className={`${containerClassName} mx-auto px-4 py-2 pt-[env(safe-area-inset-top,0px)]`}>
        <Link
          to={user ? '/dashboard' : '/home'}
          className="inline-flex items-center gap-2"
          aria-label={language === 'ar' ? 'العودة إلى وقتي' : 'Back to Wakti'}
        >
          <img
            src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
            alt="Wakti"
            className="h-8 w-8 shrink-0 rounded-lg"
          />
          <span className="text-sm font-semibold text-foreground">
            {language === 'ar' ? 'وقتي' : 'Wakti'}
          </span>
        </Link>
      </div>
    </div>
  );
}
