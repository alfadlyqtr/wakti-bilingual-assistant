
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

// Mock data for demonstration
const initialBlockedUsers = [
  { id: 1, username: "spam_account", name: "Spam", avatar: "" },
  { id: 2, username: "unwanted_user", name: "Unwanted", avatar: "" },
];

export function BlockedUsers() {
  const { toast } = useToast();
  const { language } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState(initialBlockedUsers);

  const handleUnblock = (id: number, name: string) => {
    setBlockedUsers(blockedUsers.filter(user => user.id !== id));
    toast({
      title: t("requestAccepted", language),
      description: `${name} ${t("contactRejectedDescription", language)}`
    });
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3">
      {blockedUsers.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t("noContactRequests", language)}
        </Card>
      ) : (
        blockedUsers.map(user => (
          <Card key={user.id} className="overflow-hidden border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleUnblock(user.id, user.name)}
                  className="flex gap-1"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("contacts", language)}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
