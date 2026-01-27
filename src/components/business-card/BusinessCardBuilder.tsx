import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { isWidgetSupported, setBusinessCardWidget, openWidgetSettings } from "../../integrations/natively/widgetBridge";
import { isWalletSupported, addBusinessCardToWallet } from "../../integrations/natively/walletBridge";
import { openInSafari, isNativelyApp } from "../../integrations/natively/browserBridge";
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft,
  Save,
  Share2,
  User,
  Link2,
  Palette,
  QrCode,
  Mail,
  Phone,
  Power,
  Globe,
  Building2,
  MapPin,
  Linkedin,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  MessageCircle,
  Send,
  Github,
  Calendar,
  Plus,
  Image as ImageIcon,
  X,
  GripVertical,
  Check,
  Sparkles,
  Camera,
  Upload,
  ImagePlus,
  Bold,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  UserPlus,
  Smartphone,
  LayoutGrid,
} from 'lucide-react';

// Types
interface TextStyle {
  color?: string;
  bold?: boolean;
  underline?: boolean;
  fontFamily?: 'system' | 'serif' | 'mono' | 'arabic';
  alignment?: 'left' | 'center' | 'right';
}

interface BusinessCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  website: string;
  logoUrl: string;
  profilePhotoUrl: string;
  coverPhotoUrl?: string;
  department?: string;
  headline?: string;
  address?: string;
  socialLinks?: SocialLink[];
  template?: 'geometric' | 'professional' | 'fashion' | 'minimal' | 'clean';
  primaryColor?: string;
  mosaicPaletteId?: string;
  mosaicColors?: {
    light?: string;
    mid?: string;
    dark?: string;
    deepest?: string;
  };
  professionalColors?: {
    band?: string;
    ring?: string;
    line?: string;
    lineHeight?: number;
    bandHeight?: number;
  };
  fashionColors?: {
    curve?: string;
    star?: string;
    starGlow?: boolean;
  };
  minimalColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  cleanColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  photoShape?: 'circle' | 'square';
  // Text styling
  nameStyle?: TextStyle;
  titleStyle?: TextStyle;
  companyStyle?: TextStyle;
  // Icon styling
  iconStyle?: {
    showBackground?: boolean;
    backgroundColor?: string;
    iconColor?: string;
    useBrandColors?: boolean;
    colorIntensity?: number; // 0-100, default 50
  };
}

interface SocialLink {
  id: string;
  type: string;
  url: string;
  label?: string;
}

interface BusinessCardBuilderProps {
  initialData: BusinessCardData;
  onSave: (data: BusinessCardData) => void;
  onBack: () => void;
}

// TRUE Brand SVG Icons with official brand colors
const BrandIcons = {
  // WhatsApp - Official green with phone icon
  whatsapp: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  // Instagram - Gradient background with camera icon
  instagram: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  // Facebook - Official blue F
  facebook: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  // Twitter/X - Official X logo
  twitter: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  // LinkedIn - Official blue in
  linkedin: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  // YouTube - Official red play button
  youtube: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  // Telegram - Official paper plane
  telegram: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  ),
  // TikTok - Official music note logo
  tiktok: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  // Snapchat - Official ghost
  snapchat: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
    </svg>
  ),
  // GitHub - Official octocat mark
  github: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  ),
  // Calendly - Calendar icon
  calendly: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.655 14.262c.281-.281.663-.438 1.061-.438h1.284c-.088 2.052-.858 3.973-2.197 5.511a9.036 9.036 0 0 1-5.197 2.972 9.036 9.036 0 0 1-5.942-.872 9.036 9.036 0 0 1-4.163-4.163 9.036 9.036 0 0 1-.872-5.942 9.036 9.036 0 0 1 2.972-5.197 9.036 9.036 0 0 1 5.511-2.197v1.284c0 .398-.157.78-.438 1.061-.281.281-.438.663-.438 1.061 0 .398.157.78.438 1.061.281.281.663.438 1.061.438h3c.398 0 .78-.157 1.061-.438.281-.281.438-.663.438-1.061V4.5c0-.398-.157-.78-.438-1.061A1.5 1.5 0 0 0 15 3h-3c-.398 0-.78.157-1.061.438-.281.281-.438.663-.438 1.061v.284A10.536 10.536 0 0 0 4.783 7.22a10.536 10.536 0 0 0-3.437 6.03 10.536 10.536 0 0 0 1.012 6.906 10.536 10.536 0 0 0 4.836 4.836 10.536 10.536 0 0 0 6.906 1.012 10.536 10.536 0 0 0 6.03-3.437 10.536 10.536 0 0 0 2.437-5.718h-.284c-.398 0-.78.157-1.061.438-.281.281-.663.438-1.061.438-.398 0-.78-.157-1.061-.438a1.5 1.5 0 0 1-.438-1.061c0-.398.157-.78.438-1.061z"/>
    </svg>
  ),
};

// Social platforms config with brand colors and TRUE brand icons
const SOCIAL_PLATFORMS = [
  { type: 'phone', icon: Phone, label: 'Phone Number', placeholder: '+1234567890', color: '#22c55e', brandIcon: null },
  { type: 'email', icon: Mail, label: 'Email', placeholder: 'email@example.com', color: '#ef4444', brandIcon: null },
  { type: 'website', icon: Globe, label: 'Website', placeholder: 'https://...', color: '#3b82f6', brandIcon: null },
  { type: 'linkedin', icon: Linkedin, label: 'LinkedIn', placeholder: 'linkedin.com/in/...', color: '#0A66C2', brandIcon: BrandIcons.linkedin },
  { type: 'instagram', icon: Instagram, label: 'Instagram', placeholder: '@username', color: '#E4405F', brandIcon: BrandIcons.instagram, gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' },
  { type: 'twitter', icon: Twitter, label: 'X (Twitter)', placeholder: '@username', color: '#000000', brandIcon: BrandIcons.twitter },
  { type: 'facebook', icon: Facebook, label: 'Facebook', placeholder: 'facebook.com/...', color: '#1877F2', brandIcon: BrandIcons.facebook },
  { type: 'youtube', icon: Youtube, label: 'YouTube', placeholder: 'youtube.com/...', color: '#FF0000', brandIcon: BrandIcons.youtube },
  { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', placeholder: '+1234567890', color: '#25D366', brandIcon: BrandIcons.whatsapp },
  { type: 'telegram', icon: Send, label: 'Telegram', placeholder: '@username', color: '#26A5E4', brandIcon: BrandIcons.telegram },
  { type: 'github', icon: Github, label: 'GitHub', placeholder: 'github.com/...', color: '#181717', brandIcon: BrandIcons.github },
  { type: 'calendly', icon: Calendar, label: 'Calendly', placeholder: 'calendly.com/...', color: '#006BFF', brandIcon: BrandIcons.calendly },
  { type: 'tiktok', icon: Sparkles, label: 'TikTok', placeholder: '@username', color: '#000000', brandIcon: BrandIcons.tiktok },
  { type: 'snapchat', icon: Camera, label: 'Snapchat', placeholder: '@username', color: '#FFFC00', brandIcon: BrandIcons.snapchat },
  { type: 'address', icon: MapPin, label: 'Address', placeholder: '123 Main St...', color: '#f97316', brandIcon: null },
];

// Card templates - Premium designs matching reference screenshots
const CARD_TEMPLATES = [
  {
    id: 'geometric',
    name: 'Geometric',
    nameAr: 'هندسي',
    preview: 'bg-gradient-to-br from-rose-300 via-rose-400 to-rose-600',
    headerStyle: 'mosaic',
  },
  {
    id: 'professional',
    name: 'Professional',
    nameAr: 'احترافي',
    preview: 'bg-gradient-to-br from-sky-400 via-sky-500 to-blue-500',
    headerStyle: 'professional',
  },
  {
    id: 'fashion',
    name: 'Fashion',
    nameAr: 'عصري',
    preview: 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600',
    headerStyle: 'fashion',
  },
  {
    id: 'minimal',
    name: 'Minimal Dark',
    nameAr: 'داكن بسيط',
    preview: 'bg-gradient-to-br from-gray-800 via-gray-900 to-black',
    headerStyle: 'minimal',
  },
  {
    id: 'clean',
    name: 'Clean White',
    nameAr: 'أبيض نظيف',
    preview: 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300',
    headerStyle: 'clean',
  },
];

const MOSAIC_PALETTES = [
  { id: 'rose', label: 'Rose', labelAr: 'وردي', colors: { light: '#f5b5b5', mid: '#e8a4a4', dark: '#d4847d', deepest: '#7a3a3a' } },
  { id: 'sunset', label: 'Sunset', labelAr: 'غروب', colors: { light: '#ffd6a5', mid: '#ffb585', dark: '#f18b6b', deepest: '#b45745' } },
  { id: 'plum', label: 'Plum', labelAr: 'برقوقي', colors: { light: '#d7c6ff', mid: '#b79bff', dark: '#8b6ee8', deepest: '#4b2c7a' } },
  { id: 'ocean', label: 'Ocean', labelAr: 'محيط', colors: { light: '#a8d8ea', mid: '#61c0bf', dark: '#3d8b8b', deepest: '#1a4f4f' } },
  { id: 'forest', label: 'Forest', labelAr: 'غابة', colors: { light: '#b8e0c8', mid: '#7bc89c', dark: '#4a9d6e', deepest: '#2d5a40' } },
  { id: 'gold', label: 'Gold', labelAr: 'ذهبي', colors: { light: '#fff3cd', mid: '#ffc107', dark: '#d4a106', deepest: '#8b6914' } },
  { id: 'berry', label: 'Berry', labelAr: 'توتي', colors: { light: '#f8c8dc', mid: '#e57399', dark: '#c44569', deepest: '#6b1d3a' } },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', colors: { light: '#cbd5e1', mid: '#94a3b8', dark: '#64748b', deepest: '#334155' } },
  { id: 'copper', label: 'Copper', labelAr: 'نحاسي', colors: { light: '#f3cbb0', mid: '#e7a978', dark: '#c77a4c', deepest: '#7a3f26' } },
  { id: 'aura', label: 'Aurora', labelAr: 'أورورا', colors: { light: '#cfe7ff', mid: '#9ac6ff', dark: '#6b9df7', deepest: '#2f4f99' } },
];

const PROFESSIONAL_PALETTES = [
  { id: 'blue', label: 'Blue', labelAr: 'أزرق', band: '#58b0e0', ring: '#1d4ed8' },
  { id: 'teal', label: 'Teal', labelAr: 'فيروزي', band: '#4cc3c7', ring: '#0f766e' },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', band: '#7c8aa3', ring: '#1f2937' },
  { id: 'navy', label: 'Navy', labelAr: 'كحلي', band: '#3b5998', ring: '#1e3a5f' },
  { id: 'emerald', label: 'Emerald', labelAr: 'زمردي', band: '#34d399', ring: '#059669' },
  { id: 'purple', label: 'Purple', labelAr: 'بنفسجي', band: '#a78bfa', ring: '#7c3aed' },
  { id: 'rose', label: 'Rose', labelAr: 'وردي', band: '#fb7185', ring: '#e11d48' },
  { id: 'amber', label: 'Amber', labelAr: 'كهرماني', band: '#fbbf24', ring: '#d97706' },
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', band: '#94a3b8', ring: '#334155' },
  { id: 'ice', label: 'Ice', labelAr: 'ثلجي', band: '#7dd3fc', ring: '#0ea5e9' },
];

const FASHION_PALETTES = [
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', curve: '#6b7280', star: '#c7ccd3' },
  { id: 'charcoal', label: 'Charcoal', labelAr: 'فحمي', curve: '#4b5563', star: '#d1d5db' },
  { id: 'midnight', label: 'Midnight', labelAr: 'منتصف الليل', curve: '#374151', star: '#cbd5f5' },
  { id: 'ocean', label: 'Ocean', labelAr: 'محيط', curve: '#0ea5e9', star: '#bae6fd' },
  { id: 'forest', label: 'Forest', labelAr: 'غابة', curve: '#22c55e', star: '#bbf7d0' },
  { id: 'wine', label: 'Wine', labelAr: 'نبيذي', curve: '#881337', star: '#fda4af' },
  { id: 'royal', label: 'Royal', labelAr: 'ملكي', curve: '#7c3aed', star: '#ddd6fe' },
  { id: 'sunset', label: 'Sunset', labelAr: 'غروب', curve: '#ea580c', star: '#fed7aa' },
  { id: 'celadon', label: 'Celadon', labelAr: 'سيلادون', curve: '#16a34a', star: '#dcfce7' },
  { id: 'blush', label: 'Blush', labelAr: 'توردي', curve: '#f472b6', star: '#fbcfe8' },
];

const MINIMAL_PALETTES = [
  { id: 'noir', label: 'Noir', labelAr: 'نوار', background: '#0b0b0f', header: '#111827', accent: '#1f2937', text: '#f9fafb', muted: '#9ca3af' },
  { id: 'graphite', label: 'Graphite', labelAr: 'جرافيت', background: '#101418', header: '#1f2937', accent: '#374151', text: '#f3f4f6', muted: '#9ca3af' },
  { id: 'ink', label: 'Ink', labelAr: 'حبر', background: '#0b1120', header: '#111827', accent: '#1e293b', text: '#e5e7eb', muted: '#94a3b8' },
  { id: 'obsidian', label: 'Obsidian', labelAr: 'سبج', background: '#05070b', header: '#0f172a', accent: '#1f2937', text: '#f8fafc', muted: '#a1a1aa' },
  { id: 'evergreen', label: 'Evergreen', labelAr: 'دائم الخضرة', background: '#0b1412', header: '#0f1f19', accent: '#14532d', text: '#ecfdf5', muted: '#9ca3af' },
  { id: 'merlot', label: 'Merlot', labelAr: 'ميرلو', background: '#160b0f', header: '#2a0e16', accent: '#7f1d1d', text: '#fef2f2', muted: '#a1a1aa' },
  { id: 'indigo', label: 'Indigo', labelAr: 'نيلي', background: '#0b1020', header: '#1e1b4b', accent: '#312e81', text: '#eef2ff', muted: '#a5b4fc' },
  { id: 'slate', label: 'Slate', labelAr: 'رمادي', background: '#0f172a', header: '#1f2937', accent: '#334155', text: '#e2e8f0', muted: '#94a3b8' },
  { id: 'bronze', label: 'Bronze', labelAr: 'برونزي', background: '#140f0b', header: '#2b1b10', accent: '#92400e', text: '#fef3c7', muted: '#d4d4d8' },
  { id: 'midnight', label: 'Midnight', labelAr: 'منتصف الليل', background: '#0c0f14', header: '#111827', accent: '#1f2937', text: '#f2f2f2', muted: '#858384' },
];

const CLEAN_PALETTES = [
  { id: 'pure', label: 'Pure', labelAr: 'نقي', background: '#fcfefd', header: '#f2f4f8', accent: '#060541', text: '#060541', muted: '#606062' },
  { id: 'linen', label: 'Linen', labelAr: 'كتان', background: '#fbf7f2', header: '#f0e6da', accent: '#8b5e34', text: '#3f2a1d', muted: '#8a7f76' },
  { id: 'sage', label: 'Sage', labelAr: 'ميرمية', background: '#f6fbf7', header: '#e8f5ec', accent: '#2f6f4e', text: '#1f3d2f', muted: '#6b7f75' },
  { id: 'sky', label: 'Sky', labelAr: 'سماء', background: '#f5f9ff', header: '#e6f0ff', accent: '#1d4ed8', text: '#1e3a8a', muted: '#64748b' },
  { id: 'pearl', label: 'Pearl', labelAr: 'لؤلؤي', background: '#fdfcfa', header: '#f1f0ee', accent: '#7c3aed', text: '#3b0764', muted: '#8b8b8b' },
  { id: 'sand', label: 'Sand', labelAr: 'رملي', background: '#fff9f0', header: '#f2e8d5', accent: '#b45309', text: '#7c2d12', muted: '#9a8c6c' },
  { id: 'blush', label: 'Blush', labelAr: 'توردي', background: '#fff5f7', header: '#fde2e4', accent: '#be123c', text: '#831843', muted: '#9f1239' },
  { id: 'mint', label: 'Mint', labelAr: 'نعناع', background: '#f4fffb', header: '#dcfce7', accent: '#047857', text: '#065f46', muted: '#6b7280' },
  { id: 'lavender', label: 'Lavender', labelAr: 'لافندر', background: '#faf5ff', header: '#ede9fe', accent: '#6d28d9', text: '#4c1d95', muted: '#7c3aed' },
  { id: 'golden', label: 'Golden', labelAr: 'ذهبي', background: '#fffdf6', header: '#fff2cc', accent: '#ca8a04', text: '#7c2d12', muted: '#a16207' },
];

// Translations
const translations = {
  en: {
    builder: 'Card Builder',
    details: 'Details',
    links: 'Links',
    style: 'Style',
    qrCode: 'QR Code',
    save: 'Save',
    share: 'Share',
    personalDetails: 'Personal Details',
    contactInfo: 'Contact Info',
    professionalInfo: 'Professional Info',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company',
    jobTitle: 'Job Title',
    department: 'Department',
    headline: 'Headline',
    website: 'Website',
    address: 'Address',
    holdToReorder: 'Hold each field below to re-order it',
    tapToAdd: 'Tap a field below to add it',
    addedLinks: 'Added Links',
    availableLinks: 'Available Links',
    chooseTemplate: 'Choose Your Card Style',
    templateSelected: 'Selected',
    preview: 'Preview',
    yourQrCode: 'Your QR Code',
    scanToConnect: 'Scan to connect instantly',
    downloadQr: 'Download QR Code',
    addToWidget: 'Add as Widget',
    widgetHint: 'Add your QR code as a widget for the fastest way to share',
    required: 'required',
    optional: 'optional',
    changePhoto: 'Change Photo',
    changeLogo: 'Change Logo',
  },
  ar: {
    builder: 'منشئ البطاقة',
    details: 'التفاصيل',
    links: 'الروابط',
    style: 'النمط',
    qrCode: 'رمز QR',
    save: 'حفظ',
    share: 'مشاركة',
    personalDetails: 'البيانات الشخصية',
    contactInfo: 'معلومات الاتصال',
    professionalInfo: 'المعلومات المهنية',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    company: 'الشركة',
    jobTitle: 'المسمى الوظيفي',
    department: 'القسم',
    headline: 'العنوان الرئيسي',
    website: 'الموقع الإلكتروني',
    address: 'العنوان',
    holdToReorder: 'اضغط مطولاً لإعادة الترتيب',
    tapToAdd: 'اضغط على حقل لإضافته',
    addedLinks: 'الروابط المضافة',
    availableLinks: 'الروابط المتاحة',
    chooseTemplate: 'اختر نمط بطاقتك',
    templateSelected: 'محدد',
    preview: 'معاينة',
    yourQrCode: 'رمز QR الخاص بك',
    scanToConnect: 'امسح للتواصل فوراً',
    downloadQr: 'تحميل رمز QR',
    addToWidget: 'إضافة كودجت',
    widgetHint: 'أضف رمز QR كودجت للمشاركة بأسرع طريقة',
    required: 'مطلوب',
    optional: 'اختياري',
    changePhoto: 'تغيير الصورة',
    changeLogo: 'تغيير الشعار',
  },
};

type TabType = 'details' | 'links' | 'style' | 'qrcode';

export const BusinessCardBuilder: React.FC<BusinessCardBuilderProps> = ({
  initialData,
  onSave,
  onBack,
}) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [formData, setFormData] = useState<BusinessCardData>({
    ...initialData,
    socialLinks: initialData.socialLinks || [],
    template: initialData.template || 'geometric',
    primaryColor: initialData.primaryColor || '#6366f1',
    photoShape: initialData.photoShape || 'circle',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<{ type: string; label: string; icon: any; placeholder?: string } | null>(null);
  const [linkModalValue, setLinkModalValue] = useState('');
  const [isLinkActive, setIsLinkActive] = useState(true);

  // File input refs for image uploads
  const coverPhotoRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Handle image upload and convert to base64 data URL
  const handleImageUpload = useCallback((file: File, field: 'coverPhotoUrl' | 'profilePhotoUrl' | 'logoUrl') => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFormData(prev => ({ ...prev, [field]: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, []);

  const updateField = useCallback((field: keyof BusinessCardData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const timeoutId = setTimeout(() => {
      onSave(formData);
      toast.success(isRTL ? 'تم الحفظ التلقائي!' : 'Auto-saved!', {
        description: isRTL ? 'تم حفظ التغييرات تلقائياً' : 'Changes saved automatically',
      });
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [formData, autoSaveEnabled, onSave, isRTL]);

  const addSocialLink = useCallback((type: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.type === type);
    if (!platform) return;
    
    const newLink: SocialLink = {
      id: `${type}-${Date.now()}`,
      type,
      url: '',
      label: platform.label,
    };
    
    setFormData(prev => ({
      ...prev,
      socialLinks: [...(prev.socialLinks || []), newLink],
    }));
  }, []);

  const removeSocialLink = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter(link => link.id !== id),
    }));
  }, []);

  const updateSocialLink = useCallback((id: string, url: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).map(link =>
        link.id === id ? { ...link, url } : link
      ),
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success(isRTL ? 'تم الحفظ!' : 'Saved!', {
        description: isRTL ? 'تم حفظ بطاقتك بنجاح' : 'Your card has been saved successfully',
      });
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error', {
        description: isRTL ? 'فشل في حفظ البطاقة' : 'Failed to save card',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  
  // Tab navigation
  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'details', label: t.details, icon: User },
    { id: 'links', label: t.links, icon: Link2 },
    { id: 'style', label: t.style, icon: Palette },
    { id: 'qrcode', label: t.qrCode, icon: QrCode },
  ];

  // Render Details Tab - Wakti Design System
  const renderDetailsTab = () => (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={coverPhotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر صورة الغلاف' : 'Select cover photo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'coverPhotoUrl')}
      />
      <input
        ref={profilePhotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر صورة الملف الشخصي' : 'Select profile photo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'profilePhotoUrl')}
      />
      <input
        ref={logoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={isRTL ? 'اختر الشعار' : 'Select logo'}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logoUrl')}
      />

      {/* Live Card Preview at Top */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(210,100%,65%)]/20 via-[hsl(280,70%,65%)]/20 to-[hsl(25,95%,60%)]/20 rounded-3xl blur-xl" />
        <div className="relative">
          <CardPreviewLive 
            data={formData} 
            isFlipped={isPreviewFlipped} 
            handleFlip={() => setIsPreviewFlipped(!isPreviewFlipped)}
            handleAddToWallet={handleAddToWallet}
          />
        </div>
      </div>

      {/* Images & Layout Section - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'الصور والتخطيط' : 'Images & layout'}</h3>
        
        <div className="flex items-start gap-6">
          {/* Logo - Large */}
          <div className="relative">
            <button
              onClick={() => logoRef.current?.click()}
              className="w-28 h-28 rounded-2xl bg-[#060541]/5 dark:bg-white/5 border-2 border-dashed border-[#060541]/20 dark:border-white/20 flex items-center justify-center overflow-hidden hover:border-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,65%)]/5 transition-all cursor-pointer"
            >
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
              ) : (
                <Building2 className="w-12 h-12 text-[#606062]" />
              )}
            </button>
            <button 
              onClick={() => logoRef.current?.click()}
              aria-label={isRTL ? 'تغيير الشعار' : 'Change logo'}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#060541] dark:bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Profile Photo */}
          <div className="relative">
            <button
              onClick={() => profilePhotoRef.current?.click()}
              className={`w-16 h-16 ${formData.photoShape === 'square' ? 'rounded-2xl' : 'rounded-full'} bg-[#060541]/5 dark:bg-white/5 border-2 border-dashed border-[#060541]/20 dark:border-white/20 overflow-hidden hover:border-[hsl(280,70%,65%)] hover:bg-[hsl(280,70%,65%)]/5 transition-all cursor-pointer`}
            >
              {formData.profilePhotoUrl ? (
                <img
                  src={formData.profilePhotoUrl}
                  alt="Profile"
                  className={`w-full h-full object-cover ${formData.photoShape === 'square' ? 'rounded-xl' : 'rounded-full'}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-[#606062]" />
                </div>
              )}
            </button>
            <button 
              onClick={() => profilePhotoRef.current?.click()}
              aria-label={isRTL ? 'تغيير الصورة' : 'Change photo'}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(280,70%,65%)] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Cover Photo Button */}
        <button 
          onClick={() => coverPhotoRef.current?.click()}
          className="flex items-center gap-2 text-[hsl(320,75%,70%)] hover:text-[hsl(320,75%,60%)] transition-colors mt-2"
        >
          <ImagePlus className="w-4 h-4" />
          <span className="text-sm font-medium">
            {formData.coverPhotoUrl 
              ? (isRTL ? 'تغيير صورة الغلاف' : 'Change cover photo')
              : (isRTL ? 'إضافة صورة الغلاف' : 'Add cover photo')
            }
          </span>
        </button>
        {formData.coverPhotoUrl && (
          <div className="relative w-full h-20 rounded-xl overflow-hidden">
            <img src={formData.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            <button
              onClick={() => updateField('coverPhotoUrl', '')}
              aria-label={isRTL ? 'إزالة صورة الغلاف' : 'Remove cover photo'}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Personal Details - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(280,70%,65%)] flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.personalDetails}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.firstName}</label>
            <Input
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.lastName}</label>
            <Input
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.headline}</label>
          <Input
            value={formData.headline || ''}
            onChange={(e) => updateField('headline', e.target.value)}
            placeholder={isRTL ? 'مثال: مطور ويب | مصمم' : 'e.g. Web Developer | Designer'}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(210,100%,65%)] text-[#060541] dark:text-[#f2f2f2] placeholder:text-[#858384]"
          />
        </div>
      </div>

      {/* Professional Info - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(45,100%,60%)] flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.professionalInfo}</h3>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.jobTitle}</label>
          <Input
            value={formData.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.company}</label>
          <Input
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.department}</label>
          <Input
            value={formData.department || ''}
            onChange={(e) => updateField('department', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(25,95%,60%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>
      </div>

      {/* Contact Info - Wakti Style */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[hsl(142,76%,55%)] to-[hsl(160,80%,55%)] flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">{t.contactInfo}</h3>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.email}</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.phone}</label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.website}</label>
          <Input
            type="url"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="https://"
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2] placeholder:text-[#858384]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-center text-[#606062] dark:text-[#858384] block font-medium">{t.address}</label>
          <Input
            value={formData.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            className="bg-[#060541]/5 dark:bg-white/5 border-0 border-b-2 border-[#060541]/20 dark:border-white/20 rounded-none h-10 text-center focus:ring-0 focus:border-[hsl(142,76%,55%)] text-[#060541] dark:text-[#f2f2f2]"
          />
        </div>
      </div>
    </div>
  );


  const handleGridIconClick = (platform: typeof SOCIAL_PLATFORMS[0]) => {
    let currentValue = '';
    let isActive = false;

    if (platform.type === 'phone') currentValue = formData.phone;
    else if (platform.type === 'email') currentValue = formData.email;
    else if (platform.type === 'website') currentValue = formData.website;
    else if (platform.type === 'address') currentValue = formData.address || '';
    else {
      const socialLink = (formData.socialLinks || []).find(l => l.type === platform.type);
      if (socialLink) {
        currentValue = socialLink.url;
        isActive = true;
      }
    }

    if (['phone', 'email', 'website', 'address'].includes(platform.type)) {
      isActive = !!currentValue;
    }

    setSelectedPlatform(platform);
    setLinkModalValue(currentValue);
    setIsLinkActive(isActive);
    setIsLinkModalOpen(true);
  };

  const handleSaveLinkFromModal = () => {
    if (!selectedPlatform) return;

    const type = selectedPlatform.type;
    const value = linkModalValue;

    if (['phone', 'email', 'website', 'address'].includes(type)) {
      if (isLinkActive) {
        setFormData(prev => ({ ...prev, [type]: value }));
      } else {
        setFormData(prev => ({ ...prev, [type]: '' }));
      }
    } else {
      if (isLinkActive) {
         const existingIndex = (formData.socialLinks || []).findIndex(l => l.type === type);
         if (existingIndex >= 0) {
             const newLinks = [...(formData.socialLinks || [])];
             newLinks[existingIndex] = { ...newLinks[existingIndex], url: value };
             setFormData(prev => ({ ...prev, socialLinks: newLinks }));
         } else {
             const newLink: SocialLink = {
               id: `${type}-${Date.now()}`,
               type,
               url: value,
               label: selectedPlatform.label,
             };
             setFormData(prev => ({ ...prev, socialLinks: [...(prev.socialLinks || []), newLink] }));
         }
      } else {
         setFormData(prev => ({
           ...prev,
           socialLinks: (prev.socialLinks || []).filter(l => l.type !== type),
         }));
      }
    }
    setIsLinkModalOpen(false);
  };

  // Render Links Tab
  const renderLinksTab = () => {
    // Determine active links for visual state in grid
    const activeTypes = new Set((formData.socialLinks || []).map(l => l.type));
    if (formData.phone) activeTypes.add('phone');
    if (formData.email) activeTypes.add('email');
    if (formData.website) activeTypes.add('website');
    if (formData.address) activeTypes.add('address');

    return (
      <div className="space-y-6">
        {/* All Links Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t.availableLinks}</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {SOCIAL_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              
              // Check active state
              let coreValue = '';
              if (platform.type === 'phone') coreValue = formData.phone;
              else if (platform.type === 'email') coreValue = formData.email;
              else if (platform.type === 'website') coreValue = formData.website;
              else if (platform.type === 'address') coreValue = formData.address || '';
              else {
                const sl = (formData.socialLinks || []).find(l => l.type === platform.type);
                if (sl) coreValue = sl.url;
              }

              const isActive = !!coreValue;

              return (
                <button
                  key={platform.type}
                  onClick={() => handleGridIconClick(platform)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-green-500/10 border-green-500/50 hover:bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.5)] scale-110' : 'bg-white/10'
                  }`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'text-green-500 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'text-foreground'}`} />
                  </div>
                  <div className="text-center w-full">
                    <span className={`text-xs block ${isActive ? 'text-green-500 font-medium' : 'text-muted-foreground'}`}>
                      {platform.label}
                    </span>
                    {isActive && (
                      <div className="mt-1 flex flex-col items-center animate-in fade-in slide-in-from-bottom-1">
                        <span className="text-[10px] text-green-500/80 font-medium">
                          {isRTL ? 'نشط' : 'Active'}
                        </span>
                        <span className="text-[10px] text-green-500/60 truncate max-w-[100px] block" title={coreValue}>
                          {coreValue}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Link Edit Modal */}
        <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-[#fcfefd] dark:bg-[#0c0f14] border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedPlatform && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <selectedPlatform.icon className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span>{selectedPlatform?.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="link-active" className="flex flex-col space-y-1">
                  <span>{isRTL ? 'تفعيل' : 'Enable'}</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    {isRTL ? 'إظهار هذا الرابط في البطاقة' : 'Show this link on your card'}
                  </span>
                </Label>
                <Switch
                  id="link-active"
                  checked={isLinkActive}
                  onCheckedChange={setIsLinkActive}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">
                  {selectedPlatform?.type === 'phone' ? (isRTL ? 'رقم الهاتف' : 'Phone Number') :
                   selectedPlatform?.type === 'email' ? (isRTL ? 'البريد الإلكتروني' : 'Email Address') :
                   selectedPlatform?.type === 'address' ? (isRTL ? 'العنوان' : 'Address') :
                   (isRTL ? 'الرابط / المعرف' : 'URL / Username')}
                </Label>
                <Input
                  id="link-url"
                  value={linkModalValue}
                  onChange={(e) => setLinkModalValue(e.target.value)}
                  placeholder={selectedPlatform?.placeholder}
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSaveLinkFromModal} className="w-full">
                {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Color palette for text colors
  const TEXT_COLORS = [
    { id: 'default', color: '', label: 'Default' },
    { id: 'white', color: '#ffffff', label: 'White' },
    { id: 'black', color: '#000000', label: 'Black' },
    { id: 'primary', color: '#060541', label: 'Primary' },
    { id: 'blue', color: 'hsl(210, 100%, 65%)', label: 'Blue' },
    { id: 'purple', color: 'hsl(280, 70%, 65%)', label: 'Purple' },
    { id: 'pink', color: 'hsl(320, 75%, 70%)', label: 'Pink' },
    { id: 'green', color: 'hsl(142, 76%, 55%)', label: 'Green' },
    { id: 'orange', color: 'hsl(25, 95%, 60%)', label: 'Orange' },
  ];

  const FONT_FAMILIES = [
    { id: 'system', label: isRTL ? 'النظام' : 'System', className: 'font-sans' },
    { id: 'serif', label: isRTL ? 'كلاسيكي' : 'Serif', className: 'font-serif' },
    { id: 'mono', label: isRTL ? 'مونو' : 'Mono', className: 'font-mono' },
    { id: 'arabic', label: isRTL ? 'عربي' : 'Arabic', className: 'font-arabic' },
  ];

  // Helper to update text style
  const updateTextStyle = (field: 'nameStyle' | 'titleStyle' | 'companyStyle', property: keyof TextStyle, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] || {}),
        [property]: value,
      },
    }));
  };

  const updateMosaicColors = (property: keyof NonNullable<BusinessCardData['mosaicColors']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      mosaicColors: {
        ...(prev.mosaicColors || {}),
        [property]: value,
      },
    }));
  };

  const updateProfessionalColors = (
    property: keyof NonNullable<BusinessCardData['professionalColors']>,
    value: string | number,
  ) => {
    setFormData(prev => ({
      ...prev,
      professionalColors: {
        ...(prev.professionalColors || {}),
        [property]: value,
      },
    }));
  };

  const updateFashionColors = (property: keyof NonNullable<BusinessCardData['fashionColors']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      fashionColors: {
        ...(prev.fashionColors || {}),
        [property]: value,
      },
    }));
  };

  // Text Style Editor Component
  const TextStyleEditor = ({ 
    label, 
    field, 
    style 
  }: { 
    label: string; 
    field: 'nameStyle' | 'titleStyle' | 'companyStyle'; 
    style?: TextStyle;
  }) => (
    <div className="space-y-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
      <h4 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{label}</h4>
      
      {/* Formatting Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateTextStyle(field, 'bold', !style?.bold)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.bold 
              ? 'bg-[hsl(210,100%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'عريض' : 'Bold'}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'underline', !style?.underline)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.underline 
              ? 'bg-[hsl(210,100%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'تسطير' : 'Underline'}
        >
          <Underline className="w-4 h-4" />
        </button>
        
        <div className="w-px h-6 bg-[#060541]/10 dark:bg-white/10 mx-1" />
        
        {/* Alignment */}
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'left')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.alignment === 'left' 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'يسار' : 'Left'}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'center')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            (!style?.alignment || style?.alignment === 'center') 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'وسط' : 'Center'}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateTextStyle(field, 'alignment', 'right')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            style?.alignment === 'right' 
              ? 'bg-[hsl(280,70%,65%)] text-white' 
              : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
          }`}
          aria-label={isRTL ? 'يمين' : 'Right'}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <span className="text-xs text-[#606062] dark:text-[#858384]">{isRTL ? 'اللون' : 'Color'}</span>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => updateTextStyle(field, 'color', c.color)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                (style?.color || '') === c.color 
                  ? 'border-[hsl(210,100%,65%)] ring-2 ring-[hsl(210,100%,65%)]/30' 
                  : 'border-[#060541]/20 dark:border-white/20'
              }`}
              style={{ backgroundColor: c.color || 'transparent' }}
              aria-label={c.label}
            >
              {c.id === 'default' && (
                <span className="text-xs text-[#606062]">A</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <span className="text-xs text-[#606062] dark:text-[#858384]">{isRTL ? 'الخط' : 'Font'}</span>
        <div className="flex flex-wrap gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => updateTextStyle(field, 'fontFamily', f.id as TextStyle['fontFamily'])}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${f.className} ${
                (style?.fontFamily || 'system') === f.id 
                  ? 'bg-[hsl(142,76%,55%)] text-white' 
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Style Tab
  const renderStyleTab = () => (
    <div className="space-y-6">
      {/* Live Preview at TOP */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(210,100%,65%)]/20 via-[hsl(280,70%,65%)]/20 to-[hsl(25,95%,60%)]/20 rounded-3xl blur-xl" />
        <div className="relative">
          <CardPreviewLive 
            data={formData} 
            isFlipped={isPreviewFlipped} 
            handleFlip={() => setIsPreviewFlipped(!isPreviewFlipped)}
            handleAddToWallet={handleAddToWallet}
          />
        </div>
      </div>

      {/* Card Style / Template Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[hsl(280,70%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'نمط البطاقة' : 'Card style'}</h3>
        </div>
        
        {/* Premium style name selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {CARD_TEMPLATES.map((template) => {
            const isSelected = formData.template === template.id;
            const fancyName = (() => {
              switch (template.id) {
                case 'geometric':
                  return isRTL ? 'فسيفساء أورورا' : 'Aurora Mosaic';
                case 'professional':
                  return isRTL ? 'تنفيذي أزرق' : 'Executive Blue';
                case 'fashion':
                  return isRTL ? 'منحنى كوتور' : 'Couture Curve';
                case 'minimal':
                  return isRTL ? 'نوير بسيط' : 'Noir Minimal';
                case 'clean':
                  return isRTL ? 'استوديو نقي' : 'Pure Studio';
                default:
                  return isRTL ? template.nameAr : template.name;
              }
            })();

            return (
              <button
                key={template.id}
                onClick={() => updateField('template', template.id)}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-[hsl(210,100%,65%)] bg-[hsl(210,100%,65%)]/10 shadow-[0_8px_24px_rgba(56,189,248,0.25)]'
                    : 'border-[#060541]/10 dark:border-white/10 hover:border-[hsl(210,100%,65%)]/60'
                }`}
                aria-label={fancyName}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{fancyName}</p>
                  <p className="text-[11px] text-[#606062] dark:text-[#858384]">
                    {isRTL ? template.nameAr : template.name}
                  </p>
                </div>
                <span className={`w-3 h-3 rounded-full ${template.preview} border border-white/50`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Colors - Premium Visual Palette Cards */}
      {(formData.template === 'geometric' || formData.template === 'professional' || formData.template === 'fashion' || formData.template === 'minimal' || formData.template === 'clean') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(25,95%,60%)]" />
            <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'ألوان النمط' : 'Style colors'}</h3>
          </div>
          
          {/* Horizontal scrollable palette grid for mobile */}
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex gap-3 min-w-max">
              {formData.template === 'geometric' && MOSAIC_PALETTES.map((palette) => {
                const isSelected = (formData.mosaicPaletteId || 'rose') === palette.id;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('mosaicPaletteId', palette.id)}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(25,95%,60%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(25,95%,60%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden">
                      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                        <div style={{ backgroundColor: palette.colors.light }} />
                        <div style={{ backgroundColor: palette.colors.mid }} />
                        <div style={{ backgroundColor: palette.colors.dark }} />
                        <div style={{ backgroundColor: palette.colors.deepest }} />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(25,95%,60%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}


              {formData.template === 'professional' && PROFESSIONAL_PALETTES.map((palette) => {
                const isSelected = formData.professionalColors?.band === palette.band && formData.professionalColors?.ring === palette.ring;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('professionalColors', {
                      band: palette.band,
                      ring: palette.ring,
                      line: palette.band,
                      lineHeight: 6,
                      bandHeight: 60,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(210,100%,65%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(210,100%,65%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden flex flex-col">
                      <div className="flex-1" style={{ backgroundColor: palette.band }} />
                      <div className="h-4 flex items-center justify-center" style={{ backgroundColor: palette.ring }}>
                        <div className="w-3 h-3 rounded-full border-2 border-white/80" />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
              
              {formData.template === 'fashion' && FASHION_PALETTES.map((palette) => {
                const isSelected = formData.fashionColors?.curve === palette.curve && formData.fashionColors?.star === palette.star;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('fashionColors', { 
                      curve: palette.curve, 
                      star: palette.star,
                      starGlow: formData.fashionColors?.starGlow ?? false,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(320,75%,70%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(320,75%,70%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative bg-gray-100">
                      <div className="absolute bottom-0 left-0 right-0 h-2/3 rounded-t-full" style={{ backgroundColor: palette.curve }} />
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: palette.star }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(320,75%,70%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              {formData.template === 'minimal' && MINIMAL_PALETTES.map((palette) => {
                const isSelected = formData.minimalColors?.background === palette.background && formData.minimalColors?.accent === palette.accent;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('minimalColors', {
                      background: palette.background,
                      header: palette.header,
                      accent: palette.accent,
                      text: palette.text,
                      muted: palette.muted,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[#1f2937] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[#1f2937]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative" style={{ backgroundColor: palette.background }}>
                      <div className="absolute top-0 left-0 right-0 h-1/3" style={{ backgroundColor: palette.header }} />
                      <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full" style={{ backgroundColor: palette.muted }} />
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1f2937] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              {formData.template === 'clean' && CLEAN_PALETTES.map((palette) => {
                const isSelected = formData.cleanColors?.background === palette.background && formData.cleanColors?.accent === palette.accent;
                return (
                  <button
                    key={palette.id}
                    onClick={() => updateField('cleanColors', {
                      background: palette.background,
                      header: palette.header,
                      accent: palette.accent,
                      text: palette.text,
                      muted: palette.muted,
                    })}
                    className={`relative p-2 rounded-xl transition-all flex-shrink-0 w-[72px] ${
                      isSelected
                        ? 'ring-2 ring-[hsl(210,100%,65%)] ring-offset-2 ring-offset-white dark:ring-offset-[#0c0f14] bg-[hsl(210,100%,65%)]/10'
                        : 'hover:scale-105 bg-[#fcfefd] dark:bg-[#0c0f14]/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative" style={{ backgroundColor: palette.background }}>
                      <div className="absolute top-0 left-0 right-0 h-1/3" style={{ backgroundColor: palette.header }} />
                      <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full" style={{ backgroundColor: palette.muted }} />
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <p className="text-[10px] font-medium text-center mt-1.5 text-[#060541] dark:text-[#f2f2f2] truncate">
                      {isRTL ? palette.labelAr : palette.label}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(210,100%,65%)] flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fashion Advanced Controls - Mobile Friendly */}
          {formData.template === 'fashion' && (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون النجمة' : 'Star color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateField('fashionColors', {
                          ...formData.fashionColors,
                          star: color.color,
                        })}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          formData.fashionColors?.star === color.color
                            ? 'border-[hsl(320,75%,70%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'توهج النجمة' : 'Star glow'}
                  </p>
                  <button
                    onClick={() => updateField('fashionColors', {
                      ...formData.fashionColors,
                      starGlow: !formData.fashionColors?.starGlow,
                    })}
                    className={`w-full py-2 rounded-lg text-[11px] font-medium transition-all ${
                      formData.fashionColors?.starGlow
                        ? 'bg-[hsl(320,75%,70%)] text-white'
                        : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                    }`}
                  >
                    {formData.fashionColors?.starGlow 
                      ? (isRTL ? 'مُفعّل ✨' : 'ON ✨') 
                      : (isRTL ? 'مُعطّل' : 'OFF')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Advanced Controls - Mobile Friendly */}
          {formData.template === 'professional' && (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون الخط' : 'Line color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateProfessionalColors('line', color.color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          (formData.professionalColors?.line || formData.professionalColors?.band) === color.color
                            ? 'border-[hsl(210,100%,65%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'لون الدائرة' : 'Circle color'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.filter(color => color.id !== 'default').slice(0, 6).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => updateProfessionalColors('ring', color.color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          (formData.professionalColors?.ring || PROFESSIONAL_PALETTES[0].ring) === color.color
                            ? 'border-[hsl(280,70%,65%)] scale-110'
                            : 'border-white/60'
                        }`}
                        style={{ backgroundColor: color.color }}
                        aria-label={color.label}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'سماكة الخط' : 'Line thickness'}
                  </p>
                  <div className="flex gap-1.5">
                    {[4, 6, 8].map((height) => (
                      <button
                        key={height}
                        onClick={() => updateProfessionalColors('lineHeight', height)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          (formData.professionalColors?.lineHeight ?? 6) === height
                            ? 'bg-[hsl(210,100%,65%)] text-white'
                            : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                        }`}
                      >
                        {height}px
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
                  <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                    {isRTL ? 'ارتفاع الشريط' : 'Band height'}
                  </p>
                  <div className="flex gap-1.5">
                    {[50, 60, 70].map((height) => (
                      <button
                        key={height}
                        onClick={() => updateProfessionalColors('bandHeight', height)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          (formData.professionalColors?.bandHeight ?? 60) === height
                            ? 'bg-[hsl(210,100%,65%)] text-white'
                            : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
                        }`}
                      >
                        {height}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logo Position */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[hsl(25,95%,60%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'موضع الشعار' : 'Logo position'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {[
            { id: 'top-left', label: isRTL ? 'أعلى يسار' : 'Top Left' },
            { id: 'top-right', label: isRTL ? 'أعلى يمين' : 'Top Right' },
            { id: 'bottom-left', label: isRTL ? 'أسفل يسار' : 'Bottom Left' },
            { id: 'bottom-right', label: isRTL ? 'أسفل يمين' : 'Bottom Right' },
          ].map((pos) => (
            <button
              key={pos.id}
              onClick={() => updateField('logoPosition', pos.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                (formData.logoPosition || 'top-right') === pos.id
                  ? 'bg-[hsl(25,95%,60%)] text-white'
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo Shape */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[hsl(210,100%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'شكل الصورة' : 'Photo shape'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10">
          {[
            { id: 'circle', label: isRTL ? 'دائرة' : 'Circle' },
            { id: 'square', label: isRTL ? 'مربع' : 'Square' },
          ].map((shape) => (
            <button
              key={shape.id}
              onClick={() => updateField('photoShape', shape.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                (formData.photoShape || 'circle') === shape.id
                  ? 'bg-[hsl(210,100%,65%)] text-white'
                  : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384] hover:bg-[#060541]/20 dark:hover:bg-white/20'
              }`}
            >
              {shape.label}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Styling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[hsl(142,76%,55%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'تنسيق الأيقونات' : 'Icon styling'}</h3>
        </div>
        
        <div className="p-4 rounded-xl bg-[#fcfefd] dark:bg-[#0c0f14]/80 border border-[#060541]/10 dark:border-white/10 space-y-4">
          {/* Use Brand Colors Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'استخدام ألوان العلامات التجارية' : 'Use brand colors'}
              </p>
              <p className="text-[10px] text-[#606062] dark:text-[#858384]">
                {isRTL ? 'ألوان افتراضية لكل منصة' : 'Default colors for each platform'}
              </p>
            </div>
            <Switch
              checked={formData.iconStyle?.useBrandColors !== false}
              onCheckedChange={(checked) => updateField('iconStyle', {
                ...formData.iconStyle,
                useBrandColors: checked,
              })}
            />
          </div>

          {/* Icon Background Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'خلفية الأيقونة' : 'Icon background'}
              </p>
              <p className="text-[10px] text-[#606062] dark:text-[#858384]">
                {isRTL ? 'دائرة خلف الأيقونة مع ظل' : 'Circle behind icon with shadow'}
              </p>
            </div>
            <Switch
              checked={formData.iconStyle?.showBackground ?? true}
              onCheckedChange={(checked) => updateField('iconStyle', {
                ...formData.iconStyle,
                showBackground: checked,
              })}
            />
          </div>

          {/* Background Color (only if showBackground is true) */}
          {(formData.iconStyle?.showBackground ?? true) && (
            <div>
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                {isRTL ? 'لون الخلفية' : 'Background color'}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'black', color: '#000000', label: 'Black' },
                  { id: 'white', color: '#ffffff', label: 'White' },
                  { id: 'gray', color: '#6b7280', label: 'Gray' },
                  { id: 'blue', color: '#3b82f6', label: 'Blue' },
                  { id: 'purple', color: '#8b5cf6', label: 'Purple' },
                  { id: 'transparent', color: 'transparent', label: 'None' },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => updateField('iconStyle', {
                      ...formData.iconStyle,
                      backgroundColor: bg.color,
                    })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      (formData.iconStyle?.backgroundColor || '#000000') === bg.color
                        ? 'border-[hsl(142,76%,55%)] scale-110 ring-2 ring-[hsl(142,76%,55%)]/30'
                        : 'border-white/60 dark:border-white/30'
                    } ${bg.id === 'transparent' ? 'bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-600 dark:to-gray-800' : ''}`}
                    style={{ backgroundColor: bg.id !== 'transparent' ? bg.color : undefined }}
                    title={bg.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Color Intensity Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2]">
                {isRTL ? 'شفافية الخلفية' : 'BG opacity'}
              </p>
              <span className="text-[10px] text-[#606062] dark:text-[#858384]">
                {formData.iconStyle?.colorIntensity ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={formData.iconStyle?.colorIntensity ?? 50}
              disabled={!((formData.iconStyle?.showBackground ?? true))}
              onChange={(e) => updateField('iconStyle', {
                ...formData.iconStyle,
                colorIntensity: parseInt(e.target.value),
              })}
              className={`w-full h-1.5 bg-[#060541]/10 dark:bg-white/10 rounded-lg appearance-none ${
                (formData.iconStyle?.showBackground ?? true) ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
              }`}
              id="color-intensity-slider"
              title="BG opacity"
              aria-label={isRTL ? 'شفافية الخلفية' : 'BG opacity'}
            />
            <label htmlFor="color-intensity-slider" className="sr-only">
              {isRTL ? 'شفافية الخلفية' : 'BG opacity'}
            </label>
          </div>

          {/* Custom Icon Color (only if not using brand colors) */}
          {formData.iconStyle?.useBrandColors === false && (
            <div>
              <p className="text-[11px] font-semibold text-[#060541] dark:text-[#f2f2f2] mb-2">
                {isRTL ? 'لون الأيقونة' : 'Icon color'}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'white', color: '#ffffff', label: 'White' },
                  { id: 'black', color: '#000000', label: 'Black' },
                  { id: 'blue', color: '#3b82f6', label: 'Blue' },
                  { id: 'green', color: '#22c55e', label: 'Green' },
                  { id: 'purple', color: '#8b5cf6', label: 'Purple' },
                  { id: 'pink', color: '#ec4899', label: 'Pink' },
                  { id: 'orange', color: '#f97316', label: 'Orange' },
                  { id: 'red', color: '#ef4444', label: 'Red' },
                ].map((ic) => (
                  <button
                    key={ic.id}
                    onClick={() => updateField('iconStyle', {
                      ...formData.iconStyle,
                      iconColor: ic.color,
                    })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      (formData.iconStyle?.iconColor || '#ffffff') === ic.color
                        ? 'border-[hsl(142,76%,55%)] scale-110 ring-2 ring-[hsl(142,76%,55%)]/30'
                        : 'border-white/60 dark:border-white/30'
                    }`}
                    style={{ backgroundColor: ic.color }}
                    title={ic.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text Customization */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-[hsl(210,100%,65%)]" />
          <h3 className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{isRTL ? 'تخصيص النص' : 'Text customization'}</h3>
        </div>
        
        <TextStyleEditor 
          label={isRTL ? 'الاسم' : 'Name'} 
          field="nameStyle" 
          style={formData.nameStyle} 
        />
        <TextStyleEditor 
          label={isRTL ? 'المسمى الوظيفي' : 'Job Title'} 
          field="titleStyle" 
          style={formData.titleStyle} 
        />
        <TextStyleEditor 
          label={isRTL ? 'الشركة' : 'Company'} 
          field="companyStyle" 
          style={formData.companyStyle} 
        />
      </div>
    </div>
  );

  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadQr = async () => {
    try {
      const svgElement = qrRef.current?.querySelector('svg');
      if (!svgElement) {
        toast.error("Could not find QR code");
        return;
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;
      
      // Set explicit dimensions
      clonedSvg.setAttribute('width', '400');
      clonedSvg.setAttribute('height', '400');
      
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // White background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 0, 0, 400, 400);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${formData.firstName || 'Wakti'}_QR_Code.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast.success(isRTL ? 'تم تحميل رمز QR!' : 'QR Code downloaded!');
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(svgUrl);
      };

      img.onerror = () => {
        toast.error("Failed to generate QR image");
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    } catch (error) {
      console.error('QR Download error:', error);
      toast.error("Failed to download QR code");
    }
  };

  const handleAddToWallet = async () => {
    // Validate required fields
    if (!formData.firstName || !formData.lastName) {
      toast.error(isRTL ? 'يرجى إدخال الاسم الأول والأخير' : 'Please enter first and last name');
      return;
    }

    try {
      const cardUrl = `${window.location.origin}/card/${encodeURIComponent(formData.firstName.toLowerCase())}-${encodeURIComponent(formData.lastName.toLowerCase())}`;
      
      // Prepare card data for the pass
      const cardData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || '',
        phone: formData.phone || '',
        company: formData.companyName || '',
        jobTitle: formData.jobTitle || '',
        website: formData.website || '',
        cardUrl,
        profilePhotoUrl: formData.profilePhotoUrl || '',
        logoUrl: formData.logoUrl || '',
      };
      
      // Check if we're running in the Natively wrapper with Wallet support
      if (isWalletSupported()) {
        // Use the native SDK to add to wallet directly
        console.log('Using Natively Wallet SDK');
        const loadingToastId = toast.loading(isRTL ? 'جارٍ إنشاء بطاقة المحفظة...' : 'Preparing Apple Wallet pass...');
        addBusinessCardToWallet(cardData, (result) => {
          toast.dismiss(loadingToastId);
          if (result.status === 'SUCCESS') {
            toast.success(isRTL ? 'تمت إضافة البطاقة إلى المحفظة' : 'Card added to Apple Wallet');
          } else {
            toast.error(result.error || (isRTL ? 'فشل في إضافة البطاقة إلى المحفظة' : 'Failed to add card to wallet'));
          }
        });
      } else {
        // Web fallback - open in Safari which handles .pkpass files natively
        console.log('Opening wallet pass URL in Safari');

        const jsonString = JSON.stringify(cardData);
        const base64 = btoa(unescape(encodeURIComponent(jsonString)));
        const urlSafeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const passUrl = `https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-wallet-pass?data=${urlSafeBase64}`;

        // If running in Natively app, open in external Safari
        // Safari handles .pkpass files natively and shows Add to Wallet prompt
        if (isNativelyApp()) {
          console.log('Detected Natively app - opening in Safari');
          openInSafari(passUrl);
        } else {
          // Regular browser - just navigate
          window.location.href = passUrl;
        }
      }
    } catch (error) {
      console.error('Wallet pass error:', error);
      toast.error(isRTL ? 'فشل في إنشاء بطاقة المحفظة' : 'Failed to generate wallet pass');
    }
  };

  const handleSetAsWidget = async () => {
    try {
      const cardUrl = `${window.location.origin}/card/${encodeURIComponent(formData.firstName.toLowerCase())}-${encodeURIComponent(formData.lastName.toLowerCase())}`;
      
      // Check if Natively Widget SDK is available (user is in native app)
      if (isWidgetSupported()) {
        // This is how Blinq does it - using the native SDK to create real widgets
        // Set the widget data for the business card
        setBusinessCardWidget({
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.companyName,
          cardUrl: cardUrl
        }, (result) => {
          if (result.status === 'SUCCESS') {
            // Open the iOS widget picker
            openWidgetSettings((settingsResult) => {
              if (settingsResult.status === 'SUCCESS') {
                toast.success(isRTL ? 'تم إعداد الويدجت بنجاح!' : 'Widget set up successfully!');
              } else {
                toast.error(settingsResult.error || (isRTL ? 'فشل في فتح إعدادات الويدجت' : 'Failed to open widget settings'));
              }
            });
          } else {
            toast.error(result.error || (isRTL ? 'فشل في إعداد الويدجت' : 'Failed to set up widget'));
          }
        });
      } else {
        // Fallback for web: generate QR image for photo widget
        const svgElement = qrRef.current?.querySelector('svg');
        if (!svgElement) {
          toast.error(isRTL ? 'لم يتم العثور على رمز QR' : 'QR code not found');
          return;
        }

        // Clone and resize SVG for better widget quality
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;
        clonedSvg.setAttribute('width', '512');
        clonedSvg.setAttribute('height', '512');
        
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 512);
            ctx.drawImage(img, 0, 0, 512, 512);
            
            canvas.toBlob(async (blob) => {
              if (blob) {
                const fileName = `${formData.firstName}_${formData.lastName}_QR.png`;
                const pngFile = new File([blob], fileName, { type: 'image/png' });
                
                // Use native share to save to Photos (iOS)
                if (navigator.share && (navigator as any).canShare?.({ files: [pngFile] })) {
                  try {
                    await navigator.share({
                      files: [pngFile],
                      title: isRTL ? 'رمز QR للبطاقة' : 'Business Card QR Code',
                    });
                    toast.success(isRTL ? 'احفظ الصورة ثم أضفها كويدجت صور' : 'Save to Photos, then add as Photo Widget', {
                      description: isRTL 
                        ? 'اضغط مطولاً على الشاشة الرئيسية > أضف ويدجت > الصور'
                        : 'Long press home screen > Add Widget > Photos'
                    });
                  } catch (shareErr) {
                    // User cancelled or share failed - fallback to download
                    downloadQrAsFile(blob, fileName);
                  }
                } else {
                  // Fallback: download the file
                  downloadQrAsFile(blob, fileName);
                }
              }
            }, 'image/png');
          }
          URL.revokeObjectURL(svgUrl);
        };

        img.onerror = () => {
          toast.error(isRTL ? 'فشل في إنشاء صورة QR' : 'Failed to generate QR image');
          URL.revokeObjectURL(svgUrl);
        };

        img.src = svgUrl;
      }
    } catch (error) {
      console.error('Widget setup error:', error);
      toast.error(isRTL ? 'فشل في إعداد الويدجت' : 'Failed to set up widget');
    }
  };

  const downloadQrAsFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تحميل صورة QR' : 'QR image downloaded', {
      description: isRTL 
        ? 'أضفها كويدجت صور على شاشتك الرئيسية'
        : 'Add it as a Photo Widget on your home screen'
    });
  };

  // Render QR Code Tab
  const renderQrCodeTab = () => (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">{t.yourQrCode}</h3>
      
      {/* QR Code Display */}
      <div className="flex flex-col items-center p-6 rounded-2xl bg-white border border-gray-200">
        <div ref={qrRef} className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
          <QRCodeSVG 
            value={`${window.location.origin}/card/${formData.firstName.toLowerCase()}-${formData.lastName.toLowerCase()}`}
            size={160}
            level="H"
            includeMargin={false}
            imageSettings={{
              src: "/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png",
              x: undefined,
              y: undefined,
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-4">{t.scanToConnect}</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button 
          onClick={handleDownloadQr}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600"
        >
          <QrCode className="w-5 h-5 mr-2" />
          {t.downloadQr}
        </Button>

        {/* Add to Apple Wallet */}
        <Button 
          onClick={handleAddToWallet}
          className="w-full h-12 bg-black text-white hover:bg-gray-900"
        >
          <Smartphone className="w-5 h-5 mr-2" />
          {isRTL ? 'إضافة إلى المحفظة' : 'Add to Apple Wallet'}
        </Button>

        {/* Save to Photos for Widget */}
        <Button 
          onClick={handleSetAsWidget}
          className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
        >
          <LayoutGrid className="w-5 h-5 mr-2" />
          {isRTL ? 'حفظ للويدجت' : 'Save for Widget'}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-blue-500/5 ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 -ml-2 rounded-xl bg-gradient-to-r from-[#060541]/10 to-[#060541]/5 dark:from-white/10 dark:to-white/5 hover:from-[#060541]/20 hover:to-[#060541]/10 dark:hover:from-white/20 dark:hover:to-white/10 border border-[#060541]/10 dark:border-white/10 transition-all active:scale-95"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span className="text-sm font-medium">{isRTL ? 'بطاقاتي' : 'My Cards'}</span>
        </button>
        <h1 className="text-lg font-bold">{t.builder}</h1>
        <div className="flex items-center gap-2">
          {/* Auto-save toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              autoSaveEnabled
                ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                : 'bg-[#060541]/10 dark:bg-white/10 text-[#606062] dark:text-[#858384]'
            }`}
          >
            {autoSaveEnabled ? (
              <>
                <Check className="w-3 h-3 inline mr-1" />
                {isRTL ? 'تلقائي' : 'Auto'}
              </>
            ) : (
              <>
                <Power className="w-3 h-3 inline mr-1" />
                {isRTL ? 'يدوي' : 'Manual'}
              </>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 px-3 text-xs font-semibold text-white bg-gradient-to-r from-[#060541] via-[hsl(260,70%,25%)] to-[#060541] shadow-[0_0_16px_rgba(6,5,65,0.35)] hover:shadow-[0_0_24px_rgba(6,5,65,0.5)] hover:-translate-y-0.5 active:translate-y-0"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                <span>{isRTL ? 'جارٍ الحفظ' : 'Saving'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t.save}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'links' && renderLinksTab()}
        {activeTab === 'style' && renderStyleTab()}
        {activeTab === 'qrcode' && renderQrCodeTab()}
      </div>
    </div>
  );
};

// Helper to generate text style classes
const getTextStyleClasses = (style?: TextStyle): string => {
  const classes: string[] = [];
  
  if (style?.bold) classes.push('font-bold');
  if (style?.underline) classes.push('underline');
  
  if (style?.alignment === 'left') classes.push('text-left');
  else if (style?.alignment === 'right') classes.push('text-right');
  else classes.push('text-center');
  
  if (style?.fontFamily === 'serif') classes.push('font-serif');
  else if (style?.fontFamily === 'mono') classes.push('font-mono');
  
  return classes.join(' ');
};

// Live Card Preview Component - 5 Premium Business Card Designs
interface CardPreviewLiveProps {
  data: BusinessCardData;
  isFlipped: boolean;
  handleFlip: () => void;
  handleAddToWallet: () => void;
}

const CardPreviewLive = ({ data, isFlipped, handleFlip, handleAddToWallet }: CardPreviewLiveProps) => {
  const template = CARD_TEMPLATES.find(t => t.id === data.template) || CARD_TEMPLATES[0];
  const mosaicPalette = MOSAIC_PALETTES.find(p => p.id === (data.mosaicPaletteId || 'rose')) || MOSAIC_PALETTES[0];
  const mosaicColors = {
    ...mosaicPalette.colors,
    ...(data.mosaicColors || {}),
  };
  const professionalPalette = PROFESSIONAL_PALETTES[0];
  const professionalColors = {
    band: data.professionalColors?.band || professionalPalette.band,
    ring: data.professionalColors?.ring || professionalPalette.ring,
    line: data.professionalColors?.line || data.professionalColors?.band || professionalPalette.band,
    lineHeight: data.professionalColors?.lineHeight ?? 6,
    bandHeight: data.professionalColors?.bandHeight ?? 60,
  };
  const fashionPalette = FASHION_PALETTES[0];
  const fashionColors = {
    curve: data.fashionColors?.curve || fashionPalette.curve,
    star: data.fashionColors?.star || fashionPalette.star,
    starGlow: data.fashionColors?.starGlow ?? false,
  };
  const minimalPalette = MINIMAL_PALETTES[0];
  const minimalColors = {
    background: data.minimalColors?.background || minimalPalette.background,
    header: data.minimalColors?.header || minimalPalette.header,
    accent: data.minimalColors?.accent || minimalPalette.accent,
    text: data.minimalColors?.text || minimalPalette.text,
    muted: data.minimalColors?.muted || minimalPalette.muted,
  };
  const cleanPalette = CLEAN_PALETTES[0];
  const cleanColors = {
    background: data.cleanColors?.background || cleanPalette.background,
    header: data.cleanColors?.header || cleanPalette.header,
    accent: data.cleanColors?.accent || cleanPalette.accent,
    text: data.cleanColors?.text || cleanPalette.text,
    muted: data.cleanColors?.muted || cleanPalette.muted,
  };
  const photoShapeClass = data.photoShape === 'square' ? 'rounded-xl' : 'rounded-full';
  const photoShapeInnerClass = data.photoShape === 'square' ? 'rounded-lg' : 'rounded-full';
  const logoPositionClass =
    data.logoPosition === 'top-left'
      ? 'top-3 left-3'
      : data.logoPosition === 'bottom-left'
        ? 'bottom-3 left-3'
        : data.logoPosition === 'bottom-right'
          ? 'bottom-3 right-3'
          : 'top-3 right-3';

  // Icon style settings with defaults
  const iconStyle = {
    showBackground: data.iconStyle?.showBackground ?? true,
    backgroundColor: data.iconStyle?.backgroundColor || '#000000',
    iconColor: data.iconStyle?.iconColor || '#ffffff',
    useBrandColors: data.iconStyle?.useBrandColors !== false,
    colorIntensity: data.iconStyle?.colorIntensity ?? 50,
  };

  // Helper to get all active links for display with TRUE brand icons and colors
  const activeLinks = [
    ...(data.phone ? [{ type: 'phone', url: data.phone, icon: Phone, brandIcon: null, label: 'Phone', color: '#22c55e', gradient: null }] : []),
    ...(data.email ? [{ type: 'email', url: data.email, icon: Mail, brandIcon: null, label: 'Email', color: '#ef4444', gradient: null }] : []),
    ...(data.website ? [{ type: 'website', url: data.website, icon: Globe, brandIcon: null, label: 'Website', color: '#3b82f6', gradient: null }] : []),
    ...(data.address ? [{ type: 'address', url: data.address, icon: MapPin, brandIcon: null, label: 'Address', color: '#f97316', gradient: null }] : []),
    ...(data.socialLinks || []).map(link => {
      const platform = SOCIAL_PLATFORMS.find(p => p.type === link.type);
      return {
        type: link.type,
        url: link.url,
        icon: platform?.icon || Link2,
        brandIcon: (platform as any)?.brandIcon || null,
        label: platform?.label || link.label || 'Link',
        color: platform?.color || '#6b7280',
        gradient: (platform as any)?.gradient || null
      };
    })
  ];

  const getLinkHref = (link: { type: string; url: string }) => {
    const value = link.url?.trim() || '';
    
    if (link.type === 'phone') return `tel:${value}`;
    if (link.type === 'email') return `mailto:${value}`;
    if (link.type === 'address') return `https://maps.google.com/?q=${encodeURIComponent(value)}`;
    
    // WhatsApp - format: wa.me/phonenumber (without + or spaces)
    if (link.type === 'whatsapp') {
      const cleanNumber = value.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanNumber}`;
    }
    
    // Instagram - format: instagram.com/username (remove @ if present)
    if (link.type === 'instagram') {
      const username = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '');
      return `https://instagram.com/${username}`;
    }
    
    // Twitter/X - format: x.com/username (remove @ if present)
    if (link.type === 'twitter') {
      const username = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/?/, '');
      return `https://x.com/${username}`;
    }
    
    // Telegram - format: t.me/username (remove @ if present)
    if (link.type === 'telegram') {
      const username = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?t\.me\/?/, '');
      return `https://t.me/${username}`;
    }
    
    // LinkedIn - ensure proper URL format
    if (link.type === 'linkedin') {
      if (value.startsWith('http')) return value;
      if (value.includes('linkedin.com')) return `https://${value}`;
      return `https://linkedin.com/in/${value}`;
    }
    
    // Facebook - ensure proper URL format
    if (link.type === 'facebook') {
      if (value.startsWith('http')) return value;
      if (value.includes('facebook.com')) return `https://${value}`;
      return `https://facebook.com/${value}`;
    }
    
    // YouTube - ensure proper URL format
    if (link.type === 'youtube') {
      if (value.startsWith('http')) return value;
      if (value.includes('youtube.com')) return `https://${value}`;
      return `https://youtube.com/${value}`;
    }
    
    // GitHub - ensure proper URL format
    if (link.type === 'github') {
      if (value.startsWith('http')) return value;
      if (value.includes('github.com')) return `https://${value}`;
      return `https://github.com/${value}`;
    }
    
    // Calendly - ensure proper URL format
    if (link.type === 'calendly') {
      if (value.startsWith('http')) return value;
      if (value.includes('calendly.com')) return `https://${value}`;
      return `https://calendly.com/${value}`;
    }
    
    // Default: add https if missing
    if (!value.startsWith('http')) return `https://${value}`;
    return value;
  };

  // Helper to get the OUTER background circle (bigger circle behind the icon)
  const getOuterBgStyle = () => {
    if (!iconStyle.showBackground) {
      return 'transparent';
    }
    const opacity = iconStyle.colorIntensity / 100;
    const hex = iconStyle.backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleFlipInternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleFlip();
  };

  const renderFront = () => {
    if (template.headerStyle === 'mosaic') {
      // STYLE 1: Geometric Mosaic
      return (
        <div className="w-full h-full rounded-[20px] bg-white flex flex-col items-center relative pb-6 overflow-hidden">
          {/* Mosaic Header */}
          <div className="w-full h-[192px] rounded-t-[20px] overflow-hidden shrink-0">
            {data.coverPhotoUrl ? (
              <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-full h-full" viewBox="0 0 300 192" preserveAspectRatio="none">
                {/* Row 1 */}
                <polygon points="0,0 50,0 25,40" fill={mosaicColors.light} />
                <polygon points="50,0 25,40 75,40" fill={mosaicColors.mid} />
                <polygon points="50,0 100,0 75,40" fill={mosaicColors.dark} />
                <polygon points="100,0 75,40 125,40" fill={mosaicColors.mid} />
                <polygon points="100,0 150,0 125,40" fill={mosaicColors.light} />
                <polygon points="150,0 125,40 175,40" fill={mosaicColors.mid} />
                <polygon points="150,0 200,0 175,40" fill={mosaicColors.dark} />
                <polygon points="200,0 175,40 225,40" fill={mosaicColors.mid} />
                <polygon points="200,0 250,0 225,40" fill={mosaicColors.light} />
                <polygon points="250,0 225,40 275,40" fill={mosaicColors.dark} />
                <polygon points="250,0 300,0 275,40" fill={mosaicColors.mid} />
                <polygon points="300,0 275,40 300,40" fill={mosaicColors.light} />
                {/* Row 2 */}
                <polygon points="0,40 25,40 0,80" fill={mosaicColors.dark} />
                <polygon points="25,40 0,80 50,80" fill={mosaicColors.mid} />
                <polygon points="25,40 75,40 50,80" fill={mosaicColors.deepest} />
                <polygon points="75,40 50,80 100,80" fill={mosaicColors.dark} />
                <polygon points="75,40 125,40 100,80" fill={mosaicColors.mid} />
                <polygon points="125,40 100,80 150,80" fill={mosaicColors.deepest} />
                <polygon points="125,40 175,40 150,80" fill={mosaicColors.dark} />
                <polygon points="175,40 150,80 200,80" fill={mosaicColors.mid} />
                <polygon points="175,40 225,40 200,80" fill={mosaicColors.dark} />
                <polygon points="225,40 200,80 250,80" fill={mosaicColors.deepest} />
                <polygon points="225,40 275,40 250,80" fill={mosaicColors.mid} />
                <polygon points="275,40 250,80 300,80" fill={mosaicColors.dark} />
                {/* Row 3 */}
                <polygon points="0,80 50,80 25,120" fill={mosaicColors.dark} />
                <polygon points="50,80 25,120 75,120" fill={mosaicColors.deepest} />
                <polygon points="50,80 100,80 75,120" fill={mosaicColors.mid} />
                <polygon points="100,80 75,120 125,120" fill={mosaicColors.dark} />
                <polygon points="100,80 150,80 125,120" fill={mosaicColors.deepest} />
                <polygon points="150,80 125,120 175,120" fill={mosaicColors.mid} />
                <polygon points="150,80 200,80 175,120" fill={mosaicColors.dark} />
                <polygon points="200,80 175,120 225,120" fill={mosaicColors.deepest} />
                <polygon points="200,80 250,80 225,120" fill={mosaicColors.mid} />
                <polygon points="250,80 225,120 275,120" fill={mosaicColors.dark} />
                <polygon points="250,80 300,80 275,120" fill={mosaicColors.deepest} />
                <polygon points="300,80 275,120 300,120" fill={mosaicColors.mid} />
                {/* Row 4 */}
                <polygon points="0,120 25,120 0,160" fill={mosaicColors.deepest} />
                <polygon points="25,120 0,160 50,160" fill={mosaicColors.dark} />
                <polygon points="25,120 75,120 50,160" fill={mosaicColors.deepest} />
                <polygon points="75,120 50,160 100,160" fill={mosaicColors.dark} />
                <polygon points="75,120 125,120 100,160" fill={mosaicColors.deepest} />
                <polygon points="125,120 100,160 150,160" fill={mosaicColors.dark} />
                <polygon points="125,120 175,120 150,160" fill={mosaicColors.deepest} />
                <polygon points="175,120 150,160 200,160" fill={mosaicColors.dark} />
                <polygon points="175,120 225,120 200,160" fill={mosaicColors.deepest} />
                <polygon points="225,120 200,160 250,160" fill={mosaicColors.dark} />
                <polygon points="225,120 275,120 250,160" fill={mosaicColors.deepest} />
                <polygon points="275,120 250,160 300,160" fill={mosaicColors.dark} />
                {/* Bottom row */}
                <rect x="0" y="160" width="300" height="32" fill={mosaicColors.deepest} />
              </svg>
            )}
          </div>
          
          {/* Avatar - Centered, overlapping */}
          <div className={`absolute w-[114px] h-[114px] bg-white ${photoShapeClass} flex justify-center items-center z-10`} style={{ top: '135px' }}>
            <div className={`w-[100px] h-[100px] ${photoShapeInnerClass} overflow-hidden bg-white`}>
              {data.profilePhotoUrl ? (
                <img src={data.profilePhotoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
            </div>
          </div>
          
          {/* Name & Title */}
          <div className="mt-[60px] text-center px-4 w-full">
            <h3 
              className={`text-lg font-medium ${getTextStyleClasses(data.nameStyle)}`}
              style={{ color: data.nameStyle?.color || '#000' }}
            >
              {data.firstName || 'Cameron'} {data.lastName || 'Williamson'}
            </h3>
            <p 
              className={`mt-1 text-[15px] ${getTextStyleClasses(data.titleStyle)}`}
              style={{ color: data.titleStyle?.color || '#78858F' }}
            >
              {data.jobTitle || 'Web Development'}
            </p>
            {data.companyName && (
              <p className="text-xs mt-1 font-medium opacity-80" style={{ color: data.companyStyle?.color || '#000' }}>
                {data.companyName}
              </p>
            )}
            {data.department && (
              <p className="text-xs opacity-70" style={{ color: data.titleStyle?.color || '#78858F' }}>
                {data.department}
              </p>
            )}
            {data.headline && (
              <p className="text-[11px] mt-2 italic px-2 opacity-80" style={{ color: data.nameStyle?.color || '#000' }}>
                {data.headline}
              </p>
            )}
          </div>
          
          {/* Logo */}
          {data.logoUrl && (
            <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-20`}>
              <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          
          {/* All Active Links - with outer background circle */}
          <div className="flex flex-wrap justify-center gap-3 mt-4 px-6 w-full mb-6">
            {activeLinks.map((link, i) => {
              const BrandIcon = link.brandIcon;
              const outerBg = getOuterBgStyle();
              return (
                <a 
                  key={i}
                  href={getLinkHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label || link.type}
                  className="transition-transform hover:scale-110 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Outer background circle (halo) */}
                  {iconStyle.showBackground && (
                    <div 
                      className="absolute inset-0 w-12 h-12 -m-1 rounded-full"
                      style={{ background: outerBg }}
                    />
                  )}
                  {/* Icon circle with brand colors */}
                  <div 
                    className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                    style={{ background: link.gradient || link.color }}
                  >
                    {BrandIcon ? (
                      <BrandIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    ) : (
                      <link.icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      );
    }

    // STYLE 2: Professional
    if (template.headerStyle === 'professional') {
      return (
        <div className="w-full h-full rounded-lg bg-white flex flex-col items-center relative overflow-hidden">
          {/* Cover Photo Background (optional) */}
          {data.coverPhotoUrl && (
            <div className="absolute inset-0 h-24 opacity-20">
              <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Logo */}
          {data.logoUrl && (
            <div className={`absolute ${logoPositionClass} w-8 h-8 rounded-md bg-white/90 p-1 shadow-sm z-50`}>
              <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}

          {/* Avatar section with blue bands */}
          <div className="w-full pt-5 flex items-center justify-center flex-col gap-1">
            <div className="w-full flex items-center justify-center relative">
              {/* Top blue band */}
              <div
                className="absolute w-full top-4"
                style={{ backgroundColor: professionalColors.line, height: `${professionalColors.lineHeight}px` }}
              />
              {/* Bottom blue band */}
              <div
                className="absolute w-full bottom-4"
                style={{ backgroundColor: professionalColors.line, height: `${professionalColors.lineHeight}px` }}
              />
              {/* Avatar */}
              <div className={`w-36 h-36 z-40 ${photoShapeClass} overflow-hidden bg-white border-4`} style={{ borderColor: professionalColors.ring }}>
                {data.profilePhotoUrl ? (
                  <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
                ) : (
                  <div className="w-full h-full bg-[#58b0e0] flex items-center justify-center">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
              </div>
              {/* Blue background behind avatar */}
              <div
                className="absolute z-10 w-full"
                style={{ backgroundColor: professionalColors.band, height: `${professionalColors.bandHeight}%` }}
              />
            </div>
          </div>
          
          {/* Name & Title */}
          <div className="text-center leading-4 mt-2 px-2">
            <p 
              className={`text-xl font-serif font-semibold ${getTextStyleClasses(data.nameStyle)}`}
              style={{ color: data.nameStyle?.color || '#434955' }}
            >
              {(data.firstName || 'ANNA').toUpperCase()} {(data.lastName || 'WILSON').toUpperCase()}
            </p>
            <p 
              className={`text-sm font-semibold mt-1 ${getTextStyleClasses(data.titleStyle)}`}
              style={{ color: data.titleStyle?.color || '#434955' }}
            >
              {(data.jobTitle || 'DEVELOPER').toUpperCase()}
            </p>
            {data.companyName && (
              <p className="text-xs mt-1 font-bold opacity-90" style={{ color: data.companyStyle?.color || '#434955' }}>
                {(data.companyName).toUpperCase()}
              </p>
            )}
            {data.department && (
              <p className="text-[10px] mt-0.5 opacity-80" style={{ color: data.titleStyle?.color || '#434955' }}>
                {(data.department).toUpperCase()}
              </p>
            )}
            {data.headline && (
              <p className="text-xs mt-2 italic opacity-90 px-2 leading-tight" style={{ color: data.nameStyle?.color || '#434955' }}>
                {data.headline}
              </p>
            )}
          </div>
          
          {/* Contact Info - with outer background circle */}
          <div className="flex flex-wrap justify-center gap-3 mt-4 px-4 mb-4">
            {activeLinks.map((link, i) => {
              const BrandIcon = link.brandIcon;
              const outerBg = getOuterBgStyle();
              return (
                <a 
                  key={i}
                  href={getLinkHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label || link.type}
                  className="transition-transform hover:scale-110 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {iconStyle.showBackground && (
                    <div 
                      className="absolute inset-0 w-12 h-12 -m-1 rounded-full"
                      style={{ background: outerBg }}
                    />
                  )}
                  <div 
                    className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                    style={{ background: link.gradient || link.color }}
                  >
                    {BrandIcon ? (
                      <BrandIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    ) : (
                      <link.icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    )}
                  </div>
                </a>
              );
            })}
          </div>
          
          {/* Bottom blue bar */}
          <div className="w-full h-3 mt-auto" style={{ backgroundColor: professionalColors.band }} />
        </div>
      );
    }

    // STYLE 3: Fashion
    if (template.headerStyle === 'fashion') {
      return (
        <div className="w-full h-full rounded-lg bg-white flex flex-col items-center py-8 px-6 gap-3 relative overflow-hidden">
          {/* Cover Photo Background (optional) */}
          {data.coverPhotoUrl && (
            <div className="absolute inset-0 opacity-10">
              <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            </div>
          )}
          
          {/* Logo */}
          {data.logoUrl && (
            <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-50`}>
              <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          
          {/* Decorative star */}
          <div className="absolute -left-[40%] top-0">
            <svg 
              className="rotate-[24deg]" 
              height="200" 
              width="200" 
              viewBox="0 0 24 24" 
              style={{ 
                fill: fashionColors.star,
                filter: fashionColors.starGlow ? `drop-shadow(0 0 12px ${fashionColors.star}) drop-shadow(0 0 24px ${fashionColors.star})` : 'none',
              }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          
          {/* Gray curved background */}
          <div className="absolute rounded-full z-20 left-1/2 top-[44%] h-[110%] w-[110%] -translate-x-1/2" style={{ backgroundColor: fashionColors.curve }} />
          
          {/* Title */}
          {data.companyName && (
            <div className="uppercase text-center leading-none z-40">
              <p 
                className={`font-bold text-xl tracking-wider ${getTextStyleClasses(data.companyStyle)}`}
                style={{ color: data.companyStyle?.color || '#6b7280' }}
              >
                {data.companyName}
              </p>
            </div>
          )}
          
          {/* Photo */}
          <div className={`w-[180px] aspect-square bg-white z-40 ${photoShapeClass} overflow-hidden shadow-lg`}>
            {data.profilePhotoUrl ? (
              <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <User className="w-20 h-20 text-white/70" />
              </div>
            )}
          </div>

          {/* Name & Details - Added to Fashion template */}
          <div className="z-40 text-center mt-1 px-4 w-full">
            <h3 className={`font-bold text-lg ${getTextStyleClasses(data.nameStyle)}`} style={{ color: data.nameStyle?.color || '#333' }}>
              {data.firstName} {data.lastName}
            </h3>
            <p className={`text-sm ${getTextStyleClasses(data.titleStyle)}`} style={{ color: data.titleStyle?.color || '#666' }}>
              {data.jobTitle}
            </p>
            {data.department && (
              <p className="text-xs text-gray-500 mt-0.5">{data.department}</p>
            )}
            {data.headline && (
              <p className="text-xs mt-1 italic text-gray-600">{data.headline}</p>
            )}
          </div>
          
          {/* Contact Icons - with outer background circle */}
          <div className="z-40 flex flex-wrap justify-center gap-3 mt-2">
            {activeLinks.map((link, i) => {
              const BrandIcon = link.brandIcon;
              const outerBg = getOuterBgStyle();
              return (
                <a 
                  key={i} 
                  href={getLinkHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label || link.type}
                  className="transition-transform hover:scale-110 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {iconStyle.showBackground && (
                    <div 
                      className="absolute inset-0 w-12 h-12 -m-1 rounded-full"
                      style={{ background: outerBg }}
                    />
                  )}
                  <div 
                    className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                    style={{ background: link.gradient || link.color }}
                  >
                    {BrandIcon ? (
                      <BrandIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    ) : (
                      <link.icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      );
    }

    // STYLE 4: Minimal Dark
    if (template.headerStyle === 'minimal') {
      return (
        <div className="w-full h-full rounded-[20px] bg-white flex flex-col overflow-hidden" style={{ backgroundColor: minimalColors.background }}>
          {/* Header with cover */}
          <div className="h-24 relative shrink-0" style={{ backgroundColor: minimalColors.header }}>
            {data.coverPhotoUrl && (
              <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover opacity-50" />
            )}
            {/* Logo */}
            {data.logoUrl && (
              <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/10 p-1`}>
                <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
          
          {/* Avatar */}
          <div className="flex justify-center -mt-14 relative z-10">
            <div className={`w-28 h-28 ${photoShapeClass} border-4 bg-white p-1 shadow-lg`} style={{ borderColor: minimalColors.accent }}>
              {data.profilePhotoUrl ? (
                <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12" style={{ color: minimalColors.muted }} />
                </div>
              )}
            </div>
          </div>
          
          {/* Name & Title */}
          <div className="text-center mt-3 px-5">
            <h3 
              className={`text-xl font-light tracking-wide ${getTextStyleClasses(data.nameStyle)}`}
              style={{ color: data.nameStyle?.color || minimalColors.text }}
            >
              {data.firstName || 'Your'} {data.lastName || 'Name'}
            </h3>
            <p 
              className={`text-sm mt-1 tracking-wider uppercase ${getTextStyleClasses(data.titleStyle)}`}
              style={{ color: data.titleStyle?.color || minimalColors.muted }}
            >
              {data.jobTitle || 'Job Title'}
            </p>
            {data.companyName && (
              <p className="text-xs mt-1 opacity-70" style={{ color: minimalColors.muted }}>{data.companyName}</p>
            )}
            {data.department && (
              <p className="text-xs mt-0.5 opacity-60" style={{ color: minimalColors.muted }}>{data.department}</p>
            )}
            {data.headline && (
              <p className="text-xs mt-2 italic opacity-80" style={{ color: minimalColors.text }}>{data.headline}</p>
            )}
          </div>
          
          {/* Contact Icons - with outer background circle */}
          <div className="flex flex-wrap justify-center gap-3 px-5 py-4">
            {activeLinks.map((link, i) => {
              const BrandIcon = link.brandIcon;
              const outerBg = getOuterBgStyle();
              return (
                <a 
                  key={i} 
                  href={getLinkHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label || link.type}
                  className="transition-transform hover:scale-110 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {iconStyle.showBackground && (
                    <div 
                      className="absolute inset-0 w-12 h-12 -m-1 rounded-full"
                      style={{ background: outerBg }}
                    />
                  )}
                  <div 
                    className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                    style={{ background: link.gradient || link.color }}
                  >
                    {BrandIcon ? (
                      <BrandIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    ) : (
                      <link.icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      );
    }

    // STYLE 5: Clean White
    return (
      <div className="w-full h-full rounded-[20px] bg-white flex flex-col relative overflow-hidden" style={{ backgroundColor: cleanColors.background }}>
        {/* Logo */}
        {data.logoUrl && (
          <div className={`absolute ${logoPositionClass} w-10 h-10 rounded-lg bg-white/90 p-1 shadow-sm z-10`}>
            <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Header */}
        <div className="h-28 relative flex items-center justify-center shrink-0" style={{ backgroundColor: cleanColors.header }}>
          {data.coverPhotoUrl ? (
            <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cleanColors.accent }}>
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
        
        {/* Avatar */}
        <div className="flex justify-start px-5 -mt-8 relative z-10">
          <div className={`w-20 h-20 ${photoShapeClass} border-4 overflow-hidden bg-white shadow-lg`} style={{ borderColor: cleanColors.accent }}>
            {data.profilePhotoUrl ? (
              <img src={data.profilePhotoUrl} alt="" className={`w-full h-full object-contain ${photoShapeInnerClass}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cleanColors.header }}>
                <User className="w-8 h-8" style={{ color: cleanColors.muted }} />
              </div>
            )}
          </div>
        </div>
        
        {/* Name & Title */}
        <div className="px-5 mt-3">
          <h3 
            className={`text-lg font-semibold ${getTextStyleClasses(data.nameStyle)}`}
            style={{ color: data.nameStyle?.color || cleanColors.text }}
          >
            {data.firstName || 'Your'} {data.lastName || 'Name'}
          </h3>
          <p 
            className={`text-sm mt-1 ${getTextStyleClasses(data.titleStyle)}`}
            style={{ color: data.titleStyle?.color || cleanColors.muted }}
          >
            {data.jobTitle || 'Job Title'}
          </p>
          {data.companyName && (
            <p className="text-xs mt-1" style={{ color: cleanColors.muted }}>{data.companyName}</p>
          )}
          {data.department && (
            <p className="text-xs mt-0.5 opacity-80" style={{ color: cleanColors.muted }}>{data.department}</p>
          )}
          {data.headline && (
            <p className="text-xs mt-2 italic opacity-80" style={{ color: cleanColors.text }}>{data.headline}</p>
          )}
        </div>
        
        {/* All Links - with outer background circle */}
        <div className="flex flex-wrap justify-center gap-3 px-5 py-4">
          {activeLinks.map((link, i) => {
            const BrandIcon = link.brandIcon;
            const outerBg = getOuterBgStyle();
            return (
              <a 
                key={i} 
                href={getLinkHref(link)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label || link.type}
                className="transition-transform hover:scale-110 relative"
                onClick={(e) => e.stopPropagation()}
              >
                {iconStyle.showBackground && (
                  <div 
                    className="absolute inset-0 w-12 h-12 -m-1 rounded-full"
                    style={{ background: outerBg }}
                  />
                )}
                <div 
                  className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                  style={{ background: link.gradient || link.color }}
                >
                  {BrandIcon ? (
                    <BrandIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                  ) : (
                    <link.icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBack = () => {
    // Construct the shareable URL (placeholder for now, should be the actual public URL)
    const cardUrl = `${window.location.origin}/card/${data.firstName.toLowerCase()}-${data.lastName.toLowerCase()}`;

    const downloadVCard = () => {
      // Map social links to vCard fields
      const socialVCardFields = (data.socialLinks || []).map(link => {
        const type = link.type.toUpperCase();
        return `X-SOCIALPROFILE;TYPE=${type}:${link.url}`;
      }).join('\n');

      const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${data.firstName} ${data.lastName}
N:${data.lastName};${data.firstName};;;
EMAIL;TYPE=INTERNET:${data.email}
TEL;TYPE=CELL:${data.phone}
ORG:${data.companyName}
TITLE:${data.jobTitle}
URL:${data.website}
${socialVCardFields}
END:VCARD`;
      
      const blob = new Blob([vcard], { type: 'text/vcard' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${data.firstName}_${data.lastName}.vcf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleSetAsWidget = () => {
      toast.success("Widget preview updated!", {
        description: "Open the Wakti AI app on your home screen to add this card as a widget."
      });
    };

    return (
      <div className="w-full h-full rounded-[20px] bg-white shadow-xl flex flex-col items-center justify-center relative p-6 overflow-hidden">
        {/* Real QR Code linking to shareable card */}
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
          <QRCodeSVG 
            value={cardUrl}
            size={160}
            level="H"
            includeMargin={false}
            imageSettings={{
              src: "/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png",
              x: undefined,
              y: undefined,
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-800">Scan to view card</p>
          {data.companyName && (
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">{data.companyName}</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 w-full max-w-[220px]">
          {/* Add to Contact Button - VISIBLE TO EVERYONE */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              downloadVCard();
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#060541] text-white rounded-full text-sm font-medium hover:bg-[#0c0b6b] transition-all active:scale-95 shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            Add to Contacts
          </button>
        </div>

        {/* Powered by Wakti AI Footer */}
        <a 
          href="https://apps.apple.com/app/wakti-ai" 
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-6 left-0 right-0 flex flex-col items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">Powered by</span>
          <div className="flex items-center gap-1.5">
            <img 
              src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" 
              alt="Wakti AI Logo" 
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-bold text-[#060541] tracking-tight">Wakti AI</span>
          </div>
        </a>
        
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-blue-50/50 rounded-full" />
        <div className="absolute bottom-0 left-0 w-24 h-24 -ml-12 -mb-12 bg-blue-50/50 rounded-full" />
      </div>
    );
  };

  const FlipButton = () => (
    <button 
      onClick={handleFlipInternal}
      className="absolute bottom-2 right-2 z-30 w-6 h-6 bg-white/80 rounded-full shadow-sm flex items-center justify-center text-gray-500 hover:text-[#060541] hover:bg-white transition-all active:scale-90"
      aria-label="Flip card"
    >
      <svg 
        className={`w-3 h-3 transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  );

  return (
    <div className="w-[300px] h-[480px] mx-auto perspective-1000 relative overflow-visible">
      <div className={`card-flip-container ${isFlipped ? 'flipped' : ''}`}>
        {/* Front Side */}
        <div className="card-flip-front shadow-xl">
          {renderFront()}
          <FlipButton />
        </div>

        {/* Back Side */}
        <div className="card-flip-back shadow-xl">
          {renderBack()}
          <FlipButton />
        </div>
      </div>
    </div>
  );
};

export { CardPreviewLive };
export default BusinessCardBuilder;
