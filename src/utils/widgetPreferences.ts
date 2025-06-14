import { supabase } from "@/integrations/supabase/client";

/**
 * Map profile.settings.widgets DB fields to dashboard widget IDs
 * @param widgetsDbPrefs settings.widgets from DB, or fallback
 */
export function getWidgetVisibilityFromProfile(widgetsDbPrefs: any) {
  // Dashboard widget IDs: calendar, tr, maw3d, quote
  // DB fields: calendarWidget, tasksWidget, remindersWidget, maw3dWidget, quoteWidget
  // 'tr' is true if either tasksWidget or remindersWidget is true
  return {
    calendar: widgetsDbPrefs?.calendarWidget !== false,
    tr: (widgetsDbPrefs?.tasksWidget !== false) || (widgetsDbPrefs?.remindersWidget !== false),
    maw3d: widgetsDbPrefs?.maw3dWidget !== false,
    quote: widgetsDbPrefs?.quoteWidget !== false,
  };
}

/** Get widget prefs from remote Supabase profile for the signed-in user (id = in JWT) */
export async function fetchRemoteWidgetPrefs() {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("settings")
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile settings:", error);
    return null;
  }
  return profile?.settings?.widgets ?? null;
}

/**
 * Save widget prefs to Supabase profiles.settings.widgets for the signed-in user
 * @param widgetsDbPrefs Object like {calendarWidget:true, tasksWidget:false, ...}
 */
export async function saveRemoteWidgetPrefs(widgetsDbPrefs: any) {
  // Fix: Await supabase.auth.getUser() before accessing .data.user.id
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
}

export const getUserPreferences = () => {
  try {
    const storedPreferences = localStorage.getItem('widgetVisibility');
    console.log('Raw stored preferences:', storedPreferences);
    
    if (storedPreferences) {
      const parsed = JSON.parse(storedPreferences);
      console.log('Parsed preferences:', parsed);
      return parsed;
    }
  } catch (error) {
    console.error('Error loading widget preferences:', error);
  }
  
  // Default preferences if nothing is stored - all widgets visible by default
  const defaultPrefs = {
    calendar: true,
    tr: true,
    maw3d: true,
    dailyQuote: true,
  };
  
  console.log('Using default preferences:', defaultPrefs);
  return defaultPrefs;
};

export const saveUserPreferences = (preferences: any) => {
  try {
    console.log('Saving user preferences:', preferences);
    localStorage.setItem('widgetVisibility', JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving widget preferences:', error);
  }
};

export const getWidgetOrder = () => {
  try {
    const storedOrder = localStorage.getItem('widgetOrder');
    console.log('Raw stored order:', storedOrder);
    
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      console.log('Parsed order:', parsed);
      return parsed;
    }
  } catch (error) {
    console.error('Error loading widget order:', error);
  }
  
  // Default order if nothing is stored
  const defaultOrder = ['calendar', 'tr', 'maw3d', 'quote'];
  console.log('Using default order:', defaultOrder);
  return defaultOrder;
};

export const saveWidgetOrder = (newOrder: string[]) => {
  try {
    console.log('Saving widget order:', newOrder);
    localStorage.setItem('widgetOrder', JSON.stringify(newOrder));
  } catch (error) {
    console.error('Error saving widget order:', error);
  }
};
