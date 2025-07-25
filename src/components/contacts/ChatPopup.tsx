
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, Send, Image as ImageIcon, FileText, Mic, MicOff, Paperclip, Download, Play, Pause } from "lucide-react";
import { 
  getMessages, 
  sendMessage, 
  uploadMessageAttachment, 
  getBlockStatus 
} from "@/services/messageService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/utils/translations";
import { toast } from "sonner";
import { VoiceRecorder } from "./VoiceRecorder";

interface ChatPopupProps {
  contact: any;
  onClose: () => void;
}

export function ChatPopup({ contact, onClose }: ChatPopupProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [blockStatus, setBlockStatus] = useState({ isBlocked: false, isBlockedBy: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const messagesData = await getMessages(contact.contact_id, user.id);
      setMessages(messagesData);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error(t("contacts.errorLoadingMessages"));
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockStatus = async () => {
    if (!user?.id) return;

    try {
      const status = await getBlockStatus(contact.contact_id, user.id);
      setBlockStatus(status);
    } catch (error) {
      console.error("Error fetching block status:", error);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchBlockStatus();
  }, [contact.contact_id, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!user?.id || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      await sendMessage(contact.contact_id, {
        message_type: 'text',
        content: newMessage.trim()
      }, user.id);
      
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t("contacts.errorSendingMessage"));
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id) return;

    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("contacts.imageTooLarge"));
      return;
    }

    try {
      setSending(true);
      
      let messageType: 'image' | 'pdf' = 'image';
      if (file.type.includes('pdf')) {
        messageType = 'pdf';
      }
      
      const mediaUrl = await uploadMessageAttachment(file, messageType, user.id);
      
      await sendMessage(contact.contact_id, {
        message_type: messageType,
        media_url: mediaUrl,
        media_type: file.type,
        file_size: file.size
      }, user.id);
      
      fetchMessages();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(t("contacts.errorUploadingImage"));
    } finally {
      setSending(false);
    }
  };

  const handleVoiceMessage = async (audioBlob: Blob, duration: number) => {
    if (!user?.id) return;

    try {
      setSending(true);
      
      const voiceFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      const mediaUrl = await uploadMessageAttachment(voiceFile, 'voice', user.id);
      
      await sendMessage(contact.contact_id, {
        message_type: 'voice',
        media_url: mediaUrl,
        media_type: 'audio/webm',
        voice_duration: duration,
        file_size: audioBlob.size
      }, user.id);
      
      fetchMessages();
      setShowVoiceRecorder(false);
    } catch (error) {
      console.error("Error sending voice message:", error);
      toast.error(t("contacts.errorSendingMessage"));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return t("contacts.justNow");
    if (minutes < 60) return `${minutes} ${t("contacts.minsAgo")}`;
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const canSendMessages = !blockStatus.isBlocked && !blockStatus.isBlockedBy;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md h-[80vh] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.profile?.avatar_url} alt={contact.profile?.display_name} />
                <AvatarFallback>
                  {contact.profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">
                  {contact.profile?.display_name || contact.profile?.username || "Unknown User"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("contacts.activeNow")}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("contacts.startConversation")}</p>
              </div>
            ) : (
              messages.map((message: any) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.sender_id === user?.id}
                  formatTime={formatTime}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4">
            {blockStatus.isBlocked && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                لقد قمت بحظر هذا المستخدم
              </div>
            )}
            {blockStatus.isBlockedBy && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                لقد قام هذا المستخدم بحظرك
              </div>
            )}
            
            {canSendMessages && (
              <>
                {showVoiceRecorder ? (
                  <VoiceRecorder
                    onSend={handleVoiceMessage}
                    onCancel={() => setShowVoiceRecorder(false)}
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVoiceRecorder(true)}
                      disabled={sending}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex-1 flex space-x-2">
                      <Input
                        placeholder={t("contacts.typeMessage")}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={sending}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim() || sending}
                        size="sm"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}

function MessageBubble({ message, isOwn, formatTime }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] rounded-lg p-3 ${
        isOwn 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      }`}>
        {message.message_type === 'text' && (
          <p className="text-sm">{message.content}</p>
        )}
        
        {message.message_type === 'image' && (
          <div className="space-y-2">
            <img 
              src={message.media_url} 
              alt="Shared image" 
              className="max-w-full h-auto rounded"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-70">صورة</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(message.media_url, '_blank')}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        
        {message.message_type === 'voice' && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAudio}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-xs opacity-70">
              {message.voice_duration ? `${Math.floor(message.voice_duration)}s` : 'Voice message'}
            </span>
            <audio
              ref={audioRef}
              src={message.media_url}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
          </div>
        )}
        
        {message.message_type === 'pdf' && (
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs opacity-70">PDF</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(message.media_url, '_blank')}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
          {isOwn && (
            <span className="text-xs opacity-70">
              {message.is_read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
