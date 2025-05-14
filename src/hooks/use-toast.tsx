
import * as React from "react"
import { 
  Toast,
  ToastClose, 
  ToastDescription, 
  ToastProvider, 
  ToastTitle, 
  ToastViewport,
} from "@/components/ui/toast"
import { useToast as useToastPrimitive } from "@/components/ui/use-toast"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const ToasterToast = ({ ...props }) => {
  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {props.title && <ToastTitle>{props.title}</ToastTitle>}
        {props.description && (
          <ToastDescription>{props.description}</ToastDescription>
        )}
      </div>
      <ToastClose />
    </Toast>
  )
}

export function Toaster() {
  const { toasts } = useToastPrimitive()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <ToasterToast
            key={id}
            {...props}
            title={title}
            description={description}
            action={action}
          />
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

// Custom hook to create toasts with a simpler API
export const useToast = () => {
  const { toast: originalToast } = useToastPrimitive()
  const [openConfirm, setOpenConfirm] = React.useState(false)
  const [confirmData, setConfirmData] = React.useState<{
    title: string
    description: string
    onConfirm: () => void
    onCancel?: () => void
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  })

  // Simple alert function
  const toast = (props: { title: string; description?: string; variant?: "default" | "destructive" }) => {
    originalToast({
      ...props,
      variant: props.variant || "default",
    })
  }

  // Confirmation dialog
  const confirm = (props: {
    title: string
    description: string
    onConfirm: () => void
    onCancel?: () => void
  }) => {
    setConfirmData(props)
    setOpenConfirm(true)
  }

  const ConfirmationDialog = () => (
    <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmData.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmData.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (confirmData.onCancel) confirmData.onCancel()
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmData.onConfirm()
              setOpenConfirm(false)
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return {
    toast,
    confirm,
    ConfirmationDialog,
  }
}

// Export standalone toast function for easy use
export const toast = (props: { title: string; description?: string; variant?: "default" | "destructive" }) => {
  const { toast: originalToast } = useToastPrimitive()
  originalToast({
    ...props,
    variant: props.variant || "default",
  })
}

// Export standalone confirm function
export const confirm = (props: {
  title: string
  description: string
  onConfirm: () => void
  onCancel?: () => void
}) => {
  throw new Error("The standalone confirm function can only be used inside a component. Use useToast().confirm instead.")
}
