from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.mongo import get_db
from services.pattern_detector import detect_coordinated_patterns


router = APIRouter(prefix="/extension", tags=["extension"])


class ExtensionReport(BaseModel):
    anonymous_reporter_id: str
    platform: str
    username: Optional[str] = None
    username_hash: str
    text: str
    toxicity_scores: Optional[Dict[str, float]] = None
    risk_score: Optional[float] = None
    severity: Optional[str] = None
    page_url: Optional[str] = None
    source: str = "extension"
    timestamp: Optional[str] = None


@router.post("/report")
def submit_report(report: ExtensionReport):
    db = get_db()

    # Deduplicate: avoid duplicate rows when extension re-syncs stored items
    existing = db["extension_reports"].find_one(
        {
            "anonymous_reporter_id": report.anonymous_reporter_id,
            "username_hash": report.username_hash,
            "text": report.text or "",
        }
    )
    if existing:
        return {
            "status": "already_reported",
            "report_id": str(existing["_id"]),
            "repeat_offender": existing.get("repeat_offender_flag", False),
        }

    report_doc = {
        "anonymous_reporter_id": report.anonymous_reporter_id,
        "platform": report.platform,
        "username": report.username,
        "username_hash": report.username_hash,
        "text": report.text,
        "toxicity_scores": report.toxicity_scores or {},
        "risk_score": report.risk_score or 0,
        "severity": report.severity or "LOW",
        "page_url": report.page_url,
        "source": "extension",
        "timestamp": datetime.now(timezone.utc),
    }

    user_report_count = db["extension_reports"].count_documents(
        {"username_hash": report.username_hash}
    )
    report_doc["repeat_offender_flag"] = user_report_count >= 4

    result = db["extension_reports"].insert_one(report_doc)

    incident_doc = {
        "platform": report.platform,
        "username": report.username_hash[:12] + "...",
        "text": report.text[:500],
        "evidence_url": report.page_url,
        "toxicity_score": report.toxicity_scores.get("toxicity", 0) if report.toxicity_scores else 0,
        "abuse_type": _determine_abuse_type(report.toxicity_scores),
        "deepfake_detected": False,
        "severity": report.severity or "LOW",
        "timestamp": datetime.now(timezone.utc),
        "repeat_offender_flag": report_doc["repeat_offender_flag"],
        "source": "extension",
        "anonymous_reporter_id": report.anonymous_reporter_id,
    }

    db["incidents"].insert_one(incident_doc)

    if report_doc["repeat_offender_flag"]:
        _check_and_flag_user(db, report.username_hash)

    return {
        "status": "reported",
        "report_id": str(result.inserted_id),
        "repeat_offender": report_doc["repeat_offender_flag"],
    }


@router.get("/stats")
def get_extension_stats():
    db = get_db()

    total_reports = db["extension_reports"].count_documents({})
    total_incidents = db["incidents"].count_documents({})
    ext_incidents = db["incidents"].count_documents({"source": "extension"})

    severity_pipeline = [
        {"$match": {"source": "extension"}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
    ]
    severity_dist = {
        doc["_id"]: doc["count"]
        for doc in db["extension_reports"].aggregate(severity_pipeline)
    }

    platform_pipeline = [
        {"$match": {"source": "extension"}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    platform_dist = {
        doc["_id"]: doc["count"]
        for doc in db["extension_reports"].aggregate(platform_pipeline)
    }

    top_offenders_pipeline = [
        {"$group": {"_id": "$username_hash", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_offenders = [
        {"hash": doc["_id"][:12] + "...", "count": doc["count"]}
        for doc in db["extension_reports"].aggregate(top_offenders_pipeline)
    ]

    repeat_offenders = db["extension_reports"].aggregate([
        {"$group": {"_id": "$username_hash", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 3}}},
        {"$count": "total"},
    ])
    repeat_count = 0
    for doc in repeat_offenders:
        repeat_count = doc.get("total", 0)

    return {
        "total_reports": total_reports,
        "backend_incidents": total_incidents,
        "extension_incidents": ext_incidents,
        "severity_distribution": severity_dist,
        "platform_distribution": platform_dist,
        "top_offenders": top_offenders,
        "repeat_offender_count": repeat_count,
    }


def _determine_abuse_type(scores: Optional[Dict[str, float]]) -> str:
    if not scores:
        return "harassment"

    type_mapping = {
        "identity_attack": "identity_hate",
        "threat": "threat",
        "severe_toxicity": "severe_harassment",
        "insult": "insult",
        "obscene": "obscene",
    }

    best_type = "harassment"
    best_score = 0

    for key, label in type_mapping.items():
        if scores.get(key, 0) > best_score:
            best_score = scores[key]
            best_type = label

    return best_type


@router.get("/patterns")
def get_patterns():
    db = get_db()
    return detect_coordinated_patterns(db)


def _check_and_flag_user(db, username_hash: str):
    count = db["extension_reports"].count_documents({"username_hash": username_hash})
    if count >= 5:
        db["flagged_users"].update_one(
            {"username_hash": username_hash},
            {
                "$set": {
                    "username_hash": username_hash,
                    "report_count": count,
                    "status": "action_required",
                    "last_updated": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )
