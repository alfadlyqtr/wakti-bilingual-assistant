
import { ReactNode } from "react";
import { MobileNav } from "@/components/MobileNav";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="mobile-container">
      {children}
      <MobileNav />
    </div>
  );
}
