
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioWaveform, Calendar, MapPin, Users } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";

interface RecordingMeta {
  id: string;
  title: string;
  type: "Meeting" | "Lecture" | "Brainstorm" | "Other";
  host?: string;
  attendees?: string;
  location?: string;
  created_at: string;
  expires_at: string;
  audio_url: string;
  transcript?: string;
  summary?: string;
  summary_audio_url?: string;
  summary_voice?: "male" | "female";
  summary_language?: "english" | "arabic";
  highlighted_timestamps?: { time: number; note: string }[];
}

export default function VoiceSummaryArchive() {
  const navigate = useNavigate();
  const { language } = useTheme();
  
  const { data: recordings = [], isLoading, refetch } = useQuery({
    queryKey: ["voice-recordings"],
    queryFn: async () => {
      try {
        // Using 'from' with type casting to handle the database schema mismatch
        const { data, error } = await supabase
          .from("voice_recordings" as any)
          .select("*")
          .order("created_at", { ascending: false });
          
        if (error) throw error;
        console.log("Fetched recordings:", data);
        return data as unknown as RecordingMeta[];
      } catch (error) {
        console.error("Error fetching recordings:", error);
        return [];
      }
    },
  });

  const handleViewDetails = (recordingId: string) => {
    console.log("Navigating to recording details:", recordingId);
    navigate(`/voice/${recordingId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i} className="w-full">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12">
        <AudioWaveform className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">
          {language === 'ar' ? 'لم يتم العثور على تسجيلات' : 'No recordings found'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {language === 'ar' ? 'قم بإنشاء أول تسجيل لعرضه هنا' : 'Create your first recording to see it here'}
        </p>
      </div>
    );
  }

  const calculateExpiryTime = (expiryDate: string) => {
    const now = new Date();
    const expiry = parseISO(expiryDate);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return language === 'ar' ? `${daysLeft} أيام متبقية` : `${daysLeft} days remaining`;
  };

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <Card key={recording.id} className="w-full">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">{recording.title}</CardTitle>
              <div className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                {recording.type}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {recording.created_at && (
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formatDistanceToNow(parseISO(recording.created_at), { addSuffix: true })}</span>
                </div>
              )}
              {recording.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  <span>{recording.location}</span>
                </div>
              )}
              {recording.attendees && (
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{recording.attendees}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-destructive">
                {calculateExpiryTime(recording.expires_at)}
              </div>
              <div className="flex gap-2 text-xs">
                <button 
                  className="px-3 py-1 bg-primary text-primary-foreground rounded-md"
                  onClick={() => handleViewDetails(recording.id)}
                >
                  {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
