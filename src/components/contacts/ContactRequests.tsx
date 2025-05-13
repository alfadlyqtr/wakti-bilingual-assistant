import { useState } from "react";
import { Check, X, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

// Mock data for demonstration
const initialRequests = [
  { id: 1, username: "new_user", name: "New User", avatar: "", time: "2 hours ago" },
  { id: 2, username: "contact_request", name: "Contact Request", avatar: "", time: "1 day ago" },
];

export function ContactRequests() {
  const { toast } = useToast();
  const { language } = useTheme();
  const [requests, setRequests] = useState(initialRequests);

  const handleAccept = (id: number, name: string) => {
    setRequests(requests.filter(req => req.id !== id));
    toast({
      title: t("requestAccepted", language),
      description: t("contactAddedDescription", language, { username: name })
    });
  };

  const handleReject = (id: number, name: string) => {
    setRequests(requests.filter(req => req.id !== id));
    toast({
      title: t("requestRejected", language),
      description: t("contactRejectedDescription", language, { username: name })
    });
  };

  const handleBlock = (id: number, name: string) => {
    setRequests(requests.filter(req => req.id !== id));
    toast({
      title: t("contactBlocked", language),
      description: t("blockedUserDescription", language, { username: name })
    });
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t("noContactRequests", language)}
        </Card>
      ) : (
        requests.map(request => (
          <Card key={request.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={request.avatar} />
                    <AvatarFallback>{getInitials(request.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{request.name}</p>
                    <p className="text-sm text-muted-foreground">@{request.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => handleAccept(request.id, request.name)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => handleReject(request.id, request.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => handleBlock(request.id, request.name)}
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <Badge variant="secondary">
                  {request.time}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
