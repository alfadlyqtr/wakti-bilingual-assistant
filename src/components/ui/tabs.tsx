
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "w-full flex justify-start gap-3",
      "rounded-2xl p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  // Normalize children: unwrap any interactive elements to plain content to avoid nested controls
  const normalizedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const anyChild = child as any;
      const isInteractive = anyChild.type === 'button' || anyChild.props?.role === 'button' || typeof anyChild.props?.onClick === 'function';
      if (isInteractive) {
        const inner = anyChild.props?.children;
        return <span className="leading-tight">{inner}</span>;
      }
    }
    return child;
  });

  return (
    <TabsPrimitive.Trigger asChild ref={ref} {...props}>
      <div
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium",
          // Base button look (at rest)
          "border border-border bg-card text-foreground/90 shadow-sm",
          // Hover subtle lift
          "hover:shadow-md hover:-translate-y-[1px]",
          // Active: brand gradient + glass (no underline)
          "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg",
          "data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/15 data-[state=active]:to-violet-500/15 data-[state=active]:backdrop-blur-sm",
          // Remove underline pseudo-element
          "relative after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0 after:bg-transparent",
          "transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
      >
        {/* Wrap all children in a non-interactive container to prevent accidental nested buttons */}
        <span className="inline-flex items-center gap-1 pointer-events-none select-none">
          {normalizedChildren}
        </span>
      </div>
    </TabsPrimitive.Trigger>
  );
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
