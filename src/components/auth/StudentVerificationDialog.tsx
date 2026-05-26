import { Logo3D } from "@/components/Logo3D";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudentVerificationDialogProps {
  open: boolean;
  language: "en" | "ar";
  mode: "not_verified" | "integration_unavailable";
  portalUrl?: string | null;
  onContinueRegular: () => void;
  onClose: () => void;
}

export function StudentVerificationDialog({
  open,
  language,
  mode,
  portalUrl,
  onContinueRegular,
  onClose,
}: StudentVerificationDialogProps) {
  const isArabic = language === "ar";
  const resolvedPortalUrl = portalUrl || "https://www.realx.qa/";

  const title = mode === "not_verified"
    ? (isArabic ? "تعذر على realX مطابقة هذا البريد الطلابي" : "realX could not match this student email")
    : (isArabic ? "realX غير متاح الآن" : "realX is unavailable right now");

  const description = mode === "not_verified"
    ? (isArabic
      ? "يمكنك المتابعة بحساب وقتي غير طلابي، أو الإغلاق والمحاولة مرة أخرى لاحقاً."
      : "You can continue with a non-student Wakti account, or close and try again later.")
    : (isArabic
      ? "يمكنك الإغلاق والمحاولة مرة أخرى لاحقاً، أو المتابعة بحساب وقتي غير طلابي."
      : "You can close and try again later, or continue with a non-student Wakti account.");

  const continueLabel = isArabic ? "إنشاء حساب غير طلابي مع وقتي" : "Create a non-student account with Wakti";
  const closeLabel = isArabic ? "إغلاق" : "Close";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="max-w-md border-white/10 bg-[#0c0f14] text-white"
        title={title}
        description={description}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center justify-center rounded-full border border-white/10 bg-[#050507] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <img src="/realx.avif" alt="realX" className="h-7 w-auto" />
          </div>

          <a
            href={resolvedPortalUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-[hsl(210,100%,70%)] underline-offset-4 hover:underline"
          >
            {resolvedPortalUrl}
          </a>
        </div>

        <DialogHeader className={isArabic ? "gap-2 text-right" : "gap-2 text-center"}>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-white/70">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="h-auto justify-center gap-3 bg-[hsl(210,100%,65%)] px-4 py-3 text-white hover:bg-[hsl(210,100%,58%)]"
            onClick={onContinueRegular}
          >
            <Logo3D size="sm" className="pointer-events-none h-8 w-8 shrink-0" />
            <span>{continueLabel}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto border-white/15 bg-white/5 px-4 py-3 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
