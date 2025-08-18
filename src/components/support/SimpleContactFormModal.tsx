import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export const SimpleContactFormModal: React.FC<ContactFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: '',
    message: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFormData(prev => ({
          ...prev,
          name: profile.display_name || '',
          email: profile.email || user.email || '',
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      return isImage && isValidSize;
    });

    if (validFiles.length !== files.length) {
      toast.error('Only images under 5MB are allowed');
    }

    if (attachments.length + validFiles.length > 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (submissionId: string) => {
    const uploadPromises = attachments.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${submissionId}_${index}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('contact_attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('contact_attachments')
        .getPublicUrl(fileName);

      return {
        url: urlData.publicUrl,
        filename: file.name,
        size: file.size
      };
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.message.trim()) {
      toast.error('Please select a type and enter a message');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create contact submission
      const { data: submission, error: submissionError } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.name,
          email: formData.email,
          subject: `${formData.type.toUpperCase()}: New Request`,
          message: formData.message,
          submission_type: formData.type,
          status: 'unread'
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Upload attachments if any
      let attachmentData = null;
      if (attachments.length > 0) {
        try {
          attachmentData = await uploadAttachments(submission.id);
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
          toast.error('Message sent but attachments failed to upload');
        }
      }

      // Initial message is already in the contact_submissions table
      // No need to create separate chat message

      toast.success('Message sent successfully! You can now continue the conversation.');
      
      // Reset form
      setFormData({ name: '', email: '', type: '', message: '' });
      setAttachments([]);
      
      onSubmitted();
      onClose();

    } catch (error: any) {
      console.error('Error submitting contact form:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              readOnly
              placeholder="Your name"
              required
              className="bg-muted/60 cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              readOnly
              placeholder="your.email@example.com"
              required
              className="bg-muted/60 cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="abuse">Report Abuse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Describe your issue or feedback..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments (Optional)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('attachment-input')?.click()}
                disabled={attachments.length >= 3}
              >
                <Upload className="w-4 h-4 mr-2" />
                Add Image
              </Button>
              <span className="text-sm text-muted-foreground">
                {attachments.length}/3 images (max 5MB each)
              </span>
            </div>
            <input
              id="attachment-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Images:</Label>
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};