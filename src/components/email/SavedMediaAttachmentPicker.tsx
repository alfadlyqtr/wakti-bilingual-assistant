import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ImageIcon, Music, Video, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SavedMediaSelection = {
  id: string;
  kind: 'image' | 'video' | 'audio';
  title: string;
  url: string;
  contentType?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
};

interface SavedMediaAttachmentPickerProps {
  onClose: () => void;
  onSelect: (item: SavedMediaSelection) => Promise<void>;
}

export function SavedMediaAttachmentPicker({ onClose, onSelect }: SavedMediaAttachmentPickerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'music'>('images');
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [images, setImages] = useState<SavedMediaSelection[]>([]);
  const [videos, setVideos] = useState<SavedMediaSelection[]>([]);
  const [tracks, setTracks] = useState<SavedMediaSelection[]>([]);

  const loadSavedMedia = useCallback(async () => {
    if (!user?.id) {
      setImages([]);
      setVideos([]);
      setTracks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [imagesRes, videosRes, aiVideosRes, tracksRes] = await Promise.all([
        (supabase as any)
          .from('user_generated_images')
          .select('id, image_url, prompt, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
        (supabase as any)
          .from('user_videos')
          .select('id, title, thumbnail_url, storage_path, video_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
        (supabase as any)
          .from('user_ai_videos')
          .select('id, title, video_url, source_image_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
        (supabase as any)
          .from('user_music_tracks')
          .select('id, title, prompt, storage_path, signed_url, source_audio_url, mime, meta, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
      ]);

      if (imagesRes.error) throw imagesRes.error;
      if (videosRes.error) throw videosRes.error;
      if (aiVideosRes.error) throw aiVideosRes.error;
      if (tracksRes.error) throw tracksRes.error;

      const nextImages: SavedMediaSelection[] = (imagesRes.data || []).map((item: any) => ({
        id: item.id,
        kind: 'image',
        title: item.prompt || 'Saved image',
        url: item.image_url,
        contentType: null,
        thumbnailUrl: item.image_url,
        createdAt: item.created_at,
      })).filter((item) => !!item.url);

      const userVideos = await Promise.all((videosRes.data || []).map(async (item: any) => {
        let resolvedUrl: string | null = null;
        if (item.storage_path) {
          const signed = await supabase.storage.from('videos').createSignedUrl(item.storage_path, 3600);
          resolvedUrl = signed.data?.signedUrl || null;
          if (!resolvedUrl) {
            const pub = supabase.storage.from('videos').getPublicUrl(item.storage_path);
            resolvedUrl = pub.data?.publicUrl || null;
          }
        }
        if (!resolvedUrl && item.video_url) {
          resolvedUrl = item.video_url;
        }
        return resolvedUrl ? {
          id: item.id,
          kind: 'video' as const,
          title: item.title || 'Saved video',
          url: resolvedUrl,
          contentType: 'video/mp4',
          thumbnailUrl: item.thumbnail_url || null,
          createdAt: item.created_at,
        } : null;
      }));

      const aiVideos: SavedMediaSelection[] = (aiVideosRes.data || []).map((item: any) => ({
        id: item.id,
        kind: 'video',
        title: item.title || 'Saved video',
        url: item.video_url,
        contentType: 'video/mp4',
        thumbnailUrl: item.source_image_url || null,
        createdAt: item.created_at,
      })).filter((item) => !!item.url);

      const nextTracks: SavedMediaSelection[] = (tracksRes.data || [])
        .filter((item: any) => {
          const status = item.meta?.status;
          const saved = item.meta?.saved;
          if (status === 'generating' || status === 'failed') return false;
          if (saved === false) return false;
          if (item.storage_path?.includes('_pending.mp3')) return false;
          return Boolean(item.storage_path || item.signed_url || item.source_audio_url);
        })
        .map((item: any) => {
          let resolvedUrl: string | null = null;
          if (item.storage_path) {
            const pub = supabase.storage.from('music').getPublicUrl(item.storage_path);
            resolvedUrl = pub.data?.publicUrl || null;
          }
          if (!resolvedUrl && item.signed_url) {
            resolvedUrl = item.signed_url;
          }
          if (!resolvedUrl && item.source_audio_url) {
            resolvedUrl = item.source_audio_url;
          }
          return resolvedUrl ? {
            id: item.id,
            kind: 'audio' as const,
            title: item.title || item.prompt || 'Saved track',
            url: resolvedUrl,
            contentType: item.mime || 'audio/mpeg',
            thumbnailUrl: null,
            createdAt: item.created_at,
          } : null;
        })
        .filter(Boolean) as SavedMediaSelection[];

      setImages(nextImages);
      setVideos([...userVideos.filter(Boolean) as SavedMediaSelection[], ...aiVideos]);
      setTracks(nextTracks);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadSavedMedia();
  }, [loadSavedMedia]);

  const activeItems = useMemo(() => {
    if (activeTab === 'images') return images;
    if (activeTab === 'videos') return videos;
    return tracks;
  }, [activeTab, images, tracks, videos]);

  const handleSelect = useCallback(async (item: SavedMediaSelection) => {
    setSelectingId(item.id);
    try {
      await onSelect(item);
      onClose();
    } finally {
      setSelectingId(null);
    }
  }, [onClose, onSelect]);

  const tabClass = (active: boolean) => active
    ? 'bg-[#060541] text-white shadow-[0_8px_20px_rgba(6,5,65,0.18)]'
    : 'bg-white text-[#060541]/70 hover:bg-[#f7f8ff]';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[22px] border border-[#060541]/12 bg-white text-[#060541] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#060541]/10 px-4 py-3 sm:px-5">
          <div>
            <div className="text-base font-semibold">Attach from Wakti Saved</div>
            <div className="mt-1 text-xs text-[#060541]/60">Pick from your saved images, videos, or music.</div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-xl p-2 text-[#060541]/55 transition-colors hover:bg-[#f4f6ff] hover:text-[#060541]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[#060541]/10 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveTab('images')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${tabClass(activeTab === 'images')}`}>
              <ImageIcon className="h-4 w-4" />
              Images
            </button>
            <button type="button" onClick={() => setActiveTab('videos')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${tabClass(activeTab === 'videos')}`}>
              <Video className="h-4 w-4" />
              Videos
            </button>
            <button type="button" onClick={() => setActiveTab('music')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${tabClass(activeTab === 'music')}`}>
              <Music className="h-4 w-4" />
              Music
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#060541]/70">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !user ? (
            <div className="rounded-2xl border border-[#060541]/10 bg-[#fbfbff] px-4 py-10 text-center text-sm text-[#060541]/65">
              Sign in to use Wakti Saved attachments.
            </div>
          ) : activeItems.length === 0 ? (
            <div className="rounded-2xl border border-[#060541]/10 bg-[#fbfbff] px-4 py-10 text-center text-sm text-[#060541]/65">
              No saved items found in this tab yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeItems.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => void handleSelect(item)}
                  disabled={selectingId === item.id}
                  className="overflow-hidden rounded-2xl border border-[#060541]/10 bg-[#fbfbff] text-left transition-all hover:border-[#060541]/20 hover:bg-white disabled:opacity-60"
                >
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#eef2ff]">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : item.kind === 'audio' ? (
                      <Music className="h-8 w-8 text-[#060541]/55" />
                    ) : item.kind === 'video' ? (
                      <Video className="h-8 w-8 text-[#060541]/55" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-[#060541]/55" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="line-clamp-2 min-h-[40px] text-sm font-medium text-[#060541]">{item.title}</div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#060541]/60">
                      <span className="uppercase">{item.kind}</span>
                      <span>{selectingId === item.id ? 'Adding...' : 'Attach'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
