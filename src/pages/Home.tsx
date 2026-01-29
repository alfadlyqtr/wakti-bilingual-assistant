import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";
import { Check, ArrowRight, Sparkles, Bot, Calendar, Mic, Users, MessageSquare, LogIn, Zap, Star, MonitorPlay } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useTheme();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Add public-page class to body for proper scrolling
  useEffect(() => {
    document.body.classList.add('public-page');
    return () => {
      document.body.classList.remove('public-page');
    };
  }, []);

  // Single monthly plan pricing (matches RevenueCat/Natively)
  const MONTHLY_PRICE_QAR = 95;
  const MONTHLY_PRICE_USD = 24.99;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const features = [
    {
      icon: Bot,
      title: t("waktiAiTitle", language),
      description: t("waktiAiDesc", language),
      gradient: "from-blue-500 via-purple-500 to-indigo-600",
      bgGradient: "from-blue-50 to-purple-50",
      iconColor: "text-blue-600"
    },
    {
      icon: Calendar,
      title: t("tasksRemindersTitle", language),
      description: t("tasksRemindersDesc", language),
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
      bgGradient: "from-emerald-50 to-teal-50",
      iconColor: "text-emerald-600"
    },
    {
      icon: Sparkles,
      title: t("maw3dEventsTitle", language),
      description: t("maw3dEventsDesc", language),
      gradient: "from-pink-500 via-rose-500 to-red-600",
      bgGradient: "from-pink-50 to-rose-50",
      iconColor: "text-pink-600"
    },
    {
      icon: Mic,
      title: t("tasjeelRecorderTitle", language),
      description: t("tasjeelRecorderDesc", language),
      gradient: "from-amber-500 via-orange-500 to-red-600",
      bgGradient: "from-amber-50 to-orange-50",
      iconColor: "text-amber-600"
    },
    {
      icon: MessageSquare,
      title: t("contactsMessagingTitle", language),
      description: t("contactsMessagingDesc", language),
      gradient: "from-violet-500 via-purple-500 to-fuchsia-600",
      bgGradient: "from-violet-50 to-purple-50",
      iconColor: "text-violet-600"
    },
    {
      icon: MonitorPlay,
      title: t("waktiPresentationsTitle", language),
      description: t("waktiPresentationsDesc", language),
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      bgGradient: "from-cyan-50 to-blue-50",
      iconColor: "text-cyan-600"
    }
  ];

  // Breakpoint-only rendering: show mobile and desktop/tablet variants using CSS
  return (
    <>
      {/* Mobile Variant */}
      <div className="block md:hidden">
        <div className="mobile-container">
          <MobileHeader title="WAKTI" showUserMenu={false}>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 border-primary/20 hover:border-primary/40"
                onClick={() => navigate('/login')}
              >
                {t("login", language)}
                <LogIn className="h-4 w-4" />
              </Button>
              <ThemeLanguageToggle />
            </div>
          </MobileHeader>
          <div className="flex-1 overflow-y-auto">
            {/* Hero Section (mobile) */}
            <section className="relative px-4 py-8">
              <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 text-center">
                <motion.div variants={itemVariants} className="mb-6">
                  <Logo3D size="lg" className="mx-auto mb-4" />
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">WAKTI</h1>
                    <Zap className="h-6 w-6 text-yellow-500" />
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">{t("mainTagline", language)}</p>
                </motion.div>
                <motion.div variants={itemVariants} className="mb-6">
                  <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white bg-clip-text text-transparent">
                    {t("heroSubtitle", language)}
                  </h2>
                </motion.div>
                <motion.div variants={itemVariants} className="mb-8">
                  <Button
                    size="lg"
                    className="w-full max-w-xs bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={() => navigate('/signup')}
                  >
                    <Star className="h-5 w-5 mr-2" />
                    {t("createAccountNow", language)}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            </section>
            {/* Features Section (mobile) */}
            <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={containerVariants} className="px-4 py-12">
              <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-2xl font-bold mb-3">{t("discoverFeatures", language)}</h2>
                <p className="text-muted-foreground text-sm">{t("perfectForEveryone", language)}</p>
              </motion.div>
              <div className="space-y-6 max-w-lg mx-auto">
                {features.map((feature, index) => (
                  <motion.div key={index} variants={itemVariants} className="group">
                    <Card className={`overflow-hidden border-0 shadow-lg bg-gradient-to-br ${feature.bgGradient} dark:from-slate-800/50 dark:to-slate-900/50`}>
                      <div className={`h-1 bg-gradient-to-r ${feature.gradient}`}></div>
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm ${feature.iconColor}`}>
                            <feature.icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">{feature.title}<Check className="h-4 w-4 text-green-500" /></h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>
          <Footer />
        </div>
      </div>

      {/* Desktop/Tablet Variant */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b border-border/50">
            <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Logo3D size="sm" />
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  WAKTI
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-primary/20 hover:border-primary/40 px-4 py-2"
                  onClick={() => navigate('/login')}
                >
                  {t("login", language)}
                  <LogIn className="h-4 w-4" />
                </Button>
                <ThemeLanguageToggle />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="w-full !h-auto !overflow-visible">
            {/* Hero Section */}
            <section className="relative py-20 lg:py-32 px-6 lg:px-8">
              <div className="absolute inset-0 opacity-50"></div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 text-center max-w-6xl mx-auto"
              >
                <motion.div variants={itemVariants} className="mb-12">
                  <Logo3D size="lg" className="mx-auto mb-8" />
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <h1 className="text-6xl lg:text-8xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      WAKTI
                    </h1>
                    <Zap className="h-12 w-12 lg:h-16 lg:w-16 text-yellow-500" />
                  </div>
                  <p className="text-2xl lg:text-3xl font-semibold text-muted-foreground max-w-4xl mx-auto">
                    {t("mainTagline", language)}
                  </p>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-12">
                  <h2 className="text-4xl lg:text-5xl font-bold mb-8 bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white bg-clip-text text-transparent max-w-4xl mx-auto">
                    {t("heroSubtitle", language)}
                  </h2>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-16">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-8 px-16 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xl"
                    onClick={() => navigate('/signup')}
                  >
                    <Star className="h-8 w-8 mr-4" />
                    {t("createAccountNow", language)}
                    <ArrowRight className="h-8 w-8 ml-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </section>

            {/* Features Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="py-20 lg:py-32 px-6 lg:px-8 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-900/20"
            >
              <motion.div variants={itemVariants} className="text-center mb-20">
                <h2 className="text-4xl lg:text-6xl font-bold mb-8 max-w-4xl mx-auto">
                  {t("discoverFeatures", language)}
                </h2>
                <p className="text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto">
                  {t("perfectForEveryone", language)}
                </p>
              </motion.div>

              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12">
                  {features.map((feature, index) => (
                    <motion.div key={index} variants={itemVariants} className="group">
                      <Card className={`overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br ${feature.bgGradient} dark:from-slate-800/50 dark:to-slate-900/50 h-full`}>
                        <div className={`h-2 bg-gradient-to-r ${feature.gradient}`}></div>
                        <div className="p-8 lg:p-10">
                          <div className="flex items-start gap-6">
                            <div className={`p-4 lg:p-5 rounded-xl bg-white dark:bg-slate-800 shadow-sm ${feature.iconColor}`}>
                              <feature.icon className="h-10 w-10 lg:h-12 lg:w-12" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-2xl lg:text-3xl mb-4 flex items-center gap-3">
                                {feature.title}
                                <Check className="h-6 w-6 lg:h-7 lg:w-7 text-green-500" />
                              </h3>
                              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
                                {feature.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Pricing Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="py-20 lg:py-32 px-6 lg:px-8"
            >
              <div className="max-w-6xl mx-auto">
                <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 rounded-3xl backdrop-blur-sm border border-indigo-100 dark:border-indigo-800/30 p-12 lg:p-20">
                  <motion.div variants={itemVariants} className="text-center mb-16">
                    <h2 className="text-4xl lg:text-6xl font-bold mb-8">
                      {t("chooseYourPlan", language)}
                    </h2>
                    <p className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                      {t("perfectForEveryone", language)}
                    </p>

                                      </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-12 lg:p-16 shadow-xl border border-white/50 dark:border-slate-700/50 max-w-2xl mx-auto"
                  >
                    <div className="text-center mb-16">
                      <div className="flex justify-center items-baseline gap-3 mb-4">
                        <span className="text-4xl font-bold text-foreground">QAR</span>
                        <span className="text-6xl lg:text-8xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {MONTHLY_PRICE_QAR}/month
                        </span>
                      </div>
                      <p className="text-xl text-muted-foreground">
                        ${MONTHLY_PRICE_USD}/month USD
                      </p>
                    </div>

                    <ul className="space-y-8 mb-16">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-6">
                          <div className={`p-3 rounded-full ${feature.iconColor} bg-white dark:bg-slate-800 shadow-sm`}>
                            <Check className="h-6 w-6" />
                          </div>
                          <span className="text-xl font-medium">{feature.title}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xl"
                      onClick={() => navigate('/signup')}
                    >
                      <Star className="h-8 w-8 mr-4" />
                      {t("createAccountNow", language)}
                      <ArrowRight className="h-8 w-8 ml-4" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.section>
          </main>

          <Footer />
        </div>
      </div>

    </>
  );
}
