from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from db.mongo import get_db
from models.incident_model import incident_from_mongo
from services.analyzer import evaluate_text_incident


router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
def analyze_text(payload: Dict[str, Any]):
    """
    Endpoint intended for the browser extension to send flagged text.
    Expected JSON payload:
      - platform: str
      - username: str
      - text: str
      - evidence_url: Optional[str]
    """
    platform: Optional[str] = payload.get("platform")
    username: Optional[str] = payload.get("username")
    text: Optional[str] = payload.get("text")
    evidence_url: Optional[str] = payload.get("evidence_url")

    if not platform or not username or not text:
        raise HTTPException(status_code=400, detail="platform, username and text are required.")

    db = get_db()
    analysis = evaluate_text_incident(text=text, platform=platform, username=username, db=db)

    incident_doc: Dict[str, Any] = {
        "platform": platform,
        "username": username,
        "text": text,
        "evidence_url": evidence_url,
        "toxicity_score": analysis["toxicity_score"],
        "abuse_type": analysis["abuse_type"],
        "deepfake_detected": False,
        "severity": analysis["severity"],
        "timestamp": datetime.now(timezone.utc),
        "repeat_offender_flag": analysis["repeat_offender_flag"],
    }

    result = db["incidents"].insert_one(incident_doc)
    inserted = db["incidents"].find_one({"_id": result.inserted_id})

    if not inserted:
        raise HTTPException(status_code=500, detail="Failed to persist incident.")

    return incident_from_mongo(inserted)

