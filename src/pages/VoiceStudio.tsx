import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VoiceClonePopup } from '@/components/wakti-ai-v2/VoiceClonePopup';

export default function VoiceStudio() {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full">
      <VoiceClonePopup open={true} onOpenChange={(open) => { if (!open) navigate(-1); }} />
    </div>
  );
}
