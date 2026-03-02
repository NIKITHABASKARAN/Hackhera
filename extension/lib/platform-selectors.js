const PLATFORM_SELECTORS = {
  "youtube.com": {
    name: "YouTube",
    selectors: ["#content-text", "yt-formatted-string#content-text", ".ytd-comment-renderer #content-text"],
    usernameSelector: "#author-text",
    icon: "YT"
  },
  "twitter.com": {
    name: "Twitter",
    selectors: ['[data-testid="tweetText"]'],
    usernameSelector: '[data-testid="User-Name"]',
    icon: "TW"
  },
  "x.com": {
    name: "X",
    selectors: ['[data-testid="tweetText"]'],
    usernameSelector: '[data-testid="User-Name"]',
    icon: "X"
  },
  "facebook.com": {
    name: "Facebook",
    selectors: ['[data-ad-preview="message"]', '[dir="auto"]', ".x1lliihq"],
    usernameSelector: "strong > span",
    icon: "FB"
  },
  "reddit.com": {
    name: "Reddit",
    selectors: ["shreddit-comment div.md", "[id^='t1_'] .md", ".Comment .RichTextJSON-root"],
    usernameSelector: "a[href*='/user/']",
    icon: "RD"
  },
  "instagram.com": {
    name: "Instagram",
    selectors: ["span._aacl", "ul li span"],
    usernameSelector: "a._aacl",
    icon: "IG"
  }
};

function detectPlatform(hostname) {
  for (const domain of Object.keys(PLATFORM_SELECTORS)) {
    if (hostname.includes(domain)) {
      return { domain, ...PLATFORM_SELECTORS[domain] };
    }
  }
  return {
    domain: hostname,
    name: hostname,
    selectors: ["p", "span", "div", "li", "td", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "article"],
    usernameSelector: null,
    icon: "WEB"
  };
}

if (typeof module !== "undefined") {
  module.exports = { PLATFORM_SELECTORS, detectPlatform };
}
