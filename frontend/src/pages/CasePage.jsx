import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../App.jsx";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function CasePage() {
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setError("No incident ID provided.");
      setLoading(false);
      return;
    }

    async function fetchIncident() {
      try {
        const res = await fetch(apiUrl(`/incident/${encodeURIComponent(id)}`));
        if (!res.ok) {
          throw new Error("Failed to fetch incident");
        }
        const data = await res.json();
        setIncident(data);
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load incident. Please check that the backend is running and the ID is valid."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchIncident();
  }, [id]);

  const handleDownloadReport = () => {
    if (!id) return;
    window.open(apiUrl(`/report/${encodeURIComponent(id)}`), "_blank");
  };

  if (loading) {
    return (
      <section className="panel">
        <h2>🗂️ Incident Details</h2>
        <p style={{ color: "#6b7280" }}>Loading incident…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>🗂️ Incident Details</h2>
        <p style={{ color: "#be123c" }}>{error}</p>
      </section>
    );
  }

  const suggestions = Array.isArray(incident?.suggestions)
    ? incident.suggestions
    : [];

  const sev = (incident.severity || "").toUpperCase();
  const sevColor = sev === "HIGH" || sev === "CRITICAL"
    ? "#be123c" : sev === "MEDIUM" ? "#b45309" : "#047857";

  return (
    <>
      <section className="panel">
        <h2>🗂️ Incident Details</h2>
        <div
          id="case-incident"
          style={{ display: "grid", gap: "0.75rem", fontSize: "0.9rem" }}
        >
          {[
            ["Platform", incident.platform],
            ["Username", incident.username],
            ["Abuse Type", incident.abuse_type],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", gap: 8 }}>
              <strong style={{ color: "#374151", minWidth: 140 }}>{label}:</strong>
              <span style={{ color: "#0f172a" }}>{val || "—"}</span>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <strong style={{ color: "#374151", minWidth: 140 }}>Severity:</strong>
            <span style={{ color: sevColor, fontWeight: 700 }}>{sev || "—"}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <strong style={{ color: "#374151", minWidth: 140 }}>Repeat Offender:</strong>
            <span style={{ color: incident.repeat_offender_flag ? "#be123c" : "#047857", fontWeight: 600 }}>
              {incident.repeat_offender_flag ? "⚠️ Yes" : "✅ No"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <strong style={{ color: "#374151" }}>Message Text:</strong>
            <p style={{
              background: "#f8f9fb",
              border: "1px solid #e2e5ed",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#6b7280",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {incident.text || <em style={{ color: "var(--text4)" }}>No text stored.</em>}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>💡 Recommendations</h2>
        <ul
          id="case-recommendations"
          style={{ paddingLeft: "1.25rem", display: "grid", gap: "0.5rem" }}
        >
          {!suggestions.length && (
            <li style={{ color: "#9ca3af" }}>No suggestions available.</li>
          )}
          {suggestions.map((s, idx) => (
            <li key={idx} style={{ color: "#374151", lineHeight: 1.6 }}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="panel" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button id="download-report-btn" onClick={handleDownloadReport}>
          📄 Download PDF Report
        </button>
      </section>
    </>
  );
}

export default CasePage;

