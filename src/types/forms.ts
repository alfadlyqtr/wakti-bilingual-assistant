// ============================================================================
// FORM TYPES
// Types for form handling and validation
// ============================================================================

import type { Language, Priority, BilingualText } from './common';

/**
 * Base form state
 */
export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

/**
 * Form field props
 */
export interface FormFieldProps<T = string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Select option
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

/**
 * Bilingual select option
 */
export interface BilingualSelectOption<T = string> extends Omit<SelectOption<T>, 'label'> {
  label: BilingualText;
}

// ============================================================================
// SPECIFIC FORM TYPES
// ============================================================================

/**
 * Login form
 */
export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Signup form
 */
export interface SignupFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  acceptTerms: boolean;
}

/**
 * Profile form
 */
export interface ProfileFormValues {
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  language: Language;
  timezone?: string;
}

/**
 * Task form
 */
export interface TaskFormValues {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  tags?: string[];
  assigneeId?: string;
}

/**
 * Event form
 */
export interface EventFormValues {
  title: string;
  description?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  locationLink?: string;
  isPublic?: boolean;
}

/**
 * Reminder form
 */
export interface ReminderFormValues {
  title: string;
  date: string;
  time: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  notifyBefore?: number; // minutes
}

/**
 * Project form
 */
export interface ProjectFormValues {
  name: string;
  description?: string;
  template?: string;
  isPublic?: boolean;
}

/**
 * Contact form (for support)
 */
export interface ContactFormValues {
  name: string;
  email: string;
  subject?: string;
  message: string;
  type: 'general' | 'support' | 'feedback' | 'bug';
}

/**
 * Settings form
 */
export interface SettingsFormValues {
  language: Language;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    reminders: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showOnlineStatus: boolean;
    allowContactRequests: boolean;
  };
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

/**
 * Validation rule
 */
export interface ValidationRule<T = string> {
  validate: (value: T, values?: Record<string, unknown>) => boolean;
  message: string | BilingualText;
}

/**
 * Field validation schema
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Common validation patterns
 */
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s-()]+$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
} as const;

/**
 * Validation messages (bilingual)
 */
export const VALIDATION_MESSAGES = {
  required: {
    en: 'This field is required',
    ar: 'هذا الحقل مطلوب',
  },
  email: {
    en: 'Please enter a valid email address',
    ar: 'يرجى إدخال بريد إلكتروني صالح',
  },
  minLength: (min: number) => ({
    en: `Must be at least ${min} characters`,
    ar: `يجب أن يكون ${min} أحرف على الأقل`,
  }),
  maxLength: (max: number) => ({
    en: `Must be at most ${max} characters`,
    ar: `يجب أن يكون ${max} أحرف كحد أقصى`,
  }),
  passwordMatch: {
    en: 'Passwords do not match',
    ar: 'كلمات المرور غير متطابقة',
  },
  passwordStrength: {
    en: 'Password must contain uppercase, lowercase, and a number',
    ar: 'يجب أن تحتوي كلمة المرور على أحرف كبيرة وصغيرة ورقم',
  },
} as const;
