
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, MessageCircle, CheckCircle, ArrowLeft, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ContactUs() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    submissionType: "contact"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleBackClick = () => {
    navigate("/home");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log('Submitting contact form with data:', formData);
      
      const { data, error } = await supabase.functions.invoke('submit-contact-form', {
        body: formData
      });

      if (error) {
        console.error('Error submitting contact form:', error);
        throw error;
      }

      console.log('Contact form submitted successfully:', data);
      toast.success(t("messageSubmitted", language));
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit contact form:', error);
      toast.error(language === "ar" 
        ? "فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى." 
        : "Failed to send message. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setFormData({ name: "", email: "", subject: "", message: "", submissionType: "contact" });
  };

  // Thank you state
  if (isSubmitted) {
    return (
      <div className="mobile-container">
        <MobileHeader title={t("contactUs", language)} showBackButton={true} onBackClick={handleBackClick}>
          <ThemeLanguageToggle />
        </MobileHeader>
        
        <div className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="px-4 py-6 w-full max-w-md">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-primary">
                  {language === "ar" ? "شكراً لك!" : "Thank You!"}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {language === "ar" 
                    ? "تم إرسال رسالتك بنجاح. سنقوم بالرد عليك في أقرب وقت ممكن."
                    : "Your message has been sent successfully. We'll get back to you as soon as possible."
                  }
                </p>
                <div className="space-y-3">
                  <Button onClick={resetForm} className="w-full">
                    {language === "ar" ? "إرسال رسالة أخرى" : "Send Another Message"}
                  </Button>
                  <Button variant="outline" onClick={handleBackClick} className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {language === "ar" ? "العودة للصفحة الرئيسية" : "Back to Home"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }

  // Contact form state
  return (
    <div className="mobile-container">
      <MobileHeader title={t("contactUs", language)} showBackButton={true} onBackClick={handleBackClick}>
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
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-3 p-4">
                <Mail className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <a 
                    href="mailto:support@wakti.qa" 
                    className="font-medium text-sm text-primary hover:underline transition-colors"
                  >
                    support@wakti.qa
                  </a>
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
                  <Label htmlFor="submissionType">
                    {language === "ar" ? "نوع الرسالة" : "Message Type"}
                  </Label>
                  <Select 
                    value={formData.submissionType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, submissionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">
                        {language === "ar" ? "اتصال عام" : "General Contact"}
                      </SelectItem>
                      <SelectItem value="feedback">
                        {language === "ar" ? "تقييم وملاحظات" : "Submit Feedback"}
                      </SelectItem>
                      <SelectItem value="abuse">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          {language === "ar" ? "إبلاغ عن سوء استخدام" : "Report Abuse"}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
