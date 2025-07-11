
import React from 'react';
import { ImageTypeOption } from './ImageTypeSelector';

interface QuickReplyPill {
  id: string;
  text: string;
  emoji: string;
}

interface QuickReplyPillsProps {
  imageType: ImageTypeOption | null;
  onPillClick: (text: string) => void;
  isVisible: boolean;
}

export function QuickReplyPills({ imageType, onPillClick, isVisible }: QuickReplyPillsProps) {
  if (!isVisible || !imageType) return null;

  const pillsByType: Record<string, QuickReplyPill[]> = {
    ids: [
      { id: '1', emoji: '🔍', text: 'What info is on this document?' },
      { id: '2', emoji: '📝', text: 'Extract all the text for me' },
      { id: '3', emoji: '🌐', text: 'Read the foreign text' }
    ],
    bills: [
      { id: '1', emoji: '💰', text: 'How much did I spend?' },
      { id: '2', emoji: '➗', text: 'Split this bill between ___ people' },
      { id: '3', emoji: '🛒', text: 'What items are on this invoice?' }
    ],
    food: [
      { id: '1', emoji: '🔥', text: 'How many calories is this?' },
      { id: '2', emoji: '🥗', text: 'What ingredients do you see?' },
      { id: '3', emoji: '🍽️', text: 'What type of food is this?' }
    ],
    documents: [
      { id: '1', emoji: '📚', text: 'Answer the questions in this' },
      { id: '2', emoji: '📊', text: 'Explain this chart/report' },
      { id: '3', emoji: '📝', text: 'Help me understand this' }
    ],
    screenshots: [
      { id: '1', emoji: '🚨', text: "What's the error/problem here?" },
      { id: '2', emoji: '🛠️', text: 'How do I fix this step by step?' },
      { id: '3', emoji: '📱', text: 'What app/feature is this?' }
    ],
    photos: [
      { id: '1', emoji: '👥', text: 'Describe the person/people' },
      { id: '2', emoji: '📍', text: 'Where was this taken?' },
      { id: '3', emoji: '😊', text: "What's their expression/mood?" }
    ],
    general: [
      { id: '1', emoji: '👁️', text: 'Describe everything you see' },
      { id: '2', emoji: '🔍', text: "What's the main subject here?" },
      { id: '3', emoji: '💡', text: "What's interesting about this?" }
    ]
  };

  const pills = pillsByType[imageType.id] || [];

  return (
    <div className="flex gap-2 flex-wrap px-3 py-2">
      {pills.map((pill) => (
        <button
          key={pill.id}
          onClick={() => onPillClick(pill.text)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm transition-colors border border-primary/20"
        >
          <span>{pill.emoji}</span>
          <span className="whitespace-nowrap">{pill.text}</span>
        </button>
      ))}
    </div>
  );
}
