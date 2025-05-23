
export const getUserPreferences = () => {
  try {
    const storedPreferences = localStorage.getItem('widgetVisibility');
    if (storedPreferences) {
      return JSON.parse(storedPreferences);
    }
  } catch (error) {
    console.error('Error loading widget preferences:', error);
  }
  
  // Default preferences if nothing is stored
  return {
    tasks: true,
    calendar: true,
    reminders: true,
    dailyQuote: true,
    events: true,
  };
};

export const getWidgetOrder = () => {
  try {
    const storedOrder = localStorage.getItem('widgetOrder');
    if (storedOrder) {
      return JSON.parse(storedOrder);
    }
  } catch (error) {
    console.error('Error loading widget order:', error);
  }
  
  // Default order if nothing is stored
  return ['tasks', 'calendar', 'events', 'reminders', 'quote'];
};

export const saveWidgetOrder = (newOrder: string[]) => {
  try {
    localStorage.setItem('widgetOrder', JSON.stringify(newOrder));
  } catch (error) {
    console.error('Error saving widget order:', error);
  }
};
