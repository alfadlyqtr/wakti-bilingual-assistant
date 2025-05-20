
import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Events from "./pages/Events";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Contacts from "./pages/Contacts";
import VoiceSummaryPage from "./components/voice-summary/VoiceSummaryPage";
import RecordingToolPage from "./components/recording-tool/RecordingToolPage"; 
import RecordingDetailPage from "./components/recording-tool/RecordingDetailPage";
import VoiceSummaryDetail from "./components/voice-summary/VoiceSummaryDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/events" element={<Events />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/contacts" element={<Contacts />} />
      <Route path="/voice-summary" element={<RecordingToolPage />} />
      <Route path="/voice-summary/:id" element={<RecordingDetailPage />} />
    </Routes>
  );
}
