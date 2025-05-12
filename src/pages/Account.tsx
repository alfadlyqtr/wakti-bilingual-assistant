import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Settings, 
  Key, 
  Shield, 
  Bell, 
  LayoutDashboard, 
  CreditCard,
  Trash2,
  ArrowLeft,
  Upload,
  Moon,
  Sun, 
  CalendarCheck,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TranslationKey } from "@/utils/translationTypes";
import { Checkbox } from "@/components/ui/checkbox";

export default function Account() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const navigate = useNavigate();
  
  // User profile state
  const [name, setName] = useState("John Doe");
  const [username] = useState("johndoe123");
  const [email] = useState("john.doe@example.com");
  const [profilePicture, setProfilePicture] = useState("");
  
  // Dialog states
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Notification preferences
  const [pushNotifications, setPushNotifications] = useState({
    taskDue: true,
    reminder: true,
    newMessage: true,
    trialReminder: true,
    systemNotifications: true,
    newEvent: true,
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  // Dashboard widget visibility
  const [widgetVisibility, setWidgetVisibility] = useState({
    tasks: true,
    calendar: true,
    reminders: true,
    dailyQuote: true,
  });
  const [quoteCategory, setQuoteCategory] = useState("mixed");
  
  // Privacy controls
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: true,
    activityStatus: true,
    autoApproveRequests: false,
  });

  // Subscription details - would be fetched from an API in a real app
  const [subscriptionStatus] = useState({
    plan: "trial", // "trial", "monthly", "yearly", "free"
    daysLeft: 3,
  });
  
  // Mock function for changing password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation would go here
    setPasswordDialogOpen(false);
    // Success notification would be shown here
  };
  
  // Mock function for profile picture upload
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePicture(event.target.result.toString());
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Get subscription text based on plan
  const getSubscriptionText = () => {
    if (subscriptionStatus.plan === "trial") {
      return t("trialPlan" as TranslationKey, language) + ` (${subscriptionStatus.daysLeft} ${t("daysLeft" as TranslationKey, language)})`;
    } else if (subscriptionStatus.plan === "monthly") {
      return t("monthlyPlan" as TranslationKey, language);
    } else if (subscriptionStatus.plan === "yearly") {
      return t("yearlyPlan" as TranslationKey, language);
    }
    return t("freePlan" as TranslationKey, language);
  };

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("account" as TranslationKey, language)}</h1>
        </div>
        <UserMenu userName="John Doe" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* 1. Personal Information */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <User className="mr-2 h-5 w-5" /> 
              {t("personalInformation" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-primary">
                  <AvatarImage src={profilePicture} alt={name} />
                  <AvatarFallback className="text-lg">{name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0">
                  <Label htmlFor="profilePicture" className="cursor-pointer bg-primary text-primary-foreground rounded-full p-1.5 shadow-md">
                    <Upload className="h-4 w-4" />
                    <span className="sr-only">Upload Picture</span>
                  </Label>
                  <Input 
                    id="profilePicture" 
                    type="file" 
                    accept="image/*"
                    className="hidden" 
                    onChange={handleProfilePictureChange} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t("name" as TranslationKey, language)}</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">{t("username" as TranslationKey, language)}</Label>
              <div className="flex items-center">
                <Input 
                  id="username" 
                  value={username} 
                  disabled 
                  className="flex-1 mr-2"
                />
                <Button size="sm" variant="outline">
                  {t("requestChange" as TranslationKey, language)}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">{t("email" as TranslationKey, language)}</Label>
              <Input 
                id="email" 
                value={email} 
                disabled 
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Account Controls */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <Key className="mr-2 h-5 w-5" />
              {t("accountControls" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => setPasswordDialogOpen(true)}
            >
              {t("changePassword" as TranslationKey, language)}
            </Button>
            
            <Button 
              className="w-full" 
              variant="destructive"
              onClick={() => setDeleteAccountDialogOpen(true)}
            >
              {t("deleteAccount" as TranslationKey, language)}
            </Button>
          </CardContent>
        </Card>
        
        {/* 3. Appearance */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              {t("appearance" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Language Toggle */}
            <div className="flex justify-between items-center">
              <span>{t("language" as TranslationKey, language)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="h-9 px-3 rounded-full text-sm"
              >
                {language === "en" ? "العربية" : "English"}
              </Button>
            </div>
            
            {/* Theme Toggle */}
            <div className="flex justify-between items-center">
              <span>{t("theme" as TranslationKey, language)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="h-9 px-3 rounded-full text-sm flex items-center"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4 mr-1" />
                    {t("lightMode" as TranslationKey, language)}
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 mr-1" />
                    {t("darkMode" as TranslationKey, language)}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 4. Notification Preferences */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              {t("notificationPreferences" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">{t("pushNotifications" as TranslationKey, language)}</h3>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("taskDue" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.taskDue} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, taskDue: checked})}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("reminder" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.reminder} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, reminder: checked})}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("newMessage" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.newMessage} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, newMessage: checked})}
                />
              </div>
              
              {/* New Event Notifications */}
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("newEvent" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.newEvent} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, newEvent: checked})}
                />
              </div>
              
              {/* System Notifications */}
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("systemNotifications" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.systemNotifications} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, systemNotifications: checked})}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{t("trialReminder" as TranslationKey, language)}</span>
                <Switch 
                  checked={pushNotifications.trialReminder} 
                  onCheckedChange={(checked) => setPushNotifications({...pushNotifications, trialReminder: checked})}
                />
              </div>
            </div>
            
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span>{t("emailNotifications" as TranslationKey, language)}</span>
                <Switch 
                  checked={emailNotifications} 
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Dashboard Widget Visibility */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <LayoutDashboard className="mr-2 h-5 w-5" />
              {t("widgetVisibility" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>{t("tasksWidget" as TranslationKey, language)}</span>
              <Switch 
                checked={widgetVisibility.tasks} 
                onCheckedChange={(checked) => setWidgetVisibility({...widgetVisibility, tasks: checked})}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span>{t("calendarWidget" as TranslationKey, language)}</span>
              <Switch 
                checked={widgetVisibility.calendar} 
                onCheckedChange={(checked) => setWidgetVisibility({...widgetVisibility, calendar: checked})}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span>{t("remindersWidget" as TranslationKey, language)}</span>
              <Switch 
                checked={widgetVisibility.reminders} 
                onCheckedChange={(checked) => setWidgetVisibility({...widgetVisibility, reminders: checked})}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span>{t("dailyQuoteWidget" as TranslationKey, language)}</span>
              <Switch 
                checked={widgetVisibility.dailyQuote} 
                onCheckedChange={(checked) => setWidgetVisibility({...widgetVisibility, dailyQuote: checked})}
              />
            </div>
            
            {widgetVisibility.dailyQuote && (
              <div className="mt-2 space-y-2">
                <Label className="text-sm">{t("quoteCategory" as TranslationKey, language)}</Label>
                <RadioGroup 
                  value={quoteCategory} 
                  onValueChange={setQuoteCategory}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inspirational" id="inspirational" />
                    <Label htmlFor="inspirational">{t("inspirational" as TranslationKey, language)}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="motivational" id="motivational" />
                    <Label htmlFor="motivational">{t("motivational" as TranslationKey, language)}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="islamic" id="islamic" />
                    <Label htmlFor="islamic">{t("islamic" as TranslationKey, language)}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sports" id="sports" />
                    <Label htmlFor="sports">{t("sports" as TranslationKey, language)}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="general" />
                    <Label htmlFor="general">{t("generalInfo" as TranslationKey, language)}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mixed" id="mixed" />
                    <Label htmlFor="mixed">{t("mixed" as TranslationKey, language)}</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Privacy Controls */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              {t("privacyControls" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>{t("profileVisibility" as TranslationKey, language)}</span>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">
                  {privacySettings.profileVisibility 
                    ? t("searchable" as TranslationKey, language) 
                    : t("hidden" as TranslationKey, language)}
                </span>
                <Switch 
                  checked={privacySettings.profileVisibility} 
                  onCheckedChange={(checked) => setPrivacySettings({...privacySettings, profileVisibility: checked})}
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>{t("activityStatus" as TranslationKey, language)}</span>
              <Switch 
                checked={privacySettings.activityStatus} 
                onCheckedChange={(checked) => setPrivacySettings({...privacySettings, activityStatus: checked})}
              />
            </div>
            
            {/* New Contact Request Auto-Approve Setting */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h3 className="text-sm font-medium flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                {t("contactRequestSettings" as TranslationKey, language)}
              </h3>
              <div className="flex justify-between items-center">
                <span>{t("autoApproveRequests" as TranslationKey, language)}</span>
                <Switch 
                  checked={privacySettings.autoApproveRequests} 
                  onCheckedChange={(checked) => setPrivacySettings({...privacySettings, autoApproveRequests: checked})}
                />
              </div>
            </div>
            
            <Button variant="outline" className="w-full">
              {t("manageBlockedUsers" as TranslationKey, language)}
            </Button>
            
            <Button variant="outline" className="w-full">
              {t("reportAbuse" as TranslationKey, language)}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setFeedbackDialogOpen(true)}
            >
              {t("submitFeedback" as TranslationKey, language)}
            </Button>
          </CardContent>
        </Card>

        {/* 7. Subscription & Billing */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h2 className="text-lg font-medium flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              {t("subscriptionBilling" as TranslationKey, language)}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="font-medium mb-1">{t("currentPlan" as TranslationKey, language)}</div>
              <div className="text-lg font-bold">
                {getSubscriptionText()}
              </div>
              {subscriptionStatus.plan === "trial" && (
                <div className="text-sm mt-1 text-muted-foreground">
                  {t("trialEndsIn" as TranslationKey, language)} {subscriptionStatus.daysLeft} {t("days" as TranslationKey, language)}
                </div>
              )}
            </div>
            
            <div className="text-sm text-center text-muted-foreground">
              {t("billingManagedThrough" as TranslationKey, language)}
            </div>
            
            <Button variant="outline" className="w-full">
              {t("manageBilling" as TranslationKey, language)}
            </Button>
            
            {(subscriptionStatus.plan === "monthly" || subscriptionStatus.plan === "yearly") && (
              <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10">
                {t("cancelPlan" as TranslationKey, language)}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changePassword" as TranslationKey, language)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword" as TranslationKey, language)}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword" as TranslationKey, language)}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword" as TranslationKey, language)}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("cancel" as TranslationKey, language)}
                </Button>
              </DialogClose>
              <Button type="submit">
                {t("changePassword" as TranslationKey, language)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAccount" as TranslationKey, language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAccountWarning" as TranslationKey, language)}
              <p className="mt-2 font-semibold text-destructive">
                {t("thisActionIrreversible" as TranslationKey, language)}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("cancel" as TranslationKey, language)}
            </AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("deleteAccount" as TranslationKey, language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("submitFeedback" as TranslationKey, language)}</DialogTitle>
            <DialogDescription>
              {t("feedbackDescription" as TranslationKey, language)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="feedback">{t("feedback" as TranslationKey, language)}</Label>
            <textarea
              id="feedback"
              rows={4}
              className="w-full p-2 border rounded-md bg-background resize-none"
              placeholder={t("feedbackPlaceholder" as TranslationKey, language) as string}
            ></textarea>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("cancel" as TranslationKey, language)}
                </Button>
              </DialogClose>
              <Button type="button">
                {t("submit" as TranslationKey, language)}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
}
