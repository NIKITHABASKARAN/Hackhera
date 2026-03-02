from typing import List, Optional


def generate_suggestions(platform: str, severity: str, abuse_type: Optional[str]) -> List[str]:
    """
    Generate platform- and severity-specific safety recommendations.
    """
    platform_lower = platform.lower()
    suggestions: List[str] = []

    if "instagram" in platform_lower:
        suggestions.extend(
            [
                "Use Instagram's 'Restrict' feature to limit interactions.",
                "Hide offensive words using the 'Hidden Words' safety settings.",
                "Report the account and individual posts to Instagram.",
            ]
        )
    elif "twitter" in platform_lower or "x" == platform_lower:
        suggestions.extend(
            [
                "Mute or block the abusive account.",
                "Limit who can reply to your posts.",
                "Report the tweet and profile for harassment.",
            ]
        )
    elif "whatsapp" in platform_lower:
        suggestions.extend(
            [
                "Block the sender to stop further messages.",
                "Report the contact or group to WhatsApp.",
                "Leave the group if the abuse happens in group chats.",
            ]
        )
    elif "facebook" in platform_lower:
        suggestions.extend(
            [
                "Unfriend or block the abusive account.",
                "Adjust your privacy settings to limit who can contact you.",
                "Report the content and profile to Facebook.",
            ]
        )
    elif "snapchat" in platform_lower:
        suggestions.extend(
            [
                "Block the user and prevent them from viewing your stories.",
                "Limit who can contact you in privacy settings.",
                "Report the snap or account to Snapchat.",
            ]
        )
    elif "youtube" in platform_lower:
        suggestions.extend(
            [
                "Block the user from commenting on your channel.",
                "Use moderation tools to filter abusive comments.",
                "Report abusive content or channels to YouTube.",
            ]
        )
    else:
        suggestions.append("Use the platform's block and report tools to stop further abuse.")

    severity_upper = severity.upper()
    if severity_upper == "HIGH":
        suggestions.extend(
            [
                "Collect and safely store evidence (screenshots, URLs, timestamps).",
                "Consider contacting local cybercrime or law enforcement units.",
                "Reach out to trusted friends, family, or support organizations.",
            ]
        )
    elif severity_upper == "MEDIUM":
        suggestions.append(
            "Monitor the situation and escalate to formal reporting channels if the abuse continues."
        )
    else:
        suggestions.append(
            "Use built-in safety controls early to prevent escalation (mute, restrict, block)."
        )

    if abuse_type == "gender_harassment":
        suggestions.append(
            "If abuse targets your gender, consider reaching out to women’s digital safety NGOs for specialised support."
        )

    # Remove duplicates while preserving order.
    seen = set()
    unique: List[str] = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique

