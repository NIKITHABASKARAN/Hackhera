const PATTERN_STORAGE_KEY = "abusePatterns";
const MAX_PATTERN_ENTRIES = 500;

async function loadPatterns() {
  const result = await chrome.storage.local.get(PATTERN_STORAGE_KEY);
  return result[PATTERN_STORAGE_KEY] || {
    phraseFrequency: {},
    userFlagCount: {},
    recentFlags: []
  };
}

async function savePatterns(patterns) {
  if (patterns.recentFlags.length > MAX_PATTERN_ENTRIES) {
    patterns.recentFlags = patterns.recentFlags.slice(-MAX_PATTERN_ENTRIES);
  }
  await chrome.storage.local.set({ [PATTERN_STORAGE_KEY]: patterns });
}

function normalizePhrase(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().substring(0, 100);
}

async function recordFlag(text, usernameHash, platform) {
  const patterns = await loadPatterns();
  const normalized = normalizePhrase(text);

  patterns.phraseFrequency[normalized] = (patterns.phraseFrequency[normalized] || 0) + 1;
  patterns.userFlagCount[usernameHash] = (patterns.userFlagCount[usernameHash] || 0) + 1;

  patterns.recentFlags.push({
    textSnippet: text.substring(0, 80),
    usernameHash,
    platform,
    timestamp: Date.now()
  });

  await savePatterns(patterns);
  return detectPatternAlerts(patterns, usernameHash, normalized);
}

function detectPatternAlerts(patterns, usernameHash, phrase) {
  const alerts = [];

  if (patterns.userFlagCount[usernameHash] >= 3) {
    alerts.push({
      type: "repeat_offender",
      message: `User flagged ${patterns.userFlagCount[usernameHash]} times`,
      usernameHash
    });
  }

  if (patterns.phraseFrequency[phrase] >= 3) {
    alerts.push({
      type: "repeated_phrase",
      message: `Similar abusive phrase detected ${patterns.phraseFrequency[phrase]} times`,
      phrase: phrase.substring(0, 50)
    });
  }

  const oneHourAgo = Date.now() - 3600000;
  const recentCount = patterns.recentFlags.filter(f => f.timestamp > oneHourAgo).length;
  if (recentCount >= 10) {
    alerts.push({
      type: "frequency_spike",
      message: `${recentCount} flags in the last hour – possible coordinated attack`
    });
  }

  return alerts;
}

async function getPatternSummary() {
  const patterns = await loadPatterns();

  const topUsers = Object.entries(patterns.userFlagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topPhrases = Object.entries(patterns.phraseFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const oneHourAgo = Date.now() - 3600000;
  const recentCount = patterns.recentFlags.filter(f => f.timestamp > oneHourAgo).length;

  return { topUsers, topPhrases, recentCount, totalFlags: patterns.recentFlags.length };
}

if (typeof module !== "undefined") {
  module.exports = { recordFlag, getPatternSummary, loadPatterns };
}
