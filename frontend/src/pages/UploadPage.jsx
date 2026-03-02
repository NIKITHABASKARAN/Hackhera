import React, { useState } from "react";
import { API_BASE } from "../App.jsx";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

const SEVERITY_COLOR = {
  HIGH:    "#f43f5e",
  MEDIUM:  "#fbbf24",
  LOW:     "#34d399",
  UNKNOWN: "#94a3b8",
};

const CATEGORY_LABEL = {
  threat: "Threat",
  identity_attack: "Identity Attack",
  gender_abuse: "Gender-Based Abuse",
  harassment: "Harassment",
  severe_harassment: "Severe Harassment",
  doxxing: "Doxxing",
  stalking: "Stalking",
  explicit_content: "Explicit Content",
  deepfake_mention: "Deepfake / Image Manipulation",
  nsfw: "NSFW Content",
  deepfake: "Deepfake Detected",
};

function CategoryBadge({ label }) {
  const display = CATEGORY_LABEL[label] || label;
  return (
    <span
      style={{
        display: "inline-block",
        background: "#fff1f2",
        border: "1px solid #fecdd3",
        color: "#be123c",
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: "0.76rem",
        margin: "2px 4px 2px 0",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      {display}
    </span>
  );
}

function FlaggedWord({ word }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: "0.76rem",
        margin: "2px 3px 2px 0",
        color: "#92400e",
        fontWeight: 500,
      }}
    >
      {word}
    </span>
  );
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
        "Unable to analyze evidence. Please ensure the backend is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const severity = (result?.severity || "UNKNOWN").toUpperCase();
  const sevColor = SEVERITY_COLOR[severity] || SEVERITY_COLOR.UNKNOWN;
  const categories = result?.harassment_categories || [];
  const flaggedWords = result?.flagged_words || [];

  // Build a full category list including deepfake/nsfw flags
  const allCategories = [...categories];
  if (result?.deepfake_detected && !allCategories.includes("deepfake")) allCategories.push("deepfake");
  if (result?.nsfw && !allCategories.includes("nsfw")) allCategories.push("nsfw");

  return (
    <section className="panel">
      <h2>📤 Upload Screenshot / Image / Video</h2>
      <p className="upload-description">
        Upload any screenshot or image — text inside the image will be
        automatically read via OCR and analysed for harassment, threats,
        doxxing, and more.
      </p>

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
            placeholder="Paste the abusive message or additional context here (optional — text inside the image is read automatically)"
          />
        </label>

        <label>
          Evidence File
          <input type="file" name="file" accept="image/*,video/*" required />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Analysing…" : "Analyse & Save Incident"}
        </button>
      </form>

      <div
        id="upload-result"
        className={`result-box${result || error || submitting ? "" : " hidden"}`}
      >
        {submitting && <div>Reading image text and analysing…</div>}
        {error && <div style={{ color: "#be123c" }}>{error}</div>}

        {result && !submitting && !error && (
          <>
            {/* ── Severity banner ── */}
            <div
              style={{
                background: sevColor + "18",
                border: `2px solid ${sevColor}`,
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>
                {severity === "HIGH" ? "🚨" : severity === "MEDIUM" ? "⚠️" : "ℹ️"}
              </span>
              <div>
                <div style={{ fontWeight: 700, color: sevColor, fontSize: "1rem" }}>
                  Severity: {severity}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text3)" }}>
                  Toxicity score: {((result.toxicity_score || 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* ── Core flags ── */}
            <div className="result-row">
              <strong>Deepfake Detected:</strong>{" "}
              <span style={{ color: result.deepfake_detected ? "#be123c" : "#047857", fontWeight: 600 }}>
                {result.deepfake_detected ? "⚠️ Yes" : "✅ No"}
              </span>
            </div>
            <div className="result-row">
              <strong>Harassment Detected:</strong>{" "}
              <span style={{ color: result.harassment_detected ? "#be123c" : "#047857", fontWeight: 600 }}>
                {result.harassment_detected ? "⚠️ Yes" : "✅ No"}
              </span>
            </div>
            <div className="result-row">
              <strong>Primary Abuse Type:</strong>{" "}
              {result.abuse_type
                ? (CATEGORY_LABEL[result.abuse_type] || result.abuse_type)
                : "None detected"}
            </div>

            {/* ── Detected categories ── */}
            {allCategories.length > 0 && (
              <div className="result-row" style={{ alignItems: "flex-start" }}>
                <strong style={{ marginRight: 6 }}>Categories:</strong>
                <div>
                  {allCategories.map((c) => (
                    <CategoryBadge key={c} label={c} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Flagged words ── */}
            {flaggedWords.length > 0 && (
              <div className="result-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <strong style={{ marginRight: 6 }}>Flagged Words:</strong>
                <div>
                  {flaggedWords.map((w) => (
                    <FlaggedWord key={w} word={w} />
                  ))}
                </div>
              </div>
            )}

            {/* ── OCR extracted text ── */}
            {result.ocr_text ? (
              <div className="result-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <strong>Text Read from Image (OCR):</strong>
                <pre
                  style={{
                    background: "#f8f9fb",
                    border: "1px solid #e2e5ed",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 8,
                    fontSize: "0.82rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 180,
                    overflowY: "auto",
                    width: "100%",
                    boxSizing: "border-box",
                    color: "#374151",
                    fontFamily: "'Consolas', 'Courier New', monospace",
                  }}
                >
                  {result.ocr_text}
                </pre>
              </div>
            ) : (
              <div className="result-row" style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                {result.ocr_available
                  ? "No readable text found in image."
                  : "OCR unavailable — install Tesseract to enable image text reading."}
              </div>
            )}

            {/* ── Case ID ── */}
            <div className="result-row" style={{ marginTop: 8 }}>
              <strong>Saved Case ID:</strong>{" "}
              <code style={{ fontSize: "0.82rem" }}>{result.id || "N/A"}</code>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default UploadPage;
