import { ReactNode, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LandingSceneProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
  id?: string;
}

export const LandingScene = forwardRef<HTMLDivElement, LandingSceneProps>(
  ({ children, className, gradient, id }, ref) => {
    return (
      <motion.section
        ref={ref}
        id={id}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "landing-scene scroll-snap-scene relative flex flex-col items-center justify-center",
          "h-[100dvh] w-full overflow-hidden",
          "px-6 py-12",
          className
        )}
        style={{
          backgroundImage: gradient || undefined,
        }}
      >
        {children}
      </motion.section>
    );
  }
);

LandingScene.displayName = "LandingScene";
