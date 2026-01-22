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

export function detectWizardType(prompt: string): WizardType {
  const lowerPrompt = prompt.toLowerCase();
  
  // Booking patterns
  if (
    lowerPrompt.includes('booking') ||
    lowerPrompt.includes('appointment') ||
    lowerPrompt.includes('schedule') ||
    lowerPrompt.includes('reservation') ||
    lowerPrompt.includes('حجز') ||
    lowerPrompt.includes('موعد')
  ) {
    return 'booking';
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
    return 'contact';
  }
  
  // E-commerce/Product patterns
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
    return 'product';
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
    return 'auth';
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
    return 'media';
  }
  
  return 'none';
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
