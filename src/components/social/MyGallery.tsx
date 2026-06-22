import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ImageIcon, Lock, Users, Eye, Download, Trash2,
  X, Loader2, Sparkles, Heart, MessageCircle, ChevronDown, ChevronUp, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface GalleryImage {
  id: string;
  image_url: string;
  prompt: string | null;
  submode: string;
  created_at: string;
  visibility: 'private' | 'contacts';
  is_profile_visible: boolean;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  meta?: any;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null };
}

const COMMENTS_PAGE_SIZE = 15;

function formatPostDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const postDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - postDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return lang === 'ar' ? 'اليوم' : 'Today';
  if (diffDays === 1) return lang === 'ar' ? 'أمس' : 'Yesterday';

  if (diffDays < 7) {
    if (lang === 'ar') {
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  if (lang === 'ar') {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = (() => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  })();
  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
}

export function MyGallery() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { language, theme } = useTheme();
  const isDark = theme === 'dark';

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [latestComments, setLatestComments] = useState<Record<string, Comment>>({});
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: imgs, error } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url, prompt, submode, created_at, visibility, is_profile_visible, meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch likes + comments counts + liked_by_me
      const ids = (imgs || []).map((i: any) => i.id);
      let likesMap: Record<string, number> = {};
      let commentsMap: Record<string, number> = {};
      let likedSet = new Set<string>();

      let latestMap: Record<string, Comment> = {};
      if (ids.length > 0) {
        const [{ data: likes }, { data: myLikes }, { data: cmts }, { data: latestCmts }] = await Promise.all([
          supabase.from('post_likes' as any).select('post_id').in('post_id', ids),
          supabase.from('post_likes' as any).select('post_id').in('post_id', ids).eq('user_id', user.id),
          supabase.from('post_comments' as any).select('post_id').in('post_id', ids),
          supabase.from('post_comments' as any)
            .select('id, content, created_at, user_id, post_id, profiles:user_id(display_name, username, avatar_url)')
            .in('post_id', ids)
            .order('created_at', { ascending: false }),
        ]);
        (likes || []).forEach((l: any) => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
        (myLikes || []).forEach((l: any) => likedSet.add(l.post_id));
        (cmts || []).forEach((c: any) => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
        (latestCmts || []).forEach((c: any) => {
          if (!latestMap[c.post_id]) latestMap[c.post_id] = c;
        });
      }
      setLatestComments(latestMap);

      setImages((imgs || []).map((img: any) => ({
        ...img,
        like_count: likesMap[img.id] || 0,
        comment_count: commentsMap[img.id] || 0,
        liked_by_me: likedSet.has(img.id),
      })));
    } catch (err: any) {
      toast.error(language === 'ar' ? 'فشل تحميل الصور' : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [user?.id, language]);

  useEffect(() => { load(); }, [load]);

  const CAPTION_LIMIT = 100;
  const COMMENT_LIMIT = 80;
  const MORE_LABEL = language === 'ar' ? 'المزيد' : 'more';
  const LESS_LABEL = language === 'ar' ? 'أقل' : 'less';

  const toggleCaption = (id: string) => {
    setExpandedCaptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePublicPrivate = async (img: GalleryImage) => {
    setTogglingId(img.id);
    const isPrivate = img.visibility === 'private';
    const newVis: 'private' | 'contacts' = isPrivate ? 'contacts' : 'private';
    const newProfile = isPrivate ? true : false;
    try {
      const { error } = await (supabase as any)
        .from('user_generated_images')
        .update({ visibility: newVis, is_profile_visible: newProfile })
        .eq('id', img.id);
      if (error) throw error;
      setImages(prev => prev.map(i => i.id === img.id
        ? { ...i, visibility: newVis, is_profile_visible: newProfile } : i));
      if (lightbox?.id === img.id) setLightbox(lb => lb ? { ...lb, visibility: newVis, is_profile_visible: newProfile } : lb);
      toast.success(isPrivate
        ? (language === 'ar' ? 'أصبحت الصورة عامة' : 'Image is now public')
        : (language === 'ar' ? 'أصبحت الصورة خاصة' : 'Image is now private')
      );
    } catch {
      toast.error('Failed to update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (img: GalleryImage) => {
    setDeletingId(img.id);
    try {
      const { error } = await (supabase as any).from('user_generated_images').delete().eq('id', img.id);
      if (error) throw error;
      if (img.image_url?.includes('/generated-images/')) {
        const pathMatch = img.image_url.split('/generated-images/')[1];
        if (pathMatch) await supabase.storage.from('generated-images').remove([decodeURIComponent(pathMatch)]);
      }
      setImages(prev => prev.filter(i => i.id !== img.id));
      if (lightbox?.id === img.id) setLightbox(null);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wakti-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { window.open(url, '_blank'); }
  };

  const toggleLike = async (img: GalleryImage) => {
    if (!user?.id) return;
    const optimistic = !img.liked_by_me;
    setImages(prev => prev.map(i => i.id === img.id
      ? { ...i, liked_by_me: optimistic, like_count: i.like_count + (optimistic ? 1 : -1) } : i));
    if (lightbox?.id === img.id)
      setLightbox(lb => lb ? { ...lb, liked_by_me: optimistic, like_count: lb.like_count + (optimistic ? 1 : -1) } : lb);
    try {
      if (optimistic) {
        await supabase.from('post_likes' as any).insert({ post_id: img.id, user_id: user.id });
      } else {
        await supabase.from('post_likes' as any).delete().eq('post_id', img.id).eq('user_id', user.id);
      }
    } catch {
      // revert
      setImages(prev => prev.map(i => i.id === img.id
        ? { ...i, liked_by_me: !optimistic, like_count: i.like_count + (optimistic ? -1 : 1) } : i));
    }
  };

  const loadComments = async (postId: string, reset = false) => {
    setCommentsLoading(true);
    try {
      const from = reset ? 0 : commentsOffset;
      const to = from + COMMENTS_PAGE_SIZE - 1;
      const { data, error } = await (supabase as any)
        .from('post_comments')
        .select('id, content, created_at, user_id, profiles:user_id(display_name, username, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .range(from, to);
      if (error) throw error;
      const nextComments = data || [];
      setComments(prev => reset ? nextComments : [...prev, ...nextComments]);
      setCommentsOffset(from + nextComments.length);
      setHasMoreComments(nextComments.length === COMMENTS_PAGE_SIZE);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const openLightbox = (img: GalleryImage) => {
    setLightbox(img);
    setCommentsOpen(true);
    setComments([]);
    setCommentsOffset(0);
    setHasMoreComments(false);
    setReplyTarget(null);
    setNewComment('');
    loadComments(img.id, true);
  };

  const handleCommentsToggle = () => {
    if (!lightbox) return;
    if (!commentsOpen) {
      setCommentsOpen(true);
      loadComments(lightbox.id, comments.length === 0);
    } else {
      setCommentsOpen(false);
    }
  };

  const handleReplyToComment = (comment: Comment) => {
    const replyName = comment.profiles?.username || comment.profiles?.display_name || 'user';
    const mention = `@${replyName} `;
    setReplyTarget(replyName);
    setNewComment(prev => prev.startsWith(mention) ? prev : `${mention}${prev}`.trimStart());
  };

  const handleLoadMoreComments = () => {
    if (!lightbox || commentsLoading || !hasMoreComments) return;
    loadComments(lightbox.id, false);
  };

  const submitComment = async () => {
    if (!lightbox || !user?.id || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const { data, error } = await (supabase as any)
        .from('post_comments')
        .insert({ post_id: lightbox.id, user_id: user.id, content: newComment.trim() })
        .select('id, content, created_at, user_id, profiles:user_id(display_name, username, avatar_url)')
        .single();
      if (error) throw error;
      setComments(prev => [...prev, data]);
      setCommentsOffset(prev => prev + 1);
      setImages(prev => prev.map(i => i.id === lightbox.id ? { ...i, comment_count: i.comment_count + 1 } : i));
      setLightbox(lb => lb ? { ...lb, comment_count: lb.comment_count + 1 } : lb);
      setReplyTarget(null);
      setNewComment('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  // ── Empty ──
  if (images.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
        <Sparkles className="h-8 w-8 text-orange-500/50" />
      </div>
      <p className="font-semibold text-base">{language === 'ar' ? 'لا توجد صور بعد' : 'No images yet'}</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        {language === 'ar' ? 'أنشئ صوراً في الاستوديو وستظهر هنا' : 'Generate images in Studio and they\'ll appear here'}
      </p>
    </div>
  );

  // ── Feed ──
  return (
    <>
      <div className="flex flex-col gap-8 w-full max-w-[470px] mx-auto">
        {images.map(img => (
          <div key={img.id} className="flex flex-col">
            {/* Post header */}
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={img.meta?.shared_received ? img.meta?.sender_avatar_url || '' : profile?.avatar_url || ''} />
                  <AvatarFallback className="text-[10px] bg-white/10 text-white">
                    {(img.meta?.shared_received
                      ? (img.meta?.sender_name || img.meta?.sender_username || '?')
                      : (profile?.display_name || profile?.username || '?')
                    ).substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {img.meta?.shared_received
                    ? (img.meta?.sender_name || img.meta?.sender_username || 'User')
                    : (profile?.display_name || profile?.username || (language === 'ar' ? 'أنت' : 'You'))}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {formatPostDate(img.created_at, language)}
              </p>
            </div>

            {/* Image */}
            <div
              className={`relative w-full aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer border active:scale-[0.98] transition-transform ${
                isDark ? 'border-white/10' : 'border-black/5'
              }`}
              onClick={() => openLightbox(img)}
            >
              <img
                src={img.image_url}
                alt={img.prompt || 'Generated image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Visibility badge */}
              <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white backdrop-blur-sm ${
                img.visibility === 'contacts' ? 'bg-blue-500/80' : 'bg-black/50'
              }`}>
                {img.visibility === 'contacts'
                  ? <><Eye className="w-2.5 h-2.5" />{language === 'ar' ? 'عام' : 'Public'}</>
                  : <><Lock className="w-2.5 h-2.5" />{language === 'ar' ? 'خاص' : 'Private'}</>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-start gap-4 pt-2.5 pb-1">
              <div className="flex flex-col items-start">
                <button
                  aria-label="Like"
                  onClick={() => toggleLike(img)}
                  className="active:scale-90 transition-transform"
                >
                  <Heart className={`w-6 h-6 transition-colors ${img.liked_by_me ? 'fill-red-500 text-red-500' : isDark ? 'text-white' : 'text-gray-800'}`} />
                </button>
                {img.like_count > 0 && (
                  <p className={`mt-0.5 text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {img.like_count} {language === 'ar' ? (img.like_count === 1 ? 'إعجاب' : 'إعجاب') : (img.like_count === 1 ? 'like' : 'likes')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center">
                <button
                  aria-label="Comments"
                  onClick={() => openLightbox(img)}
                  className="active:scale-90 transition-transform"
                >
                  <MessageCircle className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-800'}`} />
                </button>
                {img.comment_count > 0 && (
                  <p className={`mt-0.5 text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {img.comment_count}
                  </p>
                )}
              </div>
            </div>

            {/* Caption */}
            {img.prompt && (
              <p className={`pt-1 text-sm text-start ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                {expandedCaptions.has(img.id) ? img.prompt : (
                  img.prompt.length > CAPTION_LIMIT ? `${img.prompt.slice(0, CAPTION_LIMIT)}...` : img.prompt
                )}
                {img.prompt.length > CAPTION_LIMIT && (
                  <button
                    onClick={() => toggleCaption(img.id)}
                    className="ms-1 text-sm text-muted-foreground active:scale-95 transition-transform"
                  >
                    {expandedCaptions.has(img.id) ? LESS_LABEL : MORE_LABEL}
                  </button>
                )}
              </p>
            )}

            {/* Latest comment */}
            {latestComments[img.id] && (
              <p className="pt-1 text-sm text-start">
                <span className={`font-semibold me-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {latestComments[img.id].profiles?.display_name || latestComments[img.id].profiles?.username || 'User'}
                </span>
                <span className={isDark ? 'text-white/50' : 'text-gray-500'}>
                  {latestComments[img.id].content.length > COMMENT_LIMIT
                    ? `${latestComments[img.id].content.slice(0, COMMENT_LIMIT)}...`
                    : latestComments[img.id].content}
                </span>
              </p>
            )}

            {/* View all comments */}
            {img.comment_count > 0 && (
              <button
                onClick={() => openLightbox(img)}
                className="pt-1 text-sm text-start text-muted-foreground active:scale-95 transition-transform"
              >
                {language === 'ar'
                  ? `عرض جميع التعليقات (${img.comment_count})`
                  : `View ${img.comment_count === 1 ? '1 comment' : `all ${img.comment_count} comments`}`}
              </button>
            )}

          </div>
        ))}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <button aria-label="Close" onClick={() => setLightbox(null)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
              <X className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <button
                disabled={!!togglingId}
                onClick={() => togglePublicPrivate(lightbox)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  lightbox.visibility === 'private'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {lightbox.visibility === 'private'
                  ? <><Lock className="w-3 h-3" />{language === 'ar' ? 'خاص' : 'Private'}</>
                  : <><Eye className="w-3 h-3" />{language === 'ar' ? 'عام' : 'Public'}</>}
              </button>
              <button aria-label="Download" onClick={() => handleDownload(lightbox.image_url)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                <Download className="w-4 h-4 text-white/70" />
              </button>
              <button
                disabled={deletingId === lightbox.id}
                onClick={() => handleDelete(lightbox)}
                className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center active:scale-90 transition-transform"
              >
                {deletingId === lightbox.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4 text-red-400" />}
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0">
          {/* Image — full size, never cropped */}
          <div className="flex items-center justify-center px-0 w-full">
            <img
              src={lightbox.image_url}
              alt={lightbox.prompt || 'Image'}
              className="w-full max-w-[470px] sm:max-w-[520px] lg:max-w-[580px] object-contain"
              style={{ maxHeight: '75vh' }}
            />
          </div>

          {/* Post info — fixed */}
          <div className="shrink-0">
            <div className="flex items-center gap-5 px-4 pt-3 pb-1">
              <button aria-label="Like" onClick={() => toggleLike(lightbox)} className="active:scale-90 transition-transform">
                <Heart className={`w-6 h-6 transition-colors ${lightbox.liked_by_me ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </button>
              <button aria-label="Comments" onClick={handleCommentsToggle} className="active:scale-90 transition-transform">
                <MessageCircle className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Likes count */}
            {lightbox.like_count > 0 && (
              <p className="px-4 text-white text-sm font-bold">
                {lightbox.like_count} {language === 'ar' ? (lightbox.like_count === 1 ? 'إعجاب' : 'إعجاب') : (lightbox.like_count === 1 ? 'like' : 'likes')}
              </p>
            )}

            {/* Divider */}
            <div className="mx-4 border-t border-white/10 my-2" />
          </div>

          {/* Comments list */}
          <div className="px-4 space-y-3 pb-4">
            {hasMoreComments && (
              <button
                onClick={handleLoadMoreComments}
                disabled={commentsLoading}
                className="text-xs font-semibold text-blue-400 active:scale-95 transition-transform disabled:opacity-50"
              >
                {commentsLoading
                  ? (language === 'ar' ? 'جارٍ التحميل...' : 'Loading...')
                  : (language === 'ar' ? 'عرض المزيد من التعليقات' : 'Show more comments')}
              </button>
            )}
            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-3">
                {language === 'ar' ? 'كن أول من يعلّق' : 'Be the first to comment'}
              </p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={c.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] bg-white/10 text-white">
                      {(c.profiles?.display_name || c.profiles?.username || '?').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-xs font-semibold mr-1.5">
                      {c.profiles?.display_name || c.profiles?.username || 'User'}
                    </span>
                    <span className="text-white/80 text-xs">{c.content}</span>
                    <p className="text-white/30 text-[10px] mt-0.5">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </p>
                    <button
                      onClick={() => handleReplyToComment(c)}
                      className="mt-1 text-[10px] font-semibold text-blue-400 active:scale-95 transition-transform"
                    >
                      {language === 'ar' ? 'رد' : 'Reply'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          </div>
          {/* Comment input */}
          <div className="relative shrink-0 border-t border-white/10 px-4 py-2.5 mb-2 flex items-center gap-3 bg-black">
            {replyTarget && (
              <div className="absolute left-4 right-16 -top-7 text-[10px] text-blue-300/90 truncate">
                {language === 'ar' ? `رد على @${replyTarget}` : `Replying to @${replyTarget}`}
              </div>
            )}
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={language === 'ar' ? 'أضف تعليقاً...' : 'Add a comment…'}
              rows={1}
              className="flex-1 min-h-0 h-9 py-2 text-sm resize-none bg-white/8 border-white/15 text-white placeholder:text-white/35 rounded-full px-4"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
            <Button
              size="icon"
              disabled={submittingComment || !newComment.trim()}
              onClick={submitComment}
              className="h-9 w-9 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40"
            >
              {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
