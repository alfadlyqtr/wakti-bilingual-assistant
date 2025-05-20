
import { Navigate } from "react-router-dom";

// Redirect to the new RecordingToolPage
export default function VoiceSummaryPage() {
  return <Navigate to="/voice-summary" replace />;
}
