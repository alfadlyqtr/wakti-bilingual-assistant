
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/utils/translations";

export default function Account() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, language } = useTheme();
  const { user, logout } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  if (!user) {
    return (
      <PageContainer title="Account">
        <div className="flex items-center justify-center h-[70vh]">
          <p>Please log in to access your account settings.</p>
        </div>
      </PageContainer>
    );
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation password must match.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      console.log(`[${new Date().toISOString()}] Account: Updating password`);
      
      // First verify the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      });
      
      if (signInError) {
        console.error(`[${new Date().toISOString()}] Account: Current password verification failed:`, signInError);
        toast({
          title: "Password Update Failed",
          description: "Current password is incorrect.",
          variant: "destructive",
        });
        return;
      }
      
      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] Account: Password update failed:`, error);
        toast({
          title: "Password Update Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`[${new Date().toISOString()}] Account: Password updated successfully`);
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully.",
        variant: "default",
      });
      
      // Clear the password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Account: Unexpected error updating password:`, error);
      toast({
        title: "Password Update Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    
    try {
      console.log(`[${new Date().toISOString()}] Account: Deleting account for user:`, user.id);
      
      // Call Supabase Edge Function to delete user
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: user.id }
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] Account: Account deletion failed:`, error);
        toast({
          title: "Account Deletion Failed",
          description: "Failed to delete your account. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`[${new Date().toISOString()}] Account: Account deleted successfully`);
      
      // Log the user out
      await logout();
      
      // Navigate to home page
      navigate("/home", { replace: true });
      
      // Show success toast
      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted.",
        variant: "default",
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Account: Unexpected error deleting account:`, error);
      toast({
        title: "Account Deletion Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <PageContainer title="Account">
      <div className="w-full max-w-md mx-auto mt-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("account_settings", language)}</CardTitle>
            <CardDescription>
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="mt-1 text-sm">{user.email}</div>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-3 pt-3 border-t">
              <h3 className="text-lg font-medium">Change Password</h3>
              
              <div>
                <Label htmlFor="currentPassword">{t("current_password", language)}</Label>
                <Input 
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="newPassword">{t("new_password", language)}</Label>
                <Input 
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">{t("confirm_password", language)}</Label>
                <Input 
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              
              <Button 
                type="submit"
                className="w-full mt-2"
                disabled={isUpdatingPassword}
              >
                {isUpdatingPassword ? "Updating..." : t("update_password", language)}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex-col">
            <div className="w-full pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Deleting..." : t("delete_account", language)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and all data associated with it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount}>
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
}
