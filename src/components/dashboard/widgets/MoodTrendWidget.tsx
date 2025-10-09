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
  const chartWidth = 240;
  const rowHeight = 48;
  const chartHeight = moods.length * rowHeight;
  
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
      <CardContent className="pt-8 pb-8">
        <div className="relative pl-2 pr-4">
          {/* Chart area with perfect alignment */}
          <div className="flex items-start gap-5">
            {/* Y-axis emojis */}
            <div className="flex flex-col shrink-0">
              {moods.map((mood) => (
                <div
                  key={mood}
                  className="flex items-center justify-center"
                  style={{ height: rowHeight }}
                >
                  <MoodFace value={mood} size={38} />
                </div>
              ))}
            </div>

            {/* Chart area */}
            <div className="relative flex-1">
              <svg
                width={chartWidth}
                height={chartHeight}
                className="overflow-visible"
              >
                {/* Horizontal grid lines for each mood */}
                {moods.map((mood, index) => {
                  const y = index * rowHeight + rowHeight / 2;
                  return (
                    <line
                      key={`grid-${mood}`}
                      x1={0}
                      y1={y}
                      x2={chartWidth}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-border/20"
                      strokeDasharray="2,3"
                    />
                  );
                })}

                {/* Vertical grid lines for scores */}
                <line
                  x1={getXPosition(6)}
                  y1={0}
                  x2={getXPosition(6)}
                  y2={chartHeight}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border/30"
                />
                <line
                  x1={getXPosition(7)}
                  y1={0}
                  x2={getXPosition(7)}
                  y2={chartHeight}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border/30"
                />

                {/* Data points and lines */}
                {moods.map((mood, index) => {
                  const moodData = data[mood];
                  const isRange = typeof moodData === "object" && "start" in moodData;
                  const y = index * rowHeight + rowHeight / 2;

                  if (isRange) {
                    return (
                      <g key={`data-${mood}`}>
                        <line
                          x1={getXPosition(moodData.start)}
                          y1={y}
                          x2={getXPosition(moodData.end)}
                          y2={y}
                          stroke={moodColors[mood]}
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                        <circle
                          cx={getXPosition(moodData.start)}
                          cy={y}
                          r={6}
                          fill={moodColors[mood]}
                        />
                        <circle
                          cx={getXPosition(moodData.end)}
                          cy={y}
                          r={6}
                          fill={moodColors[mood]}
                        />
                      </g>
                    );
                  } else {
                    return (
                      <circle
                        key={`data-${mood}`}
                        cx={getXPosition(moodData as number)}
                        cy={y}
                        r={6}
                        fill={moodColors[mood]}
                      />
                    );
                  }
                })}

                {/* X-axis line */}
                <line
                  x1={0}
                  y1={chartHeight}
                  x2={chartWidth}
                  y2={chartHeight}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-border/40"
                />
              </svg>

              {/* X-axis labels */}
              <div className="relative mt-2" style={{ width: chartWidth }}>
                <span
                  className="absolute text-xs font-medium text-muted-foreground"
                  style={{ left: getXPosition(6) - 6 }}
                >
                  6
                </span>
                <span
                  className="absolute text-xs font-medium text-muted-foreground"
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
