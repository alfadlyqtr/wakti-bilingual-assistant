
import { Route, Routes } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Events from "./pages/Events";
import Ai from "./pages/Ai";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Contacts from "./pages/Contacts";
import VoiceSummaryPage from "./components/voice-summary/VoiceSummaryPage";
import RecordingToolPage from "./components/recording-tool/RecordingToolPage"; 
import RecordingDetailPage from "./components/recording-tool/RecordingDetailPage";
import ImageGenerationPage from "./pages/ImageGenerationPage";
import VoiceSummaryDetail from "./components/voice-summary/VoiceSummaryDetail";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/events" element={<Events />} />
        <Route path="/ai" element={<Ai />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/voice-summary" element={<RecordingToolPage />} />  {/* Updated to use the new RecordingToolPage */}
        <Route path="/voice-summary/:id" element={<RecordingDetailPage />} />  {/* Updated to use the new RecordingDetailPage */}
        <Route path="/image-generation" element={<ImageGenerationPage />} />
      </Route>
    </Routes>
  );
}
