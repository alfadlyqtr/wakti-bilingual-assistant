
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

// Define types for our props and translations
type HomePricingProps = {
  translations: {
    monthly: string;
    yearly: string;
    monthlyPrice: string;
    yearlyPrice: string;
    trial: string;
    feature1Title: string;
    feature2Title: string;
    feature3Title: string;
    feature4Title: string;
  };
  accentBg: string;
  language: "en" | "ar";
};

export function HomePricing({ translations, accentBg, language }: HomePricingProps) {
  const [pricingPlan, setPricingPlan] = useState("monthly");
  const navigate = useNavigate();
  
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
      viewport={{ once: true, margin: "-50px" }}
      variants={containerVariants}
      className={`px-4 py-8 mx-4 my-4 rounded-2xl ${accentBg} backdrop-blur-sm`}
    >
      <motion.div 
        variants={itemVariants}
        className="text-center mb-5"
      >
        <div className="inline-flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full p-1 border mb-6 shadow-sm">
          <Button 
            size="sm" 
            variant={pricingPlan === "monthly" ? "default" : "ghost"}
            className="rounded-full text-xs px-4"
            onClick={() => setPricingPlan("monthly")}
          >
            {translations.monthly}
          </Button>
          <Button 
            size="sm"
            variant={pricingPlan === "yearly" ? "default" : "ghost"}
            className="rounded-full text-xs px-4"
            onClick={() => setPricingPlan("yearly")}
          >
            {translations.yearly}
          </Button>
        </div>
        
        <motion.div 
          key={pricingPlan}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-background/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border max-w-xs mx-auto"
        >
          <div className="flex justify-between items-baseline mb-6">
            <h3 className="text-2xl font-bold">
              {pricingPlan === "monthly" ? translations.monthlyPrice : translations.yearlyPrice}
            </h3>
            {pricingPlan === "yearly" && (
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                {language === 'en' ? 'SAVE 17%' : 'وفر 17٪'}
              </span>
            )}
          </div>
          
          <ul className="space-y-3 mb-6 text-sm">
            <li className="flex items-start">
              <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
              <span>{translations.feature1Title}</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
              <span>{translations.feature2Title}</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
              <span>{translations.feature3Title}</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
              <span>{translations.feature4Title}</span>
            </li>
          </ul>
          
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            onClick={() => navigate('/signup')}
          >
            {translations.trial}
          </Button>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
