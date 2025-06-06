
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bot, Search, ImagePlus, Zap } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface TextGenModalProps {
  onTriggerChange: (trigger: string) => void;
  onTextGenParams: (params: any) => void;
}

export function TextGenModal({ onTriggerChange, onTextGenParams }: TextGenModalProps) {
  const { language } = useTheme();
  const [activeTrigger, setActiveTrigger] = useState<string>('chat');
  const [isOpen, setIsOpen] = useState(false);

  const triggers = [
    {
      id: 'chat',
      name: language === 'ar' ? 'محادثة' : 'Chat',
      icon: Bot,
      description: language === 'ar' ? 'محادثة عادية مع الذكاء الاصطناعي' : 'Regular AI conversation'
    },
    {
      id: 'search',
      name: language === 'ar' ? 'بحث' : 'Search',
      icon: Search,
      description: language === 'ar' ? 'بحث على الإنترنت' : 'Internet search'
    },
    {
      id: 'image',
      name: language === 'ar' ? 'صورة' : 'Image',
      icon: ImagePlus,
      description: language === 'ar' ? 'إنشاء الصور' : 'Image generation'
    },
    {
      id: 'advanced_search',
      name: language === 'ar' ? 'بحث متقدم' : 'Advanced',
      icon: Zap,
      description: language === 'ar' ? 'بحث متقدم ومعقد' : 'Advanced search'
    }
  ];

  const handleTriggerSelect = (triggerId: string) => {
    setActiveTrigger(triggerId);
    onTriggerChange(triggerId);
    setIsOpen(false);
  };

  const currentTrigger = triggers.find(t => t.id === activeTrigger);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentTrigger && <currentTrigger.icon className="h-4 w-4" />}
          <span className="hidden sm:inline">{currentTrigger?.name}</span>
          <Badge variant="secondary" className="text-xs">
            {activeTrigger}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'اختر نوع المحادثة' : 'Select Conversation Type'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? 'اختر نوع التفاعل مع الذكاء الاصطناعي'
              : 'Choose how you want to interact with AI'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {triggers.map((trigger) => (
            <Button
              key={trigger.id}
              variant={activeTrigger === trigger.id ? "default" : "outline"}
              className="justify-start gap-3 h-auto p-4"
              onClick={() => handleTriggerSelect(trigger.id)}
            >
              <trigger.icon className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">{trigger.name}</div>
                <div className="text-xs text-muted-foreground">
                  {trigger.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
