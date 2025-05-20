
import React from "react";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export const IntakeForm: React.FC = () => {
  const { title, type, setTitle, setType } = useRecordingStore();
  const { language } = useTheme();

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("title", language)}</Label>
            <Input
              id="title"
              placeholder={t("untitled_recording", language)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">{t("recording_type", language)}</Label>
            <Select value={type} onValueChange={(value) => setType(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_recording_type", language)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meeting">{t("meeting", language)}</SelectItem>
                <SelectItem value="Note">{t("note", language)}</SelectItem>
                <SelectItem value="Idea">{t("idea", language)}</SelectItem>
                <SelectItem value="Summary">{t("summary", language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
