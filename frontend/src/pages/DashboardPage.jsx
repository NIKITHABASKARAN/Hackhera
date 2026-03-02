import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../App.jsx";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

const SEV_STYLE = {
  HIGH:     "severity-high",
  CRITICAL: "severity-critical",
  MEDIUM:   "severity-medium",
  LOW:      "severity-low",
};

const PLATFORM_EMOJI = {
  YouTube:   "▶️",
  Twitter:   "𝕏",
  X:         "𝕏",
  Facebook:  "👤",
  Reddit:    "🔴",
  Instagram: "📸",
};

function PlatformPill({ name }) {
  const emoji = PLATFORM_EMOJI[name] || "🌐";
  return (
    <span style={{
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: "0.75rem",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {emoji} {name}
    </span>
  );
}

function DashboardPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSource, setFilterSource] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [extStats, setExtStats] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [extLoading, setExtLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();
  const refreshTimer = useRef(null);

  async function fetchAll() {
    try {
      const [incRes, statsRes, patternsRes] = await Promise.all([
        fetch(apiUrl("/incidents")),
        fetch(apiUrl("/extension/stats")).catch(() => null),
        fetch(apiUrl("/extension/patterns")).catch(() => null),
      ]);

      if (!incRes.ok) throw new Error("Failed to load incidents");
      const data = await incRes.json();
      setIncidents(Array.isArray(data) ? data : []);
      setError(null);

      if (statsRes && statsRes.ok) {
        const stats = await statsRes.json();
        setExtStats(stats);
      } else {
        setExtStats(null);
      }

      if (patternsRes && patternsRes.ok) {
        const pat = await patternsRes.json();
        setPatterns(pat);
      } else {
        setPatterns(null);
      }
    } catch (err) {
      console.error(err);
      setError("Cannot reach backend. Check that it's running on port 8000.");
    } finally {
      setLoading(false);
      setExtLoading(false);
    }
  }

  async function handleClearUnknown() {
    if (!confirm("Remove all incidents with 'Unknown' platform or username?")) return;
    setClearing(true);
    try {
      const res = await fetch(apiUrl("/incidents/clear-unknown"), { method: "DELETE" });
      const json = await res.json();
      await fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  async function handleClearAll() {
    if (!confirm("Delete ALL incidents? This cannot be undone.")) return;
    setClearing(true);
    try {
      await fetch(apiUrl("/incidents/clear-all"), { method: "DELETE" });
      await fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30 seconds to pick up new extension reports
    refreshTimer.current = setInterval(fetchAll, 30_000);
    return () => clearInterval(refreshTimer.current);
  }, []);

  const handleOpenCase = (id) => {
    if (id) navigate(`/case/${encodeURIComponent(id)}`);
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filterSource && (inc.source || "manual") !== filterSource) return false;
    if (filterSeverity && (inc.severity || "LOW").toUpperCase() !== filterSeverity) return false;
    return true;
  });

  const totalCount  = incidents.length;
  const extCount    = extStats?.total_reports ?? extStats?.extension_incidents ?? incidents.filter((i) => i.source === "extension").length;
  const highCount   = incidents.filter(
    (i) => ["HIGH", "CRITICAL"].includes((i.severity || "").toUpperCase())
  ).length;
  const repeatCount = extStats?.repeat_offender_count ?? incidents.filter((i) => i.repeat_offender_flag).length;

  // Abuse Trend (24h) — bucket incidents by hour
  const now = Date.now();
  const hoursAgo24 = now - 24 * 60 * 60 * 1000;
  const hourBuckets = Array(24).fill(0);
  incidents.forEach((inc) => {
    const ts = inc.timestamp ? new Date(inc.timestamp).getTime() : 0;
    if (ts >= hoursAgo24) {
      const idx = Math.floor((ts - hoursAgo24) / (60 * 60 * 1000));
      if (idx >= 0 && idx < 24) hourBuckets[idx]++;
    }
  });
  const trendMax = Math.max(...hourBuckets, 1);

  const ALERT_BORDER = {
    repeat_offender: "#be123c",
    frequency_spike: "#7c3aed",
    repeated_phrase: "#b45309",
    identity_targeted: "#e11d48",
    multi_platform: "#0369a1",
  };

  let body;
  if (loading) {
    body = (
      <tr>
        <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text3)" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>⏳</div>
          Loading incidents…
        </td>
      </tr>
    );
  } else if (error) {
    body = (
      <tr>
        <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#be123c" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>⚠️</div>
          {error}
        </td>
      </tr>
    );
  } else if (!filteredIncidents.length) {
    body = (
      <tr>
        <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text3)" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>✨</div>
          No incidents match the current filters.
        </td>
      </tr>
    );
  } else {
    body = filteredIncidents.map((inc) => {
      const sev    = (inc.severity || "LOW").toUpperCase();
      const sevClass = SEV_STYLE[sev] || "severity-low";
      const source   = inc.source || "manual";

      return (
        <tr key={inc.id}>
          <td>
            {inc.platform ? <PlatformPill name={inc.platform} /> : "—"}
          </td>
          <td style={{ color: "var(--text2)", fontWeight: 500 }}>
            {inc.username || "—"}
          </td>
          <td style={{ color: "var(--text3)", fontSize: "0.83rem" }}>{inc.abuse_type || "—"}</td>
          <td><span className={sevClass}>{sev}</span></td>
          <td>
            <span className={`badge-source badge-source-${source}`}>
              {source === "extension" ? "🔌 Extension" : "✍️ Manual"}
            </span>
          </td>
          <td>
            {inc.repeat_offender_flag ? (
              <span className="badge-repeat">🔁 Repeat</span>
            ) : (
              <span style={{ color: "var(--text4)" }}>—</span>
            )}
          </td>
          <td>
            <button className="btn-link" onClick={() => handleOpenCase(inc.id)}>
              Open →
            </button>
          </td>
        </tr>
      );
    });
  }

  return (
    <>
      {/* ── Stat Cards ── */}
      <section className="stats-cards">
        <div className="stats-card stats-card-total">
          <div className="stats-card-icon">🛡️</div>
          <div className="stats-card-body">
            <span className="stats-card-value">{totalCount}</span>
            <span className="stats-card-label">Total Incidents</span>
          </div>
        </div>

        <div className="stats-card stats-card-ext">
          <div className="stats-card-icon">🔌</div>
          <div className="stats-card-body">
            <span className="stats-card-value">
              {extLoading ? <span style={{ fontSize: "1rem", color: "var(--text4)" }}>…</span> : extCount}
            </span>
            <span className="stats-card-label">Extension Reports</span>
          </div>
        </div>

        <div className="stats-card stats-card-high">
          <div className="stats-card-icon">🚨</div>
          <div className="stats-card-body">
            <span className="stats-card-value">{highCount}</span>
            <span className="stats-card-label">High / Critical</span>
          </div>
        </div>

        <div className="stats-card stats-card-repeat">
          <div className="stats-card-icon">🔁</div>
          <div className="stats-card-body">
            <span className="stats-card-value">{repeatCount}</span>
            <span className="stats-card-label">Repeat Offenders</span>
          </div>
        </div>
      </section>

      {/* ── Abuse Trend & Pattern Alerts ── */}
      <section className="panel">
        <h2>📊 Abuse Trend &amp; Pattern Alerts</h2>
        <div className="analytics-row2">
          <div className="trend-section">
            <div className="trend-title">Abuse Trend (24h)</div>
            <div className="trend-chart">
              {hourBuckets.map((count, i) => (
                <div key={i} className="trend-bar-wrap" title={`${count} incident(s)`}>
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max(4, (count / trendMax) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="trend-labels">
              {[0, 6, 12, 18, 23].map((i) => (
                <span key={i} className="trend-label">
                  {new Date(hoursAgo24 + i * 60 * 60 * 1000).getHours()}h
                </span>
              ))}
            </div>
          </div>
          <div className="pattern-section">
            <div className="pattern-title">Pattern Alerts</div>
            <div className="pattern-alerts-list">
              {patterns?.alerts?.length > 0 ? (
                patterns.alerts.slice(0, 8).map((a, i) => (
                  <div
                    key={i}
                    className="pattern-alert-card"
                    style={{ borderLeftColor: ALERT_BORDER[a.type] || "#6b7280" }}
                  >
                    <div className="pattern-alert-type">
                      {String(a.type || "").replace(/_/g, " ").toUpperCase()}
                    </div>
                    <div className="pattern-alert-msg">{a.message}</div>
                  </div>
                ))
              ) : (
                <p className="pattern-empty">No patterns detected yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Incidents Table ── */}
      <section className="panel">
        <div className="table-header-row">
          <h2>📋 Incidents Overview</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="filter-controls">
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="">All Sources</option>
                <option value="manual">Manual</option>
                <option value="extension">Extension</option>
              </select>
              <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="">All Severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleClearUnknown}
              disabled={clearing}
            >
              Clear Unknown
            </button>
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleClearAll}
              disabled={clearing}
            >
              Clear All
            </button>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {filteredIncidents.length} result{filteredIncidents.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table id="incidents-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Username</th>
                <th>Abuse Type</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Repeat</th>
                <th>Case</th>
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;
