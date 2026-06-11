import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StudioGuestLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo: string;
  language: 'en' | 'ar';
}

export function StudioGuestLoginDialog({
  open,
  onOpenChange,
  redirectTo,
  language,
}: StudioGuestLoginDialogProps) {
  const navigate = useNavigate();
  const isArabic = language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-3xl border border-white/15 bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_35%,hsl(250_20%_10%)_100%)] text-white shadow-[0_8px_40px_hsla(210,100%,65%,0.22),0_4px_18px_hsla(280,70%,65%,0.18)]"
        title={isArabic ? 'هناك المزيد خلف الباب' : "There's more behind the door"}
        description={isArabic ? 'أنشئ حساباً مجانياً لفتح الدردشة بالذكاء الاصطناعي، أدوات الصوت، الفعاليات، وكل ما يقدمه وقتي.' : 'Create a free account to unlock AI chat, voice tools, events, and everything Wakti has to offer.'}
      >
        <DialogHeader className="space-y-3 text-left sm:text-left">
          <div className="inline-flex w-fit items-center rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            {isArabic ? 'مجاني للانضمام' : 'Free to join'}
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {isArabic ? 'هناك المزيد خلف الباب' : "There's more behind the door"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-7 text-white/72">
            {isArabic ? 'أنشئ حساباً مجانياً لفتح الدردشة بالذكاء الاصطناعي، أدوات الصوت، الفعاليات، وكل ما يقدمه وقتي.' : 'Create a free account to unlock AI chat, voice tools, events, and everything Wakti has to offer.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full rounded-2xl bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white shadow-[0_0_24px_hsla(210,100%,65%,0.35)] hover:opacity-95"
            onClick={() => {
              onOpenChange(false);
              navigate('/signup', { state: { from: redirectTo, guestUpgrade: true } });
            }}
          >
            {isArabic ? 'إنشاء حساب' : 'Create an account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
