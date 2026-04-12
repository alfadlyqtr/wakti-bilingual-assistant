import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitEvent, onEvent } from "@/utils/eventBus";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Moon, Sun, Calendar, CalendarClock, Mic, Sparkles, ListTodo, ChevronLeft, Settings, User as Account, HelpCircle as Help, Users as Contacts, LogOut, Play, Pause, RotateCcw, RotateCw, Repeat } from "lucide-react";
import { bgAudio } from "@/utils/bgAudio";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { MobileSlideDownNav } from "@/components/MobileSlideDownNav";
import { t } from "@/utils/translations";
import { UnreadBadge } from "./UnreadBadge";
import { useUserProfile } from "@/hooks/useUserProfile";
import { WeatherButton } from "@/components/WeatherButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";

interface AppHeaderProps {
  unreadTotal?: number;
}

export function AppHeader({ unreadTotal = 0 }: AppHeaderProps) {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarKey, setAvatarKey] = useState(Date.now());
  // Local override for immediate avatar display before refetch completes
  const [immediateAvatarUrl, setImmediateAvatarUrl] = useState<string | null | undefined>(undefined);
  const hasTriedSignedFallbackRef = useRef(false);
  
  // Check if we're on the Wakti AI V2 page
  const isWaktiAIPage = location.pathname === '/wakti-ai';

  // Detect homescreen mode from localStorage — default is 'homescreen' when key absent
  const isHomescreenMode = (localStorage.getItem('wakti_dashboard_look') ?? 'homescreen') !== 'dashboard';
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    const timestamp = avatarKey;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${timestamp}`;
  };

  const extractAvatarStoragePath = (urlOrPath: string): string | null => {
    const raw = (urlOrPath || '').trim();
    if (!raw) return null;
    const publicPrefix = '/storage/v1/object/public/avatars/';
    const signedPrefix = '/storage/v1/object/sign/avatars/';
    const idxPublic = raw.indexOf(publicPrefix);
    if (idxPublic !== -1) return raw.slice(idxPublic + publicPrefix.length).split('?')[0] || null;
    const idxSigned = raw.indexOf(signedPrefix);
    if (idxSigned !== -1) return raw.slice(idxSigned + signedPrefix.length).split('?')[0] || null;
    if (raw.includes('://')) return null;
    return raw.split('?')[0] || null;
  };

  const handleAvatarImageError = async () => {
    if (hasTriedSignedFallbackRef.current) return;
    const currentUrl = (rawAvatarUrl || '').trim();
    const path = extractAvatarStoragePath(currentUrl);
    if (!path) return;
    try {
      hasTriedSignedFallbackRef.current = true;
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) return;
      setImmediateAvatarUrl(data.signedUrl);
      setAvatarKey(Date.now());
    } catch (e) {
      console.error('Signed avatar fallback failed:', e);
    }
  };

  // Listen for avatar update events to force refresh
  useEffect(() => {
    const handleAvatarUpdate = (detail: { avatarUrl: string | null; userId: string; timestamp: number }) => {
      console.log('Avatar updated event received:', detail);
      const newUrl = detail?.avatarUrl;
      // Immediately set the new avatar URL for instant display
      setImmediateAvatarUrl(newUrl);
      setAvatarKey(Date.now()); // Force re-render of avatar
      // Also refetch profile to sync state
      refetchProfile();
    };

    const cleanup = onEvent('avatar-updated', handleAvatarUpdate);
    
    return cleanup;
  }, [refetchProfile]);

  // Clear immediate override once profile is updated with the new URL
  useEffect(() => {
    if (immediateAvatarUrl !== undefined && profile?.avatar_url === immediateAvatarUrl) {
      setImmediateAvatarUrl(undefined);
    }
  }, [profile?.avatar_url, immediateAvatarUrl]);

  useEffect(() => {
    hasTriedSignedFallbackRef.current = false;
  }, [profile?.avatar_url]);

  const rawAvatarUrl = (immediateAvatarUrl !== undefined ? immediateAvatarUrl : profile?.avatar_url) || undefined;
  const avatarUrl = getCacheBustedAvatarUrl(rawAvatarUrl?.trim());
  
  // Define menu items with icons and vibrant colors
  const menuItems = [
    { 
      title: language === 'ar' ? 'الإعدادات' : 'Settings', 
      href: '/settings',
      icon: <Settings className="w-4 h-4" />,
      colorClass: 'text-blue-500',
      hoverClass: 'hover:bg-blue-500/10'
    },
    { 
      title: language === 'ar' ? 'الحساب' : 'Account', 
      href: '/account',
      icon: <Account className="w-4 h-4" />,
      colorClass: 'text-purple-500',
      hoverClass: 'hover:bg-purple-500/10'
    },
    { 
      title: t("help", language), 
      href: '/help',
      icon: <Help className="w-4 h-4" />,
      colorClass: 'text-green-500',
      hoverClass: 'hover:bg-green-500/10'
    },
    { 
      title: language === 'ar' ? 'جهات الاتصال' : 'Contacts', 
      href: '/contacts',
      icon: <Contacts className="w-4 h-4" />,
      colorClass: 'text-cyan-500',
      hoverClass: 'hover:bg-cyan-500/10'
    },
    { 
      title: language === 'ar' ? 'تسجيل الخروج' : 'Logout', 
      onClick: handleLogout,
      icon: <LogOut className="w-4 h-4" />,
      colorClass: 'text-red-500',
      hoverClass: 'hover:bg-red-500/10'
    }
  ].filter(item => {
    if (isHomescreenMode) return item.href !== '/account' && item.href !== '/contacts';
    return true;
  });
  
  // Function to get page title and icon with matching colors from MobileNav
  const getPageTitleWithIcon = () => {
    const path = location.pathname;
    
    const routes = {
      '/dashboard': {
        title: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
        icon: null,
        colorClass: ''
      },
      '/calendar': {
        title: language === 'ar' ? 'التقويم' : 'Calendar',
        icon: Calendar,
        colorClass: 'nav-icon-calendar'
      },
      '/settings': {
        title: language === 'ar' ? 'الإعدادات' : 'Settings',
        icon: null,
        colorClass: ''
      },
      '/contacts': {
        title: language === 'ar' ? 'جهات الاتصال' : 'Contacts',
        icon: null,
        colorClass: ''
      },
      '/account': {
        title: language === 'ar' ? 'الحساب' : 'Account',
        icon: null,
        colorClass: ''
      },
      '/wakti-ai': {
        title: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
        icon: Sparkles,
        colorClass: 'nav-icon-ai'
      },
      '/tasjeel': {
        title: language === 'ar' ? 'تسجيل' : 'Tasjeel',
        icon: Mic,
        colorClass: 'text-cyan-500' // Changed to cyan color
      },
      '/tr': {
        title: 'T & R',
        icon: ListTodo,
        colorClass: 'nav-icon-tr'
      },
      '/maw3d': {
        title: t("maw3dEvents", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      }
    };
    
    // Check for Maw3d edit and manage routes
    if (path.startsWith('/maw3d/edit/')) {
      return {
        title: t("editEvent", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }
    
    if (path.startsWith('/maw3d/manage/')) {
      return {
        title: t("manageEvent", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }

    if (path.startsWith('/maw3d/create')) {
      return {
        title: language === 'ar' ? 'إنشاء حدث' : 'Create Event',
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }
    
    return routes[path] || { title: '', icon: null, colorClass: '' };
  };
  
  const pageInfo = getPageTitleWithIcon();
  const IconComponent = pageInfo.icon;
  
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoPosition, setLogoPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useIsMobile();

  const [bgMusicSrc, setBgMusicSrc] = useState<string | null>(null);
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  const [bgIsPlaying, setBgIsPlaying] = useState(false);
  const [bgIsLooping, setBgIsLooping] = useState(true);
  const [bgCurrentTime, setBgCurrentTime] = useState(0);
  const [bgDuration, setBgDuration] = useState(0);
  const miniPlayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const offIndicator = onEvent('wakti-bg-music-indicator-on', () => {
      setBgMusicSrc('active');
      const a = bgAudio.audio;
      if (a) { setBgIsPlaying(!a.paused); setBgDuration(a.duration || 0); setBgCurrentTime(a.currentTime); }
    });
    const offPause = onEvent('wakti-bg-music-pause', () => {
      setBgMusicSrc(null);
      setMiniPlayerOpen(false);
      setBgIsPlaying(false);
    });
    return () => { offIndicator(); offPause(); };
  }, []);

  // Sync mini-player state with bgAudio when open
  useEffect(() => {
    if (!miniPlayerOpen) return;
    const audio = bgAudio.audio;
    if (!audio) return;
    const onPlay = () => setBgIsPlaying(true);
    const onPause = () => setBgIsPlaying(false);
    const onTimeUpdate = () => { setBgCurrentTime(audio.currentTime); setBgDuration(audio.duration || 0); };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    setBgIsPlaying(!audio.paused);
    setBgDuration(audio.duration || 0);
    setBgCurrentTime(audio.currentTime);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [miniPlayerOpen]);

  // Close mini-player on outside click
  useEffect(() => {
    if (!miniPlayerOpen) return;
    const handler = (e: MouseEvent) => {
      if (miniPlayerRef.current && !miniPlayerRef.current.contains(e.target as Node)) {
        setMiniPlayerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [miniPlayerOpen]);

  const bgTogglePlay = () => {
    const audio = bgAudio.audio;
    if (!audio) return;
    if (audio.paused) { audio.play().catch(() => {}); } else { audio.pause(); }
  };
  const bgRewind = () => { const a = bgAudio.audio; if (a) a.currentTime = Math.max(0, a.currentTime - 10); };
  const bgForward = () => { const a = bgAudio.audio; if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); };
  const bgToggleLoop = () => { const a = bgAudio.audio; if (!a) return; a.loop = !a.loop; setBgIsLooping(a.loop); };
  const bgSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = bgAudio.audio;
    if (!a || !bgDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * bgDuration;
  };
  const fmtTime = (s: number) => { if (!isFinite(s)) return '0:00'; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; };

  const handleLogoClick = () => {
    if (!isMobile) return;

    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
      return;
    }

    if (isHomescreenMode) return;

    if (logoRef.current) {
      const rect = logoRef.current.getBoundingClientRect();
      setLogoPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }

    setMobileNavOpen((prev) => !prev);
  };

  const shouldGlowLogo = location.pathname !== '/dashboard';
  const logoGlowClassName = cn(
    "wakti-logo-glow",
    shouldGlowLogo && "wakti-logo-glow--pulse"
  );

  const headerEl = (
    <header
      dir="ltr"
      className={cn(
        "h-16 border-b border-transparent",
        "glue-fixed glue-top z-[990]", // firmly below sidebar (z 999) and its mask (z 998)
        "app-header-fixed",
        language === 'ar' ? 'font-arabic' : ''
      )}
      style={{
        height: 'var(--app-header-h)',
        width: '100%'
      }}
    >
      <div
        className={cn(
          isMobile ? "relative flex items-center" : "relative flex items-center justify-between",
          isMobile
            ? "mx-0 h-16 rounded-none border-b border-border bg-background/90 pl-2 pr-2 shadow-md"
            : "w-full h-16 rounded-[1rem] border border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 px-4 py-2"
        )}
        style={isMobile ? undefined : { borderRadius: '1rem' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isMobile ? (
            location.pathname !== '/dashboard' ? (
              /* Back button with logo — takes user back to homescreen */
              <button
                onClick={handleLogoClick}
                className="flex items-center gap-1 h-10 px-1 rounded-xl text-foreground/80 hover:text-foreground hover:bg-foreground/8 transition-all active:scale-95"
                aria-label="Back to Home"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                <div className="ml-0.5 flex flex-col items-center justify-center leading-none">
                  <div className={cn(
                    "rounded-[0.5rem] overflow-hidden transition-all",
                    bgMusicSrc && "ring-2 ring-emerald-400/80 shadow-[0_0_8px_hsla(142,76%,55%,0.6)]"
                  )}>
                    <Logo3D size="sm" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold mt-0.5 transition-colors",
                      theme === 'dark' ? "text-[hsl(210,100%,82%)]" : "text-[hsl(243,84%,14%)]"
                    )}
                  >
                    {language === 'ar' ? 'الرئيسية' : 'Home'}
                  </span>
                </div>
              </button>
            ) : (
            <div ref={logoRef}>
              <div className={cn(
                "relative rounded-xl p-[2px] transition-all",
                bgMusicSrc ? "bg-emerald-400/30 shadow-[0_0_10px_hsla(142,76%,55%,0.5)]" : "bg-transparent shadow-none"
              )}>
                <div className="rounded-[0.70rem] overflow-hidden">
                  <Logo3D size="sm" onClick={handleLogoClick} />
                </div>
              </div>
            </div>
            )
          ) : (
            <Link to="/dashboard" className="flex items-center">
              <div
                className={cn(
                  "relative rounded-xl p-[2px] transition-all",
                  bgMusicSrc
                    ? "bg-emerald-400/30 shadow-[0_0_12px_hsla(142,76%,55%,0.55)]"
                    : cn(
                        logoGlowClassName,
                        shouldGlowLogo
                          ? theme === 'dark'
                            ? "bg-[linear-gradient(135deg,rgba(147,197,253,0.75)_0%,rgba(168,85,247,0.70)_50%,rgba(59,130,246,0.75)_100%)] shadow-[0_0_18px_rgba(59,130,246,0.28),0_0_32px_rgba(168,85,247,0.20)]"
                            : "bg-[linear-gradient(135deg,rgba(6,5,65,0.78)_0%,rgba(233,206,176,0.82)_55%,rgba(6,5,65,0.74)_100%)] shadow-[0_0_22px_rgba(6,5,65,0.28),0_0_44px_rgba(233,206,176,0.30)]"
                          : "bg-transparent shadow-none"
                      )
                )}
              >
                <div className="rounded-[0.70rem] overflow-hidden">
                  <Logo3D size="sm" />
                </div>
              </div>
            </Link>
          )}
          {/* Page title removed — clean header */}
        </div>
        <div className={cn("flex items-center shrink-0", isMobile ? "gap-1" : "space-x-2")}>
          {/* Bg music indicator + mini-player */}
          <div className="relative" ref={miniPlayerRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bgMusicSrc && setMiniPlayerOpen(o => !o)}
              className={cn(
                "rounded-full h-8 w-8 p-0 border ring-1 ring-offset-2 ring-offset-background shadow-sm hover:shadow-md transition-all",
                bgMusicSrc
                  ? "border-emerald-400/70 dark:border-emerald-400/60 ring-emerald-400/30 dark:ring-emerald-400/20 bg-emerald-500/10 shadow-[0_0_10px_hsla(142,76%,55%,0.35)] cursor-pointer"
                  : "border-black/10 dark:border-white/15 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-white/5 pointer-events-none"
              )}
              aria-label="Background music"
              type="button"
            >
              {bgMusicSrc && bgIsPlaying
                ? <Pause className="h-4 w-4 fill-current text-emerald-400" />
                : <Play className={cn("h-4 w-4 fill-current", bgMusicSrc ? "text-emerald-400" : "text-foreground/80")} />
              }
            </Button>

            {/* Thin vertical icon-only strip dropdown */}
            {bgMusicSrc && (
              <div
                className={cn(
                  "absolute right-0 top-9 z-50 flex flex-col items-center gap-1 p-1 rounded-2xl border border-emerald-400/20 bg-background/95 backdrop-blur-md shadow-[0_8px_24px_hsla(0,0%,0%,0.5)] transition-all duration-200 origin-top",
                  miniPlayerOpen ? "opacity-100 scale-y-100 pointer-events-auto" : "opacity-0 scale-y-0 pointer-events-none"
                )}
              >
                <button type="button" onClick={bgTogglePlay}
                  className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25 transition-all active:scale-90">
                  {bgIsPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                </button>
                <button type="button" onClick={bgRewind} aria-label="Rewind 10s"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-white/10 transition-all active:scale-90">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={bgForward} aria-label="Forward 10s"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-white/10 transition-all active:scale-90">
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={bgToggleLoop} aria-label="Toggle loop"
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90",
                    bgIsLooping ? "text-emerald-400 bg-emerald-500/15 border border-emerald-400/25" : "text-foreground/40 hover:text-foreground/70 hover:bg-white/10"
                  )}>
                  <Repeat className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Voice Assistant mic button */}
          <VoiceAssistant
            onSaveEntry={(entry) => {
              console.log('[AppHeader] Dispatching voice entry event:', entry);
              // Store entry in sessionStorage so calendar can pick it up after navigation
              try {
                sessionStorage.setItem('wakti-pending-voice-entry', JSON.stringify(entry));
              } catch {}
              emitEvent('wakti-voice-add-entry', entry);
              // Navigate to calendar if not already there
              if (!window.location.pathname.includes('/calendar')) {
                navigate('/calendar');
              }
            }}
          />

          {/* Weather Button - Made smaller */}
          <WeatherButton />
          
          {/* Language Toggle Button - always enabled */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleLanguage}
                  className="rounded-full h-8 w-8 p-0 border border-black/10 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 ring-offset-2 ring-offset-background bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 shadow-sm hover:shadow-md transition-all"
                  aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
                >
                  <span className="text-[14px] font-semibold leading-none select-none">
                    {language === 'en' ? 'ع' : 'E'}
                  </span>
                </Button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
          
          {/* Theme Toggle - custom animation */}
          <label
            className="theme-toggle ml-1"
            aria-label={language === 'ar' ? 'تبديل السمة' : 'Toggle theme'}
          >
            <input
              type="checkbox"
              className="theme-toggle__checkbox"
              checked={theme === 'dark'}
              onChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            />
            <span className="theme-toggle__track" role="presentation">
              <span className="theme-toggle__background">
                <span className="theme-toggle__clouds" aria-hidden />
                <span className="theme-toggle__stars" aria-hidden>
                  <span className="theme-toggle__star" />
                  <span className="theme-toggle__star" />
                  <span className="theme-toggle__star" />
                </span>
              </span>
              <span className="theme-toggle__thumb">
                <span className="theme-toggle__sun" aria-hidden />
                <span className="theme-toggle__moon" aria-hidden>
                  <span className="theme-toggle__crater theme-toggle__crater--lg" />
                  <span className="theme-toggle__crater theme-toggle__crater--md" />
                  <span className="theme-toggle__crater theme-toggle__crater--sm" />
                </span>
              </span>
            </span>
          </label>
          
          {/* User Menu - Made smaller */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full relative">
                <span className="relative">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 border border-border/60">
                    <Settings className="h-4 w-4 text-foreground/80" />
                  </span>
                  <UnreadBadge count={unreadTotal} size="sm" className="-right-0.5 -top-0.5" />
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent 
              align="end" 
              side="bottom"
              sideOffset={8}
              collisionPadding={8}
              className="z-[1200] w-[200px] max-w-[200px] overflow-hidden rounded-2xl border border-white/30 dark:border-white/10 p-2 backdrop-blur-2xl dropdown-bloom"
              style={{
                background:
                  theme === 'dark'
                    ? 'linear-gradient(135deg, rgba(12,15,20,0.96) 0%, rgba(16,20,28,0.98) 50%, rgba(12,15,20,0.96) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 50%, rgba(255,255,255,0.95) 100%)',
                boxShadow:
                  theme === 'dark'
                    ? '0 25px 60px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 40px rgba(99, 102, 241, 0.10)'
                    : '0 25px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 10px 40px rgba(99, 102, 241, 0.15)'
              }}
            >
              <div className="relative dropdown-bloom-inner">
                {/* Glass sheen overlay */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl pointer-events-none",
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-white/10 via-transparent to-white/5'
                      : 'bg-gradient-to-br from-white/40 via-transparent to-white/20'
                  )}
                />
                
                <DropdownMenuLabel className="relative z-10 px-3 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                  {language === 'ar' ? 'الحساب' : 'Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                {menuItems.map((item, index) => (
                  <DropdownMenuItem 
                    key={index} 
                    onClick={item.onClick} 
                    className={cn(
                      "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
                      item.hoverClass,
                      "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500/30",
                      "dropdown-item-stagger"
                    )}
                    style={{ animationDelay: `${150 + index * 80}ms` }}
                    asChild={!!item.href}
                  >
                    {item.href 
                      ? (
                        <Link to={item.href} className="flex items-center gap-3 w-full">
                          <span className={cn("flex items-center transition-transform duration-200 group-hover:scale-110", item.colorClass)}>{item.icon}</span>
                          <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{item.title}</span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-3 w-full">
                          <span className={cn("flex items-center transition-transform duration-200 group-hover:scale-110", item.colorClass)}>{item.icon}</span>
                          <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{item.title}</span>
                        </span>
                      )
                    }
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isMobile && !isHomescreenMode && location.pathname === '/dashboard' && (
        <MobileSlideDownNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          logoPosition={logoPosition}
        />
      )}
      
    </header>
  );

  // Option A: Portal the entire header to body on mobile to avoid ancestor scroll/transform issues
  if (isMobile) {
    return createPortal(headerEl, document.body);
  }
  return headerEl;
}
