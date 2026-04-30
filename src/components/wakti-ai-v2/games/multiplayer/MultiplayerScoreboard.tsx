import React from 'react';

interface Props {
  language: string;
  leftName: string;
  leftScore: number;
  rightName: string;
  rightScore: number;
}

export function MultiplayerScoreboard({ language, leftName, leftScore, rightName, rightScore }: Props) {
  const isAr = language === 'ar';

  return (
    <div className="rounded-xl border border-[#E9CEB0]/40 bg-gradient-to-br from-white via-[#f9fbff] to-[#eef8ff] p-2 shadow-[0_8px_24px_rgba(6,5,65,0.12)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#171922] dark:via-[#12141c] dark:to-[#0d1016] dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
      <div className="mb-1 text-center text-[10px] uppercase tracking-[0.18em] text-[#060541]/45 dark:text-white/45">
        {isAr ? 'النتيجة' : 'Score'}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="rounded-lg border border-blue-300/50 bg-blue-500/10 px-2.5 py-1.5 text-center dark:border-blue-400/20 dark:bg-blue-500/10">
          <div className="truncate text-[11px] text-[#060541]/65 dark:text-white/65">{leftName}</div>
          <div className="text-lg font-bold leading-none text-[#060541] dark:text-white">{leftScore}</div>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#060541]/35 dark:text-white/35">VS</div>
        <div className="rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-2.5 py-1.5 text-center dark:border-blue-400/20 dark:bg-blue-500/10">
          <div className="truncate text-[11px] text-[#060541]/65 dark:text-white/65">{rightName}</div>
          <div className="text-lg font-bold leading-none text-[#060541] dark:text-white">{rightScore}</div>
        </div>
      </div>
    </div>
  );
}
