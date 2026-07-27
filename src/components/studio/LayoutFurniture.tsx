// Furniture for the Draw Layout tab: the symbol renderer and the pick-a-piece palette.
//
// The symbol shapes themselves live in `floorPlanFurniture.ts` as normalised 0..1 coordinates, so
// one definition serves any size and any zoom. This file is only the React side of them.
//
// ⛔ Both pieces are deliberately OUTSIDE `DesignerWorkspace`. That file is already very large, and
// a palette re-mounting on every canvas pointer move would make the category tabs unusable.

import { useState } from 'react';
import {
  FURNITURE_CATEGORIES,
  type FurnitureCategory,
  type FurnitureSymbol,
  type PlanShape,
  furnitureByCategory,
} from './floorPlanFurniture';

/** One placed piece of furniture on the layout canvas. x and y are its CENTRE, in canvas pixels. */
export type PlacedItem = {
  id: string;
  symbolId: string;
  x: number;
  y: number;
  /** Degrees clockwise. The symbols are all drawn facing up, so rotation is applied here. */
  rotation: number;
  /** Width and depth in canvas pixels, derived from the symbol's real size and the plan scale. */
  width: number;
  depth: number;
};

/**
 * Draws one symbol's shapes centred on the origin, sized to `width` x `depth` pixels.
 *
 * The caller positions and rotates it with a transform, so nothing here needs to know where the
 * piece sits. Stroke and fill both come from `currentColor`, which lets the selected state be a
 * single class change on the parent group.
 */
export function FurnitureShapes({ shapes, width, depth }: { shapes: PlanShape[]; width: number; depth: number }) {
  const px = (value: number) => -width / 2 + value * width;
  const py = (value: number) => -depth / 2 + value * depth;
  const sx = (value: number) => value * width;
  const sy = (value: number) => value * depth;
  const sr = (value: number) => value * Math.min(width, depth);

  return (
    <>
      {shapes.map((shape, index) => {
        const key = `shape-${index}`;
        const fill = 'fill' in shape && shape.fill ? 'currentColor' : 'none';
        switch (shape.k) {
          case 'rect':
            return (
              <rect
                key={key}
                x={px(shape.x)}
                y={py(shape.y)}
                width={Math.max(0, sx(shape.w))}
                height={Math.max(0, sy(shape.h))}
                rx={sr(shape.r || 0)}
                fill={fill}
              />
            );
          case 'line':
            return <line key={key} x1={px(shape.x1)} y1={py(shape.y1)} x2={px(shape.x2)} y2={py(shape.y2)} />;
          case 'circle':
            return <circle key={key} cx={px(shape.cx)} cy={py(shape.cy)} r={Math.max(0.5, sr(shape.r))} fill={fill} />;
          case 'ellipse':
            return (
              <ellipse
                key={key}
                cx={px(shape.cx)}
                cy={py(shape.cy)}
                rx={Math.max(0.5, sx(shape.rx))}
                ry={Math.max(0.5, sy(shape.ry))}
                fill={fill}
              />
            );
          case 'arc': {
            const radius = Math.max(0.5, sr(shape.r));
            const from = (shape.from * Math.PI) / 180;
            const to = (shape.to * Math.PI) / 180;
            const cx = px(shape.cx);
            const cy = py(shape.cy);
            const largeArc = Math.abs(shape.to - shape.from) > 180 ? 1 : 0;
            return (
              <path
                key={key}
                d={`M ${cx + radius * Math.cos(from)} ${cy + radius * Math.sin(from)} A ${radius} ${radius} 0 ${largeArc} 1 ${cx + radius * Math.cos(to)} ${cy + radius * Math.sin(to)}`}
                fill="none"
              />
            );
          }
          case 'poly': {
            const points = shape.points;
            const parts: string[] = [];
            for (let i = 0; i + 1 < points.length; i += 2) {
              parts.push(`${i === 0 ? 'M' : 'L'} ${px(points[i])} ${py(points[i + 1])}`);
            }
            if (shape.close) parts.push('Z');
            return <path key={key} d={parts.join(' ')} fill={fill} />;
          }
          default:
            return null;
        }
      })}
    </>
  );
}

/** A small preview of a symbol, used for the palette tiles. */
function SymbolTilePreview({ symbol }: { symbol: FurnitureSymbol }) {
  // A fixed box with the symbol's own aspect ratio kept, so a bathtub does not look like a stool.
  const box = 44;
  const ratio = symbol.widthM / symbol.depthM;
  const width = ratio >= 1 ? box : box * ratio;
  const depth = ratio >= 1 ? box / ratio : box;
  return (
    <svg viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="h-11 w-11" aria-hidden="true">
      <g stroke="currentColor" strokeWidth={1.4} fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        <FurnitureShapes shapes={symbol.shapes} width={width} depth={depth} />
      </g>
    </svg>
  );
}

/**
 * The furniture picker: a row of category tabs over a grid of tappable symbols.
 *
 * Tapping a tile ADDS the piece to the middle of what the user is currently looking at, rather
 * than starting a drag. Drag-and-drop from a palette into a scrollable, zoomable canvas is
 * genuinely awkward on a phone, and this tab is mobile-first.
 */
export function FurniturePalette({
  isArabic,
  onPick,
}: {
  isArabic: boolean;
  onPick: (symbol: FurnitureSymbol) => void;
}) {
  const [category, setCategory] = useState<FurnitureCategory>('living');
  const symbols = furnitureByCategory(category);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FURNITURE_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition active:scale-95 ${
              category === item.id
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_2px_10px_hsla(210,100%,65%,0.4)]'
                : 'border border-[#c9dff5] bg-white text-[#40506a] dark:border-sky-300/15 dark:bg-white/[0.06] dark:text-foreground/75'
            }`}
          >
            {isArabic ? item.ar : item.en}
          </button>
        ))}
      </div>

      <div className="grid max-h-[228px] grid-cols-3 gap-1.5 overflow-y-auto pe-0.5 sm:grid-cols-4">
        {symbols.map((symbol) => (
          <button
            key={symbol.id}
            type="button"
            onClick={() => onPick(symbol)}
            className="flex flex-col items-center gap-1 rounded-xl border border-[#d9e7f5] bg-white px-1 py-2 text-[#31405a] transition hover:border-sky-400/60 hover:bg-sky-50/60 active:scale-95 dark:border-sky-300/15 dark:bg-white/[0.05] dark:text-foreground/80 dark:hover:bg-white/[0.1]"
          >
            <SymbolTilePreview symbol={symbol} />
            <span className="w-full truncate px-0.5 text-center text-[9px] font-bold leading-tight">
              {isArabic ? symbol.ar : symbol.en}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
