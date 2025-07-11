
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Calendar, Shield, AlertTriangle, Mic, MessageSquare, CheckSquare, Zap, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserStatistics } from "@/hooks/useUserStatistics";

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
  is_subscribed?: boolean;
  plan_name?: string;
}

interface UserProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => Promise<void>;
}

export const UserProfileModal = ({ user, isOpen, onClose, onUserUpdated }: UserProfileModalProps) => {
  const { statistics, isLoading: statsLoading } = useUserStatistics(user?.id || null);

  if (!user) return null;

  const totalEvents = statistics.eventsCreated + statistics.maw3dEventsCreated;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>User Profile Details</span>
            {statistics.isCurrentlyOnline && (
              <Badge className="bg-green-500 text-xs ml-2">
                <Activity className="h-3 w-3 mr-1" />
                Online Now
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || user.email}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg sm:text-xl">
                      {(user.full_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold">{user.full_name || "No name"}</h3>
                  <p className="text-muted-foreground flex items-center text-sm sm:text-base">
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {user.email}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Account Status</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant={statistics.isCurrentlyOnline ? "default" : "secondary"} className="text-xs">
                      {statistics.isCurrentlyOnline ? "Online" : "Offline"}
                    </Badge>
                    <Badge variant={user.email_confirmed ? "default" : "destructive"} className="text-xs">
                      {user.email_confirmed ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Subscription</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge 
                      variant={user.is_subscribed ? "default" : "outline"}
                      className={`${user.is_subscribed ? 'bg-accent-green' : ''} text-xs`}
                    >
                      {user.is_subscribed ? "Subscribed" : "Free"}
                    </Badge>
                    {user.plan_name && (
                      <Badge variant="secondary" className="text-xs">
                        {user.plan_name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Member Since
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString()} 
                    ({formatDistanceToNow(new Date(user.created_at), { addSuffix: true })})
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Last Active
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {statistics.lastLoginAt 
                      ? formatDistanceToNow(new Date(statistics.lastLoginAt), { addSuffix: true })
                      : 'No recent activity'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suspension Status */}
          {user.is_suspended && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-red-700 flex items-center">
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

          {/* Real-Time Activity Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Activity Statistics
                {!statsLoading && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Live Data
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="text-center py-4 text-sm">Loading real-time statistics...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
                  <div className="bg-accent-blue/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-blue">{statistics.tasksCreated}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">TR Tasks</p>
                  </div>
                  <div className="bg-accent-green/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-green">{totalEvents}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Events Created</p>
                    <p className="text-xs text-muted-foreground mt-1">({statistics.eventsCreated} + {statistics.maw3dEventsCreated})</p>
                  </div>
                  <div className="bg-accent-purple/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-purple">{statistics.aiQueries}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">AI Queries (This Month)</p>
                  </div>
                  <div className="bg-accent-orange/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-orange">{statistics.tasjeelRecords}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Voice Recordings</p>
                  </div>
                  <div className="bg-accent-cyan/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-cyan">{statistics.searchQuota.monthlyCount}/10</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Searches This Month</p>
                  </div>
                  <div className="bg-accent-pink/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-accent-pink">{statistics.searchQuota.extraSearches}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Extra Searches</p>
                  </div>
                  <div className="bg-gradient-primary/10 p-3 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-primary">{statistics.voiceClonesCount}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Voice Clones</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voice Usage Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center">
                <Mic className="h-5 w-5 mr-2" />
                Voice Usage Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="text-center py-4 text-sm">Loading voice usage...</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Characters Used</span>
                    <span className="text-sm">
                      {statistics.voiceUsage.charactersUsed.toLocaleString()} / {statistics.voiceUsage.charactersLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-accent-blue h-3 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${Math.min((statistics.voiceUsage.charactersUsed / statistics.voiceUsage.charactersLimit) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-lg font-bold text-accent-green">
                        {(statistics.voiceUsage.charactersLimit - statistics.voiceUsage.charactersUsed + statistics.voiceUsage.extraCharacters).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-lg font-bold text-accent-purple">
                        {statistics.voiceUsage.extraCharacters.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Extra Credits</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
