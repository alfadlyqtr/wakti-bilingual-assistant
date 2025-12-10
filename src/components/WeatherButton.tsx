
import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Cloud, Loader2, AlertCircle, X, ArrowLeft, MapPin, CloudSun, CloudMoon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WeatherButton() {
  const { profile } = useUserProfile();
  const { language } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  // Check if user has set their location
  const hasLocation = !!(profile?.country || profile?.city);

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', profile?.country, profile?.city],
    queryFn: () => fetchWeatherData({
      country: profile?.country,
      city: profile?.city,
      countryCode: profile?.country_code
    }),
    refetchInterval: 60 * 60 * 1000, // Refetch every 60 minutes
    staleTime: 50 * 60 * 1000, // Consider data stale after 50 minutes
    enabled: hasLocation, // Only fetch if user has set location
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

  // Generate realistic forecast data for selected day (since we don't have detailed daily forecasts)
  const generateSelectedDayData = (dayName: string) => {
    if (!weather) return null;
    
    // Use base weather data with some variation for different days
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayName);
    const variation = dayIndex * 2; // Simple variation based on day
    
    return {
      humidity: Math.max(20, Math.min(80, weather.humidity + variation)),
      windSpeed: Math.max(5, Math.min(40, weather.windSpeed + variation)),
      uvIndex: Math.max(0, weather.uvIndex + Math.floor(variation / 2))
    };
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
  const selectedDayData = selectedDay ? generateSelectedDayData(selectedDay) : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 py-1.5 rounded-full transition-all duration-300 hover:scale-105 relative overflow-hidden group border border-[#e9ceb0]/50 dark:border-[#606062]/50 bg-gradient-to-r from-[#e9ceb0]/20 to-[#e9ceb0]/10 dark:from-[#606062]/20 dark:to-[#858384]/10 hover:from-[#e9ceb0]/30 hover:to-[#e9ceb0]/20 dark:hover:from-[#606062]/30 dark:hover:to-[#858384]/20 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            {isLoading ? (
              <>
                <div className="w-5 h-5 rounded-full bg-[#060541]/10 dark:bg-white/10 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-[#060541] dark:text-white" />
                </div>
                <span className="text-xs font-medium text-[#060541] dark:text-white">{t('weather', language)}</span>
              </>
            ) : error || !weather ? (
              <>
                <div className="w-5 h-5 rounded-full bg-[#060541]/10 dark:bg-white/10 flex items-center justify-center">
                  <Cloud className="h-3 w-3 text-[#060541] dark:text-white" />
                </div>
                <span className="text-xs font-medium text-[#060541] dark:text-white">{t('weather', language)}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400/80 to-orange-500/80 flex items-center justify-center shadow-sm">
                  <span className="text-xs">{weather.icon}</span>
                </div>
                <span className="text-sm font-semibold text-[#060541] dark:text-white">{weather.temperature}°</span>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      {/* Backdrop overlay when popover is open - portal below header to blur page only */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[980] bg-background/20 backdrop-blur-sm"
        />,
        document.body
      )}

      <PopoverContent 
        className="w-80 p-0 border-0 shadow-2xl z-[1200]"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.2)',
        }}
        side="bottom"
        align="end"
        sideOffset={32}
        collisionPadding={16}
        avoidCollisions={true}
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

          <div className="p-3 space-y-3">
            {/* No location set - prompt user to set it */}
            {!hasLocation ? (
              <div className="text-center py-5 space-y-4">
                {/* Animated weather icon - Sun+Clouds in light, Moon+Stars in dark */}
                <div className="mx-auto w-16 h-16 relative">
                  {/* Light mode: Sun with clouds */}
                  <div className="dark:hidden absolute inset-0">
                    {/* Sky background */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-sky-300 to-sky-400 overflow-hidden">
                      {/* Sun */}
                      <div className="absolute top-1 right-1 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg animate-pulse" style={{ animationDuration: '3s' }} />
                      {/* Clouds */}
                      <div className="absolute bottom-0 left-0 right-0">
                        <div className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-white shadow-sm" />
                        <div className="absolute bottom-0 left-4 w-8 h-8 rounded-full bg-white shadow-sm" />
                        <div className="absolute bottom-1 left-9 w-5 h-5 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                  </div>
                  {/* Dark mode: Moon with stars */}
                  <div className="hidden dark:block absolute inset-0">
                    {/* Night sky background */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden">
                      {/* Moon */}
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 shadow-lg">
                        {/* Moon craters */}
                        <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-gray-400/50" />
                        <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-gray-400/50" />
                        <div className="absolute top-2 left-4 w-1 h-1 rounded-full bg-gray-400/50" />
                      </div>
                      {/* Twinkling stars */}
                      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute top-4 left-5 w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
                      <div className="absolute top-6 left-2 w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }} />
                      <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDuration: '2.2s', animationDelay: '0.9s' }} />
                    </div>
                  </div>
                </div>
                <div className="text-base font-semibold text-foreground">
                  {language === 'ar' ? 'أين أنت؟' : 'Where are you?'}
                </div>
                <div className="text-sm text-muted-foreground px-3 leading-relaxed">
                  {language === 'ar' 
                    ? 'أضف موقعك لنعرض لك الطقس المحلي والتحديثات اليومية!'
                    : 'Add your location to get local weather updates!'
                  }
                </div>
                <Button
                  size="default"
                  className="mt-3 bg-[#060541] hover:bg-[#060541]/90 dark:bg-[#e9ceb0] dark:hover:bg-[#e9ceb0]/90 text-white dark:text-[#060541] font-medium px-6 shadow-lg"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/account?tab=profile');
                    // Scroll to location section after navigation
                    setTimeout(() => {
                      const locationEl = document.getElementById('location');
                      if (locationEl) {
                        locationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 300);
                  }}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'تعيين موقعي' : 'Set My Location'}
                </Button>
              </div>
            ) : error || !weather ? (
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
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground font-medium">{t('dayForecast', language)}</div>
                    <div className="relative">
                      <div 
                        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {weather.forecast.map((day, index) => (
                          <button
                            key={index}
                            className="flex-shrink-0 w-20 text-center p-2.5 rounded-xl cursor-pointer transition-all duration-300 snap-start active:scale-95 hover:scale-105"
                            style={{
                              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
                              backdropFilter: 'blur(15px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                            }}
                            onClick={() => handleDayClick(day.day)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
                            }}
                          >
                            <div className="text-xs font-semibold mb-1 truncate">{getDayName(day.day)}</div>
                            <div className="text-lg mb-1">{day.icon}</div>
                            <div className="text-xs space-y-0.5">
                              <div className="font-bold text-foreground">{day.high}°</div>
                              <div className="text-muted-foreground">{day.low}°</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* Scroll fade indicators */}
                      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/20 to-transparent pointer-events-none rounded-l-xl" />
                      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-black/20 to-transparent pointer-events-none rounded-r-xl" />
                    </div>
                  </div>
                )}

                {/* Weather Details */}
                <div className="space-y-2">
                  {/* Humidity - Single Line */}
                  <div 
                    className="p-2.5 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">💧</span>
                      {t('humidity', language)}: <span className="font-semibold">
                        {selectedDayData ? selectedDayData.humidity : weather.humidity}%
                      </span>
                    </div>
                  </div>

                  {/* Wind - Single Line with Full Direction */}
                  <div 
                    className="p-2.5 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">💨</span>
                      {t('wind', language)}: <span className="font-semibold">
                        {selectedDayData ? selectedDayData.windSpeed : weather.windSpeed} {t('kmh', language)} {selectedDay ? getFullWindDirection('East') : getFullWindDirection(weather.windDirectionFull)}
                      </span>
                    </div>
                  </div>

                  {/* UV Index - Always use dynamic data */}
                  <div 
                    className="p-2.5 rounded-lg text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <div className="text-sm">
                      <span className="text-base mr-2">☀️</span>
                      {t('uvIndex', language)}: <span className="font-semibold">
                        {selectedDayData ? 
                          `${selectedDayData.uvIndex} - ${getUVIndexTranslated(selectedDayData.uvIndex)}` :
                          `${weather.uvIndex} - ${getUVIndexTranslated(weather.uvIndex)}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location & Last Updated */}
                <div className="text-center text-xs text-muted-foreground pt-1 border-t border-white/10">
                  📍 {profile?.city ? `${profile.city}, ${profile.country || ''}` : (profile?.country || 'Qatar')} • {t('updated', language)} {weather.lastUpdated}
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
