/**
 * dilbar — components/Heatmap.jsx
 * ─────────────────────────────────────────────────────────────
 * GitHub-style activity calendar showing message density
 * for every day in the last 6 months.
 *
 * Darker cell = more messages that day.
 * Helps spot anniversaries, vacations, and fight-days visually.
 *
 * Props:
 *   data     — from selectCharts(result)
 *   messages — Message[] from parseResult
 * ─────────────────────────────────────────────────────────────
 */

import { useMemo } from "react";
import { groupByDay } from "../engine/parser.js";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Heatmap({ data, messages }) {
  if (!data || !messages) return null;

  // ── Build 26 weeks (6 months) of day cells ──────────────
  const { cells, monthLabels } = useMemo(() => {
    const byDay    = groupByDay(messages);
    const today    = new Date();
    const weeksAgo = 26;

    // Start from weeksAgo Sundays ago
    const start = new Date(today);
    start.setDate(today.getDate() - weeksAgo * 7);
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay());

    const cells   = [];
    const seen    = new Set();
    const mlabels = [];

    const cur = new Date(start);
    while (cur <= today) {
      const key   = formatDayKey(cur);
      const count = byDay[key]?.length || 0;
      cells.push({
        key,
        count,
        level: getLevel(count),
        date:  new Date(cur),
      });

      // Track month label positions
      const mKey = `${cur.getFullYear()}-${cur.getMonth()}`;
      if (!seen.has(mKey) && cur.getDate() <= 7) {
        seen.add(mKey);
        mlabels.push({
          label: MONTHS[cur.getMonth()],
          index: cells.length - 1,
        });
      }

      cur.setDate(cur.getDate() + 1);
    }

    return { cells, monthLabels: mlabels };
  }, [messages]);

  // Max count for tooltip scaling
  const maxCount = Math.max(...cells.map(c => c.count), 1);

  return (
    <div className="chart-card">
      <div className="chart-title">Message Heatmap</div>
      <div className="chart-sub">
        Daily activity over the last 6 months — darker means more messages
      </div>

      {/* Month labels */}
      <div className="heatmap-months">
        {monthLabels.map(m => (
          <span
            key={m.label + m.index}
            className="hm-month"
            style={{ marginLeft: Math.floor(m.index / 7) * 14 }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Grid — rendered as columns (weeks) */}
      <div className="heatmap-grid">
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, wk) => (
          <div key={wk} className="heatmap-week">
            {cells.slice(wk * 7, wk * 7 + 7).map(cell => (
              <div
                key={cell.key}
                className={`hm-cell hm-${cell.level}`}
                title={`${cell.date.toDateString()} · ${cell.count} message${cell.count !== 1 ? "s" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="hm-legend-label">Less</span>
        {[0, 1, 2, 3, 4, 5].map(l => (
          <div key={l} className={`hm-cell hm-${l}`} style={{ width: 10, height: 10 }} />
        ))}
        <span className="hm-legend-label">More</span>
      </div>

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function formatDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLevel(count) {
  if (count === 0)   return 0;
  if (count <= 5)    return 1;
  if (count <= 15)   return 2;
  if (count <= 30)   return 3;
  if (count <= 60)   return 4;
  return 5;
}
