from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from db.mongo import get_db
from models.incident_model import incident_from_mongo
from services.analyzer import (
    check_image_safety,
    detect_deepfake,
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
    Upload endpoint for screenshots/images/videos and optional context.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload.")

    db = get_db()

    image_result = check_image_safety(contents)
    deepfake_result = detect_deepfake(contents)

    harassment_detected = False
    analysis: Dict[str, Any] = {
        "toxicity_score": None,
        "abuse_type": None,
        "severity": None,
        "repeat_offender_flag": False,
    }

    if text and platform and username:
        text_analysis = evaluate_text_incident(text=text, platform=platform, username=username, db=db)
        analysis.update(text_analysis)
        harassment_detected = text_analysis["toxicity_score"] > 0.5

    incident_doc: Dict[str, Any] = {
        "platform": platform or "Unknown",
        "username": username or "Unknown",
        "text": text,
        "evidence_url": None,
        "toxicity_score": analysis["toxicity_score"],
        "abuse_type": analysis["abuse_type"],
        "deepfake_detected": deepfake_result["deepfake"],
        "severity": analysis["severity"] or ("HIGH" if image_result["nsfw"] else "LOW"),
        "timestamp": datetime.now(timezone.utc),
        "repeat_offender_flag": analysis["repeat_offender_flag"],
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
            "nsfw": image_result["nsfw"],
        }
    )
    return response

