
import { useState } from "react";
import { UserMenu } from "@/components/UserMenu";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import RecordingDialog from "./RecordingDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function VoiceSummaryPage() {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const { language } = useTheme();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate("/dashboard");
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="flex items-center">
          {/* Logo that acts as dashboard link - fixed aspect ratio */}
          <div className="h-10 w-10 mr-3 flex items-center justify-center cursor-pointer">
            <img 
              src="/lovable-uploads/b2ccfe85-51b7-4b00-af3f-9919d8b5be57.png" 
              alt="WAKTI Logo" 
              className="object-contain w-full h-full rounded-md"
              onClick={handleLogoClick}
            />
          </div>
          <h1 className="text-2xl font-bold">{t("voiceSummary", language)}</h1>
        </div>
        <UserMenu />
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Recordings</h2>
          <Button 
            onClick={() => setShowRecordingDialog(true)} 
            className="flex items-center gap-1"
          >
            <Plus size={18} />
            <span>New Recording</span>
          </Button>
        </div>

        {/* Archive of recent recordings */}
        <VoiceSummaryArchive />
        
        {/* Recording Dialog */}
        <RecordingDialog 
          isOpen={showRecordingDialog} 
          onClose={() => setShowRecordingDialog(false)} 
        />
      </div>
    </div>
  );
}
