import { LucideIcon } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

interface LineStatsDisplayProps {
  title: string;
  stats: StatItem[];
  isLoading?: boolean;
}

export function LineStatsDisplay({ title, stats, isLoading }: LineStatsDisplayProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-enhanced-heading">{title}</h3>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border/30 rounded-lg animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
              <div className="h-4 bg-muted rounded w-8"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-enhanced-heading">{title}</h3>
      <div className="space-y-2">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-3">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-sm font-medium">{stat.label}</span>
            </div>
            <span className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}