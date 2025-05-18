
import { motion } from "framer-motion";
import { CircleCheck, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";

// Define types for our props and translations
type HomeAICapabilitiesProps = {
  translations: {
    aiSectionTitle: string;
    aiFeature1Title: string;
    aiFeature1Desc: string;
    aiFeature2Title: string;
    aiFeature2Desc: string;
    aiFeature3Title: string;
    aiFeature3Desc: string;
    aiFeature4Title: string;
    aiFeature4Desc: string;
  };
};

export function HomeAICapabilities({ translations }: HomeAICapabilitiesProps) {
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

  return (
    <motion.section 
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={containerVariants}
      className="px-4 py-8 bg-gradient-to-b from-transparent to-slate-50/5"
    >
      <motion.h2 
        variants={itemVariants}
        className="text-xl font-bold mb-6 text-center flex items-center justify-center gap-2"
      >
        <Bot className="h-5 w-5 text-blue-500" />
        {translations.aiSectionTitle}
      </motion.h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-indigo-500" /> {translations.aiFeature1Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.aiFeature1Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-fuchsia-500 to-violet-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-fuchsia-500" /> {translations.aiFeature2Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.aiFeature2Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-rose-500 to-red-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-rose-500" /> {translations.aiFeature3Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.aiFeature3Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-emerald-500" /> {translations.aiFeature4Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.aiFeature4Desc}</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  );
}
