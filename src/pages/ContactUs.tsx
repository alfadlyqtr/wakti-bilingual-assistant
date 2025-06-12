
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone } from "lucide-react";

export default function ContactUs() {
  const { language } = useTheme();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(t("messageSubmitted", language));
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="mobile-container">
      <MobileHeader title={t("contactUs", language)} showBackButton={true}>
        <ThemeLanguageToggle />
      </MobileHeader>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">{t("getInTouch", language)}</h1>
            <p className="text-muted-foreground text-sm">
              {t("contactDescription", language)}
            </p>
          </div>

          <div className="grid gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">support@wakti.qa</p>
                  <p className="text-xs text-muted-foreground">{t("emailSupport", language)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("sendMessage", language)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("name", language)}</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t("enterYourName", language)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">{t("email", language)}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("enterYourEmail", language)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="subject">{t("subject", language)}</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder={t("enterSubject", language)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message">{t("message", language)}</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t("enterYourMessage", language)}
                    rows={4}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("sending", language) : t("sendMessage", language)}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
