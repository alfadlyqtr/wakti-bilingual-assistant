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
}

export const EmailConfirmationDialog: React.FC<EmailConfirmationDialogProps> = ({
  open,
  onClose,
}) => {
  const { language } = useTheme();

  // Translations
  const messages = {
    en: {
      title: "Account Created Successfully!",
      description: "To log in, you must confirm your email first. Please check your inbox for a confirmation link.",
      button: "Got it",
    },
    ar: {
      title: "تم إنشاء الحساب بنجاح!",
      description: "لتسجيل الدخول، يجب عليك تأكيد بريدك الإلكتروني أولاً. يرجى التحقق من بريدك للحصول على رابط التأكيد.",
      button: "تم",
    },
  };

  const t = messages[language] || messages.en;

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
              {t.title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="mb-4 text-base">
          {t.description}
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
