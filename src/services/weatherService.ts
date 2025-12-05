
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
const CACHE_VERSION = '1.3'; // Increment to invalidate old cache

// Location input type for weather fetching
export interface WeatherLocation {
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

interface CachedWeatherData {
  data: WeatherData;
  timestamp: number;
  version: string;
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

// Fallback country coordinates for when geocoding fails
const FALLBACK_COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Qatar': { lat: 25.3548, lon: 51.1839 },
  'UAE': { lat: 23.4241, lon: 53.8478 },
  'United Arab Emirates': { lat: 23.4241, lon: 53.8478 },
  'Saudi Arabia': { lat: 23.8859, lon: 45.0792 },
  'Kuwait': { lat: 29.3117, lon: 47.4818 },
  'Bahrain': { lat: 26.0667, lon: 50.5577 },
  'Oman': { lat: 21.4735, lon: 55.9754 }
};

const getLocationFromCountry = (country: string): { lat: number; lon: number } | null => {
  return FALLBACK_COUNTRY_COORDS[country] || null;
};

/**
 * Geocode a city + country using OpenWeather Geocoding API
 * Returns lat/lon for any location worldwide
 */
const geocodeLocation = async (
  city?: string | null,
  country?: string | null,
  countryCode?: string | null,
  apiKey?: string | null
): Promise<{ lat: number; lon: number } | null> => {
  if (!apiKey) return null;
  if (!city && !country) return null;

  try {
    // Build query: "City,CountryCode" or "City,Country" or just "Country"
    const parts: string[] = [];
    if (city?.trim()) parts.push(city.trim());
    if (countryCode?.trim()) parts.push(countryCode.trim());
    else if (country?.trim()) parts.push(country.trim());

    const q = encodeURIComponent(parts.join(','));
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${q}&limit=1&appid=${apiKey}`;
    
    console.log('🌍 Geocoding location:', parts.join(', '));
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('🌍 Geocoding API failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('🌍 Geocoding returned no results for:', parts.join(', '));
      return null;
    }

    const result = { lat: data[0].lat, lon: data[0].lon };
    console.log('🌍 Geocoded successfully:', data[0].name, data[0].country, '->', result);
    return result;
  } catch (error) {
    console.error('🌍 Geocoding error:', error);
    return null;
  }
};

const getApiKey = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-weather-api-key');
    if (error) {
      console.error('❌ Error getting API key:', error);
      return null;
    }
    const apiKey = data?.apiKey || null;
    console.log('🔑 Weather API key retrieved:', apiKey ? 'SUCCESS' : 'FAILED');
    return apiKey;
  } catch (error) {
    console.error('❌ Error calling edge function:', error);
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

// Calculate UV index based on solar position, time of day, and weather conditions
const calculateFallbackUVIndex = (
  lat: number,
  weatherCondition: string,
  cloudCover: number = 0
): number => {
  const now = new Date();
  const hour = now.getHours();
  
  // UV is highest between 10 AM and 4 PM
  if (hour < 6 || hour > 18) return 0;
  
  // Base UV calculation based on time and latitude
  let baseUV = 0;
  if (hour >= 10 && hour <= 14) {
    // Peak hours - higher UV
    baseUV = Math.abs(lat) < 30 ? 8 : 6; // Higher UV closer to equator
  } else if (hour >= 8 && hour <= 16) {
    // Moderate hours
    baseUV = Math.abs(lat) < 30 ? 5 : 3;
  } else {
    // Early morning/late afternoon
    baseUV = Math.abs(lat) < 30 ? 2 : 1;
  }
  
  // Adjust for weather conditions
  const condition = weatherCondition.toLowerCase();
  if (condition.includes('cloud') || condition.includes('overcast')) {
    baseUV *= 0.6; // Clouds reduce UV by ~40%
  } else if (condition.includes('rain') || condition.includes('storm')) {
    baseUV *= 0.3; // Rain/storms reduce UV significantly
  }
  
  // Adjust for cloud cover if available
  if (cloudCover > 0) {
    baseUV *= (1 - cloudCover / 100 * 0.6);
  }
  
  return Math.floor(Math.max(0, Math.min(15, baseUV)));
};

// Validate UV index values
const validateUVIndex = (uvIndex: number): boolean => {
  return typeof uvIndex === 'number' && 
         !isNaN(uvIndex) && 
         uvIndex >= 0 && 
         uvIndex <= 15;
};

// Enhanced UV index fetching with retry logic and detailed logging
const fetchUVIndex = async (
  lat: number, 
  lon: number, 
  apiKey: string,
  weatherCondition: string,
  maxRetries: number = 2
): Promise<number> => {
  console.log('🌞 Starting UV Index fetch for coordinates:', { lat, lon });
  console.log('🌞 Weather condition for UV context:', weatherCondition);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      console.log(`🌞 UV API attempt ${attempt} URL:`, uvUrl);
      
      const uvResponse = await fetch(uvUrl);
      const responseStatus = uvResponse.status;
      console.log(`🌞 UV API attempt ${attempt} - Status: ${responseStatus}`);
      
      if (uvResponse.ok) {
        const uvData: UVResponse = await uvResponse.json();
        console.log('🌞 Raw UV API response:', JSON.stringify(uvData, null, 2));
        
        if (validateUVIndex(uvData.value)) {
          const rawUVValue = uvData.value;
          // Use Math.floor instead of Math.round to match OpenWeather website behavior
          const flooredUV = Math.floor(rawUVValue);
          console.log('🌞 UV Index processing:', {
            rawValue: rawUVValue,
            flooredValue: flooredUV,
            wouldRoundTo: Math.round(rawUVValue)
          });
          console.log('✅ Valid UV index received from API:', flooredUV);
          return flooredUV;
        } else {
          console.warn('⚠️ Invalid UV index from API:', uvData.value, 'Raw response:', uvData);
        }
      } else {
        const errorText = await uvResponse.text();
        console.error(`❌ UV API failed with status ${responseStatus} on attempt ${attempt}:`, errorText);
      }
    } catch (error) {
      console.error(`❌ UV API network error on attempt ${attempt}:`, error);
    }
  }
  
  // Fallback calculation with clear warning
  const fallbackUV = calculateFallbackUVIndex(lat, weatherCondition);
  console.warn('⚠️ UV API failed - using FALLBACK calculation:', {
    fallbackValue: fallbackUV,
    reason: 'API_FAILED',
    weatherCondition: weatherCondition,
    coordinates: { lat, lon }
  });
  return fallbackUV;
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

export const fetchWeatherData = async (location?: WeatherLocation | string): Promise<WeatherData | null> => {
  try {
    // Handle both old string format and new object format for backwards compatibility
    const loc: WeatherLocation = typeof location === 'string' 
      ? { country: location } 
      : (location || {});
    
    const city = loc.city?.trim() || undefined;
    const country = loc.country?.trim() || undefined;
    const countryCode = loc.countryCode?.trim() || undefined;
    
    console.log('🌤️ Starting weather data fetch for:', { city, country, countryCode });
    
    // Check cache first with version validation
    // Cache key includes both city and country for uniqueness
    const cacheKey = `weather_forecast_${city || ''}_${country || 'default'}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache: CachedWeatherData = JSON.parse(cached);
        const isCacheValid = parsedCache.version === CACHE_VERSION &&
                           Date.now() - parsedCache.timestamp < CACHE_DURATION;
        
        if (isCacheValid) {
          console.log('🌤️ Using valid cached weather data');
          return parsedCache.data;
        } else {
          console.log('🌤️ Cache expired or version mismatch, clearing cache');
          localStorage.removeItem(cacheKey);
        }
      } catch (cacheError) {
        console.warn('🌤️ Cache parse error, clearing cache:', cacheError);
        localStorage.removeItem(cacheKey);
      }
    }

    // Get API key from Supabase secrets
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('🌤️ Weather API key not available');
      throw new Error('Weather API key not available');
    }

    // Get coordinates: try geocoding city+country first, then fallback to country map, then default
    let coords: { lat: number; lon: number } | null = null;
    
    // 1) Try geocoding with city + country (works for any location worldwide)
    if (city || country) {
      coords = await geocodeLocation(city, country, countryCode, apiKey);
    }
    
    // 2) If geocoding failed but we have a country, try the fallback country map
    if (!coords && country) {
      coords = getLocationFromCountry(country);
      if (coords) {
        console.log('🌤️ Using fallback country coordinates for:', country);
      }
    }
    
    // 3) Final fallback to Doha, Qatar
    if (!coords) {
      console.log('🌤️ Using default coordinates (Doha, Qatar)');
      coords = { lat: 25.3548, lon: 51.1839 };
    }

    console.log('🌤️ Using coordinates:', coords);

    // Fetch 5-day forecast (includes current weather data)
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`
    );
    
    if (!forecastResponse.ok) {
      console.error('🌤️ Weather Forecast API failed with status:', forecastResponse.status);
      throw new Error('Weather Forecast API failed');
    }
    
    const forecastData: ForecastResponse = await forecastResponse.json();
    console.log('🌤️ Forecast API success, entries:', forecastData.list.length);
    
    // Get current weather from first forecast entry
    const currentEntry = forecastData.list[0];
    console.log('🌤️ Current weather condition:', currentEntry.weather[0].description);
    
    // Fetch UV index with enhanced error handling and fallback
    const uvIndex = await fetchUVIndex(
      coords.lat, 
      coords.lon, 
      apiKey, 
      currentEntry.weather[0].description
    );

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
      uvIndex: uvIndex,
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

    console.log('✅ Final processed weather data:', {
      temperature: processedData.temperature,
      uvIndex: processedData.uvIndex,
      description: processedData.description,
      uvSource: uvIndex === calculateFallbackUVIndex(coords.lat, currentEntry.weather[0].description) ? 'FALLBACK' : 'API'
    });

    // Cache the result with version
    const cacheData: CachedWeatherData = {
      data: processedData,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    return processedData;
  } catch (error) {
    console.error('🌤️ Error fetching weather data:', error);
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
