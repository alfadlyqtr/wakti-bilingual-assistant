
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Shield, Smartphone, Zap, Brain, Calendar, MessageSquare, Mic } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function Home() {
  const { user } = useAuth();
  const { language } = useTheme();

  const features = [
    {
      icon: Brain,
      title: language === 'ar' ? "ذكاء اصطناعي متقدم" : "Advanced AI",
      description: language === 'ar' ? "مساعد ذكي لتنظيم مهامك وأحداثك" : "Smart assistant for organizing your tasks and events"
    },
    {
      icon: Calendar,
      title: language === 'ar' ? "تقويم موحد" : "Unified Calendar",
      description: language === 'ar' ? "جمع جميع مهامك وأحداثك في مكان واحد" : "Combine all your tasks and events in one place"
    },
    {
      icon: MessageSquare,
      title: language === 'ar' ? "رسائل ذكية" : "Smart Messaging",
      description: language === 'ar' ? "تواصل مع جهات الاتصال مع انتهاء صلاحية تلقائي" : "Connect with contacts with automatic expiry"
    },
    {
      icon: Mic,
      title: language === 'ar' ? "تسجيل وتلخيص" : "Record & Summarize",
      description: language === 'ar' ? "سجل الملاحظات الصوتية واحصل على ملخصات ذكية" : "Record voice notes and get smart summaries"
    }
  ];

  const benefits = [
    language === 'ar' ? "إدارة مهام ذكية مع الذكاء الاصطناعي" : "Smart task management with AI",
    language === 'ar' ? "تخطيط أحداث سهل وسريع" : "Easy and fast event planning",
    language === 'ar' ? "تذكيرات ذكية ومخصصة" : "Smart and personalized reminders",
    language === 'ar' ? "ملخصات صوتية فورية" : "Instant voice summaries",
    language === 'ar' ? "تقويم موحد لجميع أنشطتك" : "Unified calendar for all activities",
    language === 'ar' ? "رسائل آمنة مع انتهاء الصلاحية" : "Secure messages with expiry"
  ];

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {language === 'ar' ? "مرحباً بعودتك!" : "Welcome back!"}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? "انتقل إلى لوحة التحكم لمتابعة العمل" : "Go to dashboard to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <Link to="/dashboard">
                {language === 'ar' ? "فتح لوحة التحكم" : "Open Dashboard"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6 mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-primary">WAKTI</h1>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold max-w-3xl mx-auto">
            {language === 'ar' 
              ? "منصة ذكية مدعومة بالذكاء الاصطناعي لإدارة المهام والأحداث"
              : "AI-Powered Smart Platform for Task and Event Management"
            }
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {language === 'ar'
              ? "اكتشف قوة الذكاء الاصطناعي في تنظيم حياتك اليومية مع WAKTI - التطبيق الذي يجمع بين إدارة المهام الذكية، تخطيط الأحداث، الرسائل الآمنة، والتلخيص الصوتي المتقدم."
              : "Discover the power of AI in organizing your daily life with WAKTI - the app that combines smart task management, event planning, secure messaging, and advanced voice summarization."
            }
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button asChild size="lg" className="text-lg px-8 py-3">
              <Link to="/signup">
                {language === 'ar' ? "ابدأ مجاناً" : "Start Free"}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3">
              <Link to="/login">
                {language === 'ar' ? "تسجيل الدخول" : "Sign In"}
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <feature.icon className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <Card className="mb-12">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {language === 'ar' ? "لماذا WAKTI؟" : "Why WAKTI?"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security & Privacy */}
        <Card className="text-center">
          <CardHeader>
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-xl">
              {language === 'ar' ? "الأمان والخصوصية" : "Security & Privacy"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'ar'
                ? "نحن ملتزمون بحماية بياناتك وخصوصيتك. جميع بياناتك محمية ومشفرة وفقاً لأعلى معايير الأمان."
                : "We're committed to protecting your data and privacy. All your data is protected and encrypted according to the highest security standards."
              }
            </p>
            <Button asChild variant="outline">
              <Link to="/privacy-terms">
                {language === 'ar' ? "اقرأ سياسة الخصوصية" : "Read Privacy Policy"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center mt-12 pt-8 border-t border-border">
          <p className="text-muted-foreground text-sm">
            © 2025 WAKTI. {language === 'ar' ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>
        </footer>
      </div>
    </div>
  );
}
