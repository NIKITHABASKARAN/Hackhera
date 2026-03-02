from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List


def detect_coordinated_patterns(db) -> Dict[str, Any]:
    """Analyze extension_reports for coordinated abuse patterns."""
    reports_col = db["extension_reports"]
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)

    alerts = []

    repeat_pipeline = [
        {"$group": {"_id": "$username_hash", "count": {"$sum": 1}, "platforms": {"$addToSet": "$platform"}}},
        {"$match": {"count": {"$gte": 3}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    repeat_offenders = list(reports_col.aggregate(repeat_pipeline))
    for offender in repeat_offenders:
        alert_data = {
            "type": "repeat_offender",
            "username_hash": offender["_id"],
            "count": offender["count"],
            "platforms": offender["platforms"],
            "message": f"User flagged {offender['count']} times across {len(offender['platforms'])} platform(s)",
        }
        alerts.append(alert_data)

        if len(offender["platforms"]) > 1:
            alerts.append({
                "type": "multi_platform",
                "username_hash": offender["_id"],
                "platforms": offender["platforms"],
                "message": f"Cross-platform abuse detected: {', '.join(offender['platforms'])}",
            })

    recent_reports = list(reports_col.find(
        {"timestamp": {"$gte": one_hour_ago}},
        {"text": 1}
    ))
    if len(recent_reports) >= 10:
        alerts.append({
            "type": "frequency_spike",
            "count": len(recent_reports),
            "message": f"Spike: {len(recent_reports)} reports in the last hour",
        })

    recent_texts = [_normalize(r.get("text", "")) for r in recent_reports if r.get("text")]
    phrase_counts = Counter(recent_texts)
    for phrase, count in phrase_counts.most_common(10):
        if count >= 3:
            alerts.append({
                "type": "repeated_phrase",
                "phrase": phrase[:80],
                "count": count,
                "message": f'Phrase repeated {count} times: "{phrase[:50]}..."',
            })

    identity_pipeline = [
        {"$match": {"timestamp": {"$gte": one_day_ago}}},
        {
            "$project": {
                "has_identity_attack": {
                    "$gt": [{"$ifNull": ["$toxicity_scores.identity_attack", 0]}, 0.5]
                }
            }
        },
        {"$match": {"has_identity_attack": True}},
        {"$count": "total"},
    ]
    identity_result = list(reports_col.aggregate(identity_pipeline))
    identity_count = identity_result[0]["total"] if identity_result else 0
    if identity_count >= 5:
        alerts.append({
            "type": "identity_targeted",
            "count": identity_count,
            "message": f"{identity_count} identity-targeted attacks in the last 24 hours",
        })

    handle_pipeline = [
        {"$match": {"timestamp": {"$gte": one_day_ago}}},
        {"$group": {"_id": "$username_hash", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 2}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    handle_clusters = list(reports_col.aggregate(handle_pipeline))

    return {
        "alerts": alerts,
        "repeat_offenders": repeat_offenders,
        "handle_clusters": [
            {"hash": c["_id"][:12] + "...", "count": c["count"]}
            for c in handle_clusters
        ],
        "recent_spike_count": len(recent_reports),
        "identity_attack_count": identity_count,
    }


def _normalize(text: str) -> str:
    import re
    return re.sub(r"[^a-z0-9\s]", "", text.lower()).strip()[:100]
