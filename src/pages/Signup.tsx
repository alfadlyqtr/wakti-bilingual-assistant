import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CalendarIcon, Globe, Mic, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmailConfirmationDialog } from "@/components/EmailConfirmationDialog";
import { validateDisplayName, validateEmail, validatePassword, validateConfirmPassword } from "@/utils/validations";
import { countries, getCountryByCode } from "@/utils/countries";
import { VoiceSignup } from "@/components/auth/VoiceSignup";

export default function Signup() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  // Reset city when country changes
  useEffect(() => {
    setCity("");
  }, [country]);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailConfirmationDialogOpen, setIsEmailConfirmationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'normal'>('voice');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    // Validate all fields
    const nameError = validateDisplayName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(password, confirmPassword);
    
    if (nameError) {
      setErrorMsg(nameError);
      return;
    }
    
    if (!username.trim()) {
      setErrorMsg(language === 'en' ? 'Username is required' : 'اسم المستخدم مطلوب');
      return;
    }
    
    if (emailError) {
      setErrorMsg(emailError);
      return;
    }
    
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }
    
    if (confirmPasswordError) {
      setErrorMsg(confirmPasswordError);
      return;
    }
    
    if (!agreedToTerms) {
      setErrorMsg(language === 'en' ? 'Please agree to the Privacy Policy and Terms of Service' : 'يرجى الموافقة على سياسة الخصوصية وشروط الخدمة');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get the redirect URL for email confirmation
      const redirectUrl = `${window.location.origin}/confirmed`;
      
      console.log('Attempting signup with redirect URL:', redirectUrl);
      
      // Find the selected country data
      const selectedCountry = countries.find(c => c.code === country);
      
      // Create the user in Supabase Auth with email confirmation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name,
            username,
            date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : '',
            country: selectedCountry?.name || '',
            country_code: country,
            city: city || ''
          },
        },
      });
      
      if (error) {
        console.error("Signup error:", error);
        
        // Handle weak password 422 error specifically to prevent Natively error screen
        if (error.status === 422 || 
            error.message?.toLowerCase().includes('weak') ||
            error.message?.toLowerCase().includes('easy to guess')) {
          const weakPasswordMsg = language === 'en' 
            ? 'Please choose a different password. Try making it more unique.'
            : 'يرجى اختيار كلمة مرور مختلفة. حاول جعلها أكثر تميزًا.';
          setErrorMsg(weakPasswordMsg);
          return; // Don't show toast - just inline error
        }
        
        // Other errors
        setErrorMsg(error.message);
        toast.error(language === 'en' ? 'Signup Failed: ' + error.message : 'فشل إنشاء الحساب: ' + error.message);
      } else if (data?.user) {
        console.log('Signup successful:', data);
        
        // Check if user needs email confirmation
        if (!data.user.email_confirmed_at) {
          console.log('Email confirmation required');
          toast.success(language === 'en' 
            ? 'Please check your email and click the confirmation link to verify your account.' 
            : 'يرجى فحص بريدك الإلكتروني والنقر على رابط التأكيد للتحقق من حسابك.'
          );
          setIsEmailConfirmationDialogOpen(true);
        } else {
          // User is already confirmed (shouldn't happen with email confirmations enabled)
          console.log('User already confirmed, redirecting to dashboard');
          navigate("/dashboard");
        }
      }
    } catch (err) {
      console.error("Unexpected error during signup:", err);
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
      toast.error(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const translations = {
    en: {
      appName: "WAKTI",
      createAccount: "Create Account",
      name: "Name",
      username: "Username",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      dateOfBirth: "Date of Birth",
      country: "Country",
      loading: "Loading...",
      signup: "Sign Up",
      alreadyHaveAccount: "Already have an account?",
      login: "Login",
      backToHome: "Back to Home",
      agreeToTerms: "I agree to the",
      privacyPolicy: "Privacy Policy",
      and: "and",
      termsOfService: "Terms of Service",
      passwordRequirements: "At least 6 characters",
      selectCountry: "Select your country",
      // Placeholders
      namePlaceholder: "Your Name",
      usernamePlaceholder: "username",
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "Create a password",
      confirmPasswordPlaceholder: "Confirm your password",
      dobPlaceholder: "Select your date of birth"
    },
    ar: {
      appName: "وقتي",
      createAccount: "إنشاء حساب",
      name: "الاسم",
      username: "اسم المستخدم",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",
      dateOfBirth: "تاريخ الميلاد",
      country: "البلد",
      loading: "جاري التحميل...",
      signup: "إنشاء حساب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      login: "تسجيل الدخول",
      backToHome: "العودة للرئيسية",
      agreeToTerms: "أوافق على",
      privacyPolicy: "سياسة الخصوصية",
      and: "و",
      termsOfService: "شروط الخدمة",
      passwordRequirements: "على الأقل 6 أحرف",
      selectCountry: "اختر بلدك",
      // Placeholders
      namePlaceholder: "اسمك",
      usernamePlaceholder: "اسم المستخدم",
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "إنشاء كلمة مرور",
      confirmPasswordPlaceholder: "تأكيد كلمة المرور",
      dobPlaceholder: "اختر تاريخ ميلادك"
    }
  };

  const t = translations[language];

  const handleDialogClose = () => {
    setIsEmailConfirmationDialogOpen(false);
    navigate("/login");
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30 overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 mr-2"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs">{t.backToHome}</span>
              </Button>
            </div>
            <ThemeLanguageToggle />
          </div>
        </header>

        {/* Main Content */}
        <div className="container mx-auto px-3 sm:px-4 py-8 overflow-x-hidden">
          <div className="flex min-h-[calc(100vh-120px)] flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl mx-auto"
            >
              <div className="mb-6 text-center">
                {activeTab === 'normal' && (
                  <div 
                    className="inline-block cursor-pointer mb-4"
                    onClick={() => navigate("/")}
                  >
                    <Logo3D size="lg" />
                  </div>
                )}
                <h1 className="text-2xl font-bold">{t.createAccount}</h1>
                
                {errorMsg && (
                  <div className="mt-3 text-sm text-red-500">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Tab Switcher */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTab('voice')}
                    className={cn(
                      "flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                      activeTab === 'voice'
                        ? "bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(180,85%,60%)] text-white shadow-lg dark:shadow-[0_0_15px_hsla(210,100%,65%,0.3)]"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    {language === 'ar' ? 'تسجيل صوتي' : 'Voice Sign Up'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('normal')}
                    className={cn(
                      "flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                      activeTab === 'normal'
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    {language === 'ar' ? 'تسجيل عادي' : 'Normal Sign Up'}
                  </button>
                </div>
              </div>

              {/* Voice Sign Up Tab */}
              {activeTab === 'voice' && (
                <VoiceSignup
                  onSignupComplete={(needsEmailConfirmation) => {
                    if (needsEmailConfirmation) {
                      toast.success(language === 'en' 
                        ? 'Please check your email and click the confirmation link to verify your account.' 
                        : 'يرجى فحص بريدك الإلكتروني والنقر على رابط التأكيد للتحقق من حسابك.'
                      );
                      setIsEmailConfirmationDialogOpen(true);
                    } else {
                      navigate("/dashboard");
                    }
                  }}
                  onError={(msg) => {
                    setErrorMsg(msg);
                    toast.error(msg);
                  }}
                />
              )}

              {/* Normal Sign Up Tab */}
              {activeTab === 'normal' && (
              <form onSubmit={handleSignup} className="space-y-6 w-full overflow-x-hidden">
                {/* REQUIRED FIELDS FIRST */}
                
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base">{t.name}<span className="text-red-500 ml-1" aria-hidden="true">*</span></Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Input
                      id="name"
                      placeholder={t.namePlaceholder}
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      disabled={isLoading}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 py-6 text-base shadow-sm"
                      required
                    />
                  </div>
                </div>

                {/* Username + Email in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-base">{t.username}<span className="text-red-500 ml-1" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="username"
                        placeholder={t.usernamePlaceholder}
                        type="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        disabled={isLoading}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 py-6 text-base shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base">{t.email}<span className="text-red-500 ml-1" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="email"
                        placeholder={t.emailPlaceholder}
                        type="email"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        disabled={isLoading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 py-6 text-base shadow-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                {/* Password + Confirm Password in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-base">{t.password}<span className="text-red-500 ml-1" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t.passwordPlaceholder}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        disabled={isLoading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 py-6 text-base shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.passwordRequirements}</p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-base">{t.confirmPassword}<span className="text-red-500 ml-1" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t.confirmPasswordPlaceholder}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        disabled={isLoading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 py-6 text-base shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* OPTIONAL FIELDS */}
                
                {/* Date of Birth (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="text-base">{t.dateOfBirth} <span className="text-xs text-muted-foreground font-normal">{language === 'ar' ? '(اختياري)' : '(optional)'}</span></Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      disabled={isLoading}
                      value={dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDateOfBirth(v ? new Date(`${v}T00:00:00`) : undefined);
                      }}
                      className={cn(
                        "pl-10 py-6 text-base shadow-sm",
                        !dateOfBirth && "text-muted-foreground"
                      )}
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>

                {/* Country + City in one row (optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Country (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-base">{t.country} <span className="text-xs text-muted-foreground font-normal">{language === 'ar' ? '(اختياري)' : '(optional)'}</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Select 
                        value={country} 
                        onValueChange={setCountry}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="pl-10 py-6 text-base shadow-sm">
                          <SelectValue placeholder={t.selectCountry} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 max-w-[calc(100vw-2rem)]">
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {language === 'ar' ? c.nameAr : c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* City (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-base">{language === 'ar' ? 'المدينة' : 'City'} <span className="text-xs text-muted-foreground font-normal">{language === 'ar' ? '(اختياري)' : '(optional)'}</span></Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="city"
                        placeholder={language === 'ar' ? 'أدخل مدينتك' : 'Enter your city'}
                        type="text"
                        autoCapitalize="words"
                        autoCorrect="off"
                        disabled={isLoading || !country}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="pl-10 py-6 text-base shadow-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    disabled={isLoading}
                    className="mt-1"
                  />
                  <div className="text-sm leading-relaxed">
                    <label htmlFor="terms" className="cursor-pointer">
                      <span className="text-red-500 mr-1" aria-hidden="true">*</span>{t.agreeToTerms}{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/privacy-terms")}
                        className="text-primary hover:underline font-medium"
                      >
                        {t.privacyPolicy}
                      </button>
                      {" "}{t.and}{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/privacy-terms")}
                        className="text-primary hover:underline font-medium"
                      >
                        {t.termsOfService}
                      </button>
                    </label>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  className="w-full text-base py-6 shadow-md hover:shadow-lg transition-all"
                  disabled={isLoading || !agreedToTerms}
                >
                  {isLoading ? t.loading : t.signup}
                </Button>
              </form>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t.alreadyHaveAccount}{" "}
                  <Button
                    variant="link"
                    className="px-0"
                    onClick={() => navigate("/login")}
                  >
                    {t.login}
                  </Button>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <EmailConfirmationDialog
        open={isEmailConfirmationDialogOpen}
        onClose={handleDialogClose}
      />
    </>
  );
}
