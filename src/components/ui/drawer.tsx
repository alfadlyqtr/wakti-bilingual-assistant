import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/20 backdrop-blur-md transition-all duration-300",
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    side?: 'left' | 'right';
  }
>(({ className, children, side = 'right', ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  let hasTitle = false;
  let hasDescription = false;
  let titleIdToUse: string | undefined = undefined;
  let descriptionIdToUse: string | undefined = undefined;

  const processedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === DrawerHeader) {
        const headerChildren = React.Children.map(
          (child.props as any).children,
          (headerChild) => {
            if (React.isValidElement(headerChild)) {
              if (headerChild.type === DrawerTitle) {
                hasTitle = true;
                const existingId = (headerChild.props as any)?.id as string | undefined;
                titleIdToUse = existingId ?? titleId;
                return React.cloneElement(headerChild as React.ReactElement<any>, { id: titleIdToUse });
              }
              if (headerChild.type === DrawerDescription) {
                hasDescription = true;
                const existingId = (headerChild.props as any)?.id as string | undefined;
                descriptionIdToUse = existingId ?? descriptionId;
                return React.cloneElement(headerChild as React.ReactElement<any>, { id: descriptionIdToUse });
              }
            }
            return headerChild;
          }
        );
        return React.cloneElement(child as React.ReactElement<any>, { children: headerChildren });
      }
    }
    return child;
  });

  const setRefs = (node: HTMLDivElement) => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
    contentRef.current = node;
  };

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={setRefs}
        className={cn(
          "fixed top-0 z-50 h-full w-80 max-w-[80vw] flex flex-col",
          "bg-background shadow-lg focus:outline-none",
          side === 'right' ? 'right-0' : 'left-0',
          className
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => {
            const focusable = contentRef.current?.querySelector<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) focusable.focus();
            else if (contentRef.current) contentRef.current.focus();
          }, 50);
        }}
        onPointerDownOutside={(e) => {
          const isOverlay = (e.target as HTMLElement)?.hasAttribute('data-vaul-overlay');
          if (isOverlay) return;
          e.preventDefault();
        }}
        aria-labelledby={hasTitle ? titleIdToUse : undefined}
        aria-describedby={hasDescription ? descriptionIdToUse : undefined}
        {...props}
      >
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {processedChildren}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-white/90 dark:text-white/90",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-white/70 dark:text-white/70", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
