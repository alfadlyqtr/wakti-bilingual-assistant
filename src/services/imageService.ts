import { supabase } from "@/integrations/supabase/client";
import { modeController } from "@/utils/modeController";
import { generateImage } from "@/services/chatService";

// Interface for the images table
export interface ImageRecord {
  id?: string;
  user_id: string;
  prompt: string;
  image_url: string;
  created_at?: string;
  metadata?: any;
}

// Save an image to the Supabase database
export async function saveImageToDatabase(
  userId: string,
  prompt: string,
  imageUrl: string,
  metadata: any = {}
): Promise<string | null> {
  try {
    console.log('Saving generated image to database:', { prompt, userId });
    
    const newImage: ImageRecord = {
      user_id: userId,
      prompt,
      image_url: imageUrl,
      metadata
    };
    
    const { data, error } = await supabase
      .from('images')
      .insert(newImage)
      .select('id')
      .single();
      
    if (error) {
      console.error('Error saving image to database:', error);
      return null;
    }
    
    console.log('Image saved successfully with ID:', data.id);
    return data.id;
    
  } catch (error) {
    console.error('Exception saving image to database:', error);
    return null;
  }
}

// Get a user's image history
export async function getUserImages(
  userId: string,
  limit: number = 10
): Promise<ImageRecord[]> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching user images:', error);
      return [];
    }
    
    return data || [];
    
  } catch (error) {
    console.error('Exception fetching user images:', error);
    return [];
  }
}

// Get a specific image by ID
export async function getImageById(
  imageId: string
): Promise<ImageRecord | null> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single();
      
    if (error) {
      console.error('Error fetching image:', error);
      return null;
    }
    
    return data;
    
  } catch (error) {
    console.error('Exception fetching image:', error);
    return null;
  }
}

// Process an image generation request
export async function processImageGeneration(
  prompt: string,
  userId: string
): Promise<{imageUrl: string; originalPrompt: string} | null> {
  try {
    // Switch to creative mode first
    await modeController.setActiveMode('creative');
    
    // Extract the image prompt using the controller
    const imagePrompt = modeController.extractImagePrompt(prompt);
    
    console.log('Processing image generation with prompt:', imagePrompt);
    
    // Use the imported generateImage function from chatService
    const result = await generateImage(imagePrompt);
    
    if (!result || !result.imageUrl) {
      console.error('Failed to generate image, result:', result);
      throw new Error('Failed to generate image');
    }
    
    const { imageUrl, metadata } = result;
    
    // In case of Arabic text that was translated, keep both versions in metadata
    const enhancedMetadata = {
      originalPrompt: prompt,
      timestamp: new Date().toISOString(),
      ...(metadata || {})
    };
    
    // Save the image to the database with the original prompt visible to the user
    // but keep the translated prompt in metadata
    const imageId = await saveImageToDatabase(userId, imagePrompt, imageUrl, enhancedMetadata);
    
    console.log('Image saved to database with ID:', imageId);
    
    return {
      imageUrl, 
      originalPrompt: prompt
    };
  } catch (error) {
    console.error('Error in image generation process:', error);
    return null;
  }
}
