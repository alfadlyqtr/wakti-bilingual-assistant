import React from 'react';
import VoiceTTS from '@/pages/VoiceTTS';
import type { WaktiOperatorRoutePayload } from '@/utils/waktiOperator';

interface VoiceTTSScreenProps {
  onBack: () => void;
  operatorPayload?: WaktiOperatorRoutePayload | null;
  onOperatorConsumed?: () => void;
}

export const VoiceTTSScreen: React.FC<VoiceTTSScreenProps> = ({ operatorPayload, onOperatorConsumed }) => {
  return (
    <div className="space-y-3">
      {/* Render the TTS page content directly without a back header */}
      <div className="mt-1">
        <VoiceTTS operatorPayload={operatorPayload} onOperatorConsumed={onOperatorConsumed} />
      </div>
    </div>
  );
};
