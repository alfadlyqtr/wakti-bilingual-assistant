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
  GripVertical,
  ArrowUp,
  ArrowDown,
  Columns,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContactFormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  label: string;
  labelAr: string;
  width?: 'full' | 'half'; // Column width
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
  { id: 'name', name: 'name', type: 'text', required: true, label: 'Name', labelAr: 'الاسم', width: 'half' },
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني', width: 'half' },
  { id: 'phone', name: 'phone', type: 'tel', required: false, label: 'Phone', labelAr: 'الهاتف', width: 'half' },
  { id: 'subject', name: 'subject', type: 'text', required: false, label: 'Subject', labelAr: 'الموضوع', width: 'half' },
  { id: 'message', name: 'message', type: 'textarea', required: true, label: 'Message', labelAr: 'الرسالة', width: 'full' },
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

  const handleFieldWidthToggle = (fieldId: string) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, width: f.width === 'full' ? 'half' : 'full' } : f
    ));
  };

  const handleMoveField = (fieldId: string, direction: 'up' | 'down') => {
    setFields(prev => {
      const index = prev.findIndex(f => f.id === fieldId);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;
      
      const newFields = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
      return newFields;
    });
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
      labelAr: newFieldName,
      width: 'full'
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

    // Build structured prompt with layout info
    let prompt = `Build a contact form with these specifications:

FORM STYLE: ${formStyle === 'single' ? 'Single page form' : formStyle === 'multi-step' ? 'Multi-step wizard' : 'Floating/modal form'}

FIELDS (in order with layout):
${fields.map((f, i) => `${i + 1}. ${f.label} (${f.type}) - ${f.required ? 'required' : 'optional'} - ${f.width === 'half' ? 'half width (2 columns)' : 'full width'}`).join('\n')}

LAYOUT INSTRUCTIONS:
- Fields marked as "half width" should appear side-by-side (2 per row)
- Fields marked as "full width" should span the entire row
- Use CSS grid or flexbox to achieve this layout

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
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-border hover:border-indigo-500/50"
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

    // Step 2: Field Configuration with reordering and width options
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تكوين حقول النموذج' : 'Configure form fields'}
          </p>
          
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-1.5 p-2 rounded-lg border border-border bg-background"
              >
                {/* Drag Handle */}
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                
                {/* Field Label */}
                <span className="flex-1 text-sm font-medium truncate min-w-0">
                  {isRTL ? field.labelAr : field.label}
                </span>
                
                {/* Type Badge */}
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted flex-shrink-0">
                  {field.type}
                </span>
                
                {/* Required Toggle */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Label className="text-[10px] text-muted-foreground">
                    {isRTL ? 'مطلوب' : 'Req'}
                  </Label>
                  <Switch
                    checked={field.required}
                    onCheckedChange={() => handleFieldToggle(field.id, 'required')}
                    disabled={['name', 'email', 'message'].includes(field.id)}
                    className="scale-75"
                  />
                </div>
                
                {/* Width Toggle - Half/Full */}
                <button
                  onClick={() => handleFieldWidthToggle(field.id)}
                  className={cn(
                    "p-1 rounded transition-colors flex-shrink-0",
                    field.width === 'half' 
                      ? "bg-indigo-500/20 text-indigo-500" 
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  title={field.width === 'half' ? (isRTL ? 'نصف العرض' : 'Half width') : (isRTL ? 'العرض الكامل' : 'Full width')}
                >
                  {field.width === 'half' ? (
                    <Columns className="h-3 w-3" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                </button>
                
                {/* Move Up/Down Buttons */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleMoveField(field.id, 'up')}
                    disabled={index === 0}
                    className={cn(
                      "p-0.5 rounded transition-colors",
                      index === 0 
                        ? "text-muted-foreground/30 cursor-not-allowed" 
                        : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                    )}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleMoveField(field.id, 'down')}
                    disabled={index === fields.length - 1}
                    className={cn(
                      "p-0.5 rounded transition-colors",
                      index === fields.length - 1 
                        ? "text-muted-foreground/30 cursor-not-allowed" 
                        : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                    )}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                
                {/* Delete Button */}
                {!['name', 'email', 'message'].includes(field.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(field.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          {/* Add Field */}
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
          
          {/* Layout Legend */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <Columns className="h-3 w-3 text-indigo-500" />
              <span>{isRTL ? 'نصف العرض (حقلين بجانب بعض)' : 'Half = 2 fields side by side'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Square className="h-3 w-3" />
              <span>{isRTL ? 'العرض الكامل' : 'Full = spans entire row'}</span>
            </div>
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
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-border hover:border-indigo-500/50"
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
    <div className="w-full space-y-4 p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-indigo-500" />
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
              i + 1 <= step ? "bg-indigo-500" : "bg-muted"
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
            className="text-xs bg-indigo-600 hover:bg-indigo-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {isRTL ? 'إنشاء النموذج' : 'Generate Form'}
          </Button>
        )}
      </div>
    </div>
  );
}
