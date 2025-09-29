import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, PlugZap, RefreshCcw, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type StatusHeaderProps = {
  connected: boolean;
  lastSyncedAt?: string | null;
  syncing?: boolean;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (v: boolean) => void;
};

export function StatusHeader({ connected, lastSyncedAt, syncing, onConnect, onSync, onDisconnect, autoSyncEnabled, onToggleAutoSync }: StatusHeaderProps) {
  const last = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const lastStr = last ? `${last.toLocaleDateString()} ${last.toLocaleTimeString()}` : "--";

  return (
    <div className={cn("rounded-2xl p-4 md:p-6 border bg-gradient-to-br", connected ? "from-emerald-500/10 to-emerald-500/0" : "from-amber-500/10 to-amber-500/0")}> 
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {connected ? (
            <CheckCircle2 className="text-emerald-500" />
          ) : (
            <PlugZap className="text-amber-500" />
          )}
          <div>
            <div className="font-semibold text-lg">
              {connected ? "WHOOP Connected" : "WHOOP Not Connected"}
            </div>
            <div className="text-sm text-muted-foreground">Last sync: {lastStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={!!autoSyncEnabled} onCheckedChange={(v)=>onToggleAutoSync?.(!!v)} />
            <span>Auto-sync</span>
          </div>
          {!connected ? (
            <Button onClick={onConnect} disabled={syncing}>
              <PlugZap className="mr-2 h-4 w-4" /> Connect WHOOP
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onSync} disabled={!!syncing}>
                <RefreshCcw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} /> {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button variant="outline" onClick={onDisconnect} disabled={!!syncing}>
                <Power className="mr-2 h-4 w-4" /> Disconnect WHOOP
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
