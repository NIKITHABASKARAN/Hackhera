from io import BytesIO
from typing import Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def generate_incident_report(incident: Dict, suggestions: List[str]) -> bytes:
    """
    Create a simple one-page PDF summarizing an incident and recommendations.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "ALETHEIA – Incident Report")
    y -= 40

    c.setFont("Helvetica", 11)
    fields = [
        ("Platform", incident.get("platform") or ""),
        ("Username", incident.get("username") or ""),
        ("Timestamp", str(incident.get("timestamp") or "")),
        ("Abuse Type", incident.get("abuse_type") or ""),
        ("Severity", incident.get("severity") or ""),
        ("Deepfake Detected", str(incident.get("deepfake_detected") or False)),
        ("Repeat Offender", str(incident.get("repeat_offender_flag") or False)),
    ]

    for label, value in fields:
        c.drawString(50, y, f"{label}: {value}")
        y -= 18

    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Recommendations:")
    y -= 20

    c.setFont("Helvetica", 11)
    for s in suggestions:
        text_lines = c.beginText(60, y)
        text_lines.textLines(f"- {s}")
        c.drawText(text_lines)
        y -= 32
        if y < 80:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 11)

    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

