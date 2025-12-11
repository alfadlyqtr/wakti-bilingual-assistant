import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, MessageCircle, X, Link, Mail } from 'lucide-react';
import { toast } from 'sonner';

// Social platform icons as SVG components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const MessagesIcon = () => (
  <MessageCircle className="w-5 h-5" />
);

const EmailIcon = () => (
  <Mail className="w-5 h-5" />
);

interface ShareButtonProps {
  /** The URL or content to share */
  shareUrl?: string;
  /** The title/text to share */
  shareTitle?: string;
  /** Optional description for sharing */
  shareDescription?: string;
  /** Size of the main button */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
  /** Callback when share is successful */
  onShare?: (platform: string) => void;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  shareUrl = typeof window !== 'undefined' ? window.location.href : '',
  shareTitle = 'Check this out!',
  shareDescription = '',
  size = 'md',
  className = '',
  onShare,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Size configurations
  const sizeConfig = {
    sm: { button: 'w-10 h-10', icon: 'w-4 h-4', padding: 'p-2', expand: 50 },
    md: { button: 'w-12 h-12', icon: 'w-5 h-5', padding: 'p-3', expand: 60 },
    lg: { button: 'w-14 h-14', icon: 'w-6 h-6', padding: 'p-3.5', expand: 70 },
  };

  const config = sizeConfig[size];
  const expandDistance = config.expand;

  // Detect iOS for Messages color
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Helper: Try native share first, fallback to web URL
  const tryNativeShareOrFallback = async (platform: string, fallbackUrl?: string) => {
    // Always try native share API first (opens real apps on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareDescription || shareTitle,
          url: shareUrl,
        });
        onShare?.(platform);
        setIsExpanded(false);
        return true;
      } catch (err: any) {
        // User cancelled or share failed - try fallback
        if (err?.name === 'AbortError') {
          // User cancelled, just close
          setIsExpanded(false);
          return true;
        }
      }
    }
    
    // Fallback to web URL if native share not available or failed
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank');
      onShare?.(platform);
      setIsExpanded(false);
      return true;
    }
    
    // Last resort: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied! Paste it in your app.');
      onShare?.(platform);
      setIsExpanded(false);
    } catch {
      toast.error('Could not share');
    }
    return false;
  };

  // Social platforms configuration - using actual brand colors
  // 7 buttons = 360/7 ≈ 51.4 degrees apart
  const platforms = [
    {
      name: 'whatsapp',
      icon: WhatsAppIcon,
      bgColor: 'bg-[#25D366]', // WhatsApp green
      angle: 0,
      action: () => {
        // Native share opens the real WhatsApp app
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${shareUrl}`)}`;
        tryNativeShareOrFallback('whatsapp', fallbackUrl);
      },
    },
    {
      name: 'instagram',
      icon: InstagramIcon,
      bgColor: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]', // Instagram gradient
      angle: 51,
      action: () => {
        // Instagram doesn't have a web share URL, so native share or copy
        tryNativeShareOrFallback('instagram');
      },
    },
    {
      name: 'snapchat',
      icon: SnapchatIcon,
      bgColor: 'bg-[#FFFC00]', // Snapchat yellow
      textColor: 'text-black', // Black text on yellow
      angle: 103,
      action: () => {
        // Native share opens the real Snapchat app
        const fallbackUrl = `https://www.snapchat.com/share?url=${encodeURIComponent(shareUrl)}`;
        tryNativeShareOrFallback('snapchat', fallbackUrl);
      },
    },
    {
      name: 'facebook',
      icon: FacebookIcon,
      bgColor: 'bg-[#1877F2]', // Facebook blue
      angle: 154,
      action: () => {
        // Native share opens the real Facebook app
        const fallbackUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        tryNativeShareOrFallback('facebook', fallbackUrl);
      },
    },
    {
      name: 'email',
      icon: EmailIcon,
      bgColor: 'bg-[#EA4335]', // Gmail red / Email red
      angle: 206,
      action: () => {
        // Email works well with mailto: scheme
        const subject = encodeURIComponent(shareTitle);
        const body = encodeURIComponent(`${shareDescription || shareTitle}\n\n${shareUrl}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        onShare?.('email');
        setIsExpanded(false);
      },
    },
    {
      name: 'messages',
      icon: MessagesIcon,
      bgColor: isIOS ? 'bg-[#007AFF]' : 'bg-[#34C759]', // iMessage blue for iOS, Android green
      angle: 257,
      action: () => {
        // Native share or SMS fallback
        const fallbackSms = `sms:?body=${encodeURIComponent(`${shareTitle}\n${shareUrl}`)}`;
        if (navigator.share) {
          navigator.share({
            title: shareTitle,
            text: shareDescription || shareTitle,
            url: shareUrl,
          }).then(() => {
            onShare?.('messages');
            setIsExpanded(false);
          }).catch(() => {
            window.location.href = fallbackSms;
            onShare?.('messages');
            setIsExpanded(false);
          });
        } else {
          window.location.href = fallbackSms;
          onShare?.('messages');
          setIsExpanded(false);
        }
      },
    },
    {
      name: 'copy',
      icon: () => copied ? <Check className="w-5 h-5" /> : <Link className="w-5 h-5" />,
      bgColor: copied ? 'bg-green-500' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500', // Wakti colors
      angle: 309,
      action: async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          toast.success('Link copied!');
          setTimeout(() => setCopied(false), 2000);
          onShare?.('copy');
          setIsExpanded(false);
        } catch {
          toast.error('Failed to copy');
        }
      },
    },
  ];

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Handle click/press only (no hover)
  const handleMainClick = () => {
    setIsExpanded(!isExpanded);
  };

  // Calculate position for each platform button
  const getButtonPosition = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    const x = Math.cos(radians) * expandDistance;
    const y = Math.sin(radians) * expandDistance;
    return { x, y };
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: isExpanded ? `${expandDistance * 2 + 60}px` : 'fit-content',
        height: isExpanded ? `${expandDistance * 2 + 60}px` : 'fit-content',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Social platform buttons */}
      {platforms.map((platform) => {
        const { x, y } = getButtonPosition(platform.angle);
        const Icon = platform.icon;
        const textColorClass = 'textColor' in platform ? platform.textColor : 'text-white';
        
        return (
          <button
            key={platform.name}
            onClick={(e) => {
              e.stopPropagation();
              platform.action();
            }}
            className={`
              absolute ${config.button} ${config.padding}
              flex items-center justify-center
              rounded-full border-none
              ${platform.bgColor}
              ${textColorClass}
              shadow-lg
              transition-all duration-300 ease-out
              active:scale-95
              focus:outline-none focus:ring-2 focus:ring-violet-500/50
            `}
            style={{
              transform: isExpanded
                ? `translate(${x}px, ${y}px) scale(1)`
                : 'translate(0, 0) scale(0)',
              opacity: isExpanded ? 1 : 0,
              pointerEvents: isExpanded ? 'auto' : 'none',
            }}
            aria-label={`Share on ${platform.name}`}
          >
            <Icon />
          </button>
        );
      })}

      {/* Main share button */}
      <button
        onClick={handleMainClick}
        className={`
          relative ${config.button} ${config.padding}
          flex items-center justify-center
          rounded-full border-none
          bg-gradient-to-br from-violet-500 to-fuchsia-500
          text-white
          shadow-lg
          transition-all duration-200 ease-out
          hover:from-violet-600 hover:to-fuchsia-600
          hover:shadow-xl hover:scale-105
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2
          z-10
        `}
        style={{
          boxShadow: '4px 4px 16px rgba(139, 92, 246, 0.3), -2px -2px 12px rgba(255, 255, 255, 0.1)',
        }}
        aria-label="Share"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <X className={config.icon} />
        ) : (
          <Share2 className={config.icon} />
        )}
      </button>
    </div>
  );
};

export default ShareButton;
