
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

interface Logo3DProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export function Logo3D({ className, size = "md", onClick }: Logo3DProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };

  return (
    <div 
      className={cn(
        sizeClasses[size], 
        "relative cursor-pointer transition-transform hover:scale-105",
        className
      )}
      onClick={onClick}
    >
      <AspectRatio ratio={1/1} className="rounded-xl overflow-hidden">
        <div className="w-full h-full relative">
          {/* Base layer - shadow */}
          <div className="absolute inset-0 bg-primary/10 translate-x-1 translate-y-1 rounded-xl"></div>
          
          {/* Middle layer - glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-xl"></div>
          
          {/* Top layer - logo with shadow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" 
              alt="WAKTI Logo"
              className="w-full h-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]"
            />
          </div>
          
          {/* Highlight overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 rounded-xl opacity-70"></div>
        </div>
      </AspectRatio>
    </div>
  );
}
