/**
 * dilbar — components/MoodGraph.jsx
 * ─────────────────────────────────────────────────────────────
 * Monthly mood line chart showing love expressions over time
 * with conflict spikes overlaid as reference areas.
 *
 * Built with Recharts — available in React environment.
 *
 * Props:
 *   data   — from selectCharts(result)
 *   senders string[]
 * ─────────────────────────────────────────────────────────────
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

export default function MoodGraph({ data, senders }) {
  if (!data || !data.loveTimeline || data.loveTimeline.length < 2) {
    return <EmptyChart message="Not enough data to build a mood graph." />;
  }

  const [a, b] = senders;
  const { loveTimeline, conflictTimeline } = data;

  // Build a set of months that had conflicts for reference lines
  const conflictMonths = new Set(
    (conflictTimeline || []).map(c => c.month)
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="tooltip-label">{label}</div>
        {payload.map(p => (
          <div key={p.name} className="tooltip-row">
            <span className="tooltip-dot" style={{ background: p.color }} />
            <span className="tooltip-name">{p.name}</span>
            <span className="tooltip-val">{p.value}</span>
          </div>
        ))}
        {conflictMonths.has(payload[0]?.payload?.month) && (
          <div className="tooltip-conflict">Conflict detected this month</div>
        )}
      </div>
    );
  };

  return (
    <div className="chart-card">
      <div className="chart-title">Monthly Mood Graph</div>
      <div className="chart-sub">
        Love expressions per month — conflict months marked
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={loveTimeline}
          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            stroke="var(--border)"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 8 }}
          />

          {/* Conflict month reference lines */}
          {loveTimeline
            .filter(p => conflictMonths.has(p.month))
            .map(p => (
              <ReferenceLine
                key={p.month}
                x={p.label}
                stroke="var(--burg-border)"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
            ))
          }

          {/* Lines for each sender */}
          <Line
            type="monotone"
            dataKey={a}
            stroke="var(--burg)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--burg)" }}
          />
          <Line
            type="monotone"
            dataKey={b}
            stroke="var(--lav)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--lav)" }}
          />

        </LineChart>
      </ResponsiveContainer>

      {/* Legend for conflict lines */}
      <div className="chart-legend-row">
        <div className="legend-item">
          <div className="legend-line" style={{ background: "var(--burg)" }} />
          <span>{a}</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: "var(--lav)" }} />
          <span>{b}</span>
        </div>
        <div className="legend-item">
          <div className="legend-line legend-dashed" />
          <span>Conflict month</span>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="chart-card chart-empty">
      <i className="ti ti-chart-line" />
      <span>{message}</span>
    </div>
  );
}
