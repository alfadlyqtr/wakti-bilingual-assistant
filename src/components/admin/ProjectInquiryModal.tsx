import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, FolderKanban, Building2, Wallet, Calendar, Tag, Briefcase, User, Clock, X, Phone, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  project_type: 'website' | 'mobile' | 'saas' | 'other';
  project_subtype?: string;
  features: string[];
  budget?: string;
  timeline?: string;
  details?: string;
  other_description?: string;
  status: 'new' | 'read' | 'responded' | 'archived';
  language: 'en' | 'ar';
  created_at: string;
  updated_at: string;
}

interface ProjectInquiryModalProps {
  inquiry: ProjectInquiry | null;
  isOpen: boolean;
  onClose: () => void;
  onResponded: () => void;
}

export const ProjectInquiryModal = ({ inquiry, isOpen, onClose, onResponded }: ProjectInquiryModalProps) => {
  const [response, setResponse] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<ProjectInquiry['status']>('new');

  if (!inquiry) return null;

  const projectTypeLabels: Record<string, string> = {
    website: 'Website',
    mobile: 'Mobile App',
    saas: 'SaaS Platform',
    other: 'Other'
  };

  const handleUpdateStatus = async (newStatus: ProjectInquiry['status']) => {
    try {
      const { error } = await supabase
        .from('project_inquiries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', inquiry.id);

      if (error) throw error;
      setStatus(newStatus);
      toast.success(`Status updated to ${newStatus}`);
      onResponded();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSendResponse = async () => {
    if (!response.trim()) {
      toast.error("Please write a response");
      return;
    }

    setIsSending(true);
    try {
      // Update status to responded
      await supabase
        .from('project_inquiries')
        .update({ 
          status: 'responded', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', inquiry.id);

      toast.success(`Response recorded for ${inquiry.name}`);
      setResponse("");
      onResponded();
    } catch (error: any) {
      console.error('Error sending response:', error);
      toast.error(typeof error?.message === 'string' ? error.message : 'Failed to send response');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setResponse("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FolderKanban className="h-5 w-5" />
            <span>Project Inquiry</span>
            <Badge 
              variant={
                inquiry.status === 'new' ? 'destructive' :
                inquiry.status === 'responded' ? 'default' : 'secondary'
              }
              className="text-xs"
            >
              {inquiry.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Information */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-enhanced-heading flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Name</Label>
                <p className="text-sm font-medium">{inquiry.name}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Email</Label>
                <a 
                  href={`mailto:${inquiry.email}`}
                  className="text-sm text-accent-blue hover:underline flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" />
                  {inquiry.email}
                </a>
              </div>
              {inquiry.phone && (
                <div>
                  <Label className="text-sm text-muted-foreground">Phone</Label>
                  <a 
                    href={`tel:${inquiry.phone}`}
                    className="text-sm text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {inquiry.phone}
                  </a>
                </div>
              )}
              {inquiry.company && (
                <div>
                  <Label className="text-sm text-muted-foreground">Company</Label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {inquiry.company}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Project Details */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-enhanced-heading flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Project Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Project Type</Label>
                <p className="text-sm font-medium">{projectTypeLabels[inquiry.project_type] || inquiry.project_type}</p>
              </div>
              {inquiry.project_subtype && (
                <div>
                  <Label className="text-sm text-muted-foreground">Subtype</Label>
                  <p className="text-sm font-medium">{inquiry.project_subtype}</p>
                </div>
              )}
              {inquiry.budget && (
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    Budget
                  </Label>
                  <p className="text-sm font-medium">{inquiry.budget}</p>
                </div>
              )}
              {inquiry.timeline && (
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Timeline
                  </Label>
                  <p className="text-sm font-medium">{inquiry.timeline}</p>
                </div>
              )}
            </div>

            {/* Features */}
            {inquiry.features && inquiry.features.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                  <Tag className="h-3 w-3" />
                  Requested Features
                </Label>
                <div className="flex flex-wrap gap-2">
                  {inquiry.features.map((feature, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            {inquiry.details && (
              <div className="mt-4">
                <Label className="text-sm text-muted-foreground">Project Details</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap bg-background p-3 rounded border">
                  {inquiry.details}
                </p>
              </div>
            )}

            {/* Other Description */}
            {inquiry.other_description && (
              <div className="mt-4">
                <Label className="text-sm text-muted-foreground">Additional Information</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap bg-background p-3 rounded border">
                  {inquiry.other_description}
                </p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>Received: {new Date(inquiry.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              <span>Language: {inquiry.language === 'ar' ? 'Arabic' : 'English'}</span>
            </div>
          </div>

          {/* Status Management */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">Update Status</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select 
                value={inquiry.status} 
                onValueChange={(value) => handleUpdateStatus(value as ProjectInquiry['status'])}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Response Section */}
          <div className="border-t pt-4">
            <Label htmlFor="response" className="text-sm font-medium">Internal Notes / Response</Label>
            <Textarea
              id="response"
              placeholder="Add internal notes or mark as responded..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button 
              onClick={handleSendResponse}
              disabled={isSending || !response.trim()}
              className="flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{isSending ? "Saving..." : "Mark Responded"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
