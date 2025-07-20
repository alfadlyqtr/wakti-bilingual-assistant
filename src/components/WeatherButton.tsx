
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { Cloud, Loader2, AlertCircle, X } from 'lucide-react';

export function WeatherButton() {
  const { profile } = useUserProfile();
  const { language } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showTomorrowDetails, setShowTomorrowDetails] = React.useState(false);

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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Weather</span>
              </>
            ) : error || !weather ? (
              <>
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Weather</span>
              </>
            ) : (
              <>
                <span className="text-lg">{weather.icon}</span>
                <span className="text-sm font-semibold">{weather.temperature}°C</span>
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
                {/* Current Weather - Compact Hero */}
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">{weather.icon}</span>
                    <div className="text-xl font-bold">{weather.temperature}°C</div>
                  </div>
                  <div className="text-sm capitalize">{weather.description}</div>
                  <div className="text-xs text-muted-foreground">
                    L {weather.low}°C - H {weather.high}°C • Feels like {weather.feelsLike}°C
                  </div>
                </div>

                {/* 5-Day Forecast with Full Day Names */}
                {weather.forecast && weather.forecast.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">5-Day Forecast</div>
                    <div className="flex gap-1 overflow-x-auto">
                      {weather.forecast.map((day, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 text-center p-1.5 rounded-lg min-w-[50px]"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
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

                {/* Weather Details Compact Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div 
                    className="p-2 rounded-lg text-center space-y-1"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-base">💧</div>
                    <div className="text-xs text-muted-foreground">Humidity</div>
                    <div className="text-sm font-semibold">{weather.humidity}%</div>
                  </div>

                  <div 
                    className="p-2 rounded-lg text-center space-y-1"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-base">💨</div>
                    <div className="text-xs text-muted-foreground">Wind</div>
                    <div className="text-sm font-semibold">{weather.windSpeed} km/h</div>
                    <div className="text-xs text-muted-foreground">{weather.windDirectionFull}</div>
                  </div>

                  <div 
                    className="p-2 rounded-lg text-center space-y-1"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-base">🌅</div>
                    <div className="text-xs text-muted-foreground">Sunrise</div>
                    <div className="text-sm font-semibold">{weather.sunrise}</div>
                  </div>

                  <div 
                    className="p-2 rounded-lg text-center space-y-1"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-base">🌇</div>
                    <div className="text-xs text-muted-foreground">Sunset</div>
                    <div className="text-sm font-semibold">{weather.sunset}</div>
                  </div>
                </div>

                {/* UV Index - Single Line */}
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
                    UV Index: <span className="font-semibold">{weather.uvIndex} - {getUVIndexLabel(weather.uvIndex)}</span>
                  </div>
                </div>

                {/* Tomorrow - Clickable Section */}
                {weather.tomorrow && (
                  <div 
                    className="p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                    onClick={() => setShowTomorrowDetails(!showTomorrowDetails)}
                  >
                    <div className="text-sm text-center">
                      Tomorrow - {getDayName(weather.tomorrow.day)} ➜ <span className="text-base">{weather.tomorrow.icon}</span> L {weather.tomorrow.low}°C - H {weather.tomorrow.high}°C
                    </div>
                    
                    {showTomorrowDetails && (
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>💧 Humidity: {weather.humidity}%</div>
                          <div>💨 Wind: {weather.windSpeed} km/h {weather.windDirectionFull}</div>
                          <div>🌅 Sunrise: {weather.sunrise}</div>
                          <div>🌇 Sunset: {weather.sunset}</div>
                        </div>
                        <div className="text-xs text-center">
                          ☀️ UV Index: {weather.uvIndex} - {getUVIndexLabel(weather.uvIndex)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Location & Last Updated - Single Line */}
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
