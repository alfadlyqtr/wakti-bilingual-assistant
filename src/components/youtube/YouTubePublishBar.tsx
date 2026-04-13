import React, { useState } from 'react';
import { Loader2, Youtube, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useYouTubeConnection } from '@/hooks/useYouTubeConnection';

type Props = {
  fileUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  isShort?: boolean;
  language?: string;
};

export default function YouTubePublishBar({
  fileUrl,
  title,
  description = '',
  tags = [],
  isShort = false,
  language = 'en',
}: Props) {
  const isAr = language === 'ar';
  const { connection, connectYouTube, uploadToYouTube } = useYouTubeConnection();
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [ytUrl, setYtUrl] = useState<string | null>(null);

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!connection.connected) {
      await connectYouTube();
      return;
    }
    if (uploadState === 'done' && ytUrl) {
      window.open(ytUrl, '_blank');
      return;
    }
    if (uploadState === 'uploading') return;

    setUploadState('uploading');
    try {
      const result = await uploadToYouTube({
        fileUrl,
        title,
        description,
        tags,
        privacy: 'public',
        isShort,
      });
      setYtUrl(result.videoUrl);
      setUploadState('done');
      toast.success(isAr ? 'تم النشر على يوتيوب!' : 'Published to YouTube!');
    } catch (err: unknown) {
      setUploadState('error');
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    }
  };

  if (connection.loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs text-muted-foreground/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        {isAr ? 'جاري التحقق...' : 'Checking YouTube...'}
      </div>
    );
  }

  if (uploadState === 'done' && ytUrl) {
    return (
      <button
        type="button"
        onClick={() => window.open(ytUrl, '_blank')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-400/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
      >
        <CheckCircle2 className="h-3 w-3" />
        {isAr ? 'تم النشر على يوتيوب' : 'Published to YouTube'}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </button>
    );
  }

  if (uploadState === 'uploading') {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-400/20 bg-red-500/10 text-red-400 opacity-70">
        <Loader2 className="h-3 w-3 animate-spin" />
        {isAr ? 'جاري الرفع إلى يوتيوب...' : 'Uploading to YouTube...'}
      </div>
    );
  }

  if (connection.connecting) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-400/20 bg-red-500/10 text-red-400 opacity-70">
        <Loader2 className="h-3 w-3 animate-spin" />
        {isAr ? 'جاري الفتح...' : 'Opening...'}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePublish}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-400/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
    >
      <Youtube className="h-3 w-3" />
      {!connection.connected
        ? (isAr ? 'ربط يوتيوب' : 'Connect YouTube')
        : (isAr ? 'نشر على يوتيوب' : 'Publish to YouTube')}
    </button>
  );
}
