
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';

export interface ImageTypeOption {
  id: string;
  name: string;
  icon: string;
  hint: string;
  context: string;
  examplePrompt?: string;
}

interface ImageTypeSelectorProps {
  selectedType: string | null;
  onTypeSelect: (type: ImageTypeOption) => void;
  compact?: boolean;
}

export function ImageTypeSelector({ selectedType, onTypeSelect, compact = false }: ImageTypeSelectorProps) {
  const { language } = useTheme();

  // FIXED: Complete image types with proper contexts for each type
  const imageTypes: ImageTypeOption[] = [
    {
      id: 'passport',
      name: language === 'ar' ? 'جواز السفر' : 'Passport',
      icon: '📄',
      hint: language === 'ar' ? 'لاستخراج بيانات جواز السفر' : 'For passport data extraction',
      context: language === 'ar' 
        ? 'هذه صورة جواز سفر. استخرج جميع النصوص المرئية تماماً كما هي مكتوبة، بما في ذلك الأرقام والتواريخ والأسماء.'
        : 'This is a passport image. Extract ALL visible text exactly as written, including numbers, dates, names, and addresses.',
      examplePrompt: language === 'ar' ? 'استخرج جميع النصوص من جواز السفر' : 'Extract all text from passport'
    },
    {
      id: 'id_card',
      name: language === 'ar' ? 'بطاقة الهوية' : 'ID Card',
      icon: '🆔',
      hint: language === 'ar' ? 'لاستخراج بيانات بطاقة الهوية' : 'For ID card data extraction',
      context: language === 'ar'
        ? 'هذه صورة بطاقة هوية. استخرج جميع النصوص المرئية تماماً كما هي مكتوبة، بما في ذلك الأسماء والأرقام والتواريخ.'
        : 'This is an ID card image. Extract ALL visible text exactly as written, including names, ID numbers, dates, and addresses.',
      examplePrompt: language === 'ar' ? 'استخرج جميع النصوص من بطاقة الهوية' : 'Extract all text from ID card'
    },
    {
      id: 'certificate',
      name: language === 'ar' ? 'شهادة' : 'Certificate',
      icon: '🏆',
      hint: language === 'ar' ? 'لاستخراج نصوص الشهادات' : 'For extracting certificate text',
      context: language === 'ar'
        ? 'هذه صورة شهادة. استخرج جميع النصوص المرئية من الشهادة.'
        : 'This is a certificate image. Extract ALL visible text from the certificate.',
      examplePrompt: language === 'ar' ? 'استخرج النصوص من الشهادة' : 'Extract text from certificate'
    },
    {
      id: 'receipt',
      name: language === 'ar' ? 'فاتورة' : 'Receipt',
      icon: '🧾',
      hint: language === 'ar' ? 'لاستخراج بيانات الفواتير' : 'For receipt data extraction',
      context: language === 'ar'
        ? 'هذه صورة فاتورة. استخرج جميع النصوص المرئية من الفاتورة.'
        : 'This is a receipt image. Extract ALL visible text from the receipt.',
      examplePrompt: language === 'ar' ? 'استخرج النصوص من الفاتورة' : 'Extract text from receipt'
    },
    {
      id: 'people',
      name: language === 'ar' ? 'أشخاص' : 'People',
      icon: '👥',
      hint: language === 'ar' ? 'لوصف الأشخاص في الصور' : 'For describing people in photos',
      context: language === 'ar'
        ? 'هذه صورة تحتوي على أشخاص. صف الأشخاص في الصورة، ملابسهم، وما يفعلونه.'
        : 'This is a photo containing people. Describe the people in the image, their clothing, and what they are doing.',
      examplePrompt: language === 'ar' ? 'صف الأشخاص في الصورة' : 'Describe the people in the image'
    },
    {
      id: 'person',
      name: language === 'ar' ? 'صورة شخصية' : 'Person Photo',
      icon: '👤',
      hint: language === 'ar' ? 'لوصف شخص في الصورة' : 'For describing a person in photo',
      context: language === 'ar'
        ? 'هذه صورة شخص واحد. صف الشخص، مظهره، ملابسه، وما يفعله.'
        : 'This is a photo of one person. Describe the person, their appearance, clothing, and what they are doing.',
      examplePrompt: language === 'ar' ? 'صف الشخص في الصورة' : 'Describe the person in the image'
    },
    {
      id: 'food',
      name: language === 'ar' ? 'طعام' : 'Food',
      icon: '🍕',
      hint: language === 'ar' ? 'لوصف الطعام في الصور' : 'For describing food in images',
      context: language === 'ar'
        ? 'هذه صورة طعام. صف نوع الطعام، مكوناته، طريقة تقديمه، وشكله.'
        : 'This is a food image. Describe the type of food, ingredients, presentation, and appearance.',
      examplePrompt: language === 'ar' ? 'صف الطعام في الصورة' : 'Describe the food in the image'
    },
    {
      id: 'object',
      name: language === 'ar' ? 'كائن' : 'Object',
      icon: '📦',
      hint: language === 'ar' ? 'لوصف الأشياء والكائنات' : 'For describing objects and items',
      context: language === 'ar'
        ? 'هذه صورة تحتوي على كائن أو أشياء. صف الكائن، شكله، لونه، ووظيفته.'
        : 'This is an image containing an object or items. Describe the object, its shape, color, and function.',
      examplePrompt: language === 'ar' ? 'صف الكائن في الصورة' : 'Describe the object in the image'
    },
    {
      id: 'report',
      name: language === 'ar' ? 'تقرير' : 'Report',
      icon: '📊',
      hint: language === 'ar' ? 'لاستخراج نصوص التقارير' : 'For extracting report text',
      context: language === 'ar'
        ? 'هذه صورة تقرير. استخرج جميع النصوص المرئية من التقرير.'
        : 'This is a report image. Extract ALL visible text from the report.',
      examplePrompt: language === 'ar' ? 'استخرج النصوص من التقرير' : 'Extract text from report'
    },
    {
      id: 'scenery',
      name: language === 'ar' ? 'منظر طبيعي' : 'Scenery',
      icon: '🌄',
      hint: language === 'ar' ? 'لوصف المناظر الطبيعية' : 'For describing natural scenery',
      context: language === 'ar'
        ? 'هذه صورة منظر طبيعي. صف المنظر، العناصر الطبيعية، الألوان، والجو العام.'
        : 'This is a scenery image. Describe the landscape, natural elements, colors, and overall atmosphere.',
      examplePrompt: language === 'ar' ? 'صف المنظر الطبيعي' : 'Describe the scenery'
    },
    {
      id: 'document',
      name: language === 'ar' ? 'مستند' : 'Document',
      icon: '📋',
      hint: language === 'ar' ? 'لقراءة المستندات والنصوص' : 'For reading documents and text',
      context: language === 'ar'
        ? 'هذا مستند يحتوي على نص. استخرج جميع النصوص المرئية من المستند.'
        : 'This is a document with text. Extract ALL visible text from the document.',
      examplePrompt: language === 'ar' ? 'استخرج النصوص من المستند' : 'Extract text from document'
    },
    {
      id: 'general',
      name: language === 'ar' ? 'تحليل عام' : 'General Analysis',
      icon: '🔍',
      hint: language === 'ar' ? 'لتحليل أي نوع من الصور' : 'For analyzing any type of image',
      context: language === 'ar'
        ? 'حلل هذه الصورة وصف ما تراه بالتفصيل.'
        : 'Analyze this image and describe what you see in detail.',
      examplePrompt: language === 'ar' ? 'حلل هذه الصورة' : 'Analyze this image'
    }
  ];

  const selectedTypeData = imageTypes.find(type => type.id === selectedType);

  return (
    <div className={compact ? "w-full" : "w-full max-w-xs"}>
      <Select value={selectedType || ''} onValueChange={(value) => {
        const typeData = imageTypes.find(type => type.id === value);
        if (typeData) {
          onTypeSelect(typeData);
        }
      }}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={
            language === 'ar' ? 'اختر نوع الصورة' : 'Select image type'
          } />
        </SelectTrigger>
        <SelectContent>
          {imageTypes.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              <div className="flex items-center gap-2">
                <span>{type.icon}</span>
                <span>{type.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedTypeData && !compact && (
        <p className="text-xs text-muted-foreground mt-2">
          {selectedTypeData.hint}
        </p>
      )}
    </div>
  );
}
