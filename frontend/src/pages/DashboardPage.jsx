import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../App.jsx";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function DashboardPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSource, setFilterSource] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [extStats, setExtStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const [incRes, statsRes] = await Promise.all([
          fetch(apiUrl("/incidents")),
          fetch(apiUrl("/extension/stats")).catch(() => null),
        ]);

        if (!incRes.ok) throw new Error("Failed to load incidents");
        const data = await incRes.json();
        setIncidents(Array.isArray(data) ? data : []);

        if (statsRes && statsRes.ok) {
          const stats = await statsRes.json();
          setExtStats(stats);
        }
      } catch (err) {
        console.error(err);
        setError("Error loading incidents. Check if the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleOpenCase = (id) => {
    if (id) navigate(`/case/${encodeURIComponent(id)}`);
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filterSource && (inc.source || "manual") !== filterSource) return false;
    if (filterSeverity && (inc.severity || "LOW").toUpperCase() !== filterSeverity) return false;
    return true;
  });

  const totalCount = incidents.length;
  const extCount = incidents.filter((i) => i.source === "extension").length;
  const highCount = incidents.filter(
    (i) => (i.severity || "").toUpperCase() === "HIGH" || (i.severity || "").toUpperCase() === "CRITICAL"
  ).length;
  const repeatCount = incidents.filter((i) => i.repeat_offender_flag).length;

  let body;
  if (loading) {
    body = (
      <tr>
        <td colSpan={7}>Loading incidents...</td>
      </tr>
    );
  } else if (error) {
    body = (
      <tr>
        <td colSpan={7}>{error}</td>
      </tr>
    );
  } else if (!filteredIncidents.length) {
    body = (
      <tr>
        <td colSpan={7}>No incidents match the current filters.</td>
      </tr>
    );
  } else {
    body = filteredIncidents.map((inc) => {
      const sev = (inc.severity || "LOW").toUpperCase();
      const sevClass =
        sev === "HIGH" || sev === "CRITICAL"
          ? "severity-high"
          : sev === "MEDIUM"
          ? "severity-medium"
          : "severity-low";

      const source = inc.source || "manual";

      return (
        <tr key={inc.id}>
          <td>{inc.platform || ""}</td>
          <td>{inc.username || ""}</td>
          <td>{inc.abuse_type || ""}</td>
          <td className={sevClass}>{sev}</td>
          <td>
            <span className={`badge-source badge-source-${source}`}>
              {source === "extension" ? "Extension" : "Manual"}
            </span>
          </td>
          <td>
            {inc.repeat_offender_flag ? (
              <span className="badge-repeat">Repeat offender</span>
            ) : (
              <span>&mdash;</span>
            )}
          </td>
          <td>
            <button className="btn-link" onClick={() => handleOpenCase(inc.id)}>
              Open
            </button>
          </td>
        </tr>
      );
    });
  }

  return (
    <>
      {/* Summary Stats Cards */}
      <section className="stats-cards">
        <div className="stats-card">
          <span className="stats-card-value">{totalCount}</span>
          <span className="stats-card-label">Total Incidents</span>
        </div>
        <div className="stats-card stats-card-ext">
          <span className="stats-card-value">{extCount}</span>
          <span className="stats-card-label">Extension Reports</span>
        </div>
        <div className="stats-card stats-card-high">
          <span className="stats-card-value">{highCount}</span>
          <span className="stats-card-label">High / Critical</span>
        </div>
        <div className="stats-card stats-card-repeat">
          <span className="stats-card-value">{repeatCount}</span>
          <span className="stats-card-label">Repeat Offenders</span>
        </div>
      </section>

      {/* Extension Stats */}
      {extStats && (
        <section className="panel ext-stats-panel">
          <h2>Extension Analytics</h2>
          <div className="ext-stats-row">
            <div className="ext-stat">
              <strong>{extStats.total_reports || 0}</strong> extension reports
            </div>
            <div className="ext-stat">
              <strong>{extStats.repeat_offender_count || 0}</strong> repeat offenders flagged
            </div>
            {extStats.platform_distribution &&
              Object.entries(extStats.platform_distribution).length > 0 && (
                <div className="ext-stat">
                  Top platform:{" "}
                  <strong>
                    {Object.entries(extStats.platform_distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                  </strong>
                </div>
              )}
          </div>
        </section>
      )}

      {/* Incidents Table */}
      <section className="panel">
        <div className="table-header-row">
          <h2>Incidents Overview</h2>
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
        </div>
        <table id="incidents-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Username</th>
              <th>Abuse Type</th>
              <th>Severity</th>
              <th>Source</th>
              <th>Repeat Offender</th>
              <th>Case</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </section>
    </>
  );
}

export default DashboardPage;
