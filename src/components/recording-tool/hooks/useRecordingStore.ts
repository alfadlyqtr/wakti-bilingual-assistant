
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

export type RecordingType = "Meeting" | "Note" | "Idea" | "Summary";
export type RecordingStatus = "idle" | "recording" | "paused" | "stopped" | "uploading" | "transcribing" | "summarizing" | "complete" | "error";

interface RecordingState {
  recordingId: string;
  title: string;
  type: RecordingType;
  status: RecordingStatus;
  audioBlob: Blob | null;
  audioUrl: string | null;
  transcription: string | null;
  summary: string | null;
  summaryAudioUrl: string | null;
  recordingDuration: number;
  recordingStartTime: Date | null;
  error: string | null;
  
  // Actions
  setTitle: (title: string) => void;
  setType: (type: RecordingType) => void;
  setStatus: (status: RecordingStatus) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioUrl: (url: string | null) => void;
  setTranscription: (text: string | null) => void;
  setSummary: (text: string | null) => void;
  setSummaryAudioUrl: (url: string | null) => void;
  setRecordingDuration: (duration: number) => void;
  setRecordingStartTime: (time: Date | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  recordingId: uuidv4(),
  title: "Untitled",
  type: "Meeting" as RecordingType,
  status: "idle" as RecordingStatus,
  audioBlob: null,
  audioUrl: null,
  transcription: null,
  summary: null,
  summaryAudioUrl: null,
  recordingDuration: 0,
  recordingStartTime: null,
  error: null,
};

export const useRecordingStore = create<RecordingState>()(
  devtools(
    (set) => ({
      ...initialState,
      setTitle: (title) => set({ title }),
      setType: (type) => set({ type }),
      setStatus: (status) => set({ status }),
      setAudioBlob: (audioBlob) => set({ audioBlob }),
      setAudioUrl: (audioUrl) => set({ audioUrl }),
      setTranscription: (transcription) => set({ transcription }),
      setSummary: (summary) => set({ summary }),
      setSummaryAudioUrl: (summaryAudioUrl) => set({ summaryAudioUrl }),
      setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
      setRecordingStartTime: (recordingStartTime) => set({ recordingStartTime }),
      setError: (error) => set({ error }),
      reset: () => set({ 
        ...initialState,
        recordingId: uuidv4() 
      })
    }),
    { name: 'recording-store' }
  )
);
