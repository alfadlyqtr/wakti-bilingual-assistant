
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User } from 'lucide-react';

interface SimpleVisitorModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
  taskTitle: string;
}

export const SimpleVisitorModal: React.FC<SimpleVisitorModalProps> = ({
  isOpen,
  onSubmit,
  taskTitle
}) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
      setName('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Enter Your Name
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              To interact with task:
            </p>
            <p className="font-semibold text-primary">"{taskTitle}"</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitor-name">Your Name</Label>
              <Input
                id="visitor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Continue
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
