/**
 * THEME_PRESETS — extracted from index.ts (Item 5, safe split).
 *
 * Each preset is a plain-English description injected into the AI system
 * prompt (via the {{THEME_INSTRUCTIONS}} placeholder) to steer colors,
 * typography, and mood of generated projects.
 *
 * Used by: `supabase/functions/projects-generate/index.ts`
 */

export const THEME_PRESETS: Record<string, string> = {
  'user_prompt': 'DYNAMIC - Will be extracted from user prompt',
  'wakti-dark': `DARK THEME - MANDATORY COLORS:
- Background: bg-[#0c0f14] or bg-slate-950 (MUST BE DARK)
- Cards: bg-slate-900/50 or bg-white/5 with backdrop-blur
- Text: text-white, text-gray-100, text-amber-400 for accents
- Borders: border-white/10 or border-amber-500/30
- Accents: amber-400, amber-500 for highlights and icons
- NEVER use white/light backgrounds. ALL backgrounds must be dark.`,
  'midnight': `MIDNIGHT DARK THEME - MANDATORY COLORS:
- Background: bg-indigo-950 or bg-[#1e1b4b] (MUST BE DARK)
- Cards: bg-indigo-900/50 with backdrop-blur
- Text: text-white, text-indigo-200
- Accents: indigo-400, purple-400
- NEVER use white/light backgrounds.`,
  'obsidian': `OBSIDIAN DARK THEME - MANDATORY COLORS:
- Background: bg-slate-900 or bg-[#1e293b] (MUST BE DARK)
- Cards: bg-slate-800/50
- Text: text-white, text-slate-300
- NEVER use white/light backgrounds.`,
  'brutalist': 'Brutalist theme: Indigo (#6366f1), Purple (#a855f7), Pink (#ec4899), Red (#f43f5e). Bold font, Neon shadows, No radius, Bento layout. Mood: Bold.',
  'wakti-light': 'Wakti Light theme: Off-White (#fcfefd), Deep Purple (#060541), Warm Beige (#e9ceb0). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'glacier': 'Glacier theme: Soft Blue (#60a5fa), Lavender (#a5b4fc), Light Purple (#c4b5fd), Ice (#e0e7ff). Minimal font, Soft shadows, Rounded corners. Mood: Calm.',
  'lavender': 'Lavender theme: Soft Purple (#a78bfa), Lilac (#c4b5fd), Pale Violet (#ddd6fe). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'vibrant': 'Vibrant theme: Blue (#3b82f6), Purple (#8b5cf6), Orange (#f97316), Pink (#ec4899). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Playful.',
  'neon': 'Neon theme: Cyan (#22d3ee), Lime (#a3e635), Yellow (#facc15), Pink (#f472b6). Bold font, Neon shadows, Pill radius, Bento layout. Mood: Bold/Electric.',
  'sunset': 'Sunset theme: Orange (#f97316), Peach (#fb923c), Soft Coral (#fdba74). Modern font, Glow shadows, Rounded corners. Mood: Playful/Warm.',
  'orchid': 'Orchid theme: Pink (#ec4899), Rose (#f472b6), Blush (#f9a8d4). Playful font, Soft shadows, Pill radius. Mood: Feminine/Playful.',
  'coral': 'Coral theme: Rose Red (#f43f5e), Salmon (#fb7185), Pink (#fda4af). Bold font, Hard shadows, Rounded corners, Bento layout. Mood: Bold.',
  'emerald': 'Emerald theme: Green (#10b981), Mint (#34d399), Seafoam (#6ee7b7). Modern font, Soft shadows, Rounded corners. Mood: Calm.',
  'forest': 'Forest theme: Bright Green (#22c55e), Lime (#4ade80), Pale Green (#86efac). Classic font, Soft shadows, Subtle radius. Mood: Organic.',
  'solar': 'Solar theme: Gold (#eab308), Yellow (#facc15), Lemon (#fde047). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Optimistic.',
  'ocean': 'Ocean theme: Sky Blue (#0ea5e9), Cyan (#38bdf8), Aqua (#7dd3fc). Modern font, Soft shadows, Rounded corners. Mood: Professional.',
  'harvest': 'Harvest theme: Amber (#f59e0b), Gold (#fbbf24), Warm Cream (#fde68a). Bold font, Hard shadows, Subtle radius, Magazine layout. Mood: Warm.',
  'none': `DEFAULT DARK THEME - MANDATORY:
- Background: bg-slate-950 or bg-[#0c0f14] (MUST BE DARK)
- Cards: bg-slate-900/50 or bg-white/5 with backdrop-blur-xl
- Text: text-white, text-gray-300
- Borders: border-white/10
- NEVER use white/light backgrounds. This is a DARK theme app.`,
};
