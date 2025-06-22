
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EmailConfirmationDialog } from "@/components/EmailConfirmationDialog";
import { validatePassword, validateConfirmPassword } from "@/utils/validations";

export default function Signup() {
  // UNIQUE IDENTIFIER FOR THIS COMPONENT
  console.log("🔥🔥🔥 LOADING COMPLETE SIGNUP COMPONENT WITH ALL FIELDS 🔥🔥🔥");
  console.log("Component file: src/pages/Signup.tsx");
  console.log("Should show: Name, Username, Email, Password, Confirm Password, Date of Birth");
  
  const navigate = useNavigate();
  const { language } = useTheme();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [dobInputValue, setDobInputValue] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isEmailConfirmationDialogOpen, setIsEmailConfirmationDialogOpen] = useState(false);

  // Log all state values for debugging
  useEffect(() => {
    console.log("Signup Form State:", {
      name,
      username,
      email,
      password: password ? "***" : "",
      confirmPassword: confirmPassword ? "***" : "",
      dateOfBirth,
      agreedToTerms
    });
  }, [name, username, email, password, confirmPassword, dateOfBirth, agreedToTerms]);

  // Real-time password validation
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const error = validatePassword(value);
    setPasswordError(error);
    
    if (confirmPassword) {
      const confirmError = validateConfirmPassword(value, confirmPassword);
      setConfirmPasswordError(confirmError);
    }
  };

  // Real-time confirm password validation
  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    const error = validateConfirmPassword(password, value);
    setConfirmPasswordError(error);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    console.log("🚀 Signup form submitted");
    
    if (!name || !username || !email || !password || !confirmPassword || !dateOfBirth) {
      console.log("❌ Missing fields:", { name: !!name, username: !!username, email: !!email, password: !!password, confirmPassword: !!confirmPassword, dateOfBirth: !!dateOfBirth });
      setErrorMsg(language === 'en' ? 'Please fill in all fields including date of birth' : 'يرجى تعبئة جميع الحقول بما في ذلك تاريخ الميلاد');
      return;
    }
    
    if (!agreedToTerms) {
      setErrorMsg(language === 'en' ? 'Please agree to the Privacy Policy and Terms of Service' : 'يرجى الموافقة على سياسة الخصوصية وشروط الخدمة');
      return;
    }
    
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      setErrorMsg(passwordValidationError);
      return;
    }
    
    const confirmPasswordValidationError = validateConfirmPassword(password, confirmPassword);
    if (confirmPasswordValidationError) {
      setConfirmPasswordError(confirmPasswordValidationError);
      setErrorMsg(confirmPasswordValidationError);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/confirmed`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name,
            username,
            date_of_birth: dateOfBirth.toISOString().split('T')[0],
          },
        },
      });
      
      if (error) {
        setErrorMsg(error.message);
        toast.error(language === 'en' ? 'Signup Failed: ' + error.message : 'فشل إنشاء الحساب: ' + error.message);
      } else if (data?.user) {
        if (!data.user.email_confirmed_at) {
          toast.success(language === 'en' 
            ? 'Please check your email and click the confirmation link to verify your account.' 
            : 'يرجى فحص بريدك الإلكتروني والنقر على رابط التأكيد للتحقق من حسابك.'
          );
          setIsEmailConfirmationDialogOpen(true);
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err) {
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
      toast.error(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDobInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDobInputValue(value);

    if (value) {
      const newDate = new Date(value);
      if (!isNaN(newDate.getTime())) {
        setDateOfBirth(newDate);
      }
    } else {
      setDateOfBirth(undefined);
    }
  };

  const handleCalendarDateSelect = (date: Date | undefined) => {
    setDateOfBirth(date);
    if (date) {
      setDobInputValue(date.toISOString().split("T")[0]);
    } else {
      setDobInputValue("");
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
      loading: "Loading...",
      signup: "Sign Up",
      alreadyHaveAccount: "Already have an account?",
      login: "Login",
      backToHome: "Back to Home",
      agreeToTerms: "I agree to the",
      privacyPolicy: "Privacy Policy",
      and: "and",
      termsOfService: "Terms of Service",
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
      loading: "جاري التحميل...",
      signup: "إنشاء حساب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      login: "تسجيل الدخول",
      backToHome: "العودة للرئيسية",
      agreeToTerms: "أوافق على",
      privacyPolicy: "سياسة الخصوصية",
      and: "و",
      termsOfService: "شروط الخدمة",
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
      {/* ABSOLUTE UNIQUE IDENTIFIER */}
      <div className="w-full bg-purple-600 text-white text-center py-4 text-lg font-black border-8 border-red-500 animate-pulse">
        🎯 THIS IS THE COMPLETE SIGNUP FORM - VERSION IDENTIFIER: COMPLETE-SIGNUP-V1.0 🎯
      </div>
      
      <div className="min-h-screen bg-background text-foreground w-full max-w-md mx-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 mr-2"
              onClick={() => navigate("/home")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs">{t.backToHome}</span>
            </Button>
          </div>
          <ThemeLanguageToggle />
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-[80vh] flex-col justify-center py-6 px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="mb-6 text-center">
                <div 
                  className="inline-block cursor-pointer mb-4"
                  onClick={() => navigate("/home")}
                >
                  <Logo3D size="lg" />
                </div>
                <h1 className="text-2xl font-bold">{t.createAccount}</h1>
                
                {errorMsg && (
                  <div className="mt-3 text-sm text-red-500">
                    {errorMsg}
                  </div>
                )}
              </div>

              <form onSubmit={handleSignup} className="space-y-6">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base">{t.name}</Label>
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
                
                {/* Username Field */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-base">{t.username}</Label>
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
                
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base">{t.email}</Label>
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
                
                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base">{t.password}</Label>
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
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className={cn(
                        "pl-10 pr-10 py-6 text-base shadow-sm",
                        passwordError && "border-red-500"
                      )}
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
                  {passwordError && (
                    <div className="text-sm text-red-500 mt-1">
                      {passwordError}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {language === 'en' 
                      ? "Password must be at least 6 characters with 1 uppercase, 1 lowercase, and 1 digit"
                      : "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل مع حرف كبير وحرف صغير ورقم"
                    }
                  </div>
                </div>
                
                {/* CONFIRM PASSWORD FIELD */}
                <div className="space-y-2 bg-gradient-to-r from-yellow-100 to-yellow-200 p-6 border-4 border-yellow-600 rounded-xl shadow-lg">
                  <div className="bg-yellow-500 text-white p-3 rounded-lg text-center font-black text-lg animate-bounce">
                    🔐 CONFIRM PASSWORD FIELD - SHOULD BE VISIBLE 🔐
                  </div>
                  <Label htmlFor="confirmPassword" className="text-lg font-bold text-yellow-800">{t.confirmPassword}</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t.confirmPasswordPlaceholder}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      disabled={isLoading}
                      value={confirmPassword}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      className={cn(
                        "pl-10 pr-10 py-6 text-base shadow-sm border-4 border-yellow-400 bg-white",
                        confirmPasswordError && "border-red-500"
                      )}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-yellow-600" />
                      )}
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <div className="text-sm text-red-500 mt-1 font-bold">
                      {confirmPasswordError}
                    </div>
                  )}
                </div>
                
                {/* DATE OF BIRTH FIELD */}
                <div className="space-y-2 bg-gradient-to-r from-blue-100 to-blue-200 p-6 border-4 border-blue-600 rounded-xl shadow-lg">
                  <div className="bg-blue-500 text-white p-3 rounded-lg text-center font-black text-lg animate-bounce">
                    📅 DATE OF BIRTH FIELD - SHOULD BE VISIBLE 📅
                  </div>
                  <Label htmlFor="dateOfBirth" className="text-lg font-bold text-blue-800">{t.dateOfBirth}</Label>
                  <div className="space-y-3">
                    <Input
                      id="dob"
                      type="date"
                      value={dobInputValue}
                      onChange={handleDobInputChange}
                      max={new Date().toISOString().split('T')[0]}
                      min="1900-01-01"
                      className="w-full text-base border-4 border-blue-400 bg-white py-6"
                      disabled={isLoading}
                      placeholder={language === 'ar' ? 'اختر التاريخ' : 'Select date'}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal py-6 text-base shadow-sm border-4 border-blue-400 bg-white",
                            !dateOfBirth && "text-muted-foreground"
                          )}
                          disabled={isLoading}
                        >
                          <CalendarIcon className="mr-2 h-5 w-5 text-blue-600" />
                          {dateOfBirth ? format(dateOfBirth, "PPP") : <span>{t.dobPlaceholder}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateOfBirth}
                          onSelect={handleCalendarDateSelect}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {/* Privacy and Terms Checkbox */}
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
                      {t.agreeToTerms}{" "}
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
                  disabled={isLoading || !agreedToTerms || !!passwordError || !!confirmPasswordError}
                >
                  {isLoading ? t.loading : t.signup}
                </Button>
              </form>

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
      {/* Email Confirmation Dialog */}
      <EmailConfirmationDialog
        open={isEmailConfirmationDialogOpen}
        onClose={handleDialogClose}
      />
    </>
  );
}
