from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from db.mongo import get_db
from models.incident_model import incident_from_mongo
from services.analyzer import (
    analyze_image_text,
    check_image_safety,
    compute_severity,
    detect_deepfake,
    detect_toxicity,
    detect_gender_abuse,
    evaluate_text_incident,
)


router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_evidence(
    file: UploadFile = File(...),
    platform: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
):
    """
    Upload endpoint for screenshots/images/videos and optional context text.

    Analysis pipeline:
    1. OCR: extract any text embedded in the image and run harassment detection.
    2. Manual text: if the user also typed context, analyse that too.
    3. Merge results, taking the worst-case severity across both sources.
    4. Run mock deepfake + NSFW image checks.
    5. Persist to MongoDB and return the full analysis.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload.")

    db = get_db()

    # ── 1. Image-level checks ────────────────────────────────────────────────
    image_safety = check_image_safety(contents)
    deepfake_result = detect_deepfake(contents)

    # ── 2. OCR — read text embedded in the image ─────────────────────────────
    ocr_analysis = analyze_image_text(contents)
    ocr_text: str = ocr_analysis["ocr_text"]
    ocr_harassment: bool = ocr_analysis["harassment_detected"]
    ocr_categories: list = ocr_analysis["harassment_categories"]
    flagged_words: list = ocr_analysis["flagged_words"]

    # ── 3. Manual context text (if provided) ─────────────────────────────────
    manual_analysis: Dict[str, Any] = {}
    if text and text.strip():
        manual_tox = detect_toxicity(text)
        manual_abuse = detect_gender_abuse(text) or "harassment"
        manual_severity = compute_severity(manual_tox)
        count = db["incidents"].count_documents({"username": username or "Unknown"})
        manual_analysis = {
            "toxicity_score": manual_tox,
            "abuse_type": manual_abuse,
            "severity": manual_severity,
            "repeat_offender_flag": count >= 3,
        }

    # ── 4. Merge OCR + manual into a single verdict ───────────────────────────
    severity_rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

    ocr_sev = ocr_analysis["severity"]
    manual_sev = manual_analysis.get("severity", "LOW")
    nsfw_sev = "HIGH" if image_safety["nsfw"] else "LOW"
    deepfake_sev = "HIGH" if deepfake_result["deepfake"] else "LOW"

    final_severity = max(
        [ocr_sev, manual_sev, nsfw_sev, deepfake_sev],
        key=lambda s: severity_rank.get(s, 0),
    )

    harassment_detected = (
        ocr_harassment
        or manual_analysis.get("toxicity_score", 0) > 0.5
        or deepfake_result["deepfake"]
    )

    # Merge category labels from both sources
    all_categories = list(set(ocr_categories + ([manual_analysis.get("abuse_type")] if manual_analysis.get("abuse_type") else [])))

    # Primary abuse type: prefer specific OCR category over generic manual label
    abuse_type = (
        ocr_analysis["abuse_type"]
        or manual_analysis.get("abuse_type")
        or ("deepfake" if deepfake_result["deepfake"] else None)
        or ("nsfw" if image_safety["nsfw"] else "harassment")
    )

    toxicity_score = max(
        ocr_analysis["toxicity_score"],
        manual_analysis.get("toxicity_score", 0.0),
    )

    # Combined text stored for record: manual text + OCR text
    combined_text = "\n\n".join(filter(None, [text, f"[OCR] {ocr_text}" if ocr_text else None]))

    # ── 5. Persist incident ───────────────────────────────────────────────────
    incident_doc: Dict[str, Any] = {
        "platform": platform or "Unknown",
        "username": username or "Unknown",
        "text": combined_text or None,
        "evidence_url": None,
        "toxicity_score": round(toxicity_score, 3),
        "abuse_type": abuse_type,
        "deepfake_detected": deepfake_result["deepfake"],
        "severity": final_severity,
        "timestamp": datetime.now(timezone.utc),
        "repeat_offender_flag": manual_analysis.get("repeat_offender_flag", False),
        "ocr_text": ocr_text or None,
        "harassment_categories": all_categories,
        "flagged_words": flagged_words,
        "ocr_available": ocr_analysis["ocr_available"],
    }

    result = db["incidents"].insert_one(incident_doc)
    inserted = db["incidents"].find_one({"_id": result.inserted_id})

    if not inserted:
        raise HTTPException(status_code=500, detail="Failed to persist incident from upload.")

    response = incident_from_mongo(inserted)
    response.update(
        {
            "deepfake_detected": deepfake_result["deepfake"],
            "harassment_detected": harassment_detected,
            "nsfw": image_safety["nsfw"],
            "severity": final_severity,
            "ocr_text": ocr_text,
            "ocr_available": ocr_analysis["ocr_available"],
            "harassment_categories": all_categories,
            "flagged_words": flagged_words,
            "abuse_type": abuse_type,
            "toxicity_score": round(toxicity_score, 3),
        }
    )
    return response
