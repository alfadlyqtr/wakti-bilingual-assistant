import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Mail, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  LayoutGrid, 
  ListOrdered,
  Plus,
  Trash2,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContactFormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  label: string;
  labelAr: string;
}

export interface ContactFormConfig {
  formStyle: 'single' | 'multi-step' | 'floating';
  fields: ContactFormField[];
  design: {
    borderRadius: 'rounded' | 'sharp' | 'pill';
    submitButtonText: string;
    submitButtonTextAr: string;
  };
}

interface ContactFormWizardProps {
  onComplete: (config: ContactFormConfig, structuredPrompt: string) => void;
  onCancel: () => void;
  originalPrompt: string;
}

const DEFAULT_FIELDS: ContactFormField[] = [
  { id: 'name', name: 'name', type: 'text', required: true, label: 'Name', labelAr: 'الاسم' },
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني' },
  { id: 'phone', name: 'phone', type: 'tel', required: false, label: 'Phone', labelAr: 'الهاتف' },
  { id: 'subject', name: 'subject', type: 'text', required: false, label: 'Subject', labelAr: 'الموضوع' },
  { id: 'message', name: 'message', type: 'textarea', required: true, label: 'Message', labelAr: 'الرسالة' },
];

export function ContactFormWizard({ onComplete, onCancel, originalPrompt }: ContactFormWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: Form Style
  const [formStyle, setFormStyle] = useState<'single' | 'multi-step' | 'floating'>('single');
  
  // Step 2: Fields
  const [fields, setFields] = useState<ContactFormField[]>(DEFAULT_FIELDS);
  const [newFieldName, setNewFieldName] = useState('');
  
  // Step 3: Design
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [submitText, setSubmitText] = useState('Send Message');
  const [submitTextAr, setSubmitTextAr] = useState('إرسال الرسالة');

  const handleFieldToggle = (fieldId: string, key: 'required') => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, [key]: !f[key] } : f
    ));
  };

  const handleRemoveField = (fieldId: string) => {
    // Prevent removing core fields
    if (['name', 'email', 'message'].includes(fieldId)) return;
    setFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const id = newFieldName.toLowerCase().replace(/\s+/g, '_');
    setFields(prev => [...prev, {
      id,
      name: id,
      type: 'text',
      required: false,
      label: newFieldName,
      labelAr: newFieldName
    }]);
    setNewFieldName('');
  };

  const handleComplete = () => {
    const config: ContactFormConfig = {
      formStyle,
      fields,
      design: {
        borderRadius,
        submitButtonText: submitText,
        submitButtonTextAr: submitTextAr,
      }
    };

    // Build structured prompt
    let prompt = `Build a contact form with these specifications:

FORM STYLE: ${formStyle === 'single' ? 'Single page form' : formStyle === 'multi-step' ? 'Multi-step wizard' : 'Floating/modal form'}

FIELDS (in order):
${fields.map((f, i) => `${i + 1}. ${f.label} (${f.type}) - ${f.required ? 'required' : 'optional'}`).join('\n')}

DESIGN:
- Border style: ${borderRadius}
- Submit button text: "${submitText}"

IMPORTANT: This form MUST submit to the project backend at:
supabase.functions.invoke('project-backend-api', {
  body: { action: 'submitForm', projectId: '{{PROJECT_ID}}', formType: 'contact', ... }
})

Include proper validation and show a success message after submission.

Original request: ${originalPrompt}`;

    onComplete(config, prompt);
  };

  const formStyles = [
    { id: 'single', icon: <LayoutGrid className="h-5 w-5" />, label: 'Single Page', labelAr: 'صفحة واحدة' },
    { id: 'multi-step', icon: <ListOrdered className="h-5 w-5" />, label: 'Multi-Step', labelAr: 'متعدد الخطوات' },
    { id: 'floating', icon: <Mail className="h-5 w-5" />, label: 'Floating', labelAr: 'عائم' },
  ];

  const renderStep = () => {
    // Step 1: Form Style
    if (step === 1) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اختر نمط النموذج' : 'Choose form layout'}
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {formStyles.map(style => (
              <button
                key={style.id}
                onClick={() => setFormStyle(style.id as typeof formStyle)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  formStyle === style.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {style.icon}
                <span className="text-xs font-medium">
                  {isRTL ? style.labelAr : style.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 2: Field Configuration
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تكوين حقول النموذج' : 'Configure form fields'}
          </p>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm">{isRTL ? field.labelAr : field.label}</span>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                  {field.type}
                </span>
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">
                    {isRTL ? 'مطلوب' : 'Req'}
                  </Label>
                  <Switch
                    checked={field.required}
                    onCheckedChange={() => handleFieldToggle(field.id, 'required')}
                    disabled={['name', 'email', 'message'].includes(field.id)}
                  />
                </div>
                {!['name', 'email', 'message'].includes(field.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(field.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Input
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder={isRTL ? 'اسم الحقل الجديد...' : 'New field name...'}
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            />
            <Button size="sm" variant="outline" onClick={handleAddField} className="h-8">
              <Plus className="h-3 w-3" />
            </Button>
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
            
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نص زر الإرسال' : 'Submit Button Text'}</Label>
              <Input
                value={isRTL ? submitTextAr : submitText}
                onChange={(e) => isRTL ? setSubmitTextAr(e.target.value) : setSubmitText(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 p-4 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-emerald-500" />
        <h3 className="font-semibold text-sm">
          {isRTL ? '✉️ معالج نموذج الاتصال' : '✉️ Contact Form Wizard'}
        </h3>
      </div>
      
      {/* Progress Indicator */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-1 rounded-full transition-all",
              i + 1 <= step ? "bg-emerald-500" : "bg-muted"
            )}
          />
        ))}
      </div>
      
      {/* Step Content */}
      {renderStep()}
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
          className="text-xs"
        >
          {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
          {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
        </Button>
        
        {step < totalSteps ? (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {isRTL ? 'إنشاء النموذج' : 'Generate Form'}
          </Button>
        )}
      </div>
    </div>
  );
}
