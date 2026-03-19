import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ChevronLeft, ImageIcon, Heart, MessageCircle,
  X, Loader2, Sparkles, ChevronDown, ChevronUp, Send, Lock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';

interface GalleryImage {
  id: string;
  image_url: string;
  prompt: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null };
}

interface ContactProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function ContactGallery() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useTheme();
  const isDark = theme === 'dark';

  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContact, setIsContact] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !user?.id) return;
    setLoading(true);
    try {
      // 1. Load profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (profErr) throw profErr;
      setProfile(prof);

      // 2. Check contact relationship
      const { data: contactRow } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_id', userId)
        .eq('status', 'approved')
        .maybeSingle();
      setIsContact(!!contactRow);

      if (!contactRow) { setLoading(false); return; }

      // 3. Load their contact-visible profile images
      const { data: imgs, error: imgsErr } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url, prompt, created_at')
        .eq('user_id', userId)
        .eq('visibility', 'contacts')
        .order('created_at', { ascending: false });
      if (imgsErr) throw imgsErr;

      const ids = (imgs || []).map((i: any) => i.id);
      let likesMap: Record<string, number> = {};
      let likedSet = new Set<string>();
      let commentsMap: Record<string, number> = {};

      if (ids.length > 0) {
        const [{ data: likes }, { data: myLikes }, { data: cmts }] = await Promise.all([
          supabase.from('post_likes' as any).select('post_id').in('post_id', ids),
          supabase.from('post_likes' as any).select('post_id').in('post_id', ids).eq('user_id', user.id),
          supabase.from('post_comments' as any).select('post_id').in('post_id', ids),
        ]);
        (likes || []).forEach((l: any) => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
        (myLikes || []).forEach((l: any) => likedSet.add(l.post_id));
        (cmts || []).forEach((c: any) => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
      }

      setImages((imgs || []).map((img: any) => ({
        ...img,
        like_count: likesMap[img.id] || 0,
        comment_count: commentsMap[img.id] || 0,
        liked_by_me: likedSet.has(img.id),
      })));
    } catch {
      toast.error(language === 'ar' ? 'فشل تحميل المعرض' : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id, language]);

  useEffect(() => { load(); }, [load]);

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
      setImages(prev => prev.map(i => i.id === img.id
        ? { ...i, liked_by_me: !optimistic, like_count: i.like_count + (optimistic ? -1 : 1) } : i));
    }
  };

  const loadComments = async (postId: string) => {
    setCommentsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('post_comments')
        .select('id, content, created_at, user_id, profiles:user_id(display_name, username, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const openLightbox = (img: GalleryImage) => {
    setLightbox(img);
    setCommentsOpen(false);
    setComments([]);
    setNewComment('');
  };

  const handleCommentsToggle = () => {
    if (!lightbox) return;
    if (!commentsOpen) { setCommentsOpen(true); loadComments(lightbox.id); }
    else setCommentsOpen(false);
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
      setImages(prev => prev.map(i => i.id === lightbox.id ? { ...i, comment_count: i.comment_count + 1 } : i));
      setLightbox(lb => lb ? { ...lb, comment_count: lb.comment_count + 1 } : lb);
      setNewComment('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const displayName = profile?.display_name || profile?.username || 'User';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-[#0c0f14]' : 'bg-[#fcfefd]'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'bg-[#0c0f14] border-white/10' : 'bg-white border-black/5'}`}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Avatar className="w-9 h-9">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm leading-tight">{displayName}</p>
          {profile?.username && (
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : !isContact ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className={`h-20 w-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <Lock className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="font-semibold">
              {language === 'ar' ? 'غير متاح' : 'Not available'}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {language === 'ar'
                ? 'يجب أن تكون في قائمة جهات الاتصال لعرض هذا المعرض'
                : 'You need to be a contact to view this gallery'}
            </p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className={`h-20 w-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Sparkles className="h-10 w-10 text-blue-500/50" />
            </div>
            <p className="font-semibold">
              {language === 'ar' ? 'المعرض فارغ' : 'Gallery is empty'}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {language === 'ar'
                ? 'لم يشارك هذا المستخدم أي صور بعد'
                : 'This user hasn\'t shared any images yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map(img => (
              <div
                key={img.id}
                className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer group border ${isDark ? 'border-white/10' : 'border-black/5'}`}
                onClick={() => openLightbox(img)}
              >
                <img
                  src={img.image_url}
                  alt={img.prompt || 'Image'}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1 text-white text-[10px]">
                    <Heart className={`w-3 h-3 ${img.liked_by_me ? 'fill-red-400 text-red-400' : ''}`} />
                    {img.like_count}
                  </span>
                  <span className="flex items-center gap-1 text-white text-[10px]">
                    <MessageCircle className="w-3 h-3" />
                    {img.comment_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm">
          {/* Top */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <p className="text-white text-sm font-semibold">{displayName}</p>
            </div>
            <button onClick={() => setLightbox(null)} aria-label="Close" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img
              src={lightbox.image_url}
              alt={lightbox.prompt || 'Image'}
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
          </div>

          {/* Bottom */}
          <div className="shrink-0 border-t border-white/10 px-4 py-3 space-y-3">
            <div className="flex items-center justify-start">
              <div className="flex items-center gap-4">
                <button onClick={() => toggleLike(lightbox)} className="flex items-center gap-1.5 text-white/80 active:scale-90 transition-transform">
                  <Heart className={`w-5 h-5 transition-colors ${lightbox.liked_by_me ? 'fill-red-400 text-red-400' : ''}`} />
                  <span className="text-sm">{lightbox.like_count}</span>
                </button>
                <button onClick={handleCommentsToggle} className="flex items-center gap-1.5 text-white/80 active:scale-90 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{lightbox.comment_count}</span>
                  {commentsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {lightbox.prompt && (
              <p className="text-white/50 text-xs line-clamp-2">{lightbox.prompt}</p>
            )}

            {/* Comments */}
            {commentsOpen && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {commentsLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-white/50" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-white/40 text-xs text-center py-2">
                    {language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={c.profiles?.avatar_url || ''} />
                        <AvatarFallback className="text-[10px]">
                          {(c.profiles?.display_name || c.profiles?.username || '?').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-white/10 rounded-xl px-3 py-1.5">
                        <p className="text-white/90 text-xs font-semibold">
                          {c.profiles?.display_name || c.profiles?.username || 'User'}
                        </p>
                        <p className="text-white/70 text-xs">{c.content}</p>
                        <p className="text-white/30 text-[10px] mt-0.5">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب تعليقاً...' : 'Write a comment…'}
                    className="min-h-0 h-9 py-1.5 text-xs resize-none bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                  />
                  <Button
                    size="icon"
                    disabled={submittingComment || !newComment.trim()}
                    onClick={submitComment}
                    className="h-9 w-9 shrink-0 bg-blue-500 hover:bg-blue-600 rounded-xl"
                  >
                    {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
