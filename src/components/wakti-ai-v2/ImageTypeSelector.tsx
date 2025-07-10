
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

  // FIXED: Simplified image types with working contexts
  const imageTypes: ImageTypeOption[] = [
    {
      id: 'passport',
      name: language === 'ar' ? 'جواز السفر' : 'Passport',
      icon: '📄',
      hint: language === 'ar' ? 'لاستخراج بيانات جواز السفر' : 'For passport data extraction',
      context: language === 'ar' 
        ? 'هذه صورة جواز سفر. استخرج البيانات الشخصية، تواريخ الصلاحية، ورقم الجواز. تحقق من صلاحية الجواز.'
        : 'This is a passport image. Extract personal details, expiration dates, and passport number. Check passport validity.',
      examplePrompt: language === 'ar' ? 'استخرج بيانات جواز السفر' : 'Extract passport information'
    },
    {
      id: 'id_card',
      name: language === 'ar' ? 'بطاقة الهوية' : 'ID Card',
      icon: '🆔',
      hint: language === 'ar' ? 'لاستخراج بيانات بطاقة الهوية' : 'For ID card data extraction',
      context: language === 'ar'
        ? 'هذه صورة بطاقة هوية. استخرج الاسم، الرقم، تاريخ الانتهاء، والمعلومات الشخصية.'
        : 'This is an ID card image. Extract name, ID number, expiration date, and personal information.',
      examplePrompt: language === 'ar' ? 'استخرج بيانات بطاقة الهوية' : 'Extract ID card details'
    },
    {
      id: 'certificate',
      name: language === 'ar' ? 'شهادة' : 'Certificate',
      icon: '🏆',
      hint: language === 'ar' ? 'لتحليل الشهادات والدبلومات' : 'For analyzing certificates and diplomas',
      context: language === 'ar'
        ? 'هذه صورة شهادة. استخرج اسم الحاصل عليها، نوع الشهادة، الجهة المانحة، والتاريخ.'
        : 'This is a certificate image. Extract recipient name, certificate type, issuing authority, and date.',
      examplePrompt: language === 'ar' ? 'حلل هذه الشهادة' : 'Analyze this certificate'
    },
    {
      id: 'receipt',
      name: language === 'ar' ? 'فاتورة' : 'Receipt',
      icon: '🧾',
      hint: language === 'ar' ? 'لاستخراج بيانات الفواتير' : 'For receipt data extraction',
      context: language === 'ar'
        ? 'هذه صورة فاتورة. استخرج المبلغ الإجمالي، العناصر، التاريخ، واسم المتجر.'
        : 'This is a receipt image. Extract total amount, items, date, and store name.',
      examplePrompt: language === 'ar' ? 'استخرج بيانات الفاتورة' : 'Extract receipt details'
    },
    {
      id: 'person',
      name: language === 'ar' ? 'صورة شخصية' : 'Person Photo',
      icon: '👤',
      hint: language === 'ar' ? 'لوصف الأشخاص في الصور' : 'For describing people in photos',
      context: language === 'ar'
        ? 'هذه صورة شخص. صف المظهر، الملابس، والأنشطة المرئية في الصورة.'
        : 'This is a person photo. Describe appearance, clothing, and visible activities.',
      examplePrompt: language === 'ar' ? 'صف الشخص في الصورة' : 'Describe the person in the image'
    },
    {
      id: 'document',
      name: language === 'ar' ? 'مستند' : 'Document',
      icon: '📋',
      hint: language === 'ar' ? 'لقراءة المستندات والنصوص' : 'For reading documents and text',
      context: language === 'ar'
        ? 'هذا مستند يحتوي على نص. اقرأ واستخرج المحتوى النصي الموجود.'
        : 'This is a document with text. Read and extract the textual content.',
      examplePrompt: language === 'ar' ? 'اقرأ المستند' : 'Read the document'
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
