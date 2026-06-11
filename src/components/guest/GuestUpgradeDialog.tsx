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

interface GuestUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'en' | 'ar';
  title?: string;
  description?: string;
}

export function GuestUpgradeDialog({
  open,
  onOpenChange,
  language,
  title,
  description,
}: GuestUpgradeDialogProps) {
  const navigate = useNavigate();
  const isArabic = language === 'ar';

  const resolvedTitle = title || (isArabic ? 'هذا متاح للحساب الكامل فقط' : 'This is available for full accounts only');
  const resolvedDescription = description || (isArabic
    ? 'يمكنك الاستمرار كضيف في دردشة وقتي فقط. لفتح الدراسة، البحث، الصور، والمزايا الذكية الأخرى، اربط حسابك بالبريد الإلكتروني أو سجّل الدخول.'
    : 'You can continue as a guest in Wakti chat only. To unlock study mode, search, images, and other AI features, link your account with email or log in.');

  const goTo = (path: string) => {
    onOpenChange(false);
    navigate(path, { state: { from: '/wakti-ai-v2', guestUpgrade: true } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-3xl border border-white/15 bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_35%,hsl(250_20%_10%)_100%)] text-white shadow-[0_8px_40px_hsla(210,100%,65%,0.22),0_4px_18px_hsla(280,70%,65%,0.18)]"
        title={resolvedTitle}
        description={resolvedDescription}
      >
        <DialogHeader className="space-y-3 text-left sm:text-left">
          <div className="inline-flex w-fit items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            {isArabic ? 'وضع الضيف' : 'Guest Mode'}
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-7 text-white/72">
            {resolvedDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full rounded-2xl bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white shadow-[0_0_24px_hsla(210,100%,65%,0.35)] hover:opacity-95"
            onClick={() => goTo('/signup')}
          >
            {isArabic ? 'إنشاء حساب' : 'Sign up'}
          </Button>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => goTo('/login')}
            >
              {isArabic ? 'تسجيل الدخول' : 'Log in'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
              onClick={() => goTo('/signup')}
            >
              {isArabic ? 'المتابعة بحساب كامل' : 'Continue with full account'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
