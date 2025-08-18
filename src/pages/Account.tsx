import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { AlertTriangle, Check, MessageSquare, Flag, CalendarIcon, User, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { language } = useTheme();
  const queryClient = useQueryClient();
  
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
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  
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
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_status, plan_name, next_billing_date, billing_start_date, payment_method')
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
      // Set username from metadata or user id
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
      setLoadingUserData(false);
    }
  }, [user]);
  
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
  
  const openDeleteConfirmDialog = () => {
    if (isEmailMatch()) {
      setDeleteConfirmDialogOpen(true);
    } else {
      toast.error(t("error", language), {
        description: "Email does not match your account email."
      });
    }
  };
  
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
        toast.success("Account deleted successfully");
        // Signout will be automatic since the account is deleted
        navigate("/login");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(t("error", language), {
        description: "An unexpected error occurred"
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmDialogOpen(false);
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
          name: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Anonymous',
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

  // Billing section component
  const BillingSection = ({ language }: { language: string }) => {
    if (isLoadingSubscription) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t("loading", language)}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const profile = subscriptionData?.profile;
    const subscriptions = subscriptionData?.subscriptions || [];

    return (
      <>
        {/* Current Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptionInfo", language)}</CardTitle>
            <CardDescription>
              {language === 'ar' ? 'معلومات الاشتراك الحالي' : 'Current subscription information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.is_subscribed ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {language === 'ar' ? 'اشتراك نشط' : 'Active Subscription'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{language === 'ar' ? 'الخطة' : 'Plan'}</p>
                    <p className="font-medium">{profile.plan_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                    <p className="font-medium capitalize">{profile.subscription_status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === 'ar' ? 'بدء الاشتراك' : 'Started'}</p>
                    <p className="font-medium">
                      {profile.billing_start_date 
                        ? new Date(profile.billing_start_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === 'ar' ? 'التجديد التالي' : 'Next Billing'}</p>
                    <p className="font-medium">
                      {profile.next_billing_date 
                        ? new Date(profile.next_billing_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</p>
                    <p className="font-medium capitalize">{profile.payment_method || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    {language === 'ar' ? 'لا يوجد اشتراك نشط' : 'No active subscription'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {language === 'ar' ? 'يرجى الاشتراك للوصول لجميع الميزات' : 'Please subscribe to access all features'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentHistory", language)}</CardTitle>
            <CardDescription>
              {language === 'ar' ? 'سجل المدفوعات والاشتراكات' : 'Payment and subscription history'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length > 0 ? (
              <div className="space-y-3">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{subscription.plan_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'بدأ في' : 'Started'}: {new Date(subscription.start_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{subscription.billing_amount} {subscription.billing_currency}</p>
                      <p className="text-xs text-muted-foreground capitalize">{subscription.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'لا يوجد سجل مدفوعات' : 'No payment history found'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  };
  
  return (
    <PageContainer showHeader={false}>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {t("account", language)}
        </h1>
        
        <Tabs defaultValue="profile" className="space-y-4">
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

            {/* Add Country Section */}
            <AccountCountrySection />
            
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
            <BillingSection language={language} />
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
      
      {/* Delete Account Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("deleteAccount", language)}
            </DialogTitle>
            <DialogDescription>
              {t("deleteAccountDescription", language)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium">
              To confirm deletion, please type your email address:
            </p>
            <Input
              value={confirmationEmail}
              onChange={handleConfirmEmailChange}
              placeholder={user?.email || "Your email address"}
              className="w-full"
            />
            
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. All your data, including profile information, tasks, events, and messages will be permanently deleted.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              {t("cancel", language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={openDeleteConfirmDialog}
              disabled={!isEmailMatch() || isDeleting}
            >
              {t("deleteMyAccount", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Final Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete your account? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmDialogOpen(false)}
              disabled={isDeleting}
            >
              {t("cancel", language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
