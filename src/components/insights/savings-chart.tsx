"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface SavingsChartProps {
  data: {
    date: string;
    saved: number;
  }[];
}

export function SavingsChart({ data }: SavingsChartProps) {
  const chartHeight = 160;
  const chartWidth = 320;
  const padding = 28;

  const { pathData, areaData, maxPoint, gridLines, xAxisLabels } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathData: "", areaData: "", maxPoint: null, gridLines: [], xAxisLabels: [] };
    }

    const values = data.map((d) => d.saved);
    const minVal = Math.min(...values, -200);
    const maxVal = Math.max(...values, 200);
    const range = maxVal - minVal || 1;

    const getX = (index: number) => {
      if (data.length <= 1) return chartWidth / 2;
      return (index / (data.length - 1)) * (chartWidth - padding * 2) + padding;
    };
    
    const getY = (value: number) => chartHeight - padding - ((value - minVal) / range) * (chartHeight - padding * 2);

    const coords = data.map((d, i) => ({
      x: getX(i),
      y: getY(d.saved),
      saved: d.saved,
      date: d.date,
    }));

    const pathData = coords.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
    
    // Area closed path for gradient fill
    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const zeroY = Math.max(padding, Math.min(chartHeight - padding, getY(0)));
    const areaData = coords.length > 1 ? `${pathData} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z` : "";

    // Find highest saved point for tooltip pin
    let maxPt = coords[0];
    for (const pt of coords) {
      if (pt.saved > maxPt.saved) maxPt = pt;
    }

    const gridLines = [-200, 0, 200].map(val => ({
      y: getY(val),
      label: val,
    }));

    const labelsCount = Math.min(data.length, 4);
    const xAxisLabels: { x: number; label: string }[] = [];
    
    if (data.length === 1) {
      xAxisLabels.push({ x: getX(0), label: format(new Date(`${data[0].date}T00:00:00`), "d MMM") });
    } else {
      const step = (data.length - 1) / (labelsCount - 1);
      for (let i = 0; i < labelsCount; i++) {
        const idx = Math.round(i * step);
        const item = data[idx];
        if (item) {
          xAxisLabels.push({
            x: getX(idx),
            label: format(new Date(`${item.date}T00:00:00`), "d MMM"),
          });
        }
      }
    }

    return { pathData, areaData, maxPoint: maxPt, gridLines, xAxisLabels };
  }, [data]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid Lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={padding}
              y1={line.y}
              x2={chartWidth - padding}
              y2={line.y}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-zinc-300 dark:text-zinc-800"
              strokeDasharray="2 2"
            />
            <text
              x={padding - 8}
              y={line.y + 3}
              textAnchor="end"
              className="text-[8px] fill-zinc-400 font-sans font-medium"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {xAxisLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={chartHeight - 4}
            textAnchor="middle"
            className="text-[8px] fill-zinc-500 font-sans font-medium"
          >
            {label.label}
          </text>
        ))}

        {/* Gradient Area Fill */}
        {areaData && (
          <motion.path
            d={areaData}
            fill="url(#chartGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
        )}

        {/* Curved / Segment Line */}
        {pathData && (
          <motion.path
            d={pathData}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}

        {/* Tooltip pin on max point */}
        {maxPoint && (
          <g>
            <circle cx={maxPoint.x} cy={maxPoint.y} r="4" className="fill-[#10b981] stroke-white stroke-2" />
            <foreignObject x={Math.max(10, Math.min(chartWidth - 55, maxPoint.x - 20))} y={Math.max(0, maxPoint.y - 24)} width="44" height="20">
              <div className="bg-[#1b4332] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 text-center shadow-md">
                ₹{maxPoint.saved}
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
    </div>
  );
}
