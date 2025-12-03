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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Mail, UserX, CheckCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AccountDelete() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    reason: "",
    message: "",
    submissionType: "account_delete"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleBackClick = () => {
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const subject = language === "ar"
        ? "طلب حذف حساب Wakti"
        : "Wakti account deletion request";

      const combinedMessage = [
        language === "ar" ? "تفاصيل طلب حذف الحساب:" : "Account deletion request details:",
        "",
        `${language === "ar" ? "الاسم" : "Name"}: ${formData.name}`,
        `${language === "ar" ? "اسم المستخدم" : "In-app username"}: ${formData.username || (language === "ar" ? "غير محدد" : "Not provided")}`,
        `${language === "ar" ? "البريد الإلكتروني" : "Email"}: ${formData.email}`,
        `${language === "ar" ? "سبب حذف الحساب" : "Reason"}: ${formData.reason || (language === "ar" ? "غير محدد" : "Not provided")}`,
        "",
        `${language === "ar" ? "ملاحظات إضافية" : "Additional details"}:`,
        formData.message || (language === "ar" ? "لا توجد" : "None"),
      ].join("\n");

      const { data, error } = await supabase.functions.invoke("submit-contact-form", {
        body: {
          name: formData.name,
          email: formData.email,
          subject,
          message: combinedMessage,
          submissionType: formData.submissionType,
        },
      });

      if (error) {
        console.error("Error submitting account deletion request:", error);
        throw error;
      }

      console.log("Account deletion request submitted successfully:", data);
      toast.success(
        language === "ar"
          ? "تم إرسال طلب حذف الحساب بنجاح. سنقوم بمراجعته وإعلامك عبر البريد الإلكتروني."
          : "Your account deletion request has been sent. We will review it and notify you by email."
      );
      setIsSubmitted(true);
    } catch (error) {
      console.error("Failed to submit account deletion request:", error);
      toast.error(
        language === "ar"
          ? "فشل في إرسال الطلب. يرجى المحاولة مرة أخرى."
          : "Failed to send the request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setFormData({
      name: "",
      username: "",
      email: "",
      reason: "",
      message: "",
      submissionType: "account_delete",
    });
  };

  if (isSubmitted) {
    return (
      <div className="mobile-container">
        <MobileHeader
          title={language === "ar" ? "حذف الحساب" : "Delete Account"}
          showBackButton={true}
          onBackClick={handleBackClick}
        >
          <ThemeLanguageToggle />
        </MobileHeader>

        <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
          <Card className="text-center w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 text-primary">
                {language === "ar" ? "تم إرسال طلبك" : "Request Sent"}
              </h2>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                {language === "ar"
                  ? "سنقوم بمراجعة طلب حذف حسابك والتواصل معك عبر البريد الإلكتروني بمجرد إتمام العملية."
                  : "We will review your account deletion request and contact you by email once it has been processed."}
              </p>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleBackClick}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {language === "ar" ? "العودة للصفحة الرئيسية" : "Back to Home"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="mobile-container">
      <MobileHeader
        title={language === "ar" ? "حذف الحساب" : "Delete Account"}
        showBackButton={true}
        onBackClick={handleBackClick}
      >
        <ThemeLanguageToggle />
      </MobileHeader>

      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-6">
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl font-bold">
              {language === "ar" ? "حذف حساب Wakti" : "Delete your Wakti account"}
            </h1>

            {/* Primary method notice */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium text-primary mb-2">
                {language === "ar" ? "✨ الطريقة الأسرع" : "✨ Fastest Method"}
              </p>
              <p className="text-sm text-foreground">
                {language === "ar"
                  ? "يمكنك حذف حسابك فوراً من داخل التطبيق: افتح Wakti → سجّل الدخول → الحساب → حذف حسابي → أكد بريدك الإلكتروني. سيتم حذف حسابك وجميع بياناتك على الفور."
                  : "You can delete your account instantly from inside the app: Open Wakti → Sign in → Account → Delete my account → Confirm your email. Your account and all data will be deleted immediately."}
              </p>
            </div>

            <p className="text-muted-foreground text-sm">
              {language === "ar"
                ? "نحن حزينون لرؤيتك تغادر، لكننا نحترم قرارك ونسهّل عليك حذف حسابك." 
                : "We're sad to see you go, but we respect your decision and want to make it easy to close your account."}
            </p>

            {/* Fallback notice */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "⚠️ هذا النموذج للمستخدمين الذين لا يستطيعون الوصول إلى التطبيق فقط. إذا كان بإمكانك تسجيل الدخول للتطبيق، يرجى استخدام خيار الحذف داخل التطبيق للحذف الفوري."
                  : "⚠️ This form is only for users who cannot access the app. If you can log into the app, please use the in-app deletion option for immediate deletion."}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserX className="h-5 w-5" />
                {language === "ar" ? "طلب حذف الحساب" : "Account deletion request"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    {t("name", language)}
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t("enterYourName", language)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-sm font-medium">
                    {language === "ar" ? "اسم المستخدم في التطبيق" : "In‑app username"}
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder={
                      language === "ar"
                        ? "اكتب اسم المستخدم (إن وجد)"
                        : "Enter your Wakti username (if you have one)"
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("email", language)}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("enterYourEmail", language)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    {language === "ar" ? "سبب حذف الحساب" : "Reason for deleting your account"}
                  </Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, reason: value }))
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue
                        placeholder={
                          language === "ar"
                            ? "اختر سبباً"
                            : "Choose a reason"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_using">
                        {language === "ar"
                          ? "لا أستخدم التطبيق بما فيه الكفاية"
                          : "I’m not using the app enough"}
                      </SelectItem>
                      <SelectItem value="features_missing">
                        {language === "ar"
                          ? "أحتاج إلى مزايا غير متوفرة"
                          : "I need features that are missing"}
                      </SelectItem>
                      <SelectItem value="privacy">
                        {language === "ar"
                          ? "الخصوصية أو البيانات"
                          : "Privacy or data concerns"}
                      </SelectItem>
                      <SelectItem value="another_app">
                        {language === "ar"
                          ? "أستخدم تطبيقاً آخر"
                          : "I’m using another app"}
                      </SelectItem>
                      <SelectItem value="other">
                        {language === "ar" ? "سبب آخر" : "Other"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message" className="text-sm font-medium">
                    {language === "ar"
                      ? "ملاحظات إضافية (اختياري)"
                      : "Additional details (optional)"}
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={
                      language === "ar"
                        ? "أي تفاصيل إضافية تساعدنا على فهم طلبك"
                        : "Any extra details that help us understand your request"
                    }
                    rows={4}
                    className="mt-1 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-6 text-base"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {language === "ar" ? "جارٍ الإرسال" : "Sending"}
                    </div>
                  ) : (
                    language === "ar" ? "إرسال طلب حذف الحساب" : "Submit account deletion request"
                  )}
                </Button>

                <div className="text-xs text-muted-foreground flex items-start gap-2">
                  <Mail className="h-3 w-3 mt-0.5" />
                  <span>
                    {language === "ar"
                      ? "يمكنك أيضاً إرسال بريد إلكتروني مباشرة إلى delete@wakti.qa من نفس البريد المسجل في حسابك لطلب حذف الحساب."
                      : "You can also email delete@wakti.qa directly from the email address linked to your account to request deletion."}
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Footer />
    </div>
  );
}
