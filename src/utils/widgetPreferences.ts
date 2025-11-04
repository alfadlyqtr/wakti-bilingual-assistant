
import { supabase } from "@/integrations/supabase/client";

// Simple localStorage-based widget order management
export const getWidgetOrder = () => {
  try {
    const storedOrder = localStorage.getItem('widgetOrder');
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      console.log('Loaded widget order from localStorage:', parsed);
      return parsed;
    }
  } catch (error) {
    console.error('Error loading widget order:', error);
  }
  
  // Default order
  const defaultOrder = ['calendar', 'tr', 'maw3d', 'quote'];
  console.log('Using default widget order:', defaultOrder);
  return defaultOrder;
};

export const saveWidgetOrder = async (newOrder: string[]) => {
  try {
    // Save to localStorage immediately
    localStorage.setItem('widgetOrder', JSON.stringify(newOrder));
    console.log('Widget order saved to localStorage:', newOrder);
  } catch (error) {
    console.error('Error saving widget order:', error);
  }
};

// Legacy functions - simplified for compatibility
export function getWidgetVisibilityFromProfile(widgetsDbPrefs: any) {
  return {
    calendar: widgetsDbPrefs?.calendarWidget !== false,
    tr: (widgetsDbPrefs?.tasksWidget !== false) || (widgetsDbPrefs?.remindersWidget !== false),
    maw3d: widgetsDbPrefs?.maw3dWidget !== false,
    quote: widgetsDbPrefs?.quoteWidget !== false,
  };
}

export async function fetchRemoteWidgetPrefs() {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("settings")
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile settings:", error);
      return null;
    }
    return profile?.settings?.widgets ?? null;
  } catch (error) {
    console.error("Error in fetchRemoteWidgetPrefs:", error);
    return null;
  }
}

export async function saveRemoteWidgetPrefs(widgetsDbPrefs: any) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) {
      console.error("No authenticated user found when saving widget prefs.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        settings: {
          widgets: widgetsDbPrefs
        }
      })
      .eq("id", userId);
    if (error) {
      console.error("Error saving profile widget settings:", error);
    }
  } catch (error) {
    console.error("Error in saveRemoteWidgetPrefs:", error);
  }
}

export const getUserPreferences = () => {
  try {
    const storedPreferences = localStorage.getItem('widgetVisibility');
    if (storedPreferences) {
      return JSON.parse(storedPreferences);
    }
  } catch (error) {
    console.error('Error loading widget preferences:', error);
  }
  
  // Default preferences - all visible
  return {
    calendar: true,
    tr: true,
    maw3d: true,
    quote: true,
  };
};

export const saveUserPreferences = (preferences: any) => {
  try {
    localStorage.setItem('widgetVisibility', JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving widget preferences:', error);
  }
};

export const getRemoteWidgetOrder = async (): Promise<string[]> => {
  // Simplified - just use local storage
  return getWidgetOrder();
};
