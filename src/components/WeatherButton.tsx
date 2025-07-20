
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { Cloud, Loader2, AlertCircle, ArrowRight, X } from 'lucide-react';

export function WeatherButton() {
  const { profile } = useUserProfile();
  const { language } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', profile?.country],
    queryFn: () => fetchWeatherData(profile?.country || undefined),
    refetchInterval: 60 * 60 * 1000, // Refetch every 60 minutes
    staleTime: 50 * 60 * 1000, // Consider data stale after 50 minutes
  });

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
          <div className="relative z-10 flex flex-col items-center gap-1">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Weather</span>
              </div>
            ) : error || !weather ? (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Weather</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{weather.icon}</span>
                  <span className="text-sm font-semibold">{weather.temperature}°C</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>📍 {profile?.country || 'Qatar'} • Updated {weather.lastUpdated}</span>
                </div>
                {weather.tomorrow && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>Tomorrow ➜ {weather.tomorrow.icon} L {weather.tomorrow.low}°C - H {weather.tomorrow.high}°C</span>
                  </div>
                )}
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0 border-0 shadow-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-20 p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="p-6 space-y-6">
            {error || !weather ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <div className="text-lg font-medium mb-2">
                  {language === 'ar' ? 'لا يمكن تحميل بيانات الطقس' : 'Unable to load weather data'}
                </div>
                {error && (
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'حاول مرة أخرى لاحقاً' : 'Please try again later'}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Current Weather - Hero Section */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-5xl">{weather.icon}</span>
                    <div>
                      <div className="text-4xl font-bold">{weather.temperature}°C</div>
                      <div className="text-sm text-muted-foreground">
                        feels like {weather.feelsLike}°C
                      </div>
                    </div>
                  </div>
                  <div className="text-xl font-medium capitalize mb-2">
                    {weather.description}
                  </div>
                  <div 
                    className="inline-block px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    L {weather.low}°C - H {weather.high}°C
                  </div>
                </div>

                {/* Sun Times */}
                <div 
                  className="flex items-center justify-between p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌅</span>
                    <div>
                      <div className="text-sm text-muted-foreground">Sunrise</div>
                      <div className="font-semibold">{weather.sunrise}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌇</span>
                    <div>
                      <div className="text-sm text-muted-foreground">Sunset</div>
                      <div className="font-semibold">{weather.sunset}</div>
                    </div>
                  </div>
                </div>

                {/* 5-Day Forecast */}
                {weather.forecast && weather.forecast.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">5-Day Forecast</div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {weather.forecast.map((day, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 text-center p-3 rounded-xl min-w-[80px]"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div className="text-xs font-medium mb-2">{day.day}</div>
                          <div className="text-2xl mb-2">{day.icon}</div>
                          <div className="text-xs space-y-1">
                            <div className="font-semibold">{day.high}°</div>
                            <div className="text-muted-foreground">{day.low}°</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weather Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    className="p-4 rounded-xl text-center space-y-2"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-2xl">💧</div>
                    <div className="text-xs text-muted-foreground">Humidity</div>
                    <div className="text-lg font-semibold">{weather.humidity}%</div>
                  </div>

                  <div 
                    className="p-4 rounded-xl text-center space-y-2"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-2xl">💨</div>
                    <div className="text-xs text-muted-foreground">Wind</div>
                    <div className="text-lg font-semibold">{weather.windSpeed} km/h</div>
                    <div className="text-xs text-muted-foreground lowercase">{weather.windDirectionFull}</div>
                  </div>

                  <div 
                    className="p-4 rounded-xl text-center space-y-2"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-2xl">☀️</div>
                    <div className="text-xs text-muted-foreground">UV Index</div>
                    <div className="text-lg font-semibold">{weather.uvIndex}</div>
                    <div className="text-xs text-muted-foreground">{getUVIndexLabel(weather.uvIndex)}</div>
                  </div>

                  <div 
                    className="p-4 rounded-xl text-center space-y-2"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div className="text-2xl">🕒</div>
                    <div className="text-xs text-muted-foreground">Last Updated</div>
                    <div className="text-sm font-semibold">{weather.lastUpdated}</div>
                  </div>
                </div>

                {/* Location */}
                {profile?.country && (
                  <div className="text-center text-xs text-muted-foreground pt-2 border-t border-white/10">
                    📍 {profile.country}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
