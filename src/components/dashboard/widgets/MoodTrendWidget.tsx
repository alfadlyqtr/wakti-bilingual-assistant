import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoodFace, MoodValue, moodLabels } from "@/components/journal/icons/MoodFaces";
import { t } from "@/utils/translations";
import { cn } from "@/lib/utils";

type TimeRange = "7d" | "14d" | "30d";

interface MoodTrendWidgetProps {
  language: 'en' | 'ar';
}

// Mock data structure - replace with real data fetching
const getMoodTrendData = (range: TimeRange) => {
  // This would fetch real data based on the time range
  return {
    5: 6.8,  // rad
    4: 6.5,  // good
    3: 6.2,  // meh
    2: { start: 6.0, end: 7.0 }, // bad (range)
    1: 5.9,  // awful
  };
};

const moodColors: Record<MoodValue, string> = {
  5: "#22c55e", // green - rad
  4: "#10b981", // light green - good
  3: "#eab308", // yellow - meh
  2: "#f97316", // orange - bad
  1: "#ef4444", // red - awful
};

export function MoodTrendWidget({ language }: MoodTrendWidgetProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("7d");
  
  const data = useMemo(() => getMoodTrendData(selectedRange), [selectedRange]);
  
  const moods: MoodValue[] = [5, 4, 3, 2, 1];
  const minScore = 5.5;
  const maxScore = 7.5;
  const chartWidth = 220;
  
  const getXPosition = (score: number) => {
    return ((score - minScore) / (maxScore - minScore)) * chartWidth;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">
          {t("moodTrend", language)}
        </CardTitle>
        <div className="flex gap-1">
          {(["7d", "14d", "30d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={cn(
                "px-3 py-1 text-xs rounded-lg transition-colors",
                selectedRange === range
                  ? "bg-[#060541] text-white dark:bg-white dark:text-[#0c0f14]"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative">
          {/* Chart area */}
          <div className="flex flex-col gap-6">
            {moods.map((mood) => {
              const moodData = data[mood];
              const isRange = typeof moodData === "object" && "start" in moodData;
              
              return (
                <div key={mood} className="flex items-center gap-4">
                  {/* Y-axis label (mood emoji) */}
                  <div className="w-10 flex items-center justify-center shrink-0">
                    <MoodFace value={mood} size={36} />
                  </div>
                  
                  {/* Chart line */}
                  <div className="relative flex-1" style={{ height: 36 }}>
                    <svg width={chartWidth} height={36} className="overflow-visible">
                      {/* Vertical grid lines */}
                      <line
                        x1={getXPosition(6)}
                        y1={0}
                        x2={getXPosition(6)}
                        y2={36}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-border/30"
                      />
                      <line
                        x1={getXPosition(7)}
                        y1={0}
                        x2={getXPosition(7)}
                        y2={36}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-border/30"
                      />
                      
                      {isRange ? (
                        // Range line with dots
                        <>
                          <line
                            x1={getXPosition(moodData.start)}
                            y1={18}
                            x2={getXPosition(moodData.end)}
                            y2={18}
                            stroke={moodColors[mood]}
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <circle
                            cx={getXPosition(moodData.start)}
                            cy={18}
                            r={6}
                            fill={moodColors[mood]}
                          />
                          <circle
                            cx={getXPosition(moodData.end)}
                            cy={18}
                            r={6}
                            fill={moodColors[mood]}
                          />
                        </>
                      ) : (
                        // Single dot
                        <circle
                          cx={getXPosition(moodData as number)}
                          cy={18}
                          r={6}
                          fill={moodColors[mood]}
                        />
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* X-axis labels */}
          <div className="flex items-center gap-4 mt-2">
            <div className="w-10 shrink-0"></div>
            <div className="relative flex-1">
              <div className="relative" style={{ width: chartWidth }}>
                <span
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: getXPosition(6) - 6 }}
                >
                  6
                </span>
                <span
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: getXPosition(7) - 6 }}
                >
                  7
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
