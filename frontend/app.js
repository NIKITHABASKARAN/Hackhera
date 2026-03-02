const API_BASE = "http://localhost:8000";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function loadIncidents() {
  const tableBody = document.querySelector("#incidents-table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6">Loading incidents…</td></tr>';

  try {
    const res = await fetch(apiUrl("/incidents"));
    if (!res.ok) {
      throw new Error("Failed to load incidents");
    }
    const incidents = await res.json();
    if (!Array.isArray(incidents) || incidents.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6">No incidents found yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = "";
    incidents.forEach((inc) => {
      const tr = document.createElement("tr");

      const sev = (inc.severity || "LOW").toUpperCase();
      const sevClass =
        sev === "HIGH" ? "severity-high" : sev === "MEDIUM" ? "severity-medium" : "severity-low";

      tr.innerHTML = `
        <td>${inc.platform || ""}</td>
        <td>${inc.username || ""}</td>
        <td>${inc.abuse_type || ""}</td>
        <td class="${sevClass}">${sev}</td>
        <td>${
          inc.repeat_offender_flag
            ? '<span class="badge-repeat">Repeat offender</span>'
            : '<span>—</span>'
        }</td>
        <td><button class="btn-link" data-id="${inc.id}">Open</button></td>
      `;

      tableBody.appendChild(tr);
    });

    tableBody.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.matches("button.btn-link")) {
        const id = target.getAttribute("data-id");
        if (id) {
          window.location.href = `case.html?id=${encodeURIComponent(id)}`;
        }
      }
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML =
      '<tr><td colspan="6">Error loading incidents. Check if the backend is running.</td></tr>';
  }
}

function setupUploadForm() {
  const form = document.getElementById("upload-form");
  const resultBox = document.getElementById("upload-result");
  if (!form || !resultBox) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert("Please choose a file to upload.");
      return;
    }

    const formData = new FormData(form);

    resultBox.classList.remove("hidden");
    resultBox.innerHTML = "Analyzing evidence…";

    try {
      const res = await fetch(apiUrl("/upload"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const data = await res.json();

      const deepfake = data.deepfake_detected ? "Yes" : "No";
      const harassment = data.harassment_detected ? "Yes" : "No";
      const severity = (data.severity || "Unknown").toUpperCase();

      resultBox.innerHTML = `
        <div class="result-row"><strong>Deepfake:</strong> ${deepfake}</div>
        <div class="result-row"><strong>Harassment:</strong> ${harassment}</div>
        <div class="result-row"><strong>Severity:</strong> ${severity}</div>
        <div class="result-row"><strong>Saved Case ID:</strong> ${data.id || "N/A"}</div>
      `;
    } catch (err) {
      console.error(err);
      resultBox.innerHTML =
        "Unable to analyze evidence. Please ensure the backend container is running.";
    }
  });
}

async function loadCaseDetails() {
  const container = document.getElementById("case-incident");
  const recList = document.getElementById("case-recommendations");
  const downloadBtn = document.getElementById("download-report-btn");
  if (!container || !recList || !downloadBtn) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    container.textContent = "No incident ID provided.";
    return;
  }

  container.textContent = "Loading incident…";
  recList.innerHTML = "";

  try {
    const res = await fetch(apiUrl(`/incident/${encodeURIComponent(id)}`));
    if (!res.ok) {
      throw new Error("Failed to fetch incident");
    }
    const inc = await res.json();

    container.innerHTML = `
      <p><strong>Platform:</strong> ${inc.platform || ""}</p>
      <p><strong>Username:</strong> ${inc.username || ""}</p>
      <p><strong>Abuse Type:</strong> ${inc.abuse_type || ""}</p>
      <p><strong>Severity:</strong> ${(inc.severity || "").toUpperCase()}</p>
      <p><strong>Repeat Offender:</strong> ${
        inc.repeat_offender_flag ? "Yes" : "No"
      }</p>
      <p><strong>Message Text:</strong><br />${inc.text || "<em>No text stored.</em>"}</p>
    `;

    const suggestions = Array.isArray(inc.suggestions) ? inc.suggestions : [];
    if (suggestions.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No suggestions available.";
      recList.appendChild(li);
    } else {
      suggestions.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        recList.appendChild(li);
      });
    }

    downloadBtn.addEventListener("click", () => {
      window.open(apiUrl(`/report/${encodeURIComponent(id)}`), "_blank");
    });
  } catch (err) {
    console.error(err);
    container.textContent =
      "Unable to load incident. Please check that the backend is running and the ID is valid.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadIncidents();
  setupUploadForm();
  loadCaseDetails();
});

