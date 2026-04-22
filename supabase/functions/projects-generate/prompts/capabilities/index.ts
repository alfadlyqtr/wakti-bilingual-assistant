// 🧠 THREE-LAYER PROMPT ARCHITECTURE — Capability Registry
//
// Layer 1 (CORE): Always in BASE_SYSTEM_PROMPT — identity, output format, defensive coding.
// Layer 2 (MANIFEST): Always sent — a short menu of available capabilities.
// Layer 3 (DOCS): Injected only when detected (CREATE mode) or fetched on demand (AGENT mode).
//
// This pattern is how Cascade/Cursor manage prompt size without losing reliability.

import { PHASER_CAPABILITY } from "./phaser.ts";
import { STOCK_IMAGES_CAPABILITY } from "./stockImages.ts";
import { FORMS_CAPABILITY } from "./forms.ts";
import { BOOKING_CAPABILITY } from "./booking.ts";
import { ECOMMERCE_CAPABILITY } from "./ecommerce.ts";
import { BLOG_CAPABILITY } from "./blog.ts";
import { SPORTS_CAPABILITY } from "./sports.ts";

export type CapabilityName =
  | "phaser_game"
  | "stock_images"
  | "forms"
  | "booking"
  | "ecommerce"
  | "blog"
  | "sports";

// The short menu — always sent to the AI so it knows what's available.
export const CAPABILITY_MANIFEST = `
## 🛠️ AVAILABLE CAPABILITIES

Your project is pre-wired to a Supabase backend. The following capability docs can be loaded
on demand using the \`get_capability_doc\` tool in Agent/Execute mode. In CREATE mode, they are
auto-injected when the user's request matches.

| Capability      | When to use                                                           |
|-----------------|-----------------------------------------------------------------------|
| stock_images    | ANY image (hero, section, gallery). Uses Freepik API.                 |
| forms           | Contact, quote, newsletter, feedback, waitlist forms.                 |
| booking         | Appointments, scheduling, services (barber, salon, spa, clinic).      |
| ecommerce       | Shop, store, products, cart.                                          |
| blog            | Blog, CMS, articles, posts, news, magazine content.                   |
| sports          | Sports fan sites, rosters, standings, fixtures, team news.            |
| phaser_game     | 2D games (racing, shooter, puzzle, platformer, arcade).               |

Rules:
- Never hardcode data the backend provides (products, services).
- Never import @supabase/supabase-js in generated projects — use project-backend-api.
- For Arabic / RTL / multi-language, follow the runtime i18n instructions added separately.
`;

// Full docs, keyed by name.
const DOCS: Record<CapabilityName, string> = {
  phaser_game: PHASER_CAPABILITY,
  stock_images: STOCK_IMAGES_CAPABILITY,
  forms: FORMS_CAPABILITY,
  booking: BOOKING_CAPABILITY,
  ecommerce: ECOMMERCE_CAPABILITY,
  blog: BLOG_CAPABILITY,
  sports: SPORTS_CAPABILITY,
};

export function getCapabilityDoc(name: string): string | null {
  const key = name as CapabilityName;
  return DOCS[key] ?? null;
}

export function listCapabilityNames(): CapabilityName[] {
  return Object.keys(DOCS) as CapabilityName[];
}

// -------------------------------------------------------------------------
// SMART CLASSIFIER — Detects which capabilities apply to a user prompt.
// Used in CREATE mode (one-shot generation) to pre-inject the right docs.
// In AGENT mode, the AI fetches docs on demand via get_capability_doc.
// -------------------------------------------------------------------------

interface DetectionRule {
  capability: CapabilityName;
  keywords: RegExp[];
}

const RULES: DetectionRule[] = [
  {
    capability: "phaser_game",
    keywords: [
      /\b(game|gaming|play|player|score|level|levels|leaderboard|shoot(er)?|rac(e|ing)|puzzle|platformer|arcade|rpg|strategy|adventure|simulation|chess|trivia|battle|fighter|runner|clicker|tower\s*defense|enemies|boss|power[- ]?up|lives|health\s*bar|jump|gravity|collision|canvas|sprite|phaser)\b/i,
    ],
  },
  {
    capability: "ecommerce",
    keywords: [
      /\b(shop|store|e-?commerce|ecommerce|products?|product\s*catalog|cart|checkout|marketplace|buy|sell|inventory|sku|catalog)\b/i,
    ],
  },
  {
    capability: "blog",
    keywords: [
      /\b(blog|cms|content\s*management|article|articles|post|posts|news|newsletter\s*site|magazine|editorial|journal|stories)\b/i,
    ],
  },
  {
    capability: "sports",
    keywords: [
      /\b(sport|sports|football|soccer|fifa|afc|uefa|club|team|national\s+team|squad|roster|lineup|standings|table|fixtures?|matches?|results?|fans?|supporters?)\b/i,
      /qatar|qatari|القطري|قطر|العنابي/i,
    ],
  },
  {
    capability: "booking",
    keywords: [
      /\b(book(ing)?|appointment|schedule|reservation|barber|salon|spa|clinic|consultation|haircut|massage|therapist|dentist|doctor)\b/i,
    ],
  },
  {
    capability: "forms",
    keywords: [
      /\b(contact\s*(us|form)?|quote\s*request|newsletter|waitlist|feedback|sign[- ]?up|subscribe|get\s*in\s*touch)\b/i,
    ],
  },
  {
    capability: "stock_images",
    keywords: [
      // Default-on for most site types; keep broad so nearly every project gets it.
      /\b(landing|website|portfolio|hero|gallery|images?|photos?|showcase|restaurant|cafe|hotel|fitness|gym|about|team|agency|studio|business|brand)\b/i,
    ],
  },
];

export function detectCapabilities(prompt: string): CapabilityName[] {
  const detected = new Set<CapabilityName>();
  const text = (prompt || "").slice(0, 4000); // cap to avoid pathological regex cost
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (kw.test(text)) {
        detected.add(rule.capability);
        break;
      }
    }
  }
  // If the user is building a game, they don't also need e-commerce/booking docs.
  if (detected.has("phaser_game")) {
    detected.delete("ecommerce");
    detected.delete("booking");
    detected.delete("forms");
  }
  return Array.from(detected);
}

/**
 * Assemble docs for CREATE mode — returns the concatenated capability docs
 * that match the prompt, or an empty string if none match.
 */
export function assembleCapabilityDocs(prompt: string): { names: CapabilityName[]; text: string } {
  const names = detectCapabilities(prompt);
  if (names.length === 0) return { names: [], text: "" };
  const sections = names.map((n) => DOCS[n]).filter(Boolean);
  return {
    names,
    text:
      "\n\n# 📚 LOADED CAPABILITIES (auto-selected for this request)\n" +
      sections.join("\n\n---\n"),
  };
}
