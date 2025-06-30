
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  fixAllStuckNotifications, 
  triggerNotificationProcessing, 
  getNotificationQueueStatus, 
  sendTestNotification 
} from "@/utils/notificationUtils";
import { Bell, RefreshCw, Send, Wrench } from "lucide-react";

export function NotificationTestPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [testUserId, setTestUserId] = useState("");
  const [queueStatus, setQueueStatus] = useState<any>(null);

  const handleFixStuckNotifications = async () => {
    setIsLoading(true);
    try {
      const result = await fixAllStuckNotifications();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to fix stuck notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerProcessing = async () => {
    setIsLoading(true);
    try {
      const result = await triggerNotificationProcessing();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to trigger processing");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckQueueStatus = async () => {
    setIsLoading(true);
    try {
      const result = await getNotificationQueueStatus();
      if (result.success) {
        setQueueStatus(result.data);
        toast.success("Queue status updated");
      } else {
        toast.error(result.error || "Failed to check queue status");
      }
    } catch (error) {
      toast.error("Failed to check queue status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!testUserId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }

    setIsLoading(true);
    try {
      const result = await sendTestNotification(testUserId.trim());
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to send test notification");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification System Testing
        </CardTitle>
        <CardDescription>
          Test and manage the notification system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queue Management */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={handleTriggerProcessing}
            disabled={isLoading}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Process Queue
          </Button>
          
          <Button
            onClick={handleFixStuckNotifications}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Wrench className="h-4 w-4 mr-2" />
            Fix Stuck Notifications
          </Button>
          
          <Button
            onClick={handleCheckQueueStatus}
            disabled={isLoading}
            variant="secondary"
            className="w-full"
          >
            <Bell className="h-4 w-4 mr-2" />
            Check Queue Status
          </Button>
        </div>

        {/* Queue Status Display */}
        {queueStatus && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Queue Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Total in Queue:</span>
                <br />
                {queueStatus.queue?.total || 0}
              </div>
              <div>
                <span className="font-medium">Pending:</span>
                <br />
                {queueStatus.queue?.pending || 0}
              </div>
              <div>
                <span className="font-medium">Failed:</span>
                <br />
                {queueStatus.queue?.failed || 0}
              </div>
              <div>
                <span className="font-medium">History Count:</span>
                <br />
                {queueStatus.history?.total || 0}
              </div>
            </div>
          </div>
        )}

        {/* Test Notification */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Send Test Notification</h4>
          <div className="flex gap-2">
            <Input
              placeholder="Enter User ID"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSendTestNotification}
              disabled={isLoading || !testUserId.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
