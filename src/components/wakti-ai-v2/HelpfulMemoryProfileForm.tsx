import React, { useMemo, useState } from 'react';
import { GraduationCap, Briefcase, Crown, Rocket, Baby, Palmtree, Sparkles, Save, X } from 'lucide-react';
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

type Role = 'student' | 'employee' | 'manager' | 'self_employed' | 'parent' | 'retired' | 'other';

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
  other: [],
};

export function HelpfulMemoryProfileForm({ onSaved, onClose }: HelpfulMemoryProfileFormProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const [role, setRole] = useState<Role | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [freeLayer, setFreeLayer] = useState<HelpfulMemoryLayer>('always_use');
  const [isSaving, setIsSaving] = useState(false);

  const labels = useMemo(() => ({
    title: language === 'ar' ? 'إعداد الملف الشخصي السريع' : 'Quick Profile Setup',
    subtitle: language === 'ar'
      ? 'املأ ما يناسبك فقط. كل حقل يُحفظ كذاكرة ويمكنك تعديلها أو حذفها في أي وقت.'
      : 'Fill only what fits you. Each field is saved as a memory you can edit or delete anytime.',
    pickRole: language === 'ar' ? 'اختر ما يناسبك:' : 'Pick what fits you best:',
    change: language === 'ar' ? 'تغيير' : 'Change',
    common: language === 'ar' ? 'عام' : 'About you',
    roleFields: language === 'ar' ? 'تفاصيل إضافية' : 'More details',
    anythingElse: language === 'ar' ? 'شيء آخر تريد وقتي أن يتذكره؟' : 'Anything else you want Wakti to remember?',
    anythingElseHint: language === 'ar' ? 'اكتب بلغتك الخاصة. اختر أين يعيش.' : 'Type it in your own words. Pick where it lives.',
    save: language === 'ar' ? 'حفظ الكل' : 'Save all',
    saving: language === 'ar' ? 'جاري الحفظ...' : 'Saving...',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    saved: (n: number) => language === 'ar' ? `تم حفظ ${n} عنصر` : `Saved ${n} item${n === 1 ? '' : 's'}`,
    noneFilled: language === 'ar' ? 'لم يتم تعبئة أي حقل' : 'No fields filled',
    saveFailed: language === 'ar' ? 'تعذر حفظ بعض العناصر' : 'Some items failed to save',
    layer: {
      always_use: language === 'ar' ? 'عني' : 'About me',
      routine: language === 'ar' ? 'روتين' : 'Routine',
      project: language === 'ar' ? 'مشروع' : 'Project',
    } as Record<Exclude<HelpfulMemoryLayer, 'candidate'>, string>,
  }), [language]);

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
        <label className="block text-[11px] text-slate-400">
          {language === 'ar' ? spec.label.ar : spec.label.en}
        </label>
        {spec.multiline ? (
          <Textarea
            value={value}
            onChange={(e) => update(spec.key, e.target.value)}
            placeholder={language === 'ar' ? spec.placeholder.ar : spec.placeholder.en}
            className="min-h-[64px] rounded-xl border border-white/10 bg-black/30 text-sm text-slate-100"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => update(spec.key, e.target.value)}
            placeholder={language === 'ar' ? spec.placeholder.ar : spec.placeholder.en}
            className="h-9 rounded-xl border border-white/10 bg-black/30 text-sm text-slate-100"
          />
        )}
      </div>
    );
  };

  const roleFields = role && role !== 'other' ? ROLE_FIELDS[role] : [];
  const currentRoleMeta = role ? ROLE_OPTIONS.find((r) => r.value === role) : null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.96)_0%,rgba(30,41,59,0.96)_100%)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">{labels.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{labels.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!role ? (
        <div className="mt-3">
          <div className="mb-2 text-[11px] text-slate-400">{labels.pickRole}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-blue-400/30 hover:bg-blue-500/10"
                >
                  <Icon className="h-3.5 w-3.5 text-blue-300" />
                  <span>{language === 'ar' ? opt.ar : opt.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              {currentRoleMeta && <currentRoleMeta.icon className="h-3.5 w-3.5 text-blue-300" />}
              <span>{currentRoleMeta ? (language === 'ar' ? currentRoleMeta.ar : currentRoleMeta.en) : ''}</span>
            </div>
            <button
              type="button"
              onClick={() => { setRole(null); setValues({}); }}
              className="text-[11px] text-blue-300 hover:underline"
            >
              {labels.change}
            </button>
          </div>

          {roleFields.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {labels.roleFields}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {roleFields.map(renderField)}
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {labels.common}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {COMMON_FIELDS.map(renderField)}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {labels.anythingElse}
            </div>
            <div className="mb-2 text-[11px] text-slate-500">{labels.anythingElseHint}</div>
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
              className="min-h-[72px] rounded-xl border border-white/10 bg-black/30 text-sm text-slate-100"
            />
            <div className="mt-2 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {(['always_use', 'routine', 'project'] as Exclude<HelpfulMemoryLayer, 'candidate'>[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setFreeLayer(layer)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    freeLayer === layer ? 'bg-blue-500 text-white' : 'text-slate-200 hover:bg-white/5'
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
              className="h-9 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              {labels.cancel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
