
import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, Expand } from "lucide-react";
import { ChatMessage } from "../types";

interface MessageContentProps {
  content: string;
  messageId: string;
  message: ChatMessage;
  isCreativeModeActive: boolean;
  isSwitchingMode: boolean;
  openImageModal: (imageUrl: string, promptText: string, timestamp: Date) => void;
  downloadImage: (imageUrl: string, promptText: string) => void;
}

const MessageContent: React.FC<MessageContentProps> = ({
  content,
  messageId,
  message,
  isCreativeModeActive,
  isSwitchingMode,
  openImageModal,
  downloadImage
}) => {
  // Track images that are loading
  const [loadingImages, setLoadingImages] = useState<{[key: string]: boolean}>({});
  
  // Extract prompt text from message content
  const extractPromptFromContent = (content: string): string => {
    // Look for markdown image syntax ![...](...)
    const imgRegex = /!\[([^\]]*)\]\([^)]+\)/;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // If no match, try to find any text before the image
    const lines = content.split('\n');
    const textLines = lines.filter(line => !line.startsWith('![') && line.trim() !== '');
    
    if (textLines.length > 0) {
      return textLines[0];
    }
    
    return "Generated Image";
  };

  // Check if content has image markdown
  const hasImageMarkdown = content.includes('![');
  
  if (hasImageMarkdown) {
    // Extract the prompt for download filename
    const promptText = extractPromptFromContent(content);
    
    return (
      <ReactMarkdown
        components={{
          img: ({ node, ...props }) => {
            const imageUrl = props.src || '';
            
            // Only start loading when we're in creative mode AND the URL is valid
            const shouldStartLoading = isCreativeModeActive && 
              imageUrl.startsWith('http') && 
              !isSwitchingMode;
            
            // Set this message's image as loading when first encountered
            if (shouldStartLoading && !loadingImages.hasOwnProperty(messageId)) {
              setLoadingImages(prev => ({...prev, [messageId]: true}));
            }
            
            return (
              <div className="relative mt-2 overflow-hidden rounded-md">
                {/* Shimmer effect - only show when in creative mode and image is loading */}
                {(shouldStartLoading && loadingImages[messageId]) && (
                  <Skeleton className="w-full h-64 animate-pulse bg-zinc-300 dark:bg-zinc-700" />
                )}
                
                {/* Only render the image when we're ready to show it */}
                {shouldStartLoading && (
                  <div className="relative group">
                    <img 
                      {...props}
                      className={`w-full h-auto object-cover rounded-md transition-opacity duration-300 ${
                        loadingImages[messageId] ? 'opacity-0' : 'opacity-100'
                      }`}
                      loading="lazy"
                      onLoad={(e) => {
                        // Add a small delay before showing image for smoother transition
                        setTimeout(() => {
                          setLoadingImages(prev => ({...prev, [messageId]: false}));
                        }, 250); // 250ms buffer for smoother transition
                      }}
                      style={{ maxHeight: '300px' }}
                      onClick={() => openImageModal(imageUrl, promptText, message.timestamp)}
                    />
                    
                    {/* Fixed position action buttons to prevent flickering on hover */}
                    <div className="absolute bottom-2 right-2 flex gap-2 transition-opacity duration-300 
                                  opacity-0 group-hover:opacity-100 bg-black/5 backdrop-blur-sm 
                                  p-1 rounded-full">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full
                                  transition-colors duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(imageUrl, promptText);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Download</span>
                      </Button>
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full
                                  transition-colors duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImageModal(imageUrl, promptText, message.timestamp);
                        }}
                      >
                        <Expand className="h-4 w-4" />
                        <span className="sr-only">Expand</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          },
          p: ({ node, children }) => <p className="mb-2">{children}</p>,
          a: ({ node, children, ...props }) => (
            <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }
  
  // Regular message formatting with line breaks
  return (
    <div className="whitespace-pre-wrap text-sm">
      {content.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MessageContent;
