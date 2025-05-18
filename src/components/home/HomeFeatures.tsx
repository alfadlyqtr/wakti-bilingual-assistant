
import { motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

// Define types for our props and translations
type HomeFeaturesProps = {
  translations: {
    featureSectionTitle: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    feature4Title: string;
    feature4Desc: string;
  };
};

export function HomeFeatures({ translations }: HomeFeaturesProps) {
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
      className="px-4 py-8"
    >
      <motion.h2 
        variants={itemVariants}
        className="text-xl font-bold mb-6 text-center"
      >
        {translations.featureSectionTitle}
      </motion.h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-blue-500" /> {translations.feature1Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.feature1Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-purple-500 to-pink-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-purple-500" /> {translations.feature2Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.feature2Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-amber-500 to-orange-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-amber-500" /> {translations.feature3Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.feature3Desc}</p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-green-500 to-teal-400 h-2"></div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-1 flex items-center">
                <CircleCheck className="h-5 w-5 mr-2 text-green-500" /> {translations.feature4Title}
              </h3>
              <p className="text-sm text-muted-foreground">{translations.feature4Desc}</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  );
}
