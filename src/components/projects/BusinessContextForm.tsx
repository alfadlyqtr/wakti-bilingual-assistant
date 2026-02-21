import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Loader2, Sparkles, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'tel' | 'email' | 'url';
}

export interface BusinessContextData {
  fields: Record<string, string>;
  uploadedFile?: File | null;
}

interface BusinessContextFormProps {
  siteType: string;
  heading: string;
  fields: ContextField[];
  onSubmit: (data: BusinessContextData) => void;
  isRTL?: boolean;
}

export default function BusinessContextForm({
  siteType,
  heading,
  fields,
  onSubmit,
  isRTL = false,
}: BusinessContextFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (id: string, value: string) => {
    setValues(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleSubmit = () => {
    onSubmit({ fields: values, uploadedFile });
  };

  const hasUpload = !!uploadedFile;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', left: 'var(--current-sidebar-width, 70px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden shadow-2xl",
          "bg-[#13171f] border border-white/20"
        )}
        style={{ boxShadow: '0 0 60px hsla(210,100%,65%,0.25), 0 0 120px hsla(280,70%,65%,0.15), 0 25px 50px rgba(0,0,0,0.8)' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(210,100%,65%), hsl(280,70%,65%))' }}>
              <Building2 size={16} className="text-white" />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest"
              style={{ color: 'hsl(210,100%,65%)' }}>
              {siteType}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mt-2">{heading}</h2>
          <p className="text-sm mt-1 text-white/50">
            {isRTL
              ? 'سيستخدم الذكاء الاصطناعي هذه المعلومات لبناء موقعك بمحتوى حقيقي'
              : 'The AI will use this to build your site with real content'}
          </p>
        </div>

        {/* Fields */}
        <div className="px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {!hasUpload && fields.map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-medium mb-1.5 text-white/70">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={cn(
                    "w-full rounded-xl px-4 py-2.5 text-sm text-white resize-none",
                    "border border-white/20 outline-none transition-all",
                    "placeholder:text-white/35 focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20"
                  )}
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
              ) : (
                <input
                  type={field.type}
                  value={values[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full rounded-xl px-4 py-2.5 text-sm text-white",
                    "border border-white/20 outline-none transition-all",
                    "placeholder:text-white/35 focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20"
                  )}
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
              )}
            </div>
          ))}

          {/* Upload section */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-xl border border-dashed px-4 py-4 cursor-pointer transition-all",
              "flex items-center gap-3",
              hasUpload
                ? "border-green-500/60 bg-green-500/10"
                : "border-white/20 hover:border-white/40 bg-white/8 hover:bg-white/12"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
              hasUpload ? "bg-green-500/20" : "bg-white/10"
            )}>
              {hasUpload
                ? <FileText size={18} className="text-green-400" />
                : <Upload size={18} style={{ color: '#858384' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              {hasUpload ? (
                <>
                  <p className="text-sm font-medium text-green-400 truncate">{uploadedFile!.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#858384' }}>
                    {isRTL ? 'سيقرأ الذكاء الاصطناعي هذا الملف مباشرة' : 'AI will read this file directly'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-white/70">
                    {isRTL ? 'رفع ملف (اختياري)' : 'Upload a file (optional)'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#858384' }}>
                    {isRTL
                      ? 'PDF، صورة، CV، قائمة طعام، بروشور...'
                      : 'PDF, image, CV, menu, brochure...'}
                  </p>
                </>
              )}
            </div>
            {hasUpload && (
              <button
                onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X size={12} className="text-white/50" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, hsl(210,100%,65%), hsl(280,70%,65%))',
              boxShadow: '0 4px 20px hsla(210,100%,65%,0.3)',
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={16} />
              {isRTL ? 'ابنِ موقعي' : 'Generate My Site'}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
