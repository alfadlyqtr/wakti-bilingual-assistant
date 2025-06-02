
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User } from 'lucide-react';

interface VisitorNameModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
  taskTitle: string;
}

export const VisitorNameModal: React.FC<VisitorNameModalProps> = ({
  isOpen,
  onSubmit,
  taskTitle
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Welcome to Shared Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              You're viewing the shared task:
            </p>
            <p className="font-semibold text-primary">"{taskTitle}"</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitor-name">Enter your name to continue</Label>
              <Input
                id="visitor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </div>

            <div className="text-xs text-muted-foreground">
              <p>✓ You can mark tasks and subtasks as complete</p>
              <p>✓ You can request the task owner to snooze this task</p>
              <p>✓ Your actions will be visible to the task owner in real-time</p>
            </div>

            <Button 
              type="submit" 
              disabled={loading || !name.trim()} 
              className="w-full"
            >
              {loading ? 'Entering...' : 'Enter Task View'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
