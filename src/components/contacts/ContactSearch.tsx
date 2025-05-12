
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useToast } from "@/hooks/use-toast";

export function ContactSearch() {
  const { language } = useTheme();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isValid, setIsValid] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Validate if input looks like an email, username or phone number
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isUsername = value.length > 2;
    const isPhone = /^\+?[\d\s()-]{8,}$/.test(value);
    
    setIsValid(isEmail || isUsername || isPhone);
  };

  const handleSendRequest = () => {
    // In a real app, this would send a request to the backend
    toast({
      title: "Request sent!",
      description: `Contact request sent to ${searchQuery}`,
      duration: 3000,
    });
    
    setSearchQuery("");
    setIsValid(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchContacts", language)}
            className="pl-9"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
        <Button 
          onClick={handleSendRequest} 
          disabled={!isValid}
          size="sm"
        >
          {t("sendMessage", language)}
        </Button>
      </div>
    </Card>
  );
}
