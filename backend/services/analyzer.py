from __future__ import annotations

from typing import Any, Dict, Optional


TOXIC_KEYWORDS = [
    "hate", "stupid", "idiot", "worthless", "kill", "die",
    "slut", "bitch", "ugly", "disgusting", "loser", "trash",
    "moron", "dumb", "pathetic", "scum", "freak",
]

SEVERE_TOXIC_KEYWORDS = [
    "kill yourself", "kys", "die bitch", "rape", "murder",
    "hope you die", "end yourself",
]

THREAT_KEYWORDS = [
    "kill you", "beat you", "find you", "come for you", "hurt you",
    "destroy you", "watch out", "gonna get you", "i will find",
]

IDENTITY_HATE_KEYWORDS = [
    "go back to your country", "terrorist", "monkey", "ape",
    "subhuman", "inferior", "breed", "plague",
]

INSULT_KEYWORDS = [
    "ugly", "fat", "disgusting", "pathetic", "loser", "worthless",
    "nobody", "joke", "failure", "clown", "embarrassment",
]

GENDER_ABUSE_KEYWORDS = [
    "she should", "go back to kitchen", "women like you",
    "girl like you", "slut", "bitch", "whore", "hoe",
    "know your place", "just a woman", "feminazi",
]


def detect_toxicity(text: str) -> float:
    lowered = text.lower()
    hits = sum(1 for kw in TOXIC_KEYWORDS if kw in lowered)
    if hits == 0:
        return 0.1
    score = 0.3 + hits * 0.15
    return max(0.0, min(1.0, score))


def detect_toxicity_detailed(text: str) -> Dict[str, float]:
    """Return per-category toxicity scores matching the TF.js model output."""
    lowered = text.lower()

    def _score(keywords):
        hits = sum(1 for kw in keywords if kw in lowered)
        if hits == 0:
            return 0.05
        return min(1.0, 0.3 + hits * 0.2)

    return {
        "toxicity": detect_toxicity(text),
        "severe_toxicity": _score(SEVERE_TOXIC_KEYWORDS),
        "identity_attack": _score(IDENTITY_HATE_KEYWORDS),
        "threat": _score(THREAT_KEYWORDS),
        "insult": _score(INSULT_KEYWORDS),
        "obscene": _score(GENDER_ABUSE_KEYWORDS),
    }


def detect_gender_abuse(text: str) -> Optional[str]:
    """
    Simple keyword-based gender harassment detector.
    """
    lowered = text.lower()
    for kw in GENDER_ABUSE_KEYWORDS:
        if kw in lowered:
            return "gender_harassment"
    return None


def compute_severity(toxicity_score: float) -> str:
    """
    Map toxicity score to severity band.
    """
    if toxicity_score > 0.8:
        return "HIGH"
    if toxicity_score > 0.5:
        return "MEDIUM"
    return "LOW"


def check_image_safety(file_bytes: bytes) -> Dict[str, Any]:
    """
    Mock NSFW image checker.
    """
    # Very naive heuristic: base on file size.
    size = len(file_bytes)
    nsfw = size % 2 == 0
    confidence = 0.7 if nsfw else 0.3
    return {"nsfw": nsfw, "confidence": confidence}


def detect_deepfake(file_bytes: bytes) -> Dict[str, Any]:
    """
    Mock deepfake detector.
    """
    size = len(file_bytes)
    deepfake = size % 5 == 0
    confidence = 0.8 if deepfake else 0.2
    return {"deepfake": deepfake, "confidence": confidence}


def evaluate_text_incident(text: str, platform: str, username: str, db) -> Dict[str, Any]:
    """
    Run text analysis and determine incident metadata.
    """
    toxicity_score = detect_toxicity(text)
    abuse_type = detect_gender_abuse(text) or "harassment"
    severity = compute_severity(toxicity_score)

    # Repeat offender logic – if user already appears 3+ times
    count = db["incidents"].count_documents({"username": username})
    repeat_offender_flag = count >= 3

    return {
        "toxicity_score": toxicity_score,
        "abuse_type": abuse_type,
        "severity": severity,
        "repeat_offender_flag": repeat_offender_flag,
    }

