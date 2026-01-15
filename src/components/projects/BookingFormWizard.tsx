import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Calendar, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  LayoutGrid, 
  ListOrdered,
  Plus,
  Trash2,
  GripVertical,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BookingService {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'time' | 'textarea' | 'select';
  required: boolean;
  label: string;
  labelAr: string;
}

export interface BookingFormConfig {
  selectedServices: string[];
  formStyle: 'single' | 'multi-step' | 'sidebar';
  fields: FormField[];
  design: {
    borderRadius: 'rounded' | 'sharp' | 'pill';
    submitButtonText: string;
    submitButtonTextAr: string;
  };
}

interface BookingFormWizardProps {
  services: BookingService[];
  onComplete: (config: BookingFormConfig, structuredPrompt: string) => void;
  onCancel: () => void;
  onSkipWizard: () => void; // Let AI handle it directly
  originalPrompt: string;
}

const DEFAULT_FIELDS: FormField[] = [
  { id: 'name', name: 'name', type: 'text', required: true, label: 'Full Name', labelAr: 'الاسم الكامل' },
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني' },
  { id: 'phone', name: 'phone', type: 'tel', required: false, label: 'Phone', labelAr: 'الهاتف' },
  { id: 'service', name: 'service', type: 'select', required: true, label: 'Service', labelAr: 'الخدمة' },
  { id: 'date', name: 'date', type: 'date', required: true, label: 'Date', labelAr: 'التاريخ' },
  { id: 'time', name: 'time', type: 'time', required: true, label: 'Time', labelAr: 'الوقت' },
  { id: 'notes', name: 'notes', type: 'textarea', required: false, label: 'Notes', labelAr: 'ملاحظات' },
];

export function BookingFormWizard({ services, onComplete, onCancel, onSkipWizard, originalPrompt }: BookingFormWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(services.length > 0 ? 1 : 2);
  const totalSteps = services.length > 0 ? 4 : 3;
  
  // Step 1: Service Selection
  const [selectedServices, setSelectedServices] = useState<string[]>(
    services.length > 0 ? services.map(s => s.id) : []
  );
  
  // Step 2: Form Style
  const [formStyle, setFormStyle] = useState<'single' | 'multi-step' | 'sidebar'>('single');
  
  // Step 3: Fields
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);
  const [newFieldName, setNewFieldName] = useState('');
  
  // Step 4: Design
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [submitText, setSubmitText] = useState('Book Appointment');
  const [submitTextAr, setSubmitTextAr] = useState('احجز موعد');

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(services.map(s => s.id));
    }
  };

  const handleFieldToggle = (fieldId: string, key: 'required') => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, [key]: !f[key] } : f
    ));
  };

  const handleRemoveField = (fieldId: string) => {
    // Prevent removing required fields
    if (['name', 'email', 'date', 'time'].includes(fieldId)) return;
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
    const config: BookingFormConfig = {
      selectedServices,
      formStyle,
      fields,
      design: {
        borderRadius,
        submitButtonText: submitText,
        submitButtonTextAr: submitTextAr,
      }
    };

    // Build structured prompt
    const selectedServiceDetails = services.filter(s => selectedServices.includes(s.id));
    
    let prompt = `Build a booking form with these specifications:

`;
    
    if (selectedServiceDetails.length > 0) {
      prompt += `SERVICES TO INCLUDE:
${selectedServiceDetails.map(s => `- ${s.name} (${s.duration} min, ${s.price} QAR)`).join('\n')}

`;
    }
    
    prompt += `FORM STYLE: ${formStyle === 'single' ? 'Single page form' : formStyle === 'multi-step' ? 'Multi-step wizard' : 'Sidebar with summary'}

FIELDS (in order):
${fields.map((f, i) => `${i + 1}. ${f.label} (${f.type}) - ${f.required ? 'required' : 'optional'}`).join('\n')}

DESIGN:
- Border style: ${borderRadius}
- Submit button text: "${submitText}"

IMPORTANT: This form MUST submit to the project backend at:
supabase.functions.invoke('project-backend-api', {
  body: { action: 'createBooking', projectId: '{{PROJECT_ID}}', ... }
})

Original request: ${originalPrompt}`;

    onComplete(config, prompt);
  };

  const formStyles = [
    { id: 'single', icon: <LayoutGrid className="h-5 w-5" />, label: 'Single Page', labelAr: 'صفحة واحدة' },
    { id: 'multi-step', icon: <ListOrdered className="h-5 w-5" />, label: 'Multi-Step', labelAr: 'متعدد الخطوات' },
    { id: 'sidebar', icon: <LayoutGrid className="h-5 w-5" />, label: 'With Sidebar', labelAr: 'مع شريط جانبي' },
  ];

  const renderStep = () => {
    // Step 1: Service Selection (only if services exist)
    if (services.length > 0 && step === 1) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'اختر الخدمات للنموذج' : 'Select services for the form'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {selectedServices.length === services.length 
                ? (isRTL ? 'إلغاء الكل' : 'Deselect All')
                : (isRTL ? 'تحديد الكل' : 'Select All')
              }
            </Button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {services.map(service => (
              <div
                key={service.id}
                onClick={() => handleServiceToggle(service.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  selectedServices.includes(service.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Checkbox
                  checked={selectedServices.includes(service.id)}
                  onCheckedChange={() => handleServiceToggle(service.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.duration} {isRTL ? 'دقيقة' : 'min'} • {service.price} QAR
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Step 2: Form Style
    const styleStep = services.length > 0 ? 2 : 1;
    if (step === styleStep) {
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

    // Step 3: Field Configuration
    const fieldStep = services.length > 0 ? 3 : 2;
    if (step === fieldStep) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'تكوين حقول النموذج' : 'Configure form fields'}
          </p>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {fields.map((field, idx) => (
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
                    disabled={['name', 'email'].includes(field.id)}
                  />
                </div>
                {!['name', 'email', 'date', 'time'].includes(field.id) && (
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

    // Step 4: Design
    const designStep = services.length > 0 ? 4 : 3;
    if (step === designStep) {
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
    <div className="w-full space-y-4 p-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-indigo-500" />
        <h3 className="font-semibold text-sm">
          {isRTL ? '📅 معالج نموذج الحجز' : '📅 Booking Form Wizard'}
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === (services.length > 0 ? 1 : 1) ? onCancel() : setStep(s => s - 1)}
            className="text-xs"
          >
            {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
            {step === (services.length > 0 ? 1 : 1) ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </Button>
          
          {step === (services.length > 0 ? 1 : 1) && (
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
