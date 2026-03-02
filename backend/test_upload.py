"""Quick smoke test for the /upload endpoint."""
from PIL import Image, ImageDraw
import io, json, http.client

img = Image.new("RGB", (500, 120), color="white")
d = ImageDraw.Draw(img)
d.text((10, 10), "you are ugly and pathetic kill yourself", fill="black")
d.text((10, 50), "i know where you live you worthless loser", fill="black")
buf = io.BytesIO()
img.save(buf, format="PNG")
img_bytes = buf.getvalue()

boundary = "boundary123"
body = (
    b"--boundary123\r\nContent-Disposition: form-data; name=\"platform\"\r\n\r\nInstagram\r\n"
    b"--boundary123\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\ntestuser\r\n"
    b"--boundary123\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n"
    + img_bytes
    + b"\r\n--boundary123--"
)

conn = http.client.HTTPConnection("localhost", 8000)
conn.request(
    "POST", "/upload", body,
    {"Content-Type": "multipart/form-data; boundary=boundary123"}
)
resp = conn.getresponse()
data = resp.read()
print("HTTP status:", resp.status)
try:
    print(json.dumps(json.loads(data), indent=2))
except Exception:
    print(data.decode())
