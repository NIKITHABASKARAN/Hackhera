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
        <h2>Incident</h2>
        <p>Loading incident…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Incident</h2>
        <p>{error}</p>
      </section>
    );
  }

  const suggestions = Array.isArray(incident?.suggestions)
    ? incident.suggestions
    : [];

  return (
    <>
      <section className="panel">
        <h2>Incident</h2>
        <div id="case-incident">
          <p>
            <strong>Platform:</strong> {incident.platform || ""}
          </p>
          <p>
            <strong>Username:</strong> {incident.username || ""}
          </p>
          <p>
            <strong>Abuse Type:</strong> {incident.abuse_type || ""}
          </p>
          <p>
            <strong>Severity:</strong>{" "}
            {(incident.severity || "").toUpperCase()}
          </p>
          <p>
            <strong>Repeat Offender:</strong>{" "}
            {incident.repeat_offender_flag ? "Yes" : "No"}
          </p>
          <p>
            <strong>Message Text:</strong>
            <br />
            {incident.text || <em>No text stored.</em>}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Recommendations</h2>
        <ul id="case-recommendations">
          {!suggestions.length && <li>No suggestions available.</li>}
          {suggestions.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="panel actions">
        <button id="download-report-btn" onClick={handleDownloadReport}>
          Download PDF Report
        </button>
      </section>
    </>
  );
}

export default CasePage;

