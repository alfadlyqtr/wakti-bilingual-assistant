import React, { useMemo, useState } from 'react';
import { GraduationCap, Briefcase, Crown, Rocket, Baby, Palmtree, Sparkles, Save, X, Clapperboard } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToastHelper } from '@/hooks/use-toast-helper';
import {
  HelpfulMemoryLayer,
  HelpfulMemoryService,
} from '@/services/HelpfulMemoryService';

interface HelpfulMemoryProfileFormProps {
  onSaved: (count: number) => void;
  onClose: () => void;
}

type Role = 'student' | 'employee' | 'manager' | 'self_employed' | 'parent' | 'retired' | 'creator' | 'other';

interface FieldSpec {
  key: string;
  label: { en: string; ar: string };
  placeholder: { en: string; ar: string };
  layer: HelpfulMemoryLayer;
  format: (value: string) => string;
  multiline?: boolean;
}

const ROLE_OPTIONS: { value: Role; icon: React.ComponentType<{ className?: string }>; en: string; ar: string }[] = [
  { value: 'student',       icon: GraduationCap, en: 'Student',        ar: 'طالب' },
  { value: 'employee',      icon: Briefcase,     en: 'Employee',       ar: 'موظف' },
  { value: 'manager',       icon: Crown,         en: 'Manager / Lead', ar: 'مدير' },
  { value: 'self_employed', icon: Rocket,        en: 'Self-employed',  ar: 'عمل حر' },
  { value: 'parent',        icon: Baby,          en: 'Parent',         ar: 'والد/والدة' },
  { value: 'retired',       icon: Palmtree,      en: 'Retired',        ar: 'متقاعد' },
  { value: 'creator',       icon: Clapperboard,  en: 'Content creator', ar: 'صانع محتوى' },
  { value: 'other',         icon: Sparkles,      en: 'Other',          ar: 'غير ذلك' },
];

// Fields shown to everyone
const COMMON_FIELDS: FieldSpec[] = [
  {
    key: 'city',
    label: { en: 'City / Where you live', ar: 'المدينة / مكان السكن' },
    placeholder: { en: 'e.g. Al Khor, Qatar', ar: 'مثال: الخور، قطر' },
    layer: 'always_use',
    format: (v) => `Lives in ${v}.`,
  },
  {
    key: 'favorite_team',
    label: { en: 'Favorite sports team', ar: 'الفريق الرياضي المفضل' },
    placeholder: { en: 'e.g. Montreal Canadiens', ar: 'مثال: الدحيل' },
    layer: 'always_use',
    format: (v) => `Favorite team: ${v}.`,
  },
  {
    key: 'favorite_sport',
    label: { en: 'Favorite sport', ar: 'الرياضة المفضلة' },
    placeholder: { en: 'e.g. hockey, football', ar: 'مثال: كرة القدم' },
    layer: 'always_use',
    format: (v) => `Favorite sport: ${v}.`,
  },
  {
    key: 'hobbies',
    label: { en: 'Hobbies', ar: 'الهوايات' },
    placeholder: { en: 'e.g. falconry, chess, reading', ar: 'مثال: الصيد بالصقور، الشطرنج' },
    layer: 'always_use',
    format: (v) => `Hobbies: ${v}.`,
  },
  {
    key: 'allergies',
    label: { en: 'Allergies', ar: 'الحساسية' },
    placeholder: { en: 'e.g. peanuts, pollen', ar: 'مثال: فول سوداني' },
    layer: 'always_use',
    format: (v) => `Allergic to ${v}.`,
  },
  {
    key: 'diet',
    label: { en: 'Dietary needs', ar: 'القيود الغذائية' },
    placeholder: { en: 'e.g. halal only, vegetarian, gluten-free', ar: 'مثال: حلال فقط' },
    layer: 'always_use',
    format: (v) => `Dietary need: ${v}.`,
  },
  {
    key: 'reply_style',
    label: { en: 'Reply style preference', ar: 'أسلوب الرد المفضل' },
    placeholder: { en: 'e.g. concise, step-by-step, in Arabic', ar: 'مثال: مختصر، خطوة بخطوة' },
    layer: 'always_use',
    format: (v) => `Preferred reply style: ${v}.`,
  },
];

// Fields shown per role
const ROLE_FIELDS: Record<Role, FieldSpec[]> = {
  student: [
    {
      key: 'grade',
      label: { en: 'Grade / Year', ar: 'الصف / السنة' },
      placeholder: { en: 'e.g. Grade 10, 2nd year university', ar: 'مثال: الصف العاشر' },
      layer: 'always_use',
      format: (v) => `Student in ${v}.`,
    },
    {
      key: 'school',
      label: { en: 'School / University', ar: 'المدرسة / الجامعة' },
      placeholder: { en: 'e.g. Qatar University', ar: 'مثال: جامعة قطر' },
      layer: 'always_use',
      format: (v) => `Studies at ${v}.`,
    },
    {
      key: 'favorite_subject',
      label: { en: 'Favorite subject', ar: 'المادة المفضلة' },
      placeholder: { en: 'e.g. biology', ar: 'مثال: الأحياء' },
      layer: 'always_use',
      format: (v) => `Favorite subject: ${v}.`,
    },
    {
      key: 'study_routine',
      label: { en: 'Study routine (optional)', ar: 'روتين الدراسة (اختياري)' },
      placeholder: { en: 'e.g. I study every Sunday evening', ar: 'مثال: كل أحد مساءً' },
      layer: 'routine',
      format: (v) => v,
    },
  ],
  employee: [
    {
      key: 'profession',
      label: { en: 'Job / Role', ar: 'الوظيفة' },
      placeholder: { en: 'e.g. nurse, software engineer', ar: 'مثال: ممرض' },
      layer: 'always_use',
      format: (v) => `Works as ${v}.`,
    },
    {
      key: 'workplace',
      label: { en: 'Workplace (optional)', ar: 'جهة العمل (اختياري)' },
      placeholder: { en: 'e.g. Hamad Medical Corp.', ar: 'مثال: مؤسسة حمد الطبية' },
      layer: 'always_use',
      format: (v) => `Works at ${v}.`,
    },
    {
      key: 'schedule',
      label: { en: 'Work schedule (optional)', ar: 'جدول العمل (اختياري)' },
      placeholder: { en: 'e.g. Sun-Thu 8am-4pm', ar: 'مثال: الأحد-الخميس 8ص-4م' },
      layer: 'routine',
      format: (v) => `Work schedule: ${v}.`,
    },
  ],
  manager: [
    {
      key: 'profession',
      label: { en: 'Role / Title', ar: 'المسمى الوظيفي' },
      placeholder: { en: 'e.g. Engineering Manager', ar: 'مثال: مدير هندسة' },
      layer: 'always_use',
      format: (v) => `Works as ${v}.`,
    },
    {
      key: 'team',
      label: { en: 'Team / Department', ar: 'الفريق / القسم' },
      placeholder: { en: 'e.g. frontend team of 8', ar: 'مثال: فريق من 8 أشخاص' },
      layer: 'always_use',
      format: (v) => `Leads ${v}.`,
    },
    {
      key: 'focus',
      label: { en: 'Current focus / priority', ar: 'الأولوية الحالية' },
      placeholder: { en: 'e.g. launching v2 of our product', ar: 'مثال: إطلاق النسخة الثانية' },
      layer: 'project',
      format: (v) => `Current focus: ${v}.`,
    },
  ],
  self_employed: [
    {
      key: 'business',
      label: { en: 'Business / What you do', ar: 'نشاطك / عملك' },
      placeholder: { en: 'e.g. freelance photographer, restaurant owner', ar: 'مثال: مصور حر' },
      layer: 'always_use',
      format: (v) => `Self-employed as ${v}.`,
    },
    {
      key: 'current_project',
      label: { en: 'Current project', ar: 'المشروع الحالي' },
      placeholder: { en: 'e.g. building a delivery app', ar: 'مثال: تطوير تطبيق توصيل' },
      layer: 'project',
      format: (v) => `Working on ${v}.`,
    },
  ],
  parent: [
    {
      key: 'profession',
      label: { en: 'Your profession (optional)', ar: 'مهنتك (اختياري)' },
      placeholder: { en: 'e.g. teacher', ar: 'مثال: معلم' },
      layer: 'always_use',
      format: (v) => `Works as ${v}.`,
    },
    {
      key: 'family_context',
      label: { en: 'Family context (kept privately)', ar: 'سياق عائلي (خاص)' },
      placeholder: { en: 'e.g. 2 kids in school', ar: 'مثال: طفلان في المدرسة' },
      layer: 'always_use',
      format: (v) => `Family context: ${v}.`,
    },
    {
      key: 'family_routine',
      label: { en: 'Family routine (optional)', ar: 'روتين عائلي (اختياري)' },
      placeholder: { en: 'e.g. every Friday family lunch', ar: 'مثال: كل جمعة غداء عائلي' },
      layer: 'routine',
      format: (v) => v,
    },
  ],
  retired: [
    {
      key: 'former_profession',
      label: { en: 'Former profession (optional)', ar: 'المهنة السابقة (اختياري)' },
      placeholder: { en: 'e.g. retired engineer', ar: 'مثال: مهندس متقاعد' },
      layer: 'always_use',
      format: (v) => `Retired ${v}.`,
    },
    {
      key: 'interests',
      label: { en: 'Current interests', ar: 'الاهتمامات الحالية' },
      placeholder: { en: 'e.g. gardening, travel, grandkids', ar: 'مثال: البستنة، السفر' },
      layer: 'always_use',
      format: (v) => `Current interests: ${v}.`,
    },
    {
      key: 'health_notes',
      label: { en: 'Health notes (optional)', ar: 'ملاحظات صحية (اختياري)' },
      placeholder: { en: 'e.g. diabetic, walks daily', ar: 'مثال: سكري، أمشي يومياً' },
      layer: 'always_use',
      format: (v) => `Health note: ${v}.`,
    },
  ],
  creator: [
    {
      key: 'content_type',
      label: { en: 'What you create', ar: 'ماذا تصنع' },
      placeholder: { en: 'e.g. short videos, podcasts, design, writing', ar: 'مثال: فيديوهات قصيرة، بودكاست، تصميم' },
      layer: 'always_use',
      format: (v) => `Creates ${v}.`,
    },
    {
      key: 'platforms',
      label: { en: 'Main platforms', ar: 'المنصات الأساسية' },
      placeholder: { en: 'e.g. Instagram, TikTok, YouTube', ar: 'مثال: إنستغرام، تيك توك، يوتيوب' },
      layer: 'always_use',
      format: (v) => `Main platforms: ${v}.`,
    },
    {
      key: 'niche',
      label: { en: 'Topic / niche', ar: 'المجال / التخصص' },
      placeholder: { en: 'e.g. productivity, food, fitness, tech', ar: 'مثال: إنتاجية، طعام، لياقة، تقنية' },
      layer: 'project',
      format: (v) => `Content niche: ${v}.`,
    },
    {
      key: 'brand_voice',
      label: { en: 'Brand voice', ar: 'أسلوب العلامة' },
      placeholder: { en: 'e.g. playful, premium, educational', ar: 'مثال: مرح، راقٍ، تعليمي' },
      layer: 'always_use',
      format: (v) => `Preferred brand voice: ${v}.`,
    },
    {
      key: 'posting_routine',
      label: { en: 'Posting routine (optional)', ar: 'روتين النشر (اختياري)' },
      placeholder: { en: 'e.g. I post 3 reels every week', ar: 'مثال: أنشر 3 ريلز كل أسبوع' },
      layer: 'routine',
      format: (v) => `Posting routine: ${v}.`,
    },
    {
      key: 'current_content_goal',
      label: { en: 'Current content goal', ar: 'هدف المحتوى الحالي' },
      placeholder: { en: 'e.g. grow my Arabic audience, launch a new series', ar: 'مثال: زيادة الجمهور العربي، إطلاق سلسلة جديدة' },
      layer: 'project',
      format: (v) => `Current content goal: ${v}.`,
    },
  ],
  other: [],
};

export function HelpfulMemoryProfileForm({ onSaved, onClose }: HelpfulMemoryProfileFormProps) {
  const { language, theme } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const [role, setRole] = useState<Role | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [freeLayer, setFreeLayer] = useState<HelpfulMemoryLayer>('always_use');
  const [isSaving, setIsSaving] = useState(false);
  const isDark = theme === 'dark';

  const labels = useMemo(() => ({
    title: language === 'ar' ? 'إعداد الملف الشخصي السريع' : 'Quick Profile Setup',
    subtitle: language === 'ar'
      ? 'املأ ما يناسبك فقط. نحفظ أهم الأشياء كذاكرة مفيدة حتى يفهمك وقتي بشكل أفضل بدون إغراق النظام.'
      : 'Fill only what fits you. We save the most helpful details as memory so Wakti understands you better without overflowing the system.',
    pickRole: language === 'ar' ? 'اختر ما يناسبك:' : 'Pick what fits you best:',
    change: language === 'ar' ? 'تغيير' : 'Change',
    common: language === 'ar' ? 'عام' : 'About you',
    roleFields: language === 'ar' ? 'تفاصيل إضافية' : 'More details',
    anythingElse: language === 'ar' ? 'شيء آخر تريد وقتي أن يتذكره؟' : 'Anything else you want Wakti to remember?',
    anythingElseHint: language === 'ar' ? 'اكتب بلغتك الخاصة. اختر أين يجب أن تعيش هذه المعلومة.' : 'Type it in your own words. Choose where this should live.',
    save: language === 'ar' ? 'حفظ الكل' : 'Save all',
    saving: language === 'ar' ? 'جاري الحفظ...' : 'Saving...',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    saved: (n: number) => language === 'ar' ? `تم حفظ ${n} عنصر` : `Saved ${n} item${n === 1 ? '' : 's'}`,
    noneFilled: language === 'ar' ? 'لم يتم تعبئة أي حقل' : 'No fields filled',
    saveFailed: language === 'ar' ? 'تعذر حفظ بعض العناصر' : 'Some items failed to save',
    helper: language === 'ar' ? 'اختر فقط ما يساعد وقتي فعلاً.' : 'Only add what truly helps Wakti help you.',
    layer: {
      always_use: language === 'ar' ? 'عني' : 'About me',
      routine: language === 'ar' ? 'روتين' : 'Routine',
      project: language === 'ar' ? 'مشروع' : 'Project',
    } as Record<Exclude<HelpfulMemoryLayer, 'candidate'>, string>,
  }), [language]);

  const shellClass = isDark
    ? 'border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.96)_0%,rgba(30,41,59,0.96)_100%)] shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
    : 'border-[rgba(233,206,176,0.95)] bg-[linear-gradient(135deg,rgba(252,254,253,0.99)_0%,rgba(245,241,233,0.99)_100%)] shadow-[0_16px_36px_rgba(6,5,65,0.08)]';
  const headingText = isDark ? 'text-slate-100' : 'text-[hsl(243_84%_14%)]';
  const mutedText = isDark ? 'text-slate-300' : 'text-[hsl(243_20%_34%)]';
  const subtleText = isDark ? 'text-slate-400' : 'text-[hsl(243_15%_42%)]';
  const fieldClass = isDark
    ? 'border-white/10 bg-black/30 text-slate-100'
    : 'border-[rgba(6,5,65,0.12)] bg-white/90 text-[hsl(243_84%_14%)]';
  const chipShell = isDark ? 'border-white/10 bg-black/20' : 'border-[rgba(6,5,65,0.10)] bg-[rgba(6,5,65,0.04)]';

  const update = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    const entries: { text: string; layer: HelpfulMemoryLayer }[] = [];

    const collectFrom = (specs: FieldSpec[]) => {
      for (const spec of specs) {
        const raw = (values[spec.key] || '').trim();
        if (!raw) continue;
        const text = spec.format(raw).trim();
        if (text.length >= 3) entries.push({ text, layer: spec.layer });
      }
    };

    collectFrom(COMMON_FIELDS);
    if (role && role !== 'other') collectFrom(ROLE_FIELDS[role]);

    const extra = freeText.trim();
    if (extra) entries.push({ text: extra, layer: freeLayer });

    if (entries.length === 0) {
      showError(labels.noneFilled);
      setIsSaving(false);
      return;
    }

    let saved = 0;
    let failed = 0;
    for (const entry of entries) {
      try {
        await HelpfulMemoryService.saveMemory({ memoryText: entry.text, layer: entry.layer });
        saved += 1;
      } catch (error) {
        console.error('Profile save failed for entry', entry, error);
        failed += 1;
      }
    }

    setIsSaving(false);
    if (saved > 0) {
      showSuccess(labels.saved(saved));
      onSaved(saved);
    }
    if (failed > 0) {
      showError(labels.saveFailed);
    }
    if (saved > 0 && failed === 0) {
      onClose();
    }
  };

  const renderField = (spec: FieldSpec) => {
    const value = values[spec.key] || '';
    return (
      <div key={spec.key} className="space-y-1">
        <label className={`block text-[11px] ${subtleText}`}>
          {language === 'ar' ? spec.label.ar : spec.label.en}
        </label>
        {spec.multiline ? (
          <Textarea
            value={value}
            onChange={(e) => update(spec.key, e.target.value)}
            placeholder={language === 'ar' ? spec.placeholder.ar : spec.placeholder.en}
            className={`min-h-[64px] rounded-xl border text-sm ${fieldClass}`}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => update(spec.key, e.target.value)}
            placeholder={language === 'ar' ? spec.placeholder.ar : spec.placeholder.en}
            className={`h-9 rounded-xl border text-sm ${fieldClass}`}
          />
        )}
      </div>
    );
  };

  const roleFields = role && role !== 'other' ? ROLE_FIELDS[role] : [];
  const currentRoleMeta = role ? ROLE_OPTIONS.find((r) => r.value === role) : null;

  return (
    <div className={`mt-3 rounded-2xl border p-3 ${shellClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-sm font-semibold ${headingText}`}>{labels.title}</div>
          <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>{labels.subtitle}</p>
          <p className={`mt-1 text-[11px] ${subtleText}`}>{labels.helper}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-lg p-1 ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-[hsl(243_20%_34%)] hover:bg-[rgba(6,5,65,0.06)] hover:text-[hsl(243_84%_14%)]'}`}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!role ? (
        <div className="mt-3">
          <div className={`mb-2 text-[11px] ${subtleText}`}>{labels.pickRole}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${isDark ? 'border-white/10 bg-black/20 text-slate-200 hover:border-blue-400/30 hover:bg-blue-500/10' : 'border-[rgba(6,5,65,0.10)] bg-white/80 text-[hsl(243_84%_14%)] hover:border-[rgba(6,5,65,0.18)] hover:bg-[rgba(6,5,65,0.04)]'}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isDark ? 'text-blue-300' : 'text-[hsl(243_84%_14%)]'}`} />
                  <span>{language === 'ar' ? opt.ar : opt.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className={`mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${chipShell}`}>
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-200' : 'text-[hsl(243_84%_14%)]'}`}>
              {currentRoleMeta && <currentRoleMeta.icon className={`h-3.5 w-3.5 ${isDark ? 'text-blue-300' : 'text-[hsl(243_84%_14%)]'}`} />}
              <span>{currentRoleMeta ? (language === 'ar' ? currentRoleMeta.ar : currentRoleMeta.en) : ''}</span>
            </div>
            <button
              type="button"
              onClick={() => { setRole(null); setValues({}); }}
              className={`text-[11px] ${isDark ? 'text-blue-300 hover:underline' : 'text-[hsl(243_84%_14%)] hover:underline'}`}
            >
              {labels.change}
            </button>
          </div>

          {roleFields.length > 0 && (
            <div className="mt-3">
              <div className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${subtleText}`}>
                {labels.roleFields}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {roleFields.map(renderField)}
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${subtleText}`}>
              {labels.common}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {COMMON_FIELDS.map(renderField)}
            </div>
          </div>

          <div className="mt-3">
            <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${subtleText}`}>
              {labels.anythingElse}
            </div>
            <div className={`mb-2 text-[11px] ${subtleText}`}>{labels.anythingElseHint}</div>
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
              className={`min-h-[72px] rounded-xl border text-sm ${fieldClass}`}
            />
            <div className={`mt-2 flex flex-wrap gap-1 rounded-xl border p-1 ${chipShell}`}>
              {(['always_use', 'routine', 'project'] as Exclude<HelpfulMemoryLayer, 'candidate'>[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setFreeLayer(layer)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    freeLayer === layer ? 'bg-blue-500 text-white' : isDark ? 'text-slate-200 hover:bg-white/5' : 'text-[hsl(243_84%_14%)] hover:bg-[rgba(6,5,65,0.06)]'
                  }`}
                >
                  {labels.layer[layer]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 flex-1 rounded-xl bg-blue-500 px-3 text-xs text-white hover:bg-blue-600 disabled:opacity-60"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {isSaving ? labels.saving : labels.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className={`h-9 rounded-xl px-3 text-xs ${isDark ? 'border-white/10 bg-transparent text-slate-200 hover:bg-white/10' : 'border-[rgba(6,5,65,0.12)] bg-white/70 text-[hsl(243_84%_14%)] hover:bg-white'}`}
            >
              {labels.cancel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
