import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  UserCircle, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AuthField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'password' | 'tel';
  required: boolean;
  label: string;
  labelAr: string;
}

export interface AuthConfig {
  authType: 'login' | 'signup' | 'both';
  fields: AuthField[];
  features: {
    socialLogin: boolean;
    forgotPassword: boolean;
    rememberMe: boolean;
    emailVerification: boolean;
    phoneVerification: boolean;
  };
  design: {
    layout: 'card' | 'split' | 'fullscreen';
    borderRadius: 'rounded' | 'sharp' | 'pill';
    colorScheme: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
  };
}

interface AuthWizardProps {
  onComplete: (config: AuthConfig, structuredPrompt: string) => void;
  onCancel: () => void;
  onSkipWizard: () => void;
  originalPrompt: string;
}

const DEFAULT_LOGIN_FIELDS: AuthField[] = [
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني' },
  { id: 'password', name: 'password', type: 'password', required: true, label: 'Password', labelAr: 'كلمة المرور' },
];

const DEFAULT_SIGNUP_FIELDS: AuthField[] = [
  { id: 'name', name: 'name', type: 'text', required: true, label: 'Full Name', labelAr: 'الاسم الكامل' },
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني' },
  { id: 'phone', name: 'phone', type: 'tel', required: false, label: 'Phone', labelAr: 'الهاتف' },
  { id: 'password', name: 'password', type: 'password', required: true, label: 'Password', labelAr: 'كلمة المرور' },
  { id: 'confirmPassword', name: 'confirmPassword', type: 'password', required: true, label: 'Confirm Password', labelAr: 'تأكيد كلمة المرور' },
];

export function AuthWizard({ onComplete, onCancel, onSkipWizard, originalPrompt }: AuthWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: Auth Type
  const [authType, setAuthType] = useState<'login' | 'signup' | 'both'>('both');
  const [fields, setFields] = useState<AuthField[]>(DEFAULT_SIGNUP_FIELDS);
  
  // Step 2: Features
  const [socialLogin, setSocialLogin] = useState(true);
  const [forgotPassword, setForgotPassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailVerification, setEmailVerification] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState(false);
  
  // Step 3: Design
  const [layout, setLayout] = useState<'card' | 'split' | 'fullscreen'>('card');
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [colorScheme, setColorScheme] = useState<'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');

  const COLOR_SCHEMES = [
    { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo', labelAr: 'نيلي' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Green', labelAr: 'أخضر' },
    { id: 'rose', color: 'bg-rose-500', label: 'Rose', labelAr: 'وردي' },
    { id: 'amber', color: 'bg-amber-500', label: 'Amber', labelAr: 'كهرماني' },
    { id: 'slate', color: 'bg-slate-600', label: 'Slate', labelAr: 'رمادي' },
  ];

  const handleAuthTypeChange = (type: 'login' | 'signup' | 'both') => {
    setAuthType(type);
    if (type === 'login') {
      setFields(DEFAULT_LOGIN_FIELDS);
    } else {
      setFields(DEFAULT_SIGNUP_FIELDS);
    }
  };

  const handleComplete = () => {
    const config: AuthConfig = {
      authType,
      fields,
      features: {
        socialLogin,
        forgotPassword,
        rememberMe,
        emailVerification,
        phoneVerification,
      },
      design: {
        layout,
        borderRadius,
        colorScheme,
      }
    };

    let prompt = `Build a beautiful authentication system with these EXACT specifications:

AUTH TYPE: ${authType === 'both' ? 'Both Login and Signup pages with toggle/tabs' : authType === 'login' ? 'Login page only' : 'Signup page only'}

FIELDS:
${fields.map(f => `- ${f.label} (${f.type}) - ${f.required ? 'REQUIRED' : 'optional'}`).join('\n')}

FEATURES:
${socialLogin ? '- Social login buttons (Google, Apple) - use icons only, no actual OAuth implementation' : '- No social login'}
${forgotPassword ? '- "Forgot Password?" link that shows a password reset form' : '- No forgot password link'}
${rememberMe ? '- "Remember me" checkbox' : '- No remember me option'}
${emailVerification ? '- Email verification step after signup' : ''}
${phoneVerification ? '- Phone/SMS verification option' : ''}

LAYOUT: ${layout}
${layout === 'card' ? '- Centered card on gradient/blurred background' : ''}
${layout === 'split' ? '- Two-column layout: left side has branding/image, right side has form' : ''}
${layout === 'fullscreen' ? '- Full-screen form with subtle background pattern' : ''}

DESIGN:
- Border radius: ${borderRadius}
- Color scheme: ${colorScheme} (use ${colorScheme}-500 for primary buttons)
- Add password visibility toggle (eye icon)
- Form validation with inline error messages
- Loading state on submit button
- Smooth transitions and hover effects

BACKEND INTEGRATION:
- Login: { projectId: "{{PROJECT_ID}}", action: "auth/login", data: { email, password } }
- Signup: { projectId: "{{PROJECT_ID}}", action: "auth/signup", data: { name, email, password, phone } }
- Forgot Password: { projectId: "{{PROJECT_ID}}", action: "auth/forgot-password", data: { email } }
- Store auth token in localStorage after successful login
- Redirect to dashboard/home after authentication

CRITICAL - DO NOT:
- Do NOT create supabaseClient.js
- Do NOT write any API keys
- Do NOT import from @supabase/supabase-js directly

Original request: ${originalPrompt}`;

    onComplete(config, prompt);
  };

  const authTypes = [
    { id: 'login', icon: <LogIn className="h-5 w-5" />, label: 'Login Only', labelAr: 'تسجيل دخول فقط' },
    { id: 'signup', icon: <UserPlus className="h-5 w-5" />, label: 'Signup Only', labelAr: 'تسجيل جديد فقط' },
    { id: 'both', icon: <UserCircle className="h-5 w-5" />, label: 'Both', labelAr: 'كلاهما' },
  ];

  const layoutOptions = [
    { id: 'card', label: 'Card', labelAr: 'بطاقة', desc: 'Centered card', descAr: 'بطاقة في المنتصف' },
    { id: 'split', label: 'Split', labelAr: 'منقسم', desc: 'Two columns', descAr: 'عمودين' },
    { id: 'fullscreen', label: 'Full', labelAr: 'كامل', desc: 'Full screen', descAr: 'شاشة كاملة' },
  ];

  const renderStep = () => {
    // Step 1: Auth Type
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">
              {isRTL ? 'نوع المصادقة' : 'Authentication Type'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'اختر نوع صفحة المصادقة' : 'Choose your auth page type'}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {authTypes.map(type => (
              <button
                key={type.id}
                onClick={() => handleAuthTypeChange(type.id as typeof authType)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  authType === type.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {type.icon}
                <span className="text-xs font-medium">
                  {isRTL ? type.labelAr : type.label}
                </span>
              </button>
            ))}
          </div>

          {/* Fields Preview */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'الحقول المضمنة' : 'Included Fields'}
            </p>
            <div className="flex flex-wrap gap-1">
              {fields.map(field => (
                <span
                  key={field.id}
                  className="text-[10px] px-2 py-1 rounded-full bg-muted"
                >
                  {isRTL ? field.labelAr : field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Features
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اختر الميزات الإضافية' : 'Choose additional features'}
          </p>
          
          <div className="space-y-2">
            {[
              { 
                key: 'socialLogin', 
                icon: <Shield className="h-4 w-4" />,
                label: isRTL ? 'تسجيل دخول اجتماعي' : 'Social Login', 
                desc: isRTL ? 'Google, Apple' : 'Google, Apple',
                state: socialLogin, 
                setter: setSocialLogin 
              },
              { 
                key: 'forgotPassword', 
                icon: <KeyRound className="h-4 w-4" />,
                label: isRTL ? 'نسيت كلمة المرور' : 'Forgot Password', 
                desc: isRTL ? 'رابط إعادة تعيين' : 'Reset link',
                state: forgotPassword, 
                setter: setForgotPassword 
              },
              { 
                key: 'rememberMe', 
                icon: <Eye className="h-4 w-4" />,
                label: isRTL ? 'تذكرني' : 'Remember Me', 
                desc: isRTL ? 'خيار البقاء مسجل' : 'Stay logged in',
                state: rememberMe, 
                setter: setRememberMe 
              },
              { 
                key: 'emailVerification', 
                icon: <Mail className="h-4 w-4" />,
                label: isRTL ? 'تحقق البريد' : 'Email Verification', 
                desc: isRTL ? 'تأكيد البريد الإلكتروني' : 'Confirm email',
                state: emailVerification, 
                setter: setEmailVerification 
              },
              { 
                key: 'phoneVerification', 
                icon: <Phone className="h-4 w-4" />,
                label: isRTL ? 'تحقق الهاتف' : 'Phone Verification', 
                desc: isRTL ? 'رمز SMS' : 'SMS code',
                state: phoneVerification, 
                setter: setPhoneVerification 
              },
            ].map(opt => (
              <div 
                key={opt.key} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  opt.state ? "border-primary/30 bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-md",
                    opt.state ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {opt.icon}
                  </div>
                  <div>
                    <Label className="text-xs font-medium">{opt.label}</Label>
                    <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </div>
                <Switch checked={opt.state} onCheckedChange={opt.setter} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Step 3: Design
    if (step === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تخصيص التصميم' : 'Customize design'}
          </p>
          
          <div className="space-y-3">
            {/* Layout */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'التخطيط' : 'Layout'}</Label>
              <div className="grid grid-cols-3 gap-2">
                {layoutOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setLayout(opt.id as typeof layout)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      layout === opt.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-xs font-medium">{isRTL ? opt.labelAr : opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{isRTL ? opt.descAr : opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط الحواف' : 'Border Style'}</Label>
              <div className="flex gap-2">
                {(['rounded', 'sharp', 'pill'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setBorderRadius(r)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium border transition-all",
                      r === 'sharp' ? 'rounded-none' : r === 'pill' ? 'rounded-full' : 'rounded-lg',
                      borderRadius === r
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {r === 'rounded' ? (isRTL ? 'مدور' : 'Rounded') : 
                     r === 'sharp' ? (isRTL ? 'حاد' : 'Sharp') : 
                     (isRTL ? 'دائري' : 'Pill')}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نظام الألوان' : 'Color Scheme'}</Label>
              <div className="flex gap-2">
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    onClick={() => setColorScheme(scheme.id as typeof colorScheme)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all",
                      colorScheme === scheme.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full", scheme.color)} />
                    <span className="text-[10px]">{isRTL ? scheme.labelAr : scheme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div className="text-xs font-semibold mb-2">
                {isRTL ? 'معاينة' : 'Preview'}
              </div>
              <div className={cn(
                "p-3 bg-background",
                borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'pill' ? 'rounded-2xl' : 'rounded-lg',
                "border border-border"
              )}>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded w-1/3 mx-auto" />
                  <div className="h-7 bg-muted rounded" />
                  <div className="h-7 bg-muted rounded" />
                  <div className={cn(
                    "h-8 rounded",
                    colorScheme === 'indigo' ? 'bg-indigo-500' :
                    colorScheme === 'emerald' ? 'bg-emerald-500' :
                    colorScheme === 'rose' ? 'bg-rose-500' :
                    colorScheme === 'amber' ? 'bg-amber-500' : 'bg-slate-600'
                  )} />
                  {socialLogin && (
                    <div className="flex gap-2">
                      <div className="flex-1 h-7 bg-muted rounded" />
                      <div className="flex-1 h-7 bg-muted rounded" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 p-4 bg-card border border-border rounded-2xl shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-semibold text-sm">
              {isRTL ? 'معالج المصادقة' : 'Auth Wizard'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'إعداد تسجيل الدخول والتسجيل' : 'Set up login & signup'}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isRTL ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
        </span>
      </div>
      
      {/* Step Content */}
      {renderStep()}
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
            className="text-xs"
          >
            {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </Button>
          
          {step === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSkipWizard}
              className="text-xs border-dashed"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {isRTL ? 'دع الذكاء يتولى' : 'Let AI Handle It'}
            </Button>
          )}
        </div>
        
        {step < totalSteps ? (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            className="text-xs bg-blue-600 hover:bg-blue-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {isRTL ? 'إنشاء صفحة المصادقة' : 'Generate Auth Page'}
          </Button>
        )}
      </div>
    </div>
  );
}
