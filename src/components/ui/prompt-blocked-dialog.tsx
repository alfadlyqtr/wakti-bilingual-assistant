import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PromptBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  language: string;
}

export function PromptBlockedDialog({ open, onOpenChange, message, language }: PromptBlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl border border-orange-200/70 bg-white/95 shadow-2xl dark:border-orange-500/20 dark:bg-slate-950/95">
        <AlertDialogHeader className="text-center sm:text-center">
          <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {language === 'ar' ? 'لا يمكن استخدام هذا الوصف' : 'This prompt cannot be used'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-7 text-slate-700 dark:text-slate-300">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction className="min-w-28 rounded-xl bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-500">
            {language === 'ar' ? 'حسنًا' : 'OK'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
