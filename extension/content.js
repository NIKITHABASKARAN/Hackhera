(() => {
  const PLATFORM_SELECTORS = {
    "youtube.com": {
      name: "YouTube",
      selectors: ["#content-text", "yt-formatted-string#content-text"],
      usernameSelector: "#author-text"
    },
    "twitter.com": {
      name: "Twitter",
      selectors: ['[data-testid="tweetText"]'],
      usernameSelector: '[data-testid="User-Name"]'
    },
    "x.com": {
      name: "X",
      selectors: ['[data-testid="tweetText"]'],
      usernameSelector: '[data-testid="User-Name"]'
    },
    "facebook.com": {
      name: "Facebook",
      selectors: ['[data-ad-preview="message"]', '[dir="auto"][style]'],
      usernameSelector: "strong > span"
    },
    "reddit.com": {
      name: "Reddit",
      selectors: [
        "[data-testid='comment'] div > p",
        ".RichTextJSON-root p",
        "div[data-click-id='text'] p",
        "faceplate-tracker[noun='comment'] p",
        "[id^='t1_'] .md p",
        ".Comment p",
        "shreddit-comment p",
        "div[slot='comment'] p"
      ],
      usernameSelector: "a[href*='/user/']"
    },
    "instagram.com": {
      name: "Instagram",
      selectors: ["span._aacl", "ul li span"],
      usernameSelector: "a._aacl"
    }
  };

  const GENERIC_SELECTORS = ["p", "span", "div.comment", "div.message", "article", "blockquote", "li"];
  const SCAN_INTERVAL_MS = 5000;
  const MIN_TEXT_LENGTH = 10;
  const MAX_TEXT_LENGTH = 1000;
  const BATCH_SIZE = 20;

  let scannedTexts = new Set();
  let platform = null;
  let isEnabled = true;

  function detectPlatform() {
    const hostname = window.location.hostname;
    for (const [domain, config] of Object.entries(PLATFORM_SELECTORS)) {
      if (hostname.includes(domain)) {
        return { domain, ...config };
      }
    }
    return {
      domain: hostname,
      name: hostname,
      selectors: GENERIC_SELECTORS,
      usernameSelector: null
    };
  }

  function extractTextFromElement(el) {
    const text = (el.innerText || el.textContent || "").trim();
    if (text.length < MIN_TEXT_LENGTH) return null;
    return text.substring(0, MAX_TEXT_LENGTH);
  }

  function extractUsernameNear(el) {
    if (!platform.usernameSelector) return null;
    const parent = el.closest("article, .comment, [class*='comment'], [class*='post'], li, tr");
    if (!parent) return null;
    const usernameEl = parent.querySelector(platform.usernameSelector);
    return usernameEl ? (usernameEl.innerText || usernameEl.textContent || "").trim() : null;
  }

  function generateTextHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString(36);
  }

  function scanPage() {
    if (!isEnabled) return;

    const entries = [];
    const selectors = platform.selectors;

    for (const selector of selectors) {
      let elements;
      try {
        elements = document.querySelectorAll(selector);
      } catch {
        continue;
      }

      for (const el of elements) {
        const text = extractTextFromElement(el);
        if (!text) continue;

        const hash = generateTextHash(text);
        if (scannedTexts.has(hash)) continue;
        scannedTexts.add(hash);

        const username = extractUsernameNear(el);

        entries.push({
          text,
          username: username || "anonymous",
          platform: platform.name,
          domain: platform.domain,
          url: window.location.href,
          elementTag: el.tagName
        });

        if (entries.length >= BATCH_SIZE) break;
      }
      if (entries.length >= BATCH_SIZE) break;
    }

    if (entries.length > 0) {
      chrome.runtime.sendMessage({
        type: "SCAN_RESULTS",
        entries,
        pageUrl: window.location.href,
        platform: platform.name
      });
    }
  }

  function observeDOMMutations() {
    const observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewContent = true;
          break;
        }
      }
      if (hasNewContent) {
        clearTimeout(observeDOMMutations._debounce);
        observeDOMMutations._debounce = setTimeout(scanPage, 1500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    platform = detectPlatform();
    console.log(`[ALETHEIA] Active on ${platform.name} (${platform.domain})`);

    chrome.storage.local.get("extensionEnabled", (result) => {
      isEnabled = result.extensionEnabled !== false;
      if (!isEnabled) {
        console.log("[ALETHEIA] Extension is disabled by user");
        return;
      }

      setTimeout(scanPage, 2000);
      setInterval(scanPage, SCAN_INTERVAL_MS);
      observeDOMMutations();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "TOGGLE_EXTENSION") {
        isEnabled = message.enabled;
        if (isEnabled) scanPage();
      }
      if (message.type === "FORCE_SCAN") {
        scannedTexts.clear();
        scanPage();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
