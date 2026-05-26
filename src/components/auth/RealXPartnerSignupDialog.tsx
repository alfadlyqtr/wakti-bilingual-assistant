import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Sparkles, X } from "lucide-react";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { validateEmail, validatePassword } from "@/utils/validations";

interface RealXPartnerSignupDialogProps {
  open: boolean;
  loading: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: {
    email: string;
    password: string;
    agreedToTerms: boolean;
  }) => Promise<void> | void;
}

export function RealXPartnerSignupDialog({
  open,
  loading,
  errorMessage,
  onClose,
  onSubmit,
}: RealXPartnerSignupDialogProps) {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setAgreedToTerms(false);
      setShowPassword(false);
      setLocalError(null);
    }
  }, [open]);

  const copy = {
    en: {
      title: "Student signup with realX",
      description: "Use your student email and create a password. Your student email will be shared with realX to verify your student status before your Wakti account is created.",
      emailPlaceholder: "Student email",
      passwordPlaceholder: "Create a password",
      submit: "Verify with realX",
      termsPrefix: "I agree to the ",
      and: " and ",
      termsMiddle: ", and I allow my text, voice & image data to be used with trusted ",
      aiProviders: "AI providers",
      termsSuffix: " to power WAKTI.",
      errorTerms: "Please agree to the Privacy Policy and Terms of Service",
    },
    ar: {
      title: "تسجيل الطالب عبر realX",
      description: "استخدم بريدك الطلابي وأنشئ كلمة مرور. سيتم مشاركة بريدك الطلابي مع realX للتحقق من حالتك الطلابية قبل إنشاء حسابك في وقتي.",
      emailPlaceholder: "البريد الطلابي",
      passwordPlaceholder: "أنشئ كلمة مرور",
      submit: "تحقق عبر realX",
      termsPrefix: "أوافق على ",
      and: " و",
      termsMiddle: "، وأسمح باستخدام بياناتي النصية والصوتية والصورية مع ",
      aiProviders: "مزودي الذكاء الاصطناعي",
      termsSuffix: " لتشغيل وقتي.",
      errorTerms: "يرجى الموافقة على سياسة الخصوصية وشروط الخدمة",
    },
  }[language];

  const activeError = localError || errorMessage || null;

  const fieldClassName = cn(
    "h-12 rounded-2xl border pl-10 pr-10 text-[15px]",
    isDark
      ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
      : "border-[#060541]/10 bg-[#060541]/[0.03] text-[#060541] placeholder:text-[#060541]/45"
  );

  const handleTermsNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setLocalError(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }

    if (!agreedToTerms) {
      setLocalError(copy.errorTerms);
      return;
    }

    await onSubmit({
      email: email.trim(),
      password,
      agreedToTerms,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        hideCloseButton
        className={cn(
          "max-w-[430px] overflow-hidden rounded-[30px] border p-0",
          isDark ? "border-white/10 bg-[#0c0f14] text-white" : "border-[#060541]/10 bg-[#fcfefd] text-[#060541]"
        )}
        title={copy.title}
        description={copy.description}
      >
        <div className="relative px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              isDark ? "bg-white/5 text-white/80 hover:bg-white/10" : "bg-[#060541]/[0.06] text-[#060541]/70 hover:bg-[#060541]/[0.1]"
            )}
            aria-label={language === "ar" ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-5 flex items-start justify-between gap-3 pr-12">
            <div>
              <h2 className="text-[1.45rem] font-bold leading-tight">{copy.title}</h2>
            </div>
            <ThemeLanguageToggle />
          </div>

          <div className={cn(
            "mb-5 rounded-[28px] border px-4 py-4",
            isDark ? "border-white/10 bg-white/[0.03]" : "border-[#060541]/10 bg-[#060541]/[0.025]"
          )}>
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <Logo3D size="sm" />
              <div className={cn("h-px w-6", isDark ? "bg-white/15" : "bg-[#060541]/15")} />
              <div className="inline-flex min-w-[132px] items-center justify-center rounded-full border border-white/10 bg-[#050507] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <img src="/realx.avif" alt="realX" className="h-8 w-auto" />
              </div>
            </div>
            <p className={cn("mt-4 text-center text-[13px] leading-6", isDark ? "text-white/70" : "text-[#060541]/70")}>
              {copy.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeError ? (
              <div className={cn(
                "rounded-2xl border px-3.5 py-3 text-[13px] font-medium",
                isDark ? "border-red-400/25 bg-red-500/10 text-red-200" : "border-red-500/20 bg-red-500/8 text-red-700"
              )}>
                {activeError}
              </div>
            ) : null}

            <div className="relative">
              <Mail className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isDark ? "text-white/45" : "text-[#060541]/45")} />
              <Input
                id="realx-student-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.emailPlaceholder}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={loading}
                className={fieldClassName}
              />
            </div>

            <div className="relative">
              <Lock className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isDark ? "text-white/45" : "text-[#060541]/45")} />
              <Input
                id="realx-student-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.passwordPlaceholder}
                autoCapitalize="none"
                autoComplete="new-password"
                disabled={loading}
                className={fieldClassName}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={cn("absolute right-3 top-1/2 -translate-y-1/2 transition-opacity", isDark ? "text-white/45 hover:text-white/80" : "text-[#060541]/45 hover:text-[#060541]/80")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <Checkbox
                id="realx-terms"
                checked={agreedToTerms}
                onCheckedChange={(value) => setAgreedToTerms(value as boolean)}
                disabled={loading}
                className={cn(
                  "mt-[2px] h-5 w-5 rounded-md border-2",
                  isDark ? "border-[#b14dff] data-[state=checked]:border-[#b14dff]" : "border-[#060541] data-[state=checked]:border-[#060541]"
                )}
              />
              <label htmlFor="realx-terms" className={cn("cursor-pointer text-[12px] leading-6", isDark ? "text-white/62" : "text-[#060541]/68")}>
                {copy.termsPrefix}
                <button type="button" onClick={() => handleTermsNavigate("/privacy-terms")} className={cn("font-bold underline decoration-dotted underline-offset-2", isDark ? "text-[hsl(210,100%,70%)]" : "text-[#060541]")}>
                  {language === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                </button>
                {copy.and}
                <button type="button" onClick={() => handleTermsNavigate("/privacy-terms")} className={cn("font-bold underline decoration-dotted underline-offset-2", isDark ? "text-[hsl(210,100%,70%)]" : "text-[#060541]")}>
                  {language === "ar" ? "شروط الخدمة" : "Terms of Service"}
                </button>
                {copy.termsMiddle}
                <button type="button" onClick={() => handleTermsNavigate("/privacy-terms#ai-providers")} className={cn("font-semibold", isDark ? "text-[hsl(45,100%,60%)]" : "text-[hsl(25,95%,40%)]")}>
                  {copy.aiProviders}
                </button>
                {copy.termsSuffix}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-all",
                isDark
                  ? "bg-[linear-gradient(135deg,#1f7cf2_0%,#7c4dff_100%)] text-white shadow-[0_10px_28px_rgba(31,124,242,0.24)] hover:brightness-110"
                  : "bg-[linear-gradient(135deg,#060541_0%,#1776dd_100%)] text-white shadow-[0_10px_26px_rgba(6,5,65,0.18)] hover:brightness-105"
              )}
            >
              {loading
                ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <Sparkles className="h-4 w-4" />}
              <span>{copy.submit}</span>
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
