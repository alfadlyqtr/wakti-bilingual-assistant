import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Upload, User, Briefcase, GraduationCap, Award,
  Plus, X, Trash2, Mail, Phone, MapPin, Linkedin, Globe, FileText,
  Loader2, Eye, ChevronDown, ChevronUp, ArrowRight, Star, Check, LayoutGrid, List,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PersonalInfo {
  fullName: string; jobTitle: string; email: string; phone: string;
  location: string; linkedin: string; website: string; summary: string;
}
interface Experience {
  id: string; company: string; position: string; location: string;
  startDate: string; endDate: string; current: boolean; description: string;
}
interface Education {
  id: string; institution: string; degree: string; field: string;
  startDate: string; endDate: string;
}
interface Skill { id: string; name: string; level: string; }
interface CVData {
  personalInfo: PersonalInfo; experience: Experience[];
  education: Education[]; skills: Skill[];
}
interface CVBuilderWizardProps {
  onComplete: (data: CVData) => void; onBack: () => void;
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

interface CVTemplate {
  id: string;
  name: string;
  nameAr: string;
  recommended?: boolean;
  isATS?: boolean;
  colors: Array<{
    id: string;
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  }>;
  layout: 'sidebar-left' | 'sidebar-right' | 'classic' | 'modern' | 'minimal';
}

const CV_TEMPLATES: CVTemplate[] = [
  {
    id: 'sidney',
    name: 'Sidney',
    nameAr: 'سيدني',
    recommended: true,
    isATS: true,
    colors: [
      { id: 'blue', primary: '#1e88e5', secondary: '#e3f2fd', accent: '#0d47a1', bg: '#f5f9ff' },
      { id: 'black', primary: '#212121', secondary: '#f5f5f5', accent: '#000000', bg: '#ffffff' },
      { id: 'purple', primary: '#7c3aed', secondary: '#ede9fe', accent: '#5b21b6', bg: '#faf5ff' },
      { id: 'pink', primary: '#ec4899', secondary: '#fce7f3', accent: '#be185d', bg: '#fdf2f8' },
      { id: 'yellow', primary: '#f59e0b', secondary: '#fef3c7', accent: '#d97706', bg: '#fffbeb' },
      { id: 'green', primary: '#10b981', secondary: '#d1fae5', accent: '#059669', bg: '#ecfdf5' },
      { id: 'teal', primary: '#14b8a6', secondary: '#ccfbf1', accent: '#0d9488', bg: '#f0fdfa' },
    ],
    layout: 'sidebar-left',
  },
  {
    id: 'dallas',
    name: 'Dallas',
    nameAr: 'دالاس',
    isATS: true,
    colors: [
      { id: 'blue', primary: '#2563eb', secondary: '#dbeafe', accent: '#1d4ed8', bg: '#ffffff' },
      { id: 'black', primary: '#171717', secondary: '#f5f5f5', accent: '#000000', bg: '#ffffff' },
      { id: 'purple', primary: '#8b5cf6', secondary: '#ede9fe', accent: '#6d28d9', bg: '#ffffff' },
      { id: 'pink', primary: '#f472b6', secondary: '#fce7f3', accent: '#db2777', bg: '#ffffff' },
      { id: 'yellow', primary: '#eab308', secondary: '#fef9c3', accent: '#ca8a04', bg: '#ffffff' },
      { id: 'green', primary: '#22c55e', secondary: '#dcfce7', accent: '#16a34a', bg: '#ffffff' },
      { id: 'teal', primary: '#06b6d4', secondary: '#cffafe', accent: '#0891b2', bg: '#ffffff' },
    ],
    layout: 'classic',
  },
  {
    id: 'valencia',
    name: 'Valencia',
    nameAr: 'فالنسيا',
    colors: [
      { id: 'navy', primary: '#1e3a5f', secondary: '#e8eef4', accent: '#0f2744', bg: '#ffffff' },
      { id: 'black', primary: '#1f2937', secondary: '#f3f4f6', accent: '#111827', bg: '#ffffff' },
      { id: 'purple', primary: '#6366f1', secondary: '#e0e7ff', accent: '#4f46e5', bg: '#ffffff' },
      { id: 'pink', primary: '#e11d48', secondary: '#ffe4e6', accent: '#be123c', bg: '#ffffff' },
      { id: 'yellow', primary: '#d97706', secondary: '#fef3c7', accent: '#b45309', bg: '#ffffff' },
      { id: 'green', primary: '#059669', secondary: '#d1fae5', accent: '#047857', bg: '#ffffff' },
      { id: 'teal', primary: '#0d9488', secondary: '#ccfbf1', accent: '#0f766e', bg: '#ffffff' },
    ],
    layout: 'sidebar-left',
  },
  {
    id: 'milano',
    name: 'Milano',
    nameAr: 'ميلانو',
    recommended: true,
    colors: [
      { id: 'blue', primary: '#3b82f6', secondary: '#eff6ff', accent: '#2563eb', bg: '#ffffff' },
      { id: 'black', primary: '#18181b', secondary: '#f4f4f5', accent: '#09090b', bg: '#ffffff' },
      { id: 'purple', primary: '#a855f7', secondary: '#f3e8ff', accent: '#9333ea', bg: '#ffffff' },
      { id: 'pink', primary: '#f43f5e', secondary: '#fff1f2', accent: '#e11d48', bg: '#ffffff' },
      { id: 'yellow', primary: '#f59e0b', secondary: '#fffbeb', accent: '#d97706', bg: '#ffffff' },
      { id: 'green', primary: '#34d399', secondary: '#ecfdf5', accent: '#10b981', bg: '#ffffff' },
      { id: 'teal', primary: '#2dd4bf', secondary: '#f0fdfa', accent: '#14b8a6', bg: '#ffffff' },
    ],
    layout: 'sidebar-right',
  },
  {
    id: 'helen',
    name: 'Helen',
    nameAr: 'هيلين',
    isATS: true,
    colors: [
      { id: 'blue', primary: '#1d4ed8', secondary: '#dbeafe', accent: '#1e40af', bg: '#ffffff' },
      { id: 'black', primary: '#27272a', secondary: '#e4e4e7', accent: '#18181b', bg: '#ffffff' },
      { id: 'purple', primary: '#7c3aed', secondary: '#ede9fe', accent: '#6d28d9', bg: '#ffffff' },
      { id: 'pink', primary: '#db2777', secondary: '#fce7f3', accent: '#be185d', bg: '#ffffff' },
      { id: 'yellow', primary: '#ca8a04', secondary: '#fef9c3', accent: '#a16207', bg: '#ffffff' },
      { id: 'green', primary: '#16a34a', secondary: '#dcfce7', accent: '#15803d', bg: '#ffffff' },
      { id: 'teal', primary: '#0891b2', secondary: '#cffafe', accent: '#0e7490', bg: '#ffffff' },
    ],
    layout: 'minimal',
  },
];

// ============================================================================
// TRANSLATIONS
// ============================================================================

const t_en = {
  chooseTemplate: "Choose Your Template",
  chooseTemplateDesc: "Select a design that represents you",
  recommended: "RECOMMENDED",
  modern: "Modern",
  ats: "ATS",
  startWithTemplate: "Start with this template",
  uploadCV: "Upload Existing CV",
  uploadCVDesc: "Let AI extract your information",
  supportedFormats: "PDF, DOC, DOCX, or Image",
  personalInfo: "Personal Information",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  fullName: "Full Name",
  jobTitle: "Professional Title",
  email: "Email",
  phone: "Phone",
  location: "Location",
  linkedin: "LinkedIn",
  website: "Website",
  summary: "Professional Summary",
  company: "Company",
  position: "Position",
  startDate: "Start",
  endDate: "End",
  currentlyWorking: "Currently working here",
  institution: "Institution",
  degree: "Degree",
  field: "Field of Study",
  skillName: "Skill",
  addSection: "Add Section",
  addExperience: "Add Experience",
  addEducation: "Add Education",
  addSkill: "Add Skill",
  remove: "Remove",
  back: "Back",
  preview: "Preview",
  download: "Download PDF",
  extracting: "Extracting...",
  extracted: "Data Extracted!",
  extractedDesc: "Your details have been filled",
  extractFailed: "Extraction Failed",
  extractFailedDesc: "Please fill manually",
};

const t_ar = {
  chooseTemplate: "اختر قالبك",
  chooseTemplateDesc: "اختر تصميماً يمثلك",
  recommended: "موصى به",
  modern: "عصري",
  ats: "ATS",
  startWithTemplate: "ابدأ بهذا القالب",
  uploadCV: "ارفع سيرة ذاتية",
  uploadCVDesc: "دع الذكاء الاصطناعي يستخرج معلوماتك",
  supportedFormats: "PDF، DOC، DOCX، أو صورة",
  personalInfo: "المعلومات الشخصية",
  experience: "الخبرة العملية",
  education: "التعليم",
  skills: "المهارات",
  fullName: "الاسم الكامل",
  jobTitle: "المسمى الوظيفي",
  email: "البريد الإلكتروني",
  phone: "الهاتف",
  location: "الموقع",
  linkedin: "LinkedIn",
  website: "الموقع الإلكتروني",
  summary: "الملخص المهني",
  company: "الشركة",
  position: "المنصب",
  startDate: "البداية",
  endDate: "النهاية",
  currentlyWorking: "أعمل هنا حالياً",
  institution: "المؤسسة",
  degree: "الدرجة",
  field: "التخصص",
  skillName: "المهارة",
  addSection: "إضافة قسم",
  addExperience: "إضافة خبرة",
  addEducation: "إضافة تعليم",
  addSkill: "إضافة مهارة",
  remove: "حذف",
  back: "رجوع",
  preview: "معاينة",
  download: "تحميل PDF",
  extracting: "جاري الاستخراج...",
  extracted: "تم استخراج البيانات!",
  extractedDesc: "تم ملء بياناتك",
  extractFailed: "فشل الاستخراج",
  extractFailedDesc: "يرجى الإدخال يدوياً",
};

// ============================================================================
// SAMPLE DATA FOR PREVIEW
// ============================================================================

const SAMPLE_DATA = {
  name: 'Alex Johnson',
  title: 'Senior Software Engineer',
  email: 'alex@email.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  summary: 'Passionate software engineer with 8+ years of experience building scalable applications.',
  experience: [
    { company: 'Tech Corp', position: 'Senior Engineer', date: '2020 - Present' },
    { company: 'StartupXYZ', position: 'Software Developer', date: '2018 - 2020' },
  ],
  education: [{ school: 'MIT', degree: 'B.S. Computer Science', date: '2014 - 2018' }],
  skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AWS'],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CVBuilderWizard: React.FC<CVBuilderWizardProps> = ({ onComplete, onBack }) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = language === 'ar' ? t_ar : t_en;
  const isRTL = language === 'ar';

  const [isMobile, setIsMobile] = useState(false);

  const [step, setStep] = useState<'templates' | 'method' | 'builder' | 'preview'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<CVTemplate>(CV_TEMPLATES[0]);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [templateView, setTemplateView] = useState<'grid' | 'list'>('grid');
  const [cvData, setCvData] = useState<CVData>({
    personalInfo: { fullName: '', jobTitle: '', email: user?.email || '', phone: '', location: '', linkedin: '', website: '', summary: '' },
    experience: [], education: [], skills: [],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['personalInfo']));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentColor = selectedTemplate.colors[selectedColorIndex];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Handlers
  const toggle = (s: string) => setExpanded(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const updatePI = useCallback((f: keyof PersonalInfo, v: string) => {
    setCvData(p => ({ ...p, personalInfo: { ...p.personalInfo, [f]: v } }));
  }, []);

  const addExp = () => {
    const e: Experience = { id: `e${Date.now()}`, company: '', position: '', location: '', startDate: '', endDate: '', current: false, description: '' };
    setCvData(p => ({ ...p, experience: [...p.experience, e] }));
    setExpanded(p => new Set([...p, 'experience']));
  };
  const updateExp = (id: string, f: keyof Experience, v: any) => setCvData(p => ({ ...p, experience: p.experience.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const removeExp = (id: string) => setCvData(p => ({ ...p, experience: p.experience.filter(x => x.id !== id) }));

  const addEdu = () => {
    const e: Education = { id: `d${Date.now()}`, institution: '', degree: '', field: '', startDate: '', endDate: '' };
    setCvData(p => ({ ...p, education: [...p.education, e] }));
    setExpanded(p => new Set([...p, 'education']));
  };
  const updateEdu = (id: string, f: keyof Education, v: string) => setCvData(p => ({ ...p, education: p.education.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const removeEdu = (id: string) => setCvData(p => ({ ...p, education: p.education.filter(x => x.id !== id) }));

  const addSkill = () => {
    const s: Skill = { id: `s${Date.now()}`, name: '', level: 'intermediate' };
    setCvData(p => ({ ...p, skills: [...p.skills, s] }));
    setExpanded(p => new Set([...p, 'skills']));
  };
  const updateSkill = (id: string, f: keyof Skill, v: string) => setCvData(p => ({ ...p, skills: p.skills.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const removeSkill = (id: string) => setCvData(p => ({ ...p, skills: p.skills.filter(x => x.id !== id) }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const content = await new Promise<string>((res, rej) => { reader.onload = () => res((reader.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(file); });
      const { data, error } = await supabase.functions.invoke('extract-resume-data', { body: { fileContent: content, fileName: file.name, mimeType: file.type } });
      if (error) throw error;
      if (data?.extracted) {
        const ex = data.extracted;
        setCvData(p => ({
          ...p,
          personalInfo: { ...p.personalInfo, fullName: [ex.firstName, ex.lastName].filter(Boolean).join(' ') || p.personalInfo.fullName, email: ex.email || p.personalInfo.email, phone: ex.phone || p.personalInfo.phone, jobTitle: ex.jobTitle || p.personalInfo.jobTitle },
          experience: ex.companyName ? [{ id: `e${Date.now()}`, company: ex.companyName, position: ex.jobTitle || '', location: '', startDate: '', endDate: '', current: true, description: '' }] : p.experience,
        }));
        toast({ title: t.extracted, description: t.extractedDesc });
        setStep('builder'); setExpanded(new Set(['personalInfo', 'experience']));
      } else { toast({ title: t.extractFailed, description: t.extractFailedDesc, variant: 'destructive' }); setStep('builder'); }
    } catch { toast({ title: t.extractFailed, description: t.extractFailedDesc, variant: 'destructive' }); setStep('builder'); }
    finally { setIsUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const selectTemplate = (template: CVTemplate) => {
    setSelectedTemplate(template);
    setSelectedColorIndex(0);
  };

  const handleTemplateCardClick = (template: CVTemplate) => {
    if (selectedTemplate?.id === template.id) {
      setStep('method');
      return;
    }
    selectTemplate(template);
  };

  // ============================================================================
  // TEMPLATE PREVIEW COMPONENT
  // ============================================================================

  const TemplatePreviewWithData: React.FC<{ template: CVTemplate; colorIndex: number; data: typeof SAMPLE_DATA }> = ({ template, colorIndex, data }) => {
    const color = template.colors[colorIndex];
    const scale = 'scale-[0.65]';
    
    if (template.layout === 'sidebar-left') {
      return (
        <div className={`w-[400px] h-[566px] ${scale} origin-top bg-white rounded-lg shadow-lg overflow-hidden flex`}>
          <div className="w-[140px] h-full p-4 flex flex-col" style={{ backgroundColor: color.primary }}>
            <div className="w-20 h-20 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="text-white text-center mb-4">
              <div className="font-bold text-sm">{data.name}</div>
              <div className="text-xs opacity-80">{data.title}</div>
            </div>
            <div className="space-y-2 text-white/80 text-[8px]">
              <div className="flex items-center gap-1"><Mail className="w-2 h-2" />{data.email}</div>
              <div className="flex items-center gap-1"><Phone className="w-2 h-2" />{data.phone}</div>
              <div className="flex items-center gap-1"><MapPin className="w-2 h-2" />{data.location}</div>
            </div>
            <div className="mt-4">
              <div className="text-white font-bold text-[9px] mb-2">SKILLS</div>
              <div className="space-y-1">
                {data.skills.slice(0, 4).map((s, i) => (
                  <div key={i} className="text-[7px] text-white/90 bg-white/10 px-2 py-0.5 rounded">{s}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 p-4" style={{ backgroundColor: color.bg }}>
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-1" style={{ color: color.primary }}>SUMMARY</div>
              <div className="text-[7px] text-gray-600 leading-relaxed">{data.summary}</div>
            </div>
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-2" style={{ color: color.primary }}>WORK EXPERIENCE</div>
              {data.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-500">{exp.company} | {exp.date}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[10px] mb-2" style={{ color: color.primary }}>EDUCATION</div>
              {data.education.map((edu, i) => (
                <div key={i}>
                  <div className="font-semibold text-[8px]">{edu.degree}</div>
                  <div className="text-[7px] text-gray-500">{edu.school}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (template.layout === 'minimal') {
      return (
        <div className={`w-[400px] h-[566px] ${scale} origin-top bg-white rounded-lg shadow-lg overflow-hidden p-6`}>
          <div className="text-center mb-4 pb-4 border-b-2" style={{ borderColor: color.primary }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-2 bg-gray-200" />
            <div className="font-bold text-lg" style={{ color: color.primary }}>{data.name}</div>
            <div className="text-xs text-gray-500">{data.title}</div>
            <div className="flex justify-center gap-4 mt-2 text-[7px] text-gray-500">
              <span>{data.email}</span>
              <span>{data.phone}</span>
            </div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] mb-1 text-center" style={{ color: color.primary }}>PROFESSIONAL SUMMARY</div>
            <div className="text-[7px] text-gray-600 text-center">{data.summary}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>EXPERIENCE</div>
              {data.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[7px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-500">{exp.company}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {data.skills.map((s, i) => (
                  <span key={i} className="text-[6px] px-1.5 py-0.5 rounded" style={{ backgroundColor: color.secondary, color: color.primary }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Classic layout
    return (
      <div className={`w-[400px] h-[566px] ${scale} origin-top bg-white rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4 text-center" style={{ backgroundColor: color.secondary }}>
          <div className="font-bold text-lg" style={{ color: color.primary }}>{data.name}</div>
          <div className="text-xs text-gray-600">{data.title}</div>
          <div className="flex justify-center gap-3 mt-2 text-[7px] text-gray-500">
            <span>{data.email}</span>
            <span>{data.phone}</span>
            <span>{data.location}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SUMMARY</div>
            <div className="text-[7px] text-gray-600">{data.summary}</div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>EXPERIENCE</div>
            {data.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-500">{exp.date}</div>
                </div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>EDUCATION</div>
            {data.education.map((edu, i) => (
              <div key={i}>
                <div className="font-semibold text-[8px]">{edu.degree}</div>
                <div className="text-[7px] text-gray-500">{edu.school}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SKILLS</div>
            <div className="flex flex-wrap gap-1">
              {data.skills.map((s, i) => (
                <span key={i} className="text-[7px] px-2 py-0.5 rounded-full" style={{ backgroundColor: color.secondary, color: color.primary }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TemplatePreview: React.FC<{ template: CVTemplate; colorIndex: number; mini?: boolean }> = ({ template, colorIndex, mini }) => {
    const color = template.colors[colorIndex];
    const scale = mini ? 'scale-[0.30]' : 'scale-[0.52]';
    
    if (template.layout === 'sidebar-left') {
      return (
        <div className={`w-[400px] h-[566px] ${scale} origin-top-left bg-white rounded-lg shadow-lg overflow-hidden flex`}>
          <div className="w-[140px] h-full p-4 flex flex-col" style={{ backgroundColor: color.primary }}>
            <div className="w-20 h-20 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="text-white text-center mb-4">
              <div className="font-bold text-sm">{SAMPLE_DATA.name}</div>
              <div className="text-xs opacity-80">{SAMPLE_DATA.title}</div>
            </div>
            <div className="space-y-2 text-white/80 text-[8px]">
              <div className="flex items-center gap-1"><Mail className="w-2 h-2" />{SAMPLE_DATA.email}</div>
              <div className="flex items-center gap-1"><Phone className="w-2 h-2" />{SAMPLE_DATA.phone}</div>
              <div className="flex items-center gap-1"><MapPin className="w-2 h-2" />{SAMPLE_DATA.location}</div>
            </div>
            <div className="mt-4">
              <div className="text-white font-bold text-[9px] mb-2">SKILLS</div>
              <div className="space-y-1">
                {SAMPLE_DATA.skills.slice(0, 4).map((s, i) => (
                  <div key={i} className="text-[7px] text-white/90 bg-white/10 px-2 py-0.5 rounded">{s}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 p-4" style={{ backgroundColor: color.bg }}>
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-1" style={{ color: color.primary }}>SUMMARY</div>
              <div className="text-[7px] text-gray-600 leading-relaxed">{SAMPLE_DATA.summary}</div>
            </div>
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-2" style={{ color: color.primary }}>WORK EXPERIENCE</div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-500">{exp.company} | {exp.date}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[10px] mb-2" style={{ color: color.primary }}>EDUCATION</div>
              {SAMPLE_DATA.education.map((edu, i) => (
                <div key={i}>
                  <div className="font-semibold text-[8px]">{edu.degree}</div>
                  <div className="text-[7px] text-gray-500">{edu.school}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (template.layout === 'minimal') {
      return (
        <div className={`w-[400px] h-[566px] ${scale} origin-top-left bg-white rounded-lg shadow-lg overflow-hidden p-6`}>
          <div className="text-center mb-4 pb-4 border-b-2" style={{ borderColor: color.primary }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-2 bg-gray-200" />
            <div className="font-bold text-lg" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
            <div className="text-xs text-gray-500">{SAMPLE_DATA.title}</div>
            <div className="flex justify-center gap-4 mt-2 text-[7px] text-gray-500">
              <span>{SAMPLE_DATA.email}</span>
              <span>{SAMPLE_DATA.phone}</span>
            </div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] mb-1 text-center" style={{ color: color.primary }}>PROFESSIONAL SUMMARY</div>
            <div className="text-[7px] text-gray-600 text-center">{SAMPLE_DATA.summary}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>EXPERIENCE</div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[7px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-500">{exp.company}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {SAMPLE_DATA.skills.map((s, i) => (
                  <span key={i} className="text-[6px] px-1.5 py-0.5 rounded" style={{ backgroundColor: color.secondary, color: color.primary }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Classic layout
    return (
      <div className={`w-[400px] h-[566px] ${scale} origin-top-left bg-white rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4 text-center" style={{ backgroundColor: color.secondary }}>
          <div className="font-bold text-lg" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
          <div className="text-xs text-gray-600">{SAMPLE_DATA.title}</div>
          <div className="flex justify-center gap-3 mt-2 text-[7px] text-gray-500">
            <span>{SAMPLE_DATA.email}</span>
            <span>{SAMPLE_DATA.phone}</span>
            <span>{SAMPLE_DATA.location}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SUMMARY</div>
            <div className="text-[7px] text-gray-600">{SAMPLE_DATA.summary}</div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>EXPERIENCE</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-500">{exp.date}</div>
                </div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>EDUCATION</div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i}>
                <div className="font-semibold text-[8px]">{edu.degree}</div>
                <div className="text-[7px] text-gray-500">{edu.school}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SKILLS</div>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_DATA.skills.map((s, i) => (
                <span key={i} className="text-[7px] px-2 py-0.5 rounded-full" style={{ backgroundColor: color.secondary, color: color.primary }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // TEMPLATE SELECTION SCREEN
  // ============================================================================

  const TemplateSelection = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              <span className="text-sm">{t.back}</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">{t.chooseTemplate}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t.chooseTemplateDesc}</p>
          </div>

          <div className="shrink-0 flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setTemplateView('grid')}
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                templateView === 'grid' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isRTL ? 'عرض شبكي' : 'Grid view'}
              aria-label={isRTL ? 'عرض شبكي' : 'Grid view'}
            >
              <LayoutGrid className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setTemplateView('list')}
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                templateView === 'list' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isRTL ? 'عرض قائمة' : 'List view'}
              aria-label={isRTL ? 'عرض قائمة' : 'List view'}
            >
              <List className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {templateView === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {CV_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedTemplate.id === template.id
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
                onClick={() => handleTemplateCardClick(template)}
                aria-label={isRTL ? `اختيار قالب ${template.nameAr}` : `Select template ${template.name}`}
              >
                {template.recommended && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg">
                    <Star className="w-3 h-3 fill-current" />
                    {t.recommended}
                  </div>
                )}

                <div className="relative bg-gray-100 dark:bg-gray-800 h-[320px] overflow-hidden flex items-start justify-center">
                  <div className="pt-2">
                    <TemplatePreview
                      template={template}
                      colorIndex={selectedTemplate.id === template.id ? selectedColorIndex : 0}
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                    <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold">
                      {t.startWithTemplate}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-background">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-lg text-foreground truncate">
                      {isRTL ? template.nameAr : template.name}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t.modern}
                      </span>
                      {template.isATS && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-xs font-medium text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {t.ats}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {template.colors.map((color, idx) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectTemplate(template);
                          setSelectedColorIndex(idx);
                        }}
                        className={`w-7 h-7 rounded-full transition-all ${
                          selectedTemplate.id === template.id && selectedColorIndex === idx
                            ? 'ring-2 ring-offset-2 ring-offset-background ring-purple-500 scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color.primary }}
                        title={color.id}
                        aria-label={color.id}
                      >
                        {selectedTemplate.id === template.id && selectedColorIndex === idx && (
                          <Check className="w-4 h-4 text-white mx-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 pt-4">
            {CV_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedTemplate.id === template.id
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
                onClick={() => handleTemplateCardClick(template)}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="w-[120px] h-[84px] rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-start justify-center shrink-0">
                    <div className="pt-2">
                      <TemplatePreview
                        template={template}
                        colorIndex={selectedTemplate.id === template.id ? selectedColorIndex : 0}
                        mini
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-base text-foreground truncate">{isRTL ? template.nameAr : template.name}</h3>
                      {template.recommended && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {t.recommended}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 rounded-full bg-white/10 text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t.modern}
                      </span>
                      {template.isATS && (
                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {t.ats}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {template.colors.slice(0, 7).map((color, idx) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTemplate(template);
                            setSelectedColorIndex(idx);
                          }}
                          className={`w-6 h-6 rounded-full transition-all ${
                            selectedTemplate.id === template.id && selectedColorIndex === idx
                              ? 'ring-2 ring-offset-2 ring-offset-background ring-purple-500 scale-110'
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color.primary }}
                          title={color.id}
                          aria-label={color.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent" />
        <div className="relative px-4 pb-4 pt-3">
          <div className="max-w-lg mx-auto">
            <Button
              onClick={() => setStep('method')}
              className="w-full h-14 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
              title={t.startWithTemplate}
            >
              <span className="truncate">
                {t.startWithTemplate}
                {selectedTemplate ? ` — ${isRTL ? selectedTemplate.nameAr : selectedTemplate.name}` : ''}
              </span>
              <ArrowRight className={`w-5 h-5 ml-2 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // SCREEN 2 - CREATE METHOD
  // =========================================================================

  const CreateMethod = () => (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <button
          onClick={() => setStep('templates')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          title={t.back}
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span className="text-sm">{t.back}</span>
        </button>

        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {isRTL ? 'كيف تريد إنشاء سيرتك الذاتية؟' : 'How would you like to create your resume?'}
          </h1>
        </div>
      </div>

      <div className="flex-1 px-4 pt-2 pb-10">
        <div className="max-w-xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <button
              type="button"
              onClick={() => setStep('builder')}
              className="group w-full text-left rounded-3xl bg-background border border-white/10 hover:border-purple-500/40 shadow-sm hover:shadow-lg transition-all p-6"
              title={isRTL ? 'ابدأ من الصفر' : 'Start from scratch'}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 border border-purple-500/20 flex items-center justify-center mb-5">
                <FileText className="w-8 h-8" style={{ color: '#2563eb' }} />
              </div>
              <div className="text-lg font-bold text-foreground mb-1">
                {isRTL ? 'ابدأ من الصفر' : 'Start from scratch'}
              </div>
              <div className="text-sm text-muted-foreground">
                {isRTL ? 'مساعدنا الذكي سيرشدك خطوة بخطوة' : 'Our AI helper will guide you'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="group w-full text-left rounded-3xl bg-background border border-white/10 hover:border-purple-500/40 shadow-sm hover:shadow-lg transition-all p-6 disabled:opacity-70"
              title={isRTL ? 'لدي سيرة ذاتية بالفعل' : 'I already have a resume'}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 border border-purple-500/20 flex items-center justify-center mb-5">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2563eb' }} />
                ) : (
                  <Upload className="w-8 h-8" style={{ color: '#2563eb' }} />
                )}
              </div>
              <div className="text-lg font-bold text-foreground mb-1">
                {isRTL ? 'لدي سيرة ذاتية بالفعل' : 'I already have a resume'}
              </div>
              <div className="text-sm text-muted-foreground">
                {isRTL ? 'ارفع ملفك (.pdf, .word)' : 'Upload your document (.pdf, .word)'}
              </div>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
            title={t.uploadCV}
            aria-label={t.uploadCV}
          />
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // BUILDER COMPONENTS
  // ============================================================================

  const SectionHead = ({ title, icon, k, count, onAdd }: { title: string; icon: React.ReactNode; k: string; count?: number; onAdd?: () => void }) => (
    <div className="flex items-center justify-between py-4 px-1">
      <button onClick={() => toggle(k)} className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${currentColor.primary}20`, color: currentColor.primary }}>{icon}</div>
        <div className="text-left"><h3 className="font-semibold text-foreground">{title}</h3>{count !== undefined && count > 0 && <p className="text-xs text-muted-foreground">{count} items</p>}</div>
        {expanded.has(k) ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {onAdd && <button onClick={onAdd} className="p-2 rounded-lg hover:bg-white/10" style={{ color: currentColor.primary }} title="Add"><Plus className="w-5 h-5" /></button>}
    </div>
  );

  const LuxInput = ({ label, value, onChange, placeholder, type = 'text', icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">{icon}{label}</label>
    </div>
  );

  const PersonalDetailsSection = () => {
    const debounceTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
    
    const handleInputChange = (field: keyof PersonalInfo, value: string) => {
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      debounceTimers.current[field] = setTimeout(() => {
        setCvData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
      }, 500);
    };
    
    return (
      <div className="space-y-6">
        {/* Section Header with AI Badge */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-white/10">
          <div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{isRTL ? 'التفاصيل الشخصية' : 'Personal Details'}</h3>
            <p className="text-sm text-muted-foreground mt-1">{isRTL ? 'معلوماتك الأساسية' : 'Your basic information'}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-bold text-purple-300">{isRTL ? 'مدعوم بالذكاء الاصطناعي' : 'AI Powered'}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide">{t.fullName}</label>
            <input 
              type="text"
              defaultValue={cvData.personalInfo.fullName}
              onInput={(e) => handleInputChange('fullName', (e.target as HTMLInputElement).value)} 
              placeholder={t.fullName} 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide">{t.jobTitle}</label>
            <input 
              type="text"
              defaultValue={cvData.personalInfo.jobTitle}
              onInput={(e) => handleInputChange('jobTitle', (e.target as HTMLInputElement).value)} 
              placeholder={t.jobTitle} 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
      </div>
    );
  };

  const ContactInfoSection = () => {
    const debounceTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
    
    const handleInputChange = (field: keyof PersonalInfo, value: string) => {
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      debounceTimers.current[field] = setTimeout(() => {
        setCvData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
      }, 500);
    };
    
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><Mail className="w-4 h-4 opacity-60" />{t.email}</label>
            <input 
              type="email" 
              defaultValue={cvData.personalInfo.email}
              onInput={(e) => handleInputChange('email', (e.target as HTMLInputElement).value)} 
              placeholder={t.email} 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><Phone className="w-4 h-4 opacity-60" />{t.phone}</label>
            <input 
              type="tel" 
              defaultValue={cvData.personalInfo.phone}
              onInput={(e) => handleInputChange('phone', (e.target as HTMLInputElement).value)} 
              placeholder={t.phone} 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><MapPin className="w-4 h-4 opacity-60" />{t.location}</label>
          <input 
            type="text"
            defaultValue={cvData.personalInfo.location}
            onInput={(e) => handleInputChange('location', (e.target as HTMLInputElement).value)} 
            placeholder={t.location} 
            className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><Linkedin className="w-4 h-4 opacity-60" />{t.linkedin}</label>
            <input 
              type="text"
              defaultValue={cvData.personalInfo.linkedin}
              onInput={(e) => handleInputChange('linkedin', (e.target as HTMLInputElement).value)} 
              placeholder="linkedin.com/in/yourname" 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><Globe className="w-4 h-4 opacity-60" />{t.website}</label>
            <input 
              type="text"
              defaultValue={cvData.personalInfo.website}
              onInput={(e) => handleInputChange('website', (e.target as HTMLInputElement).value)} 
              placeholder="yourwebsite.com" 
              className="w-full h-14 px-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl font-semibold transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
      </div>
    );
  };

  function PersonalSection() {
    return (
      <div className="space-y-6 pb-4">
        <PersonalDetailsSection />
        <ContactInfoSection />
        <ProfessionalSummarySection />
      </div>
    );
  }

  const ProfessionalSummarySection = () => {
    const debounceTimer = useRef<NodeJS.Timeout>();
    
    const handleInputChange = (value: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        setCvData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, summary: value } }));
      }, 500);
    };
    
    return (
      <div className="space-y-2.5">
        <label className="text-sm font-bold text-muted-foreground tracking-wide flex items-center gap-2"><FileText className="w-4 h-4 opacity-60" />{t.summary}</label>
        <textarea 
          defaultValue={cvData.personalInfo.summary}
          onInput={(e) => handleInputChange((e.target as HTMLTextAreaElement).value)} 
          placeholder={isRTL ? 'نبذة مختصرة عن خبرتك...' : 'Brief overview of your experience...'} 
          className="w-full min-h-[160px] p-5 bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.05] border-2 border-white/20 focus:border-white/40 hover:border-white/30 rounded-2xl resize-none font-semibold leading-relaxed transition-all duration-300 outline-none text-foreground placeholder:text-muted-foreground/60 shadow-lg hover:shadow-xl focus:shadow-2xl backdrop-blur-sm" 
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}
        />
      </div>
    );
  };

  const ExpItem = ({ exp, i }: { exp: Experience; i: number }) => (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border-2 border-white/10 space-y-4 shadow-lg">
      <div className="flex items-center justify-between"><span className="text-sm font-black tracking-wide" style={{ color: currentColor.primary }}>{isRTL ? `الخبرة ${i + 1}` : `Experience ${i + 1}`}</span><button onClick={() => removeExp(exp.id)} className="p-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-all" title={t.remove}><Trash2 className="w-4 h-4" /></button></div>
      <div className="grid grid-cols-2 gap-4"><Input value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)} placeholder={t.company} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /><Input value={exp.position} onChange={e => updateExp(exp.id, 'position', e.target.value)} placeholder={t.position} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /></div>
      <Input value={exp.location} onChange={e => updateExp(exp.id, 'location', e.target.value)} placeholder={t.location} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" />
      <div className="grid grid-cols-2 gap-4"><Input type="month" value={exp.startDate} onChange={e => updateExp(exp.id, 'startDate', e.target.value)} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /><Input type="month" value={exp.endDate} onChange={e => updateExp(exp.id, 'endDate', e.target.value)} disabled={exp.current} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all disabled:opacity-50" /></div>
      <label className="flex items-center gap-2.5 cursor-pointer" htmlFor={`current-${exp.id}`}><input type="checkbox" checked={exp.current} onChange={e => updateExp(exp.id, 'current', e.target.checked)} className="w-5 h-5 rounded-lg" id={`current-${exp.id}`} /><span className="text-sm font-semibold text-muted-foreground">{t.currentlyWorking}</span></label>
      <Textarea value={exp.description} onChange={e => updateExp(exp.id, 'description', e.target.value)} placeholder={isRTL ? 'صف مسؤولياتك...' : 'Describe your responsibilities...'} className="min-h-[100px] bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl resize-none font-medium leading-relaxed transition-all" />
    </div>
  );

  const EduItem = ({ edu, i }: { edu: Education; i: number }) => (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border-2 border-white/10 space-y-4 shadow-lg">
      <div className="flex items-center justify-between"><span className="text-sm font-black tracking-wide" style={{ color: currentColor.primary }}>{isRTL ? `التعليم ${i + 1}` : `Education ${i + 1}`}</span><button onClick={() => removeEdu(edu.id)} className="p-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-all" title={t.remove}><Trash2 className="w-4 h-4" /></button></div>
      <Input value={edu.institution} onChange={e => updateEdu(edu.id, 'institution', e.target.value)} placeholder={t.institution} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" />
      <div className="grid grid-cols-2 gap-4"><Input value={edu.degree} onChange={e => updateEdu(edu.id, 'degree', e.target.value)} placeholder={t.degree} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /><Input value={edu.field} onChange={e => updateEdu(edu.id, 'field', e.target.value)} placeholder={t.field} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /></div>
      <div className="grid grid-cols-2 gap-4"><Input type="month" value={edu.startDate} onChange={e => updateEdu(edu.id, 'startDate', e.target.value)} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /><Input type="month" value={edu.endDate} onChange={e => updateEdu(edu.id, 'endDate', e.target.value)} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl font-medium transition-all" /></div>
    </div>
  );

  const SkillsSection = () => (
    <div className="space-y-3 pb-4">
      {cvData.skills.map(s => (
        <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-white/[0.08] to-white/[0.05] border-2 border-white/10 shadow-lg">
          <Input value={s.name} onChange={e => updateSkill(s.id, 'name', e.target.value)} placeholder={t.skillName} className="h-12 bg-white/10 border-2 border-white/10 focus:border-white/30 rounded-xl flex-1 font-medium transition-all" />
          <select value={s.level} onChange={e => updateSkill(s.id, 'level', e.target.value)} className="h-12 px-4 rounded-xl bg-white/10 border-2 border-white/10 text-sm font-bold transition-all focus:border-white/30" title={isRTL ? 'مستوى المهارة' : 'Skill level'} aria-label={isRTL ? 'مستوى المهارة' : 'Skill level'}>
            <option value="beginner">{isRTL ? 'مبتدئ' : 'Beginner'}</option><option value="intermediate">{isRTL ? 'متوسط' : 'Intermediate'}</option><option value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</option><option value="expert">{isRTL ? 'خبير' : 'Expert'}</option>
          </select>
          <button onClick={() => removeSkill(s.id)} className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-all" title={t.remove}><X className="w-4 h-4" /></button>
        </div>
      ))}
      {cvData.skills.length === 0 && <p className="text-center text-muted-foreground py-6 italic opacity-60">{isRTL ? 'لم تضف أي مهارات' : 'No skills added'}</p>}
    </div>
  );

  const AddMenu = () => (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddMenu(false)}>
      <div className="w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h3 className="text-xl font-bold text-center mb-6">{t.addSection}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[{ fn: addExp, label: t.experience, icon: <Briefcase className="w-5 h-5" />, color: 'from-blue-500 to-cyan-500' },
            { fn: addEdu, label: t.education, icon: <GraduationCap className="w-5 h-5" />, color: 'from-purple-500 to-pink-500' },
            { fn: addSkill, label: t.skills, icon: <Award className="w-5 h-5" />, color: 'from-emerald-500 to-teal-500' }]
            .map(({ fn, label, icon, color }) => (
              <button key={label} onClick={() => { setShowAddMenu(false); fn(); }} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white`}>{icon}</div>
                <span className="font-medium">{label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );

  const Builder = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={() => setStep('templates')} className="p-2 rounded-xl hover:bg-white/10" title={t.back}><ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} /></button>
        <div className="text-center">
          <h2 className="font-semibold">{isRTL ? selectedTemplate.nameAr : selectedTemplate.name}</h2>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {selectedTemplate.colors.slice(0, 5).map((c, i) => (
              <button key={c.id} onClick={() => setSelectedColorIndex(i)} className={`w-4 h-4 rounded-full ${selectedColorIndex === i ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c.primary }} title={c.id} />
            ))}
          </div>
        </div>
        <button onClick={() => setStep('preview')} className="p-2 rounded-xl hover:bg-white/10" style={{ backgroundColor: `${currentColor.primary}20`, color: currentColor.primary }} title={t.preview}><Eye className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="border-b border-white/10"><SectionHead title={t.personalInfo} icon={<User className="w-5 h-5" />} k="personalInfo" />{expanded.has('personalInfo') && <PersonalSection />}</div>
        {cvData.experience.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.experience} icon={<Briefcase className="w-5 h-5" />} k="experience" count={cvData.experience.length} onAdd={addExp} />{expanded.has('experience') && <div className="space-y-4 pb-4">{cvData.experience.map((e, i) => <ExpItem key={e.id} exp={e} i={i} />)}</div>}</div>}
        {cvData.education.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.education} icon={<GraduationCap className="w-5 h-5" />} k="education" count={cvData.education.length} onAdd={addEdu} />{expanded.has('education') && <div className="space-y-4 pb-4">{cvData.education.map((e, i) => <EduItem key={e.id} edu={e} i={i} />)}</div>}</div>}
        {cvData.skills.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.skills} icon={<Award className="w-5 h-5" />} k="skills" count={cvData.skills.length} onAdd={addSkill} />{expanded.has('skills') && <SkillsSection />}</div>}
      </div>
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10">
        <Button onClick={() => setShowAddMenu(true)} className="w-full h-14 rounded-xl border-2 border-dashed font-semibold" style={{ borderColor: `${currentColor.primary}60`, backgroundColor: `${currentColor.primary}10`, color: currentColor.primary }}><Plus className="w-5 h-5 mr-2" />{t.addSection}</Button>
      </div>
      {showAddMenu && <AddMenu />}
    </div>
  );

  // =========================================================================
  // SCREEN 3 - BUILDER (Stepper + Live Preview + Mobile Popup Editor)
  // =========================================================================

  type BuilderStepKey = 'personal' | 'contact' | 'experience' | 'skills' | 'education' | 'summary' | 'review' | 'add';
  const builderSteps = useMemo(() => ([
    { key: 'personal' as const, label: isRTL ? 'البيانات الشخصية' : 'Personal details' },
    { key: 'contact' as const, label: isRTL ? 'معلومات التواصل' : 'Contact info' },
    { key: 'experience' as const, label: isRTL ? 'الخبرة العملية' : 'Work experience' },
    { key: 'skills' as const, label: isRTL ? 'المهارات' : 'Skills' },
    { key: 'education' as const, label: isRTL ? 'التعليم' : 'Education' },
    { key: 'summary' as const, label: isRTL ? 'الملخص المهني' : 'Professional summary' },
    { key: 'review' as const, label: isRTL ? 'مراجعة وحفظ' : 'Review & Save' },
    { key: 'add' as const, label: isRTL ? 'إضافة قسم' : 'Add section' },
  ]), [isRTL]);

  const [builderStepKey, setBuilderStepKey] = useState<BuilderStepKey>('personal');
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false);

  const openStep = (key: BuilderStepKey) => {
    if (key === 'add') {
      setShowAddMenu(true);
      return;
    }
    setBuilderStepKey(key);
    if (isMobile) setMobileEditorOpen(true);
  };

  const nextStep = () => {
    const i = builderSteps.findIndex(s => s.key === builderStepKey);
    if (i === -1) return;
    const next = builderSteps[Math.min(i + 1, builderSteps.length - 1)]?.key as BuilderStepKey;
    if (next === 'add') {
      setShowAddMenu(true);
      return;
    }
    setBuilderStepKey(next);
  };

  const handleSaveCV = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first', variant: 'destructive' });
        return;
      }

      const cvToSave = {
        user_id: user.id,
        template_id: selectedTemplate.id,
        color_index: selectedColorIndex,
        data: cvData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to localStorage
      const savedCVs = JSON.parse(localStorage.getItem('wakti_saved_cvs') || '[]');
      savedCVs.push(cvToSave);
      localStorage.setItem('wakti_saved_cvs', JSON.stringify(savedCVs));

      toast({ title: isRTL ? 'تم حفظ السيرة الذاتية بنجاح!' : 'CV saved successfully!' });
    } catch (error) {
      console.error('Error saving CV:', error);
      toast({ title: isRTL ? 'فشل حفظ السيرة الذاتية' : 'Failed to save CV', variant: 'destructive' });
    }
  };

  const renderEditor = () => {
    if (builderStepKey === 'personal') return <PersonalDetailsSection />;
    if (builderStepKey === 'contact') return <ContactInfoSection />;
    if (builderStepKey === 'review') {
      const previewData = {
        name: cvData.personalInfo.fullName || (isRTL ? 'اسمك هنا' : 'Your Name'),
        title: cvData.personalInfo.jobTitle || (isRTL ? 'المسمى الوظيفي' : 'Job title'),
        email: cvData.personalInfo.email || 'email@example.com',
        phone: cvData.personalInfo.phone || '+1 (555) 000-0000',
        location: cvData.personalInfo.location || (isRTL ? 'الموقع' : 'Location'),
        summary: cvData.personalInfo.summary || (isRTL ? 'اكتب ملخصاً قصيراً هنا...' : 'Write a short summary here...'),
        experience: cvData.experience.length > 0 ? cvData.experience.map(e => ({
          company: e.company || (isRTL ? 'شركة' : 'Company'),
          position: e.position || (isRTL ? 'منصب' : 'Position'),
          date: e.current ? (isRTL ? 'حتى الآن' : 'Present') : (e.endDate || '2024')
        })) : [{ company: isRTL ? 'شركة' : 'Company', position: isRTL ? 'منصب' : 'Position', date: '2024' }],
        education: cvData.education.length > 0 ? cvData.education.map(e => ({
          school: e.institution || (isRTL ? 'مؤسسة' : 'Institution'),
          degree: e.degree || (isRTL ? 'درجة' : 'Degree'),
          date: e.endDate || '2024'
        })) : [{ school: isRTL ? 'مؤسسة' : 'Institution', degree: isRTL ? 'درجة' : 'Degree', date: '2024' }],
        skills: cvData.skills.length > 0 ? cvData.skills.map(s => s.name).filter(Boolean) : [isRTL ? 'مهارة' : 'Skill']
      };
      
      return (
        <div className="space-y-6 pb-8">
          {/* Final Review Header */}
          <div className="text-center pb-6 border-b-2 border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-3xl font-black text-foreground mb-2">{isRTL ? 'سيرتك الذاتية جاهزة!' : 'Your CV is Ready!'}</h3>
            <p className="text-muted-foreground">{isRTL ? 'راجع التفاصيل واحفظ أو حمّل سيرتك الذاتية' : 'Review the details and save or download your CV'}</p>
          </div>

          {/* Full Preview */}
          <div className="rounded-3xl border-2 border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 overflow-hidden">
            <div className="flex justify-center">
              <div className="transform scale-90 origin-top">
                <TemplatePreviewWithData template={selectedTemplate} colorIndex={selectedColorIndex} data={previewData} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <button
              onClick={handleSaveCV}
              className="h-14 px-6 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 border-2 border-white/20 text-base font-bold text-foreground hover:from-white/15 hover:to-white/10 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {isRTL ? 'حفظ السيرة الذاتية' : 'Save CV'}
            </button>
            <button
              className="h-14 px-6 rounded-2xl text-white text-base font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 24px ${currentColor.primary}40` }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isRTL ? 'تحميل PDF' : 'Download PDF'}
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 text-center">
              <div className="text-2xl font-black" style={{ color: currentColor.primary }}>{cvData.experience.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'خبرات' : 'Experiences'}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 text-center">
              <div className="text-2xl font-black" style={{ color: currentColor.primary }}>{cvData.skills.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'مهارات' : 'Skills'}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 text-center">
              <div className="text-2xl font-black" style={{ color: currentColor.primary }}>{cvData.education.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'شهادات' : 'Education'}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 text-center">
              <div className="text-2xl font-black" style={{ color: currentColor.primary }}>{Math.round((Object.values(cvData.personalInfo).filter(v => v).length / 8) * 100)}%</div>
              <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'مكتمل' : 'Complete'}</div>
            </div>
          </div>
        </div>
      );
    }
    if (builderStepKey === 'experience') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{t.experience}</div>
            <Button type="button" onClick={addExp} className="h-10 px-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
              <Plus className="w-4 h-4 mr-2" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
          {cvData.experience.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-muted-foreground">
              {isRTL ? 'لا توجد خبرات بعد' : 'No experience added yet'}
            </div>
          ) : (
            <div className="space-y-4">{cvData.experience.map((e, i) => <ExpItem key={e.id} exp={e} i={i} />)}</div>
          )}
        </div>
      );
    }
    if (builderStepKey === 'skills') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{t.skills}</div>
            <Button type="button" onClick={addSkill} className="h-10 px-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
              <Plus className="w-4 h-4 mr-2" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
          <SkillsSection />
        </div>
      );
    }
    if (builderStepKey === 'education') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{t.education}</div>
            <Button type="button" onClick={addEdu} className="h-10 px-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
              <Plus className="w-4 h-4 mr-2" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
          {cvData.education.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-muted-foreground">
              {isRTL ? 'لا يوجد تعليم بعد' : 'No education added yet'}
            </div>
          ) : (
            <div className="space-y-4">{cvData.education.map((e, i) => <EduItem key={e.id} edu={e} i={i} />)}</div>
          )}
        </div>
      );
    }
    return <ProfessionalSummarySection />;
  };

  const PreviewPanel = () => {
    // Create preview data from user's CV data
    const previewData = {
      name: cvData.personalInfo.fullName || (isRTL ? 'اسمك هنا' : 'Your Name'),
      title: cvData.personalInfo.jobTitle || (isRTL ? 'المسمى الوظيفي' : 'Job title'),
      email: cvData.personalInfo.email || 'email@example.com',
      phone: cvData.personalInfo.phone || '+1 (555) 000-0000',
      location: cvData.personalInfo.location || (isRTL ? 'الموقع' : 'Location'),
      summary: cvData.personalInfo.summary || (isRTL ? 'اكتب ملخصاً قصيراً هنا...' : 'Write a short summary here...'),
      experience: cvData.experience.length > 0 ? cvData.experience.map(e => ({
        company: e.company || (isRTL ? 'شركة' : 'Company'),
        position: e.position || (isRTL ? 'منصب' : 'Position'),
        date: e.current ? (isRTL ? 'حتى الآن' : 'Present') : (e.endDate || '2024')
      })) : [{ company: isRTL ? 'شركة' : 'Company', position: isRTL ? 'منصب' : 'Position', date: '2024' }],
      education: cvData.education.length > 0 ? cvData.education.map(e => ({
        school: e.institution || (isRTL ? 'مؤسسة' : 'Institution'),
        degree: e.degree || (isRTL ? 'درجة' : 'Degree'),
        date: e.endDate || '2024'
      })) : [{ school: isRTL ? 'مؤسسة' : 'Institution', degree: isRTL ? 'درجة' : 'Degree', date: '2024' }],
      skills: cvData.skills.length > 0 ? cvData.skills.map(s => s.name).filter(Boolean) : [isRTL ? 'مهارة' : 'Skill']
    };

    return (
      <div className="h-full rounded-3xl border-2 border-white/5 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-white/[0.02] backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${currentColor.primary}25, ${currentColor.accent}15)`, border: `1px solid ${currentColor.primary}20` }}>
                <Eye className="w-5 h-5" style={{ color: currentColor.primary }} />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{isRTL ? 'معاينة حية' : 'Live Preview'}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? selectedTemplate.nameAr : selectedTemplate.name}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChangeTemplateOpen(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-xs font-bold text-foreground hover:from-white/15 hover:to-white/10 transition-all shadow-lg hover:shadow-xl"
              title={isRTL ? 'تغيير القالب' : 'Change template'}
            >
              {isRTL ? 'تغيير القالب' : 'Change template'}
            </button>
          </div>
        </div>
        <div className="p-5 flex justify-center items-start overflow-y-auto">
          <TemplatePreviewWithData template={selectedTemplate} colorIndex={selectedColorIndex} data={previewData} />
        </div>
      </div>
    );
  };

  const BuilderV2 = () => (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b-2 border-white/10 bg-gradient-to-r from-white/[0.05] via-white/[0.02] to-white/[0.05] backdrop-blur-xl flex items-center justify-between shadow-lg">
        <button onClick={() => setStep('method')} className="p-2.5 rounded-xl hover:bg-white/10 transition-all" title={t.back}>
          <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <div className="text-center">
          <div className="text-lg font-black text-foreground bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">{isRTL ? 'سيرتك الذاتية' : 'Your resume'}</div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="text-xs font-semibold text-muted-foreground">{isRTL ? selectedTemplate.nameAr : selectedTemplate.name}</div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <div className="text-xs font-bold" style={{ color: currentColor.primary }}>{Math.round((Object.values(cvData.personalInfo).filter(v => v).length / 8) * 100)}% {isRTL ? 'مكتمل' : 'Complete'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-11 px-5 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border-2 border-white/20 text-xs font-bold text-foreground hover:from-white/15 hover:to-white/10 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95" title={isRTL ? 'مشاركة' : 'Share'}>
            {isRTL ? 'مشاركة' : 'Share'}
          </button>
          <button className="h-11 px-5 rounded-xl text-white text-xs font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 24px ${currentColor.primary}40` }} title={t.download}>
            {isRTL ? 'تحميل' : 'Download'}
          </button>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      {isMobile ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Mobile Stepper - Horizontal scroll */}
          <div className="shrink-0 px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {builderSteps.map((s, idx) => {
                const active = s.key === builderStepKey;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => openStep(s.key)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all ${
                      active ? 'bg-white/15 border-2 shadow-lg' : 'bg-white/5 border border-white/10'
                    }`}
                    style={{ borderColor: active ? `${currentColor.primary}60` : undefined }}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                        active ? 'text-white' : 'text-muted-foreground'
                      }`}
                      style={{ 
                        background: active ? `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      {s.key === 'add' ? '+' : idx + 1}
                    </div>
                    <span className={`text-xs font-bold whitespace-nowrap ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Preview */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <PreviewPanel />
          </div>
        </div>
      ) : (
        /* DESKTOP LAYOUT */
        <div className="flex-1 overflow-hidden px-6 py-6">
          <div className="h-full grid grid-cols-12 gap-6">
            {/* Left Stepper */}
            <div className="col-span-3">
              <div className="rounded-3xl border-2 border-white/5 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-white/[0.02] backdrop-blur-xl p-4 h-full overflow-y-auto shadow-2xl">
                <div className="space-y-1 relative">
                  {builderSteps.map((s, idx) => {
                    const active = s.key === builderStepKey;
                    const isLast = idx === builderSteps.length - 1;
                    return (
                      <div key={s.key} className="relative">
                        <button
                          type="button"
                          onClick={() => openStep(s.key)}
                          className={`w-full flex items-center gap-4 p-3.5 rounded-2xl text-left transition-all relative z-10 ${
                            active ? 'bg-gradient-to-r from-white/15 to-white/10 border-2 shadow-xl' : 'hover:bg-white/5'
                          }`}
                          style={{ borderColor: active ? `${currentColor.primary}40` : 'transparent' }}
                          title={s.label}
                        >
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shadow-lg transition-all ${
                              active ? 'text-white scale-110' : 'text-muted-foreground'
                            }`}
                            style={{ 
                              background: active ? `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` : 'rgba(255,255,255,0.08)',
                              boxShadow: active ? `0 8px 24px ${currentColor.primary}50` : 'none'
                            }}
                          >
                            {s.key === 'add' ? '+' : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</div>
                            {active && <div className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'جاري التحرير' : 'Editing'}</div>}
                          </div>
                        </button>
                        {!isLast && <div className="absolute left-8 top-14 w-0.5 h-4 bg-gradient-to-b from-white/20 to-transparent z-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Center Form */}
            <div className="col-span-6">
              <div className="rounded-3xl border-2 border-white/5 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-white/[0.02] backdrop-blur-xl h-full flex flex-col shadow-2xl">
                <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-5 border-b border-white/10">
                  <div className="text-2xl font-black text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    {builderSteps.find(s => s.key === builderStepKey)?.label}
                  </div>
                  {builderStepKey !== 'review' && (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="h-12 px-6 rounded-2xl text-white font-black shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                      style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 32px ${currentColor.primary}40` }}
                    >
                      {isRTL ? 'التالي' : 'Next'}
                      <ArrowRight className={`w-5 h-5 ml-2 ${isRTL ? 'rotate-180' : ''}`} />
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {renderEditor()}
                </div>
              </div>
            </div>

            {/* Right Preview */}
            <div className="col-span-3">
            <PreviewPanel />
          </div>
        </div>
      </div>
      )}

      {/* Mobile Editor Popup */}
      {isMobile && mobileEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setMobileEditorOpen(false)}>
          <div className="w-full bg-background rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold text-foreground">
                {builderSteps.find(s => s.key === builderStepKey)?.label}
              </div>
              <button
                type="button"
                onClick={() => setMobileEditorOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center"
                title={isRTL ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {renderEditor()}
            </div>
            <div className="mt-5">
              <Button
                type="button"
                onClick={() => {
                  nextStep();
                  setMobileEditorOpen(false);
                }}
                className="w-full h-12 rounded-2xl text-white font-semibold"
                style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}
              >
                {isRTL ? 'التالي' : 'Next'}
                <ArrowRight className={`w-4 h-4 ml-2 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Template (Placeholder modal) */}
      {changeTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setChangeTemplateOpen(false)}>
          <div className="w-full max-w-md bg-background rounded-3xl border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold text-foreground">{isRTL ? 'تغيير القالب' : 'Change template'}</div>
              <button className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center" onClick={() => setChangeTemplateOpen(false)} title={isRTL ? 'إغلاق' : 'Close'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground">
              {isRTL ? 'سنضيف اختيار القوالب هنا لاحقاً (مودال).' : 'We will add the template picker here later (modal).'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const Preview = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={() => setStep('builder')} className="p-2 rounded-xl hover:bg-white/10" title={t.back}><ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} /></button>
        <h2 className="font-semibold">{t.preview}</h2>
        <button onClick={() => onComplete(cvData)} className="px-4 py-2 rounded-xl text-white font-medium text-sm" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>{t.download}</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex justify-center">
        <div className="w-full max-w-md">
          <TemplatePreview template={selectedTemplate} colorIndex={selectedColorIndex} />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-purple-500/5 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {step === 'templates' && <TemplateSelection />}
      {step === 'method' && <CreateMethod />}
      {step === 'builder' && <BuilderV2 />}
      {step === 'preview' && <Preview />}
    </div>
  );
};

export default CVBuilderWizard;
