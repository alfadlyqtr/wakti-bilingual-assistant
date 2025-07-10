
import React from 'react';
import { Play, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface VideoPreviewProps {
  videoUrl: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUrl }) => {
  const handleDownload = async () => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-generated-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Video downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download video');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my AI-generated video!',
          text: 'Created with Wakti AI Video Generator',
          url: videoUrl,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copying URL
      await navigator.clipboard.writeText(videoUrl);
      toast.success('Video URL copied to clipboard!');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
        <Play className="w-5 h-5 text-green-500" />
        Generated Video
      </h3>
      
      <div className="bg-muted rounded-lg overflow-hidden">
        <video
          src={videoUrl}
          controls
          className="w-full aspect-video"
          poster="/placeholder-video-poster.jpg"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
};
