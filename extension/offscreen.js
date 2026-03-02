const TOXICITY_THRESHOLD = 0.7;
let model = null;
let modelLoading = false;

async function loadModel() {
  if (model) return model;
  if (modelLoading) {
    while (modelLoading) {
      await new Promise(r => setTimeout(r, 200));
    }
    return model;
  }

  modelLoading = true;
  try {
    console.log("[ALETHEIA Offscreen] Loading toxicity model...");
    model = await toxicity.load(TOXICITY_THRESHOLD, [
      "toxicity",
      "severe_toxicity",
      "identity_attack",
      "insult",
      "threat",
      "obscene"
    ]);
    console.log("[ALETHEIA Offscreen] Model loaded successfully");
    return model;
  } catch (err) {
    console.error("[ALETHEIA Offscreen] Failed to load model:", err);
    model = null;
    return null;
  } finally {
    modelLoading = false;
  }
}

async function analyzeTexts(texts) {
  const loaded = await loadModel();
  if (!loaded) {
    return texts.map(() => ({ error: "Model not loaded" }));
  }

  try {
    const predictions = await loaded.classify(texts);
    return texts.map((text, textIdx) => {
      const scores = {};
      let flagged = false;

      for (const prediction of predictions) {
        const label = prediction.label;
        const result = prediction.results[textIdx];
        const probability = result.probabilities[1];
        scores[label] = Math.round(probability * 1000) / 1000;

        if (result.match === true) {
          flagged = true;
        }
      }

      return { text, scores, flagged };
    });
  } catch (err) {
    console.error("[ALETHEIA Offscreen] Classification error:", err);
    return texts.map(() => ({ error: err.message }));
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_TOXICITY") {
    analyzeTexts(message.texts).then(results => {
      sendResponse({ results });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === "PRELOAD_MODEL") {
    loadModel().then(() => {
      sendResponse({ loaded: !!model });
    });
    return true;
  }
});

loadModel();
