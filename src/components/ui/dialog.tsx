import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
  suppressHydrationWarning?: boolean;
  /**
   * Required for accessibility. Can be hidden with VisuallyHidden if needed.
   */
  title?: React.ReactNode;
  /**
   * Optional description for screen readers
   */
  description?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ 
  className, 
  children, 
  hideCloseButton = false, 
  suppressHydrationWarning = true,
  title,
  description,
  ...props 
}, ref) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

  // Process children to find title and description if not provided as props
  let hasTitle = false;
  let hasDescription = false;
  let processedChildren = children;

  if (!hasTitle || !hasDescription) {
    processedChildren = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child;

      // Handle DialogHeader
      if (child.type === DialogHeader) {
        const headerChildren = React.Children.map(
          (child.props as any).children,
          (headerChild) => {
            if (!React.isValidElement(headerChild)) return headerChild;
            
            if (headerChild.type === DialogTitle) {
              hasTitle = true;
              return React.cloneElement(headerChild as React.ReactElement, { id: titleId } as any);
            }
            if (headerChild.type === DialogDescription) {
              hasDescription = true;
              return React.cloneElement(headerChild as React.ReactElement, { id: descriptionId } as any);
            }
            return headerChild;
          }
        );
        return React.cloneElement(child as React.ReactElement, { children: headerChildren } as any);
      }

      // Direct DialogTitle or DialogDescription
      if (child.type === DialogTitle) {
        hasTitle = true;
        return React.cloneElement(child as React.ReactElement, { id: titleId } as any);
      }
      if (child.type === DialogDescription) {
        hasDescription = true;
        return React.cloneElement(child as React.ReactElement, { id: descriptionId } as any);
      }
      
      return child;
    });
  }

  // Add default title if none provided
  if (!hasTitle) {
    processedChildren = (
      <>
        <DialogTitle className="sr-only" id={titleId}>
          {title || 'Dialog'}
        </DialogTitle>
        {processedChildren}
      </>
    );
    hasTitle = true;
  }

  // Add default description if none provided
  if (!hasDescription) {
    processedChildren = (
      <>
        {processedChildren}
        <DialogDescription className="sr-only" id={descriptionId}>
          {description || 'Dialog content'}
        </DialogDescription>
      </>
    );
    hasDescription = true;
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        suppressHydrationWarning={suppressHydrationWarning}
        {...props}
      >
        {processedChildren}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
