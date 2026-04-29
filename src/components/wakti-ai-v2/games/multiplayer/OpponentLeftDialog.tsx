import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DoorOpen, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  language: string;
  gameName: string;
  onAcknowledge: () => void;
}

export function OpponentLeftDialog({ open, language, gameName, onAcknowledge }: Props) {
  const isAr = language === 'ar';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onAcknowledge(); }}>
      <DialogContent
        hideCloseButton
        title={isAr ? 'غادر اللاعب الآخر اللعبة' : 'The other player left the game'}
        description={isAr ? 'انتهت اللعبة لأن اللاعب الآخر غادر.' : 'The game ended because the other player left.'}
        className="w-[calc(100%-24px)] max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c0f14] via-[#161824] to-[#0c0f14] p-0 text-white shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_30px_rgba(124,58,237,0.25)]"
        overlayClassName="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-sm"
      >
        <div className="relative p-6 sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_40%)]" />
          <div className="relative flex flex-col items-center text-center gap-4" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/25 via-indigo-500/20 to-blue-500/25 ring-1 ring-white/10 shadow-[0_0_25px_rgba(124,58,237,0.35)]">
              <DoorOpen className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
                <Sparkles className="h-3.5 w-3.5" />
                {gameName}
              </div>
              <h3 className="text-xl font-semibold leading-tight text-white">
                {isAr ? 'اللاعب الآخر غادر اللعبة' : 'The other player left the game'}
              </h3>
              <p className="text-sm leading-6 text-white/75">
                {isAr
                  ? 'لا تقلق، انتهت هذه الجولة. يمكنك الرجوع والبدء من جديد متى أحببت.'
                  : 'No worries — this round is over. You can head back and start a new one anytime.'}
              </p>
            </div>

            <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {isAr ? 'تم إنهاء المباراة لأن الخصم اختار المغادرة.' : 'This match was ended because your opponent chose to leave.'}
            </div>

            <Button
              onClick={onAcknowledge}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-blue-700 text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] hover:opacity-95"
            >
              {isAr ? 'حسناً' : 'Got it'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
