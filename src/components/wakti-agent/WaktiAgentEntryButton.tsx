import { Sparkles } from 'lucide-react';

interface WaktiAgentEntryButtonProps {
  label: string;
  onClick: () => void;
  subtle?: boolean;
}

export function WaktiAgentEntryButton({ label, onClick, subtle = false }: WaktiAgentEntryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
        subtle
          ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
          : 'border-[#e9ceb0]/30 bg-[linear-gradient(135deg,rgba(6,5,65,0.92)_0%,rgba(28,36,76,0.95)_100%)] text-[#f2f2f2] shadow-[0_8px_24px_rgba(6,5,65,0.28)]'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
