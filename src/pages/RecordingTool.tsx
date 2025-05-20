
import React from "react";
import { PageContainer } from "@/components/PageContainer";
import { RecordingTool as RecordingToolComponent } from "@/components/recording-tool/RecordingTool";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

const RecordingTool = () => {
  const { language } = useTheme();
  
  return (
    <PageContainer title={t("recording_tool", language)} showBackButton>
      <RecordingToolComponent />
    </PageContainer>
  );
};

export default RecordingTool;
