
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
      "inline-flex h-16 items-center justify-center gap-1 rounded-xl bg-muted/30 p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex flex-col items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "bg-background border border-border shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:scale-[1.02] data-[state=active]:border-primary",
      "touch-manipulation select-none cursor-pointer",
      "min-h-[56px] min-w-[80px] gap-0.5", // Increased height for two lines
      className
    )}
    {...props}
  >
    {typeof children === 'string' ? (
      children.split(' ').length > 1 ? (
        // Split text into two lines for multi-word labels
        <>
          <span className="leading-tight">{children.split(' ')[0]}</span>
          <span className="leading-tight">{children.split(' ').slice(1).join(' ')}</span>
        </>
      ) : (
        <span className="leading-tight">{children}</span>
      )
    ) : (
      children
    )}
  </TabsPrimitive.Trigger>
))
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
