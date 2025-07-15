
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon } from "lucide-react";

export default function Search() {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    console.log("Searching for:", searchQuery);
  };

  return (
    <div className="flex flex-col p-4 pb-24">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t("search", language)}</h1>
          <p className="text-muted-foreground">{t("searchDescription", language)}</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder", language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" className="w-full">
            {t("search", language)}
          </Button>
        </form>

        <div className="text-center text-muted-foreground">
          <p>{t("searchHelpText", language)}</p>
        </div>
      </div>
    </div>
  );
}
