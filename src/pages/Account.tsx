import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { AccountCountrySection } from "@/components/AccountCountrySection";
import { AccountCitySection } from "@/components/AccountCitySection";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserProfile } from "@/services/contactsService";
import { t } from "@/utils/translations";
import { deleteUserAccount, updateUserPassword } from "@/utils/auth";
import { CustomPaywallModal } from "@/components/AppLayout";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { PaywallVariant } from "@/components/ProtectedRoute";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { AlertTriangle, Check, MessageSquare, Flag, CalendarIcon, User, CreditCard, CheckCircle, XCircle, Clock, RefreshCw, Sparkles, Sun, Users, Gift, Globe, Lock, GiftIcon, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { restorePurchases } from "@/integrations/natively/purchasesBridge";
import { MyGallery } from "@/components/social/MyGallery";
import { ContactsContent } from "@/pages/Contacts";

function ContactsEmbedded({ language }: { language: string }) {
  const [activeTab, setActiveTab] = React.useState('contacts');
  return (
    <ContactsContent
      language={language}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
}

// TrialCountdown Component - Shows remaining time of 24-hour trial
// When trial ends, shows friendly message with subscribe CTA
// Includes its own header - parent should NOT show "Free Trial Active" separately
const TrialCountdown = ({ startAt, language, onSubscribeClick }: { startAt: string; language: string; onSubscribeClick?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(startAt).getTime();
      const trialEnd = start + (24 * 60 * 60 * 1000); // 24 hours
      const now = Date.now();
      const diff = trialEnd - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        return;
      }
      
      setIsExpired(false);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(days > 0 ? `${days}d ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` : `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [startAt, language]);
  
  // When trial is expired, show message aligned with V3 (trial_expired) paywall
  if (isExpired) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-4xl">😊❤️</div>
        <div className="text-2xl font-bold text-foreground">
          {language === 'en' ? 'Trial ended' : 'انتهت الفترة التجريبية'}
        </div>
        <p className="text-muted-foreground max-w-xs mx-auto">
          {language === 'en' 
            ? "Hope you enjoyed Wakti! Subscribe now and you still get 3 more free days."
            : "نتمنى أنك استمتعت بوقتي! اشترك الآن ولا تزال تحصل على 3 أيام مجانية إضافية."
          }
        </p>
        <Button 
          onClick={onSubscribeClick}
          className="w-full max-w-xs bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:from-[hsl(210,100%,60%)] hover:via-[hsl(195,100%,55%)] hover:to-[hsl(175,100%,50%)] text-white font-bold shadow-[0_0_30px_hsl(200,100%,55%,0.4)]"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {language === 'en' ? 'Subscribe Now' : 'اشترك الآن'}
        </Button>
      </div>
    );
  }
  
  // When trial is active, show "24-Hour Trial Active" header + countdown
  return (
    <div className="text-center space-y-3 py-4">
      <div className="flex items-center justify-center gap-2 text-amber-500">
        <Clock className="h-5 w-5" />
        <span className="font-medium">
          {language === 'en' ? '24-Hour Trial Active' : 'الفترة التجريبية (24 ساعة) نشطة'}
        </span>
      </div>
      <div className="text-3xl font-bold text-center tabular-nums">
        {timeLeft}
      </div>
    </div>
  );
};

// Helper function to open native subscription management
const openManageSubscriptions = () => {
  // iPad with iPadOS 13+ reports as Macintosh, so we need to check for touch support too
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPadOS = navigator.userAgent.includes('Macintosh') && 'ontouchend' in document;
  const isAppleDevice = isIOS || isIPadOS;
  
  if (isAppleDevice) {
    // Use the App Store deep link scheme for iOS/iPadOS
    // This opens the native subscription management screen
    window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
  } else {
    // For Android, open Play Store subscriptions
    window.location.href = 'https://play.google.com/store/account/subscriptions';
  }
};

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const queryClient = useQueryClient();
  // Active tab synced with URL (?tab=profile|billing|social|wishes) without loops/flicker
  const initialTab = (() => {
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    if (tab === 'billing') return 'billing';
    if (tab === 'social') return 'social';
    if (tab === 'wishes') return 'wishes';
    return 'profile';
  })();
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'social' | 'wishes'>(initialTab);
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    let urlTab: 'profile' | 'billing' | 'social' | 'wishes' = 'profile';
    if (tab === 'billing') urlTab = 'billing';
    else if (tab === 'social') urlTab = 'social';
    else if (tab === 'wishes') urlTab = 'wishes';
    if (urlTab !== activeTab) setActiveTab(urlTab);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if ((params.get('tab') || 'profile') !== activeTab) {
      params.set('tab', activeTab);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [activeTab]);

  // Social tab state
  const [socialSubTab, setSocialSubTab] = useState("contacts");
  const [wishesPrivacy, setWishesPrivacy] = useState("contacts");
  const [wishesAllowClaims, setWishesAllowClaims] = useState(true);
  const [wishesAutoApprove, setWishesAutoApprove] = useState(false);
  const [wishesAllowSharing, setWishesAllowSharing] = useState(true);
  const [savingWishesSettings, setSavingWishesSettings] = useState(false);
  // Fetch wishlist privacy settings
  const { data: wishlistSettings } = useQuery({
    queryKey: ['wishlist-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('wishlist_allow_claims, wishlist_auto_approve_claims, wishlist_allow_sharing, wishlist_default_privacy')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (wishlistSettings) {
      setWishesPrivacy(wishlistSettings.wishlist_default_privacy || 'contacts');
      setWishesAllowClaims(wishlistSettings.wishlist_allow_claims ?? true);
      setWishesAutoApprove(wishlistSettings.wishlist_auto_approve_claims ?? false);
      setWishesAllowSharing(wishlistSettings.wishlist_allow_sharing ?? true);
    }
  }, [wishlistSettings]);

  const handleSaveWishesSettings = async () => {
    if (!user?.id) return;
    setSavingWishesSettings(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          wishlist_default_privacy: wishesPrivacy,
          wishlist_allow_claims: wishesAllowClaims,
          wishlist_auto_approve_claims: wishesAutoApprove,
          wishlist_allow_sharing: wishesAllowSharing,
        })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['wishlist-settings'] });
      toast.success(language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'Failed to save');
    } finally {
      setSavingWishesSettings(false);
    }
  };

  // Account states
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [dobInputValue, setDobInputValue] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingDob, setIsUpdatingDob] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  
  // Delete account states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Paywall modal state (for subscribe CTA from billing tab)
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  
  // Detect correct paywall variant using same logic as ProtectedRoute (priority: trial_expired > cancelled > new_user)
  const { isNewUser, wasSubscribed, isAccessExpired, profile } = useUserProfile();
  const paywallVariant: PaywallVariant = isAccessExpired ? 'trial_expired' : wasSubscribed ? 'cancelled' : 'new_user';
  
  // Restore purchases state
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Feedback states
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  // Abuse report states
  const [isAbuseDialogOpen, setIsAbuseDialogOpen] = useState(false);
  const [abuseType, setAbuseType] = useState("");
  const [abuseDetails, setAbuseDetails] = useState("");
  const [reportedUser, setReportedUser] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // Fetch user profile data
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  // Fetch subscription data
  const { data: subscriptionData, isLoading: isLoadingSubscription, error: subscriptionError } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_status, plan_name, next_billing_date, billing_start_date, payment_method, free_access_start_at, admin_gifted')
        .eq('id', user.id)
        .single();

      // Handle new user case - profile may not exist yet (PGRST116)
      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (subsError) throw subsError;

      return { profile, subscriptions: subscriptions || [] };
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  // Refetch billing data when profile is updated (e.g. after Skip/X on paywall)
  useEffect(() => {
    const handleProfileUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    };
    window.addEventListener('wakti-profile-updated', handleProfileUpdate);
    window.addEventListener('wakti-subscription-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('wakti-profile-updated', handleProfileUpdate);
      window.removeEventListener('wakti-subscription-updated', handleProfileUpdate);
    };
  }, [queryClient]);

  const billingProfile = subscriptionData?.profile;
  const hasActiveBillingAccess = !!billingProfile && (
    billingProfile.is_subscribed ||
    billingProfile.admin_gifted === true ||
    (
      !!billingProfile.payment_method &&
      billingProfile.payment_method !== 'manual' &&
      !!billingProfile.next_billing_date &&
      new Date(billingProfile.next_billing_date).getTime() > Date.now()
    )
  );
  const hasBillingTrialStarted = !!billingProfile?.free_access_start_at;

  // Load user data
  useEffect(() => {
    if (user) {
      // Name: prefer profile display_name, then display_name/full_name/name from metadata
      const displayName = userProfile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || '';
      // Don't show email as display name
      setName(displayName && !displayName.includes('@') ? displayName : '');

      if (user.email) {
        setEmail(user.email);
      }
      if (user.user_metadata?.date_of_birth) {
        const dobDate = new Date(user.user_metadata.date_of_birth);
        setDateOfBirth(dobDate);
        setDobInputValue(format(dobDate, "yyyy-MM-dd"));
      }
      // Username: only show if it's a real user-set username (not auto-generated userXXXXXXXX)
      const rawUsername = userProfile?.username || user.user_metadata?.username || '';
      const isAutoGenerated = /^user[0-9a-f]{8}$/i.test(rawUsername);
      setUsername(isAutoGenerated ? '' : rawUsername);
      setLoadingUserData(false);
    }
  }, [user, userProfile]);

  const originalDisplayName = userProfile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const normalizedOriginalDisplayName = originalDisplayName && !originalDisplayName.includes('@') ? originalDisplayName.trim() : '';
  const originalRawUsername = userProfile?.username || user?.user_metadata?.username || '';
  const originalUsernameIsAutoGenerated = /^user[0-9a-f]{8}$/i.test(originalRawUsername);
  const normalizedOriginalUsername = originalUsernameIsAutoGenerated ? '' : originalRawUsername.trim();
  const canSetNameOnce = !normalizedOriginalDisplayName;
  const canSetUsernameOnce = !normalizedOriginalUsername;
  const needsOneTimeProfileSetup = canSetNameOnce || canSetUsernameOnce;
  const setupTitle = canSetNameOnce && canSetUsernameOnce
    ? (language === 'ar' ? 'أكمل ملفك الشخصي' : 'Complete your profile')
    : canSetNameOnce
      ? (language === 'ar' ? 'أضف اسمك' : 'Add your name')
      : (language === 'ar' ? 'أضف اسم المستخدم' : 'Add your username');
  const setupDescription = canSetNameOnce && canSetUsernameOnce
    ? (language === 'ar' ? 'أضف اسمك واسم المستخدم مرة واحدة.' : 'Set your name and username once.')
    : canSetNameOnce
      ? (language === 'ar' ? 'أضف اسمك مرة واحدة.' : 'Set your name once.')
      : (language === 'ar' ? 'أضف اسم المستخدم مرة واحدة.' : 'Set your username once.');
  const setupButtonLabel = canSetNameOnce && canSetUsernameOnce
    ? (language === 'ar' ? 'حفظ الاسم واسم المستخدم' : 'Save Name and Username')
    : canSetNameOnce
      ? (language === 'ar' ? 'حفظ الاسم' : 'Save Name')
      : (language === 'ar' ? 'حفظ اسم المستخدم' : 'Save Username');

  const handleSaveOneTimeProfileSetup = async () => {
    if (!user?.id) return;

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (canSetNameOnce && !trimmedName) {
      toast.error(language === 'ar' ? 'يرجى إدخال الاسم' : 'Please enter your name');
      return;
    }

    if (canSetUsernameOnce && !trimmedUsername) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم المستخدم' : 'Please enter a username');
      return;
    }

    if (canSetUsernameOnce && !/^[a-zA-Z0-9._]{3,20}$/.test(trimmedUsername)) {
      toast.error(language === 'ar'
        ? 'اسم المستخدم يجب أن يكون من 3 إلى 20 حرفاً ويحتوي فقط على أحرف أو أرقام أو نقطة أو شرطة سفلية'
        : 'Username must be 3-20 characters and can only use letters, numbers, dots, or underscores');
      return;
    }

    setIsUpdatingProfile(true);

    try {
      const profileUpdates: { display_name?: string; username?: string } = {};
      const authUpdates: { full_name?: string; username?: string } = {};

      if (canSetNameOnce) {
        profileUpdates.display_name = trimmedName;
        authUpdates.full_name = trimmedName;
      }

      if (canSetUsernameOnce) {
        profileUpdates.username = trimmedUsername;
        authUpdates.username = trimmedUsername;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({ data: authUpdates });
      if (authError) throw authError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);

      window.dispatchEvent(new CustomEvent('wakti-profile-updated'));

      toast.success(language === 'ar'
        ? 'تم حفظ بيانات الملف الشخصي مرة واحدة بنجاح'
        : 'Your one-time profile setup was saved successfully');
    } catch (error: any) {
      const message = error?.message || '';
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        toast.error(language === 'ar' ? 'اسم المستخدم مستخدم بالفعل' : 'That username is already taken');
      } else {
        toast.error(language === 'ar' ? 'تعذر حفظ بيانات الملف الشخصي' : 'Failed to save profile setup');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  // Handle date input change
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

  // Handle calendar date selection
  const handleCalendarDateSelect = (date: Date | undefined) => {
    setDateOfBirth(date);
    if (date) {
      setDobInputValue(format(date, "yyyy-MM-dd"));
    } else {
      setDobInputValue("");
    }
  };
  
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);
    
    try {
      await updateEmail(email);
      toast.success(t("emailUpdated", language));
    } catch (error: any) {
      toast.error(t("errorUpdatingEmail", language));
    } finally {
      setIsUpdatingEmail(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error(t("passwordsDoNotMatch", language));
      return;
    }
    
    if (!currentPassword) {
      toast.error(t("currentPasswordRequired", language));
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      const { error } = await updateUserPassword(currentPassword, password);
      if (error) {
        toast.error(t("error", language), {
          description: error.message || t("errorUpdatingPassword", language)
        });
      } else {
        toast.success(t("passwordUpdated", language));
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast.error(t("errorUpdatingPassword", language));
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleSignout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast.error(t("errorSigningOut", language));
    }
  };
  
  // Delete Account handlers
  const openDeleteDialog = () => {
    setConfirmationEmail("");
    setIsDeleteDialogOpen(true);
  };
  
  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };
  
  const handleConfirmEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmationEmail(e.target.value);
  };
  
  const isEmailMatch = () => {
    return confirmationEmail === user?.email;
  };
  
  // Removed openDeleteConfirmDialog - now using single dialog flow
  
  const handleDeleteAccount = async () => {
    if (!isEmailMatch()) {
      toast.error(t("error", language), {
        description: "Email does not match your account email."
      });
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const { error } = await deleteUserAccount();
      
      if (error) {
        toast.error(t("error", language), {
          description: error.message || "Failed to delete account"
        });
      } else {
        // Account deleted successfully - navigate to goodbye screen FIRST
        // The goodbye screen will handle signing out after it mounts
        // This prevents ProtectedRoute from redirecting to login before we can show goodbye
        navigate("/goodbye", { replace: true });
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(t("error", language), {
        description: "An unexpected error occurred"
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };
  
  // Restore purchases handler - calls native Apple restore via Natively SDK
  // Per RevenueCat docs: SUCCESS means restore completed, but we must verify entitlements
  const handleRestorePurchases = () => {
    setIsRestoring(true);
    
    // Call native restore - Natively SDK talks to Apple/RevenueCat
    // Callback receives: { status: 'SUCCESS' | 'FAILED', customerId, error }
    // NOTE: SUCCESS only means the restore operation completed, NOT that purchases were found!
    restorePurchases((resp: any) => {
      console.log('[Restore] Native SDK response:', resp);
      
      try {
        // After restore (success or fail), we MUST check backend to verify entitlements
        // This is because SUCCESS just means "restore completed" not "purchases found"
        const verifySubscription = () => {
          if (!user?.id) {
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setIsRestoring(false);
            return;
          }
          
          // Check subscription via RevenueCat REST API (our backend)
          supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          }).then(({ data, error }) => {
            console.log('[Restore] Backend verification result:', data, error);
            
            if (data?.isSubscribed) {
              // Purchases were found and restored!
              toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
              queryClient.invalidateQueries({ queryKey: ['subscription'] });
              setTimeout(() => window.location.reload(), 500);
            } else if (subscriptionData?.profile?.is_subscribed) {
              // Already subscribed locally
              toast.success(language === 'ar' ? 'أنت مشترك بالفعل!' : 'You are already subscribed!');
              setIsRestoring(false);
            } else {
              // No purchases found
              toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
              setIsRestoring(false);
            }
          }).catch(err => {
            console.error('[Restore] Backend verification failed:', err);
            // If backend fails but user is subscribed locally, show success
            if (subscriptionData?.profile?.is_subscribed) {
              toast.success(language === 'ar' ? 'أنت مشترك بالفعل!' : 'You are already subscribed!');
            } else {
              toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            }
            setIsRestoring(false);
          });
        };
        
        // If native restore succeeded, verify with backend
        if (resp?.status === 'SUCCESS') {
          console.log('[Restore] Native restore completed, verifying with backend...');
          verifySubscription();
          return;
        }
        
        // Native restore failed - still try backend verification
        // (handles cross-device restore where native has no local receipt)
        console.log('[Restore] Native restore status:', resp?.status, 'Error:', resp?.error);
        console.log('[Restore] Trying backend verification as fallback...');
        verifySubscription();
        
      } catch (err) {
        console.error('[Restore] Error in callback:', err);
        toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
        setIsRestoring(false);
      }
    });
  };

  // Date of Birth handler
  const handleUpdateDateOfBirth = async () => {
    if (!dateOfBirth) {
      toast.error(t("dobRequired", language));
      return;
    }
    
    setIsUpdatingDob(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          date_of_birth: dateOfBirth.toISOString().split('T')[0]
        }
      });
      
      if (error) {
        toast.error(t("errorUpdatingDob", language));
      } else {
        toast.success(t("dobUpdated", language));
      }
    } catch (error) {
      toast.error(t("errorUpdatingDob", language));
    } finally {
      setIsUpdatingDob(false);
    }
  };
  
  // Feedback handlers
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedbackType || !feedbackTitle || !feedbackMessage) {
      toast.error(t("error", language), {
        description: "Please fill in all required fields"
      });
      return;
    }
    
    setIsSubmittingFeedback(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('submit-contact-form', {
        body: {
          name: username || user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Anonymous',
          email: user?.email || '',
          subject: `${feedbackType === 'bug' ? 'Bug Report' : feedbackType === 'feature' ? 'Feature Request' : 'General Feedback'}: ${feedbackTitle}`,
          message: feedbackMessage,
          submissionType: 'feedback'
        }
      });

      if (error) {
        console.error('Error submitting feedback:', error);
        throw error;
      }

      console.log('Feedback submitted successfully:', data);
      toast.success(t("feedbackSubmitted", language));
      setIsFeedbackDialogOpen(false);
      setFeedbackType("");
      setFeedbackTitle("");
      setFeedbackMessage("");
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error(t("errorSubmittingFeedback", language));
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Abuse report handlers
  const handleSubmitAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!abuseType || !abuseDetails) {
      toast.error(t("error", language), {
        description: "Please fill in all required fields"
      });
      return;
    }
    
    setIsSubmittingReport(true);
    
    try {
      // In a real app, this would send to your backend
      console.log("Submitting abuse report:", {
        type: abuseType,
        details: abuseDetails,
        reportedUser: reportedUser,
        reporterId: user?.id
      });
      
      toast.success(t("abuseReported", language));
      setIsAbuseDialogOpen(false);
      setAbuseType("");
      setAbuseDetails("");
      setReportedUser("");
    } catch (error) {
      toast.error(t("errorSubmittingReport", language));
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <PageContainer showHeader={false}>
      <div className="min-h-screen">

        {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-background px-4 pt-5 pb-3">
          <div className="relative z-10 rounded-2xl border border-[#060541] dark:border-border bg-card/60 shadow-[0_1px_3px_rgba(15,23,42,0.08)] backdrop-blur-sm px-4 py-3 flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 rounded-full ring-2 ring-[#060541]/10 dark:ring-white/20 overflow-hidden bg-gradient-to-br from-[hsl(210,100%,55%)] to-[hsl(180,85%,50%)] flex items-center justify-center">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-lg font-bold text-white">{(name || email || '?').substring(0, 2).toUpperCase()}</span>
              }
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-[#060541] dark:text-white">{name || t("account", language)}</h1>
              {email && <p className="truncate text-sm text-[#060541]/50 dark:text-white/40 mt-0.5">{email}</p>}
            </div>
          </div>
        </div>

        {/* ── TAB BAR — below hero, on page background ─────────────────────── */}
        <div className="sticky top-0 z-20 px-4 pt-1 pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-b border-[#d7dbe5] dark:border-border">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profile' | 'billing' | 'social' | 'wishes')} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-10 bg-muted rounded-2xl p-1 border border-[#d7dbe5] dark:border-border shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <TabsTrigger value="profile" className="rounded-xl text-[11px] font-bold data-[state=active]:bg-[#060541] data-[state=active]:text-white dark:data-[state=active]:bg-[hsl(210,100%,55%)] data-[state=active]:shadow-none transition-all flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {language === 'ar' ? 'الملف' : 'Profile'}
            </TabsTrigger>
            <TabsTrigger value="social" className="rounded-xl text-[11px] font-bold data-[state=active]:bg-[hsl(142,76%,42%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              {language === 'ar' ? 'التواصل' : 'Social'}
            </TabsTrigger>
            <TabsTrigger value="wishes" className="rounded-xl text-[11px] font-bold data-[state=active]:bg-[hsl(320,70%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex items-center gap-1">
              <Gift className="h-3 w-3 shrink-0" />
              {language === 'ar' ? 'الرغبات' : 'Wishes'}
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl text-[11px] font-bold data-[state=active]:bg-[hsl(45,95%,45%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex items-center gap-1">
              <CreditCard className="h-3 w-3 shrink-0" />
              {language === 'ar' ? 'الفاتورة' : 'Billing'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 px-3 pt-3 pb-24 sm:px-4">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <Card className="border border-[#d7dbe5] dark:border-border bg-card rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                <CardHeader className="pb-2 pt-5 text-center">
                  <CardTitle className="text-base">{t("profile", language)}</CardTitle>
                  <CardDescription>
                    {t("profileManagement", language)}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-[#d7dbe5] dark:border-border bg-card rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                <CardContent className="pt-5 pb-5">
                  <ProfileImageUpload showPreview={false} />
                </CardContent>
              </Card>

              <Card className="border border-[#d7dbe5] dark:border-border bg-card rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                <CardContent className="space-y-5 pt-5 pb-5">
                  {needsOneTimeProfileSetup && (
                    <div className="rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 space-y-2 shadow-[0_1px_3px_rgba(245,158,11,0.12)]">
                      <p className="text-sm font-semibold text-foreground">
                        {setupTitle}
                      </p>
                      <p className="text-xs text-muted-foreground leading-6">
                        {setupDescription}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="username">{t("username", language)}</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        readOnly={!canSetUsernameOnce}
                        disabled={loadingUserData || isUpdatingProfile}
                        placeholder={canSetUsernameOnce ? (language === 'ar' ? 'اختر اسم المستخدم مرة واحدة' : 'Choose your username once') : ''}
                        className={!canSetUsernameOnce ? "border-[#d7dbe5] dark:border-border bg-muted cursor-not-allowed" : "border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {canSetUsernameOnce
                          ? (language === 'ar'
                              ? 'يمكنك اختيار اسم المستخدم الآن مرة واحدة فقط.'
                              : 'You can choose your username now one time only.')
                          : t("usernameHelpText", language)}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="name">{t("name", language)}</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        readOnly={!canSetNameOnce}
                        disabled={loadingUserData || isUpdatingProfile}
                        placeholder={canSetNameOnce ? (language === 'ar' ? 'أدخل اسمك مرة واحدة' : 'Enter your name once') : ''}
                        className={!canSetNameOnce ? "border-[#d7dbe5] dark:border-border bg-muted cursor-not-allowed" : "border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {canSetNameOnce
                          ? (language === 'ar'
                              ? 'يمكنك إدخال اسمك الآن مرة واحدة فقط.'
                              : 'You can enter your name now one time only.')
                          : (language === 'ar'
                              ? 'تم حفظ الاسم بالفعل ولا يمكن تعديله من هنا.'
                              : 'Your name is already set and cannot be edited here.')}
                      </p>
                    </div>
                  </div>

                  {needsOneTimeProfileSetup && (
                    <Button
                      onClick={handleSaveOneTimeProfileSetup}
                      disabled={isUpdatingProfile || (canSetNameOnce && !name.trim()) || (canSetUsernameOnce && !username.trim())}
                      className="w-full bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(280,70%,65%)] text-white shadow-[0_0_24px_hsla(210,100%,65%,0.25)]"
                    >
                      {isUpdatingProfile
                        ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                        : setupButtonLabel}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-[#d7dbe5] dark:border-border bg-card rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                <CardContent className="space-y-6 pt-5 pb-5">
                  <div className="grid gap-2">
                    <Label htmlFor="dob" className="text-base font-medium">
                      {t("dateOfBirth", language)}
                    </Label>
                    <div className="space-y-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal py-6 text-base border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
                              !dateOfBirth && "text-muted-foreground",
                              language === 'ar' && "text-right"
                            )}
                            disabled={isUpdatingDob}
                          >
                            <CalendarIcon className={cn("h-5 w-5", language === 'ar' ? "ml-2" : "mr-2")} />
                            {dateOfBirth ? (
                              format(dateOfBirth, language === 'ar' ? "dd/MM/yyyy" : "MMM dd, yyyy")
                            ) : (
                              t("pickDate", language)
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="center">
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

                      <p className="text-xs text-muted-foreground">
                        {t("dobHelpText", language)}
                      </p>
                    </div>

                    <div className="mt-2">
                      <Button
                        onClick={handleUpdateDateOfBirth}
                        disabled={isUpdatingDob || !dateOfBirth}
                        className="w-full bg-primary/80 hover:bg-primary text-white font-semibold py-6"
                      >
                        {isUpdatingDob
                          ? t("updating", language)
                          : t("updateDateOfBirth", language)}
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateEmail} className="pt-4 border-t border-[#d7dbe5] dark:border-border">
                    <div className="grid gap-2">
                      <Label htmlFor="email">{t("email", language)}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loadingUserData || isUpdatingEmail}
                        className="border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                      />
                    </div>
                    <div className="mt-4">
                      <Button
                        disabled={isUpdatingEmail || loadingUserData}
                        type="submit"
                      >
                        {isUpdatingEmail
                          ? t("updating", language)
                          : t("updateEmail", language)}
                      </Button>
                    </div>
                  </form>

                  <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-[#d7dbe5] dark:border-border">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="current-password">{t("currentPassword", language)}</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={isUpdatingPassword}
                          className="border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 md:gap-6">
                        <div className="grid gap-2">
                          <Label htmlFor="password">{t("newPassword", language)}</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isUpdatingPassword}
                            className="border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="confirm-password">{t("confirmPassword", language)}</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isUpdatingPassword}
                            className="border-[#d7dbe5] dark:border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        disabled={isUpdatingPassword || !currentPassword || !password || !confirmPassword}
                        type="submit"
                      >
                        {isUpdatingPassword
                          ? t("updating", language)
                          : t("updatePassword", language)}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Country + City in one row */}
            <div id="location" className="scroll-mt-24">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Sun className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {language === 'ar' ? 'موقعك (اختياري)' : 'Your Location (optional)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' 
                      ? 'أضف موقعك للحصول على تحديثات الطقس المحلية ☀️'
                      : 'Add your location to get local weather updates ☀️'
                    }
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AccountCountrySection />
                <AccountCitySection />
              </div>
            </div>
            
            {/* Submit Feedback Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {t("submitFeedback", language)}
                </CardTitle>
                <CardDescription>
                  {t("feedbackDescription", language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/help?tab=support')}
                  className="w-full sm:w-auto"
                >
                  {t("submitFeedback", language)}
                </Button>
              </CardContent>
            </Card>
            
            {/* Report Abuse Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  {t("reportAbuse", language)}
                </CardTitle>
                <CardDescription>
                  {t("abuseDescription", language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/help?tab=support')}
                  className="w-full sm:w-auto"
                >
                  {t("reportAbuse", language)}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t("accountOptions", language)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="destructive" 
                  onClick={handleSignout}
                >
                  {t("logout", language)}
                </Button>
              </CardContent>
            </Card>
            
            {/* Delete Account Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t("deleteAccount", language)}
                </CardTitle>
                <CardDescription>
                  {t("deleteAccountDescription", language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={openDeleteDialog}
                  className="w-full sm:w-auto"
                >
                  {t("deleteMyAccount", language)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SOCIAL TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="social" className="px-4 pt-4 pb-24">
            <Tabs defaultValue="contacts">
              <TabsList className="w-full grid grid-cols-2 mb-4 h-10 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border-0">
                <TabsTrigger value="contacts" className="rounded-xl text-xs font-bold text-foreground/50 data-[state=active]:bg-[hsl(210,100%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all">
                  {language === 'ar' ? 'جهات الاتصال' : 'Contacts'}
                </TabsTrigger>
                <TabsTrigger value="gallery" className="rounded-xl text-xs font-bold text-foreground/50 data-[state=active]:bg-[hsl(25,95%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all">
                  {language === 'ar' ? 'معرضي' : 'My Gallery'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contacts" className="mt-0 -mx-4">
                <ContactsEmbedded language={language} />
              </TabsContent>

              <TabsContent value="gallery" className="mt-0">
                <MyGallery />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── WISHES SETTINGS TAB ────────────────────────────────────────── */}
          <TabsContent value="wishes" className="space-y-4 px-4 pt-4 pb-24">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-pink-500" />
                  {language === 'ar' ? 'إعدادات قوائم الرغبات' : 'Wishlist Settings'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar'
                    ? 'تحكم في كيفية مشاركة رغباتك مع أصدقائك'
                    : 'Control how your wishlists are shared with friends'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Default privacy */}
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الخصوصية الافتراضية' : 'Default Privacy'}</Label>
                  <Select value={wishesPrivacy} onValueChange={setWishesPrivacy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacts">
                        <span className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-green-500" />
                          {language === 'ar' ? 'جهات الاتصال فقط' : 'Contacts only'}
                        </span>
                      </SelectItem>
                      <SelectItem value="public">
                        <span className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-blue-500" />
                          {language === 'ar' ? 'عام' : 'Public'}
                        </span>
                      </SelectItem>
                      <SelectItem value="private">
                        <span className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-gray-500" />
                          {language === 'ar' ? 'خاص' : 'Private'}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Allow claims */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{language === 'ar' ? 'السماح بالحجز' : 'Allow Claims'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'يسمح للأصدقاء بحجز هداياك' : 'Let friends reserve items from your lists'}
                    </p>
                  </div>
                  <Switch checked={wishesAllowClaims} onCheckedChange={setWishesAllowClaims} />
                </div>

                {/* Auto approve */}
                {wishesAllowClaims && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{language === 'ar' ? 'الموافقة التلقائية' : 'Auto-Approve Claims'}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'قبول الحجوزات تلقائياً دون مراجعة' : 'Approve friend claims automatically'}
                      </p>
                    </div>
                    <Switch checked={wishesAutoApprove} onCheckedChange={setWishesAutoApprove} />
                  </div>
                )}

                {/* Allow sharing */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{language === 'ar' ? 'السماح بالمشاركة' : 'Allow Sharing'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'يسمح لأصدقائك بمشاركة قوائمك' : 'Let friends share your wishlists'}
                    </p>
                  </div>
                  <Switch checked={wishesAllowSharing} onCheckedChange={setWishesAllowSharing} />
                </div>

                <Button
                  onClick={handleSaveWishesSettings}
                  disabled={savingWishesSettings}
                  className="w-full"
                >
                  {savingWishesSettings
                    ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                    : (language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings')}
                </Button>
              </CardContent>
            </Card>

            {/* Quick link to My Wishlists page */}
            <Card
              className="cursor-pointer active:scale-[0.98] transition-all border border-pink-500/20 bg-gradient-to-r from-pink-500/8 to-[hsl(320,70%,55%)]/8"
              onClick={() => navigate('/wishlists')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[hsl(320,70%,55%)] to-pink-500 flex items-center justify-center">
                    <GiftIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {language === 'ar' ? 'إدارة قوائمي' : 'Manage My Wishlists'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'إنشاء وتعديل قوائم رغباتك' : 'Create and manage your wishlist items'}
                    </p>
                  </div>
                </div>
                <Gift className="h-5 w-5 text-pink-500" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4 px-4 pt-4 pb-24">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t("billing", language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ERROR STATE: Show error message with retry button */}
                {subscriptionError ? (
                  <div className="text-center py-8 space-y-4">
                    <XCircle className="h-12 w-12 text-destructive mx-auto" />
                    <div className="space-y-2">
                      <p className="font-medium text-destructive">
                        {language === 'en' ? 'Failed to load billing information' : 'فشل تحميل معلومات الفواتير'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'en' ? 'Please check your connection and try again' : 'يرجى التحقق من اتصالك والمحاولة مرة أخرى'}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['subscription'] })}
                    >
                      {language === 'en' ? 'Retry' : 'إعادة المحاولة'}
                    </Button>
                  </div>
                ) : isLoadingSubscription ? (
                  /* LOADING STATE: Show spinner while fetching data */
                  <div className="text-center py-8 space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' ? 'Loading billing information...' : 'جاري تحميل معلومات الفواتير...'}
                    </p>
                  </div>
                ) : (
                  /* DATA STATES: Show appropriate content based on subscription status */
                  <>
                    {/* STATE 1: Trial (Active or Expired) - TrialCountdown handles both states */}
                    {billingProfile && !hasActiveBillingAccess && hasBillingTrialStarted && (() => {
                      // Calculate if trial is still active
                      const start = new Date(billingProfile.free_access_start_at!).getTime();
                      const trialEnd = start + (24 * 60 * 60 * 1000); // 24 hours
                      const isTrialActive = Date.now() < trialEnd;
                      
                      return (
                        <>
                          <TrialCountdown 
                            startAt={billingProfile.free_access_start_at!} 
                            language={language} 
                            onSubscribeClick={() => setShowPaywallModal(true)}
                          />
                          {/* Active trial: Subscribe + Restore only for cancelled variant */}
                          {isTrialActive && (
                            <div className="flex flex-col items-center gap-2 pt-2">
                              <Button
                                onClick={() => setShowPaywallModal(true)}
                                className="w-full max-w-xs bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:from-[hsl(210,100%,60%)] hover:via-[hsl(195,100%,55%)] hover:to-[hsl(175,100%,50%)] text-white font-bold shadow-[0_0_30px_hsl(200,100%,55%,0.4)]"
                                size="lg"
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
                              </Button>
                              {paywallVariant === 'cancelled' && (
                                <Button
                                  variant="outline"
                                  onClick={handleRestorePurchases}
                                  disabled={isRestoring}
                                  className="w-full max-w-xs"
                                >
                                  {isRestoring ? (
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                  )}
                                  {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
                                </Button>
                              )}
                            </div>
                          )}
                          {/* Expired trial: Restore only for cancelled variant */}
                          {!isTrialActive && paywallVariant === 'cancelled' && (
                            <div className="flex flex-col items-center gap-2 pt-2">
                              <Button
                                variant="outline"
                                onClick={handleRestorePurchases}
                                disabled={isRestoring}
                                className="w-full max-w-xs"
                              >
                                {isRestoring ? (
                                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    
                    {/* STATE 2: Subscribed - Show Status + Manage Button */}
                    {hasActiveBillingAccess && (
                      <div className="text-center space-y-4 py-4">
                        <div className="flex items-center justify-center gap-2 text-green-500">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">
                            {language === 'en' ? 'You are subscribed' : 'أنت مشترك'}
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={openManageSubscriptions}
                          className="w-full max-w-xs"
                        >
                          {language === 'en' ? 'Manage Subscription' : 'إدارة الاشتراك'}
                        </Button>
                        {/* Restore Purchases button - Apple requirement */}
                        <Button
                          variant="ghost"
                          onClick={handleRestorePurchases}
                          disabled={isRestoring}
                          className="w-full max-w-xs text-muted-foreground"
                        >
                          {isRestoring ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
                        </Button>
                      </div>
                    )}
                    
                    {/* STATE 3: No Subscription, No Trial (new_user) */}
                    {billingProfile && !hasActiveBillingAccess && !hasBillingTrialStarted && (
                      <div className="text-center space-y-4 py-4">
                        <p className="text-muted-foreground">
                          {language === 'en' 
                            ? 'Welcome to Wakti! Subscribe now to enjoy 3 free trial days.' 
                            : 'مرحباً بك في وقتي! اشترك الآن واستمتع بـ 3 أيام تجريبية مجانية.'}
                        </p>
                        <Button 
                          onClick={() => setShowPaywallModal(true)}
                          className="w-full max-w-xs bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:from-[hsl(210,100%,60%)] hover:via-[hsl(195,100%,55%)] hover:to-[hsl(175,100%,50%)] text-white font-bold shadow-[0_0_30px_hsl(200,100%,55%,0.4)]"
                          size="lg"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Subscribe Now' : 'اشترك الآن'}
                        </Button>
                        {/* Restore only for cancelled variant (previously subscribed) */}
                        {paywallVariant === 'cancelled' && (
                          <Button
                            variant="outline"
                            onClick={handleRestorePurchases}
                            disabled={isRestoring}
                            className="w-full max-w-xs"
                          >
                            {isRestoring ? (
                              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* STATE 4: No Data (Fallback) */}
                    {!subscriptionData?.profile && (
                      <p className="text-muted-foreground text-center py-8">
                        {language === 'en' ? 'No billing information available' : 'لا توجد معلومات فواتير متاحة'}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>{/* end sticky tab bar div */}
      </div>{/* end min-h-screen */}
      
      {/* Submit Feedback Dialog */}
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t("feedbackForm", language)}
            </DialogTitle>
            <DialogDescription>
              {t("feedbackDescription", language)}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="feedback-type">{t("feedbackType", language)}</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectFeedbackType", language)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">{t("bugReport", language)}</SelectItem>
                  <SelectItem value="feature">{t("featureRequest", language)}</SelectItem>
                  <SelectItem value="general">{t("generalFeedback", language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="feedback-title">{t("feedbackTitle", language)}</Label>
              <Input
                id="feedback-title"
                value={feedbackTitle}
                onChange={(e) => setFeedbackTitle(e.target.value)}
                placeholder={t("enterFeedbackTitle", language)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="feedback-message">{t("feedbackMessage", language)}</Label>
              <Textarea
                id="feedback-message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder={t("enterFeedbackMessage", language)}
                rows={4}
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsFeedbackDialogOpen(false)}
                disabled={isSubmittingFeedback}
              >
                {t("cancel", language)}
              </Button>
              <Button 
                type="submit"
                disabled={isSubmittingFeedback || !feedbackType || !feedbackTitle || !feedbackMessage}
              >
                {isSubmittingFeedback 
                  ? t("loading", language) 
                  : t("submitFeedbackButton", language)
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Report Abuse Dialog */}
      <Dialog open={isAbuseDialogOpen} onOpenChange={setIsAbuseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              {t("abuseReportForm", language)}
            </DialogTitle>
            <DialogDescription>
              {t("abuseDescription", language)}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitAbuse} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="abuse-type">{t("abuseType", language)}</Label>
              <Select value={abuseType} onValueChange={setAbuseType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectAbuseType", language)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">{t("harassment", language)}</SelectItem>
                  <SelectItem value="spam">{t("spam", language)}</SelectItem>
                  <SelectItem value="inappropriate">{t("inappropriateContent", language)}</SelectItem>
                  <SelectItem value="fake">{t("fakeProfile", language)}</SelectItem>
                  <SelectItem value="other">{t("other", language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="reported-user">{t("reportedUser", language)} ({t("optional", language)})</Label>
              <Input
                id="reported-user"
                value={reportedUser}
                onChange={(e) => setReportedUser(e.target.value)}
                placeholder={t("enterReportedUser", language)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="abuse-details">{t("abuseDetails", language)}</Label>
              <Textarea
                id="abuse-details"
                value={abuseDetails}
                onChange={(e) => setAbuseDetails(e.target.value)}
                placeholder={t("enterAbuseDetails", language)}
                rows={4}
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAbuseDialogOpen(false)}
                disabled={isSubmittingReport}
              >
                {t("cancel", language)}
              </Button>
              <Button 
                type="submit"
                disabled={isSubmittingReport || !abuseType || !abuseDetails}
              >
                {isSubmittingReport 
                  ? t("loading", language) 
                  : t("submitReport", language)
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Account Dialog - Single Clean Flow */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("deleteAccount", language)}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'سيتم حذف حسابك وجميع بياناتك نهائياً. لا يمكن التراجع عن هذا الإجراء.'
                : 'This will permanently delete your account and all associated data. This action cannot be undone.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive font-medium">
                {language === 'ar'
                  ? '⚠️ سيتم حذف: الملف الشخصي، المهام، الأحداث، المحادثات، وجميع البيانات المرتبطة.'
                  : '⚠️ This will delete: profile, tasks, events, conversations, and all associated data.'
                }
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {language === 'ar'
                  ? 'للتأكيد، اكتب بريدك الإلكتروني:'
                  : 'To confirm, type your email address:'
                }
              </p>
              <Input
                value={confirmationEmail}
                onChange={handleConfirmEmailChange}
                placeholder={user?.email || "your@email.com"}
                className="w-full"
                autoComplete="off"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={closeDeleteDialog}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {t("cancel", language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={!isEmailMatch() || isDeleting}
              className="w-full sm:w-auto"
            >
              {isDeleting 
                ? (language === 'ar' ? 'جارٍ الحذف...' : 'Deleting...')
                : (language === 'ar' ? 'نعم، احذف حسابي نهائياً' : 'Yes, permanently delete my account')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Paywall Modal - triggered from billing tab subscribe CTA */}
      <CustomPaywallModal open={showPaywallModal} onOpenChange={setShowPaywallModal} variant={paywallVariant} />
    </PageContainer>
  );
}
