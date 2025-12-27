import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Upload, Image as ImageIcon, Music, Type, Palette, Play, Download, Share2, Trash2, Plus, X, Square,
  ChevronLeft, ChevronRight, Video, Clock, Loader2, Check, Save, Sparkles, Move, Volume2, VolumeX, Smile,
  RotateCcw, Sun, Contrast, Droplets, Film, Layers, Copy, GripVertical, ZoomIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCanvasVideo } from '@/hooks/useCanvasVideo';

// Types
type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'wipe-left' | 'wipe-right' | 'dissolve' | 'none';
type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'zoom-in' | 'typewriter' | 'bounce';
type KenBurnsDirection = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'random';
type TextFont = 'system' | 'serif' | 'mono' | 'bold';
type FilterPreset = 'none' | 'vivid' | 'warm' | 'cool' | 'vintage' | 'bw' | 'dramatic' | 'soft';
type EditorTab = 'filters' | 'text' | 'motion' | 'audio' | 'stickers';

interface SlideFilters {
  brightness: number; contrast: number; saturation: number; blur: number;
  hue: number; sepia: number; vignette: number; zoom: number; preset: FilterPreset;
}

interface TextOverlay {
  id: string; text: string; position: { x: number; y: number };
  fontSize: number; fontFamily: TextFont; color: string;
  animation: TextAnimation; shadow: boolean;
  shadowPreset?: string;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

interface Slide {
  id: string; mediaType: 'image' | 'video';
  imageUrl?: string; imageFile?: File; videoUrl?: string; videoFile?: File;
  clipMuted: boolean; clipVolume: number;
  textOverlays: TextOverlay[]; stickers: { id: string; kind: 'emoji' | 'svg'; value: string; x: number; y: number; size: number }[];
  durationSec: number; transition: TransitionType; transitionDuration: number;
  filters: SlideFilters; kenBurns: KenBurnsDirection; kenBurnsSpeed: number;
}

interface AudioTrack {
  id: string; name: string; url: string; source: 'upload' | 'music_gen';
  duration?: number; trimStart: number; trimEnd: number; volume: number;
  startOffset: number; speed: number;
}

interface VideoProject { slides: Slide[]; audioTracks: AudioTrack[]; title: string; isPublic: boolean; }

const MAX_SLIDES = 20;
const MAX_DURATION_SEC = 120;

const DEFAULT_FILTERS: SlideFilters = {
  brightness: 100, contrast: 100, saturation: 100, blur: 0,
  hue: 0, sepia: 0, vignette: 0, zoom: 100, preset: 'none'
};

const FILTER_PRESETS: Record<FilterPreset, { name: string; nameAr: string; filters: Partial<SlideFilters>; icon: string }> = {
  none: { name: 'Original', nameAr: 'أصلي', filters: {}, icon: '⚪' },
  vivid: { name: 'Vivid', nameAr: 'حيوي', filters: { brightness: 105, contrast: 115, saturation: 140 }, icon: '🌈' },
  warm: { name: 'Warm', nameAr: 'دافئ', filters: { brightness: 105, saturation: 110, hue: 15 }, icon: '🌅' },
  cool: { name: 'Cool', nameAr: 'بارد', filters: { contrast: 105, saturation: 90, hue: -15 }, icon: '❄️' },
  vintage: { name: 'Vintage', nameAr: 'كلاسيك', filters: { brightness: 95, contrast: 90, saturation: 70, sepia: 30 }, icon: '📷' },
  bw: { name: 'B&W', nameAr: 'أبيض/أسود', filters: { saturation: 0, contrast: 110 }, icon: '⬛' },
  dramatic: { name: 'Dramatic', nameAr: 'درامي', filters: { brightness: 90, contrast: 140, saturation: 120, vignette: 30 }, icon: '🎭' },
  soft: { name: 'Soft', nameAr: 'ناعم', filters: { brightness: 105, contrast: 85, saturation: 95 }, icon: '☁️' },
};

const TRANSITIONS: { key: TransitionType; name: string; nameAr: string; icon: string }[] = [
  { key: 'fade', name: 'Fade', nameAr: 'تلاشي', icon: '✨' },
  { key: 'dissolve', name: 'Dissolve', nameAr: 'ذوبان', icon: '💫' },
  { key: 'slide-left', name: 'Slide L', nameAr: 'يسار', icon: '⬅️' },
  { key: 'slide-right', name: 'Slide R', nameAr: 'يمين', icon: '➡️' },
  { key: 'zoom-in', name: 'Zoom In', nameAr: 'تكبير', icon: '🔍' },
  { key: 'zoom-out', name: 'Zoom Out', nameAr: 'تصغير', icon: '🔎' },
  { key: 'wipe-left', name: 'Wipe L', nameAr: 'مسح', icon: '🧹' },
  { key: 'none', name: 'None', nameAr: 'بدون', icon: '⚪' },
];

const KEN_BURNS: { key: KenBurnsDirection; name: string; nameAr: string; icon: string }[] = [
  { key: 'random', name: 'Random', nameAr: 'عشوائي', icon: '🎲' },
  { key: 'zoom-in', name: 'Zoom In', nameAr: 'تكبير', icon: '🔍' },
  { key: 'zoom-out', name: 'Zoom Out', nameAr: 'تصغير', icon: '🔎' },
  { key: 'pan-left', name: 'Pan L', nameAr: 'يسار', icon: '⬅️' },
  { key: 'pan-right', name: 'Pan R', nameAr: 'يمين', icon: '➡️' },
  { key: 'pan-up', name: 'Pan Up', nameAr: 'أعلى', icon: '⬆️' },
  { key: 'pan-down', name: 'Pan Dn', nameAr: 'أسفل', icon: '⬇️' },
];

const svgToDataUri = (svg: string): string => {
  const normalized = svg
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
};

const STICKER_CATEGORIES: Array<{ key: string; name: string; nameAr: string }> = [
  { key: 'all', name: 'All', nameAr: 'الكل' },
  { key: 'hearts', name: 'Hearts', nameAr: 'قلوب' },
  { key: 'badges', name: 'Badges', nameAr: 'شارات' },
  { key: 'shapes', name: 'Shapes', nameAr: 'أشكال' },
  { key: 'arrows', name: 'Arrows', nameAr: 'أسهم' },
  { key: 'party', name: 'Party', nameAr: 'احتفال' },
];

type StickerItem = { id: string; name: string; nameAr: string; category: string; svg: string };
const STICKER_PACK: StickerItem[] = [
  {
    id: 'heart_glow',
    name: 'Glow Heart',
    nameAr: 'قلب متوهج',
    category: 'hearts',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="g" cx="50%" cy="45%" r="60%">
          <stop offset="0" stop-color="#ffb3d9"/>
          <stop offset="0.55" stop-color="#ff3d8a"/>
          <stop offset="1" stop-color="#8a0038"/>
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b"/>
          <feMerge>
            <feMergeNode in="b"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path filter="url(#glow)" d="M128 216s-76-46-95-96c-10-25 6-56 33-66 20-7 43 0 57 18 14-18 37-25 57-18 27 10 43 41 33 66-19 50-95 96-95 96z" fill="url(#g)"/>
      <path d="M128 210s-70-43-87-90c-9-22 5-49 29-58 18-6 39 1 52 17 13-16 34-23 52-17 24 9 38 36 29 58-17 47-87 90-87 90z" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="6"/>
    </svg>`,
  },
  {
    id: 'star_badge',
    name: 'Star Badge',
    nameAr: 'شارة نجمة',
    category: 'badges',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stop-color="#060541"/>
          <stop offset="0.5" stop-color="#4d96ff"/>
          <stop offset="1" stop-color="#9b59b6"/>
        </linearGradient>
      </defs>
      <circle cx="128" cy="128" r="92" fill="url(#g)"/>
      <circle cx="128" cy="128" r="84" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="8"/>
      <path d="M128 66l18 42 46 4-35 30 11 45-40-24-40 24 11-45-35-30 46-4 18-42z" fill="#ffd93d"/>
    </svg>`,
  },
  {
    id: 'speech_bubble',
    name: 'Speech Bubble',
    nameAr: 'فقاعة كلام',
    category: 'shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fcfefd"/>
          <stop offset="1" stop-color="#e9ceb0"/>
        </linearGradient>
      </defs>
      <path d="M60 64h136a24 24 0 0 1 24 24v68a24 24 0 0 1-24 24H116l-36 28v-28H60a24 24 0 0 1-24-24V88a24 24 0 0 1 24-24z" fill="url(#g)"/>
      <path d="M60 64h136a24 24 0 0 1 24 24v68a24 24 0 0 1-24 24H116l-36 28v-28H60a24 24 0 0 1-24-24V88a24 24 0 0 1 24-24z" fill="none" stroke="#060541" stroke-width="10" stroke-linejoin="round"/>
      <circle cx="96" cy="120" r="10" fill="#060541"/>
      <circle cx="128" cy="120" r="10" fill="#060541"/>
      <circle cx="160" cy="120" r="10" fill="#060541"/>
    </svg>`,
  },
  {
    id: 'arrow_up',
    name: 'Arrow Up',
    nameAr: 'سهم للأعلى',
    category: 'arrows',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <path d="M128 40l64 72h-40v104h-48V112H64l64-72z" fill="#4d96ff"/>
      <path d="M128 40l64 72h-40v104h-48V112H64l64-72z" fill="none" stroke="#060541" stroke-opacity="0.55" stroke-width="10" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    nameAr: 'لمعة',
    category: 'party',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="60%">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.45" stop-color="#ffd93d"/>
          <stop offset="1" stop-color="#ff9800"/>
        </radialGradient>
      </defs>
      <path d="M128 44l20 64 64 20-64 20-20 64-20-64-64-20 64-20 20-64z" fill="url(#g)"/>
      <path d="M196 70l8 26 26 8-26 8-8 26-8-26-26-8 26-8 8-26z" fill="#9b59b6" opacity="0.9"/>
      <path d="M64 168l6 20 20 6-20 6-6 20-6-20-20-6 20-6 6-20z" fill="#4d96ff" opacity="0.9"/>
    </svg>`,
  },
  {
    id: 'heart_outline',
    name: 'Outline Heart',
    nameAr: 'قلب بإطار',
    category: 'hearts',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#ff6b6b"/>
          <stop offset="1" stop-color="#e91e63"/>
        </linearGradient>
      </defs>
      <path d="M128 216s-76-46-95-96c-10-25 6-56 33-66 20-7 43 0 57 18 14-18 37-25 57-18 27 10 43 41 33 66-19 50-95 96-95 96z" fill="none" stroke="url(#g)" stroke-width="14" stroke-linejoin="round"/>
      <path d="M128 206s-66-41-82-85c-8-19 4-43 26-51 16-6 35 1 46 15 11-14 30-21 46-15 22 8 34 32 26 51-16 44-82 85-82 85z" fill="#ffffff" fill-opacity="0.15"/>
    </svg>`,
  },
  {
    id: 'heart_double',
    name: 'Double Hearts',
    nameAr: 'قلوب مزدوجة',
    category: 'hearts',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <path d="M94 188s-56-32-70-68c-7-18 4-40 23-47 14-5 30 0 40 13 10-13 27-18 40-13 19 7 30 29 23 47-14 36-56 68-56 68z" fill="#ff6b6b"/>
      <path d="M162 214s-66-40-83-83c-9-21 5-47 28-56 17-6 36 1 48 16 12-15 31-22 48-16 23 9 37 35 28 56-17 43-83 83-83 83z" fill="#e91e63" fill-opacity="0.9"/>
      <path d="M162 214s-66-40-83-83c-9-21 5-47 28-56 17-6 36 1 48 16 12-15 31-22 48-16 23 9 37 35 28 56-17 43-83 83-83 83z" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="8"/>
    </svg>`,
  },
  {
    id: 'badge_check',
    name: 'Verified Badge',
    nameAr: 'شارة موثوقة',
    category: 'badges',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <circle cx="128" cy="128" r="92" fill="#6bcb77"/>
      <circle cx="128" cy="128" r="84" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="8"/>
      <path d="M88 132l24 24 56-64" fill="none" stroke="#060541" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'badge_crown',
    name: 'Crown Badge',
    nameAr: 'شارة تاج',
    category: 'badges',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stop-color="#ffd93d"/>
          <stop offset="1" stop-color="#ff9800"/>
        </linearGradient>
      </defs>
      <circle cx="128" cy="128" r="92" fill="url(#g)"/>
      <circle cx="128" cy="128" r="84" fill="none" stroke="#060541" stroke-opacity="0.35" stroke-width="8"/>
      <path d="M80 150l10-52 38 30 38-52 10 52 20-22 8 44H72l8-44 0 0z" fill="#060541" fill-opacity="0.75"/>
      <rect x="80" y="150" width="96" height="20" rx="8" fill="#060541" fill-opacity="0.75"/>
    </svg>`,
  },
  {
    id: 'shape_blob',
    name: 'Blob',
    nameAr: 'شكل حر',
    category: 'shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#4d96ff"/>
          <stop offset="1" stop-color="#9b59b6"/>
        </linearGradient>
      </defs>
      <path d="M189 68c25 20 29 56 16 86-13 30-43 55-79 57-36 2-78-18-90-51-12-33 5-79 33-104 28-25 64-25 89-12 8 4 22 12 31 24z" fill="url(#g)" fill-opacity="0.9"/>
      <path d="M189 68c25 20 29 56 16 86-13 30-43 55-79 57-36 2-78-18-90-51-12-33 5-79 33-104 28-25 64-25 89-12 8 4 22 12 31 24z" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="10"/>
    </svg>`,
  },
  {
    id: 'shape_frame',
    name: 'Frame',
    nameAr: 'إطار',
    category: 'shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect x="40" y="40" width="176" height="176" rx="32" fill="none" stroke="#e9ceb0" stroke-width="18"/>
      <rect x="56" y="56" width="144" height="144" rx="26" fill="none" stroke="#060541" stroke-opacity="0.55" stroke-width="10"/>
      <circle cx="82" cy="76" r="10" fill="#4d96ff"/>
      <circle cx="174" cy="180" r="10" fill="#9b59b6"/>
    </svg>`,
  },
  {
    id: 'arrow_right',
    name: 'Arrow Right',
    nameAr: 'سهم لليمين',
    category: 'arrows',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <path d="M52 128h120V92l72 36-72 36v-36H52z" fill="#4d96ff"/>
      <path d="M52 128h120V92l72 36-72 36v-36H52z" fill="none" stroke="#060541" stroke-opacity="0.55" stroke-width="10" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'arrow_curve',
    name: 'Curved Arrow',
    nameAr: 'سهم منحني',
    category: 'arrows',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <path d="M200 84c-40-36-110-18-132 18-26 42-10 98 52 110 22 4 48 1 76-16" fill="none" stroke="#9b59b6" stroke-width="18" stroke-linecap="round"/>
      <path d="M206 74l6 48-46-14" fill="none" stroke="#9b59b6" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'party_confetti',
    name: 'Confetti',
    nameAr: 'قصاصات',
    category: 'party',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect x="48" y="60" width="22" height="22" rx="6" fill="#4d96ff"/>
      <rect x="92" y="40" width="18" height="18" rx="5" fill="#9b59b6"/>
      <rect x="132" y="70" width="20" height="20" rx="6" fill="#ff9800"/>
      <rect x="174" y="46" width="18" height="18" rx="5" fill="#6bcb77"/>
      <path d="M60 196c30-52 56-52 82 0" stroke="#ffd93d" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M106 204c30-52 56-52 82 0" stroke="#ff6b6b" stroke-width="14" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="120" r="8" fill="#ffd93d"/>
      <circle cx="108" cy="132" r="7" fill="#ff6b6b"/>
      <circle cx="148" cy="118" r="7" fill="#6bcb77"/>
      <circle cx="184" cy="134" r="8" fill="#00bcd4"/>
    </svg>`,
  },
  {
    id: 'party_firework',
    name: 'Firework',
    nameAr: 'ألعاب نارية',
    category: 'party',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <circle cx="128" cy="128" r="18" fill="#ffd93d"/>
      <path d="M128 44v44" stroke="#ff9800" stroke-width="14" stroke-linecap="round"/>
      <path d="M128 168v44" stroke="#ff9800" stroke-width="14" stroke-linecap="round"/>
      <path d="M44 128h44" stroke="#4d96ff" stroke-width="14" stroke-linecap="round"/>
      <path d="M168 128h44" stroke="#4d96ff" stroke-width="14" stroke-linecap="round"/>
      <path d="M70 70l30 30" stroke="#9b59b6" stroke-width="14" stroke-linecap="round"/>
      <path d="M156 156l30 30" stroke="#9b59b6" stroke-width="14" stroke-linecap="round"/>
      <path d="M186 70l-30 30" stroke="#6bcb77" stroke-width="14" stroke-linecap="round"/>
      <path d="M100 156l-30 30" stroke="#6bcb77" stroke-width="14" stroke-linecap="round"/>
    </svg>`,
  },
];

const TEXT_COLORS = ['#ffffff','#000000','#f2f2f2','#060541','#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#9b59b6','#e91e63','#00bcd4','#ff9800'];

const SHADOW_PRESETS: Array<{ key: string; name: string; nameAr: string }> = [
  { key: 'soft', name: 'Soft', nameAr: 'ناعم' },
  { key: 'deep', name: 'Deep', nameAr: 'عميق' },
  { key: '3d', name: '3D', nameAr: 'ثلاثي الأبعاد' },
  { key: 'neon', name: 'Neon', nameAr: 'نيون' },
  { key: 'wakti-blue', name: 'Wakti Blue', nameAr: 'واكتي أزرق' },
  { key: 'wakti-purple', name: 'Wakti Purple', nameAr: 'واكتي بنفسجي' },
  { key: 'wakti-orange', name: 'Wakti Orange', nameAr: 'واكتي برتقالي' },
  { key: 'wakti-green', name: 'Wakti Green', nameAr: 'واكتي أخضر' },
];

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '').trim();
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const getTextShadowCss = (t: TextOverlay): string | undefined => {
  if (!t.shadow) return undefined;
  const color = t.shadowColor || '#000000';
  const opacity = typeof t.shadowOpacity === 'number' ? t.shadowOpacity : 0.75;
  const blur = typeof t.shadowBlur === 'number' ? t.shadowBlur : 8;
  const ox = typeof t.shadowOffsetX === 'number' ? t.shadowOffsetX : 0;
  const oy = typeof t.shadowOffsetY === 'number' ? t.shadowOffsetY : 2;
  const c = hexToRgba(color, opacity);

  const p = t.shadowPreset || 'soft';
  if (p === 'deep') {
    return `${ox}px ${oy}px ${blur}px ${c}, ${ox}px ${oy + 6}px ${blur + 14}px ${hexToRgba(color, opacity * 0.35)}`;
  }
  if (p === '3d') {
    const layers = [
      `1px 1px 0 ${hexToRgba('#000000', 0.35)}`,
      `2px 2px 0 ${hexToRgba('#000000', 0.32)}`,
      `3px 3px 0 ${hexToRgba('#000000', 0.28)}`,
      `4px 4px ${Math.max(0, blur - 2)}px ${hexToRgba(color, opacity * 0.35)}`,
      `${ox}px ${oy}px ${blur}px ${c}`,
    ];
    return layers.join(', ');
  }
  if (p === 'neon') {
    return `0 0 ${Math.max(8, blur)}px ${hexToRgba(color, opacity)}, 0 0 ${Math.max(16, blur * 2)}px ${hexToRgba(color, opacity * 0.65)}, 0 0 ${Math.max(26, blur * 3)}px ${hexToRgba(color, opacity * 0.35)}`;
  }
  if (p === 'wakti-blue') {
    return `0 0 10px ${hexToRgba('#4d96ff', 0.8)}, 0 0 22px ${hexToRgba('#4d96ff', 0.45)}, ${ox}px ${oy}px ${blur}px ${c}`;
  }
  if (p === 'wakti-purple') {
    return `0 0 10px ${hexToRgba('#9b59b6', 0.75)}, 0 0 22px ${hexToRgba('#9b59b6', 0.4)}, ${ox}px ${oy}px ${blur}px ${c}`;
  }
  if (p === 'wakti-orange') {
    return `0 0 10px ${hexToRgba('#ff9800', 0.7)}, 0 0 22px ${hexToRgba('#ff9800', 0.35)}, ${ox}px ${oy}px ${blur}px ${c}`;
  }
  if (p === 'wakti-green') {
    return `0 0 10px ${hexToRgba('#6bcb77', 0.75)}, 0 0 22px ${hexToRgba('#6bcb77', 0.4)}, ${ox}px ${oy}px ${blur}px ${c}`;
  }
  return `${ox}px ${oy}px ${blur}px ${c}`;
};

const getFilterStyle = (f: SlideFilters): string => {
  const p: string[] = [];
  if (f.brightness !== 100) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) p.push(`contrast(${f.contrast}%)`);
  if (f.saturation !== 100) p.push(`saturate(${f.saturation}%)`);
  if (f.blur > 0) p.push(`blur(${f.blur}px)`);
  if (f.hue !== 0) p.push(`hue-rotate(${f.hue}deg)`);
  if (f.sepia > 0) p.push(`sepia(${f.sepia}%)`);
  return p.join(' ') || 'none';
};

const createSlide = (file: File, isVideo: boolean): Slide => ({
  id: crypto.randomUUID(),
  mediaType: isVideo ? 'video' : 'image',
  imageUrl: isVideo ? undefined : URL.createObjectURL(file),
  imageFile: isVideo ? undefined : file,
  videoUrl: isVideo ? URL.createObjectURL(file) : undefined,
  videoFile: isVideo ? file : undefined,
  clipMuted: false, clipVolume: 1,
  textOverlays: [], stickers: [],
  durationSec: 4, transition: 'fade', transitionDuration: 0.5,
  filters: { ...DEFAULT_FILTERS }, kenBurns: 'random', kenBurnsSpeed: 1,
});

export default function VideoEditorPro() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewStopRef = useRef<(() => void) | null>(null);

  const [project, setProject] = useState<VideoProject>({ slides: [], audioTracks: [], title: '', isPublic: false });
  const [draggingItem, setDraggingItem] = useState<{ type: 'sticker' | 'text'; id: string } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>('filters');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [savedTracks, setSavedTracks] = useState<AudioTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [savedTtsItems, setSavedTtsItems] = useState<Array<{
    id: string;
    created_at: string;
    text: string;
    voice_name: string;
    audio_url: string | null;
    storage_path: string | null;
    playable_url?: string | null;
    playable_url_expires_at?: number | null;
  }>>([]);
  const [loadingSavedTts, setLoadingSavedTts] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);

  const [stickerCategory, setStickerCategory] = useState('all');
  const [stickerQuery, setStickerQuery] = useState('');

  const waveCacheRef = useRef<Map<string, number[]>>(new Map());
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});

  const { generateVideo, progress, status, error: canvasError, isLoading } = useCanvasVideo();
  const slide = project.slides[selectedIdx] || null;
  const totalDur = project.slides.reduce((s, x) => s + x.durationSec, 0);
  const canGen = project.slides.length >= 1 && totalDur <= MAX_DURATION_SEC;

  useEffect(() => {
    if (isLoading) { setGenProgress(progress); if (status) setGenStatus(status); }
  }, [isLoading, progress, status]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newSlides: Slide[] = [];
    Array.from(files).slice(0, MAX_SLIDES - project.slides.length).forEach(f => {
      if (f.type.startsWith('image/') || f.type.startsWith('video/'))
        newSlides.push(createSlide(f, f.type.startsWith('video/')));
    });
    if (newSlides.length) {
      setProject(p => ({ ...p, slides: [...p.slides, ...newSlides] }));
      setSelectedIdx(project.slides.length);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [project.slides.length]);

  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      const newTrack: AudioTrack = { id: crypto.randomUUID(), name: file.name, url, source: 'upload', duration: audio.duration, trimStart: 0, trimEnd: Math.min(audio.duration, MAX_DURATION_SEC), volume: 1, startOffset: 0, speed: 1 };
      setProject(p => ({ ...p, audioTracks: [...p.audioTracks, newTrack] }));
    };
    if (audioInputRef.current) audioInputRef.current.value = '';
  }, []);

  const updateSlide = useCallback((id: string, u: Partial<Slide>) => {
    setProject(p => ({ ...p, slides: p.slides.map(s => s.id === id ? { ...s, ...u } : s) }));
  }, []);

  const updateAudioTrack = useCallback((id: string, updates: Partial<AudioTrack>) => {
    setProject(p => ({ ...p, audioTracks: p.audioTracks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, []);

  const stopPreview = useCallback(() => {
    previewStopRef.current?.();
    previewStopRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current.load();
    }
    setPreviewKey(null);
    setPreviewTime(0);
  }, []);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const ensureAudioDuration = useCallback(async (url: string) => {
    return await new Promise<number>((resolve, reject) => {
      const a = new Audio(url);
      a.preload = 'metadata';
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => reject(new Error('Failed to load audio metadata'));
    });
  }, []);

  const previewAudio = useCallback(async (key: string, trackLike: {
    url: string;
    trimStart?: number;
    trimEnd?: number;
    volume?: number;
    speed?: number;
    duration?: number;
  }) => {
    if (previewKey === key) {
      stopPreview();
      return;
    }

    stopPreview();

    const a = new Audio(trackLike.url);
    a.preload = 'auto';
    a.volume = Math.max(0, Math.min(1, trackLike.volume ?? 1));
    a.playbackRate = Math.max(0.25, Math.min(4, trackLike.speed ?? 1));

    // Important: avoid awaiting metadata before calling play().
    // Some browsers treat that as "not a direct user gesture" and block playback.
    let trimEnd = Number.POSITIVE_INFINITY;
    const applyTrimFromDuration = (duration: number) => {
      const trimStart = Math.max(0, Math.min(duration, trackLike.trimStart ?? 0));
      const trimEndRaw = trackLike.trimEnd ?? duration;
      trimEnd = Math.max(trimStart, Math.min(duration, trimEndRaw));
      if (a.currentTime < trimStart) a.currentTime = trimStart;
    };

    if (typeof trackLike.duration === 'number' && Number.isFinite(trackLike.duration)) {
      applyTrimFromDuration(trackLike.duration);
    } else {
      a.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(a.duration)) applyTrimFromDuration(a.duration);
      }, { once: true });
    }
    previewAudioRef.current = a;
    setPreviewKey(key);
    setPreviewTime(0);

    const onTimeUpdate = () => {
      setPreviewTime(a.currentTime);
      if (a.currentTime >= trimEnd) {
        stopPreview();
      }
    };
    const onEnded = () => stopPreview();
    const onError = () => {
      toast.error(language === 'ar' ? 'فشل التشغيل' : 'Playback failed');
      stopPreview();
    };

    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);

    previewStopRef.current = () => {
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      a.pause();
    };

    await a.play();
  }, [ensureAudioDuration, language, previewKey, stopPreview]);

  useEffect(() => {
    if (!previewKey || !previewAudioRef.current) return;
    const a = previewAudioRef.current;
    const id = window.setInterval(() => {
      if (previewAudioRef.current !== a) return;
      setPreviewTime(a.currentTime || 0);
    }, 50);
    return () => {
      window.clearInterval(id);
    };
  }, [previewKey]);

  useEffect(() => {
    if (!previewKey || !previewAudioRef.current) return;

    if (!previewKey.startsWith('track:')) return;
    const id = previewKey.slice('track:'.length);
    const track = project.audioTracks.find(t => t.id === id);
    if (!track) return;

    previewAudioRef.current.volume = Math.max(0, Math.min(1, track.volume ?? 1));
    previewAudioRef.current.playbackRate = Math.max(0.25, Math.min(4, track.speed ?? 1));

    if (typeof track.duration === 'number') {
      const trimStart = Math.max(0, Math.min(track.duration, track.trimStart ?? 0));
      const trimEnd = Math.max(trimStart, Math.min(track.duration, track.trimEnd ?? track.duration));
      if (previewAudioRef.current.currentTime < trimStart) {
        previewAudioRef.current.currentTime = trimStart;
      }
      if (previewAudioRef.current.currentTime > trimEnd) stopPreview();
    }
  }, [previewKey, project.audioTracks, stopPreview]);

  const removeAudioTrack = useCallback((id: string) => {
    setProject(p => ({ ...p, audioTracks: p.audioTracks.filter(t => t.id !== id) }));
  }, []);

  // Drag handlers for stickers and text on preview
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'sticker' | 'text', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingItem({ type, id });
  }, []);

  const handlePreviewMove = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    if (!draggingItem || !slide) return;
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    if (draggingItem.type === 'sticker') {
      updateSlide(slide.id, { stickers: slide.stickers.map(s => s.id === draggingItem.id ? { ...s, x, y } : s) });
    } else {
      updateSlide(slide.id, { textOverlays: slide.textOverlays.map(t => t.id === draggingItem.id ? { ...t, position: { x, y } } : t) });
    }
  }, [draggingItem, slide, updateSlide]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handlePreviewMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  }, [handlePreviewMove]);

  const handlePreviewTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      handlePreviewMove(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect());
    }
  }, [handlePreviewMove]);

  const handlePreviewMouseUp = useCallback(() => {
    setDraggingItem(null);
  }, []);

  const removeSlide = useCallback((id: string) => {
    setProject(p => ({ ...p, slides: p.slides.filter(s => s.id !== id) }));
    setSelectedIdx(i => Math.max(0, i - 1));
  }, []);

  const moveSlide = useCallback((from: number, to: number) => {
    if (to < 0 || to >= project.slides.length) return;
    setProject(p => {
      const arr = [...p.slides]; const [r] = arr.splice(from, 1); arr.splice(to, 0, r);
      return { ...p, slides: arr };
    });
    setSelectedIdx(to);
  }, [project.slides.length]);

  const dupSlide = useCallback((i: number) => {
    const s = project.slides[i]; if (!s) return;
    const ns = { ...s, id: crypto.randomUUID(), textOverlays: s.textOverlays.map(t => ({ ...t, id: crypto.randomUUID() })), stickers: s.stickers.map(x => ({ ...x, id: crypto.randomUUID() })) };
    setProject(p => ({ ...p, slides: [...p.slides.slice(0, i + 1), ns, ...p.slides.slice(i + 1)] }));
    setSelectedIdx(i + 1);
  }, [project.slides]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    if (!slide) return;
    updateSlide(slide.id, { filters: { ...DEFAULT_FILTERS, ...FILTER_PRESETS[preset].filters, preset } });
  }, [slide, updateSlide]);

  const applyAll = useCallback((key: 'filters' | 'transition' | 'kenBurns') => {
    if (!slide) return;
    setProject(p => ({ ...p, slides: p.slides.map(s => ({ ...s, [key]: slide[key] })) }));
    toast.success(language === 'ar' ? 'تم التطبيق' : 'Applied');
  }, [slide, language]);

  const addText = useCallback(() => {
    if (!slide) return;
    updateSlide(slide.id, { textOverlays: [...slide.textOverlays, { id: crypto.randomUUID(), text: language === 'ar' ? 'نص' : 'Text', position: { x: 50, y: 50 }, fontSize: 32, fontFamily: 'system', color: '#ffffff', animation: 'fade-in', shadow: true, shadowPreset: 'wakti-blue', shadowColor: '#060541', shadowOpacity: 0.75, shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 2 }] });
  }, [slide, updateSlide, language]);

  const updateText = useCallback((tid: string, u: Partial<TextOverlay>) => {
    if (!slide) return;
    updateSlide(slide.id, { textOverlays: slide.textOverlays.map(t => t.id === tid ? { ...t, ...u } : t) });
  }, [slide, updateSlide]);

  const removeText = useCallback((tid: string) => {
    if (!slide) return;
    updateSlide(slide.id, { textOverlays: slide.textOverlays.filter(t => t.id !== tid) });
  }, [slide, updateSlide]);

  const addSticker = useCallback((sticker: { kind: 'emoji' | 'svg'; value: string }) => {
    if (!slide) return;
    updateSlide(slide.id, { stickers: [...slide.stickers, { id: crypto.randomUUID(), kind: sticker.kind, value: sticker.value, x: 50, y: 50, size: 64 }] });
  }, [slide, updateSlide]);

  const removeSticker = useCallback((sid: string) => {
    if (!slide) return;
    updateSlide(slide.id, { stickers: slide.stickers.filter(s => s.id !== sid) });
  }, [slide, updateSlide]);

  const fetchAudioAsBlob = useCallback(async (signedUrl: string): Promise<string> => {
    const resp = await fetch(signedUrl);
    if (!resp.ok) throw new Error('Failed to fetch audio');
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }, []);

  const loadTracks = useCallback(async () => {
    if (!user) return; setLoadingTracks(true);
    try {
      const { data } = await supabase.from('user_music_tracks').select('id, prompt, storage_path').eq('user_id', user.id).order('created_at', { ascending: false });
      const tracks: AudioTrack[] = await Promise.all((data || []).map(async t => {
        const { data: u } = await supabase.storage.from('music').createSignedUrl(t.storage_path || '', 3600);
        if (!u?.signedUrl) return null;
        // Fetch as blob to bypass CORS/COEP restrictions
        try {
          const blobUrl = await fetchAudioAsBlob(u.signedUrl);
          return { id: t.id, name: t.prompt || 'Track', url: blobUrl, source: 'music_gen' as const, trimStart: 0, trimEnd: 60, volume: 1, startOffset: 0, speed: 1 };
        } catch {
          return null;
        }
      }));
      setSavedTracks(tracks.filter((t): t is AudioTrack => t !== null && Boolean(t.url)));
    } catch (e) { console.error(e); } finally { setLoadingTracks(false); }
  }, [user, fetchAudioAsBlob]);

  const getSavedTtsUrl = useCallback(async (row: { audio_url: string | null; storage_path: string | null }): Promise<string> => {
    let signedUrl: string | null = null;
    if (row.storage_path) {
      const { data, error } = await supabase.storage.from('saved-tts').createSignedUrl(row.storage_path, 60 * 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL');
      signedUrl = data.signedUrl;
    } else if (row.audio_url) {
      signedUrl = row.audio_url;
    }
    if (!signedUrl) throw new Error('Missing audio URL');
    // Fetch as blob to bypass CORS/COEP restrictions
    const resp = await fetch(signedUrl);
    if (!resp.ok) throw new Error('Failed to fetch audio');
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }, []);

  const loadSavedTts = useCallback(async () => {
    if (!user) return;
    setLoadingSavedTts(true);
    try {
      const { data, error } = await (supabase as any)
        .from('saved_tts')
        .select('id, created_at, text, voice_name, audio_url, storage_path')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (data || []) as any[];
      const hydrated = await Promise.all(rows.map(async (row) => {
        try {
          const playable = await getSavedTtsUrl(row);
          return { ...row, playable_url: playable };
        } catch {
          return { ...row, playable_url: null };
        }
      }));

      setSavedTtsItems(hydrated as any);
    } catch (e) {
      console.error(e);
      setSavedTtsItems([]);
    } finally {
      setLoadingSavedTts(false);
    }
  }, [user, getSavedTtsUrl]);

  useEffect(() => {
    if (showAudioPicker) {
      loadTracks();
      loadSavedTts();
    }
  }, [showAudioPicker, loadTracks, loadSavedTts]);

  const ensureWaveform = useCallback(async (cacheKey: string, url: string) => {
    if (waveCacheRef.current.has(cacheKey)) return;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch audio');
      const buf = await resp.arrayBuffer();
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AudioCtx();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      const ch = audioBuf.getChannelData(0);

      const bars = 48;
      const step = Math.max(1, Math.floor(ch.length / bars));
      const peaks: number[] = [];

      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * step;
        const end = Math.min(ch.length, start + step);
        for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
        const avg = sum / Math.max(1, end - start);
        peaks.push(Math.min(1, avg * 2.2));
      }

      waveCacheRef.current.set(cacheKey, peaks);
      setWaveforms(prev => ({ ...prev, [cacheKey]: peaks }));
      ctx.close?.();
    } catch {
      // leave empty on failure
    }
  }, []);

  useEffect(() => {
    for (const t of project.audioTracks) {
      if (!t?.url) continue;
      if (waveCacheRef.current.has(t.id)) continue;
      void ensureWaveform(t.id, t.url);
    }
  }, [project.audioTracks, ensureWaveform]);

  useEffect(() => {
    for (const row of savedTtsItems) {
      const url = row.playable_url;
      if (!url) continue;
      const key = `tts:${row.id}`;
      if (waveCacheRef.current.has(key)) continue;
      void ensureWaveform(key, url);
    }
  }, [savedTtsItems, ensureWaveform]);

  const addTrackWithDuration = useCallback(async (track: AudioTrack) => {
    try {
      const duration = await ensureAudioDuration(track.url);
      const safeTrimEnd = Math.min(duration, track.trimEnd || duration);
      setProject(p => ({
        ...p,
        audioTracks: [...p.audioTracks, { ...track, duration, trimEnd: safeTrimEnd }],
      }));
    } catch {
      setProject(p => ({
        ...p,
        audioTracks: [...p.audioTracks, { ...track, duration: track.duration || 60 }],
      }));
    }
  }, [ensureAudioDuration]);

  const handleGenerate = async () => {
    setIsGenerating(true); setGenProgress(0); setGenStatus(language === 'ar' ? 'جاري التحميل...' : 'Loading...');
    try {
      const cfg = project.slides.map(s => ({
        mediaType: s.mediaType, imageFile: s.imageFile, videoFile: s.videoFile,
        clipMuted: s.clipMuted, clipVolume: s.clipVolume,
        text: s.textOverlays[0]?.text, textPosition: 'center' as const, textColor: s.textOverlays[0]?.color || '#fff',
        textSize: 'medium' as const, textAnimation: s.textOverlays[0]?.animation || 'fade-in',
        textFont: s.textOverlays[0]?.fontFamily || 'system', textShadow: s.textOverlays[0]?.shadow ?? true,
        durationSec: s.durationSec, transition: s.transition, transitionDuration: s.transitionDuration,
        filters: s.filters, kenBurns: s.kenBurns, kenBurnsSpeed: s.kenBurnsSpeed,
      }));
      const primaryAudio = project.audioTracks[0];
      const blob = await generateVideo({ slides: cfg, audioUrl: primaryAudio?.url || null, audioTrimStart: primaryAudio?.trimStart || 0, audioTrimEnd: primaryAudio?.trimEnd, width: 1080, height: 1920 });
      if (!blob) throw new Error(canvasError || 'Failed');
      setVideoUrl(URL.createObjectURL(blob)); setVideoBlob(blob);
      toast.success(language === 'ar' ? 'تم!' : 'Done!');
    } catch (e) { console.error(e); toast.error(language === 'ar' ? 'فشل' : 'Failed'); } finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!user || !videoBlob) return; setIsSaving(true);
    try {
      const ext = videoBlob.type.includes('webm') ? 'webm' : 'mp4';
      const { data: up } = await supabase.storage.from('videos').upload(`${user.id}/${Date.now()}.${ext}`, videoBlob, { contentType: videoBlob.type });
      const { data: db } = await (supabase as any).from('user_videos').insert({ user_id: user.id, title: project.title || null, storage_path: up?.path, duration_seconds: totalDur, is_public: project.isPublic }).select('id').single();
      setSavedId((db as any).id); toast.success(language === 'ar' ? 'تم الحفظ!' : 'Saved!');
    } catch (e) { console.error(e); toast.error(language === 'ar' ? 'فشل' : 'Failed'); } finally { setIsSaving(false); }
  };

  const handleDownload = () => { if (!videoUrl) return; const a = document.createElement('a'); a.href = videoUrl; a.download = `${project.title || 'video'}.mp4`; a.click(); };
  const handleNew = () => { setProject({ slides: [], audioTracks: [], title: '', isPublic: false }); setVideoUrl(null); setVideoBlob(null); setSavedId(null); setSelectedIdx(0); };

  // Empty state
  if (!project.slides.length && !videoUrl) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 pb-24">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">{language === 'ar' ? 'محرر الفيديو الاحترافي' : 'Pro Video Editor'}</h1>
          <p className="text-muted-foreground mt-1">{language === 'ar' ? 'فلاتر • نصوص • ملصقات • موسيقى' : 'Filters • Text • Stickers • Music'}</p>
        </div>
        <Card className="enhanced-card p-8 border-2 border-dashed hover:border-primary/60 cursor-pointer transition-all" onClick={() => fileInputRef.current?.click()}>
          <div className="flex flex-col items-center gap-4">
            <div className="p-6 rounded-3xl bg-gradient-primary"><Upload className="h-12 w-12 text-white" /></div>
            <p className="text-xl font-semibold">{language === 'ar' ? 'اضغط لتحميل الوسائط' : 'Tap to upload media'}</p>
            <p className="text-muted-foreground">{language === 'ar' ? 'صور وفيديوهات' : 'Images & Videos'}</p>
          </div>
        </Card>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
      </div>
    );
  }

  // Result view
  if (videoUrl) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 pb-24 space-y-4">
        <h1 className="text-xl font-bold text-center">{language === 'ar' ? 'الفيديو جاهز! 🎉' : 'Video Ready! 🎉'}</h1>
        <Card className="overflow-hidden"><video src={videoUrl} controls autoPlay playsInline className="w-full" style={{ maxHeight: '60vh' }} /></Card>
        {!savedId && <Button className="w-full h-12" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}{isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}</Button>}
        {savedId && <Card className="p-3 bg-green-500/10 border-green-500/30"><div className="flex items-center gap-2 text-green-600"><Check className="h-5 w-5" /><span>{language === 'ar' ? 'تم الحفظ!' : 'Saved!'}</span></div></Card>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12" onClick={handleDownload}><Download className="h-5 w-5 mr-2" />{language === 'ar' ? 'تنزيل' : 'Download'}</Button>
          <Button variant="outline" className="h-12" onClick={() => { navigator.share ? navigator.share({ url: videoUrl }) : navigator.clipboard.writeText(videoUrl).then(() => toast.success('Copied')); }}><Share2 className="h-5 w-5 mr-2" />{language === 'ar' ? 'مشاركة' : 'Share'}</Button>
        </div>
        <Button variant="outline" className="w-full" onClick={handleNew}><Plus className="h-5 w-5 mr-2" />{language === 'ar' ? 'جديد' : 'New'}</Button>
      </div>
    );
  }

  // Generating
  if (isGenerating) {
    return (
      <div className="w-full max-w-md mx-auto p-4 pb-24">
        <Card className="p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center"><Loader2 className="h-10 w-10 text-white animate-spin" /></div>
          <p className="text-lg font-semibold">{genStatus}</p>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-primary transition-all" style={{ width: `${genProgress}%` }} /></div>
          <p className="text-sm text-muted-foreground">{genProgress}%</p>
        </Card>
      </div>
    );
  }

  // Main Editor - Mobile-first layout
  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Top bar - compact */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Input value={project.title} onChange={e => setProject(p => ({ ...p, title: e.target.value }))} placeholder={language === 'ar' ? 'عنوان' : 'Title'} className="w-24 h-7 text-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{totalDur}s/{MAX_DURATION_SEC}s</span>
          <Button size="sm" className="h-7 px-2 text-xs btn-enhanced" disabled={!canGen} onClick={handleGenerate}><Sparkles className="h-3 w-3 mr-1" />{language === 'ar' ? 'إنشاء' : 'Go'}</Button>
        </div>
      </div>

      {/* Preview + Tabs row on mobile */}
      <div className="flex shrink-0 border-b bg-black/5 dark:bg-black/20">
        {/* Small preview - draggable stickers & text */}
        <div className="w-[100px] h-[140px] p-1.5 flex items-center justify-center shrink-0">
          {slide && (
            <div 
              className="relative w-full h-full rounded-lg overflow-hidden shadow-lg bg-black select-none" 
              style={{ filter: getFilterStyle(slide.filters), touchAction: 'none' }}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={handlePreviewMouseUp}
              onMouseLeave={handlePreviewMouseUp}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewMouseUp}
            >
              {slide.mediaType === 'video' ? (
                <video
                  src={slide.videoUrl}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ transform: `scale(${Math.max(50, Math.min(200, slide.filters.zoom || 100)) / 100})` }}
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ transform: `scale(${Math.max(50, Math.min(200, slide.filters.zoom || 100)) / 100})` }}
                  draggable={false}
                />
              )}
              {slide.filters.vignette > 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${slide.filters.vignette / 100}) 100%)` }} />}
              {/* Draggable text overlays */}
              {slide.textOverlays.map(t => (
                <div 
                  key={t.id} 
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 text-center cursor-move ${draggingItem?.id === t.id ? 'ring-2 ring-primary scale-110' : ''}`}
                  style={{ left: `${t.position.x}%`, top: `${t.position.y}%`, fontSize: `${t.fontSize * 0.25}px`, color: t.color, textShadow: getTextShadowCss(t) }}
                  onMouseDown={e => handlePreviewMouseDown(e, 'text', t.id)}
                  onTouchStart={e => handlePreviewMouseDown(e, 'text', t.id)}
                >
                  {t.text}
                </div>
              ))}
              {/* Draggable stickers */}
              {slide.stickers.map(s => (
                <div 
                  key={s.id} 
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move ${draggingItem?.id === s.id ? 'ring-2 ring-primary scale-125' : ''}`}
                  style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: `${s.size * 0.25}px` }}
                  onMouseDown={e => handlePreviewMouseDown(e, 'sticker', s.id)}
                  onTouchStart={e => handlePreviewMouseDown(e, 'sticker', s.id)}
                >
                  {s.kind === 'svg' ? (
                    <img
                      src={s.value}
                      alt=""
                      draggable={false}
                      style={{ width: `${s.size * 0.9}px`, height: `${s.size * 0.9}px` }}
                    />
                  ) : (
                    s.value
                  )}
                </div>
              ))}
              <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/60 text-white text-[8px] pointer-events-none">{selectedIdx + 1}/{project.slides.length}</div>
              {(slide.stickers.length > 0 || slide.textOverlays.length > 0) && (
                <div className="absolute bottom-1 inset-x-1 text-center">
                  <span className="text-[7px] bg-black/60 text-white px-1 rounded">{language === 'ar' ? 'اسحب للتحريك' : 'Drag to move'}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Tabs - vertical on mobile */}
        <div className="flex-1 flex flex-wrap content-start gap-1 p-1.5">
          {([
            { key: 'filters' as EditorTab, icon: Palette, label: language === 'ar' ? 'فلاتر' : 'Filters' },
            { key: 'text' as EditorTab, icon: Type, label: language === 'ar' ? 'نص' : 'Text' },
            { key: 'motion' as EditorTab, icon: Move, label: language === 'ar' ? 'حركة' : 'Motion' },
            { key: 'audio' as EditorTab, icon: Music, label: language === 'ar' ? 'صوت' : 'Audio' },
            { key: 'stickers' as EditorTab, icon: Smile, label: language === 'ar' ? 'ملصق' : 'Stickers' },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${activeTab === tab.key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
              <tab.icon className="h-3.5 w-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor panel - scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-card">
            {activeTab === 'filters' && slide && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{language === 'ar' ? 'الفلاتر' : 'Filters'}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.entries(FILTER_PRESETS) as [FilterPreset, typeof FILTER_PRESETS[FilterPreset]][]).map(([k, v]) => (
                      <button key={k} onClick={() => applyPreset(k)} className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${slide.filters.preset === k ? 'border-primary bg-primary/10' : 'border-border'}`}>
                        <span className="text-xl">{v.icon}</span>
                        <span className="text-[9px] truncate w-full text-center">{language === 'ar' ? v.nameAr : v.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><p className="text-sm font-semibold">{language === 'ar' ? 'تعديل' : 'Adjust'}</p><button onClick={() => updateSlide(slide.id, { filters: { ...DEFAULT_FILTERS } })} className="text-xs text-muted-foreground"><RotateCcw className="h-3 w-3 inline mr-1" />{language === 'ar' ? 'إعادة' : 'Reset'}</button></div>
                  {[
                    { k: 'brightness', icon: Sun, l: language === 'ar' ? 'سطوع' : 'Brightness', min: 50, max: 150 },
                    { k: 'contrast', icon: Contrast, l: language === 'ar' ? 'تباين' : 'Contrast', min: 50, max: 150 },
                    { k: 'saturation', icon: Droplets, l: language === 'ar' ? 'تشبع' : 'Saturation', min: 0, max: 200 },
                    { k: 'hue', icon: Palette, l: language === 'ar' ? 'درجة' : 'Hue', min: -180, max: 180 },
                    { k: 'sepia', icon: Film, l: language === 'ar' ? 'بني' : 'Sepia', min: 0, max: 100 },
                    { k: 'vignette', icon: Layers, l: language === 'ar' ? 'حواف' : 'Vignette', min: 0, max: 100 },
                    { k: 'zoom', icon: ZoomIn, l: language === 'ar' ? 'تكبير' : 'Zoom', min: 100, max: 180 },
                  ].map(a => (
                    <div key={a.k} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1 text-muted-foreground"><a.icon className="h-3 w-3" />{a.l}</span><span>{slide.filters[a.k as keyof SlideFilters]}</span></div>
                      <input type="range" min={a.min} max={a.max} value={slide.filters[a.k as keyof SlideFilters] as number} onChange={e => updateSlide(slide.id, { filters: { ...slide.filters, [a.k]: parseInt(e.target.value), preset: 'none' } })} className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary" />
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => applyAll('filters')}>{language === 'ar' ? 'تطبيق على الكل' : 'Apply to All'}</Button>
              </>
            )}

            {activeTab === 'text' && slide && (
              <>
                <Button onClick={addText} className="w-full" size="sm"><Plus className="h-4 w-4 mr-1" />{language === 'ar' ? 'إضافة نص' : 'Add Text'}</Button>
                {slide.textOverlays.map((t, i) => (
                  <Card key={t.id} className="p-2 space-y-2">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium">{language === 'ar' ? `نص ${i + 1}` : `Text ${i + 1}`}</span><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeText(t.id)}><Trash2 className="h-3 w-3" /></Button></div>
                    <Textarea value={t.text} onChange={e => updateText(t.id, { text: e.target.value })} className="min-h-[50px] text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-muted-foreground">{language === 'ar' ? 'الخط' : 'Font'}</label><select value={t.fontFamily} onChange={e => updateText(t.id, { fontFamily: e.target.value as TextFont })} className="w-full h-7 px-1 text-xs rounded border bg-background">{(['system', 'serif', 'mono', 'bold'] as TextFont[]).map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                      <div><label className="text-[10px] text-muted-foreground">{language === 'ar' ? 'الحجم' : 'Size'}</label><Input type="number" min={12} max={100} value={t.fontSize} onChange={e => updateText(t.id, { fontSize: parseInt(e.target.value) || 32 })} className="h-7 text-xs" /></div>
                    </div>
                    <div><label className="text-[10px] text-muted-foreground">{language === 'ar' ? 'اللون' : 'Color'}</label><div className="flex gap-1 flex-wrap mt-1">{TEXT_COLORS.map(c => <button key={c} onClick={() => updateText(t.id, { color: c })} className={`w-5 h-5 rounded-full border ${t.color === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ backgroundColor: c }} />)}</div></div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.shadow} onChange={e => updateText(t.id, { shadow: e.target.checked })} className="rounded" />{language === 'ar' ? 'ظل / توهج' : 'Shadow / Glow'}</label>
                    {t.shadow && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">{language === 'ar' ? 'النمط' : 'Style'}</label>
                          <select
                            value={t.shadowPreset || 'soft'}
                            onChange={e => updateText(t.id, { shadowPreset: e.target.value })}
                            title={language === 'ar' ? 'نمط الظل/التوهج' : 'Shadow/Glow style'}
                            aria-label={language === 'ar' ? 'نمط الظل/التوهج' : 'Shadow/Glow style'}
                            className="w-full h-7 px-1 text-xs rounded border bg-background"
                          >
                            {SHADOW_PRESETS.map(p => (
                              <option key={p.key} value={p.key}>{language === 'ar' ? p.nameAr : p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground">{language === 'ar' ? 'لون الظل' : 'Shadow color'}</label>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {TEXT_COLORS.map(c => (
                              <button
                                key={c}
                                onClick={() => updateText(t.id, { shadowColor: c })}
                                className={`w-5 h-5 rounded-full border ${(t.shadowColor || '#000000') === c ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                style={{ backgroundColor: c }}
                                title={language === 'ar' ? 'لون الظل' : 'Shadow color'}
                                aria-label={language === 'ar' ? 'لون الظل' : 'Shadow color'}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{language === 'ar' ? 'الشفافية' : 'Opacity'}</span>
                            <span>{Math.round(((typeof t.shadowOpacity === 'number' ? t.shadowOpacity : 0.75) * 100))}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(((typeof t.shadowOpacity === 'number' ? t.shadowOpacity : 0.75) * 100))}
                            onChange={e => updateText(t.id, { shadowOpacity: parseInt(e.target.value) / 100 })}
                            title={language === 'ar' ? 'شفافية الظل' : 'Shadow opacity'}
                            aria-label={language === 'ar' ? 'شفافية الظل' : 'Shadow opacity'}
                            className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{language === 'ar' ? 'الضبابية' : 'Blur'}</span>
                            <span>{typeof t.shadowBlur === 'number' ? t.shadowBlur : 8}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={40}
                            value={typeof t.shadowBlur === 'number' ? t.shadowBlur : 8}
                            onChange={e => updateText(t.id, { shadowBlur: parseInt(e.target.value) })}
                            title={language === 'ar' ? 'ضبابية الظل' : 'Shadow blur'}
                            aria-label={language === 'ar' ? 'ضبابية الظل' : 'Shadow blur'}
                            className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{language === 'ar' ? 'إزاحة X' : 'Offset X'}</span>
                              <span>{typeof t.shadowOffsetX === 'number' ? t.shadowOffsetX : 0}px</span>
                            </div>
                            <input
                              type="range"
                              min={-30}
                              max={30}
                              value={typeof t.shadowOffsetX === 'number' ? t.shadowOffsetX : 0}
                              onChange={e => updateText(t.id, { shadowOffsetX: parseInt(e.target.value) })}
                              title={language === 'ar' ? 'إزاحة الظل X' : 'Shadow offset X'}
                              aria-label={language === 'ar' ? 'إزاحة الظل X' : 'Shadow offset X'}
                              className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{language === 'ar' ? 'إزاحة Y' : 'Offset Y'}</span>
                              <span>{typeof t.shadowOffsetY === 'number' ? t.shadowOffsetY : 2}px</span>
                            </div>
                            <input
                              type="range"
                              min={-30}
                              max={30}
                              value={typeof t.shadowOffsetY === 'number' ? t.shadowOffsetY : 2}
                              onChange={e => updateText(t.id, { shadowOffsetY: parseInt(e.target.value) })}
                              title={language === 'ar' ? 'إزاحة الظل Y' : 'Shadow offset Y'}
                              aria-label={language === 'ar' ? 'إزاحة الظل Y' : 'Shadow offset Y'}
                              className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
                {!slide.textOverlays.length && <div className="text-center py-6 text-muted-foreground"><Type className="h-10 w-10 mx-auto mb-2 opacity-50" /><p className="text-sm">{language === 'ar' ? 'لا يوجد نص' : 'No text'}</p></div>}
              </>
            )}

            {activeTab === 'motion' && slide && (
              <>
                <div className="space-y-2"><div className="flex justify-between"><p className="text-sm font-semibold">{language === 'ar' ? 'المدة' : 'Duration'}</p><span className="text-sm">{slide.durationSec}s</span></div><input type="range" min={1} max={15} value={slide.durationSec} onChange={e => updateSlide(slide.id, { durationSec: parseInt(e.target.value) })} className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary" /></div>
                <div className="space-y-2"><p className="text-sm font-semibold">{language === 'ar' ? 'حركة الصورة' : 'Motion'}</p><div className="grid grid-cols-4 gap-1.5">{KEN_BURNS.map(k => <button key={k.key} onClick={() => updateSlide(slide.id, { kenBurns: k.key })} className={`flex flex-col items-center p-1.5 rounded-lg border ${slide.kenBurns === k.key ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="text-lg">{k.icon}</span><span className="text-[9px]">{language === 'ar' ? k.nameAr : k.name}</span></button>)}</div></div>
                <div className="space-y-2"><p className="text-sm font-semibold">{language === 'ar' ? 'الانتقال' : 'Transition'}</p><div className="grid grid-cols-4 gap-1.5">{TRANSITIONS.map(t => <button key={t.key} onClick={() => updateSlide(slide.id, { transition: t.key })} className={`flex flex-col items-center p-1.5 rounded-lg border ${slide.transition === t.key ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="text-lg">{t.icon}</span><span className="text-[9px]">{language === 'ar' ? t.nameAr : t.name}</span></button>)}</div></div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => { applyAll('transition'); applyAll('kenBurns'); }}>{language === 'ar' ? 'تطبيق على الكل' : 'Apply to All'}</Button>
                {slide.mediaType === 'video' && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-semibold">{language === 'ar' ? 'صوت المقطع' : 'Clip Audio'}</p>
                    <div className="flex justify-between items-center"><span className="text-sm">{language === 'ar' ? 'كتم' : 'Mute'}</span><button onClick={() => updateSlide(slide.id, { clipMuted: !slide.clipMuted })} className={`w-10 h-5 rounded-full transition-colors ${slide.clipMuted ? 'bg-primary' : 'bg-muted'}`}><div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${slide.clipMuted ? 'translate-x-5' : ''}`} /></button></div>
                    <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>{language === 'ar' ? 'مستوى' : 'Volume'}</span><span>{Math.round(slide.clipVolume * 100)}%</span></div><input type="range" min={0} max={100} value={slide.clipVolume * 100} onChange={e => updateSlide(slide.id, { clipVolume: parseInt(e.target.value) / 100 })} className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary" disabled={slide.clipMuted} /></div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'audio' && (
              <>
                {/* Add audio buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => audioInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />{language === 'ar' ? 'تحميل' : 'Upload'}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAudioPicker(!showAudioPicker)}>
                    <Music className="h-3.5 w-3.5 mr-1" />{language === 'ar' ? 'مكتبة' : 'Library'}
                  </Button>
                </div>
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
              
              {showAudioPicker && (
                <Card className="p-2 max-h-32 overflow-y-auto">
                  {loadingTracks ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 
                   savedTracks.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">{language === 'ar' ? 'لا توجد مقاطع' : 'No tracks'}</p> : 
                   savedTracks.map(t => (
                    <div key={t.id} className="w-full p-1.5 rounded hover:bg-muted flex items-center gap-2">
                      <button
                        className="shrink-0 h-7 w-7 rounded bg-muted/60 hover:bg-muted flex items-center justify-center"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); previewAudio(`music:${t.id}`, t); }}
                        title={language === 'ar' ? 'تشغيل' : 'Play'}
                      >
                        {previewKey === `music:${t.id}` ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        className="flex-1 text-left text-xs truncate"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); addTrackWithDuration(t); setShowAudioPicker(false); }}
                        title={language === 'ar' ? 'إضافة' : 'Add'}
                      >
                        {t.name}
                      </button>
                    </div>
                   ))}
                  {!loadingTracks && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">
                        {language === 'ar' ? 'الصوت المحفوظ (TTS)' : 'Saved TTS'}
                      </div>
                      {loadingSavedTts ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : savedTtsItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">{language === 'ar' ? 'لا يوجد عناصر محفوظة' : 'No saved items'}</p>
                      ) : (
                        savedTtsItems.map((row) => {
                          const snippet = (row.text || '').slice(0, 40);
                          const created = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
                          const label = `${row.voice_name || 'Voice'} • ${snippet}${snippet.length >= 40 ? '…' : ''} • ${created}`;
                          const url = row.playable_url || '';
                          const canPlay = Boolean(url);
                          return (
                            <div key={row.id} className="w-full p-1.5 rounded hover:bg-muted flex items-center gap-2">
                              <button
                                className="shrink-0 h-7 w-7 rounded bg-muted/60 hover:bg-muted flex items-center justify-center disabled:opacity-50"
                                disabled={!canPlay}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!canPlay) return;
                                  previewAudio(`tts:${row.id}`, { url, volume: 1, speed: 1 });
                                }}
                                title={language === 'ar' ? 'تشغيل' : 'Play'}
                              >
                                {previewKey === `tts:${row.id}` ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                className="flex-1 text-left text-xs truncate"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!canPlay) {
                                    toast.error(language === 'ar' ? 'لا يمكن تشغيل هذا الملف' : 'This audio is not playable');
                                    return;
                                  }
                                  const track: AudioTrack = {
                                    id: crypto.randomUUID(),
                                    name: label,
                                    url,
                                    source: 'upload',
                                    trimStart: 0,
                                    trimEnd: 60,
                                    volume: 1,
                                    startOffset: 0,
                                    speed: 1,
                                  };
                                  void addTrackWithDuration(track);
                                  setShowAudioPicker(false);
                                }}
                                title={language === 'ar' ? 'إضافة' : 'Add'}
                              >
                                {label}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              )}

                {/* Audio tracks list with visual trimmer */}
                {project.audioTracks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">{language === 'ar' ? 'لا يوجد صوت' : 'No audio added'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {project.audioTracks.map((track) => (
                      <Card key={track.id} className="p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Music className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs truncate">{track.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => previewAudio(`track:${track.id}`, track)}
                              title={language === 'ar' ? 'تشغيل' : 'Play'}
                            >
                              {previewKey === `track:${track.id}` ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 shrink-0" onClick={() => removeAudioTrack(track.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {track.duration && (
                          <>
                            {/* Visual trim slider */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{language === 'ar' ? 'قص' : 'Trim'}</span>
                                <span>{Math.floor(track.trimStart)}s - {Math.floor(track.trimEnd)}s / {Math.floor(track.duration)}s</span>
                              </div>
                              <div className="relative h-6 bg-muted rounded overflow-hidden">
                                {/* Audio waveform visualization */}
                                <div className="absolute inset-0 flex items-center justify-between px-1">
                                  {(waveforms[track.id] || Array.from({ length: 48 }).map(() => 0.25)).map((p, i) => (
                                    <div
                                      key={i}
                                      className="bg-primary/30 rounded"
                                      style={{ width: '2px', height: `${Math.max(12, Math.round(p * 100))}%` }}
                                    />
                                  ))}
                                </div>
                                {previewKey === `track:${track.id}` && typeof track.duration === 'number' && track.duration > 0 && (
                                  <div
                                    className="absolute top-0 bottom-0 w-[2px] bg-primary"
                                    style={{ left: `${Math.max(0, Math.min(100, (previewTime / track.duration) * 100))}%` }}
                                  />
                                )}
                                {/* Trim range indicator */}
                                <div 
                                  className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary"
                                  style={{ 
                                    left: `${(track.trimStart / track.duration) * 100}%`, 
                                    width: `${((track.trimEnd - track.trimStart) / track.duration) * 100}%` 
                                  }}
                                />
                              </div>
                              {/* Dual range inputs for trim */}
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <input 
                                    type="range" 
                                    min={0} 
                                    max={track.duration - 1} 
                                    value={track.trimStart} 
                                    onChange={e => updateAudioTrack(track.id, { trimStart: Math.min(parseFloat(e.target.value), track.trimEnd - 1) })}
                                    className="w-full h-1 rounded appearance-none bg-muted cursor-pointer accent-primary"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="range" 
                                    min={1} 
                                    max={track.duration} 
                                    value={track.trimEnd} 
                                    onChange={e => updateAudioTrack(track.id, { trimEnd: Math.max(parseFloat(e.target.value), track.trimStart + 1) })}
                                    className="w-full h-1 rounded appearance-none bg-muted cursor-pointer accent-primary"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Volume control */}
                            <div className="flex items-center gap-2">
                              <Volume2 className="h-3 w-3 text-muted-foreground" />
                              <input 
                                type="range" 
                                min={0} 
                                max={100} 
                                value={track.volume * 100} 
                                onChange={e => updateAudioTrack(track.id, { volume: parseInt(e.target.value) / 100 })}
                                className="flex-1 h-1 rounded appearance-none bg-muted cursor-pointer accent-primary"
                                title={language === 'ar' ? 'مستوى الصوت' : 'Volume'}
                              />
                              <span className="text-[10px] w-8 text-right">{Math.round(track.volume * 100)}%</span>
                            </div>
                            
                            {/* Start Time (when audio begins in video) */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{language === 'ar' ? 'يبدأ عند' : 'Starts at'}</span>
                                <span>{track.startOffset || 0}s</span>
                              </div>
                              <input 
                                type="range" 
                                min={0} 
                                max={MAX_DURATION_SEC - 1} 
                                value={track.startOffset || 0} 
                                onChange={e => updateAudioTrack(track.id, { startOffset: parseInt(e.target.value) })}
                                className="w-full h-1 rounded appearance-none bg-muted cursor-pointer accent-primary"
                                title={language === 'ar' ? 'وقت البدء' : 'Start time'}
                              />
                            </div>
                            
                            {/* Speed control */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{language === 'ar' ? 'السرعة' : 'Speed'}</span>
                                <span>{(track.speed || 1).toFixed(1)}x</span>
                              </div>
                              <div className="flex gap-1">
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(spd => (
                                  <button
                                    key={spd}
                                    onClick={() => updateAudioTrack(track.id, { speed: spd })}
                                    className={`flex-1 py-1 text-[9px] rounded ${(track.speed || 1) === spd ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                  >
                                    {spd}x
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'stickers' && slide && (
              <>
                <p className="text-sm font-semibold">{language === 'ar' ? 'اختر ملصق' : 'Choose Sticker'}</p>

                <div className="space-y-2">
                  <Input
                    value={stickerQuery}
                    onChange={e => setStickerQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'بحث عن ملصق...' : 'Search stickers...'}
                    aria-label={language === 'ar' ? 'بحث عن ملصق' : 'Search stickers'}
                    className="h-8 text-xs"
                  />

                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {STICKER_CATEGORIES.map(c => (
                      <button
                        key={c.key}
                        onClick={() => setStickerCategory(c.key)}
                        title={language === 'ar' ? c.nameAr : c.name}
                        aria-label={language === 'ar' ? c.nameAr : c.name}
                        className={`px-2 py-1 rounded-lg text-[10px] shrink-0 ${stickerCategory === c.key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                      >
                        {language === 'ar' ? c.nameAr : c.name}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {STICKER_PACK
                      .filter(s => stickerCategory === 'all' || s.category === stickerCategory)
                      .filter(s => {
                        const q = stickerQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          s.name.toLowerCase().includes(q) ||
                          s.nameAr.toLowerCase().includes(q) ||
                          s.category.toLowerCase().includes(q)
                        );
                      })
                      .map(s => {
                        const src = svgToDataUri(s.svg);
                        return (
                          <button
                            key={s.id}
                            onClick={() => addSticker({ kind: 'svg', value: src })}
                            className="p-2 rounded-lg bg-muted/30 hover:bg-muted transition-colors flex items-center justify-center"
                            title={language === 'ar' ? s.nameAr : s.name}
                            aria-label={language === 'ar' ? s.nameAr : s.name}
                          >
                            <img src={src} alt="" className="w-10 h-10" draggable={false} />
                          </button>
                        );
                      })}
                  </div>
                </div>

                {slide.stickers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-semibold">{language === 'ar' ? 'الملصقات المضافة' : 'Added Stickers'}</p>
                    {slide.stickers.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        {s.kind === 'svg' ? (
                          <img src={s.value} alt="" className="w-10 h-10" draggable={false} />
                        ) : (
                          <span className="text-2xl">{s.value}</span>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeSticker(s.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
      </div>

      {/* Timeline - compact for mobile */}
      <div className="border-t bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 pb-1">
          {project.slides.map((s, i) => (
            <button key={s.id} onClick={() => setSelectedIdx(i)} className={`relative shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all ${selectedIdx === i ? 'border-primary ring-1 ring-primary/30' : 'border-transparent opacity-70'}`}>
              {s.mediaType === 'video' ? <video src={s.videoUrl} className="w-full h-full object-cover" muted playsInline /> : <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />}
              <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] text-center">{s.durationSec}s</div>
            </button>
          ))}
          <button onClick={() => fileInputRef.current?.click()} className="shrink-0 w-12 h-16 rounded-md border-2 border-dashed border-border hover:border-primary flex items-center justify-center"><Plus className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        {slide && (
          <div className="flex items-center justify-center gap-1 pb-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSlide(selectedIdx, selectedIdx - 1)} disabled={selectedIdx === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dupSlide(selectedIdx)}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeSlide(slide.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSlide(selectedIdx, selectedIdx + 1)} disabled={selectedIdx === project.slides.length - 1}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
    </div>
  );
}
