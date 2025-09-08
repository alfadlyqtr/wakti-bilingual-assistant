import React from 'react';
import VoiceTTS from '@/pages/VoiceTTS';

interface VoiceTTSScreenProps {
  onBack: () => void;
}

export const VoiceTTSScreen: React.FC<VoiceTTSScreenProps> = () => {
  return (
    <div className="space-y-3">
      {/* Render the TTS page content directly without a back header */}
      <div className="mt-1">
        <VoiceTTS />
      </div>
    </div>
  );
};
