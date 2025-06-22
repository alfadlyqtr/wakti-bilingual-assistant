
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, UserX, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name: string;
  is_suspended?: boolean;
}

interface SuspendModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DeleteModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SuspendUserModal = ({ user, isOpen, onClose, onSuccess }: SuspendModalProps) => {
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSuspend = async () => {
    if (!user) return;

    setIsProcessing(true);
    try {
      // Get admin session
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error("Admin session not found");
        return;
      }

      const session = JSON.parse(adminSession);
      
      const { error } = await supabase.rpc('suspend_user', {
        p_user_id: user.id,
        p_admin_id: session.admin_id,
        p_reason: reason.trim() || 'Account suspended by admin'
      });

      if (error) {
        console.error('Error suspending user:', error);
        toast.error("Failed to suspend user");
        return;
      }

      toast.success(`User ${user.full_name || user.email} has been suspended`);
      setReason("");
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error suspending user:', error);
      toast.error("Failed to suspend user");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('unsuspend_user', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error unsuspending user:', error);
        toast.error("Failed to unsuspend user");
        return;
      }

      toast.success(`User ${user.full_name || user.email} has been unsuspended`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      toast.error("Failed to unsuspend user");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserX className="h-5 w-5" />
            <span>{user.is_suspended ? "Unsuspend User" : "Suspend User"}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  {user.is_suspended ? "Unsuspend" : "Suspend"} {user.full_name || user.email}?
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {user.is_suspended 
                    ? "This will restore the user's access to their account."
                    : "This will prevent the user from accessing their account."
                  }
                </p>
              </div>
            </div>
          </div>

          {!user.is_suspended && (
            <div>
              <Label htmlFor="reason">Suspension Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Provide a reason for suspension..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant={user.is_suspended ? "default" : "destructive"}
              onClick={user.is_suspended ? handleUnsuspend : handleSuspend}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : (user.is_suspended ? "Unsuspend User" : "Suspend User")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteUserModal = ({ user, isOpen, onClose, onSuccess }: DeleteModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // Get admin session
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error("Admin session not found");
        return;
      }

      const session = JSON.parse(adminSession);
      
      // First mark as deleted in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_by: session.admin_id,
          suspension_reason: 'Account deleted by admin',
          display_name: '[DELETED USER]',
          email: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        toast.error("Failed to delete user");
        return;
      }

      // Also try to delete from auth.users if possible (this might fail due to RLS)
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
        if (authError) {
          console.log('Auth deletion failed (expected):', authError);
        }
      } catch (authErr) {
        console.log('Auth deletion not available:', authErr);
      }

      toast.success(`User ${user.full_name || user.email} has been deleted`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error("Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5" />
            <span>Delete User Account</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">
                  Permanently delete {user.full_name || user.email}?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This action will remove the user from the admin interface and anonymize their profile. They will no longer be able to access their account.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
