
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
  uvIndex: number;
}

interface WeatherResponse {
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
  };
}

interface UVResponse {
  value: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

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

export const fetchWeatherData = async (country?: string): Promise<WeatherData | null> => {
  try {
    // Check cache first
    const cacheKey = `weather_${country || 'default'}`;
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

    // Fetch current weather
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`
    );
    
    if (!weatherResponse.ok) {
      throw new Error('Weather API failed');
    }
    
    const weatherData: WeatherResponse = await weatherResponse.json();
    
    // Fetch UV index
    const uvResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/uvi?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}`
    );
    
    let uvIndex = 0;
    if (uvResponse.ok) {
      const uvData: UVResponse = await uvResponse.json();
      uvIndex = uvData.value;
    }

    const processedData: WeatherData = {
      temperature: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      description: weatherData.weather[0].description,
      icon: getWeatherEmoji(weatherData.weather[0].icon, weatherData.weather[0].description),
      high: Math.round(weatherData.main.temp_max),
      low: Math.round(weatherData.main.temp_min),
      humidity: weatherData.main.humidity,
      windSpeed: Math.round(weatherData.wind.speed * 3.6), // Convert m/s to km/h
      uvIndex: Math.round(uvIndex)
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
