import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import ShareButton from '@/components/ui/ShareButton';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  ArrowLeft, Upload, User, Briefcase, GraduationCap, Award,
  Plus, X, Trash2, Mail, Phone, MapPin, Linkedin, Globe, FileText,
  Loader2, Eye, ChevronDown, ChevronUp, ArrowRight, Star, Check, LayoutGrid, List, Share2, Download, Sparkles,
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

// Standard color palette for all templates
const STANDARD_COLORS = [
  { id: 'blue', primary: '#1e88e5', secondary: '#e3f2fd', accent: '#0d47a1', bg: '#f5f9ff' },
  { id: 'navy', primary: '#1e3a5f', secondary: '#e8eef4', accent: '#0f2744', bg: '#ffffff' },
  { id: 'black', primary: '#212121', secondary: '#f5f5f5', accent: '#000000', bg: '#ffffff' },
  { id: 'purple', primary: '#7c3aed', secondary: '#ede9fe', accent: '#5b21b6', bg: '#faf5ff' },
  { id: 'violet', primary: '#8b5cf6', secondary: '#f3e8ff', accent: '#7c3aed', bg: '#faf5ff' },
  { id: 'pink', primary: '#ec4899', secondary: '#fce7f3', accent: '#be185d', bg: '#fdf2f8' },
  { id: 'rose', primary: '#f43f5e', secondary: '#fff1f2', accent: '#e11d48', bg: '#fff1f2' },
  { id: 'orange', primary: '#f97316', secondary: '#ffedd5', accent: '#ea580c', bg: '#fff7ed' },
  { id: 'yellow', primary: '#f59e0b', secondary: '#fef3c7', accent: '#d97706', bg: '#fffbeb' },
  { id: 'lime', primary: '#84cc16', secondary: '#ecfccb', accent: '#65a30d', bg: '#f7fee7' },
  { id: 'green', primary: '#10b981', secondary: '#d1fae5', accent: '#059669', bg: '#ecfdf5' },
  { id: 'teal', primary: '#14b8a6', secondary: '#ccfbf1', accent: '#0d9488', bg: '#f0fdfa' },
  { id: 'cyan', primary: '#06b6d4', secondary: '#cffafe', accent: '#0891b2', bg: '#ecfeff' },
];

const CV_TEMPLATES: CVTemplate[] = [
  // TEMPLATE 1: Sidney - Sidebar Left (Popular)
  {
    id: 'sidney',
    name: 'Sidney',
    nameAr: 'سيدني',
    recommended: true,
    isATS: true,
    colors: STANDARD_COLORS,
    layout: 'sidebar-left',
  },
  // TEMPLATE 2: Dallas - Classic Header
  {
    id: 'dallas',
    name: 'Dallas',
    nameAr: 'دالاس',
    isATS: true,
    colors: STANDARD_COLORS,
    layout: 'classic',
  },
  // TEMPLATE 3: Valencia - Sidebar Left Professional
  {
    id: 'valencia',
    name: 'Valencia',
    nameAr: 'فالنسيا',
    colors: STANDARD_COLORS,
    layout: 'sidebar-left',
  },
  // TEMPLATE 4: Milano - Sidebar Right (Popular)
  {
    id: 'milano',
    name: 'Milano',
    nameAr: 'ميلانو',
    recommended: true,
    colors: STANDARD_COLORS,
    layout: 'sidebar-right',
  },
  // TEMPLATE 5: Helen - Minimal Clean
  {
    id: 'helen',
    name: 'Helen',
    nameAr: 'هيلين',
    isATS: true,
    colors: STANDARD_COLORS,
    layout: 'minimal',
  },
  // TEMPLATE 6: Skill-Based - Focus on Skills
  {
    id: 'skill-based',
    name: 'Skill-Based',
    nameAr: 'مهاراتي',
    colors: STANDARD_COLORS,
    layout: 'sidebar-left',
  },
  // TEMPLATE 7: Minimalist - Simple & Clean
  {
    id: 'minimalist',
    name: 'Minimalist',
    nameAr: 'بسيط',
    recommended: true,
    isATS: true,
    colors: STANDARD_COLORS,
    layout: 'minimal',
  },
  // TEMPLATE 8: Hybrid - Skills + Experience
  {
    id: 'hybrid',
    name: 'Hybrid',
    nameAr: 'هجين',
    colors: STANDARD_COLORS,
    layout: 'modern',
  },
  // TEMPLATE 9: Traditional - Classic Format
  {
    id: 'traditional',
    name: 'Traditional',
    nameAr: 'تقليدي',
    isATS: true,
    colors: STANDARD_COLORS,
    layout: 'classic',
  },
  // TEMPLATE 10: General - Versatile
  {
    id: 'general',
    name: 'General',
    nameAr: 'عام',
    colors: STANDARD_COLORS,
    layout: 'sidebar-left',
  },
  // TEMPLATE 11: IT Professional
  {
    id: 'it-pro',
    name: 'IT Pro',
    nameAr: 'تقني',
    colors: STANDARD_COLORS,
    layout: 'sidebar-right',
  },
  // TEMPLATE 12: Tech Modern
  {
    id: 'tech',
    name: 'Tech',
    nameAr: 'تكنولوجي',
    colors: STANDARD_COLORS,
    layout: 'modern',
  },
  // TEMPLATE 13: Combined - Best of Both
  {
    id: 'combined',
    name: 'Combined',
    nameAr: 'مدمج',
    recommended: true,
    colors: STANDARD_COLORS,
    layout: 'sidebar-right',
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

  const [step, setStep] = useState<'my-cvs' | 'templates' | 'method' | 'builder' | 'preview'>('my-cvs');
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
        
        // Build experience array from extracted data
        const extractedExperience: Experience[] = Array.isArray(ex.experience) 
          ? ex.experience.map((exp: { company?: string; position?: string; location?: string; startDate?: string; endDate?: string; description?: string }, i: number) => ({
              id: `e${Date.now()}_${i}`,
              company: exp.company || '',
              position: exp.position || '',
              location: exp.location || '',
              startDate: exp.startDate || '',
              endDate: exp.endDate || '',
              current: exp.endDate?.toLowerCase() === 'present' || exp.endDate?.toLowerCase() === 'current',
              description: exp.description || '',
            }))
          : [];
        
        // Build education array from extracted data
        const extractedEducation: Education[] = Array.isArray(ex.education)
          ? ex.education.map((edu: { school?: string; degree?: string; startDate?: string; endDate?: string; description?: string }, i: number) => ({
              id: `ed${Date.now()}_${i}`,
              school: edu.school || '',
              degree: edu.degree || '',
              startDate: edu.startDate || '',
              endDate: edu.endDate || '',
              description: edu.description || '',
            }))
          : [];
        
        // Build skills array from extracted data
        const extractedSkills: Skill[] = Array.isArray(ex.skills)
          ? ex.skills.map((skill: string, i: number) => ({
              id: `s${Date.now()}_${i}`,
              name: skill,
              level: 'intermediate' as const,
            }))
          : [];
        
        setCvData({
          personalInfo: {
            fullName: [ex.firstName, ex.lastName].filter(Boolean).join(' ') || '',
            email: ex.email || user?.email || '',
            phone: ex.phone || '',
            jobTitle: ex.experience?.[0]?.position || '',
            location: ex.location || '',
            linkedin: ex.linkedin || '',
            website: ex.website || '',
            summary: ex.summary || '',
          },
          experience: extractedExperience.length > 0 ? extractedExperience : [],
          education: extractedEducation.length > 0 ? extractedEducation : [],
          skills: extractedSkills.length > 0 ? extractedSkills : [],
        });
        
        toast({ title: t.extracted, description: t.extractedDesc });
        setStep('builder'); 
        setExpanded(new Set(['personalInfo', 'experience', 'education', 'skills']));
      } else { 
        toast({ title: t.extractFailed, description: t.extractFailedDesc, variant: 'destructive' }); 
        setStep('builder'); 
      }
    } catch { 
      toast({ title: t.extractFailed, description: t.extractFailedDesc, variant: 'destructive' }); 
      setStep('builder'); 
    }
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
    const scale = mini ? 'scale-[0.28]' : 'scale-[0.42]';
    const baseClass = `w-[400px] h-[566px] ${scale} origin-top-left bg-white rounded-lg shadow-lg overflow-hidden`;

    // ========== SIDNEY: Classic sidebar left with photo ==========
    if (template.id === 'sidney') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="w-[140px] h-full p-4 flex flex-col" style={{ backgroundColor: color.primary }}>
            <div className="w-20 h-20 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="text-white text-center mb-4">
              <div className="font-bold text-sm">{SAMPLE_DATA.name}</div>
              <div className="text-xs opacity-80">{SAMPLE_DATA.title}</div>
            </div>
            <div className="space-y-2 text-white/80 text-[8px]">
              <div className="flex items-center gap-1"><Mail className="w-2 h-2" />{SAMPLE_DATA.email}</div>
              <div className="flex items-center gap-1"><Phone className="w-2 h-2" />{SAMPLE_DATA.phone}</div>
            </div>
            <div className="mt-4">
              <div className="text-white font-bold text-[9px] mb-2">SKILLS</div>
              {SAMPLE_DATA.skills.slice(0, 4).map((s, i) => (
                <div key={i} className="text-[7px] text-white/90 bg-white/10 px-2 py-0.5 rounded mb-1">{s}</div>
              ))}
            </div>
          </div>
          <div className="flex-1 p-4" style={{ backgroundColor: color.bg }}>
            <div className="font-bold text-[10px] mb-1" style={{ color: color.primary }}>SUMMARY</div>
            <div className="text-[7px] text-gray-600 mb-3">{SAMPLE_DATA.summary}</div>
            <div className="font-bold text-[10px] mb-2" style={{ color: color.primary }}>EXPERIENCE</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="font-semibold text-[8px]">{exp.position}</div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ========== DALLAS: Classic header with colored banner ==========
    if (template.id === 'dallas') {
      return (
        <div className={baseClass}>
          <div className="p-4 text-center" style={{ backgroundColor: color.secondary }}>
            <div className="font-bold text-lg" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
            <div className="text-xs text-gray-600">{SAMPLE_DATA.title}</div>
            <div className="flex justify-center gap-3 mt-2 text-[7px] text-gray-500">
              <span>{SAMPLE_DATA.email}</span>
              <span>{SAMPLE_DATA.phone}</span>
            </div>
          </div>
          <div className="p-4">
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SUMMARY</div>
            <div className="text-[7px] text-gray-600 mb-3">{SAMPLE_DATA.summary}</div>
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>EXPERIENCE</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="font-semibold text-[8px]">{exp.position}</div>
                <div className="text-[7px] text-gray-500">{exp.company} | {exp.date}</div>
              </div>
            ))}
            <div className="font-bold text-[9px] border-b pb-1 mb-2" style={{ color: color.primary, borderColor: color.primary }}>SKILLS</div>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_DATA.skills.map((s, i) => (
                <span key={i} className="text-[7px] px-2 py-0.5 rounded-full" style={{ backgroundColor: color.secondary, color: color.primary }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ========== VALENCIA: Two-column with left accent bar ==========
    if (template.id === 'valencia') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="w-2 h-full" style={{ backgroundColor: color.primary }} />
          <div className="flex-1 p-4">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: color.secondary }}>
              <div className="w-14 h-14 rounded-full" style={{ backgroundColor: color.secondary }} />
              <div>
                <div className="font-bold text-base" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
                <div className="text-[9px] text-gray-500">{SAMPLE_DATA.title}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.primary }} />EXPERIENCE
                </div>
                {SAMPLE_DATA.experience.map((exp, i) => (
                  <div key={i} className="mb-2 pl-2 border-l-2" style={{ borderColor: color.secondary }}>
                    <div className="font-semibold text-[7px]">{exp.position}</div>
                    <div className="text-[6px] text-gray-500">{exp.company}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.primary }} />SKILLS
                </div>
                {SAMPLE_DATA.skills.slice(0, 5).map((s, i) => (
                  <div key={i} className="text-[7px] mb-1 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: color.primary }} />{s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ========== MILANO: Sidebar right with gradient header ==========
    if (template.id === 'milano') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="flex-1 p-4">
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-1 uppercase tracking-wide" style={{ color: color.primary }}>About Me</div>
              <div className="text-[7px] text-gray-600">{SAMPLE_DATA.summary}</div>
            </div>
            <div className="mb-4">
              <div className="font-bold text-[10px] mb-2 uppercase tracking-wide" style={{ color: color.primary }}>Work Experience</div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <div className="w-1 rounded-full" style={{ backgroundColor: color.primary }} />
                  <div>
                    <div className="font-semibold text-[8px]">{exp.position}</div>
                    <div className="text-[7px] text-gray-500">{exp.company}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="font-bold text-[10px] mb-2 uppercase tracking-wide" style={{ color: color.primary }}>Education</div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i} className="text-[7px]">
                <span className="font-semibold">{edu.degree}</span> - {edu.school}
              </div>
            ))}
          </div>
          <div className="w-[130px] h-full p-3 flex flex-col" style={{ backgroundColor: color.primary }}>
            <div className="w-16 h-16 rounded-full bg-white/20 mx-auto mb-3" />
            <div className="text-white text-center mb-3">
              <div className="font-bold text-[11px]">{SAMPLE_DATA.name}</div>
              <div className="text-[8px] opacity-80">{SAMPLE_DATA.title}</div>
            </div>
            <div className="text-white/80 text-[7px] space-y-1 mb-3">
              <div>{SAMPLE_DATA.email}</div>
              <div>{SAMPLE_DATA.phone}</div>
            </div>
            <div className="text-white font-bold text-[8px] mb-1">Skills</div>
            {SAMPLE_DATA.skills.slice(0, 4).map((s, i) => (
              <div key={i} className="text-[6px] text-white/80 mb-0.5">• {s}</div>
            ))}
          </div>
        </div>
      );
    }

    // ========== HELEN: Minimal centered with thin borders ==========
    if (template.id === 'helen') {
      return (
        <div className={`${baseClass} p-6`}>
          <div className="text-center mb-4 pb-4 border-b" style={{ borderColor: color.secondary }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-2" style={{ backgroundColor: color.secondary }} />
            <div className="font-bold text-lg" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
            <div className="text-[10px] text-gray-500">{SAMPLE_DATA.title}</div>
            <div className="flex justify-center gap-4 mt-2 text-[7px] text-gray-400">
              <span>{SAMPLE_DATA.email}</span>
              <span>{SAMPLE_DATA.phone}</span>
            </div>
          </div>
          <div className="text-center text-[7px] text-gray-600 mb-4">{SAMPLE_DATA.summary}</div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-bold text-[9px] mb-2 text-center" style={{ color: color.primary }}>Experience</div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="text-center mb-2">
                  <div className="font-semibold text-[7px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-400">{exp.company}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[9px] mb-2 text-center" style={{ color: color.primary }}>Skills</div>
              <div className="flex flex-wrap justify-center gap-1">
                {SAMPLE_DATA.skills.map((s, i) => (
                  <span key={i} className="text-[6px] px-2 py-0.5 rounded-full border" style={{ borderColor: color.primary, color: color.primary }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ========== SKILL-BASED: Skills prominent with progress bars ==========
    if (template.id === 'skill-based') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="w-[150px] h-full p-4" style={{ backgroundColor: color.primary }}>
            <div className="w-16 h-16 rounded-full bg-white/20 mx-auto mb-3" />
            <div className="text-white text-center mb-4">
              <div className="font-bold text-[11px]">{SAMPLE_DATA.name}</div>
              <div className="text-[8px] opacity-70">{SAMPLE_DATA.title}</div>
            </div>
            <div className="text-white font-bold text-[8px] mb-2 flex items-center gap-1">
              <Star className="w-2 h-2" />HARD SKILLS
            </div>
            {SAMPLE_DATA.skills.slice(0, 3).map((s, i) => (
              <div key={i} className="mb-2">
                <div className="text-[7px] text-white/90 mb-0.5">{s}</div>
                <div className="h-1 bg-white/20 rounded-full"><div className="h-1 rounded-full bg-white/60" style={{ width: `${80 - i * 10}%` }} /></div>
              </div>
            ))}
            <div className="text-white font-bold text-[8px] mb-2 mt-3 flex items-center gap-1">
              <Briefcase className="w-2 h-2" />SOFT SKILLS
            </div>
            {SAMPLE_DATA.skills.slice(3, 5).map((s, i) => (
              <div key={i} className="text-[7px] text-white/80 mb-1">• {s}</div>
            ))}
          </div>
          <div className="flex-1 p-4" style={{ backgroundColor: color.bg }}>
            <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
              <Briefcase className="w-3 h-3" />WORK EXPERIENCE
            </div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-3 pl-3 border-l-2" style={{ borderColor: color.primary }}>
                <div className="font-semibold text-[8px]">{exp.position}</div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
                <div className="text-[6px] text-gray-400">{exp.date}</div>
              </div>
            ))}
            <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
              <GraduationCap className="w-3 h-3" />EDUCATION
            </div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i} className="text-[7px]">
                <span className="font-semibold">{edu.degree}</span>
                <div className="text-gray-500">{edu.school}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ========== MINIMALIST: Ultra clean, no colors, just typography ==========
    if (template.id === 'minimalist') {
      return (
        <div className={`${baseClass} p-6`}>
          <div className="border-b-2 pb-4 mb-4" style={{ borderColor: color.primary }}>
            <div className="font-bold text-xl" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">{SAMPLE_DATA.title}</div>
            <div className="flex gap-4 mt-2 text-[7px] text-gray-400">
              <span>{SAMPLE_DATA.email}</span>
              <span>{SAMPLE_DATA.phone}</span>
              <span>{SAMPLE_DATA.location}</span>
            </div>
          </div>
          <div className="mb-4">
            <div className="font-bold text-[9px] uppercase tracking-wide mb-1" style={{ color: color.primary }}>Profile</div>
            <div className="text-[7px] text-gray-600 leading-relaxed">{SAMPLE_DATA.summary}</div>
          </div>
          <div className="mb-4">
            <div className="font-bold text-[9px] uppercase tracking-wide mb-2" style={{ color: color.primary }}>Experience</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-400">{exp.date}</div>
                </div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
              </div>
            ))}
          </div>
          <div className="font-bold text-[9px] uppercase tracking-wide mb-2" style={{ color: color.primary }}>Skills</div>
          <div className="text-[7px] text-gray-600">{SAMPLE_DATA.skills.join(' • ')}</div>
        </div>
      );
    }

    // ========== HYBRID: Two columns with skills sidebar ==========
    if (template.id === 'hybrid') {
      return (
        <div className={baseClass}>
          <div className="p-3 flex items-center gap-3" style={{ backgroundColor: color.primary }}>
            <div className="w-12 h-12 rounded-full bg-white/20" />
            <div className="text-white">
              <div className="font-bold text-sm">{SAMPLE_DATA.name}</div>
              <div className="text-[9px] opacity-80">{SAMPLE_DATA.title}</div>
            </div>
          </div>
          <div className="flex">
            <div className="w-[120px] p-3" style={{ backgroundColor: color.secondary }}>
              <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>HARD SKILLS</div>
              {SAMPLE_DATA.skills.slice(0, 3).map((s, i) => (
                <div key={i} className="text-[7px] mb-1" style={{ color: color.accent }}>▸ {s}</div>
              ))}
              <div className="font-bold text-[8px] mb-2 mt-3" style={{ color: color.primary }}>SOFT SKILLS</div>
              {SAMPLE_DATA.skills.slice(3, 5).map((s, i) => (
                <div key={i} className="text-[7px] mb-1" style={{ color: color.accent }}>▸ {s}</div>
              ))}
              <div className="font-bold text-[8px] mb-2 mt-3" style={{ color: color.primary }}>CONTACT</div>
              <div className="text-[6px] text-gray-600">{SAMPLE_DATA.email}</div>
              <div className="text-[6px] text-gray-600">{SAMPLE_DATA.phone}</div>
            </div>
            <div className="flex-1 p-3">
              <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>WORK EXPERIENCE</div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-500">{exp.company} | {exp.date}</div>
                </div>
              ))}
              <div className="font-bold text-[9px] mb-2 mt-3" style={{ color: color.primary }}>EDUCATION</div>
              {SAMPLE_DATA.education.map((edu, i) => (
                <div key={i} className="text-[7px]">{edu.degree} - {edu.school}</div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ========== TRADITIONAL: Classic single column, underlined headers ==========
    if (template.id === 'traditional') {
      return (
        <div className={`${baseClass} p-5`}>
          <div className="text-center mb-4">
            <div className="font-bold text-lg">{SAMPLE_DATA.name}</div>
            <div className="text-[9px] text-gray-500">{SAMPLE_DATA.title}</div>
            <div className="text-[7px] text-gray-400 mt-1">{SAMPLE_DATA.email} | {SAMPLE_DATA.phone} | {SAMPLE_DATA.location}</div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b-2 pb-1 mb-2" style={{ borderColor: color.primary, color: color.primary }}>PROFESSIONAL SUMMARY</div>
            <div className="text-[7px] text-gray-600">{SAMPLE_DATA.summary}</div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b-2 pb-1 mb-2" style={{ borderColor: color.primary, color: color.primary }}>WORK EXPERIENCE</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between">
                  <div className="font-bold text-[8px]">{exp.position}</div>
                  <div className="text-[7px] text-gray-400">{exp.date}</div>
                </div>
                <div className="text-[7px] text-gray-500 italic">{exp.company}</div>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <div className="font-bold text-[9px] border-b-2 pb-1 mb-2" style={{ borderColor: color.primary, color: color.primary }}>EDUCATION</div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i} className="text-[7px]"><span className="font-semibold">{edu.degree}</span> - {edu.school}</div>
            ))}
          </div>
          <div className="font-bold text-[9px] border-b-2 pb-1 mb-2" style={{ borderColor: color.primary, color: color.primary }}>SKILLS</div>
          <div className="text-[7px] text-gray-600">{SAMPLE_DATA.skills.join(', ')}</div>
        </div>
      );
    }

    // ========== GENERAL: Full-width header with two columns below ==========
    if (template.id === 'general') {
      return (
        <div className={baseClass}>
          <div className="p-4" style={{ backgroundColor: color.primary }}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-white/20" />
              <div className="text-white flex-1">
                <div className="font-bold text-base">{SAMPLE_DATA.name}</div>
                <div className="text-[9px] opacity-80">{SAMPLE_DATA.title}</div>
                <div className="text-[7px] opacity-60 mt-1">{SAMPLE_DATA.summary.slice(0, 80)}...</div>
              </div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
                <Briefcase className="w-3 h-3" />EXPERIENCE
              </div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-500">{exp.company}</div>
                </div>
              ))}
              <div className="font-bold text-[9px] mb-2 mt-3 flex items-center gap-1" style={{ color: color.primary }}>
                <GraduationCap className="w-3 h-3" />EDUCATION
              </div>
              {SAMPLE_DATA.education.map((edu, i) => (
                <div key={i} className="text-[7px]">{edu.degree}</div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[9px] mb-2 flex items-center gap-1" style={{ color: color.primary }}>
                <Star className="w-3 h-3" />SKILLS
              </div>
              {SAMPLE_DATA.skills.map((s, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <div className="text-[7px] flex-1">{s}</div>
                  <div className="w-12 h-1 bg-gray-200 rounded-full"><div className="h-1 rounded-full" style={{ backgroundColor: color.primary, width: `${90 - i * 10}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ========== IT PRO: Technical with icons and progress bars ==========
    if (template.id === 'it-pro') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="flex-1 p-4">
            <div className="mb-3">
              <div className="font-bold text-[9px] mb-2 pb-1 border-b flex items-center gap-1" style={{ color: color.primary, borderColor: color.secondary }}>
                <Briefcase className="w-3 h-3" />WORK EXPERIENCE
              </div>
              {SAMPLE_DATA.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[6px] text-gray-500">{exp.company} • {exp.date}</div>
                </div>
              ))}
            </div>
            <div className="font-bold text-[9px] mb-2 pb-1 border-b flex items-center gap-1" style={{ color: color.primary, borderColor: color.secondary }}>
              <GraduationCap className="w-3 h-3" />EDUCATION
            </div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i} className="text-[7px] mb-1">{edu.degree} - {edu.school}</div>
            ))}
          </div>
          <div className="w-[140px] p-3" style={{ backgroundColor: color.secondary }}>
            <div className="w-14 h-14 rounded-lg mx-auto mb-2" style={{ backgroundColor: color.primary }} />
            <div className="text-center mb-3">
              <div className="font-bold text-[10px]" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
              <div className="text-[7px] text-gray-500">{SAMPLE_DATA.title}</div>
            </div>
            <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>TECHNICAL SKILLS</div>
            {SAMPLE_DATA.skills.slice(0, 4).map((s, i) => (
              <div key={i} className="mb-1.5">
                <div className="text-[6px] text-gray-600 mb-0.5">{s}</div>
                <div className="h-1.5 bg-white rounded-full"><div className="h-1.5 rounded-full" style={{ backgroundColor: color.primary, width: `${95 - i * 15}%` }} /></div>
              </div>
            ))}
            <div className="font-bold text-[8px] mb-1 mt-3" style={{ color: color.primary }}>CONTACT</div>
            <div className="text-[6px] text-gray-500">{SAMPLE_DATA.email}</div>
            <div className="text-[6px] text-gray-500">{SAMPLE_DATA.phone}</div>
          </div>
        </div>
      );
    }

    // ========== TECH: Modern grid with icons ==========
    if (template.id === 'tech') {
      return (
        <div className={baseClass}>
          <div className="p-3 flex items-center justify-between" style={{ backgroundColor: color.primary }}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-white/20" />
              <div className="text-white">
                <div className="font-bold text-[11px]">{SAMPLE_DATA.name}</div>
                <div className="text-[8px] opacity-70">{SAMPLE_DATA.title}</div>
              </div>
            </div>
            <div className="text-white/70 text-[6px] text-right">
              <div>{SAMPLE_DATA.email}</div>
              <div>{SAMPLE_DATA.phone}</div>
            </div>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {SAMPLE_DATA.skills.slice(0, 6).map((s, i) => (
                <div key={i} className="text-center p-1.5 rounded" style={{ backgroundColor: color.secondary }}>
                  <div className="text-[6px] font-semibold" style={{ color: color.primary }}>{s}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>EXPERIENCE</div>
                {SAMPLE_DATA.experience.map((exp, i) => (
                  <div key={i} className="mb-2 p-1.5 rounded border" style={{ borderColor: color.secondary }}>
                    <div className="font-semibold text-[7px]">{exp.position}</div>
                    <div className="text-[6px] text-gray-500">{exp.company}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>EDUCATION</div>
                {SAMPLE_DATA.education.map((edu, i) => (
                  <div key={i} className="mb-2 p-1.5 rounded border" style={{ borderColor: color.secondary }}>
                    <div className="font-semibold text-[7px]">{edu.degree}</div>
                    <div className="text-[6px] text-gray-500">{edu.school}</div>
                  </div>
                ))}
                <div className="font-bold text-[8px] mb-1 mt-2" style={{ color: color.primary }}>INTERESTS</div>
                <div className="text-[6px] text-gray-500">Technology, Innovation, AI</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ========== COMBINED: Split layout with accent bar ==========
    if (template.id === 'combined') {
      return (
        <div className={`${baseClass} flex`}>
          <div className="w-[160px] p-4" style={{ backgroundColor: color.bg }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-3" style={{ backgroundColor: color.secondary }} />
            <div className="text-center mb-4">
              <div className="font-bold text-[11px]" style={{ color: color.primary }}>{SAMPLE_DATA.name}</div>
              <div className="text-[8px] text-gray-500">{SAMPLE_DATA.title}</div>
            </div>
            <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>CONTACT</div>
            <div className="text-[6px] text-gray-600 mb-3">
              <div className="mb-1">{SAMPLE_DATA.email}</div>
              <div className="mb-1">{SAMPLE_DATA.phone}</div>
              <div>{SAMPLE_DATA.location}</div>
            </div>
            <div className="font-bold text-[8px] mb-2" style={{ color: color.primary }}>SKILLS</div>
            {SAMPLE_DATA.skills.map((s, i) => (
              <div key={i} className="text-[6px] mb-1 px-2 py-0.5 rounded" style={{ backgroundColor: color.secondary, color: color.accent }}>{s}</div>
            ))}
          </div>
          <div className="w-1" style={{ backgroundColor: color.primary }} />
          <div className="flex-1 p-4">
            <div className="font-bold text-[9px] mb-2" style={{ color: color.primary }}>WORK EXPERIENCE</div>
            {SAMPLE_DATA.experience.map((exp, i) => (
              <div key={i} className="mb-3">
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-[8px]">{exp.position}</div>
                  <div className="text-[6px] px-1.5 py-0.5 rounded" style={{ backgroundColor: color.secondary, color: color.primary }}>{exp.date}</div>
                </div>
                <div className="text-[7px] text-gray-500">{exp.company}</div>
              </div>
            ))}
            <div className="font-bold text-[9px] mb-2 mt-4" style={{ color: color.primary }}>EDUCATION</div>
            {SAMPLE_DATA.education.map((edu, i) => (
              <div key={i} className="mb-2">
                <div className="font-semibold text-[8px]">{edu.degree}</div>
                <div className="text-[7px] text-gray-500">{edu.school}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ========== FALLBACK: Default classic layout ==========
    return (
      <div className={baseClass}>
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
  // TEMPLATE SELECTION SCREEN - LUXURY PRADA/CHANEL/DIOR DESIGN
  // ============================================================================

  const TemplateSelection = () => (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-purple-950/20">
      {/* LUXURY HEADER */}
      <div className="shrink-0 px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            {/* Back Button - Premium Luxury */}
            <button 
              onClick={() => setStep('my-cvs')} 
              className="group flex items-center gap-3 mb-6 px-4 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95"
              style={{ 
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all" style={{ background: `linear-gradient(135deg, ${currentColor.primary}30, ${currentColor.accent}20)` }}>
                <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} style={{ color: currentColor.primary }} />
              </div>
              <span className="text-sm font-semibold text-foreground">{t.back}</span>
            </button>
            
            {/* Title - Luxury Typography */}
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 32px ${currentColor.primary}40` }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">{t.chooseTemplate}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t.chooseTemplateDesc}</p>
              </div>
            </div>
          </div>

          {/* View Toggle - Premium Glass */}
          <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-lg">
            <button
              type="button"
              onClick={() => setTemplateView('grid')}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                templateView === 'grid' 
                  ? 'bg-white/15 text-foreground shadow-inner' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              title={isRTL ? 'عرض شبكي' : 'Grid view'}
              aria-label={isRTL ? 'عرض شبكي' : 'Grid view'}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setTemplateView('list')}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                templateView === 'list' 
                  ? 'bg-white/15 text-foreground shadow-inner' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              title={isRTL ? 'عرض قائمة' : 'List view'}
              aria-label={isRTL ? 'عرض قائمة' : 'List view'}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* TEMPLATES - LUXURY GRID */}
      <div className="flex-1 overflow-y-auto px-8 pb-32">
        {templateView === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {CV_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate.id === template.id;
              const templateColor = template.colors[isSelected ? selectedColorIndex : 0];
              
              return (
                <div
                  key={template.id}
                  className={`relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? 'scale-[1.02] shadow-2xl'
                      : 'hover:scale-[1.01] hover:shadow-xl'
                  }`}
                  style={{ 
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                    boxShadow: isSelected 
                      ? `0 25px 80px ${templateColor.primary}30, 0 0 0 2px ${templateColor.primary}` 
                      : '0 15px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08)',
                  }}
                  onClick={() => handleTemplateCardClick(template)}
                  aria-label={isRTL ? `اختيار قالب ${template.nameAr}` : `Select template ${template.name}`}
                >
                  {/* Recommended Badge - Floating Luxury */}
                  {template.recommended && (
                    <div className="absolute top-4 right-4 z-20">
                      <div className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-bold shadow-2xl" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)' }}>
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {t.recommended}
                      </div>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-4 left-4 z-20">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl" style={{ background: `linear-gradient(135deg, ${templateColor.primary}, ${templateColor.accent})` }}>
                        <Check className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* Template Preview Area */}
                  <div 
                    className="relative h-[300px] overflow-hidden flex items-start justify-center pt-4" 
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.08) 100%)' }}
                  >
                    <div className="transition-transform duration-300">
                      <TemplatePreview
                        template={template}
                        colorIndex={isSelected ? selectedColorIndex : 0}
                      />
                    </div>
                  </div>

                  {/* Card Footer - Luxury Info */}
                  <div className="p-5 border-t border-white/5">
                    {/* Template Name & Badges */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="font-bold text-xl text-foreground tracking-tight">
                        {isRTL ? template.nameAr : template.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {template.isATS && (
                          <span className="px-3 py-1.5 rounded-full text-[11px] font-bold text-emerald-300 flex items-center gap-1" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            <Check className="w-3 h-3" />
                            ATS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Color Palette - Premium */}
                    <div className="flex items-center gap-2 mb-4">
                      {template.colors.map((color, idx) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTemplate(template);
                            setSelectedColorIndex(idx);
                          }}
                          className={`w-8 h-8 rounded-full transition-all duration-200 ${
                            isSelected && selectedColorIndex === idx
                              ? 'scale-125 shadow-lg'
                              : 'hover:scale-110'
                          }`}
                          style={{ 
                            backgroundColor: color.primary,
                            boxShadow: isSelected && selectedColorIndex === idx 
                              ? `0 4px 20px ${color.primary}60, 0 0 0 3px rgba(255,255,255,0.2)` 
                              : `0 2px 8px ${color.primary}30`
                          }}
                          title={color.id}
                          aria-label={color.id}
                        >
                          {isSelected && selectedColorIndex === idx && (
                            <Check className="w-4 h-4 text-white mx-auto drop-shadow-lg" />
                          )}
                        </button>
                      ))}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW - LUXURY */
          <div className="space-y-4">
            {CV_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate.id === template.id;
              const templateColor = template.colors[isSelected ? selectedColorIndex : 0];
              
              return (
                <div
                  key={template.id}
                  className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isSelected ? 'shadow-xl' : 'hover:shadow-lg'
                  }`}
                  style={{ 
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                    boxShadow: isSelected 
                      ? `0 15px 50px ${templateColor.primary}25, 0 0 0 2px ${templateColor.primary}` 
                      : '0 8px 30px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.06)',
                  }}
                  onClick={() => handleTemplateCardClick(template)}
                >
                  <div className="p-5 flex items-center gap-5">
                    {/* Mini Preview */}
                    <div className="w-[140px] h-[100px] rounded-xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.05) 100%)' }}>
                      <TemplatePreview
                        template={template}
                        colorIndex={isSelected ? selectedColorIndex : 0}
                        mini
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold text-lg text-foreground">{isRTL ? template.nameAr : template.name}</h3>
                        {template.recommended && (
                          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-white text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                            <Star className="w-3 h-3 fill-current" />
                            {t.recommended}
                          </span>
                        )}
                        {template.isATS && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-300" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            ATS
                          </span>
                        )}
                      </div>
                      
                      {/* Colors */}
                      <div className="flex items-center gap-2">
                        {template.colors.slice(0, 8).map((color, idx) => (
                          <button
                            key={color.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTemplate(template);
                              setSelectedColorIndex(idx);
                            }}
                            className={`w-7 h-7 rounded-full transition-all ${
                              isSelected && selectedColorIndex === idx ? 'scale-125 shadow-lg' : 'hover:scale-110'
                            }`}
                            style={{ 
                              backgroundColor: color.primary,
                              boxShadow: isSelected && selectedColorIndex === idx 
                                ? `0 4px 16px ${color.primary}50, 0 0 0 2px rgba(255,255,255,0.2)` 
                                : `0 2px 6px ${color.primary}25`
                            }}
                            title={color.id}
                            aria-label={color.id}
                          >
                            {isSelected && selectedColorIndex === idx && (
                              <Check className="w-3.5 h-3.5 text-white mx-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selection Check */}
                    {isSelected && (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg shrink-0" style={{ background: `linear-gradient(135deg, ${templateColor.primary}, ${templateColor.accent})` }}>
                        <Check className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STICKY CTA - LUXURY FLOATING */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent h-32" />
        <div className="relative px-8 pb-8 pt-4 pointer-events-auto">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setStep('method')}
              className="w-full h-16 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              style={{ 
                background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`,
                boxShadow: `0 20px 60px ${currentColor.primary}50, 0 0 0 1px rgba(255,255,255,0.1) inset`
              }}
              title={t.startWithTemplate}
            >
              <span>
                {t.startWithTemplate}
                {selectedTemplate ? ` — ${isRTL ? selectedTemplate.nameAr : selectedTemplate.name}` : ''}
              </span>
              <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // SCREEN 2 - CREATE METHOD - LUXURY PRADA/CHANEL/DIOR DESIGN
  // =========================================================================

  const CreateMethod = () => (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-purple-950/30 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${currentColor.primary}40, transparent 70%)` }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-15" style={{ background: `radial-gradient(circle, ${currentColor.accent}30, transparent 70%)` }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: `radial-gradient(circle, ${currentColor.primary}, transparent 60%)` }} />
      </div>

      {/* Premium Header */}
      <div className="relative shrink-0 px-8 pt-8 pb-6">
        {/* Back Button - Luxury Glass */}
        <button 
          onClick={() => setStep('templates')} 
          className="group flex items-center gap-3 mb-10 px-5 py-3 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
          title={t.back}
        >
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" 
            style={{ 
              background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`,
              boxShadow: `0 4px 20px ${currentColor.primary}50`,
            }}
          >
            <ArrowLeft className={`w-5 h-5 text-white ${isRTL ? 'rotate-180' : ''}`} />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-wide">{t.back}</span>
        </button>

        {/* Title - Luxury Typography */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Sparkles className="w-4 h-4" style={{ color: currentColor.primary }} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              {isRTL ? 'الخطوة الثانية' : 'Step Two'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight mb-4" style={{ textShadow: '0 4px 30px rgba(0,0,0,0.3)' }}>
            {isRTL ? 'كيف تريد إنشاء سيرتك الذاتية؟' : 'How would you like to create your resume?'}
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            {isRTL ? 'اختر الطريقة التي تناسبك للبدء' : 'Choose the method that works best for you'}
          </p>
        </div>
      </div>

      {/* Method Cards - Luxury Design */}
      <div className="relative flex-1 px-6 md:px-8 pb-16 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Card 1: Start from Scratch */}
            <button
              type="button"
              onClick={() => setStep('builder')}
              className="group relative text-left rounded-[2rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] active:scale-[0.98]"
              style={{ 
                background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                boxShadow: '0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
              }}
              title={isRTL ? 'ابدأ من الصفر' : 'Start from scratch'}
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${currentColor.primary}10, ${currentColor.accent}05)` }} />
              
              {/* Card Content */}
              <div className="relative p-8 md:p-10">
                {/* Icon Container */}
                <div 
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3"
                  style={{ 
                    background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`,
                    boxShadow: `0 15px 40px ${currentColor.primary}40, 0 5px 15px ${currentColor.primary}30`,
                  }}
                >
                  <FileText className="w-10 h-10 text-white" />
                </div>
                
                {/* Text */}
                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
                  {isRTL ? 'ابدأ من الصفر' : 'Start from scratch'}
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  {isRTL ? 'مساعدنا الذكي سيرشدك خطوة بخطوة لإنشاء سيرة ذاتية احترافية' : 'Our AI helper will guide you step by step to create a professional resume'}
                </p>
                
                {/* CTA Arrow */}
                <div className="flex items-center gap-2 text-sm font-semibold transition-all duration-300 group-hover:gap-4" style={{ color: currentColor.primary }}>
                  <span>{isRTL ? 'ابدأ الآن' : 'Get Started'}</span>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                </div>
              </div>
              
              {/* Bottom Accent Line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, ${currentColor.primary}, ${currentColor.accent})` }} />
            </button>

            {/* Card 2: Upload Resume */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="group relative text-left rounded-[2rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
              style={{ 
                background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                boxShadow: '0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
              }}
              title={isRTL ? 'لدي سيرة ذاتية بالفعل' : 'I already have a resume'}
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${currentColor.primary}10, ${currentColor.accent}05)` }} />
              
              {/* Card Content */}
              <div className="relative p-8 md:p-10">
                {/* Icon Container */}
                <div 
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3"
                  style={{ 
                    background: `linear-gradient(135deg, ${currentColor.accent}, ${currentColor.primary})`,
                    boxShadow: `0 15px 40px ${currentColor.accent}40, 0 5px 15px ${currentColor.accent}30`,
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  ) : (
                    <Upload className="w-10 h-10 text-white" />
                  )}
                </div>
                
                {/* Text */}
                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
                  {isRTL ? 'لدي سيرة ذاتية بالفعل' : 'I already have a resume'}
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  {isRTL ? 'ارفع ملفك وسنقوم باستخراج البيانات تلقائياً' : 'Upload your document and we\'ll extract the data automatically'}
                </p>
                
                {/* File Types Badge */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: currentColor.primary }}>PDF</span>
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: currentColor.primary }}>Word</span>
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: currentColor.primary }}>Image</span>
                </div>
              </div>
              
              {/* Bottom Accent Line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, ${currentColor.accent}, ${currentColor.primary})` }} />
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

  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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
      
      // Go back to My CVs screen
      setStep('my-cvs');
    } catch (error) {
      console.error('Error saving CV:', error);
      toast({ title: isRTL ? 'فشل حفظ السيرة الذاتية' : 'Failed to save CV', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = async () => {
    const previewElement = document.getElementById('cv-preview-for-pdf');
    if (!previewElement) {
      toast({ title: isRTL ? 'لا يمكن العثور على المعاينة' : 'Cannot find preview', variant: 'destructive' });
      return;
    }

    setIsDownloading(true);
    toast({ title: isRTL ? 'جاري إنشاء PDF...' : 'Generating PDF...' });

    try {
      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const fileName = `${cvData.personalInfo.fullName || 'CV'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({ title: isRTL ? 'تم تحميل PDF بنجاح!' : 'PDF downloaded successfully!' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: isRTL ? 'فشل إنشاء PDF' : 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const renderEditor = () => {
    if (builderStepKey === 'personal') return <PersonalDetailsSection />;
    if (builderStepKey === 'contact') return <ContactInfoSection />;
    if (builderStepKey === 'review') {
      return (
        <div className="relative">
          {/* Content */}
          <div className="space-y-6 pb-24">
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

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

            {/* ACTION BUTTONS - 3 buttons: Save, Download, Share */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <button
                onClick={handleSaveCV}
                className="h-14 px-3 rounded-2xl text-white text-sm font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, #10b981, #059669)`, boxShadow: `0 8px 24px rgba(16, 185, 129, 0.4)` }}
              >
                <Check className="w-5 h-5" />
                {isRTL ? 'حفظ' : 'Save'}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="h-14 px-3 rounded-2xl text-white text-sm font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 24px ${currentColor.primary}40` }}
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isRTL ? 'PDF' : 'PDF'}
              </button>
              <div className="h-14 flex items-center justify-center">
                <ShareButton 
                  shareTitle={`${cvData.personalInfo.fullName || 'My'} CV - Created with Wakti`}
                  shareDescription={`Check out my professional CV: ${cvData.personalInfo.jobTitle || 'Professional'}`}
                  size="lg"
                />
              </div>
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
          <div id="cv-preview-for-pdf">
            <TemplatePreviewWithData template={selectedTemplate} colorIndex={selectedColorIndex} data={previewData} />
          </div>
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
          <div className="text-lg font-black text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {builderSteps.find(s => s.key === builderStepKey)?.label}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="text-xs font-semibold text-muted-foreground">{isRTL ? selectedTemplate.nameAr : selectedTemplate.name}</div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <div className="text-xs font-bold" style={{ color: currentColor.primary }}>{Math.round((Object.values(cvData.personalInfo).filter(v => v).length / 8) * 100)}% {isRTL ? 'مكتمل' : 'Complete'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton 
            shareTitle={`${cvData.personalInfo.fullName || 'My'} CV - Created with Wakti`}
            shareDescription={`Check out my professional CV: ${cvData.personalInfo.jobTitle || 'Professional'}`}
            size="md"
          />
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="h-11 px-5 rounded-xl text-white text-xs font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50" 
            style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 24px ${currentColor.primary}40` }} 
            title={t.download}
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
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

  // =========================================================================
  // SCREEN 0 - MY CVs (View Saved CVs)
  // =========================================================================

  const MyCVsScreen = () => {
    const [savedCVs, setSavedCVs] = useState<any[]>([]);

    useEffect(() => {
      const cvs = JSON.parse(localStorage.getItem('wakti_saved_cvs') || '[]');
      setSavedCVs(cvs);
    }, []);

    const loadCV = (cv: any) => {
      setCvData(cv.data);
      setSelectedTemplate(CV_TEMPLATES.find(t => t.id === cv.template_id) || CV_TEMPLATES[0]);
      setSelectedColorIndex(cv.color_index);
      setStep('builder');
      toast({ title: isRTL ? 'تم تحميل السيرة الذاتية' : 'CV loaded successfully' });
    };

    const deleteCV = (index: number) => {
      const cvs = [...savedCVs];
      cvs.splice(index, 1);
      localStorage.setItem('wakti_saved_cvs', JSON.stringify(cvs));
      setSavedCVs(cvs);
      toast({ title: isRTL ? 'تم حذف السيرة الذاتية' : 'CV deleted' });
    };

    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-purple-900/10">
        {/* LUXURY HEADER */}
        <div className="shrink-0 px-8 py-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 32px ${currentColor.primary}50` }}>
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black tracking-tight" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {isRTL ? 'سيرتي الذاتية' : 'My CVs'}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">{isRTL ? 'مجموعتك الاحترافية' : 'Your professional collection'}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep('templates')}
              className="h-14 px-8 rounded-2xl text-white text-base font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 12px 40px ${currentColor.primary}50` }}
            >
              <Plus className="w-5 h-5" />
              {isRTL ? 'إنشاء جديد' : 'Create New'}
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {savedCVs.length === 0 ? (
            /* EMPTY STATE - LUXURY */
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="relative mb-10">
                <div className="w-40 h-40 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentColor.primary}08, ${currentColor.accent}08)`, border: `2px dashed ${currentColor.primary}30` }}>
                  <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentColor.primary}15, ${currentColor.accent}15)` }}>
                    <FileText className="w-14 h-14" style={{ color: currentColor.primary }} />
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-foreground mb-3">{isRTL ? 'ابدأ رحلتك المهنية' : 'Start Your Journey'}</h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-md leading-relaxed">
                {isRTL ? 'أنشئ سيرة ذاتية احترافية تبهر أصحاب العمل' : 'Create a stunning CV that impresses employers'}
              </p>
              <button
                onClick={() => setStep('templates')}
                className="h-16 px-12 rounded-2xl text-white text-lg font-bold shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 16px 48px ${currentColor.primary}50` }}
              >
                {isRTL ? 'إنشاء سيرتي الذاتية' : 'Create My CV'}
              </button>
            </div>
          ) : (
            /* CV CARDS - LUXURY GRID */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {savedCVs.map((cv, index) => (
                <div 
                  key={index} 
                  className="relative rounded-3xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ 
                    background: `linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))`,
                    boxShadow: `0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08)`,
                  }}
                >
                  {/* Card Header with Gradient Accent */}
                  <div className="h-2" style={{ background: `linear-gradient(90deg, ${currentColor.primary}, ${currentColor.accent})` }} />
                  
                  <div className="p-6">
                    {/* Top Row: Avatar + Delete */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg" style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})` }}>
                          {(cv.data.personalInfo.fullName || 'CV').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{cv.data.personalInfo.fullName || (isRTL ? 'سيرة ذاتية' : 'My Resume')}</h3>
                          <p className="text-sm text-muted-foreground">{cv.data.personalInfo.jobTitle || (isRTL ? 'محترف' : 'Professional')}</p>
                        </div>
                      </div>
                      {/* DELETE BUTTON - ALWAYS VISIBLE */}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCV(index); }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all hover:scale-110 active:scale-95"
                        title={isRTL ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 px-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(cv.created_at).toLocaleDateString(isRTL ? 'ar' : 'en', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => loadCV(cv)}
                        className="flex-1 h-12 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${currentColor.primary}, ${currentColor.accent})`, boxShadow: `0 8px 24px ${currentColor.primary}40` }}
                      >
                        <Eye className="w-4 h-4" />
                        {isRTL ? 'فتح' : 'Open'}
                      </button>
                      <button
                        onClick={() => { loadCV(cv); setTimeout(() => handleDownloadPDF(), 500); }}
                        className="h-12 px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {isRTL ? 'PDF' : 'PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-purple-500/5 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {step === 'my-cvs' && <MyCVsScreen />}
      {step === 'templates' && <TemplateSelection />}
      {step === 'method' && <CreateMethod />}
      {step === 'builder' && <BuilderV2 />}
      {step === 'preview' && <Preview />}
    </div>
  );
};

export default CVBuilderWizard;
