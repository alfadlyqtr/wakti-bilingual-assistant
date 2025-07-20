
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
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
      'Sun': 'Sunday',
      'Mon': 'Monday', 
      'Tue': 'Tuesday',
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday'
    };
    return dayMap[dayShort] || dayShort;
  };

  const getShortWindDirection = (fullDirection: string): string => {
    const directionMap: Record<string, string> = {
      'North': 'N',
      'North Northeast': 'NNE',
      'Northeast': 'NE',
      'East Northeast': 'ENE',
      'East': 'E',
      'East Southeast': 'ESE',
      'Southeast': 'SE',
      'South Southeast': 'SSE',
      'South': 'S',
      'South Southwest': 'SSW',
      'Southwest': 'SW',
      'West Southwest': 'WSW',
      'West': 'W',
      'West Northwest': 'WNW',
      'Northwest': 'NW',
      'North Northwest': 'NNW'
    };
    return directionMap[fullDirection] || 'N';
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
                <span className="text-xs font-medium">Weather</span>
              </>
            ) : error || !weather ? (
              <>
                <AlertCircle className="h-3 w-3" />
                <span className="text-xs font-medium">Weather</span>
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
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 z-20 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>

          {/* Back Button (only shown when viewing a specific day) */}
          {selectedDay && (
            <button
              onClick={handleBackToCurrent}
              className="absolute top-2 left-2 z-20 p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          <div className="p-3 space-y-2">
            {error || !weather ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <div className="text-sm font-medium mb-1">
                  {language === 'ar' ? 'لا يمكن تحميل بيانات الطقس' : 'Unable to load weather data'}
                </div>
                {error && (
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'حاول مرة أخرى لاحقاً' : 'Please try again later'}
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
                      <div className="text-sm capitalize">{selectedDayWeather.description}</div>
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
                      <div className="text-sm capitalize">{weather.description}</div>
                      <div className="text-xs text-muted-foreground">
                        L {weather.low}°C - H {weather.high}°C • Feels like {weather.feelsLike}°C
                      </div>
                    </>
                  )}
                </div>

                {/* 5-Day Forecast - Only show when viewing current weather */}
                {!selectedDay && weather.forecast && weather.forecast.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">5-Day Forecast</div>
                    <div className="flex gap-1 overflow-x-auto">
                      {weather.forecast.map((day, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 text-center p-1.5 rounded-lg min-w-[50px] cursor-pointer hover:bg-white/10 transition-colors"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                          onClick={() => handleDayClick(day.day)}
                        >
                          <div className="text-xs mb-1">{getDayName(day.day)}</div>
                          <div className="text-base mb-1">{day.icon}</div>
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
                      Humidity: <span className="font-semibold">{selectedDay ? '65' : weather.humidity}%</span>
                    </div>
                  </div>

                  {/* Wind - Single Line with Short Direction */}
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
                      Wind: <span className="font-semibold">
                        {selectedDay ? '25' : weather.windSpeed} km/h {selectedDay ? 'E' : getShortWindDirection(weather.windDirectionFull)}
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
                      UV Index: <span className="font-semibold">
                        {selectedDay ? '8 - Very High' : `${weather.uvIndex} - ${getUVIndexLabel(weather.uvIndex)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location & Last Updated */}
                <div className="text-center text-xs text-muted-foreground pt-1 border-t border-white/10">
                  📍 {profile?.country || 'Qatar'} • Updated {weather.lastUpdated}
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
