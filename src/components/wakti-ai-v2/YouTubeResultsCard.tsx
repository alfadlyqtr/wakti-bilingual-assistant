import React, { useRef, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { YouTubePreview } from './YouTubePreview';
import { useTheme } from '@/providers/ThemeProvider';

const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const YT_ICON = (
  <svg className="h-4 w-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface YouTubeResult {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt?: string;
}

interface YouTubeResultsCardProps {
  results: YouTubeResult[];
}

export const YouTubeResultsCard: React.FC<YouTubeResultsCardProps> = ({ results }) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const { language } = useTheme();
  const playerRef = useRef<HTMLDivElement>(null);

  if (!results || results.length === 0) return null;

  const capped = results.slice(0, 10);
  const selectedVideo = capped.find(r => r.videoId === selectedVideoId);

  const handleCardClick = (result: YouTubeResult) => {
    if (isLocalhost) {
      window.open(`https://www.youtube.com/watch?v=${result.videoId}`, '_blank', 'noopener');
      return;
    }
    const isSame = selectedVideoId === result.videoId;
    setSelectedVideoId(isSame ? null : result.videoId);
    if (!isSame) {
      setTimeout(() => {
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400">
        {YT_ICON}
        {language === 'ar' ? 'نتائج يوتيوب' : 'YouTube Results'}
        <span className="ml-1 text-[11px] text-muted-foreground font-normal">
          ({capped.length})
        </span>
        {isLocalhost && (
          <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {language === 'ar' ? 'يفتح في يوتيوب' : 'Opens on YouTube'}
          </span>
        )}
      </div>

      {/* Player — production only, shown when a video is selected */}
      {!isLocalhost && selectedVideo && (
        <div
          ref={playerRef}
          className="rounded-xl overflow-hidden border border-red-300/50 dark:border-red-800/40 bg-black/5 dark:bg-black/20"
        >
          <YouTubePreview
            videoId={selectedVideo.videoId}
            title={selectedVideo.title}
            description={selectedVideo.description}
            thumbnail={selectedVideo.thumbnail}
          />
        </div>
      )}

      {/* Results list */}
      <div className="space-y-2">
        {capped.map((result, index) => {
          const isSelected = result.videoId === selectedVideoId;
          return (
            <button
              key={result.videoId}
              onClick={() => handleCardClick(result)}
              className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all duration-200 active:scale-[0.98] group
                ${isSelected
                  ? 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-600'
                  : 'border-border/50 bg-background/60 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20'
                }`}
            >
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 w-24 h-[54px] rounded-lg overflow-hidden bg-black/10">
                {result.thumbnail ? (
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-950/40">
                    {YT_ICON}
                  </div>
                )}
                {/* Play overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200
                  ${isSelected ? 'bg-red-600/60 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
                {/* Number badge */}
                <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug line-clamp-2 transition-colors
                  ${isSelected ? 'text-red-700 dark:text-red-300' : 'text-foreground group-hover:text-red-600 dark:group-hover:text-red-400'}`}>
                  {result.title || (language === 'ar' ? 'بدون عنوان' : 'Untitled')}
                </p>
                {result.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {result.description}
                  </p>
                )}
                {isSelected && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-red-500 dark:text-red-400">
                    <Play className="h-2.5 w-2.5 fill-current" />
                    {language === 'ar' ? 'يتم التشغيل' : 'Now playing'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default YouTubeResultsCard;
