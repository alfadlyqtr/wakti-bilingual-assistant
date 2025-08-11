import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function SupportTicketModal({ isOpen, onClose, onSubmitted }: SupportTicketModalProps) {
  const { language } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: '',
    message: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setFormData(prev => ({
          ...prev,
          name: profile.display_name || '',
          email: profile.email || ''
        }));
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        const maxWidth = 1280;
        const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (attachments.length + files.length > 3) {
      toast.error(language === 'ar' ? 'الحد الأقصى 3 مرفقات' : 'Maximum 3 attachments allowed');
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(language === 'ar' ? 'الصور فقط مسموحة' : 'Only images are allowed');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
        continue;
      }

      const compressedFile = await compressImage(file);
      setAttachments(prev => [...prev, compressedFile]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (ticketId: string): Promise<any[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const uploadedAttachments = [];

    for (const [index, file] of attachments.entries()) {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${ticketId}/${timestamp}-${sanitizedName}`;

      const { data, error } = await supabase.storage
        .from('support-attachments')
        .upload(filePath, file);

      if (!error && data) {
        uploadedAttachments.push({
          path: data.path,
          name: file.name,
          size: file.size,
          type: file.type
        });
      }
    }

    return uploadedAttachments;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.message.trim()) {
      toast.error(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    if (formData.message.length > 500) {
      toast.error(language === 'ar' ? 'الرسالة طويلة جداً (الحد الأقصى 500 حرف)' : 'Message too long (max 500 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      // First submit the ticket
      const { data, error } = await supabase.functions.invoke('support-ticket-submit', {
        body: {
          type: formData.type,
          body: formData.message,
          attachments: [] // Will be updated after upload
        }
      });

      if (error) throw error;

      const ticketId = data.ticket_id;

      // Upload attachments if any
      let attachmentData = [];
      if (attachments.length > 0) {
        attachmentData = await uploadAttachments(ticketId);
        
        // Update the message with attachment data
        if (attachmentData.length > 0) {
          await supabase
            .from('support_messages')
            .update({ attachments: attachmentData })
            .eq('ticket_id', ticketId)
            .eq('role', 'user');
        }
      }

      toast.success(language === 'ar' ? 'تم إرسال التذكرة بنجاح' : 'Ticket submitted successfully');
      
      // Reset form
      setFormData({ name: '', email: '', type: '', message: '' });
      setAttachments([]);
      onSubmitted();
      onClose();

    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      const message = error.message || 'Failed to submit ticket';
      
      if (message.includes('wait 10 minutes')) {
        toast.error(language === 'ar' ? 'يرجى الانتظار 10 دقائق قبل إنشاء تذكرة أخرى' : 'Please wait 10 minutes before creating another ticket');
      } else if (message.includes('maximum of 3 open tickets')) {
        toast.error(language === 'ar' ? 'لديك الحد الأقصى من التذاكر المفتوحة (3)' : 'You have reached the maximum of 3 open tickets');
      } else {
        toast.error(language === 'ar' ? 'فشل في إرسال التذكرة' : 'Failed to submit ticket');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'فتح تذكرة دعم' : 'Open Support Ticket'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">{language === 'ar' ? 'الاسم' : 'Name'}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="email">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="type">{language === 'ar' ? 'النوع' : 'Type'} *</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر النوع' : 'Select type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support">{language === 'ar' ? 'الدعم' : 'Support'}</SelectItem>
                <SelectItem value="feedback">{language === 'ar' ? 'ملاحظات' : 'Feedback'}</SelectItem>
                <SelectItem value="abuse">{language === 'ar' ? 'إبلاغ عن إساءة' : 'Report Abuse'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="message">
              {language === 'ar' ? 'الرسالة' : 'Message'} * 
              <span className="text-sm text-muted-foreground ml-2">
                ({formData.message.length}/500)
              </span>
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
              maxLength={500}
              rows={4}
            />
          </div>

          <div>
            <Label>{language === 'ar' ? 'المرفقات' : 'Attachments'} ({attachments.length}/3)</Label>
            <div className="space-y-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {attachments.length < 3 && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'إضافة صور' : 'Add Images'}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'ar' ? 'إرسال' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}