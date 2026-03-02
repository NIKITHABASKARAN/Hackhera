const SEVERITY_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 0.85,
  CRITICAL: 1.0
};

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
  let weightSum = 0;

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const value = scores[category];
    if (typeof value === "number") {
      total += value * weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return 0;
  return Math.min(1, total / weightSum * (weightSum / sumAllWeights()));
}

function sumAllWeights() {
  return Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
}

function classifySeverity(riskScore) {
  if (riskScore >= SEVERITY_THRESHOLDS.HIGH) return "CRITICAL";
  if (riskScore >= SEVERITY_THRESHOLDS.MEDIUM) return "HIGH";
  if (riskScore >= SEVERITY_THRESHOLDS.LOW) return "MEDIUM";
  return "LOW";
}

function shouldAlert(riskScore) {
  return riskScore >= SEVERITY_THRESHOLDS.LOW;
}

function formatRiskReport(text, scores, riskScore) {
  return {
    text: text.substring(0, 200),
    scores,
    riskScore: Math.round(riskScore * 100) / 100,
    severity: classifySeverity(riskScore),
    shouldAlert: shouldAlert(riskScore),
    timestamp: new Date().toISOString()
  };
}

if (typeof module !== "undefined") {
  module.exports = { computeRiskScore, classifySeverity, shouldAlert, formatRiskReport, SEVERITY_THRESHOLDS };
}
