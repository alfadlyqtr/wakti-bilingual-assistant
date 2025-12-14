
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, UserX, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, addMonths, format } from "date-fns";

interface User {
  id: string;
  email?: string;
  full_name?: string;
  is_suspended?: boolean;
}

interface UserActionModalsProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  actionType: 'suspend' | 'delete' | null;
  onActionCompleted: () => void;
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
  const [durationType, setDurationType] = useState<string>("indefinite");
  const [customDate, setCustomDate] = useState<string>("");

  const getSuspendUntilDate = (): string | null => {
    const now = new Date();
    switch (durationType) {
      case "1day":
        return addDays(now, 1).toISOString();
      case "7days":
        return addDays(now, 7).toISOString();
      case "30days":
        return addDays(now, 30).toISOString();
      case "3months":
        return addMonths(now, 3).toISOString();
      case "custom":
        return customDate ? new Date(customDate).toISOString() : null;
      default:
        return null; // indefinite
    }
  };

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
      const suspendUntil = getSuspendUntilDate();
      
      const { error } = await (supabase as any).rpc('suspend_user', {
        p_user_id: user.id,
        p_admin_id: session.admin_id,
        p_reason: reason.trim() || 'Account suspended by admin',
        p_until: suspendUntil
      });

      if (error) {
        console.error('Error suspending user:', error);
        toast.error("Failed to suspend user");
        return;
      }

      const durationText = durationType === 'indefinite' 
        ? 'indefinitely' 
        : durationType === 'custom' && customDate
          ? `until ${format(new Date(customDate), 'PPP')}`
          : `for ${durationType.replace('days', ' days').replace('months', ' months').replace('day', ' day')}`;
      
      toast.success(`User ${user.full_name || user.email} has been suspended ${durationText}`);
      setReason("");
      setDurationType("indefinite");
      setCustomDate("");
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="duration" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Suspension Duration
                </Label>
                <Select value={durationType} onValueChange={setDurationType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indefinite">Indefinite (until manually unsuspended)</SelectItem>
                    <SelectItem value="1day">1 Day</SelectItem>
                    <SelectItem value="7days">7 Days</SelectItem>
                    <SelectItem value="30days">30 Days</SelectItem>
                    <SelectItem value="3months">3 Months</SelectItem>
                    <SelectItem value="custom">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {durationType === "custom" && (
                <div>
                  <Label htmlFor="customDate">Suspend Until</Label>
                  <Input
                    id="customDate"
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    className="mt-1"
                  />
                </div>
              )}

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
      
      // Use the soft delete function to properly mark user as deleted
      const { error } = await supabase.rpc('soft_delete_user', {
        p_user_id: user.id,
        p_admin_id: session.admin_id
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast.error("Failed to delete user");
        return;
      }

      toast.success(`User ${user.full_name || user.email} has been deleted and will no longer appear in the admin interface`);
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
                  This action will remove the user from the admin interface and anonymize their profile. They will no longer be able to access their account and will not appear in any admin lists.
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

// Main component that combines both modals
export const UserActionModals = ({ isOpen, onClose, user, actionType, onActionCompleted }: UserActionModalsProps) => {
  if (actionType === 'suspend') {
    return (
      <SuspendUserModal
        isOpen={isOpen}
        onClose={onClose}
        user={user}
        onSuccess={onActionCompleted}
      />
    );
  }

  if (actionType === 'delete') {
    return (
      <DeleteUserModal
        isOpen={isOpen}
        onClose={onClose}
        user={user}
        onSuccess={onActionCompleted}
      />
    );
  }

  return null;
};
