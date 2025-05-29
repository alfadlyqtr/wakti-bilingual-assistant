
import React from 'react';
import { CheckCircle, Globe, Search, AlertCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface BrowsingIndicatorProps {
  browsingUsed?: boolean;
  quotaStatus?: {
    count: number;
    limit: number;
    usagePercentage: number;
    remaining: number;
  };
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrowsingIndicator({ 
  browsingUsed, 
  quotaStatus, 
  sources = [], 
  imageUrl,
  size = 'sm' 
}: BrowsingIndicatorProps) {
  const { language } = useTheme();

  if (!browsingUsed && !quotaStatus) return null;

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-2', 
    lg: 'text-base gap-3'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className="space-y-2">
      {/* Browsing Status */}
      {browsingUsed && (
        <div className={cn(
          "flex items-center text-muted-foreground",
          sizeClasses[size]
        )}>
          <CheckCircle className={cn("text-green-500", iconSizes[size])} />
          <span>
            {language === 'ar' ? 'تم البحث بـ Tavily' : 'Tavily searched'}
          </span>
          {imageUrl && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-blue-500">
                {language === 'ar' ? 'صورة متضمنة' : 'Image included'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Quota Status */}
      {quotaStatus && (
        <div className={cn(
          "flex items-center",
          sizeClasses[size]
        )}>
          <Globe className={cn(iconSizes[size])} />
          <span className="text-muted-foreground">
            {language === 'ar' ? 'الحصة:' : 'Quota:'}
          </span>
          <span className={cn(
            "font-medium",
            quotaStatus.usagePercentage >= 80 ? "text-orange-600" : 
            quotaStatus.usagePercentage >= 65 ? "text-yellow-600" : "text-green-600"
          )}>
            {quotaStatus.count}/{quotaStatus.limit}
          </span>
          <span className="text-muted-foreground">
            ({quotaStatus.usagePercentage}%)
          </span>
          
          {quotaStatus.usagePercentage >= 80 && (
            <AlertCircle className={cn("text-orange-500", iconSizes[size])} />
          )}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="space-y-1">
          <div className={cn(
            "text-muted-foreground font-medium",
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          )}>
            {language === 'ar' ? 'المصادر:' : 'Sources:'}
          </div>
          <div className="space-y-1">
            {sources.slice(0, 3).map((source, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-muted-foreground text-xs">•</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-xs truncate flex-1"
                  title={source.title}
                >
                  {source.title}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Result Image */}
      {imageUrl && (
        <div className="mt-2">
          <img
            src={imageUrl}
            alt="Search result"
            className="max-w-sm rounded-lg border shadow-sm"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}
