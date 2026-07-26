import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function RedesignRoomChoiceSection({
  icon: Icon,
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border transition-colors ${
      isOpen
        ? 'border-sky-300/45 bg-white dark:border-sky-300/35 dark:bg-black/25'
        : 'border-[#d9e7f5] bg-[#f7fbff] dark:border-sky-300/15 dark:bg-black/[0.14]'
    }`}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-sky-50/70 dark:hover:bg-white/[0.05]"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-700 dark:text-sky-200">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold text-foreground">{title}</span>
          <span className="block truncate text-[10px] font-bold text-sky-700 dark:text-sky-200">{summary}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-sky-700 transition-transform duration-200 dark:text-sky-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-[#e4eef8] px-3 py-3 dark:border-sky-300/10">
          {children}
        </div>
      )}
    </div>
  );
}
