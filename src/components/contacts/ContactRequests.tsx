
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useToast } from "@/hooks/use-toast";

// Mock data for demonstration
const incomingRequests = [
  { id: 1, username: "ahmed_123", name: "Ahmed", avatar: "" },
  { id: 2, username: "sarah_92", name: "Sarah", avatar: "" },
];

const outgoingRequests = [
  { id: 3, username: "mohamed_45", name: "Mohamed", avatar: "" },
  { id: 4, username: "fatima_22", name: "Fatima", avatar: "" },
];

export function ContactRequests() {
  const { language } = useTheme();
  const { toast } = useToast();
  const [incoming, setIncoming] = useState(incomingRequests);
  const [outgoing, setOutgoing] = useState(outgoingRequests);

  const handleAccept = (id: number) => {
    setIncoming(incoming.filter(req => req.id !== id));
    toast({
      title: "Request accepted",
      description: "Contact has been added to your list",
      duration: 3000,
    });
  };

  const handleReject = (id: number) => {
    setIncoming(incoming.filter(req => req.id !== id));
    toast({
      description: "Request rejected",
      duration: 3000,
    });
  };

  const handleCancel = (id: number) => {
    setOutgoing(outgoing.filter(req => req.id !== id));
    toast({
      description: "Request canceled",
      duration: 3000,
    });
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Tabs defaultValue="incoming" className="w-full">
      <TabsList className="grid grid-cols-2 mb-4">
        <TabsTrigger value="incoming">{t("filters", language)}</TabsTrigger>
        <TabsTrigger value="outgoing">{t("today", language)}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="incoming" className="space-y-3 animate-fade-in">
        {incoming.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No incoming requests
          </Card>
        ) : (
          incoming.map(request => (
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
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleAccept(request.id)}
                      className="rounded-full h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      className="rounded-full h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
      
      <TabsContent value="outgoing" className="space-y-3 animate-fade-in">
        {outgoing.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No outgoing requests
          </Card>
        ) : (
          outgoing.map(request => (
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
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleCancel(request.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
