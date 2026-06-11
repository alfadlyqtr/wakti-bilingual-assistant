import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Mail } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

interface EmailConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: "signup" | "guest_upgrade";
}

export const EmailConfirmationDialog: React.FC<EmailConfirmationDialogProps> = ({
  open,
  onClose,
  mode = "signup",
}) => {
  const { language } = useTheme();

  // Translations
  const messages = {
    en: {
      signupTitle: "Account Created Successfully!",
      signupDescription: "To log in, you must confirm your email first. Please check your inbox for a confirmation link.",
      upgradeTitle: "Upgrade Email Sent!",
      upgradeDescription: "Please check your inbox and confirm your email to finish upgrading your guest account.",
      button: "Got it",
    },
    ar: {
      signupTitle: "تم إنشاء الحساب بنجاح!",
      signupDescription: "لتسجيل الدخول، يجب عليك تأكيد بريدك الإلكتروني أولاً. يرجى التحقق من بريدك للحصول على رابط التأكيد.",
      upgradeTitle: "تم إرسال رابط الترقية!",
      upgradeDescription: "يرجى التحقق من بريدك الإلكتروني وتأكيده لإكمال ترقية حساب الضيف.",
      button: "تم",
    },
  };

  const t = messages[language] || messages.en;
  const title = mode === "guest_upgrade" ? t.upgradeTitle : t.signupTitle;
  const description = mode === "guest_upgrade" ? t.upgradeDescription : t.signupDescription;

  // Remove onPointerDownOutside (not valid on AlertDialogContent)
  // Basic mobile-friendly alert style; RTL support automatically applies via theme
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm w-full rounded-2xl p-6 text-center" onEscapeKeyDown={onClose}>
        <AlertDialogHeader>
          <div className="flex flex-col items-center">
            <span className="bg-primary/10 rounded-full p-3 mb-2">
              <Mail className="h-8 w-8 text-primary" />
            </span>
            <AlertDialogTitle className="text-xl font-bold mb-1">
              {title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="mb-4 text-base">
          {description}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogAction
            className="w-full rounded-lg py-3 text-base font-medium"
            onClick={onClose}
          >
            {t.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
