/**
 * Request Analyzer - Breaks down complex multi-feature requests into sequential wizard steps
 * This allows users to make natural, complex requests while the system handles them intelligently
 */

export type FeatureType = 
  | 'landing'      // Landing page / hero section
  | 'booking'      // Booking/appointment system
  | 'products'     // E-commerce / product catalog
  | 'auth'         // Login/signup pages
  | 'media'        // Gallery / file uploads
  | 'contact'      // Contact form
  | 'cart'         // Shopping cart
  | 'checkout'     // Checkout page
  | 'account'      // User account / dashboard
  | 'bilingual';   // Language toggle (EN/AR)

export interface DetectedFeature {
  type: FeatureType;
  priority: number;        // Lower = higher priority (build order)
  keywords: string[];      // Keywords that triggered detection
  requiresWizard: boolean; // Whether this feature needs wizard configuration
  description: string;     // Human-readable description
}

export interface AnalyzedRequest {
  originalPrompt: string;
  businessType: string;           // e.g., "barber shop", "restaurant", etc.
  features: DetectedFeature[];
  totalFeatures: number;
  currentFeatureIndex: number;
  isMultiFeature: boolean;
}

// Feature detection patterns with priorities
const FEATURE_PATTERNS: Record<FeatureType, { 
  patterns: RegExp[]; 
  priority: number; 
  requiresWizard: boolean;
  description: string;
}> = {
  landing: {
    patterns: [
      /\b(landing|home|main|hero|front)\s*(page|section)?/i,
      /\b(website|site)\b/i,
    ],
    priority: 1,
    requiresWizard: false,
    description: 'Landing page with hero section'
  },
  booking: {
    patterns: [
      /\b(book|booking|appointment|schedule|reservation)\s*(page|system|form)?/i,
      /\b(haircut|service|salon|barber)\s*(booking|appointment)?/i,
      /\bحجز|موعد/i,
    ],
    priority: 2,
    requiresWizard: true,
    description: 'Booking/appointment system'
  },
  products: {
    patterns: [
      /\b(product|shop|store|sell|e-?commerce|catalog|inventory)\s*(page|section)?/i,
      /\b(hair\s*products?|items?|merchandise)\b/i,
      /\bمتجر|منتج/i,
    ],
    priority: 3,
    requiresWizard: true,
    description: 'Product catalog/shop'
  },
  cart: {
    patterns: [
      /\b(cart|shopping\s*cart|basket)\b/i,
      /\b(add\s*to\s*cart|buy\s*multiple)\b/i,
    ],
    priority: 4,
    requiresWizard: false,
    description: 'Shopping cart'
  },
  checkout: {
    patterns: [
      /\b(checkout|payment|pay)\s*(page)?/i,
      /\b(card|credit\s*card)\s*(checkout|payment)?/i,
    ],
    priority: 5,
    requiresWizard: false,
    description: 'Checkout page'
  },
  auth: {
    patterns: [
      /\b(login|log\s*in|sign\s*in|signup|sign\s*up|register|account|auth)\s*(page|form)?/i,
      /\b(user|member)\s*(account|registration)\b/i,
      /\bتسجيل\s*(دخول|جديد)/i,
    ],
    priority: 6,
    requiresWizard: true,
    description: 'Login/signup pages'
  },
  account: {
    patterns: [
      /\b(my\s*account|dashboard|profile|user\s*area)\b/i,
      /\b(see|view|track)\s*(booking|order|purchase|appointment)/i,
      /\b(booking|order|purchase)\s*(history|list)\b/i,
    ],
    priority: 7,
    requiresWizard: false,
    description: 'User account dashboard'
  },
  media: {
    patterns: [
      // Only match BUILD requests, not VIEW requests
      /\b(add|create|build|make)\s*(gallery|photo|image|picture)\s*(upload|section|page|component)/i,
      /\b(add|create|build|make)\s*(upload|dropzone)\s*(component|section|area)/i,
      /\bرفع\s*(صور|ملف)/i,
    ],
    priority: 8,
    requiresWizard: true,
    description: 'Image gallery/uploads'
  },
  contact: {
    patterns: [
      /\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us)\s*(page|form)?/i,
      /\b(message|feedback)\s*(form|us)?\b/i,
      /\bتواصل|اتصل/i,
    ],
    priority: 9,
    requiresWizard: true,
    description: 'Contact form'
  },
  bilingual: {
    patterns: [
      /\b(arabic|english|bilingual|language|rtl)\b/i,
      /\b(toggle|switch)\s*(language|arabic|english)\b/i,
      /\bعربي|انجليزي/i,
    ],
    priority: 10,
    requiresWizard: false,
    description: 'Bilingual support (EN/AR)'
  },
};

// Business type detection
const BUSINESS_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /\b(barber|barbershop|barber\s*shop|hair\s*salon|salon)\b/i, type: 'barber shop' },
  { pattern: /\b(restaurant|cafe|coffee|food|dining)\b/i, type: 'restaurant' },
  { pattern: /\b(gym|fitness|workout|training)\b/i, type: 'fitness center' },
  { pattern: /\b(clinic|doctor|medical|health)\b/i, type: 'medical clinic' },
  { pattern: /\b(spa|massage|wellness|beauty)\b/i, type: 'spa & wellness' },
  { pattern: /\b(store|shop|retail|boutique)\b/i, type: 'retail store' },
  { pattern: /\b(agency|consulting|service)\b/i, type: 'service business' },
];

/**
 * Analyzes a user prompt and extracts all requested features
 */
export function analyzeRequest(prompt: string): AnalyzedRequest {
  const features: DetectedFeature[] = [];
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect business type
  let businessType = 'business';
  for (const { pattern, type } of BUSINESS_PATTERNS) {
    if (pattern.test(prompt)) {
      businessType = type;
      break;
    }
  }
  
  // Detect all features
  for (const [featureType, config] of Object.entries(FEATURE_PATTERNS)) {
    const matchedKeywords: string[] = [];
    
    for (const pattern of config.patterns) {
      const match = prompt.match(pattern);
      if (match) {
        matchedKeywords.push(match[0]);
      }
    }
    
    if (matchedKeywords.length > 0) {
      features.push({
        type: featureType as FeatureType,
        priority: config.priority,
        keywords: matchedKeywords,
        requiresWizard: config.requiresWizard,
        description: config.description,
      });
    }
  }
  
  // Sort by priority
  features.sort((a, b) => a.priority - b.priority);
  
  return {
    originalPrompt: prompt,
    businessType,
    features,
    totalFeatures: features.length,
    currentFeatureIndex: 0,
    isMultiFeature: features.length > 1,
  };
}

/**
 * Gets the next feature that requires a wizard
 */
export function getNextWizardFeature(analysis: AnalyzedRequest): DetectedFeature | null {
  for (let i = analysis.currentFeatureIndex; i < analysis.features.length; i++) {
    if (analysis.features[i].requiresWizard) {
      return analysis.features[i];
    }
  }
  return null;
}

/**
 * Gets all features that don't require wizards (can be generated directly)
 */
export function getNonWizardFeatures(analysis: AnalyzedRequest): DetectedFeature[] {
  return analysis.features.filter(f => !f.requiresWizard);
}

/**
 * Generates a structured prompt for the AI based on analyzed features
 */
export function generateStructuredPrompt(
  analysis: AnalyzedRequest,
  wizardConfigs: Record<FeatureType, any>
): string {
  const lines: string[] = [
    `Create a ${analysis.businessType} website with the following features:`,
    '',
  ];
  
  for (const feature of analysis.features) {
    const config = wizardConfigs[feature.type];
    if (config) {
      lines.push(`## ${feature.description}`);
      lines.push(JSON.stringify(config, null, 2));
      lines.push('');
    } else {
      lines.push(`## ${feature.description}`);
      lines.push(`Include a ${feature.description.toLowerCase()}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Maps feature type to wizard type for triggering
 */
export function featureToWizardType(feature: FeatureType): string | null {
  const mapping: Record<FeatureType, string | null> = {
    landing: null,
    booking: 'booking',
    products: 'product',
    cart: null,
    checkout: null,
    auth: 'auth',
    account: null,
    media: 'media',
    contact: 'contact',
    bilingual: null,
  };
  return mapping[feature];
}

/**
 * Creates a summary of detected features for display
 */
export function createFeatureSummary(analysis: AnalyzedRequest): string {
  if (analysis.features.length === 0) {
    return 'No specific features detected';
  }
  
  const featureList = analysis.features
    .map(f => `• ${f.description}${f.requiresWizard ? ' (needs configuration)' : ''}`)
    .join('\n');
  
  return `Detected ${analysis.features.length} features for your ${analysis.businessType}:\n${featureList}`;
}
