
import React, { useState } from 'react';
import { 
  Camera, 
  FileText, 
  Gamepad2, 
  Users, 
  Calendar, 
  MessageSquare,
  Video,
  Zap,
  ChevronRight
} from 'lucide-react';
import { GameModeModal } from './wakti-ai-v2/GameModeModal';
import { ScreenshotUpload } from './wakti-ai-v2/ScreenshotUpload';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  comingSoon?: boolean;
}

const quickActions: QuickAction[] = [
  {
    id: 'screenshot-ai',
    title: 'Screenshot AI',
    description: 'Analyze and extract info from screenshots',
    icon: Camera,
    color: 'bg-blue-500',
  },
  {
    id: 'video-generator',
    title: 'AI Video Generator',
    description: 'Create professional videos from images with 28+ templates',
    icon: Video,
    color: 'bg-indigo-500',
    comingSoon: true, // Mark as coming soon since it's only available in chat
  },
  {
    id: 'document-scanner',
    title: 'Document Scanner',
    description: 'Scan and digitize documents',
    icon: FileText,
    color: 'bg-green-500',
    comingSoon: true,
  },
  {
    id: 'game-mode',
    title: 'Game Mode',
    description: 'Play interactive games and challenges',
    icon: Gamepad2,
    color: 'bg-purple-500',
  },
  {
    id: 'group-chat',
    title: 'Group Chat',
    description: 'Start conversations with friends',
    icon: Users,
    color: 'bg-pink-500',
    comingSoon: true,
  },
  {
    id: 'quick-events',
    title: 'Quick Events',
    description: 'Create events in seconds',
    icon: Calendar,
    color: 'bg-orange-500',
    comingSoon: true,
  },
  {
    id: 'voice-notes',
    title: 'Voice Notes',
    description: 'Record and transcribe voice messages',
    icon: MessageSquare,
    color: 'bg-teal-500',
    comingSoon: true,
  },
];

export const QuickActionsPanel = () => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleActionSelect = (actionId: string) => {
    const action = quickActions.find(a => a.id === actionId);
    if (action?.comingSoon) {
      return; // Don't open modal for coming soon features
    }
    setSelectedAction(actionId);
  };

  const closeModal = () => {
    setSelectedAction(null);
  };

  return (
    <>
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Quick Tools</h2>
            <p className="text-sm text-muted-foreground">Powerful AI tools at your fingertips</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleActionSelect(action.id)}
                disabled={action.comingSoon}
                className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.02] ${
                  action.comingSoon 
                    ? 'bg-muted/50 cursor-not-allowed opacity-60' 
                    : 'bg-background border border-border hover:border-primary/30 hover:shadow-md'
                }`}
              >
                <div className={`p-3 rounded-lg ${action.color} flex-shrink-0`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {action.title}
                    </h3>
                    {action.comingSoon && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {action.description}
                  </p>
                </div>
                {!action.comingSoon && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Standalone Modals - VideoGeneratorModal removed to avoid conflicts */}
      <GameModeModal 
        open={selectedAction === 'game-mode'} 
        onOpenChange={(open) => !open && closeModal()} 
      />
      
      <ScreenshotUpload 
        isOpen={selectedAction === 'screenshot-ai'} 
        onClose={closeModal} 
      />
    </>
  );
};
