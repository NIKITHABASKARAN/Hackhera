from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from db.mongo import get_db
from models.incident_model import incident_from_mongo
from services.recommender import generate_suggestions
from services.report_generator import generate_incident_report


router = APIRouter(tags=["incidents"])


@router.get("/incidents")
def list_incidents(limit: int = 100, skip: int = 0):
    db = get_db()
    cursor = db["incidents"].find({}).skip(skip).limit(limit).sort("timestamp", -1)
    incidents: List[dict] = [incident_from_mongo(doc) for doc in cursor]
    return incidents


@router.get("/incident/{incident_id}")
def get_incident(incident_id: str):
    db = get_db()
    try:
        oid = ObjectId(incident_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid incident id.")

    doc = db["incidents"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    incident = incident_from_mongo(doc)
    incident["suggestions"] = generate_suggestions(
        platform=incident.get("platform") or "",
        severity=incident.get("severity") or "LOW",
        abuse_type=incident.get("abuse_type"),
    )
    return incident


@router.get("/report/{incident_id}")
def download_report(incident_id: str):
    db = get_db()
    try:
        oid = ObjectId(incident_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid incident id.")

    doc = db["incidents"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    incident = incident_from_mongo(doc)
    suggestions = generate_suggestions(
        platform=incident.get("platform") or "",
        severity=incident.get("severity") or "LOW",
        abuse_type=incident.get("abuse_type"),
    )
    pdf_bytes = generate_incident_report(incident, suggestions)

    filename = f"incident-{incident_id}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

