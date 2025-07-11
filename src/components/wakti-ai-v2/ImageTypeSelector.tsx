
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';

export interface ImageTypeOption {
  id: string;
  name: {
    en: string;
    ar: string;
  };
  icon: string;
  description: {
    en: string;
    ar: string;
  };
  context: string;
  examplePrompt?: string; // Added back for interface compatibility
}

interface ImageTypeSelectorProps {
  selectedType: string | null;
  onTypeSelect: (type: ImageTypeOption) => void;
  compact?: boolean;
}

export function ImageTypeSelector({ selectedType, onTypeSelect, compact = false }: ImageTypeSelectorProps) {
  const { language } = useTheme();
  const currentLanguage = language || 'en';

  // WAKTI KILLER SYSTEM: 8 Mobile-Optimized Bilingual Categories
  const imageTypes: ImageTypeOption[] = [
    {
      id: 'ids',
      name: {
        en: 'IDs',
        ar: 'هويات'
      },
      icon: '🆔',
      description: {
        en: 'Passports, licenses, certificates',
        ar: 'جوازات، رخص، شهادات'
      },
      context: currentLanguage === 'ar' 
        ? 'هذه صورة وثيقة هوية. استخرج البيانات الشخصية، تواريخ الصلاحية، والمعلومات المهمة. تحقق من صلاحية الوثيقة وقدم معلومات مفيدة.'
        : 'This is an ID document image. Extract personal details, expiration dates, and important information. Check document validity and provide useful insights.',
      examplePrompt: currentLanguage === 'ar' ? 'استخرج بيانات هذه الوثيقة' : 'Extract information from this document'
    },
    {
      id: 'bills',
      name: {
        en: 'Bills',
        ar: 'فواتير'
      },
      icon: '💰',
      description: {
        en: 'Receipts, invoices, splitting',
        ar: 'إيصالات، فواتير، تقسيم'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة فاتورة أو إيصال. استخرج المبلغ الإجمالي، العناصر، التاريخ، واسم المتجر. بعد التحليل، اعرض المساعدة في تقسيم التكلفة، حساب البقشيش، أو تتبع المصروفات.'
        : 'This is a bill or receipt image. Extract total amount, items, date, and store name. After analysis, offer help with splitting costs, calculating tips, or tracking expenses.',
      examplePrompt: currentLanguage === 'ar' ? 'كم أنفقت في هذه الفاتورة؟' : 'How much did I spend on this bill?'
    },
    {
      id: 'food',
      name: {
        en: 'Food',
        ar: 'طعام'
      },
      icon: '🍔',
      description: {
        en: 'Calories, nutrition, ingredients',
        ar: 'سعرات، تغذية، مكونات'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة طعام. حدد نوع الطعام، احسب السعرات الحرارية التقريبية، وقدم معلومات غذائية. بعد التحليل، اسأل عن عدد الحصص المتناولة واعرض تتبع السعرات الحرارية.'
        : 'This is a food image. Identify the food type, calculate approximate calories, and provide nutritional information. After analysis, ask about serving size and offer calorie tracking.',
      examplePrompt: currentLanguage === 'ar' ? 'كم سعرة حرارية في هذا الطعام؟' : 'How many calories are in this food?'
    },
    {
      id: 'meds',
      name: {
        en: 'Meds',
        ar: 'أدوية'
      },
      icon: '💊',
      description: {
        en: 'Pills, dosage, interactions',
        ar: 'حبوب، جرعات، تفاعلات'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة دواء. حدد نوع الدواء، الجرعة، وتعليمات الاستخدام. بعد التحليل، اسأل عن العمر (بالغ أو طفل) واعرض فحص التفاعلات الدوائية أو تذكيرات الجرعات.'
        : 'This is a medication image. Identify the medication type, dosage, and usage instructions. After analysis, ask about age (adult or child) and offer drug interaction checks or dosage reminders.',
      examplePrompt: currentLanguage === 'ar' ? 'ما هو هذا الدواء وكيف أستخدمه؟' : 'What is this medication and how do I use it?'
    },
    {
      id: 'docs',
      name: {
        en: 'Docs',
        ar: 'وثائق'
      },
      icon: '📊',
      description: {
        en: 'Reports, homework, charts',
        ar: 'تقارير، واجبات، رسوم'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة وثيقة أو واجب منزلي. اقرأ المحتوى، حدد المسائل أو الأسئلة الموجودة. بعد التحليل، اعرض المساعدة في حل المسائل، شرح المفاهيم، أو تلخيص المحتوى.'
        : 'This is a document or homework image. Read the content, identify problems or questions present. After analysis, offer help solving problems, explaining concepts, or summarizing content.',
      examplePrompt: currentLanguage === 'ar' ? 'اشرح هذه الوثيقة' : 'Explain this document'
    },
    {
      id: 'screens',
      name: {
        en: 'Screens',
        ar: 'شاشات'
      },
      icon: '📱',
      description: {
        en: 'Apps, errors, websites',
        ar: 'تطبيقات، أخطاء، مواقع'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة شاشة أو لقطة شاشة. حدد التطبيق، الخطأ، أو المشكلة المعروضة. بعد التحليل، اعرض خطوات استكشاف الأخطاء وإصلاحها أو حلول تقنية.'
        : 'This is a screenshot or screen capture. Identify the app, error, or issue displayed. After analysis, offer troubleshooting steps or technical solutions.',
      examplePrompt: currentLanguage === 'ar' ? 'ما المشكلة هنا؟' : 'What\'s the problem here?'
    },
    {
      id: 'photos',
      name: {
        en: 'Photos',
        ar: 'صور'
      },
      icon: '👤',
      description: {
        en: 'People, selfies, portraits',
        ar: 'أشخاص، سيلفي، صور شخصية'
      },
      context: currentLanguage === 'ar'
        ? 'هذه صورة شخصية أو صورة لأشخاص. صف المظهر، الملابس، والأنشطة المرئية. بعد التحليل، اعرض وصف تفصيلي للأشخاص أو تحليل تكوين الصورة.'
        : 'This is a personal photo or image of people. Describe appearance, clothing, and visible activities. After analysis, offer detailed person descriptions or photo composition analysis.',
      examplePrompt: currentLanguage === 'ar' ? 'صف الأشخاص في هذه الصورة' : 'Describe the people in this photo'
    },
    {
      id: 'general',
      name: {
        en: 'General',
        ar: 'عام'
      },
      icon: '🔍',
      description: {
        en: 'Everything else, QR codes',
        ar: 'كل شيء آخر، رموز QR'
      },
      context: currentLanguage === 'ar'
        ? 'حلل هذه الصورة وصف ما تراه بالتفصيل. إذا كان هناك رمز QR، فاقرأه. بعد التحليل، اعرض مساعدة ذات صلة بناءً على ما تراه.'
        : 'Analyze this image and describe what you see in detail. If there are QR codes, read them. After analysis, offer relevant assistance based on what you see.',
      examplePrompt: currentLanguage === 'ar' ? 'صف ما تراه في هذه الصورة' : 'Describe what you see in this image'
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
            currentLanguage === 'ar' ? 'اختر نوع الصورة' : 'Select image type'
          } />
        </SelectTrigger>
        <SelectContent>
          {imageTypes.map((type) => (
            <SelectItem key={type.id} value={type.id} className="py-3">
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{type.icon}</span>
                  <span className="font-medium">{type.name[currentLanguage]}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-6">
                  {type.description[currentLanguage]}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedTypeData && !compact && (
        <p className="text-xs text-muted-foreground mt-2">
          {selectedTypeData.description[currentLanguage]}
        </p>
      )}
    </div>
  );
}
