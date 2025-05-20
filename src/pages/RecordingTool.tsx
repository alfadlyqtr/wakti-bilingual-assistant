
import React from "react";
import { PageContainer } from "@/components/PageContainer";
import { RecordingTool as RecordingToolComponent } from "@/components/recording-tool/RecordingTool";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

const RecordingTool = () => {
  const { language } = useTheme();
  
  return (
    <PageContainer title="voice_summary" showBackButton>
      <div className="flex flex-col flex-1 w-full h-full">
        <RecordingToolComponent />
      </div>
    </PageContainer>
  );
};

export default RecordingTool;
