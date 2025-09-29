import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
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
}

export function TopPageSection({
  connected,
  lastSyncedAt,
  syncing,
  onConnect,
  onSync,
  onDisconnect,
  autoSyncEnabled,
  onToggleAutoSync
}: TopPageSectionProps) {
  const { language } = useTheme();

  const lastSyncText = lastSyncedAt 
    ? new Date(lastSyncedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
    : language === 'ar' ? 'لم يتم المزامنة مطلقاً' : 'Never synced';

  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {connected 
                  ? (language === 'ar' ? 'متصل بـ WHOOP' : 'Connected to WHOOP')
                  : (language === 'ar' ? 'غير متصل' : 'Not Connected')
                }
              </div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'آخر مزامنة:' : 'Last sync:'} {lastSyncText}
              </div>
            </div>
          </div>
        </div>

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
    </Card>
  );
}
