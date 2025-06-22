
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface AdminMessageModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminMessageModal = ({ user, isOpen, onClose }: AdminMessageModalProps) => {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!user || !subject.trim() || !content.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }

    setIsSending(true);
    try {
      // Get admin session
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error("Admin session not found");
        return;
      }

      const session = JSON.parse(adminSession);
      
      const { error } = await supabase.rpc('send_admin_message', {
        p_admin_id: session.admin_id,
        p_recipient_id: user.id,
        p_subject: subject.trim(),
        p_content: content.trim()
      });

      if (error) {
        console.error('Error sending admin message:', error);
        toast.error("Failed to send message");
        return;
      }

      toast.success(`Message sent to ${user.full_name || user.email}`);
      setSubject("");
      setContent("");
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setContent("");
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Send Message to User</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Recipient</Label>
            <div className="mt-1 p-2 bg-muted rounded">
              <p className="font-medium">{user.full_name || "No name"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Message subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              placeholder="Type your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={isSending || !subject.trim() || !content.trim()}
              className="flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{isSending ? "Sending..." : "Send Message"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
