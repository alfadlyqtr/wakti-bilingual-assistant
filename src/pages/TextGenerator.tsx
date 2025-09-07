import React from 'react';
import { useNavigate } from 'react-router-dom';
import TextGeneratorPopup from '@/components/wakti-ai-v2/TextGeneratorPopup';

export default function TextGenerator() {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full">
      <TextGeneratorPopup
        isOpen={true}
        onClose={() => navigate(-1)}
        onTextGenerated={() => { /* no-op in standalone page; user can copy */ }}
      />
    </div>
  );
}
