from __future__ import annotations

import io
from typing import Any, Dict, List, Optional

# ── OCR backend detection ────────────────────────────────────────────────────
# Priority 1: winocr  – uses Windows 10/11 built-in OCR (no system binary)
# Priority 2: pytesseract – requires Tesseract binary to be installed
# Both require Pillow for image handling.

try:
    import winocr
    from PIL import Image
    _OCR_BACKEND = "winocr"
except ImportError:
    winocr = None  # type: ignore
    try:
        import pytesseract
        from PIL import Image
        _OCR_BACKEND = "pytesseract"
    except ImportError:
        pytesseract = None  # type: ignore
        _OCR_BACKEND = "none"

OCR_AVAILABLE = _OCR_BACKEND != "none"


# ---------------------------------------------------------------------------
# Keyword banks
# ---------------------------------------------------------------------------

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
    "you will regret", "making you pay", "you're dead",
]

IDENTITY_HATE_KEYWORDS = [
    "go back to your country", "terrorist", "monkey", "ape",
    "subhuman", "inferior", "breed", "plague", "go back to where you came from",
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

DOXXING_KEYWORDS = [
    "your address", "i know where you live", "found your home",
    "posted your number", "your phone number", "leaked your",
    "exposed you", "your location", "know where you work",
    "sharing your info", "doxxed", "your real name is",
]

STALKING_KEYWORDS = [
    "been watching you", "i saw you today", "following you",
    "i know your schedule", "i was outside", "saw you at",
    "tracking you", "i know where you go", "been outside your",
]

EXPLICIT_CONTENT_KEYWORDS = [
    "nude", "naked", "send nudes", "send pics", "explicit", "sex tape",
    "intimate photos", "private photos", "leaked photos", "revenge porn",
    "non-consensual", "without consent",
]

DEEPFAKE_MENTION_KEYWORDS = [
    "fake photo", "fake video", "edited your face", "morphed",
    "faceswap", "deepfake", "ai generated photo", "your face on",
]

_ALL_KEYWORDS: List[str] = (
    TOXIC_KEYWORDS
    + SEVERE_TOXIC_KEYWORDS
    + THREAT_KEYWORDS
    + IDENTITY_HATE_KEYWORDS
    + INSULT_KEYWORDS
    + GENDER_ABUSE_KEYWORDS
    + DOXXING_KEYWORDS
    + STALKING_KEYWORDS
    + EXPLICIT_CONTENT_KEYWORDS
    + DEEPFAKE_MENTION_KEYWORDS
)


# ---------------------------------------------------------------------------
# Text analysis helpers
# ---------------------------------------------------------------------------

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
    """Simple keyword-based gender harassment detector."""
    lowered = text.lower()
    for kw in GENDER_ABUSE_KEYWORDS:
        if kw in lowered:
            return "gender_harassment"
    return None


def compute_severity(toxicity_score: float) -> str:
    """Map toxicity score to severity band."""
    if toxicity_score > 0.8:
        return "HIGH"
    if toxicity_score > 0.5:
        return "MEDIUM"
    return "LOW"


def _extract_flagged_words(text: str) -> List[str]:
    """Return all flagged keywords found in the text."""
    lowered = text.lower()
    return list({kw for kw in _ALL_KEYWORDS if kw in lowered})


def _build_harassment_categories(scores: Dict[str, float], text: str) -> List[str]:
    """Derive human-readable harassment category labels from scores + keywords."""
    lowered = text.lower()
    categories: List[str] = []

    if scores.get("threat", 0) > 0.3 or any(k in lowered for k in THREAT_KEYWORDS):
        categories.append("threat")
    if scores.get("identity_attack", 0) > 0.3 or any(k in lowered for k in IDENTITY_HATE_KEYWORDS):
        categories.append("identity_attack")
    if scores.get("obscene", 0) > 0.3 or any(k in lowered for k in GENDER_ABUSE_KEYWORDS):
        categories.append("gender_abuse")
    if scores.get("insult", 0) > 0.3 or any(k in lowered for k in INSULT_KEYWORDS):
        categories.append("harassment")
    if scores.get("severe_toxicity", 0) > 0.3 or any(k in lowered for k in SEVERE_TOXIC_KEYWORDS):
        categories.append("severe_harassment")
    if any(k in lowered for k in DOXXING_KEYWORDS):
        categories.append("doxxing")
    if any(k in lowered for k in STALKING_KEYWORDS):
        categories.append("stalking")
    if any(k in lowered for k in EXPLICIT_CONTENT_KEYWORDS):
        categories.append("explicit_content")
    if any(k in lowered for k in DEEPFAKE_MENTION_KEYWORDS):
        categories.append("deepfake_mention")

    return list(set(categories))


# ---------------------------------------------------------------------------
# OCR + image text analysis
# ---------------------------------------------------------------------------

def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Extract text from an image using the best available OCR backend.

    Backend priority:
    1. winocr  (Windows built-in OCR — no extra system install)
    2. pytesseract (requires Tesseract binary)

    Returns an empty string if no OCR backend is available or extraction fails.
    """
    if not OCR_AVAILABLE:
        return ""

    try:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

        if _OCR_BACKEND == "winocr":
            # recognize_pil_sync returns a picklified dict with a top-level "text" key
            result = winocr.recognize_pil_sync(img.convert("RGBA"), "en")
            return (result.get("text") or "").strip()

        if _OCR_BACKEND == "pytesseract":
            return pytesseract.image_to_string(img, config="--psm 6").strip()

    except Exception:
        return ""

    return ""


def analyze_image_text(file_bytes: bytes) -> Dict[str, Any]:
    """
    Run OCR on an image then analyse the extracted text for harassment,
    threats, doxxing, explicit content, etc.

    Returns a dict with:
      ocr_text            – raw text extracted from the image
      ocr_available       – whether Tesseract/pytesseract is installed
      harassment_detected – bool
      harassment_categories – list of category labels
      flagged_words       – specific words that triggered flags
      toxicity_score      – 0–1 float
      severity            – LOW / MEDIUM / HIGH
      abuse_type          – primary abuse label
    """
    ocr_text = extract_text_from_image(file_bytes)

    base: Dict[str, Any] = {
        "ocr_text": ocr_text,
        "ocr_available": OCR_AVAILABLE,
        "harassment_detected": False,
        "harassment_categories": [],
        "flagged_words": [],
        "toxicity_score": 0.0,
        "severity": "LOW",
        "abuse_type": None,
    }

    if not ocr_text:
        return base

    scores = detect_toxicity_detailed(ocr_text)
    categories = _build_harassment_categories(scores, ocr_text)
    flagged = _extract_flagged_words(ocr_text)
    tox = scores["toxicity"]

    # Escalate severity when severe categories are present
    severity = compute_severity(tox)
    high_risk_cats = {"threat", "severe_harassment", "doxxing", "stalking", "explicit_content"}
    if high_risk_cats.intersection(categories):
        severity = "HIGH"

    base.update({
        "harassment_detected": len(categories) > 0 or tox > 0.3,
        "harassment_categories": categories,
        "flagged_words": flagged,
        "toxicity_score": round(tox, 3),
        "severity": severity,
        "abuse_type": categories[0] if categories else ("harassment" if tox > 0.3 else None),
    })
    return base


# ---------------------------------------------------------------------------
# Image binary checks (mock detectors — kept for continuity)
# ---------------------------------------------------------------------------

def check_image_safety(file_bytes: bytes) -> Dict[str, Any]:
    """Mock NSFW image checker (placeholder — no real ML model)."""
    size = len(file_bytes)
    nsfw = size % 2 == 0
    confidence = 0.7 if nsfw else 0.3
    return {"nsfw": nsfw, "confidence": confidence}


def detect_deepfake(file_bytes: bytes) -> Dict[str, Any]:
    """Mock deepfake detector (placeholder — no real ML model)."""
    size = len(file_bytes)
    deepfake = size % 5 == 0
    confidence = 0.8 if deepfake else 0.2
    return {"deepfake": deepfake, "confidence": confidence}


# ---------------------------------------------------------------------------
# Text-only incident evaluator (used by /analyze route)
# ---------------------------------------------------------------------------

def evaluate_text_incident(text: str, platform: str, username: str, db) -> Dict[str, Any]:
    """Run text analysis and determine incident metadata."""
    toxicity_score = detect_toxicity(text)
    abuse_type = detect_gender_abuse(text) or "harassment"
    severity = compute_severity(toxicity_score)

    count = db["incidents"].count_documents({"username": username})
    repeat_offender_flag = count >= 3

    return {
        "toxicity_score": toxicity_score,
        "abuse_type": abuse_type,
        "severity": severity,
        "repeat_offender_flag": repeat_offender_flag,
    }
