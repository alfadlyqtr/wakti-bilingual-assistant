
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, AlertTriangle, Clock } from 'lucide-react';
import { VisitorIdentityService, VisitorIdentity } from '@/services/visitorIdentityService';

interface EnhancedVisitorNameModalProps {
  isOpen: boolean;
  onSubmit: (identity: VisitorIdentity) => void;
  taskTitle: string;
  taskId: string;
}

export const EnhancedVisitorNameModal: React.FC<EnhancedVisitorNameModalProps> = ({
  isOpen,
  onSubmit,
  taskTitle,
  taskId
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [storedIdentity, setStoredIdentity] = useState<VisitorIdentity | null>(null);
  const [showNameConflict, setShowNameConflict] = useState(false);
  const [existingSessions, setExistingSessions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && taskId) {
      checkStoredIdentity();
    }
  }, [isOpen, taskId]);

  const checkStoredIdentity = async () => {
    const stored = await VisitorIdentityService.getStoredIdentity(taskId);
    if (stored) {
      setStoredIdentity(stored);
      setName(stored.name);
    }
  };

  const handleContinueAsStored = async () => {
    if (!storedIdentity) return;

    setLoading(true);
    try {
      // Update last active time
      await VisitorIdentityService.updateLastActive(taskId, storedIdentity);
      onSubmit(storedIdentity);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNewName = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      // Check for name conflicts
      const hasConflict = await VisitorIdentityService.checkNameConflict(taskId, name.trim(), '');
      
      if (hasConflict) {
        const sessions = await VisitorIdentityService.getExistingSessions(taskId, name.trim());
        setExistingSessions(sessions);
        setShowNameConflict(true);
        setLoading(false);
        return;
      }

      const identity = await VisitorIdentityService.createVisitorIdentity(taskId, name.trim());
      onSubmit(identity);
    } catch (error) {
      console.error('Error creating identity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithConflict = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const identity = await VisitorIdentityService.createVisitorIdentity(taskId, name.trim());
      onSubmit(identity);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFresh = () => {
    setStoredIdentity(null);
    setName('');
    setShowNameConflict(false);
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

          {storedIdentity && !showNameConflict && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>Continue as <strong>{storedIdentity.name}</strong>?</p>
                  <p className="text-xs text-muted-foreground">
                    You visited this task before from this browser.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {showNameConflict && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>{name}</strong> is already active on this task from another device/browser.</p>
                  <p className="text-xs text-muted-foreground">
                    You can continue anyway or choose a different name.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!showNameConflict ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visitor-name">
                  {storedIdentity ? 'Or enter a different name' : 'Enter your name to continue'}
                </Label>
                <Input
                  id="visitor-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoFocus={!storedIdentity}
                />
              </div>

              <div className="flex flex-col gap-2">
                {storedIdentity && (
                  <Button 
                    onClick={handleContinueAsStored}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Continuing...' : `Continue as ${storedIdentity.name}`}
                  </Button>
                )}
                
                <Button 
                  onClick={handleSubmitNewName}
                  disabled={loading || !name.trim()} 
                  variant={storedIdentity ? "outline" : "default"}
                  className="w-full"
                >
                  {loading ? 'Entering...' : storedIdentity ? 'Enter with New Name' : 'Enter Task View'}
                </Button>

                {storedIdentity && (
                  <Button 
                    onClick={handleStartFresh}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Start fresh (forget stored name)
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleContinueWithConflict}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Continuing...' : `Continue as ${name} anyway`}
              </Button>
              
              <Button 
                onClick={() => setShowNameConflict(false)}
                variant="outline"
                className="w-full"
              >
                Choose Different Name
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p>✓ You can mark tasks and subtasks as complete</p>
            <p>✓ You can request the task owner to snooze this task</p>
            <p>✓ Your actions will be visible to the task owner in real-time</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
