const PERSPECTIVE_ENDPOINT = "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

const PERSPECTIVE_ATTRIBUTES = {
  TOXICITY: {},
  SEVERE_TOXICITY: {},
  IDENTITY_ATTACK: {},
  INSULT: {},
  PROFANITY: {},
  THREAT: {}
};

async function getApiKey() {
  const result = await chrome.storage.sync.get("perspectiveApiKey");
  return result.perspectiveApiKey || null;
}

async function setApiKey(key) {
  await chrome.storage.sync.set({ perspectiveApiKey: key });
}

async function isEnabled() {
  const key = await getApiKey();
  return !!key;
}

async function analyzeWithPerspective(text) {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(`${PERSPECTIVE_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: PERSPECTIVE_ATTRIBUTES
      })
    });

    if (!response.ok) {
      console.warn("Perspective API error:", response.status);
      return null;
    }

    const data = await response.json();
    return normalizePerspectiveScores(data);
  } catch (err) {
    console.warn("Perspective API call failed:", err);
    return null;
  }
}

function normalizePerspectiveScores(data) {
  const scores = {};
  const attrs = data.attributeScores || {};

  const mapping = {
    TOXICITY: "toxicity",
    SEVERE_TOXICITY: "severe_toxicity",
    IDENTITY_ATTACK: "identity_attack",
    INSULT: "insult",
    PROFANITY: "obscene",
    THREAT: "threat"
  };

  for (const [apiKey, localKey] of Object.entries(mapping)) {
    if (attrs[apiKey]) {
      scores[localKey] = attrs[apiKey].summaryScore?.value || 0;
    }
  }

  return scores;
}

if (typeof module !== "undefined") {
  module.exports = { analyzeWithPerspective, isEnabled, getApiKey, setApiKey };
}
