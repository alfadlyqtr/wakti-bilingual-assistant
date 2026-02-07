import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Moon, Sun, Calendar, CalendarClock, Mic, Sparkles, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { MobileSlideDownNav } from "@/components/MobileSlideDownNav";
import { t } from "@/utils/translations";
import { Settings, User as Account, HelpCircle as Help, Users as Contacts, LogOut } from "lucide-react";
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
    const handleAvatarUpdate = (event: CustomEvent) => {
      console.log('Avatar updated event received:', event.detail);
      const newUrl = event.detail?.avatarUrl;
      // Immediately set the new avatar URL for instant display
      setImmediateAvatarUrl(newUrl);
      setAvatarKey(Date.now()); // Force re-render of avatar
      // Also refetch profile to sync state
      refetchProfile();
    };

    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    };
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
  ];
  
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // Always starts closed
  const [logoPosition, setLogoPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useIsMobile();

  const handleLogoClick = () => {
    if (!isMobile) return;
    
    if (logoRef.current) {
      const rect = logoRef.current.getBoundingClientRect();
      setLogoPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }
    setMobileNavOpen(!mobileNavOpen);
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
        width: '100%',
        backgroundColor: 'transparent'
      }}
    >
      <div
        className={cn(
          "relative flex items-center justify-between",
          isMobile
            ? "mx-0 h-14 rounded-none border-b border-border bg-background/90 px-2 py-2 shadow-md"
            : "mx-auto h-16 max-w-[1280px] rounded-[2rem] border border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 px-4 py-2"
        )}
        style={
          isMobile
            ? undefined
            : {
                marginLeft: 'calc(var(--current-sidebar-width, var(--sidebar-mini-width, 70px)) + 0.75rem)',
                marginRight: '0.75rem',
                width: 'calc(100% - (var(--current-sidebar-width, var(--sidebar-mini-width, 70px)) + 1.5rem))',
                overflow: 'hidden',
                borderRadius: '1rem'
              }
        }
      >
        <div className="flex items-center gap-3">
          {isMobile ? (
            <div ref={logoRef}>
              <div
                className={cn(
                  "relative rounded-xl p-[2px] transition-all",
                  logoGlowClassName,
                  shouldGlowLogo
                    ? theme === 'dark'
                      ? "bg-[linear-gradient(135deg,rgba(147,197,253,0.75)_0%,rgba(168,85,247,0.70)_50%,rgba(59,130,246,0.75)_100%)] shadow-[0_0_18px_rgba(59,130,246,0.28),0_0_32px_rgba(168,85,247,0.20)]"
                      : "bg-[linear-gradient(135deg,rgba(6,5,65,0.78)_0%,rgba(233,206,176,0.82)_55%,rgba(6,5,65,0.74)_100%)] shadow-[0_0_22px_rgba(6,5,65,0.28),0_0_44px_rgba(233,206,176,0.30)]"
                    : "bg-transparent shadow-none"
                )}
              >
                <div className="rounded-[0.70rem] overflow-hidden">
                  <Logo3D size="sm" onClick={handleLogoClick} />
                </div>
              </div>
            </div>
          ) : (
            <Link to="/dashboard" className="flex items-center">
              <div
                className={cn(
                  "relative rounded-xl p-[2px] transition-all",
                  logoGlowClassName,
                  shouldGlowLogo
                    ? theme === 'dark'
                      ? "bg-[linear-gradient(135deg,rgba(147,197,253,0.75)_0%,rgba(168,85,247,0.70)_50%,rgba(59,130,246,0.75)_100%)] shadow-[0_0_18px_rgba(59,130,246,0.28),0_0_32px_rgba(168,85,247,0.20)]"
                      : "bg-[linear-gradient(135deg,rgba(6,5,65,0.78)_0%,rgba(233,206,176,0.82)_55%,rgba(6,5,65,0.74)_100%)] shadow-[0_0_22px_rgba(6,5,65,0.28),0_0_44px_rgba(233,206,176,0.30)]"
                    : "bg-transparent shadow-none"
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
        <div className="flex items-center space-x-2">
          {/* Voice Assistant mic button */}
          <VoiceAssistant
            onSaveEntry={(entry) => {
              console.log('[AppHeader] Dispatching voice entry event:', entry);
              // Store entry in sessionStorage so calendar can pick it up after navigation
              try {
                sessionStorage.setItem('wakti-pending-voice-entry', JSON.stringify(entry));
              } catch {}
              window.dispatchEvent(new CustomEvent('wakti-voice-add-entry', { detail: entry }));
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
                  <Avatar 
                    className="h-7 w-7"
                    key={`${profile?.avatar_url || 'no-avatar'}-${avatarKey}`}
                  >
                    <AvatarImage src={avatarUrl} onError={handleAvatarImageError} />
                    <AvatarFallback className="text-xs" delayMs={profileLoading ? 0 : 600}>
                      {profileLoading ? (
                        <span className="animate-pulse bg-muted-foreground/30 rounded-full w-full h-full" />
                      ) : (
                        user?.email ? user.email[0].toUpperCase() : '?'
                      )}
                    </AvatarFallback>
                  </Avatar>
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
      
      {/* Mobile Slide Down Nav */}
      {isMobile && (
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
