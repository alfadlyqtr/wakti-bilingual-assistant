
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
