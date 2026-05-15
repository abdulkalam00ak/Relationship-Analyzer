/**
 * dilbar — components/Sidebar.jsx
 * ─────────────────────────────────────────────────────────────
 * Left navigation sidebar.
 *
 * Features:
 *   - dilbar brand + Urdu tagline
 *   - Navigation items with active state
 *   - Collapses to icon-only on mobile (< 640px via CSS)
 *   - Dark mode toggle at the bottom
 *   - "NEW" badge on AI Insights nav item
 *
 * Props:
 *   activePage   string   — current active nav id
 *   onNavigate   fn       — called with nav id on click
 *   darkMode     boolean  — current dark mode state
 *   onToggleDark fn       — toggles dark mode
 *   hasResult    boolean  — whether analysis is done (enables report nav)
 * ─────────────────────────────────────────────────────────────
 */

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard",    icon: "ti-layout-dashboard" },
      { id: "upload",    label: "Upload chat",  icon: "ti-upload" },
    ],
  },
  {
    label: "Report",
    items: [
      { id: "good",      label: "Good side",    icon: "ti-heart"          },
      { id: "bad",       label: "Bad side",     icon: "ti-alert-circle"   },
      { id: "insights",  label: "AI insights",  icon: "ti-sparkles", badge: "NEW" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { id: "mood",      label: "Mood graph",   icon: "ti-chart-line"     },
      { id: "heatmap",   label: "Heatmap",      icon: "ti-calendar-stats" },
      { id: "language",  label: "Love language",icon: "ti-language"       },
    ],
  },
  {
    label: "Settings",
    items: [
      { id: "privacy",   label: "Privacy",      icon: "ti-shield-lock"    },
    ],
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  darkMode,
  onToggleDark,
  hasResult = false,
}) {
  // Report and analytics nav items are disabled until analysis is done
  const reportIds    = ["good", "bad", "insights"];
  const analyticsIds = ["mood", "heatmap", "language"];
  const lockedIds    = new Set([...reportIds, ...analyticsIds]);

  const isLocked = (id) => lockedIds.has(id) && !hasResult;

  return (
    <aside className="sidebar">

      {/* Brand */}
      <div className="sidebar-top">
        <div className="brand">dilbar</div>
        <div className="brand-tag">دِلبر — Relationship Analyzer</div>
      </div>

      {/* Navigation */}
      <nav className="nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={[
                  "nav-item",
                  activePage === item.id  ? "active"  : "",
                  isLocked(item.id)       ? "locked"  : "",
                ].filter(Boolean).join(" ")}
                onClick={() => !isLocked(item.id) && onNavigate(item.id)}
                title={isLocked(item.id) ? "Upload a chat to unlock" : item.label}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
                {item.badge && !isLocked(item.id) && (
                  <span className="badge">{item.badge}</span>
                )}
                {isLocked(item.id) && (
                  <i className="ti ti-lock nav-lock" />
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div className="sidebar-foot">
        <div
          className="toggle-row"
          onClick={onToggleDark}
          role="switch"
          aria-checked={darkMode}
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onToggleDark()}
        >
          <div className="toggle-track">
            <div className="toggle-knob" />
          </div>
          <span>Dark mode</span>
        </div>
      </div>

    </aside>
  );
}
