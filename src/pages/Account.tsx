
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserProfile } from "@/services/contactsService";
import { t } from "@/utils/translations";
import { deleteUserAccount, updateUserPassword, updateDisplayName } from "@/utils/auth";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { AlertTriangle, Check } from "lucide-react";

export default function Account() {
  const { user, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { confirm } = useToast();
  const queryClient = useQueryClient();
  
  // Account states
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  
  // Delete account states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  
  // Fetch user profile data
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
  });

  // Load user data and immediately update display name to "abdullah alfadly"
  useEffect(() => {
    const initializeProfile = async () => {
      if (user) {
        if (user.user_metadata?.full_name) {
          setName(user.user_metadata.full_name);
        }
        if (user.email) {
          setEmail(user.email);
        }
        // Set username from metadata or user id
        setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
        
        // Automatically update display name to "abdullah alfadly"
        const currentDisplayName = user.user_metadata?.display_name;
        if (currentDisplayName !== "abdullah alfadly") {
          console.log("Updating display name from", currentDisplayName, "to abdullah alfadly");
          const { error } = await updateDisplayName("abdullah alfadly");
          if (error) {
            console.error("Failed to update display name:", error);
            toast.error("Failed to update display name");
          } else {
            toast.success("Display name updated to abdullah alfadly");
          }
        }
        
        setLoadingUserData(false);
      }
    };
    
    initializeProfile();
  }, [user]);
  
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);
    
    try {
      const error = await updateEmail(email);
      if (error) {
        toast(t("errorUpdatingEmail", language));
      } else {
        toast.success(t("emailUpdated", language));
      }
    } catch (error) {
      toast(t("errorUpdatingEmail", language));
    } finally {
      setIsUpdatingEmail(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast(t("passwordsDoNotMatch", language));
      return;
    }
    
    if (!currentPassword) {
      toast(t("currentPasswordRequired", language));
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
      toast(t("errorUpdatingPassword", language));
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleSignout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast(t("errorSigningOut", language));
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
  
  return (
    <PageContainer showHeader={false}>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {t("account", language)}
        </h1>
        
        <div className="space-y-6">
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
              
              {/* Name - Display updated name */}
              <div className="grid gap-2">
                <Label htmlFor="name">{t("name", language)}</Label>
                <Input
                  id="name"
                  type="text"
                  value="abdullah alfadly"
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-green-600">
                  ✓ Display name updated to "abdullah alfadly"
                </p>
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
        </div>
      </div>
      
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
