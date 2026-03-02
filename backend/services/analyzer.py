from __future__ import annotations

from typing import Any, Dict, Optional


TOXIC_KEYWORDS = [
    "hate",
    "stupid",
    "idiot",
    "worthless",
    "kill",
    "die",
    "slut",
    "bitch",
]

GENDER_ABUSE_KEYWORDS = [
    "she should",
    "go back to kitchen",
    "women like you",
    "girl like you",
    "slut",
    "bitch",
]


def detect_toxicity(text: str) -> float:
    """
    Mock toxicity detection.

    Counts toxic keywords and maps them to a score between 0 and 1.
    """
    lowered = text.lower()
    hits = sum(1 for kw in TOXIC_KEYWORDS if kw in lowered)
    if hits == 0:
        return 0.1
    score = 0.3 + hits * 0.15
    return max(0.0, min(1.0, score))


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

