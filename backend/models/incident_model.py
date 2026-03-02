from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from pydantic import BaseModel, Field


class Incident(BaseModel):
    id: str = Field(alias="id")
    platform: str
    username: str
    text: Optional[str] = None
    evidence_url: Optional[str] = None
    toxicity_score: Optional[float] = None
    abuse_type: Optional[str] = None
    deepfake_detected: Optional[bool] = None
    severity: Optional[str] = None
    timestamp: Optional[datetime] = None
    repeat_offender_flag: bool = False

    class Config:
        allow_population_by_field_name = True


def incident_from_mongo(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a raw MongoDB document into a serializable dict for API responses.
    """
    data: Dict[str, Any] = {}
    data["id"] = str(doc.get("_id")) if doc.get("_id") is not None else None
    data["platform"] = doc.get("platform")
    data["username"] = doc.get("username")
    data["text"] = doc.get("text")
    data["evidence_url"] = doc.get("evidence_url")
    data["toxicity_score"] = doc.get("toxicity_score")
    data["abuse_type"] = doc.get("abuse_type")
    data["deepfake_detected"] = doc.get("deepfake_detected")
    data["severity"] = doc.get("severity")
    ts = doc.get("timestamp")
    if isinstance(ts, datetime):
        data["timestamp"] = ts
    else:
        data["timestamp"] = None
    data["repeat_offender_flag"] = bool(doc.get("repeat_offender_flag", False))
    return data


def seed_demo_data(db):
    """
    Insert a few demo incidents if the collection is empty.
    """
    collection = db["incidents"]
    if collection.count_documents({}) > 0:
        return

    demo_incidents = [
        {
            "platform": "Instagram",
            "username": "toxic_user_1",
            "text": "You don't belong here, just go away.",
            "evidence_url": None,
            "toxicity_score": 0.85,
            "abuse_type": "harassment",
            "deepfake_detected": False,
            "severity": "HIGH",
            "timestamp": datetime.utcnow(),
            "repeat_offender_flag": False,
        },
        {
            "platform": "Twitter",
            "username": "repeat_abuser",
            "text": "You are worthless.",
            "evidence_url": None,
            "toxicity_score": 0.9,
            "abuse_type": "gender_harassment",
            "deepfake_detected": False,
            "severity": "HIGH",
            "timestamp": datetime.utcnow(),
            "repeat_offender_flag": True,
        },
        {
            "platform": "WhatsApp",
            "username": "friend_123",
            "text": "This might be a joke but it sounds harsh.",
            "evidence_url": None,
            "toxicity_score": 0.55,
            "abuse_type": "harassment",
            "deepfake_detected": False,
            "severity": "MEDIUM",
            "timestamp": datetime.utcnow(),
            "repeat_offender_flag": False,
        },
    ]

    collection.insert_many(demo_incidents)

