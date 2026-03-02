async function getAnonymousId() {
  const result = await chrome.storage.local.get("anonymousId");
  if (result.anonymousId) return result.anonymousId;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ anonymousId: id });
  return id;
}

async function hashUsername(username) {
  if (!username) return "unknown";
  const encoder = new TextEncoder();
  const data = encoder.encode(username.trim().toLowerCase());
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

if (typeof module !== "undefined") {
  module.exports = { getAnonymousId, hashUsername, stripTrackingParams };
}
