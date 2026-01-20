
import { useTheme } from "@/providers/ThemeProvider"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      duration={4000}
      visibleToasts={5}
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        style: {
          background:
            theme === 'dark'
              ? 'linear-gradient(135deg, rgba(12,15,20,0.9) 0%, rgba(20,24,32,0.85) 45%, rgba(12,15,20,0.9) 100%)'
              : 'linear-gradient(135deg, rgba(252,254,253,0.9) 0%, rgba(245,247,248,0.85) 45%, rgba(252,254,253,0.9) 100%)',
          border:
            theme === 'dark'
              ? '1px solid rgba(96,96,98,0.35)'
              : '1px solid rgba(6,5,65,0.12)',
          color: theme === 'dark' ? '#f2f2f2' : '#060541',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        },
        classNames: {
          toast:
            'group toast rounded-xl border shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
