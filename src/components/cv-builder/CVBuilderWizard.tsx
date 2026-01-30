import React, { useState, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Upload, Sparkles, User, Briefcase, GraduationCap, Award, Languages,
  FolderPlus, Plus, X, Trash2, Mail, Phone, MapPin, Linkedin, Globe, FileText,
  Loader2, Eye, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';

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

const t_en = {
  createYourCV: "Create Your CV", craftPerfectCV: "Craft the perfect CV that opens doors",
  startFresh: "Start Fresh", buildFromScratch: "Build your CV step by step",
  uploadExisting: "Upload Existing CV", letAIExtract: "Let AI extract your information",
  supportedFormats: "PDF, DOC, DOCX, or Image", personalInfo: "Personal Information",
  experience: "Work Experience", education: "Education", skills: "Skills",
  fullName: "Full Name", jobTitle: "Professional Title", email: "Email",
  phone: "Phone", location: "Location", linkedin: "LinkedIn", website: "Website",
  summary: "Professional Summary", company: "Company", position: "Position",
  startDate: "Start", endDate: "End", currentlyWorking: "Currently working here",
  institution: "Institution", degree: "Degree", field: "Field of Study",
  skillName: "Skill", addSection: "Add Section", addExperience: "Add Experience",
  addEducation: "Add Education", addSkill: "Add Skill", remove: "Remove",
  back: "Back", preview: "Preview", extracting: "Extracting...",
  extracted: "Data Extracted!", extractedDesc: "Your details have been filled",
  extractFailed: "Extraction Failed", extractFailedDesc: "Please fill manually",
  required: "Required",
};
const t_ar = {
  createYourCV: "أنشئ سيرتك الذاتية", craftPerfectCV: "صمم السيرة الذاتية المثالية",
  startFresh: "ابدأ من جديد", buildFromScratch: "ابنِ سيرتك خطوة بخطوة",
  uploadExisting: "ارفع سيرة ذاتية", letAIExtract: "دع الذكاء الاصطناعي يستخرج معلوماتك",
  supportedFormats: "PDF، DOC، DOCX، أو صورة", personalInfo: "المعلومات الشخصية",
  experience: "الخبرة العملية", education: "التعليم", skills: "المهارات",
  fullName: "الاسم الكامل", jobTitle: "المسمى الوظيفي", email: "البريد الإلكتروني",
  phone: "الهاتف", location: "الموقع", linkedin: "LinkedIn", website: "الموقع الإلكتروني",
  summary: "الملخص المهني", company: "الشركة", position: "المنصب",
  startDate: "البداية", endDate: "النهاية", currentlyWorking: "أعمل هنا حالياً",
  institution: "المؤسسة", degree: "الدرجة", field: "التخصص",
  skillName: "المهارة", addSection: "إضافة قسم", addExperience: "إضافة خبرة",
  addEducation: "إضافة تعليم", addSkill: "إضافة مهارة", remove: "حذف",
  back: "رجوع", preview: "معاينة", extracting: "جاري الاستخراج...",
  extracted: "تم استخراج البيانات!", extractedDesc: "تم ملء بياناتك",
  extractFailed: "فشل الاستخراج", extractFailedDesc: "يرجى الإدخال يدوياً",
  required: "مطلوب",
};

export const CVBuilderWizard: React.FC<CVBuilderWizardProps> = ({ onComplete, onBack }) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = language === 'ar' ? t_ar : t_en;
  const isRTL = language === 'ar';

  const [step, setStep] = useState<'landing' | 'builder' | 'preview'>('landing');
  const [cvData, setCvData] = useState<CVData>({
    personalInfo: { fullName: '', jobTitle: '', email: user?.email || '', phone: '', location: '', linkedin: '', website: '', summary: '' },
    experience: [], education: [], skills: [],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['personalInfo']));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (s: string) => setExpanded(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const updatePI = (f: keyof PersonalInfo, v: string) => setCvData(p => ({ ...p, personalInfo: { ...p.personalInfo, [f]: v } }));

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

  const Landing = () => (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
          <FileText className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent mb-3">{t.createYourCV}</h1>
        <p className="text-muted-foreground text-lg max-w-sm mx-auto">{t.craftPerfectCV}</p>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => setStep('builder')} className="w-full p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group text-left">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform"><Sparkles className="w-7 h-7 text-white" /></div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-foreground mb-1">{t.startFresh}</h3><p className="text-sm text-muted-foreground">{t.buildFromScratch}</p></div>
            <ArrowRight className={`w-5 h-5 text-muted-foreground group-hover:text-purple-400 ${isRTL ? 'rotate-180' : ''}`} />
          </div>
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={isUploading} className="w-full p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group text-left disabled:opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
              {isUploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Upload className="w-7 h-7 text-white" />}
            </div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-foreground mb-1">{isUploading ? t.extracting : t.uploadExisting}</h3>{!isUploading && <><p className="text-sm text-muted-foreground">{t.letAIExtract}</p><p className="text-xs text-muted-foreground/60 mt-1">{t.supportedFormats}</p></>}</div>
            {!isUploading && <ArrowRight className={`w-5 h-5 text-muted-foreground group-hover:text-purple-400 ${isRTL ? 'rotate-180' : ''}`} />}
          </div>
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
    </div>
  );

  const SectionHead = ({ title, icon, k, count, onAdd }: { title: string; icon: React.ReactNode; k: string; count?: number; onAdd?: () => void }) => (
    <div className="flex items-center justify-between py-4 px-1">
      <button onClick={() => toggle(k)} className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center text-purple-400">{icon}</div>
        <div className="text-left"><h3 className="font-semibold text-foreground">{title}</h3>{count !== undefined && count > 0 && <p className="text-xs text-muted-foreground">{count} items</p>}</div>
        {expanded.has(k) ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {onAdd && <button onClick={onAdd} className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400" title="Add"><Plus className="w-5 h-5" /></button>}
    </div>
  );

  const LuxInput = ({ label, value, onChange, placeholder, type = 'text', icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">{icon}{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-12 bg-white/5 border-2 border-white/10 focus:border-purple-500/50 rounded-xl text-base" />
    </div>
  );

  const PersonalSection = () => (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-1 gap-4">
        <LuxInput label={t.fullName} value={cvData.personalInfo.fullName} onChange={v => updatePI('fullName', v)} placeholder={t.fullName} icon={<User className="w-4 h-4" />} />
        <LuxInput label={t.jobTitle} value={cvData.personalInfo.jobTitle} onChange={v => updatePI('jobTitle', v)} placeholder={t.jobTitle} icon={<Briefcase className="w-4 h-4" />} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LuxInput label={t.email} value={cvData.personalInfo.email} onChange={v => updatePI('email', v)} placeholder={t.email} type="email" icon={<Mail className="w-4 h-4" />} />
        <LuxInput label={t.phone} value={cvData.personalInfo.phone} onChange={v => updatePI('phone', v)} placeholder={t.phone} type="tel" icon={<Phone className="w-4 h-4" />} />
      </div>
      <LuxInput label={t.location} value={cvData.personalInfo.location} onChange={v => updatePI('location', v)} placeholder={t.location} icon={<MapPin className="w-4 h-4" />} />
      <div className="grid grid-cols-2 gap-3">
        <LuxInput label={t.linkedin} value={cvData.personalInfo.linkedin} onChange={v => updatePI('linkedin', v)} placeholder="linkedin.com/in/..." icon={<Linkedin className="w-4 h-4" />} />
        <LuxInput label={t.website} value={cvData.personalInfo.website} onChange={v => updatePI('website', v)} placeholder="yoursite.com" icon={<Globe className="w-4 h-4" />} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">{t.summary}</label>
        <Textarea value={cvData.personalInfo.summary} onChange={e => updatePI('summary', e.target.value)} placeholder={isRTL ? 'نبذة مختصرة عن خبرتك...' : 'Brief overview of your experience...'} className="min-h-[100px] bg-white/5 border-2 border-white/10 focus:border-purple-500/50 rounded-xl resize-none" />
      </div>
    </div>
  );

  const ExpItem = ({ exp, i }: { exp: Experience; i: number }) => (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between"><span className="text-sm font-medium text-purple-400">{isRTL ? `الخبرة ${i + 1}` : `Experience ${i + 1}`}</span><button onClick={() => removeExp(exp.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400" title={t.remove}><Trash2 className="w-4 h-4" /></button></div>
      <div className="grid grid-cols-2 gap-3"><Input value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)} placeholder={t.company} className="h-11 bg-white/5 border border-white/10 rounded-lg" /><Input value={exp.position} onChange={e => updateExp(exp.id, 'position', e.target.value)} placeholder={t.position} className="h-11 bg-white/5 border border-white/10 rounded-lg" /></div>
      <Input value={exp.location} onChange={e => updateExp(exp.id, 'location', e.target.value)} placeholder={t.location} className="h-11 bg-white/5 border border-white/10 rounded-lg" />
      <div className="grid grid-cols-2 gap-3"><Input type="month" value={exp.startDate} onChange={e => updateExp(exp.id, 'startDate', e.target.value)} className="h-11 bg-white/5 border border-white/10 rounded-lg" /><Input type="month" value={exp.endDate} onChange={e => updateExp(exp.id, 'endDate', e.target.value)} disabled={exp.current} className="h-11 bg-white/5 border border-white/10 rounded-lg disabled:opacity-50" /></div>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={exp.current} onChange={e => updateExp(exp.id, 'current', e.target.checked)} className="w-4 h-4 rounded" id={`current-${exp.id}`} /><span className="text-sm text-muted-foreground">{t.currentlyWorking}</span></label>
      <Textarea value={exp.description} onChange={e => updateExp(exp.id, 'description', e.target.value)} placeholder={isRTL ? 'صف مسؤولياتك...' : 'Describe your responsibilities...'} className="min-h-[80px] bg-white/5 border border-white/10 rounded-lg resize-none" />
    </div>
  );

  const EduItem = ({ edu, i }: { edu: Education; i: number }) => (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between"><span className="text-sm font-medium text-purple-400">{isRTL ? `التعليم ${i + 1}` : `Education ${i + 1}`}</span><button onClick={() => removeEdu(edu.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400" title={t.remove}><Trash2 className="w-4 h-4" /></button></div>
      <Input value={edu.institution} onChange={e => updateEdu(edu.id, 'institution', e.target.value)} placeholder={t.institution} className="h-11 bg-white/5 border border-white/10 rounded-lg" />
      <div className="grid grid-cols-2 gap-3"><Input value={edu.degree} onChange={e => updateEdu(edu.id, 'degree', e.target.value)} placeholder={t.degree} className="h-11 bg-white/5 border border-white/10 rounded-lg" /><Input value={edu.field} onChange={e => updateEdu(edu.id, 'field', e.target.value)} placeholder={t.field} className="h-11 bg-white/5 border border-white/10 rounded-lg" /></div>
      <div className="grid grid-cols-2 gap-3"><Input type="month" value={edu.startDate} onChange={e => updateEdu(edu.id, 'startDate', e.target.value)} className="h-11 bg-white/5 border border-white/10 rounded-lg" /><Input type="month" value={edu.endDate} onChange={e => updateEdu(edu.id, 'endDate', e.target.value)} className="h-11 bg-white/5 border border-white/10 rounded-lg" /></div>
    </div>
  );

  const SkillsSection = () => (
    <div className="space-y-3 pb-4">
      {cvData.skills.map(s => (
        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <Input value={s.name} onChange={e => updateSkill(s.id, 'name', e.target.value)} placeholder={t.skillName} className="h-10 bg-transparent border-0 flex-1" />
          <select value={s.level} onChange={e => updateSkill(s.id, 'level', e.target.value)} className="h-10 px-3 rounded-lg bg-white/10 border border-white/10 text-sm" title={isRTL ? 'مستوى المهارة' : 'Skill level'} aria-label={isRTL ? 'مستوى المهارة' : 'Skill level'}>
            <option value="beginner">{isRTL ? 'مبتدئ' : 'Beginner'}</option><option value="intermediate">{isRTL ? 'متوسط' : 'Intermediate'}</option><option value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</option><option value="expert">{isRTL ? 'خبير' : 'Expert'}</option>
          </select>
          <button onClick={() => removeSkill(s.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-red-400" title={t.remove}><X className="w-4 h-4" /></button>
        </div>
      ))}
      {cvData.skills.length === 0 && <p className="text-center text-muted-foreground py-4">{isRTL ? 'لم تضف أي مهارات' : 'No skills added'}</p>}
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
        <button onClick={() => setStep('landing')} className="p-2 rounded-xl hover:bg-white/10" title={t.back}><ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} /></button>
        <h2 className="font-semibold">{t.createYourCV}</h2>
        <button onClick={() => setStep('preview')} className="p-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" title={t.preview}><Eye className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="border-b border-white/10"><SectionHead title={t.personalInfo} icon={<User className="w-5 h-5" />} k="personalInfo" />{expanded.has('personalInfo') && <PersonalSection />}</div>
        {cvData.experience.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.experience} icon={<Briefcase className="w-5 h-5" />} k="experience" count={cvData.experience.length} onAdd={addExp} />{expanded.has('experience') && <div className="space-y-4 pb-4">{cvData.experience.map((e, i) => <ExpItem key={e.id} exp={e} i={i} />)}</div>}</div>}
        {cvData.education.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.education} icon={<GraduationCap className="w-5 h-5" />} k="education" count={cvData.education.length} onAdd={addEdu} />{expanded.has('education') && <div className="space-y-4 pb-4">{cvData.education.map((e, i) => <EduItem key={e.id} edu={e} i={i} />)}</div>}</div>}
        {cvData.skills.length > 0 && <div className="border-b border-white/10"><SectionHead title={t.skills} icon={<Award className="w-5 h-5" />} k="skills" count={cvData.skills.length} onAdd={addSkill} />{expanded.has('skills') && <SkillsSection />}</div>}
      </div>
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10">
        <Button onClick={() => setShowAddMenu(true)} className="w-full h-14 rounded-xl bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border-2 border-dashed border-purple-500/40 hover:border-purple-500/60 text-purple-400 font-semibold"><Plus className="w-5 h-5 mr-2" />{t.addSection}</Button>
      </div>
      {showAddMenu && <AddMenu />}
    </div>
  );

  const Preview = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={() => setStep('builder')} className="p-2 rounded-xl hover:bg-white/10" title={t.back}><ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} /></button>
        <h2 className="font-semibold">{t.preview}</h2>
        <button onClick={() => onComplete(cvData)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-medium text-sm">Done</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xl max-w-md mx-auto">
          <div className="text-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold">{cvData.personalInfo.fullName || 'Your Name'}</h2>
            {cvData.personalInfo.jobTitle && <p className="text-lg text-purple-600 dark:text-purple-400 mt-1">{cvData.personalInfo.jobTitle}</p>}
            <div className="flex flex-wrap justify-center gap-3 mt-3 text-sm text-gray-600 dark:text-gray-400">
              {cvData.personalInfo.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{cvData.personalInfo.email}</span>}
              {cvData.personalInfo.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{cvData.personalInfo.phone}</span>}
              {cvData.personalInfo.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{cvData.personalInfo.location}</span>}
            </div>
          </div>
          {cvData.personalInfo.summary && <div className="mb-4"><h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{isRTL ? 'الملخص' : 'Summary'}</h3><p className="text-sm text-gray-700 dark:text-gray-300">{cvData.personalInfo.summary}</p></div>}
          {cvData.experience.length > 0 && <div className="mb-4"><h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{isRTL ? 'الخبرة' : 'Experience'}</h3>{cvData.experience.map(e => <div key={e.id} className="mb-3"><div className="font-semibold text-sm">{e.position}</div><div className="text-sm text-gray-600 dark:text-gray-400">{e.company}</div><div className="text-xs text-gray-500">{e.startDate} - {e.current ? (isRTL ? 'حتى الآن' : 'Present') : e.endDate}</div></div>)}</div>}
          {cvData.education.length > 0 && <div className="mb-4"><h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{isRTL ? 'التعليم' : 'Education'}</h3>{cvData.education.map(e => <div key={e.id} className="mb-2"><div className="font-semibold text-sm">{e.degree} - {e.field}</div><div className="text-sm text-gray-600 dark:text-gray-400">{e.institution}</div></div>)}</div>}
          {cvData.skills.length > 0 && <div><h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{isRTL ? 'المهارات' : 'Skills'}</h3><div className="flex flex-wrap gap-1.5">{cvData.skills.map(s => <span key={s.id} className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{s.name}</span>)}</div></div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-purple-500/5 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {step === 'landing' && <Landing />}
      {step === 'builder' && <Builder />}
      {step === 'preview' && <Preview />}
    </div>
  );
};

export default CVBuilderWizard;
