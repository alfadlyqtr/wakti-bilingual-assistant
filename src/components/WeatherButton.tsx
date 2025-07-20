
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherData, getUVIndexLabel } from '@/services/weatherService';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { Cloud, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export function WeatherButton() {
  const { profile } = useUserProfile();
  const { language } = useTheme();

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', profile?.country],
    queryFn: () => fetchWeatherData(profile?.country || undefined),
    refetchInterval: 60 * 60 * 1000, // Refetch every 60 minutes
    staleTime: 50 * 60 * 1000, // Consider data stale after 50 minutes
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 rounded-full hover:shadow-glow transition-all duration-300 hover:scale-105 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : error || !weather ? (
              <>
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Weather</span>
              </>
            ) : (
              <>
                <span className="text-lg">{weather.icon}</span>
                <span className="font-medium">{weather.temperature}°C</span>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-gradient-to-br from-background to-accent/5 border-accent/20 shadow-lg">
        <div className="space-y-4">
          {error || !weather ? (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'لا يمكن تحميل بيانات الطقس' 
                  : 'Unable to load weather data'
                }
              </div>
              {error && (
                <div className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' ? 'حاول مرة أخرى لاحقاً' : 'Please try again later'}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Main weather info */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-3xl">{weather.icon}</span>
                  <div>
                    <div className="text-2xl font-bold">{weather.temperature}°C</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'يبدو وكأنه' : 'feels like'} {weather.feelsLike}°C
                    </div>
                  </div>
                </div>
                <div className="text-lg font-medium capitalize mb-3">
                  {weather.description}
                </div>
              </div>

              {/* Today's temperature range */}
              <div className="bg-accent/10 rounded-lg p-3 text-center mb-3">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'اليوم' : 'Today'}
                </div>
                <div className="font-semibold text-lg">
                  L {weather.low}°C - H {weather.high}°C
                </div>
              </div>

              {/* Tomorrow preview */}
              {weather.tomorrow && (
                <div className="bg-accent/5 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{weather.tomorrow.icon}</span>
                      <div>
                        <div className="text-sm font-medium">
                          {language === 'ar' ? 'غداً' : 'Tomorrow'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          L {weather.tomorrow.low}°C - H {weather.tomorrow.high}°C
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="text-sm font-medium">{weather.tomorrow.temperature}°C</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              )}

              {/* Weather details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/10 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">💧</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'الرطوبة' : 'Humidity'}
                  </div>
                  <div className="font-semibold">{weather.humidity}%</div>
                </div>

                <div className="bg-accent/10 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">💨</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'الرياح' : 'Wind'}
                  </div>
                  <div className="font-semibold">{weather.windSpeed} km/h {weather.windDirection}</div>
                </div>

                <div className="bg-accent/10 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">☀️</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'مؤشر الأشعة فوق البنفسجية' : 'UV Index'}
                  </div>
                  <div className="font-semibold">
                    {weather.uvIndex} ({getUVIndexLabel(weather.uvIndex)})
                  </div>
                </div>

                <div className="bg-accent/10 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">🕒</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'آخر تحديث' : 'Updated'}
                  </div>
                  <div className="font-semibold text-xs">{weather.lastUpdated}</div>
                </div>
              </div>

              {/* Location info */}
              {profile?.country && (
                <div className="text-center text-xs text-muted-foreground pt-2 border-t border-accent/20">
                  📍 {profile.country}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
