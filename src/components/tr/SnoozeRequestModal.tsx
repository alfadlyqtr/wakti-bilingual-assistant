
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';

interface SnoozeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
  taskTitle: string;
}

export const SnoozeRequestModal: React.FC<SnoozeRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  taskTitle
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(reason.trim() || undefined);
      setReason('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request Snooze
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Request to snooze task:
            </p>
            <p className="font-semibold text-primary">"{taskTitle}"</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snooze-reason">Reason (optional)</Label>
              <Textarea
                id="snooze-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need more time for this task?"
                rows={3}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              The task owner will be notified of your snooze request and can approve or deny it.
            </div>

            <div className="flex items-center gap-3">
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1"
              >
                {loading ? 'Sending...' : 'Send Request'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose} 
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
