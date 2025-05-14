
import { useState } from "react";
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

  return (
    <div className="flex flex-col h-full w-full">
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
