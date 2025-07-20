
import { supabase } from '@/integrations/supabase/client';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  high: number;
  low: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  windDirectionFull: string;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  tomorrow?: {
    day: string;
    temperature: number;
    icon: string;
    high: number;
    low: number;
  };
  forecast: Array<{
    day: string;
    date: string;
    icon: string;
    high: number;
    low: number;
    description: string;
  }>;
  lastUpdated: string;
}

interface ForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_max: number;
      temp_min: number;
      humidity: number;
    };
    weather: Array<{
      main: string;
      description: string;
      icon: string;
    }>;
    wind: {
      speed: number;
      deg: number;
    };
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
    sunrise: number;
    sunset: number;
  };
}

interface UVResponse {
  value: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
const FORECAST_CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours for forecast data

interface CachedWeatherData {
  data: WeatherData;
  timestamp: number;
}

const getWeatherEmoji = (iconCode: string, description: string): string => {
  const iconMap: Record<string, string> = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️'
  };
  
  return iconMap[iconCode] || '🌤️';
};

const getWindDirection = (degrees: number): string => {
  if (degrees >= 348.75 || degrees < 11.25) return 'N';
  if (degrees >= 11.25 && degrees < 33.75) return 'NNE';
  if (degrees >= 33.75 && degrees < 56.25) return 'NE';
  if (degrees >= 56.25 && degrees < 78.75) return 'ENE';
  if (degrees >= 78.75 && degrees < 101.25) return 'E';
  if (degrees >= 101.25 && degrees < 123.75) return 'ESE';
  if (degrees >= 123.75 && degrees < 146.25) return 'SE';
  if (degrees >= 146.25 && degrees < 168.75) return 'SSE';
  if (degrees >= 168.75 && degrees < 191.25) return 'S';
  if (degrees >= 191.25 && degrees < 213.75) return 'SSW';
  if (degrees >= 213.75 && degrees < 236.25) return 'SW';
  if (degrees >= 236.25 && degrees < 258.75) return 'WSW';
  if (degrees >= 258.75 && degrees < 281.25) return 'W';
  if (degrees >= 281.25 && degrees < 303.75) return 'WNW';
  if (degrees >= 303.75 && degrees < 326.25) return 'NW';
  if (degrees >= 326.25 && degrees < 348.75) return 'NNW';
  return 'N';
};

const getWindDirectionFull = (degrees: number): string => {
  if (degrees >= 348.75 || degrees < 11.25) return 'North';
  if (degrees >= 11.25 && degrees < 33.75) return 'North Northeast';
  if (degrees >= 33.75 && degrees < 56.25) return 'Northeast';
  if (degrees >= 56.25 && degrees < 78.75) return 'East Northeast';
  if (degrees >= 78.75 && degrees < 101.25) return 'East';
  if (degrees >= 101.25 && degrees < 123.75) return 'East Southeast';
  if (degrees >= 123.75 && degrees < 146.25) return 'Southeast';
  if (degrees >= 146.25 && degrees < 168.75) return 'South Southeast';
  if (degrees >= 168.75 && degrees < 191.25) return 'South';
  if (degrees >= 191.25 && degrees < 213.75) return 'South Southwest';
  if (degrees >= 213.75 && degrees < 236.25) return 'Southwest';
  if (degrees >= 236.25 && degrees < 258.75) return 'West Southwest';
  if (degrees >= 258.75 && degrees < 281.25) return 'West';
  if (degrees >= 281.25 && degrees < 303.75) return 'West Northwest';
  if (degrees >= 303.75 && degrees < 326.25) return 'Northwest';
  if (degrees >= 326.25 && degrees < 348.75) return 'North Northwest';
  return 'North';
};

const getLocationFromCountry = async (country: string): Promise<{ lat: number; lon: number } | null> => {
  const countryCoords: Record<string, { lat: number; lon: number }> = {
    'Qatar': { lat: 25.3548, lon: 51.1839 },
    'UAE': { lat: 23.4241, lon: 53.8478 },
    'United Arab Emirates': { lat: 23.4241, lon: 53.8478 },
    'Saudi Arabia': { lat: 23.8859, lon: 45.0792 },
    'Kuwait': { lat: 29.3117, lon: 47.4818 },
    'Bahrain': { lat: 26.0667, lon: 50.5577 },
    'Oman': { lat: 21.4735, lon: 55.9754 }
  };
  
  return countryCoords[country] || null;
};

const getApiKey = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-weather-api-key');
    if (error) {
      console.error('Error getting API key:', error);
      return null;
    }
    return data?.apiKey || null;
  } catch (error) {
    console.error('Error calling edge function:', error);
    return null;
  }
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

const getTomorrowData = (forecastList: ForecastResponse['list']) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Find the forecast entry closest to noon tomorrow
  const tomorrowEntries = forecastList.filter(entry => {
    const entryDate = new Date(entry.dt * 1000);
    return entryDate.toDateString() === tomorrow.toDateString();
  });
  
  if (tomorrowEntries.length === 0) return null;
  
  // Get the entry closest to noon, or first available
  const noonEntry = tomorrowEntries.find(entry => {
    const entryHour = new Date(entry.dt * 1000).getHours();
    return entryHour >= 11 && entryHour <= 13;
  }) || tomorrowEntries[0];
  
  // Calculate min/max for tomorrow from all entries
  const minTemp = Math.min(...tomorrowEntries.map(e => e.main.temp_min));
  const maxTemp = Math.max(...tomorrowEntries.map(e => e.main.temp_max));
  
  return {
    day: tomorrow.toLocaleDateString('en-US', { weekday: 'short' }),
    temperature: Math.round(noonEntry.main.temp),
    icon: getWeatherEmoji(noonEntry.weather[0].icon, noonEntry.weather[0].description),
    high: Math.round(maxTemp),
    low: Math.round(minTemp)
  };
};

const getFiveDayForecast = (forecastList: ForecastResponse['list']) => {
  const dailyData: Record<string, any> = {};
  
  // Group entries by date
  forecastList.forEach(entry => {
    const date = new Date(entry.dt * 1000);
    const dateKey = date.toDateString();
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        entries: [],
        temps: []
      };
    }
    
    dailyData[dateKey].entries.push(entry);
    dailyData[dateKey].temps.push(entry.main.temp);
  });
  
  // Convert to forecast array (skip today, get next 5 days)
  const today = new Date().toDateString();
  const forecast = Object.values(dailyData)
    .filter((day: any) => day.date !== today)
    .slice(0, 5)
    .map((day: any) => {
      const noonEntry = day.entries.find((entry: any) => {
        const hour = new Date(entry.dt * 1000).getHours();
        return hour >= 11 && hour <= 13;
      }) || day.entries[0];
      
      return {
        day: day.day,
        date: day.date,
        icon: getWeatherEmoji(noonEntry.weather[0].icon, noonEntry.weather[0].description),
        high: Math.round(Math.max(...day.temps)),
        low: Math.round(Math.min(...day.temps)),
        description: noonEntry.weather[0].description
      };
    });
  
  return forecast;
};

export const fetchWeatherData = async (country?: string): Promise<WeatherData | null> => {
  try {
    // Check cache first
    const cacheKey = `weather_forecast_${country || 'default'}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const parsedCache: CachedWeatherData = JSON.parse(cached);
      if (Date.now() - parsedCache.timestamp < CACHE_DURATION) {
        return parsedCache.data;
      }
    }

    // Get API key from Supabase secrets
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('Weather API key not available');
    }

    // Get coordinates from country
    let coords = country ? await getLocationFromCountry(country) : null;
    
    // Fallback to Doha, Qatar if no country or country not found
    if (!coords) {
      coords = { lat: 25.3548, lon: 51.1839 };
    }

    // Fetch 5-day forecast (includes current weather data)
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`
    );
    
    if (!forecastResponse.ok) {
      throw new Error('Weather Forecast API failed');
    }
    
    const forecastData: ForecastResponse = await forecastResponse.json();
    
    // Get current weather from first forecast entry
    const currentEntry = forecastData.list[0];
    
    // Fetch UV index separately (not available in forecast API)
    const uvResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/uvi?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}`
    );
    
    let uvIndex = 0;
    if (uvResponse.ok) {
      const uvData: UVResponse = await uvResponse.json();
      uvIndex = uvData.value;
    }

    // Get today's min/max from today's forecast entries
    const today = new Date().toDateString();
    const todayEntries = forecastData.list.filter(entry => {
      const entryDate = new Date(entry.dt * 1000);
      return entryDate.toDateString() === today;
    });
    
    const todayMin = todayEntries.length > 0 
      ? Math.min(...todayEntries.map(e => e.main.temp_min))
      : currentEntry.main.temp_min;
    const todayMax = todayEntries.length > 0 
      ? Math.max(...todayEntries.map(e => e.main.temp_max))
      : currentEntry.main.temp_max;

    // Get tomorrow's weather
    const tomorrowData = getTomorrowData(forecastData.list);
    
    // Get 5-day forecast
    const fiveDayForecast = getFiveDayForecast(forecastData.list);

    const processedData: WeatherData = {
      temperature: Math.round(currentEntry.main.temp),
      feelsLike: Math.round(currentEntry.main.feels_like),
      description: currentEntry.weather[0].description,
      icon: getWeatherEmoji(currentEntry.weather[0].icon, currentEntry.weather[0].description),
      high: Math.round(todayMax),
      low: Math.round(todayMin),
      humidity: currentEntry.main.humidity,
      windSpeed: Math.round(currentEntry.wind.speed * 3.6), // Convert m/s to km/h
      windDirection: getWindDirection(currentEntry.wind.deg || 0),
      windDirectionFull: getWindDirectionFull(currentEntry.wind.deg || 0),
      uvIndex: Math.round(uvIndex),
      sunrise: formatTime(forecastData.city.sunrise),
      sunset: formatTime(forecastData.city.sunset),
      tomorrow: tomorrowData,
      forecast: fiveDayForecast,
      lastUpdated: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    };

    // Cache the result
    const cacheData: CachedWeatherData = {
      data: processedData,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    return processedData;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

export const getUVIndexLabel = (uvIndex: number): string => {
  if (uvIndex <= 2) return 'Low';
  if (uvIndex <= 5) return 'Moderate';
  if (uvIndex <= 7) return 'High';
  if (uvIndex <= 10) return 'Very High';
  return 'Extreme';
};
