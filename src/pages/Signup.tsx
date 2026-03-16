import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Eye, EyeOff, Mail, Lock, User, AtSign, ArrowLeft, CalendarIcon, Globe, Mic, FileText, Sparkles, MapPin, ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmailConfirmationDialog } from "@/components/EmailConfirmationDialog";
import { validateDisplayName, validateEmail, validatePassword } from "@/utils/validations";
import { countries, getCountryByCode } from "@/utils/countries";

export default function Signup() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  // Reset city when country changes
  useEffect(() => {
    setCity("");
  }, [country]);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailConfirmationDialogOpen, setIsEmailConfirmationDialogOpen] = useState(false);

  // ─── Voice State ───
  const [isRecording, setIsRecording] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false);
  const holdStartRef = useRef(0);
  const isConnectionReadyRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const MAX_RECORD_SECONDS = 10;

  // Auto-Greeting Logic
  useEffect(() => {
    const playGreeting = async () => {
      if (audioRef.current) {
        audioRef.current.src = language === 'ar' ? '/welcome to wakti arabic.mp3' : '/welcome to wakti english.mp3';
        audioRef.current.onplay  = () => setIsPlayingAudio(true);
        audioRef.current.onended = () => setIsPlayingAudio(false);
        audioRef.current.onpause = () => setIsPlayingAudio(false);
        try {
          await audioRef.current.play();
          setAudioUnlocked(true);
        } catch (e) {
          console.warn('Auto-play blocked, waiting for interaction', e);
        }
      }
    };
    playGreeting();
  }, [language]);

  // Clean up email from transcription
  const cleanEmail = (raw: string) => {
    let e = raw.trim().toLowerCase();
    e = e.replace(/\s*at\s*/gi, '@').replace(/\s*آت\s*/gi, '@');
    e = e.replace(/\s*dot\s*/gi, '.').replace(/\s*دوت\s*/gi, '.').replace(/\s*نقطة\s*/gi, '.').replace(/\s*point\s*/gi, '.');
    e = e.replace(/\s+/g, '');
    e = e.replace(/@@+/g, '@').replace(/\.\./g, '.');
    return e;
  };

  // WebRTC initialization
  const initializeVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        isConnectionReadyRef.current = true;
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: 'You are a silent email transcription tool. Your ONLY job is to listen to the user spell or say an email address and transcribe it exactly. NEVER respond with speech, text, greetings, or any output. NEVER generate any response. NEVER speak. Just transcribe the email address the user says or spells. Output nothing.',
            voice: 'shimmer',
            modalities: ['text'],
            input_audio_transcription: language === 'ar' ? { model: 'whisper-1', language: 'ar' } : { model: 'whisper-1' },
            turn_detection: null
          }
        }));
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Handle both transcription event types from OpenAI Realtime
          const transcript =
            msg.transcript ??
            msg.delta ??
            (msg.type === 'conversation.item.input_audio_transcription.completed' ? msg.transcript : null);
          // Cancel any AI response immediately
          if (msg.type === 'response.created' || msg.type === 'response.audio.delta' || msg.type === 'response.text.delta') {
            try { dc.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
            return;
          }
          if (
            (msg.type === 'conversation.item.input_audio_transcription.completed' ||
             msg.type === 'input_audio_transcription.completed') &&
            msg.transcript
          ) {
            const cleaned = cleanEmail(msg.transcript);
            setEmail(cleaned);
            setEmailCaptured(true);
            // Kill any pending AI response
            try { dc.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
            // Auto-focus password after short delay
            setTimeout(() => passwordRef.current?.focus(), 600);
          }
        } catch {}
      };

      await pc.setLocalDescription();
      const offer = pc.localDescription;
      if (!offer) return;

      const response = await supabase.functions.invoke('live-voice-signup', {
        body: { sdp_offer: offer.sdp, language },
      });

      if (response.data?.sdp_answer) {
        await pc.setRemoteDescription({ type: 'answer', sdp: response.data.sdp_answer });
      }
    } catch (e) {
      console.error('Voice initialization failed:', e);
    }
  }, [language]);

  useEffect(() => {
    initializeVoice();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
      if (dcRef.current) dcRef.current.close();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [initializeVoice]);

  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!audioUnlocked && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setAudioUnlocked(true);
    }
    
    if (!isConnectionReadyRef.current || !dcRef.current || dcRef.current.readyState !== 'open') return;
    
    setIsRecording(true);
    isStoppingRef.current = false;
    dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    holdStartRef.current = Date.now();
    setCountdown(MAX_RECORD_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) handleHoldEnd(e as any);
    }, 200);
  };

  const handleHoldEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setIsRecording(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (Date.now() - holdStartRef.current < 500) {
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      }
    } else {
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
    }
    setTimeout(() => { isStoppingRef.current = false; }, 1000);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    // Validate required fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    // Only validate name if optional fields are shown and user entered something
    let nameError = null;
    if (showOptionalFields && name.trim()) {
      nameError = validateDisplayName(name);
    }
    
    if (emailError) {
      setErrorMsg(emailError);
      return;
    }
    
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }

    if (nameError) {
      setErrorMsg(nameError);
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
            username: username || '',
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
      termsOfService: "Terms of Service, and I consent to my text, voice, and image data being shared with third-party AI services (",
      seeAiProviders: "see AI providers",
      toProvideFeatures: ") to provide WAKTI's features.",
      passwordRequirements: "At least 6 characters",
      selectCountry: "Country",
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
      termsOfService: "شروط الخدمة، وأوافق على مشاركة بياناتي (النص والصوت والصور) مع خدمات الذكاء الاصطناعي الخارجية (",
      seeAiProviders: "انظر مزودي الذكاء الاصطناعي",
      toProvideFeatures: ") لتوفير ميزات وقتي.",
      passwordRequirements: "على الأقل 6 أحرف",
      selectCountry: "البلد",
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

  const dk = isDarkMode;
  const fgHi  = (op: string) => (dk ? `rgba(255,255,255,${op})` : `rgba(6,5,65,${op})`);
  const accent = dk ? 'hsl(210,100%,65%)' : '#060541';

  /* shared input class */
  const fieldCls = cn(
    "h-11 text-sm rounded-xl transition-all duration-200 border bg-transparent",
    dk
      ? "border-white/10 text-white placeholder:text-white/25 focus:border-white/30 focus:ring-1 focus:ring-white/15"
      : "border-[#060541]/12 text-[#060541] placeholder:text-[#060541]/30 focus:border-[#060541]/35 focus:ring-1 focus:ring-[#060541]/10"
  );

  return (
    <>
      {/* ── CSS ── */}
      <style>{`
        /* page: fixed, NO scroll */
        .su-page {
          position: fixed; inset: 0; width: 100%; height: 100dvh;
          overflow: hidden; display: flex; flex-direction: column;
          background: ${dk ? '#07080f' : '#eef0f8'};
        }

        /* aurora bg */
        .su-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .su-bg::before {
          content:''; position:absolute; inset:-60%;
          background:
            ${dk
              ? `radial-gradient(ellipse 65% 50% at 15% 5%,  hsla(320,70%,55%,0.18) 0%, transparent 55%),
                 radial-gradient(ellipse 60% 45% at 88% 95%,  hsla(180,90%,50%,0.16) 0%, transparent 55%),
                 radial-gradient(ellipse 55% 40% at 50% 50%,  hsla(260,80%,55%,0.10) 0%, transparent 60%)`
              : `radial-gradient(ellipse 65% 50% at 15% 5%,  hsla(320,50%,70%,0.12) 0%, transparent 55%),
                 radial-gradient(ellipse 60% 45% at 88% 95%,  hsla(180,60%,55%,0.10) 0%, transparent 55%),
                 radial-gradient(ellipse 55% 40% at 50% 50%,  hsla(260,60%,65%,0.07) 0%, transparent 60%)`
            };
          animation: suBgDrift 22s ease-in-out infinite alternate;
        }
        @keyframes suBgDrift {
          0%   { transform: scale(1)    rotate(0deg); }
          100% { transform: scale(1.06) rotate(-2deg); }
        }

        /* ─── SIRI ORB ─── */
        .siri-wrap {
          position: relative;
          width: 130px; height: 130px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          user-select: none; -webkit-user-select: none;
          touch-action: none;
          flex-shrink: 0;
        }
        /* outer frosted shell */
        .siri-shell {
          position: absolute; inset: 0; border-radius: 50%;
          background: ${dk
            ? 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'
            : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 100%)'
          };
          backdrop-filter: blur(18px) saturate(1.6);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          border: 1px solid ${dk ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'};
          box-shadow: ${dk
            ? '0 0 50px rgba(200,100,255,0.12), 0 0 100px rgba(100,200,255,0.08), inset 0 1px 0 rgba(255,255,255,0.07)'
            : '0 8px 40px rgba(100,80,200,0.12), 0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)'
          };
        }
        /* lobe 1 — pink/magenta */
        .siri-lobe1 {
          position: absolute;
          width: 72%; height: 72%;
          top: 8%; left: 4%;
          border-radius: 50% 44% 58% 42% / 48% 56% 44% 52%;
          background: ${dk
            ? 'radial-gradient(ellipse at 40% 40%, hsla(330,90%,65%,0.75) 0%, hsla(320,80%,55%,0.45) 45%, transparent 75%)'
            : 'radial-gradient(ellipse at 40% 40%, hsla(330,80%,70%,0.65) 0%, hsla(320,70%,62%,0.38) 45%, transparent 75%)'
          };
          filter: blur(3px);
          animation: siLobe1 6s ease-in-out infinite;
        }
        @keyframes siLobe1 {
          0%,100% { transform: rotate(0deg)   scale(1)    translate(0,0); }
          33%      { transform: rotate(15deg)  scale(1.08) translate(3px,-2px); }
          66%      { transform: rotate(-8deg)  scale(0.95) translate(-2px,3px); }
        }
        /* lobe 2 — cyan/teal */
        .siri-lobe2 {
          position: absolute;
          width: 68%; height: 68%;
          bottom: 6%; right: 2%;
          border-radius: 44% 56% 42% 58% / 52% 44% 56% 48%;
          background: ${dk
            ? 'radial-gradient(ellipse at 60% 60%, hsla(185,95%,60%,0.72) 0%, hsla(200,85%,52%,0.42) 45%, transparent 75%)'
            : 'radial-gradient(ellipse at 60% 60%, hsla(185,85%,55%,0.60) 0%, hsla(200,75%,50%,0.35) 45%, transparent 75%)'
          };
          filter: blur(3px);
          animation: siLobe2 7s ease-in-out infinite 0.8s;
        }
        @keyframes siLobe2 {
          0%,100% { transform: rotate(0deg)   scale(1)    translate(0,0); }
          33%      { transform: rotate(-12deg) scale(1.06) translate(-3px,2px); }
          66%      { transform: rotate(10deg)  scale(0.96) translate(2px,-3px); }
        }
        /* lobe 3 — purple/violet centre */
        .siri-lobe3 {
          position: absolute;
          width: 55%; height: 55%;
          top: 22%; left: 22%;
          border-radius: 50%;
          background: ${dk
            ? 'radial-gradient(ellipse at 50% 40%, hsla(270,80%,70%,0.55) 0%, hsla(250,70%,55%,0.30) 55%, transparent 80%)'
            : 'radial-gradient(ellipse at 50% 40%, hsla(270,70%,72%,0.45) 0%, hsla(250,60%,60%,0.25) 55%, transparent 80%)'
          };
          filter: blur(4px);
          animation: siLobe3 9s ease-in-out infinite 1.4s;
        }
        @keyframes siLobe3 {
          0%,100% { transform: scale(1)    rotate(0deg); }
          50%      { transform: scale(1.12) rotate(180deg); }
        }
        /* lobe 4 — green accent */
        .siri-lobe4 {
          position: absolute;
          width: 48%; height: 48%;
          top: 42%; left: 28%;
          border-radius: 42% 58% 55% 45% / 50% 46% 54% 50%;
          background: ${dk
            ? 'radial-gradient(ellipse at 45% 55%, hsla(160,85%,58%,0.45) 0%, hsla(170,75%,48%,0.22) 55%, transparent 80%)'
            : 'radial-gradient(ellipse at 45% 55%, hsla(160,75%,55%,0.38) 0%, hsla(170,65%,48%,0.18) 55%, transparent 80%)'
          };
          filter: blur(3.5px);
          animation: siLobe4 8s ease-in-out infinite 2s;
        }
        @keyframes siLobe4 {
          0%,100% { transform: rotate(0deg)  scale(1);    }
          50%      { transform: rotate(-20deg) scale(1.1); }
        }
        /* specular hotspot */
        .siri-specular {
          position: absolute;
          width: 35%; height: 22%;
          top: 12%; left: 20%;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.25) 40%, transparent 75%);
          filter: blur(2px);
          pointer-events: none;
          animation: siSpec 5s ease-in-out infinite;
        }
        @keyframes siSpec {
          0%,100% { opacity: 0.8; transform: scale(1) translate(0,0); }
          50%      { opacity: 0.5; transform: scale(0.85) translate(4px,2px); }
        }
        /* idle breathe — whole orb */
        .siri-wrap:not(.siri-active) .siri-shell {
          animation: siBreath 4.5s ease-in-out infinite;
        }
        @keyframes siBreath {
          0%,100% { transform: scale(1);    }
          50%      { transform: scale(1.04); }
        }
        /* active / listening state */
        .siri-wrap.siri-active .siri-lobe1 { animation-duration: 1.4s !important; }
        .siri-wrap.siri-active .siri-lobe2 { animation-duration: 1.6s !important; }
        .siri-wrap.siri-active .siri-lobe3 { animation-duration: 1.2s !important; }
        .siri-wrap.siri-active .siri-lobe4 { animation-duration: 1.8s !important; }
        .siri-wrap.siri-active .siri-shell {
          box-shadow: ${dk
            ? '0 0 60px rgba(200,100,255,0.35), 0 0 120px rgba(100,200,255,0.20), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 0 50px rgba(180,80,255,0.22), 0 0 100px rgba(80,200,230,0.15), inset 0 1px 0 rgba(255,255,255,0.9)'
          };
          animation: siActivePulse 0.85s ease-in-out infinite !important;
        }
        @keyframes siActivePulse {
          0%,100% { transform: scale(1.04); }
          50%      { transform: scale(1.10); }
        }
        /* ripple waves on active */
        .siri-ripple {
          position: absolute; inset: -20px; border-radius: 50%;
          border: 1px solid ${dk ? 'rgba(180,100,255,0.3)' : 'rgba(100,80,200,0.2)'};
          opacity: 0; pointer-events: none;
        }
        .siri-wrap.siri-active .siri-ripple { animation: siRipple 1.6s ease-out infinite; }
        .siri-ripple-2 { animation-delay: 0.53s !important; }
        .siri-ripple-3 { animation-delay: 1.06s !important; }
        @keyframes siRipple {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.0); opacity: 0;   }
        }

        /* ─── form glass panel ─── */
        .su-panel {
          border-radius: 24px;
          background: ${dk
            ? 'rgba(255,255,255,0.045)'
            : 'rgba(255,255,255,0.78)'
          };
          backdrop-filter: blur(36px) saturate(1.5);
          -webkit-backdrop-filter: blur(36px) saturate(1.5);
          border: 1px solid ${dk ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)'};
          box-shadow: ${dk
            ? '0 16px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 16px 60px rgba(6,5,65,0.10), inset 0 1px 0 rgba(255,255,255,1)'
          };
        }

        /* ─── submit pill ─── */
        .su-pill {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          height: 46px; padding: 0 32px; border-radius: 999px;
          font-size: 0.84rem; font-weight: 800; letter-spacing: 0.08em;
          color: #fff; border: none; cursor: pointer;
          transition: all 0.28s cubic-bezier(0.22,1,0.36,1);
          position: relative; overflow: hidden;
          background: ${dk
            ? 'linear-gradient(135deg, hsl(280,65%,42%) 0%, hsl(220,85%,45%) 50%, hsl(180,80%,40%) 100%)'
            : 'linear-gradient(135deg, #060541 0%, hsl(250,70%,30%) 40%, hsl(210,90%,35%) 100%)'
          };
          box-shadow: ${dk
            ? '0 6px 28px rgba(150,80,255,0.35), 0 2px 10px rgba(80,180,255,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
            : '0 6px 28px rgba(6,5,65,0.30), 0 2px 10px rgba(6,5,65,0.15), inset 0 1px 0 rgba(255,255,255,0.2)'
          };
        }
        .su-pill::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 42%, rgba(255,255,255,0.05) 50%, transparent 55%);
          animation: suShimmer 3s ease-in-out infinite;
        }
        @keyframes suShimmer {
          0%   { transform: translateX(-120%); }
          60%  { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        .su-pill:not(:disabled):hover { transform: translateY(-2px) scale(1.04); box-shadow: ${dk
          ? '0 10px 40px rgba(150,80,255,0.45), 0 4px 16px rgba(80,180,255,0.25)'
          : '0 10px 40px rgba(6,5,65,0.40), 0 4px 16px rgba(6,5,65,0.20)'
        }; }
        .su-pill:not(:disabled):active { transform: scale(0.96); }
        .su-pill:disabled {
          background: ${dk ? 'rgba(255,255,255,0.06)' : 'rgba(6,5,65,0.06)'};
          color: ${dk ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)'};
          box-shadow: none; cursor: not-allowed;
        }
        .su-pill:disabled::after { display: none; }

        /* ─── add-details vibrant pill ─── */
        .su-details-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 16px; border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          position: relative;
          background: ${dk
            ? 'linear-gradient(135deg, hsla(280,55%,50%,0.22) 0%, hsla(210,75%,50%,0.18) 50%, hsla(180,70%,45%,0.14) 100%)'
            : 'linear-gradient(135deg, hsla(243,70%,20%,0.08) 0%, hsla(210,80%,40%,0.08) 50%, hsla(280,50%,45%,0.06) 100%)'
          };
          border: 1.5px solid transparent;
          background-clip: padding-box;
          color: ${dk ? 'hsl(270,60%,80%)' : 'hsl(243,84%,22%)'};
          text-shadow: ${dk ? '0 0 12px hsla(280,60%,65%,0.3)' : 'none'};
        }
        .su-details-pill::before {
          content: ''; position: absolute; inset: -1.5px; border-radius: 999px; z-index: -1;
          background: ${dk
            ? 'linear-gradient(135deg, hsl(280,60%,55%), hsl(210,80%,55%), hsl(180,75%,50%), hsl(280,60%,55%))'
            : 'linear-gradient(135deg, hsl(243,84%,30%), hsl(210,80%,40%), hsl(280,50%,45%), hsl(243,84%,30%))'
          };
          background-size: 300% 300%;
          animation: suDetailsBorder 4s ease infinite;
          opacity: ${dk ? '0.5' : '0.35'};
        }
        @keyframes suDetailsBorder {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        .su-details-pill:hover {
          transform: translateY(-2px) scale(1.05);
          color: ${dk ? 'hsl(270,65%,88%)' : 'hsl(243,84%,14%)'};
          box-shadow: ${dk
            ? '0 4px 18px hsla(280,60%,55%,0.25), 0 2px 8px hsla(210,80%,55%,0.15)'
            : '0 4px 18px hsla(243,84%,14%,0.15), 0 2px 8px hsla(210,80%,50%,0.10)'
          };
        }
        .su-details-pill:hover::before { opacity: ${dk ? '0.75' : '0.55'}; }

        /* ─── vibrant checkbox ─── */
        .su-checkbox {
          width: 16px !important; height: 16px !important;
          border-radius: 5px !important;
          border: 2px solid ${dk ? 'hsl(280,60%,55%)' : 'hsl(243,84%,30%)'} !important;
          background: transparent !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0;
        }
        .su-checkbox[data-state='checked'] {
          background: ${dk
            ? 'linear-gradient(135deg, hsl(280,60%,50%) 0%, hsl(210,80%,50%) 100%)'
            : 'linear-gradient(135deg, #060541 0%, hsl(250,70%,35%) 100%)'
          } !important;
          border-color: transparent !important;
          box-shadow: ${dk
            ? '0 0 12px hsla(280,60%,55%,0.4), 0 0 4px hsla(210,80%,55%,0.3)'
            : '0 0 8px hsla(243,84%,14%,0.25)'
          };
        }

        /* ─── login link ─── */
        .su-login-link {
          font-weight: 800; letter-spacing: 0.03em;
          background: ${dk
            ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,70%) 50%, hsl(180,80%,60%) 100%)'
            : 'linear-gradient(135deg, #060541 0%, hsl(250,70%,32%) 50%, hsl(210,90%,38%) 100%)'
          };
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          position: relative;
          transition: all 0.25s ease;
          padding: 0 1px;
        }
        .su-login-link::after {
          content: ''; position: absolute;
          bottom: -1px; left: 0; right: 0; height: 1.5px;
          border-radius: 2px;
          background: ${dk
            ? 'linear-gradient(90deg, hsl(210,100%,65%), hsl(280,70%,65%), hsl(180,80%,55%))'
            : 'linear-gradient(90deg, #060541, hsl(250,70%,32%), hsl(210,90%,38%))'
          };
          opacity: 0.5;
          transform: scaleX(0.6);
          transition: all 0.25s ease;
        }
        .su-login-link:hover::after {
          opacity: 1; transform: scaleX(1);
        }
        .su-login-link:hover {
          filter: ${dk ? 'drop-shadow(0 0 8px hsla(210,100%,65%,0.4))' : 'drop-shadow(0 0 6px hsla(243,84%,14%,0.2))'};
        }

        /* ─── back button ─── */
        .su-back-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px 6px 10px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.25s ease;
          border: 1px solid ${dk ? 'hsla(280,50%,55%,0.25)' : 'hsla(243,84%,14%,0.12)'};
          background: ${dk
            ? 'linear-gradient(135deg, hsla(280,50%,40%,0.15) 0%, hsla(210,70%,45%,0.12) 100%)'
            : 'linear-gradient(135deg, hsla(243,70%,20%,0.06) 0%, hsla(210,80%,40%,0.05) 100%)'
          };
          color: ${dk ? 'hsl(270,50%,78%)' : 'hsl(243,84%,22%)'};
          backdrop-filter: blur(10px);
        }
        .su-back-btn:hover {
          transform: translateX(-2px);
          border-color: ${dk ? 'hsla(280,50%,55%,0.4)' : 'hsla(243,84%,14%,0.22)'};
          box-shadow: ${dk
            ? '0 2px 12px hsla(280,50%,55%,0.2)'
            : '0 2px 8px hsla(243,84%,14%,0.1)'
          };
        }
        .su-back-btn:active { transform: scale(0.95); }

        /* ─── audio mini button ─── */
        .su-audio-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          border: none; cursor: pointer;
          transition: all 0.2s ease;
          background: ${dk
            ? 'linear-gradient(135deg, hsla(280,55%,50%,0.25) 0%, hsla(210,75%,50%,0.2) 100%)'
            : 'linear-gradient(135deg, hsla(243,70%,20%,0.1) 0%, hsla(210,80%,40%,0.08) 100%)'
          };
          border: 1px solid ${dk ? 'hsla(280,60%,60%,0.3)' : 'hsla(243,84%,14%,0.15)'};
          color: ${dk ? 'hsl(280,60%,75%)' : 'hsl(243,84%,25%)'};
          backdrop-filter: blur(8px);
        }
        .su-audio-btn:hover {
          transform: scale(1.1);
          background: ${dk
            ? 'linear-gradient(135deg, hsla(280,55%,50%,0.4) 0%, hsla(210,75%,50%,0.35) 100%)'
            : 'linear-gradient(135deg, hsla(243,70%,20%,0.16) 0%, hsla(210,80%,40%,0.14) 100%)'
          };
          box-shadow: ${dk
            ? '0 0 12px hsla(280,60%,55%,0.3)'
            : '0 0 8px hsla(243,84%,14%,0.15)'
          };
        }
        .su-audio-btn:active { transform: scale(0.92); }

        /* ─── field icon ─── */
        .su-icon { color: ${accent}; opacity: 0.45; }
      `}</style>

      <audio ref={audioRef} playsInline className="hidden" />

      <div className={cn("su-page", isRtl && "rtl")}>
        <div className="su-bg" />

        {/* ── Top bar: back + toggle only ── */}
        <div className="relative z-20 flex items-center justify-between px-5 pt-3 pb-0 flex-shrink-0">
          <button
            onClick={() => navigate("/")}
            className="su-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{language === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>
          <ThemeLanguageToggle />
        </div>

        {/* ── Main layout: everything fits in remaining height ── */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 overflow-hidden px-5 pb-3 gap-3">

          {/* ── Logo ── */}
          <div className="flex-shrink-0 cursor-pointer" onClick={() => navigate("/")}>
            <Logo3D size="lg" />
          </div>

          {/* ── Siri Orb ── */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              onContextMenu={(e) => e.preventDefault()}
              className={cn("siri-wrap focus:outline-none", (isRecording || isPlayingAudio) && "siri-active")}
              aria-label={language === 'ar' ? 'اضغط وتحدث' : 'Hold to speak your email'}
            >
              <div className="siri-ripple" />
              <div className="siri-ripple siri-ripple-2" />
              <div className="siri-ripple siri-ripple-3" />
              <div className="siri-shell" />
              <div className="siri-lobe1" />
              <div className="siri-lobe2" />
              <div className="siri-lobe3" />
              <div className="siri-lobe4" />
              <div className="siri-specular" />
            </button>

            {/* Status hint */}
            <motion.p
              key={isRecording ? 'rec' : 'idle'}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: isRecording ? 'hsl(180,85%,60%)' : fgHi('0.3') }}
            >
              {isRecording
                ? (language === 'ar' ? `جارٍ الاستماع · ${countdown}` : `Listening · ${countdown}s`)
                : (language === 'ar' ? 'اضغط باستمرار للتحدث' : 'Hold to speak your email')}
            </motion.p>

            {/* Audio mini player */}
            <AnimatePresence>
              {isPlayingAudio && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                      setIsPlayingAudio(false);
                    }
                  }}
                  className="su-audio-btn"
                  aria-label="Pause"
                >
                  <Pause className="w-3 h-3" />
                </motion.button>
              )}
              {!isPlayingAudio && audioUnlocked && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      audioRef.current.play();
                    }
                  }}
                  className="su-audio-btn"
                  aria-label="Play"
                >
                  <Play className="w-3 h-3" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Email captured banner */}
            <AnimatePresence>
              {emailCaptured && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 py-2 rounded-2xl text-xs font-medium text-center"
                  style={{
                    background: dk ? 'hsla(142,76%,55%,0.1)' : 'hsla(142,60%,45%,0.08)',
                    border: '1px solid hsla(142,76%,55%,0.22)',
                    color: dk ? 'hsl(142,76%,62%)' : 'hsl(142,55%,32%)',
                  }}
                >
                  {language === 'ar'
                    ? '✓ شكراً! اكتب كلمة المرور لخصوصيتك — لا تقلها بصوت.'
                    : '✓ Thank you! Now type your password for privacy — don\u2019t say it.'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Glass form panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22,1,0.36,1] }}
            className="su-panel w-full max-w-sm px-5 py-4"
          >
            {/* Error */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 px-3 py-2.5 rounded-xl text-xs font-medium"
                  style={{
                    background: 'hsla(0,80%,50%,0.08)',
                    border: '1px solid hsla(0,80%,50%,0.18)',
                    color: dk ? 'hsl(0,80%,68%)' : 'hsl(0,60%,42%)',
                  }}
                >{errorMsg}</motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSignup} className="space-y-2.5">

              {/* Email */}
              <div className="relative">
                <Mail className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                <Input
                  id="email" placeholder={t.emailPlaceholder} type="email"
                  autoCapitalize="none" autoComplete="email" autoCorrect="off"
                  disabled={isLoading} value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailCaptured(false); }}
                  className={cn(fieldCls, "pl-9")} required
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                <Input
                  id="password" ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  placeholder={t.passwordPlaceholder}
                  autoCapitalize="none" autoComplete="new-password"
                  disabled={isLoading} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(fieldCls, "pl-9 pr-9")} required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="su-icon absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80 transition-opacity">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Optional fields toggle */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="su-details-pill"
                >
                  {language === 'ar' ? 'تفاصيل إضافية' : 'Add details'}
                  {showOptionalFields ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                </button>
              </div>

              {/* Optional fields */}
              <AnimatePresence>
                {showOptionalFields && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2.5"
                  >
                    {/* Name | Username row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <User className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                        <Input id="name" placeholder={language === 'ar' ? 'اسمك' : 'Your Name'} type="text" autoCapitalize="words" autoCorrect="off" disabled={isLoading} value={name} onChange={(e) => setName(e.target.value)} className={cn(fieldCls, "pl-9")} />
                      </div>
                      <div className="relative">
                        <AtSign className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                        <Input id="username" placeholder={language === 'ar' ? 'اسم المستخدم' : 'Username'} type="text" autoCapitalize="none" autoCorrect="off" disabled={isLoading} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} className={cn(fieldCls, "pl-9")} />
                      </div>
                    </div>
                    {/* DOB full width */}
                    <div className="relative">
                      <CalendarIcon className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none z-10" />
                      <Input id="dob" type="date" disabled={isLoading} value={dateOfBirth ? dateOfBirth.toISOString().slice(0,10) : ""} onChange={(e) => { const v = e.target.value; setDateOfBirth(v ? new Date(`${v}T00:00:00`) : undefined); }} className={cn(fieldCls, "pl-9", !dateOfBirth && "text-muted-foreground")} min="1900-01-01" max={new Date().toISOString().slice(0,10)} />
                    </div>
                    {/* Country | City row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Globe className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none z-10" />
                        <Select value={country} onValueChange={setCountry} disabled={isLoading}>
                          <SelectTrigger className={cn(fieldCls, "pl-9")}>
                            <SelectValue placeholder={t.selectCountry} />
                          </SelectTrigger>
                          <SelectContent className="max-h-52 rounded-xl">
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{language === 'ar' ? c.nameAr : c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative">
                        <MapPin className="su-icon absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none z-10" />
                        <Input id="city" placeholder={language === 'ar' ? 'مدينتك' : 'City'} type="text" autoCapitalize="words" autoCorrect="off" disabled={isLoading || !country} value={city} onChange={(e) => setCity(e.target.value)} className={cn(fieldCls, "pl-9")} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Terms */}
              <div className="flex items-start gap-2.5 pt-0.5">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(v) => setAgreedToTerms(v as boolean)}
                  disabled={isLoading}
                  className="su-checkbox mt-0.5"
                />
                <label htmlFor="terms" className="cursor-pointer text-[10px] leading-relaxed" style={{ color: fgHi('0.35') }}>
                  {language === 'ar' ? '* أوافق على ' : '* I agree to the '}
                  <button type="button" onClick={() => navigate("/privacy-terms")} className="font-bold underline decoration-dotted underline-offset-2" style={{ color: accent }}>
                    {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
                  </button>
                  {language === 'ar' ? ' و' : ' and '}
                  <button type="button" onClick={() => navigate("/privacy-terms")} className="font-bold underline decoration-dotted underline-offset-2" style={{ color: accent }}>
                    {language === 'ar' ? 'شروط الخدمة' : 'Terms of Service'}
                  </button>
                  {language === 'ar'
                    ? '، وأسمح باستخدام بياناتي مع '
                    : ', and I allow my text, voice & image data to be used with trusted '}
                  <button type="button" onClick={() => navigate("/privacy-terms#ai-providers")} className="font-semibold" style={{ color: dk ? 'hsl(45,100%,60%)' : 'hsl(25,95%,40%)' }}>
                    {language === 'ar' ? 'مزودي الذكاء الاصطناعي' : 'AI providers'}
                  </button>
                  {language === 'ar' ? ' لتشغيل وقتي.' : ' to power WAKTI.'}
                </label>
              </div>

              {/* Submit */}
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <button type="submit" disabled={isLoading || !agreedToTerms} className="su-pill">
                  {isLoading
                    ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                    : <><Sparkles className="w-3.5 h-3.5" />{t.signup}</>
                  }
                </button>
                <p className="text-[11px] text-center" style={{ color: fgHi('0.35') }}>
                  {t.alreadyHaveAccount}{' '}
                  <button
                    onClick={() => navigate("/login")}
                    className="su-login-link"
                  >
                    {t.login}
                  </button>
                </p>
              </div>

            </form>
          </motion.div>

        </div>
      </div>

      <EmailConfirmationDialog
        open={isEmailConfirmationDialogOpen}
        onClose={handleDialogClose}
      />
    </>
  );
}
