import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameModeModal } from '@/components/wakti-ai-v2/GameModeModal';

export default function GameMode() {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full">
      <GameModeModal open={true} onOpenChange={(open) => { if (!open) navigate(-1); }} />
    </div>
  );
}
