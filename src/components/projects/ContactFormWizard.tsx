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
  ArrowUp,
  ArrowDown,
  Columns,
  Square,
  Palette,
  Type,
  Check,
  MessageSquare,
  Phone,
  User,
  FileText,
  Hash,
  Calendar,
  Link
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContactFormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'date' | 'url';
  required: boolean;
  label: string;
  labelAr: string;
  width?: 'full' | 'half';
  placeholder?: string;
}

export interface ContactFormConfig {
  formStyle: 'single' | 'multi-step' | 'floating';
  fields: ContactFormField[];
  design: {
    borderRadius: 'rounded' | 'sharp' | 'pill';
    submitButtonText: string;
    submitButtonTextAr: string;
    colorScheme: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
    showLabels: boolean;
  };
}

interface ContactFormWizardProps {
  onComplete: (config: ContactFormConfig, structuredPrompt: string) => void;
  onCancel: () => void;
  onSkipWizard: () => void; // Let AI handle it directly
  originalPrompt: string;
}

const DEFAULT_FIELDS: ContactFormField[] = [
  { id: 'name', name: 'name', type: 'text', required: true, label: 'Name', labelAr: 'الاسم', width: 'half', placeholder: 'John Doe' },
  { id: 'email', name: 'email', type: 'email', required: true, label: 'Email', labelAr: 'البريد الإلكتروني', width: 'half', placeholder: 'john@example.com' },
  { id: 'phone', name: 'phone', type: 'tel', required: false, label: 'Phone', labelAr: 'الهاتف', width: 'half', placeholder: '+1 234 567 890' },
  { id: 'subject', name: 'subject', type: 'text', required: false, label: 'Subject', labelAr: 'الموضوع', width: 'half', placeholder: 'How can we help?' },
  { id: 'message', name: 'message', type: 'textarea', required: true, label: 'Message', labelAr: 'الرسالة', width: 'full', placeholder: 'Your message here...' },
];

const FIELD_TYPE_OPTIONS = [
  { value: 'text', icon: <Type className="h-3 w-3" />, label: 'Text' },
  { value: 'email', icon: <Mail className="h-3 w-3" />, label: 'Email' },
  { value: 'tel', icon: <Phone className="h-3 w-3" />, label: 'Phone' },
  { value: 'textarea', icon: <MessageSquare className="h-3 w-3" />, label: 'Long Text' },
  { value: 'number', icon: <Hash className="h-3 w-3" />, label: 'Number' },
  { value: 'date', icon: <Calendar className="h-3 w-3" />, label: 'Date' },
  { value: 'url', icon: <Link className="h-3 w-3" />, label: 'URL' },
];

const COLOR_SCHEMES = [
  { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo' },
  { id: 'emerald', color: 'bg-emerald-500', label: 'Green' },
  { id: 'rose', color: 'bg-rose-500', label: 'Rose' },
  { id: 'amber', color: 'bg-amber-500', label: 'Amber' },
  { id: 'slate', color: 'bg-slate-600', label: 'Slate' },
];

export function ContactFormWizard({ onComplete, onCancel, onSkipWizard, originalPrompt }: ContactFormWizardProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: Form Style
  const [formStyle, setFormStyle] = useState<'single' | 'multi-step' | 'floating'>('single');
  
  // Step 2: Fields
  const [fields, setFields] = useState<ContactFormField[]>(DEFAULT_FIELDS);
  const [newFieldName, setNewFieldName] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  
  // Step 3: Design
  const [borderRadius, setBorderRadius] = useState<'rounded' | 'sharp' | 'pill'>('rounded');
  const [submitText, setSubmitText] = useState('Send Message');
  const [submitTextAr, setSubmitTextAr] = useState('إرسال الرسالة');
  const [colorScheme, setColorScheme] = useState<'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');
  const [showLabels, setShowLabels] = useState(true);

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

  const handleFieldTypeChange = (fieldId: string, newType: ContactFormField['type']) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, type: newType } : f
    ));
    setEditingFieldId(null);
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
      width: 'full',
      placeholder: ''
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
        colorScheme,
        showLabels,
      }
    };

    let prompt = `Build a beautiful contact form with these specifications:

FORM STYLE: ${formStyle === 'single' ? 'Single page form' : formStyle === 'multi-step' ? 'Multi-step wizard' : 'Floating/modal form'}

FIELDS (in order with layout):
${fields.map((f, i) => `${i + 1}. ${f.label} (${f.type}) - ${f.required ? 'REQUIRED' : 'optional'} - ${f.width === 'half' ? 'HALF WIDTH (2 per row)' : 'FULL WIDTH'}${f.placeholder ? ` - placeholder: "${f.placeholder}"` : ''}`).join('\n')}

LAYOUT INSTRUCTIONS:
- Fields marked as "HALF WIDTH" MUST appear side-by-side (2 fields per row using CSS grid: grid-cols-2)
- Fields marked as "FULL WIDTH" span the entire row (col-span-2 or grid-cols-1)
- Use a responsive grid layout that stacks on mobile

DESIGN:
- Border style: ${borderRadius}
- Color scheme: ${colorScheme} (use ${colorScheme}-500 for primary buttons and accents)
- Submit button text: "${submitText}"
- ${showLabels ? 'Show field labels above inputs' : 'Use placeholder-only design (no labels)'}
- Add subtle hover effects and focus states
- Use smooth transitions and modern styling

IMPORTANT: This form MUST submit to the project backend at:
supabase.functions.invoke('project-backend-api', {
  body: { action: 'submitForm', projectId: '{{PROJECT_ID}}', formType: 'contact', ... }
})

Include:
- Form validation with error messages
- Loading state on submit button
- Success message/toast after submission
- Error handling with user-friendly messages

Original request: ${originalPrompt}`;

    onComplete(config, prompt);
  };

  const formStyles = [
    { id: 'single', icon: <LayoutGrid className="h-6 w-6" />, label: 'Single Page', labelAr: 'صفحة واحدة', desc: 'All fields visible', descAr: 'جميع الحقول مرئية' },
    { id: 'multi-step', icon: <ListOrdered className="h-6 w-6" />, label: 'Multi-Step', labelAr: 'متعدد الخطوات', desc: 'Step by step flow', descAr: 'تدفق خطوة بخطوة' },
    { id: 'floating', icon: <Mail className="h-6 w-6" />, label: 'Floating', labelAr: 'عائم', desc: 'Modal/popup form', descAr: 'نموذج منبثق' },
  ];

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-3.5 w-3.5" />;
      case 'tel': return <Phone className="h-3.5 w-3.5" />;
      case 'textarea': return <MessageSquare className="h-3.5 w-3.5" />;
      case 'number': return <Hash className="h-3.5 w-3.5" />;
      case 'date': return <Calendar className="h-3.5 w-3.5" />;
      case 'url': return <Link className="h-3.5 w-3.5" />;
      default: return <Type className="h-3.5 w-3.5" />;
    }
  };

  const renderStep = () => {
    // Step 1: Form Style
    if (step === 1) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="text-center mb-4">
            <h4 className="text-sm font-semibold text-foreground">
              {isRTL ? 'اختر نمط النموذج' : 'Choose Form Layout'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'كيف سيظهر النموذج للمستخدمين' : 'How the form will appear to users'}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {formStyles.map(style => (
              <motion.button
                key={style.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFormStyle(style.id as typeof formStyle)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  formStyle === style.id
                    ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                    : "border-border/50 hover:border-indigo-500/50 hover:bg-muted/50"
                )}
              >
                {formStyle === style.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                )}
                <div className={cn(
                  "p-2 rounded-lg",
                  formStyle === style.id ? "bg-indigo-500/20 text-indigo-500" : "bg-muted text-muted-foreground"
                )}>
                  {style.icon}
                </div>
                <span className="text-xs font-medium">
                  {isRTL ? style.labelAr : style.label}
                </span>
                <span className="text-[10px] text-muted-foreground text-center">
                  {isRTL ? style.descAr : style.desc}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      );
    }

    // Step 2: Field Configuration
    if (step === 2) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="text-center mb-2">
            <h4 className="text-sm font-semibold text-foreground">
              {isRTL ? 'تكوين الحقول' : 'Configure Fields'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'أضف، أعد الترتيب، وخصص حقول النموذج' : 'Add, reorder, and customize form fields'}
            </p>
          </div>
          
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group flex items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-background/80 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                >
                  {/* Field Icon */}
                  <div className="p-1.5 rounded-lg bg-muted/80 text-muted-foreground">
                    {getFieldIcon(field.type)}
                  </div>
                  
                  {/* Field Label */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {isRTL ? field.labelAr : field.label}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Type Selector */}
                      <button
                        onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                        className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/80 hover:bg-indigo-500/20 hover:text-indigo-500 transition-colors"
                      >
                        {field.type}
                      </button>
                      {field.width === 'half' && (
                        <span className="text-[10px] text-indigo-500 px-1.5 py-0.5 rounded bg-indigo-500/10">
                          ½
                        </span>
                      )}
                    </div>
                    
                    {/* Type Dropdown */}
                    <AnimatePresence>
                      {editingFieldId === field.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-wrap gap-1 mt-2"
                        >
                          {FIELD_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => handleFieldTypeChange(field.id, opt.value as ContactFormField['type'])}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all",
                                field.type === opt.value
                                  ? "bg-indigo-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-indigo-500/20"
                              )}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Required Toggle */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {isRTL ? 'مطلوب' : 'Req'}
                    </span>
                    <Switch
                      checked={field.required}
                      onCheckedChange={() => handleFieldToggle(field.id, 'required')}
                      disabled={['name', 'email', 'message'].includes(field.id)}
                      className="scale-75"
                    />
                  </div>
                  
                  {/* Width Toggle */}
                  <button
                    onClick={() => handleFieldWidthToggle(field.id)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      field.width === 'half' 
                        ? "bg-indigo-500/20 text-indigo-500" 
                        : "bg-muted/80 text-muted-foreground hover:text-foreground"
                    )}
                    title={field.width === 'half' ? (isRTL ? 'نصف العرض' : 'Half width') : (isRTL ? 'العرض الكامل' : 'Full width')}
                  >
                    {field.width === 'half' ? <Columns className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  </button>
                  
                  {/* Move Buttons */}
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMoveField(field.id, 'up')}
                      disabled={index === 0}
                      className={cn(
                        "p-0.5 rounded transition-colors",
                        index === 0 ? "text-muted-foreground/20" : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                      )}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMoveField(field.id, 'down')}
                      disabled={index === fields.length - 1}
                      className={cn(
                        "p-0.5 rounded transition-colors",
                        index === fields.length - 1 ? "text-muted-foreground/20" : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                      )}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  
                  {/* Delete */}
                  {!['name', 'email', 'message'].includes(field.id) && (
                    <button
                      onClick={() => handleRemoveField(field.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Add Field */}
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Input
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder={isRTL ? 'اسم الحقل الجديد...' : 'New field name...'}
              className="flex-1 h-9 text-sm bg-muted/50"
              onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            />
            <Button 
              size="sm" 
              onClick={handleAddField} 
              disabled={!newFieldName.trim()}
              className="h-9 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Layout Legend */}
          <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground pt-2">
            <div className="flex items-center gap-1.5">
              <Columns className="h-3.5 w-3.5 text-indigo-500" />
              <span>{isRTL ? 'نصف = حقلين بجانب بعض' : 'Half = 2 side by side'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Square className="h-3.5 w-3.5" />
              <span>{isRTL ? 'كامل = صف كامل' : 'Full = entire row'}</span>
            </div>
          </div>
        </motion.div>
      );
    }

    // Step 3: Design
    if (step === 3) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="text-center mb-2">
            <h4 className="text-sm font-semibold text-foreground">
              {isRTL ? 'تخصيص التصميم' : 'Customize Design'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'اجعل النموذج يبدو مثاليًا' : 'Make your form look perfect'}
            </p>
          </div>
          
          <div className="space-y-4">
            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                {isRTL ? 'نظام الألوان' : 'Color Scheme'}
              </Label>
              <div className="flex gap-2">
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    onClick={() => setColorScheme(scheme.id as typeof colorScheme)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all",
                      colorScheme === scheme.id
                        ? "border-foreground/30 bg-muted/50"
                        : "border-transparent hover:border-border"
                    )}
                  >
                    <div className={cn("h-6 w-6 rounded-full", scheme.color)} />
                    <span className="text-[10px]">{scheme.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Border Style */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نمط الحواف' : 'Border Style'}</Label>
              <div className="flex gap-2">
                {(['rounded', 'sharp', 'pill'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setBorderRadius(r)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-medium border-2 transition-all",
                      r === 'sharp' ? 'rounded-none' : r === 'pill' ? 'rounded-full' : 'rounded-xl',
                      borderRadius === r
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-border/50 hover:border-indigo-500/50"
                    )}
                  >
                    {r === 'rounded' ? (isRTL ? 'مدور' : 'Rounded') : 
                     r === 'sharp' ? (isRTL ? 'حاد' : 'Sharp') : 
                     (isRTL ? 'دائري' : 'Pill')}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Show Labels Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">{isRTL ? 'عرض التسميات' : 'Show Labels'}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isRTL ? 'عرض تسميات الحقول فوق المدخلات' : 'Display field labels above inputs'}
                </p>
              </div>
              <Switch checked={showLabels} onCheckedChange={setShowLabels} />
            </div>
            
            {/* Submit Button Text */}
            <div className="space-y-2">
              <Label className="text-xs">{isRTL ? 'نص زر الإرسال' : 'Submit Button Text'}</Label>
              <Input
                value={isRTL ? submitTextAr : submitText}
                onChange={(e) => isRTL ? setSubmitTextAr(e.target.value) : setSubmitText(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-4 p-5 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-2xl shadow-xl shadow-indigo-500/5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm">
            {isRTL ? 'معالج نموذج الاتصال' : 'Contact Form Wizard'}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {isRTL ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
          </p>
        </div>
      </div>
      
      {/* Progress Indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-1.5 rounded-full transition-all duration-300",
              i + 1 <= step 
                ? "bg-gradient-to-r from-indigo-500 to-purple-500" 
                : "bg-muted/50"
            )}
          />
        ))}
      </div>
      
      {/* Step Content */}
      <AnimatePresence mode="wait">
        {renderStep()}
      </AnimatePresence>
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
            className="text-xs h-9"
          >
            {isRTL ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </Button>
          
          {step === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSkipWizard}
              className="text-xs h-9 border-dashed"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              {isRTL ? 'دع الذكاء يتولى' : 'Let AI Handle It'}
            </Button>
          )}
        </div>
        
        {step < totalSteps ? (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            className="text-xs h-9 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {isRTL ? 'التالي' : 'Next'}
            {isRTL ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            className="text-xs h-9 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/20"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {isRTL ? 'إنشاء النموذج' : 'Generate Form'}
          </Button>
        )}
      </div>
    </div>
  );
}
