import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CalendarIcon, Globe, Mic, FileText, Sparkles, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmailConfirmationDialog } from "@/components/EmailConfirmationDialog";
import { validateDisplayName, validateEmail, validatePassword, validateConfirmPassword } from "@/utils/validations";
import { countries, getCountryByCode } from "@/utils/countries";
import { VoiceSignup } from "@/components/auth/VoiceSignup";

export default function Signup() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
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
  const [activeTab, setActiveTab] = useState<'voice' | 'normal'>('normal');

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

  const isRtl = language === 'ar';
  const isDarkMode = theme === 'dark';

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 h-[100dvh] w-full overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y relative",
          isRtl && "rtl"
        )}
        style={{
          background: 'var(--background)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Ambient background glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 20% 10%, hsla(210, 100%, 65%, 0.08) 0%, transparent 60%),
              radial-gradient(ellipse 50% 40% at 80% 90%, hsla(280, 70%, 65%, 0.06) 0%, transparent 60%),
              radial-gradient(ellipse 40% 30% at 50% 50%, hsla(25, 95%, 60%, 0.04) 0%, transparent 50%)
            `,
          }}
        />

        {/* Header — frosted glass */}
        <header
          className="sticky top-0 z-20"
          style={{
            background: 'hsla(var(--background-hsl, 0 0% 100%), 0.72)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            borderBottom: '1px solid hsla(0, 0%, 50%, 0.08)',
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span>{t.backToHome}</span>
            </button>
            <ThemeLanguageToggle />
          </div>
        </header>

        {/* Main Content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-10 overflow-x-hidden">
          <div className="flex flex-col">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg mx-auto"
            >
              {/* Logo + Title */}
              <div className="text-center mb-8">
                {activeTab === 'normal' && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="inline-block cursor-pointer mb-5"
                    onClick={() => navigate("/")}
                  >
                    <Logo3D size="lg" />
                  </motion.div>
                )}
                <h1
                  className="text-3xl sm:text-4xl font-bold tracking-tight"
                  style={{
                    background: 'linear-gradient(135deg, var(--foreground) 0%, hsl(210, 60%, 55%) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {t.createAccount}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {language === 'ar'
                    ? 'انضم إلى وقتي وابدأ رحلتك'
                    : 'Join Wakti and start your journey'}
                </p>

                {/* Error message */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-4 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400"
                      style={{
                        background: 'hsla(0, 80%, 50%, 0.08)',
                        border: '1px solid hsla(0, 80%, 50%, 0.15)',
                      }}
                    >
                      {errorMsg}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tab Switcher — pill style */}
              <div className="flex items-center justify-center mb-8">
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-2xl"
                  style={{
                    background: 'hsla(0, 0%, 50%, 0.06)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid hsla(0, 0%, 50%, 0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('normal')}
                    className={cn(
                      "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
                      activeTab === 'normal'
                        ? "text-white shadow-lg"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={activeTab === 'normal' ? {
                      background: 'linear-gradient(135deg, #060541 0%, hsl(260, 70%, 30%) 100%)',
                      boxShadow: '0 4px 20px hsla(260, 70%, 30%, 0.3)',
                    } : {}}
                  >
                    <FileText className="w-4 h-4" />
                    {language === 'ar' ? 'تسجيل عادي' : 'Sign Up'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('voice')}
                    className={cn(
                      "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
                      activeTab === 'voice'
                        ? "text-white shadow-lg"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={activeTab === 'voice' ? {
                      background: 'linear-gradient(135deg, hsl(210, 100%, 55%) 0%, hsl(180, 85%, 50%) 100%)',
                      boxShadow: '0 4px 20px hsla(210, 100%, 55%, 0.35)',
                    } : {}}
                  >
                    <Mic className="w-4 h-4" />
                    {language === 'ar' ? 'تسجيل بمساعدة الصوت' : 'Voice Assisted'}
                  </button>
                </div>
              </div>

              {/* Voice Sign Up Tab */}
              <AnimatePresence mode="wait">
                {activeTab === 'voice' && (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
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
                  </motion.div>
                )}

                {/* Normal Sign Up Tab */}
                {activeTab === 'normal' && (
                  <motion.div
                    key="normal"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Card container */}
                    <div
                      className="rounded-3xl p-6 sm:p-8"
                      style={isDarkMode ? {
                        background:
                          'linear-gradient(135deg, hsla(222, 20%, 6%, 0.82) 0%, hsla(240, 3%, 20%, 0.55) 100%)',
                        backdropFilter: 'blur(26px) saturate(1.25)',
                        WebkitBackdropFilter: 'blur(26px) saturate(1.25)',
                        border: '1px solid hsla(210, 100%, 65%, 0.18)',
                        boxShadow:
                          '0 18px 70px hsla(0, 0%, 0%, 0.60), 0 6px 26px hsla(210, 100%, 65%, 0.14)',
                      } : {
                        background:
                          'linear-gradient(135deg, hsla(180, 4%, 99%, 0.96) 0%, hsla(36, 67%, 81%, 0.22) 100%)',
                        backdropFilter: 'blur(20px) saturate(1.15)',
                        WebkitBackdropFilter: 'blur(20px) saturate(1.15)',
                        border: '1px solid hsla(243, 84%, 14%, 0.12)',
                        boxShadow:
                          '0 20px 70px hsla(243, 84%, 14%, 0.14), 0 8px 24px hsla(36, 67%, 81%, 0.22)',
                      }}
                    >
                      <form onSubmit={handleSignup} className="space-y-5 w-full overflow-x-hidden">

                        {/* ── Name ── */}
                        <div className="space-y-1.5">
                          <Label htmlFor="name" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                            {t.name}<span className="text-red-400 ml-0.5">*</span>
                          </Label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                              <User
                                className="h-4.5 w-4.5"
                                style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                              />
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
                              className={cn(
                                "pl-10 h-12 text-sm rounded-xl transition-all",
                                "bg-background/70 border border-border/60 shadow-sm",
                                "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                              )}
                              required
                            />
                          </div>
                        </div>

                        {/* ── Username + Email ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {t.username}<span className="text-red-400 ml-0.5">*</span>
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <span
                                  className="text-sm font-semibold"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                >
                                  @
                                </span>
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
                                className={cn(
                                  "pl-9 h-12 text-sm rounded-xl transition-all",
                                  "bg-background/70 border border-border/60 shadow-sm",
                                  "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                  "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                  "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                                )}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {t.email}<span className="text-red-400 ml-0.5">*</span>
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <Mail
                                  className="h-4 w-4"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                />
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
                                className={cn(
                                  "pl-10 h-12 text-sm rounded-xl transition-all",
                                  "bg-background/70 border border-border/60 shadow-sm",
                                  "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                  "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                  "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                                )}
                                required
                              />
                            </div>
                          </div>
                        </div>

                        {/* ── Password + Confirm ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {t.password}<span className="text-red-400 ml-0.5">*</span>
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <Lock
                                  className="h-4 w-4"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                />
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
                                className={cn(
                                  "pl-10 pr-10 h-12 text-sm rounded-xl transition-all",
                                  "bg-background/70 border border-border/60 shadow-sm",
                                  "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                  "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                  "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                                )}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={cn(
                                  "absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors",
                                  "text-[#060541]/60 hover:text-[#060541]",
                                  "dark:text-[hsl(210,100%,65%)]/55 dark:hover:text-[hsl(210,100%,65%)]"
                                )}
                              >
                                {showPassword ? (
                                  <EyeOff
                                    className="h-4 w-4"
                                    style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                  />
                                ) : (
                                  <Eye
                                    className="h-4 w-4"
                                    style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                  />
                                )}
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground/70 pl-1">{t.passwordRequirements}</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {t.confirmPassword}<span className="text-red-400 ml-0.5">*</span>
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <Lock
                                  className="h-4 w-4"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                />
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
                                className={cn(
                                  "pl-10 pr-10 h-12 text-sm rounded-xl transition-all",
                                  "bg-background/70 border border-border/60 shadow-sm",
                                  "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                  "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                  "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                                )}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className={cn(
                                  "absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors",
                                  "text-[#060541]/60 hover:text-[#060541]",
                                  "dark:text-[hsl(210,100%,65%)]/55 dark:hover:text-[hsl(210,100%,65%)]"
                                )}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff
                                    className="h-4 w-4"
                                    style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                  />
                                ) : (
                                  <Eye
                                    className="h-4 w-4"
                                    style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                  />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ── Divider — Optional Fields ── */}
                        <div className="relative py-2">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/30" />
                          </div>
                          <div className="relative flex justify-center">
                            <span
                              className="px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50"
                              style={{ background: 'var(--card, var(--background))' }}
                            >
                              {language === 'ar' ? 'اختياري' : 'Optional'}
                            </span>
                          </div>
                        </div>

                        {/* ── Date of Birth ── */}
                        <div className="space-y-1.5">
                          <Label htmlFor="dateOfBirth" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                            {t.dateOfBirth}
                          </Label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                              <CalendarIcon
                                className="h-4 w-4"
                                style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                              />
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
                                "pl-10 h-12 text-sm rounded-xl transition-all",
                                "bg-background/70 border border-border/60 shadow-sm",
                                "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]",
                                !dateOfBirth && "text-muted-foreground"
                              )}
                              min="1900-01-01"
                              max={new Date().toISOString().slice(0, 10)}
                            />
                          </div>
                        </div>

                        {/* ── Country + City ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="country" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {t.country}
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                                <Globe
                                  className="h-4 w-4"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                />
                              </div>
                              <Select
                                value={country}
                                onValueChange={setCountry}
                                disabled={isLoading}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "pl-10 h-12 text-sm rounded-xl transition-all",
                                    "bg-background/70 border border-border/60 shadow-sm",
                                    "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                    "text-[#060541]/80",
                                    "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none dark:text-white/75",
                                    "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]",
                                    "[&>svg]:text-[#060541] dark:[&>svg]:text-[hsl(210,100%,65%)]"
                                  )}
                                >
                                  <SelectValue placeholder={t.selectCountry} />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 max-w-[calc(100vw-2rem)] rounded-xl">
                                  {countries.map((c) => (
                                    <SelectItem key={c.code} value={c.code}>
                                      {language === 'ar' ? c.nameAr : c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="city" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                              {language === 'ar' ? 'المدينة' : 'City'}
                            </Label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none z-10">
                                <MapPin
                                  className="h-4 w-4"
                                  style={{ color: isDarkMode ? 'hsl(210 100% 65%)' : '#060541' }}
                                />
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
                                className={cn(
                                  "pl-10 h-12 text-sm rounded-xl transition-all",
                                  "bg-background/70 border border-border/60 shadow-sm",
                                  "focus:bg-background focus:border-[#060541]/45 focus:ring-2 focus:ring-[#060541]/15",
                                  "dark:bg-[#0c0f14]/55 dark:border-white/12 dark:shadow-none",
                                  "dark:focus:bg-[#0c0f14]/65 dark:focus:border-[hsla(210,100%,65%,0.55)] dark:focus:ring-2 dark:focus:ring-[hsla(210,100%,65%,0.22)]"
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* ── Terms ── */}
                        <div className="flex items-start gap-3 pt-1">
                          <Checkbox
                            id="terms"
                            checked={agreedToTerms}
                            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                            disabled={isLoading}
                            className="mt-0.5 rounded-md border-border/60"
                          />
                          <div className="text-xs leading-relaxed text-muted-foreground">
                            <label htmlFor="terms" className="cursor-pointer">
                              <span className="text-red-400 mr-0.5">*</span>{t.agreeToTerms}{" "}
                              <button
                                type="button"
                                onClick={() => navigate("/privacy-terms")}
                                className="text-[#060541] hover:underline font-semibold"
                              >
                                {t.privacyPolicy}
                              </button>
                              {" "}{t.and}{" "}
                              <button
                                type="button"
                                onClick={() => navigate("/privacy-terms")}
                                className="text-[#060541] hover:underline font-semibold"
                              >
                                {t.termsOfService}
                              </button>
                            </label>
                          </div>
                        </div>

                        {/* ── Submit Button ── */}
                        <button
                          type="submit"
                          disabled={isLoading || !agreedToTerms}
                          className={cn(
                            "w-full h-12 rounded-xl text-sm font-bold tracking-wide text-white transition-all duration-300",
                            "active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                          )}
                          style={{
                            background: (!isLoading && agreedToTerms)
                              ? 'linear-gradient(135deg, #060541 0%, #060541 55%, #0b0a63 100%)'
                              : 'hsla(0, 0%, 50%, 0.2)',
                            boxShadow: (!isLoading && agreedToTerms)
                              ? '0 10px 30px hsla(243, 84%, 14%, 0.25), 0 6px 18px hsla(36, 67%, 81%, 0.25)'
                              : 'none',
                          }}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {isLoading ? t.loading : t.signup}
                          </span>
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Already have account */}
              <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t.alreadyHaveAccount}{" "}
                  <button
                    onClick={() => navigate("/login")}
                    className="font-semibold text-[hsl(210,100%,55%)] hover:text-[hsl(210,100%,45%)] transition-colors"
                  >
                    {t.login}
                  </button>
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
