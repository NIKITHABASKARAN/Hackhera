const BACKEND_URL = "http://localhost:8000";

let allFlaggedItems = [];

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.getElementById("btnRefresh").addEventListener("click", loadData);
  document.getElementById("filterSeverity").addEventListener("change", applyFilters);
  document.getElementById("filterPlatform").addEventListener("change", applyFilters);
});

async function loadData() {
  await Promise.all([
    loadLocalData(),
    loadBackendData()
  ]);
}

function loadLocalData() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (statsResp) => {
      const stats = statsResp?.stats || { totalScanned: 0, totalFlagged: 0 };
      document.getElementById("cardTotalScanned").textContent = stats.totalScanned;
      document.getElementById("cardTotalFlagged").textContent = stats.totalFlagged;

      chrome.runtime.sendMessage({ type: "GET_FLAGGED_ITEMS" }, (itemsResp) => {
        allFlaggedItems = itemsResp?.items || [];
        renderTable(allFlaggedItems);
        updateSummaryCards(allFlaggedItems);
        populatePlatformFilter(allFlaggedItems);
        renderPlatformBreakdown(allFlaggedItems);
        renderTrendChart(allFlaggedItems);

        chrome.runtime.sendMessage({ type: "GET_PATTERNS" }, (patResp) => {
          if (patResp) renderPatterns(patResp);
          resolve();
        });
      });
    });
  });
}

async function loadBackendData() {
  try {
    const res = await fetch(`${BACKEND_URL}/extension/stats`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.backend_incidents) {
      document.getElementById("cardTotalFlagged").textContent =
        allFlaggedItems.length + (data.backend_incidents || 0);
    }
  } catch {
    // Backend may not be running
  }
}

function updateSummaryCards(items) {
  const highCritical = items.filter(i => i.severity === "HIGH" || i.severity === "CRITICAL").length;
  document.getElementById("cardHighSeverity").textContent = highCritical;

  const userCounts = {};
  items.forEach(i => {
    if (i.usernameHash) {
      userCounts[i.usernameHash] = (userCounts[i.usernameHash] || 0) + 1;
    }
  });
  const repeatOffenders = Object.values(userCounts).filter(c => c >= 3).length;
  document.getElementById("cardRepeatOffenders").textContent = repeatOffenders;
}

function populatePlatformFilter(items) {
  const platforms = [...new Set(items.map(i => i.platform).filter(Boolean))];
  const select = document.getElementById("filterPlatform");
  const current = select.value;
  select.innerHTML = '<option value="">All Platforms</option>';
  platforms.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
  select.value = current;
}

function applyFilters() {
  const severity = document.getElementById("filterSeverity").value;
  const platform = document.getElementById("filterPlatform").value;

  let filtered = allFlaggedItems;
  if (severity) filtered = filtered.filter(i => i.severity === severity);
  if (platform) filtered = filtered.filter(i => i.platform === platform);

  renderTable(filtered);
}

function renderTable(items) {
  const tbody = document.getElementById("incidentsBody");

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No flagged content found.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => {
    const mainTox = item.scores?.toxicity || 0;
    const toxLevel = mainTox > 0.7 ? "high" : mainTox > 0.4 ? "medium" : "low";
    const toxWidth = Math.max(4, mainTox * 80);

    return `
      <tr>
        <td><span class="platform-badge">${escapeHtml(item.platform || "WEB")}</span></td>
        <td class="content-cell" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</td>
        <td>
          <div class="toxicity-bar">
            <div class="toxicity-fill ${toxLevel}" style="width:${toxWidth}px"></div>
            <span>${(mainTox * 100).toFixed(0)}%</span>
          </div>
        </td>
        <td>${item.riskScore || 0}</td>
        <td><span class="severity-cell ${item.severity}">${item.severity}</span></td>
        <td class="time-cell">${formatTime(item.timestamp)}</td>
      </tr>
    `;
  }).join("");
}

function renderPlatformBreakdown(items) {
  const container = document.getElementById("platformBreakdown");
  const counts = {};
  items.forEach(i => { counts[i.platform || "WEB"] = (counts[i.platform || "WEB"] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted.length ? sorted[0][1] : 1;

  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state-small">No data yet.</div>';
    return;
  }

  container.innerHTML = sorted.map(([name, count]) => `
    <div class="breakdown-item">
      <span class="breakdown-name">${escapeHtml(name)}</span>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width:${(count / max * 100)}%"></div>
      </div>
      <span class="breakdown-count">${count}</span>
    </div>
  `).join("");
}

function renderTrendChart(items) {
  const canvas = document.getElementById("trendChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const now = Date.now();
  const hoursAgo24 = now - 24 * 60 * 60 * 1000;
  const hourBuckets = new Array(24).fill(0);

  items.forEach(item => {
    const ts = new Date(item.timestamp).getTime();
    if (ts >= hoursAgo24) {
      const hourIdx = Math.floor((ts - hoursAgo24) / (60 * 60 * 1000));
      if (hourIdx >= 0 && hourIdx < 24) hourBuckets[hourIdx]++;
    }
  });

  const maxVal = Math.max(...hourBuckets, 1);
  const barWidth = (width - 40) / 24;
  const chartHeight = height - 40;
  const startX = 30;
  const startY = 10;

  // Grid lines
  ctx.strokeStyle = "#1e1e30";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = startY + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = "#4b5563";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = startY + (chartHeight / 4) * i;
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(val, startX - 4, y + 4);
  }

  // Bars
  const gradient = ctx.createLinearGradient(0, startY, 0, startY + chartHeight);
  gradient.addColorStop(0, "#a855f7");
  gradient.addColorStop(1, "#7c3aed");

  hourBuckets.forEach((count, i) => {
    const barH = (count / maxVal) * chartHeight;
    const x = startX + i * barWidth + 2;
    const y = startY + chartHeight - barH;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth - 4, barH, [2, 2, 0, 0]);
    ctx.fill();
  });

  // X-axis labels
  ctx.fillStyle = "#4b5563";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 24; i += 4) {
    const hourLabel = new Date(hoursAgo24 + i * 60 * 60 * 1000).getHours();
    ctx.fillText(`${hourLabel}h`, startX + i * barWidth + barWidth / 2, height - 2);
  }
}

function renderPatterns(data) {
  const container = document.getElementById("patternAlerts");
  const topUsersContainer = document.getElementById("topUsers");
  const alerts = [];

  if (data.recentCount >= 10) {
    alerts.push({ type: "frequency_spike", message: `${data.recentCount} flags in the last hour` });
  }

  data.topUsers.forEach(([hash, count]) => {
    if (count >= 3) {
      alerts.push({ type: "repeat_offender", message: `User ${hash.substring(0, 8)}... flagged ${count} times` });
    }
  });

  data.topPhrases.forEach(([phrase, count]) => {
    if (count >= 3) {
      alerts.push({ type: "repeated_phrase", message: `"${phrase.substring(0, 40)}..." seen ${count} times` });
    }
  });

  if (alerts.length) {
    container.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.type}">
        <div class="alert-type">${a.type.replace("_", " ")}</div>
        <div>${escapeHtml(a.message)}</div>
      </div>
    `).join("");
  } else {
    container.innerHTML = '<div class="empty-state-small">No patterns detected yet.</div>';
  }

  if (data.topUsers.length) {
    topUsersContainer.innerHTML = data.topUsers.map(([hash, count]) => `
      <div class="top-item">
        <span class="top-hash">${hash.substring(0, 12)}...</span>
        <span class="top-count">${count} flags</span>
      </div>
    `).join("");
  } else {
    topUsersContainer.innerHTML = '<div class="empty-state-small">No flagged users yet.</div>';
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
