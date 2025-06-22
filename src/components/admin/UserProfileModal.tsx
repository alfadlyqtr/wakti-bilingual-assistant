
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Calendar, Shield, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  is_logged_in: boolean;
  email_confirmed: boolean;
  subscription_status?: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspension_reason?: string;
}

interface UserProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal = ({ user, isOpen, onClose }: UserProfileModalProps) => {
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>User Profile Details</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || user.email}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-xl">
                      {(user.full_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{user.full_name || "No name"}</h3>
                  <p className="text-muted-foreground flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    {user.email}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Account Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={user.is_logged_in ? "default" : "secondary"}>
                      {user.is_logged_in ? "Online" : "Offline"}
                    </Badge>
                    <Badge variant={user.email_confirmed ? "default" : "destructive"}>
                      {user.email_confirmed ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Subscription</p>
                  <Badge 
                    variant={user.subscription_status === 'active' ? "default" : "outline"}
                    className={user.subscription_status === 'active' ? 'bg-accent-green mt-1' : 'mt-1'}
                  >
                    {user.subscription_status === 'active' ? "Subscribed" : "Free"}
                  </Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Member Since
                </p>
                <p className="text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()} 
                  ({formatDistanceToNow(new Date(user.created_at), { addSuffix: true })})
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Suspension Status */}
          {user.is_suspended && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-lg text-red-700 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Account Suspended
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Suspended:</strong> {user.suspended_at ? new Date(user.suspended_at).toLocaleString() : 'Unknown'}
                  </p>
                  {user.suspension_reason && (
                    <p className="text-sm">
                      <strong>Reason:</strong> {user.suspension_reason}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-accent-blue">N/A</p>
                  <p className="text-sm text-muted-foreground">Tasks Created</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent-green">N/A</p>
                  <p className="text-sm text-muted-foreground">Events Created</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent-purple">N/A</p>
                  <p className="text-sm text-muted-foreground">AI Queries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
