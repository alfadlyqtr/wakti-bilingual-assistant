import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wifi, WifiOff, RefreshCw, User, Heart, Ruler, Weight } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

interface TopPageSectionProps {
  connected: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  metrics?: any;
  sleepHours?: number;
}

export function TopPageSection({
  connected,
  lastSyncedAt,
  syncing,
  onConnect,
  onSync,
  onDisconnect,
  metrics,
  sleepHours
}: TopPageSectionProps) {
  const { language } = useTheme();

  const lastSyncText = lastSyncedAt 
    ? new Date(lastSyncedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
    : language === 'ar' ? 'لم يتم المزامنة مطلقاً' : 'Never synced';

  // Get WHOOP user data
  const userName = metrics?.profile?.first_name && metrics?.profile?.last_name
    ? `${metrics.profile.first_name} ${metrics.profile.last_name}`
    : 'WHOOP User';
  const userEmail = metrics?.profile?.email || '';
  const userInitial = metrics?.profile?.first_name?.charAt(0) || 'W';

  // Get body measurements
  const height = metrics?.body?.height_meter || 0;
  const weight = metrics?.body?.weight_kilogram || 0;
  const maxHR = metrics?.body?.max_heart_rate || 0;

  // Get current metrics
  const strain = metrics?.cycle?.strain?.toFixed(1) || '0.0';
  const recovery = metrics?.recovery?.score || 0;
  const sleep = sleepHours || 0;

  return (
    <Card className="rounded-2xl p-6 border border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-md shadow-lg">
      <div className="flex flex-col gap-4">
        {/* Top Row: User Info + Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* User Avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
              {userInitial}
            </div>
            
            {/* User Details */}
            <div>
              <h2 className="text-lg font-semibold text-white">{userName}</h2>
              <p className="text-sm text-gray-400">{userEmail}</p>
              <div className="flex items-center gap-2 mt-1">
                {connected ? (
                  <Wifi className="h-4 w-4 text-emerald-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-gray-400">
                  {connected 
                    ? (language === 'ar' ? 'متصل بـ WHOOP' : 'Connected to WHOOP')
                    : (language === 'ar' ? 'غير متصل' : 'Not Connected')
                  }
                </span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-400">
                  {language === 'ar' ? 'آخر مزامنة:' : 'Last sync:'} {lastSyncText}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onSync} 
                  disabled={syncing}
                  className="bg-white/10 border-white/20 hover:bg-white/20"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing 
                    ? (language === 'ar' ? 'جار المزامنة...' : 'Syncing...')
                    : (language === 'ar' ? 'مزامنة الآن' : 'Sync Now')
                  }
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={onDisconnect}
                  className="bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400"
                >
                  {language === 'ar' ? 'قطع الاتصال' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <Button 
                onClick={onConnect}
                className="bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400"
              >
                {language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP'}
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Metrics + Body Stats */}
        {connected && metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            {/* Current Metrics */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{strain}</div>
                <div className="text-xs text-gray-400">{language === 'ar' ? 'الإجهاد' : 'Strain'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{recovery}%</div>
                <div className="text-xs text-gray-400">{language === 'ar' ? 'التعافي' : 'Recovery'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{sleep}h</div>
                <div className="text-xs text-gray-400">{language === 'ar' ? 'النوم' : 'Sleep'}</div>
              </div>
            </div>

            {/* Body Stats */}
            <div className="flex gap-6 justify-end">
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-purple-400" />
                <div>
                  <div className="text-sm font-semibold text-white">{height.toFixed(2)}m</div>
                  <div className="text-xs text-gray-400">{language === 'ar' ? 'الطول' : 'Height'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Weight className="h-5 w-5 text-blue-400" />
                <div>
                  <div className="text-sm font-semibold text-white">{weight.toFixed(1)}kg</div>
                  <div className="text-xs text-gray-400">{language === 'ar' ? 'الوزن' : 'Weight'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-400" />
                <div>
                  <div className="text-sm font-semibold text-white">{maxHR} bpm</div>
                  <div className="text-xs text-gray-400">{language === 'ar' ? 'أقصى نبض' : 'Max HR'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}