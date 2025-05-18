
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";

// Define types for our props and translations
type HomeHeroProps = {
  translations: {
    tagline: string;
    description: string;
    trial: string;
    loginBtn: string;
  };
};

export function HomeHero({ translations }: HomeHeroProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  // Define motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  // Define colors based on theme
  const primaryBg = theme === "dark" ? "bg-dark-bg" : "bg-light-bg";
  const primaryText = theme === "dark" ? "text-white" : "text-light-primary";

  return (
    <section className={`${primaryBg} px-4 py-6`}>
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="mb-6"
      >
        <motion.div variants={itemVariants}>
          <Logo3D size="lg" className="mx-auto mb-2" />
        </motion.div>
        
        <motion.h1 
          variants={itemVariants} 
          className={`text-3xl font-bold mb-2 ${primaryText}`}
        >
          {translations.tagline}
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto"
        >
          {translations.description}
        </motion.p>
        
        <motion.div variants={itemVariants} className="mt-6 flex flex-col gap-3 max-w-xs mx-auto">
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            onClick={() => navigate('/signup')}
          >
            {translations.trial}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          
          <Button 
            variant="outline"
            size="lg" 
            className="w-full"
            onClick={() => navigate('/login')}
          >
            {translations.loginBtn}
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
