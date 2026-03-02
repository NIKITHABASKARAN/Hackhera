import React, { useState } from "react";
import { API_BASE } from "../App.jsx";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function UploadPage() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const form = event.currentTarget;
    const fileInput = form.elements.file;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert("Please choose a file to upload.");
      return;
    }

    const formData = new FormData(form);

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/upload"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to analyze evidence. Please ensure the backend container is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deepfake = result?.deepfake_detected ? "Yes" : "No";
  const harassment = result?.harassment_detected ? "Yes" : "No";
  const severity = (result?.severity || "Unknown").toUpperCase();

  return (
    <section className="panel">
      <h2>Upload Screenshot / Image / Video</h2>
      <form id="upload-form" onSubmit={handleSubmit}>
        <label>
          Platform
          <select name="platform" defaultValue="">
            <option value="">Select platform</option>
            <option>Instagram</option>
            <option>Twitter</option>
            <option>WhatsApp</option>
            <option>Facebook</option>
            <option>Snapchat</option>
            <option>YouTube</option>
            <option>Other</option>
          </select>
        </label>

        <label>
          Username
          <input
            type="text"
            name="username"
            placeholder="@username or phone/email"
          />
        </label>

        <label>
          Context / Message Text (optional)
          <textarea
            name="text"
            rows={4}
            placeholder="Paste the abusive message or context here"
          />
        </label>

        <label>
          Evidence File
          <input type="file" name="file" required />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Analyzing…" : "Analyze & Save Incident"}
        </button>
      </form>

      <div
        id="upload-result"
        className={`result-box${result || error || submitting ? "" : " hidden"}`}
      >
        {submitting && <div>Analyzing evidence…</div>}
        {error && <div>{error}</div>}
        {result && !submitting && !error && (
          <>
            <div className="result-row">
              <strong>Deepfake:</strong> {deepfake}
            </div>
            <div className="result-row">
              <strong>Harassment:</strong> {harassment}
            </div>
            <div className="result-row">
              <strong>Severity:</strong> {severity}
            </div>
            <div className="result-row">
              <strong>Saved Case ID:</strong> {result.id || "N/A"}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default UploadPage;

