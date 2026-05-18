/**
 * dilbar — components/Sidebar.jsx
 * ─────────────────────────────────────────────────────────────
 * Left navigation sidebar.
 *
 * Features:
 *   - dilbar brand + Urdu tagline
 *   - Navigation items with active state
 *   - Collapses to icon-only on mobile (< 640px via CSS)
 *   - "NEW" badge on AI Insights nav item
 *
 * Props:
 *   activePage   string   — current active nav id
 *   onNavigate   fn       — called with nav id on click
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
        <span className="dev-credit">developed by wabisabi.abdul</span>
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

    </aside>
  );
}
