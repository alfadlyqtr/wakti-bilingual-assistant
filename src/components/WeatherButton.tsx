
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Cloud, Loader2, AlertCircle, X, ArrowLeft } from 'lucide-react';

export function WeatherButton() {
  const { profile } = useUserProfile();
  const { language } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', profile?.country],
    queryFn: () => fetchWeatherData(profile?.country || undefined),
    refetchInterval: 60 * 60 * 1000, // Refetch every 60 minutes
    staleTime: 50 * 60 * 1000, // Consider data stale after 50 minutes
  });

  const getDayName = (dayShort: string) => {
    const dayMap: Record<string, string> = {
      'Sun': t('sunday', language),
      'Mon': t('monday', language), 
      'Tue': t('tuesday', language),
      'Wed': t('wednesday', language),
      'Thu': t('thursday', language),
      'Fri': t('friday', language),
      'Sat': t('saturday', language)
    };
    return dayMap[dayShort] || dayShort;
  };

  const getFullWindDirection = (fullDirection: string): string => {
    const directionMap: Record<string, string> = {
      'North': t('north', language),
      'North Northeast': t('northNortheast', language),
      'Northeast': t('northeast', language),
      'East Northeast': t('eastNortheast', language),
      'East': t('east', language),
      'East Southeast': t('eastSoutheast', language),
      'Southeast': t('southeast', language),
      'South Southeast': t('southSoutheast', language),
      'South': t('south', language),
      'South Southwest': t('southSouthwest', language),
      'Southwest': t('southwest', language),
      'West Southwest': t('westSouthwest', language),
      'West': t('west', language),
      'West Northwest': t('westNorthwest', language),
      'Northwest': t('northwest', language),
      'North Northwest': t('northNorthwest', language)
    };
    return directionMap[fullDirection] || fullDirection;
  };

  const translateWeatherDescription = (description: string): string => {
    const descriptionMap: Record<string, string> = {
      'clear sky': t('clearSky', language),
      'few clouds': t('fewClouds', language),
      'scattered clouds': t('scatteredClouds', language),
      'broken clouds': t('brokenClouds', language),
      'overcast clouds': t('overcastClouds', language),
      'light rain': t('lightRain', language),
      'moderate rain': t('moderateRain', language),
      'heavy rain': t('heavyRain', language),
      'thunderstorm': t('thunderstorm', language),
      'snow': t('snow', language),
      'mist': t('mist', language),
      'fog': t('fog', language),
      'sunny': t('sunny', language),
      'cloudy': t('cloudy', language),
      'partly cloudy': t('partlyCloudy', language)
    };
    return descriptionMap[description.toLowerCase()] || description;
  };

  const getUVIndexTranslated = (uvIndex: number): string => {
    const label = getUVIndexLabel(uvIndex);
    const uvMap: Record<string, string> = {
      'Low': t('uvLow', language),
      'Moderate': t('uvModerate', language),
      'High': t('uvHigh', language),
      'Very High': t('uvVeryHigh', language),
      'Extreme': t('uvExtreme', language)
    };
    return uvMap[label] || label;
  };

  // Get selected day's weather data
  const getSelectedDayWeather = () => {
    if (!weather || !selectedDay) return null;
    return weather.forecast.find(day => day.day === selectedDay);
  };

  const handleDayClick = (dayName: string) => {
    setSelectedDay(dayName);
  };

  const handleBackToCurrent = () => {
    setSelectedDay(null);
  };

  const selectedDayWeather = getSelectedDayWeather();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 py-1 rounded-xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex items-center gap-1.5">
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs font-medium">{t('weather', language)}</span>
              </>
            ) : error || !weather ? (
              <>
                <AlertCircle className="h-3 w-3" />
                <span className="text-xs font-medium">{t('weather', language)}</span>
              </>
            ) : (
              <>
                <span className="text-sm">{weather.icon}</span>
                <span className="text-xs font-semibold">{weather.temperature}°C</span>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-0 border-0 shadow-2xl"
        strategy="fixed"
        sideOffset={8}
        avoidCollisions={true}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className={`relative ${language === 'ar' ? 'rtl' : 'ltr'}`}>
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className={`absolute top-2 z-20 p-1 rounded-full hover:bg-white/10 transition-colors ${language === 'ar' ? 'left-2' : 'right-2'}`}
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>

          {/* Back Button (only shown when viewing a specific day) */}
          {selectedDay && (
            <button
              onClick={handleBackToCurrent}
              className={`absolute top-2 z-20 p-1 rounded-full hover:bg-white/10 transition-colors ${language === 'ar' ? 'right-2' : 'left-2'}`}
            >
              <ArrowLeft className={`h-3 w-3 text-muted-foreground ${language === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          )}

          <div className="p-3 space-y-2">
            {error || !weather ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <div className="text-sm font-medium mb-1">
                  {t('weatherLoadError', language)}
                </div>
                {error && (
                  <div className="text-xs text-muted-foreground">
                    {t('tryAgainLater', language)}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Current or Selected Day Weather Header */}
                <div className="text-center space-y-1">
                  {selectedDay && selectedDayWeather ? (
                    <>
                      <div className="text-xs text-muted-foreground mb-1">
                        {getDayName(selectedDay)}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">{selectedDayWeather.icon}</span>
                        <div className="text-xl font-bold">{selectedDayWeather.high}°C</div>
                      </div>
                      <div className="text-sm capitalize">{translateWeatherDescription(selectedDayWeather.description)}</div>
                      <div className="text-xs text-muted-foreground">
                        L {selectedDayWeather.low}°C - H {selectedDayWeather.high}°C
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">{weather.icon}</span>
                        <div className="text-xl font-bold">{weather.temperature}°C</div>
                      </div>
                      <div className="text-sm capitalize">{translateWeatherDescription(weather.description)}</div>
                      <div className="text-xs text-muted-foreground">
                        L {weather.low}°C - H {weather.high}°C • {t('feelsLike', language)} {weather.feelsLike}°C
                      </div>
                    </>
                  )}
                </div>

                {/* 5-Day Forecast - Only show when viewing current weather */}
                {!selectedDay && weather.forecast && weather.forecast.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">{t('dayForecast', language)}</div>
                    <div className="flex gap-0.5 overflow-x-auto scrollbar-hide scroll-smooth">
                      {weather.forecast.map((day, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 w-12 text-center p-1 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                          onClick={() => handleDayClick(day.day)}
                        >
                          <div className="text-xs mb-1 truncate">{getDayName(day.day).slice(0, 3)}</div>
                          <div className="text-sm mb-1">{day.icon}</div>
                          <div className="text-xs space-y-0.5">
                            <div className="font-medium">{day.high}°</div>
                            <div className="text-muted-foreground">{day.low}°</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weather Details */}
                <div className="space-y-2">
                  {/* Humidity - Single Line */}
                  <div 
                    className="p-2 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">💧</span>
                      {t('humidity', language)}: <span className="font-semibold">{selectedDay ? '65' : weather.humidity}%</span>
                    </div>
                  </div>

                  {/* Wind - Single Line with Full Direction */}
                  <div 
                    className="p-2 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">💨</span>
                      {t('wind', language)}: <span className="font-semibold">
                        {selectedDay ? '25' : weather.windSpeed} {t('kmh', language)} {selectedDay ? t('east', language) : getFullWindDirection(weather.windDirectionFull)}
                      </span>
                    </div>
                  </div>

                  {/* UV Index */}
                  <div 
                    className="p-2 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">☀️</span>
                      {t('uvIndex', language)}: <span className="font-semibold">
                        {selectedDay ? `8 - ${t('uvVeryHigh', language)}` : `${weather.uvIndex} - ${getUVIndexTranslated(weather.uvIndex)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location & Last Updated */}
                <div className="text-center text-xs text-muted-foreground pt-1 border-t border-white/10">
                  📍 {profile?.country || 'Qatar'} • {t('updated', language)} {weather.lastUpdated}
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
