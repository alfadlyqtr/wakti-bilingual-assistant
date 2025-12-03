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
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { AlertTriangle, Check, MessageSquare, Flag, CalendarIcon, User, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// TrialCountdown Component - Shows remaining time of 30-minute trial
const TrialCountdown = ({ startAt, language }: { startAt: string; language: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(startAt).getTime();
      const trialEnd = start + (30 * 60 * 1000); // 30 minutes
      const now = Date.now();
      const diff = trialEnd - now;
      
      if (diff <= 0) {
        setTimeLeft(language === 'en' ? 'Trial ended' : 'انتهت الفترة التجريبية');
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [startAt, language]);
  
  return (
    <div className="text-3xl font-bold text-center tabular-nums">
      {timeLeft}
    </div>
  );
};

// Helper function to open native subscription management
const openManageSubscriptions = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // Use the App Store deep link scheme for iOS
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
  // Active tab synced with URL (?tab=profile|billing) without loops/flicker
  const initialTab = (() => {
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    return tab === 'billing' ? 'billing' : 'profile';
  })();
  const [activeTab, setActiveTab] = useState<'profile' | 'billing'>(initialTab);
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    const urlTab: 'profile' | 'billing' = tab === 'billing' ? 'billing' : 'profile';
    if (urlTab !== activeTab) setActiveTab(urlTab);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if ((params.get('tab') || 'profile') !== activeTab) {
      params.set('tab', activeTab);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [activeTab]);

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
        .select('is_subscribed, subscription_status, plan_name, next_billing_date, billing_start_date, payment_method, free_access_start_at')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

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
  });

  // Load user data
  useEffect(() => {
    if (user) {
      if (user.user_metadata?.full_name) {
        setName(user.user_metadata.full_name);
      }
      if (user.email) {
        setEmail(user.email);
      }
      if (user.user_metadata?.date_of_birth) {
        const dobDate = new Date(user.user_metadata.date_of_birth);
        setDateOfBirth(dobDate);
        setDobInputValue(format(dobDate, "yyyy-MM-dd"));
      }
      // Prioritize profile username/display_name over email fallback
      const profileUsername = userProfile?.username || userProfile?.display_name;
      setUsername(profileUsername || user.user_metadata?.username || user.email?.split('@')[0] || '');
      setLoadingUserData(false);
    }
  }, [user, userProfile]);
  
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
        // Account deleted successfully - redirect to goodbye screen
        // No need to sign out since the auth user is already deleted
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
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {t("account", language)}
        </h1>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profile' | 'billing')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1">
            <TabsTrigger value="profile" className="flex flex-col items-center gap-1 p-3">
              <User className="h-4 w-4" />
              <span className="text-xs">{t("profile", language)}</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex flex-col items-center gap-1 p-3">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">{t("billing", language)}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("profile", language)}</CardTitle>
                <CardDescription>
                  {t("profileManagement", language)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProfileImageUpload />
                
                {/* Username - Read-only */}
                <div className="grid gap-2">
                  <Label htmlFor="username">{t("username", language)}</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("usernameHelpText", language)}
                  </p>
                </div>
                
                {/* Name - Now read-only */}
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("name", language)}</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>

                {/* Date of Birth - Enhanced with proper Arabic support */}
                <div className="grid gap-2">
                  <Label htmlFor="dob" className="text-base font-medium">
                    {t("dateOfBirth", language)}
                  </Label>
                  
                  {/* Direct Date Input */}
                  <div className="space-y-3">
                    <Input
                      id="dob"
                      type="date"
                      value={dobInputValue}
                      onChange={handleDobInputChange}
                      disabled={isUpdatingDob}
                      max={new Date().toISOString().split('T')[0]}
                      min="1900-01-01"
                      className="w-full text-base"
                      placeholder={language === 'ar' ? 'اختر التاريخ' : 'Select date'}
                    />
                    
                    {/* Alternative Calendar Picker */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t("useCalendarPicker", language)}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal min-w-[200px]",
                              !dateOfBirth && "text-muted-foreground",
                              language === 'ar' && "text-right"
                            )}
                            disabled={isUpdatingDob}
                          >
                            <CalendarIcon className={cn("h-4 w-4", language === 'ar' ? "ml-2" : "mr-2")} />
                            {dateOfBirth ? (
                              format(dateOfBirth, language === 'ar' ? "dd/MM/yyyy" : "MMM dd, yyyy")
                            ) : (
                              t("pickDate", language)
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                  
                  <p className="text-xs text-muted-foreground">
                    {t("dobHelpText", language)}
                  </p>
                  <div className="mt-2">
                    <Button 
                      onClick={handleUpdateDateOfBirth}
                      disabled={isUpdatingDob || !dateOfBirth}
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      {isUpdatingDob
                        ? t("updating", language)
                        : t("updateDateOfBirth", language)}
                    </Button>
                  </div>
                </div>

                {/* Email */}
                <form onSubmit={handleUpdateEmail} className="pt-4 border-t border-border">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t("email", language)}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loadingUserData || isUpdatingEmail}
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

                {/* Password */}
                <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-border">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">{t("currentPassword", language)}</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">{t("newPassword", language)}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isUpdatingPassword}
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
                      />
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

            {/* Country + City in one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AccountCountrySection />
              <AccountCitySection />
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

          <TabsContent value="billing" className="space-y-6">
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
                    {/* STATE 1: Trial Active - Show Timer */}
                    {subscriptionData?.profile && !subscriptionData.profile.is_subscribed && subscriptionData.profile.free_access_start_at && (
                      <div className="text-center space-y-3 py-4">
                        <div className="flex items-center justify-center gap-2 text-amber-500">
                          <Clock className="h-5 w-5" />
                          <span className="font-medium">
                            {language === 'en' ? 'Free Trial Active' : 'الفترة التجريبية المجانية نشطة'}
                          </span>
                        </div>
                        <TrialCountdown startAt={subscriptionData.profile.free_access_start_at} language={language} />
                      </div>
                    )}
                    
                    {/* STATE 2: Subscribed - Show Status + Manage Button */}
                    {subscriptionData?.profile?.is_subscribed && (
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
                      </div>
                    )}
                    
                    {/* STATE 3: No Subscription, No Trial */}
                    {subscriptionData?.profile && !subscriptionData.profile.is_subscribed && !subscriptionData.profile.free_access_start_at && (
                      <p className="text-muted-foreground text-center py-8">
                        {language === 'en' ? 'No active subscription' : 'لا يوجد اشتراك نشط'}
                      </p>
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
      </div>
      
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
    </PageContainer>
  );
}
