
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { t } from "@/utils/translations";
import {
  Check,
  Calendar,
  Bell,
  MessageSquare,
  User,
  List,
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { language } = useTheme();

  const features = [
    {
      icon: List,
      title: "taskManagement",
      description: "taskDesc",
    },
    {
      icon: Calendar,
      title: "calendar",
      description: "calendarDesc",
    },
    {
      icon: Bell,
      title: "reminders",
      description: "remindersDesc",
    },
    {
      icon: MessageSquare,
      title: "messaging",
      description: "messagingDesc",
    },
  ];

  const pricingPlans = [
    {
      title: "monthly",
      priceQAR: 55,
      priceUSD: 15,
    },
    {
      title: "yearly",
      priceQAR: 550,
      priceUSD: 150,
    },
  ];

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <h1 className="text-2xl font-bold">{t("appName", language)}</h1>
        <ThemeLanguageToggle />
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <section className="py-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold mb-4">{t("appName", language)}</h1>
            <p className="text-xl text-muted-foreground mb-6">
              {t("tagline", language)}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full text-base py-6"
                onClick={() => navigate("/signup")}
              >
                {t("startFreeTrial", language)}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full text-base py-6"
                onClick={() => navigate("/login")}
              >
                {t("login", language)}
              </Button>
            </div>
          </motion.div>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold mb-5 text-center">
              {t("features", language)}
            </h2>
            <div className="grid grid-cols-1 gap-4 mb-10">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-card p-4 rounded-xl shadow-sm border border-border"
                >
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-2 rounded-lg mr-4">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">
                        {t(feature.title, language)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t(feature.description, language)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Pricing Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-10"
          >
            <h2 className="text-2xl font-bold mb-5 text-center">
              {t("pricing", language)}
            </h2>
            <div className="bg-card p-4 rounded-xl border border-border mb-4">
              <p className="text-center font-medium mb-2">
                {t("freeTrialDays", language)}
              </p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">
                    {t("features", language)} {t("taskManagement", language)}
                  </span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">
                    {t("aiSummaries", language)}
                  </span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {pricingPlans.map((plan, index) => (
                <div
                  key={index}
                  className="bg-card p-4 rounded-xl border border-border text-center"
                >
                  <h3 className="font-medium mb-2">
                    {t(plan.title, language)}
                  </h3>
                  <div className="text-2xl font-bold mb-1">
                    {plan.priceQAR} {t("qar", language)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ≈ {plan.priceUSD} {t("usd", language)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
