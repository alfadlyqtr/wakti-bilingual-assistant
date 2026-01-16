import React from 'react';
import { ArrowLeft, Brain, Edit2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  projectName: string;
  status: 'draft' | 'published' | 'generating';
  isEditingName: boolean;
  editedName: string;
  saving: boolean;
  isRTL: boolean;
  onBack: () => void;
  onEditName: () => void;
  onSaveName: () => void;
  onNameChange: (name: string) => void;
}

export function ChatHeader({
  projectName,
  status,
  isEditingName,
  editedName,
  saving,
  isRTL,
  onBack,
  onEditName,
  onSaveName,
  onNameChange,
}: ChatHeaderProps) {
  const handleEditClick = () => {
    if (isEditingName) {
      onSaveName();
    } else {
      onEditName();
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-0 h-[56px] bg-gradient-to-r from-zinc-900 to-zinc-900/90 border-b border-white/10 shrink-0 sticky top-0 left-0 right-0 z-[100]">
      {/* Back button */}
      <button 
        onClick={onBack} 
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0 group"
        title={isRTL ? 'رجوع' : 'Back'}
      >
        <ArrowLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
      </button>
      
      {/* Project name - Editable */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input 
          type="text"
          disabled={!isEditingName}
          value={isEditingName ? editedName : projectName}
          onChange={(e) => onNameChange(e.target.value)}
          className={cn(
            "flex-1 min-w-0 text-base md:text-lg font-bold text-white placeholder-zinc-500 border-b-2 transition-colors px-1 py-1",
            isEditingName 
              ? "bg-transparent border-indigo-500 focus:border-indigo-500 focus:outline-none" 
              : "bg-transparent border-transparent cursor-default"
          )}
          placeholder={isRTL ? 'اسم المشروع' : 'Project name'}
        />
        <button
          onClick={handleEditClick}
          disabled={saving}
          className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded-lg transition-all shrink-0 disabled:opacity-50"
          title={isEditingName ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'تعديل' : 'Edit')}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEditingName ? (
            <Check className="h-4 w-4" />
          ) : (
            <Edit2 className="h-4 w-4" />
          )}
        </button>
      </div>
      
      {/* Status Badge */}
      <div className={cn(
        "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider shrink-0 backdrop-blur-sm border",
        status === 'published' 
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-lg shadow-emerald-500/10" 
          : status === 'generating'
          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-lg shadow-indigo-500/10 animate-pulse"
          : "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-lg shadow-amber-500/10"
      )}>
        {status === 'published' ? (isRTL ? 'منشور' : 'Live') : 
         status === 'generating' ? (isRTL ? 'بناء' : 'Building') :
         (isRTL ? 'مسودة' : 'Draft')}
      </div>
    </div>
  );
}
