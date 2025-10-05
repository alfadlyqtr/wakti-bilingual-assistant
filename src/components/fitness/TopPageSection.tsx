import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wifi, WifiOff, RefreshCw, Power, User, Heart, Ruler, Weight } from "lucide-react";
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

  // Get current metrics - Extract correctly from nested data structure
  const strain = metrics?.cycle?.day_strain?.toFixed(1) || metrics?.cycle?.data?.score?.strain?.toFixed(1) || '0.0';
  const recovery = metrics?.recovery?.score || metrics?.recovery?.data?.score?.recovery_score || 0;
  const sleep = sleepHours || 0;

  return (
    <Card id="fitness-header" className="rounded-2xl p-4 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-gray-200 dark:border-white/10 backdrop-blur-md shadow-xl">
      <div className="flex flex-col gap-3 md:gap-4">
        {/* Top Row: User Info */}
        <div className="flex items-start md:items-center gap-3 md:gap-4">
          {/* WHOOP Logo */}
          <div className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center p-3 md:p-2 flex-shrink-0">
            <img 
              src="/lovable-uploads/WHOOP Circle Black@2x.png" 
              alt="WHOOP" 
              className="w-full h-full object-contain dark:hidden"
              style={{ aspectRatio: '1/1' }}
            />
            <img 
              src="/lovable-uploads/WHOOP Circle White@2x.png" 
              alt="WHOOP" 
              className="w-full h-full object-contain hidden dark:block"
              style={{ aspectRatio: '1/1' }}
            />
          </div>
          
          {/* User Details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">{userName}</h2>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">{userEmail}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {connected ? (
                <Wifi className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
              )}
              <span className={`text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border shadow-sm ${connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
              }`}>
                {connected 
                  ? (language === 'ar' ? 'متصل بـ WHOOP' : 'Connected to WHOOP')
                  : (language === 'ar' ? 'غير متصل' : 'Not Connected')
                }
              </span>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-400 font-medium mt-0.5">
              {language === 'ar' ? 'آخر مزامنة:' : 'Last sync:'} {lastSyncText}
            </div>
          </div>
        </div>

        {/* Action Buttons - Full width on mobile */}
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Button
                size="sm"
                onClick={onSync}
                disabled={syncing}
                className="flex-1 md:flex-none text-xs md:text-sm rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white border-2 border-indigo-300 shadow-[0_6px_20px_rgba(59,130,246,0.35)] hover:from-indigo-600 hover:to-blue-600 active:scale-95 transition-all"
              >
                <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? (language === 'ar' ? 'جار المزامنة...' : 'Syncing...') : (language === 'ar' ? 'مزامنة الآن' : 'Sync Now')}
              </Button>
              <Button
                size="sm"
                onClick={onDisconnect}
                className="flex-1 md:flex-none text-xs md:text-sm rounded-full bg-gradient-to-br from-rose-100 to-red-200 dark:from-red-500/20 dark:to-red-500/10 text-rose-700 dark:text-red-300 border-2 border-rose-300 dark:border-red-500/30 shadow-[0_6px_20px_rgba(244,63,94,0.25)] hover:from-rose-200 hover:to-red-300 active:scale-95 transition-all"
              >
                <Power className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                {language === 'ar' ? 'قطع الاتصال' : 'Disconnect'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={onConnect}
              className="w-full md:w-auto rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white border-2 border-emerald-300 shadow-[0_6px_20px_rgba(16,185,129,0.35)] hover:from-emerald-500 hover:to-green-600 active:scale-95"
            >
              {language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP'}
            </Button>
          )}
        </div>

        {/* Bottom Row: Metrics (HIDDEN ON MOBILE) + Body Stats */}
        {connected && metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pt-3 md:pt-4 border-t border-white/10">
            {/* Current Metrics - HIDDEN ON MOBILE */}
            <div className="hidden md:flex gap-6">
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
            <div className="flex gap-3 md:gap-6 justify-start md:justify-end overflow-x-auto">
              <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                <Ruler className="h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">{height.toFixed(2)}m</div>
                  <div className="text-xs text-gray-700 dark:text-gray-400 font-medium">{language === 'ar' ? 'الطول' : 'Height'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                <Weight className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">{weight.toFixed(1)}kg</div>
                  <div className="text-xs text-gray-700 dark:text-gray-400 font-medium">{language === 'ar' ? 'الوزن' : 'Weight'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                <Heart className="h-4 w-4 md:h-5 md:w-5 text-red-400" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">{maxHR} bpm</div>
                  <div className="text-xs text-gray-700 dark:text-gray-400 font-medium">{language === 'ar' ? 'أقصى نبض' : 'Max HR'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}