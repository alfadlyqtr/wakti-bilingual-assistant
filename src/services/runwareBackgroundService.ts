
export interface BackgroundRemovalParams {
  image: File | string; // File object, URL, or data URI
  includeCost?: boolean;
}

export interface BackgroundRemovalResult {
  success: boolean;
  imageUrl?: string;
  imageBase64Data?: string;
  cost?: number;
  error?: string;
}

export class RunwareBackgroundService {
  static async removeBackground(params: BackgroundRemovalParams): Promise<BackgroundRemovalResult> {
    try {
      console.log('🎨 Starting background removal process...');
      
      // Convert File to base64 if needed
      let imageData: string;
      
      if (params.image instanceof File) {
        imageData = await this.fileToBase64(params.image);
      } else {
        imageData = params.image;
      }
      
      // Call our edge function which handles Runware API
      const response = await fetch('/functions/v1/remove-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          includeCost: params.includeCost || false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Background removal failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Background removal failed');
      }
      
      console.log('🎨 Background removal successful!');
      
      return {
        success: true,
        imageUrl: result.imageUrl,
        imageBase64Data: result.imageBase64Data,
        cost: result.cost
      };
      
    } catch (error) {
      console.error('🎨 Background removal error:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove background'
      };
    }
  }
  
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
