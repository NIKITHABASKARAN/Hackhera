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
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch(apiUrl("/incidents"));
        if (!res.ok) {
          throw new Error("Failed to load incidents");
        }
        const data = await res.json();
        setIncidents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("Error loading incidents. Check if the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    fetchIncidents();
  }, []);

  const handleOpenCase = (id) => {
    if (id) {
      navigate(`/case/${encodeURIComponent(id)}`);
    }
  };

  let body;
  if (loading) {
    body = (
      <tr>
        <td colSpan={6}>Loading incidents…</td>
      </tr>
    );
  } else if (error) {
    body = (
      <tr>
        <td colSpan={6}>{error}</td>
      </tr>
    );
  } else if (!incidents.length) {
    body = (
      <tr>
        <td colSpan={6}>No incidents found yet.</td>
      </tr>
    );
  } else {
    body = incidents.map((inc) => {
      const sev = (inc.severity || "LOW").toUpperCase();
      const sevClass =
        sev === "HIGH"
          ? "severity-high"
          : sev === "MEDIUM"
          ? "severity-medium"
          : "severity-low";

      return (
        <tr key={inc.id}>
          <td>{inc.platform || ""}</td>
          <td>{inc.username || ""}</td>
          <td>{inc.abuse_type || ""}</td>
          <td className={sevClass}>{sev}</td>
          <td>
            {inc.repeat_offender_flag ? (
              <span className="badge-repeat">Repeat offender</span>
            ) : (
              <span>—</span>
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
    <section className="panel">
      <h2>Incidents Overview</h2>
      <table id="incidents-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Username</th>
            <th>Abuse Type</th>
            <th>Severity</th>
            <th>Repeat Offender</th>
            <th>Case</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </section>
  );
}

export default DashboardPage;

