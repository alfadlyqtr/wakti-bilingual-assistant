// Wizard Components Index
// Central export for all AI Coder wizard components

export { BookingFormWizard } from '../BookingFormWizard';
export type { BookingFormConfig, BookingService, FormField } from '../BookingFormWizard';

export { ContactFormWizard } from '../ContactFormWizard';

export { ProductWizard } from '../ProductWizard';
export type { Product, ProductDisplayConfig } from '../ProductWizard';

export { AuthWizard } from '../AuthWizard';
export type { AuthConfig, AuthField } from '../AuthWizard';

export { MediaWizard } from '../MediaWizard';
export type { MediaConfig } from '../MediaWizard';

// Wizard type detection utility
export type WizardType = 'booking' | 'contact' | 'product' | 'auth' | 'media' | 'none';

// Detect if this is an "add more" request vs "create new"
export interface WizardDetectionResult {
  type: WizardType;
  isAddMore: boolean;  // true = adding to existing, false = creating new
  confidence: 'high' | 'medium' | 'low';
}

export function detectWizardType(prompt: string): WizardType {
  return detectWizardTypeAdvanced(prompt).type;
}

export function detectWizardTypeAdvanced(prompt: string): WizardDetectionResult {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect "add more" patterns
  const addMorePatterns = [
    /add\s+(more\s+)?(new\s+)?products?/i,
    /add\s+(more\s+)?(new\s+)?items?/i,
    /add\s+(more\s+)?(new\s+)?services?/i,
    /create\s+(a\s+)?(new\s+)?product/i,
    /new\s+product/i,
    /another\s+product/i,
    /more\s+products/i,
    /إضافة\s+منتج/i,
    /منتج\s+جديد/i,
    /إضافة\s+خدمة/i,
  ];
  
  const isAddMore = addMorePatterns.some(pattern => pattern.test(prompt));
  
  // Booking patterns
  if (
    lowerPrompt.includes('booking') ||
    lowerPrompt.includes('appointment') ||
    lowerPrompt.includes('schedule') ||
    lowerPrompt.includes('reservation') ||
    lowerPrompt.includes('حجز') ||
    lowerPrompt.includes('موعد')
  ) {
    return { type: 'booking', isAddMore, confidence: 'high' };
  }
  
  // Contact form patterns
  if (
    lowerPrompt.includes('contact form') ||
    lowerPrompt.includes('contact us') ||
    lowerPrompt.includes('get in touch') ||
    lowerPrompt.includes('message form') ||
    lowerPrompt.includes('feedback form') ||
    lowerPrompt.includes('نموذج اتصال') ||
    lowerPrompt.includes('تواصل معنا')
  ) {
    return { type: 'contact', isAddMore, confidence: 'high' };
  }
  
  // E-commerce/Product patterns - ENHANCED for "add more" detection
  if (
    lowerPrompt.includes('product') ||
    lowerPrompt.includes('shop') ||
    lowerPrompt.includes('store') ||
    lowerPrompt.includes('e-commerce') ||
    lowerPrompt.includes('ecommerce') ||
    lowerPrompt.includes('cart') ||
    lowerPrompt.includes('catalog') ||
    lowerPrompt.includes('inventory') ||
    lowerPrompt.includes('متجر') ||
    lowerPrompt.includes('منتج')
  ) {
    return { type: 'product', isAddMore, confidence: 'high' };
  }
  
  // Auth patterns
  if (
    lowerPrompt.includes('login') ||
    lowerPrompt.includes('signup') ||
    lowerPrompt.includes('sign up') ||
    lowerPrompt.includes('sign in') ||
    lowerPrompt.includes('register') ||
    lowerPrompt.includes('authentication') ||
    lowerPrompt.includes('auth page') ||
    lowerPrompt.includes('تسجيل دخول') ||
    lowerPrompt.includes('تسجيل جديد')
  ) {
    return { type: 'auth', isAddMore, confidence: 'high' };
  }
  
  // Media/Upload patterns
  if (
    lowerPrompt.includes('upload') ||
    lowerPrompt.includes('file upload') ||
    lowerPrompt.includes('image upload') ||
    lowerPrompt.includes('media') ||
    lowerPrompt.includes('gallery') ||
    lowerPrompt.includes('dropzone') ||
    lowerPrompt.includes('رفع ملف') ||
    lowerPrompt.includes('رفع صور')
  ) {
    return { type: 'media', isAddMore, confidence: 'high' };
  }
  
  return { type: 'none', isAddMore: false, confidence: 'low' };
}

// Check if prompt is specifically about adding data (not UI changes)
export function isDataAdditionRequest(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  // Patterns that indicate user wants to ADD DATA, not change UI
  const dataPatterns = [
    /add\s+(a\s+)?(new\s+)?product/i,
    /add\s+(a\s+)?(new\s+)?item/i,
    /add\s+(a\s+)?(new\s+)?service/i,
    /create\s+(a\s+)?(new\s+)?product/i,
    /new\s+product\s+called/i,
    /add\s+.+\s+for\s+\$?\d+/i,  // "add coffee mug for $25"
    /add\s+.+\s+at\s+\$?\d+/i,   // "add t-shirt at $50"
    /إضافة\s+منتج/i,
    /منتج\s+جديد/i,
  ];
  
  // Patterns that indicate UI changes (not data)
  const uiPatterns = [
    /change\s+(the\s+)?layout/i,
    /update\s+(the\s+)?design/i,
    /make\s+it\s+\d+\s+columns/i,
    /change\s+(the\s+)?color/i,
    /redesign/i,
    /restyle/i,
  ];
  
  const isDataRequest = dataPatterns.some(p => p.test(prompt));
  const isUIRequest = uiPatterns.some(p => p.test(prompt));
  
  // If it matches data patterns and NOT UI patterns, it's a data request
  return isDataRequest && !isUIRequest;
}

// Wizard configuration for pause-and-continue system
export interface WizardTrigger {
  type: WizardType;
  patterns: string[];
  priority: number;
}

export const WIZARD_TRIGGERS: WizardTrigger[] = [
  {
    type: 'booking',
    patterns: ['booking', 'appointment', 'schedule', 'reservation', 'حجز', 'موعد'],
    priority: 1
  },
  {
    type: 'contact',
    patterns: ['contact form', 'contact us', 'get in touch', 'feedback', 'نموذج اتصال'],
    priority: 2
  },
  {
    type: 'product',
    patterns: ['product', 'shop', 'store', 'e-commerce', 'cart', 'متجر', 'منتج'],
    priority: 3
  },
  {
    type: 'auth',
    patterns: ['login', 'signup', 'sign up', 'register', 'authentication', 'تسجيل'],
    priority: 4
  },
  {
    type: 'media',
    patterns: ['upload', 'file upload', 'gallery', 'dropzone', 'رفع'],
    priority: 5
  }
];
