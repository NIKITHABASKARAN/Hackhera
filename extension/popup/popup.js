document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggleEnabled");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const totalScanned = document.getElementById("totalScanned");
  const totalFlagged = document.getElementById("totalFlagged");
  const currentPageFlags = document.getElementById("currentPageFlags");
  const flaggedList = document.getElementById("flaggedList");
  const btnSync = document.getElementById("btnSync");
  const syncStatus = document.getElementById("syncStatus");
  const btnDashboard = document.getElementById("btnDashboard");
  const btnWebDashboard = document.getElementById("btnWebDashboard");
  const btnRescan = document.getElementById("btnRescan");
  const sensitivitySlider = document.getElementById("sensitivitySlider");
  const sensitivityValue = document.getElementById("sensitivityValue");
  const perspectiveKey = document.getElementById("perspectiveKey");
  const btnSaveKey = document.getElementById("btnSaveKey");
  const btnClearData = document.getElementById("btnClearData");

  function loadState() {
    chrome.storage.local.get("extensionEnabled", (result) => {
      const enabled = result.extensionEnabled !== false;
      toggleEnabled.checked = enabled;
      statusDot.className = `status-dot ${enabled ? "active" : "inactive"}`;
      statusText.textContent = enabled ? "Active Protection" : "Paused";
    });

    chrome.storage.local.get("sensitivity", (result) => {
      const val = result.sensitivity || 7;
      sensitivitySlider.value = val;
      sensitivityValue.textContent = val;
    });

    chrome.storage.sync.get("perspectiveApiKey", (result) => {
      if (result.perspectiveApiKey) {
        perspectiveKey.value = result.perspectiveApiKey.substring(0, 8) + "...";
      }
    });
  }

  function loadStats() {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
      if (response?.stats) {
        totalScanned.textContent = formatNumber(response.stats.totalScanned || 0);
        totalFlagged.textContent = formatNumber(response.stats.totalFlagged || 0);
      }
    });

    chrome.runtime.sendMessage({ type: "GET_FLAGGED_ITEMS" }, (response) => {
      if (response?.items) {
        renderFlaggedItems(response.items);
        countCurrentPageFlags(response.items);
      }
    });
  }

  function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function countCurrentPageFlags(items) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const currentUrl = tabs[0].url || "";
      const hostname = (() => { try { return new URL(currentUrl).hostname; } catch { return ""; } })();
      const count = items.filter(item => {
        try { return new URL(item.url).hostname === hostname; } catch { return false; }
      }).length;
      currentPageFlags.textContent = String(count);
    });
  }

  function renderFlaggedItems(items) {
    if (!items.length) {
      flaggedList.innerHTML = '<div class="empty-state">No threats detected yet. Browsing safely.</div>';
      return;
    }

    flaggedList.innerHTML = items.slice(0, 30).map(item => {
      const topCategories = Object.entries(item.scores || {})
        .filter(([, v]) => v > 0.5)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const categoryTags = topCategories.map(([cat]) =>
        `<span class="category-tag">${cat.replace("_", " ")}</span>`
      ).join("");

      const timeAgo = getTimeAgo(item.timestamp);

      return `
        <div class="flagged-item severity-${item.severity}" data-url="${item.url || ""}">
          <div>
            <span class="flagged-platform">${item.platform || "WEB"}</span>
          </div>
          <div class="flagged-content">
            <div class="flagged-text">${escapeHtml(item.text)}</div>
            <div class="flagged-meta">
              <span class="severity-badge ${item.severity}">${item.severity}</span>
              <span class="flagged-time">${timeAgo}</span>
            </div>
            <div class="category-tags">${categoryTags}</div>
          </div>
        </div>
      `;
    }).join("");

    flaggedList.querySelectorAll(".flagged-item").forEach(el => {
      el.addEventListener("click", () => {
        const url = el.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  }

  function getTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Event Listeners
  toggleEnabled.addEventListener("change", () => {
    const enabled = toggleEnabled.checked;
    chrome.storage.local.set({ extensionEnabled: enabled });
    statusDot.className = `status-dot ${enabled ? "active" : "inactive"}`;
    statusText.textContent = enabled ? "Active Protection" : "Paused";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_EXTENSION", enabled });
      }
    });
  });

  btnSync.addEventListener("click", () => {
    btnSync.disabled = true;
    syncStatus.textContent = "Syncing...";
    chrome.runtime.sendMessage({ type: "SYNC_TO_DASHBOARD" }, (response) => {
      btnSync.disabled = false;
      if (chrome.runtime.lastError || !response) {
        syncStatus.textContent = "Sync failed — extension error. Try reloading.";
        return;
      }
      const { synced, failed, total, error } = response;
      if (error) {
        syncStatus.textContent = `Sync error: ${error}`;
      } else if (total === 0) {
        syncStatus.textContent = "Nothing to sync.";
      } else if (failed > 0 && synced === 0) {
        syncStatus.textContent = `All ${total} failed. Is backend running on port 8000?`;
      } else if (failed > 0) {
        syncStatus.textContent = `Synced ${synced} / ${total} (${failed} failed).`;
      } else {
        syncStatus.textContent = `Synced ${synced} / ${total} items!`;
      }
      loadStats();
      setTimeout(() => { syncStatus.textContent = ""; }, 4000);
    });
  });

  btnDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    window.close();
  });

  btnWebDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
    window.close();
  });

  btnRescan.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "FORCE_SCAN" });
    btnRescan.textContent = "...";
    setTimeout(() => { btnRescan.innerHTML = "&#x21bb;"; }, 1500);
  });

  sensitivitySlider.addEventListener("input", () => {
    sensitivityValue.textContent = sensitivitySlider.value;
    chrome.storage.local.set({ sensitivity: parseInt(sensitivitySlider.value) });
  });

  btnSaveKey.addEventListener("click", () => {
    const key = perspectiveKey.value.trim();
    if (key && !key.includes("...")) {
      chrome.runtime.sendMessage({ type: "SET_PERSPECTIVE_KEY", key }, () => {
        btnSaveKey.textContent = "Saved!";
        setTimeout(() => { btnSaveKey.textContent = "Save"; }, 2000);
      });
    }
  });

  btnClearData.addEventListener("click", () => {
    if (confirm("Clear all flagged data and stats?")) {
      chrome.runtime.sendMessage({ type: "CLEAR_DATA" }, () => {
        loadStats();
        btnClearData.textContent = "Cleared!";
        setTimeout(() => { btnClearData.textContent = "Clear All Data"; }, 2000);
      });
    }
  });

  loadState();
  loadStats();
});
