const BACKEND_URL = "http://localhost:8000";
const FLAGGED_STORAGE_KEY = "flaggedItems";
const STATS_STORAGE_KEY = "scanStats";
const MAX_FLAGGED_ITEMS = 200;

let offscreenReady = false;

// ── Offscreen Document Management ──

async function ensureOffscreen() {
  if (offscreenReady) return;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });

  if (contexts.length === 0) {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "TensorFlow.js toxicity model requires blob URL support for model weights"
      });
    } catch (e) {
      if (!e.message.includes("Only a single offscreen")) {
        console.error("[ALETHEIA BG] Offscreen creation failed:", e);
        return;
      }
    }
  }
  offscreenReady = true;
}

// ── Privacy Masking ──

async function getAnonymousId() {
  const result = await chrome.storage.local.get("anonymousId");
  if (result.anonymousId) return result.anonymousId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ anonymousId: id });
  return id;
}

async function hashText(text) {
  if (!text) return "unknown";
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function stripTrackingParams(url) {
  try {
    const parsed = new URL(url);
    const keepParams = ["v", "id", "p", "q"];
    const params = new URLSearchParams();
    for (const key of keepParams) {
      if (parsed.searchParams.has(key)) {
        params.set(key, parsed.searchParams.get(key));
      }
    }
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

// ── Keyword Fallback (when TF.js model unavailable) ──

const KEYWORD_RULES = [
  { words: ["kill yourself", "kys", "hope you die", "end yourself", "go die", "die bitch"], category: "severe_toxicity", score: 0.95 },
  { words: ["rape", "murder", "gonna kill", "i will kill", "kill you", "beat you", "hurt you", "gonna get you"], category: "threat", score: 0.90 },
  { words: ["hang", "lynch", "hang the", "string up"], category: "threat", score: 0.80 },
  { words: ["nigger", "faggot", "terrorist", "go back to your country", "subhuman", "inferior race", "monkey", "ape"], category: "identity_attack", score: 0.92 },
  { words: ["bitch", "slut", "whore", "hoe", "cunt"], category: "insult", score: 0.85 },
  { words: ["fuck", "shit", "asshole", "bastard", "dick", "piss off"], category: "obscene", score: 0.75 },
  { words: ["stupid", "idiot", "moron", "dumb", "worthless", "pathetic", "loser", "scum", "trash", "freak", "ugly", "fat pig"], category: "insult", score: 0.70 },
  { words: ["hate you", "hate her", "hate him", "hate them", "hate women", "hate men", "hate blacks", "hate whites"], category: "toxicity", score: 0.78 },
];

function keywordFallbackScores(text) {
  const lower = text.toLowerCase();
  const scores = { toxicity: 0, severe_toxicity: 0, threat: 0, identity_attack: 0, insult: 0, obscene: 0 };
  let anyHit = false;

  for (const rule of KEYWORD_RULES) {
    for (const word of rule.words) {
      if (lower.includes(word)) {
        scores[rule.category] = Math.max(scores[rule.category], rule.score);
        scores.toxicity = Math.max(scores.toxicity, rule.score * 0.8);
        anyHit = true;
      }
    }
  }

  return anyHit ? scores : null;
}

// ── Risk Scoring ──

const CATEGORY_WEIGHTS = {
  toxicity: 0.25,
  severe_toxicity: 0.30,
  identity_attack: 0.15,
  threat: 0.15,
  insult: 0.10,
  obscene: 0.05
};

function computeRiskScore(scores) {
  let total = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    total += (scores[cat] || 0) * weight;
  }
  return Math.round(total * 100) / 100;
}

function classifySeverity(riskScore) {
  if (riskScore >= 0.7) return "CRITICAL";
  if (riskScore >= 0.5) return "HIGH";
  if (riskScore >= 0.3) return "MEDIUM";
  return "LOW";
}

// ── Pattern Detection ──

async function recordPattern(text, usernameHash, platform) {
  const PATTERN_KEY = "abusePatterns";
  const result = await chrome.storage.local.get(PATTERN_KEY);
  const patterns = result[PATTERN_KEY] || { phraseFrequency: {}, userFlagCount: {}, recentFlags: [] };

  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().substring(0, 100);
  patterns.phraseFrequency[normalized] = (patterns.phraseFrequency[normalized] || 0) + 1;
  patterns.userFlagCount[usernameHash] = (patterns.userFlagCount[usernameHash] || 0) + 1;
  patterns.recentFlags.push({ textSnippet: text.substring(0, 80), usernameHash, platform, timestamp: Date.now() });

  if (patterns.recentFlags.length > 500) {
    patterns.recentFlags = patterns.recentFlags.slice(-500);
  }

  await chrome.storage.local.set({ [PATTERN_KEY]: patterns });

  const alerts = [];
  if (patterns.userFlagCount[usernameHash] >= 3) {
    alerts.push({ type: "repeat_offender", message: `User flagged ${patterns.userFlagCount[usernameHash]} times` });
  }
  if (patterns.phraseFrequency[normalized] >= 3) {
    alerts.push({ type: "repeated_phrase", message: `Similar phrase seen ${patterns.phraseFrequency[normalized]} times` });
  }
  return alerts;
}

// ── Storage Helpers ──

async function storeFlaggedItem(item) {
  const result = await chrome.storage.local.get(FLAGGED_STORAGE_KEY);
  const items = result[FLAGGED_STORAGE_KEY] || [];
  items.unshift(item);
  if (items.length > MAX_FLAGGED_ITEMS) items.length = MAX_FLAGGED_ITEMS;
  await chrome.storage.local.set({ [FLAGGED_STORAGE_KEY]: items });
}

async function updateStats(scannedCount, flaggedCount) {
  const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
  const stats = result[STATS_STORAGE_KEY] || { totalScanned: 0, totalFlagged: 0, sessionStart: Date.now() };
  stats.totalScanned += scannedCount;
  stats.totalFlagged += flaggedCount;
  stats.lastScan = Date.now();
  await chrome.storage.local.set({ [STATS_STORAGE_KEY]: stats });
}

async function updateBadge(count) {
  const text = count > 0 ? String(count > 99 ? "99+" : count) : "";
  const color = count > 0 ? "#EF4444" : "#6B7280";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// ── Perspective API (optional) ──

async function analyzeWithPerspective(text) {
  const keyResult = await chrome.storage.sync.get("perspectiveApiKey");
  const apiKey = keyResult.perspectiveApiKey;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: {
          TOXICITY: {}, SEVERE_TOXICITY: {}, IDENTITY_ATTACK: {},
          INSULT: {}, PROFANITY: {}, THREAT: {}
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const scores = {};
    const mapping = { TOXICITY: "toxicity", SEVERE_TOXICITY: "severe_toxicity", IDENTITY_ATTACK: "identity_attack", INSULT: "insult", PROFANITY: "obscene", THREAT: "threat" };
    for (const [k, v] of Object.entries(mapping)) {
      if (data.attributeScores?.[k]) {
        scores[v] = data.attributeScores[k].summaryScore?.value || 0;
      }
    }
    return scores;
  } catch {
    return null;
  }
}

// ── Core Analysis Pipeline ──

async function analyzeBatch(entries) {
  await ensureOffscreen();

  const texts = entries.map(e => e.text);
  let tfResults = null;

  try {
    tfResults = await chrome.runtime.sendMessage({ type: "ANALYZE_TOXICITY", texts });
  } catch (err) {
    console.warn("[ALETHEIA BG] Offscreen analysis failed, using backend fallback:", err.message);
  }

  let flaggedCount = 0;
  const results = tfResults?.results || [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tfResult = results[i];

    let scores = tfResult?.scores;
    let flagged = tfResult?.flagged || false;

    if (!scores || tfResult?.error) {
      // Try Perspective API first
      const perspScores = await analyzeWithPerspective(entry.text);
      if (perspScores) {
        scores = perspScores;
        flagged = Object.values(perspScores).some(v => v > 0.7);
      } else {
        // Fall back to keyword detection
        const kwScores = keywordFallbackScores(entry.text);
        if (kwScores) {
          scores = kwScores;
          flagged = true;
          console.log("[ALETHEIA BG] Keyword fallback flagged:", entry.text.substring(0, 60));
        } else {
          continue;
        }
      }
    }

    // Also apply keyword fallback on top of TF.js to catch anything it misses
    if (!flagged) {
      const kwScores = keywordFallbackScores(entry.text);
      if (kwScores) {
        scores = kwScores;
        flagged = true;
      }
    }

    if (!flagged) continue;

    flaggedCount++;
    const riskScore = computeRiskScore(scores);
    const severity = classifySeverity(riskScore);
    const usernameHash = await hashText(entry.username);

    const flaggedItem = {
      id: crypto.randomUUID(),
      text: entry.text.substring(0, 300),
      username: entry.username,
      usernameHash,
      platform: entry.platform,
      domain: entry.domain,
      url: stripTrackingParams(entry.url),
      scores,
      riskScore,
      severity,
      timestamp: new Date().toISOString()
    };

    await storeFlaggedItem(flaggedItem);
    const patternAlerts = await recordPattern(entry.text, usernameHash, entry.platform);

    if (severity !== "LOW") {
      try {
        chrome.notifications.create(flaggedItem.id, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: `ALETHEIA: ${severity} Toxicity Detected`,
          message: `${entry.platform}: "${entry.text.substring(0, 80)}..."`,
          priority: severity === "CRITICAL" ? 2 : 1
        });
      } catch (e) {
        console.warn("[ALETHEIA BG] Notification failed:", e);
      }
    }

    reportToBackend(flaggedItem).catch(err => {
      console.warn("[ALETHEIA BG] Backend report failed:", err.message);
    });
  }

  await updateStats(entries.length, flaggedCount);

  const statsResult = await chrome.storage.local.get(STATS_STORAGE_KEY);
  const totalFlagged = statsResult[STATS_STORAGE_KEY]?.totalFlagged || 0;
  await updateBadge(totalFlagged);
}

// ── Backend Reporting ──

async function reportToBackend(flaggedItem) {
  const anonymousId = await getAnonymousId();

  const payload = {
    anonymous_reporter_id: anonymousId,
    platform: flaggedItem.domain,
    username: flaggedItem.username,
    username_hash: flaggedItem.usernameHash,
    text: flaggedItem.text,
    toxicity_scores: flaggedItem.scores,
    risk_score: flaggedItem.riskScore,
    severity: flaggedItem.severity,
    page_url: flaggedItem.url,
    source: "extension",
    timestamp: flaggedItem.timestamp
  };

  const response = await fetch(`${BACKEND_URL}/extension/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

// ── Message Handling ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_RESULTS") {
    analyzeBatch(message.entries);
    return false;
  }

  if (message.type === "GET_FLAGGED_ITEMS") {
    chrome.storage.local.get(FLAGGED_STORAGE_KEY).then(result => {
      sendResponse({ items: result[FLAGGED_STORAGE_KEY] || [] });
    });
    return true;
  }

  if (message.type === "GET_STATS") {
    chrome.storage.local.get(STATS_STORAGE_KEY).then(result => {
      sendResponse({ stats: result[STATS_STORAGE_KEY] || { totalScanned: 0, totalFlagged: 0 } });
    });
    return true;
  }

  if (message.type === "GET_PATTERNS") {
    chrome.storage.local.get("abusePatterns").then(result => {
      const patterns = result.abusePatterns || { phraseFrequency: {}, userFlagCount: {}, recentFlags: [] };
      const topUsers = Object.entries(patterns.userFlagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const topPhrases = Object.entries(patterns.phraseFrequency).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const oneHourAgo = Date.now() - 3600000;
      const recentCount = patterns.recentFlags.filter(f => f.timestamp > oneHourAgo).length;
      sendResponse({ topUsers, topPhrases, recentCount, totalFlags: patterns.recentFlags.length });
    });
    return true;
  }

  if (message.type === "CLEAR_DATA") {
    chrome.storage.local.remove([FLAGGED_STORAGE_KEY, STATS_STORAGE_KEY, "abusePatterns"]).then(() => {
      updateBadge(0);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "SET_PERSPECTIVE_KEY") {
    chrome.storage.sync.set({ perspectiveApiKey: message.key }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "FORCE_SCAN") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "FORCE_SCAN" });
      }
    });
    return false;
  }
});

// ── Notification Click Handler ──

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  chrome.notifications.clear(notificationId);
});

// ── Install / Startup ──

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ALETHEIA] Extension installed");
  chrome.storage.local.set({ extensionEnabled: true });
  updateBadge(0);
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreen();
});
