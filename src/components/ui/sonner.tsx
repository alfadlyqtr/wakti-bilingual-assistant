
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
          background: theme === 'dark' ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
          border: theme === 'dark' ? '1px solid hsl(0 0% 14.9%)' : '1px solid hsl(0 0% 89.1%)',
          color: theme === 'dark' ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
        },
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
