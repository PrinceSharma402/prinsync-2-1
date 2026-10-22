import io
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import zxingcpp
from PIL import Image

BASE = "http://127.0.0.1:8000"
HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

passed = 0
failed = []


def check(name, condition, detail=""):
    global passed
    if condition:
        passed += 1
        print("PASS  {}".format(name))
    else:
        failed.append("{}  -> {}".format(name, detail))
        print("FAIL  {}  -> {}".format(name, detail))


def post_multipart(path, fields, files=None):
    boundary = "----prinsyncQAboundary"
    body = b""
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, bool):
            value = "true" if value else "false"
        body += (
            '--{}\r\nContent-Disposition: form-data; name="{}"\r\n\r\n{}\r\n'.format(
                boundary, key, value
            )
        ).encode("utf-8")
    for key, (filename, content, ctype) in (files or {}).items():
        body += (
            '--{}\r\nContent-Disposition: form-data; name="{}"; filename="{}"\r\n'
            "Content-Type: {}\r\n\r\n".format(boundary, key, filename, ctype)
        ).encode("utf-8") + content + b"\r\n"
    body += "--{}--\r\n".format(boundary).encode("utf-8")

    request = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary},
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


def get_json(path):
    with urllib.request.urlopen(BASE + path) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def qr(fields, files=None):
    return post_multipart("/generate-qr", fields, files)


def barcode(fields):
    return post_multipart("/generate-barcode", fields)


def png_image(data):
    return Image.open(io.BytesIO(data))


def decode_image(data, label):
    image = png_image(data).convert("RGB")
    results = zxingcpp.read_barcodes(image)
    text = results[0].text if results else None
    image.save(OUT / (label + ".png"))
    return text


logo_png = (HERE / "logo_test.png").read_bytes()
logo_jpg = (HERE / "logo_test.jpg").read_bytes()
broken = (HERE / "not_an_image.png").read_bytes()

print("=" * 70)
print("1. BASIC ENDPOINTS")
print("=" * 70)

status, info = get_json("/")
check("GET / returns API info", status == 200 and info["name"] == "PrinSync 2.1 API", str(info))

status, health = get_json("/health")
check("GET /health returns ok", status == 200 and health["status"] == "ok", str(health))

print()
print("=" * 70)
print("2. QR GENERATION + DECODE (real scanner test)")
print("=" * 70)

status, headers, data = qr({"data_type": "text", "text": "Hello PrinSync 2.1"})
check("text QR: status 200", status == 200, str(data[:200]))
check("text QR: content-type image/png", headers.get("content-type") == "image/png", str(headers.get("content-type")))
check("text QR: PNG signature", data[:8] == b"\x89PNG\r\n\x1a\n", str(data[:8]))
check("text QR: decodes back to text", decode_image(data, "qr_text") == "Hello PrinSync 2.1",
      str(decode_image(data, "qr_text")))
check("text QR: filename header", "prinsync-qr-text-" in headers.get("content-disposition", ""),
      headers.get("content-disposition", ""))

status, headers, data = qr({"data_type": "url", "url": "google.com"})
check("url QR: status 200", status == 200, str(data[:200]))
decoded = decode_image(data, "qr_url")
check("url QR: https:// auto-added", decoded == "https://google.com", str(decoded))

status, headers, data = qr({"data_type": "url", "url": "https://github.com/torvalds"})
decoded = decode_image(data, "qr_url_full")
check("url QR: full url kept", decoded == "https://github.com/torvalds", str(decoded))

status, headers, data = qr({
    "data_type": "wifi",
    "wifi_ssid": "MyHome;WiFi",
    "wifi_password": "pass:123",
    "wifi_encryption": "WPA",
    "wifi_hidden": False,
})
check("wifi QR: status 200", status == 200, str(data[:200]))
decoded = decode_image(data, "qr_wifi")
check("wifi QR: correct WIFI payload + escaping",
      decoded == "WIFI:T:WPA;S:MyHome\\;WiFi;P:pass\\:123;;", str(decoded))

status, headers, data = qr({
    "data_type": "wifi", "wifi_ssid": "OpenNet", "wifi_encryption": "nopass",
})
decoded = decode_image(data, "qr_wifi_open")
check("wifi QR: open network payload", decoded == "WIFI:T:nopass;S:OpenNet;;", str(decoded))

status, headers, data = qr({
    "data_type": "wifi", "wifi_ssid": "Hidden", "wifi_password": "12345678",
    "wifi_encryption": "WEP", "wifi_hidden": True,
})
decoded = decode_image(data, "qr_wifi_hidden")
check("wifi QR: hidden network flag", decoded == "WIFI:T:WEP;S:Hidden;P:12345678;H:true;;", str(decoded))

status, headers, data = qr({
    "data_type": "email", "email_to": "student@example.com",
    "email_subject": "Project Report", "email_body": "Hi Sir, please find the report.",
})
decoded = decode_image(data, "qr_email")
check("email QR: mailto payload", decoded ==
      "mailto:student@example.com?subject=Project%20Report&body=Hi%20Sir%2C%20please%20find%20the%20report.",
      str(decoded))

status, headers, data = qr({"data_type": "phone", "phone": "+91 98765 43210"})
decoded = decode_image(data, "qr_phone")
check("phone QR: tel payload", decoded == "tel:+919876543210", str(decoded))

status, headers, data = qr({
    "data_type": "contact", "contact_first_name": "Prince", "contact_last_name": "Kumar",
    "contact_phone": "9876543210", "contact_email": "prince@example.com",
    "contact_organization": "BCA College",
})
decoded = decode_image(data, "qr_contact")
expected = ("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Kumar;Prince;;;\r\nFN:Prince Kumar\r\n"
            "ORG:BCA College\r\nTEL;TYPE=CELL:9876543210\r\nEMAIL;TYPE=INTERNET:prince@example.com\r\n"
            "END:VCARD")
check("contact QR: vCard payload", decoded == expected, str(decoded))

print()
print("=" * 70)
print("3. QR COLOURS, SIZE, BORDER, ERROR LEVEL")
print("=" * 70)

status, headers, data = qr({
    "data_type": "text", "text": "Colour test",
    "foreground": "#1e5aa8", "background": "#fff3c4", "size": 500, "border": 2,
})
image = png_image(data).convert("RGB")
colours = image.getcolors(maxcolors=1000000)
colour_set = {colour for _, colour in colours}
check("colour QR: status 200", status == 200, str(data[:200]))
check("colour QR: uses requested foreground", (30, 90, 168) in colour_set, str(sorted(colour_set)[:5]))
check("colour QR: uses requested background", (255, 243, 196) in colour_set, str(sorted(colour_set)[:5]))
check("colour QR: size near requested 500",
      460 <= image.width <= 540 and image.width == image.height,
      "{}x{}".format(image.width, image.height))
check("colour QR: still decodes", decode_image(data, "qr_colour") == "Colour test")

status, headers, data = qr({"data_type": "text", "text": "Small border", "border": 0, "size": 200})
image = png_image(data)
check("border 0 accepted", status == 200 and 180 <= image.width <= 280,
      "{}x{}".format(image.width, image.height))

status, headers, data = qr({"data_type": "text", "text": "EC H", "error_level": "H"})
check("error level H accepted", status == 200 and decode_image(data, "qr_ec_h") == "EC H", "")

status, headers, data = qr({"data_type": "text", "text": "Short hex", "foreground": "#0a0"})
check("3-digit hex colour normalised", status == 200, str(data[:150]))
image = png_image(data).convert("RGB")
check("3-digit hex #0a0 -> (0,170,0)",
      (0, 170, 0) in {c for _, c in image.getcolors(maxcolors=1000000)}, "")

print()
print("=" * 70)
print("4. CENTER LOGO (mandatory feature)")
print("=" * 70)

status, headers, data = qr(
    {"data_type": "text", "text": "Logo test", "size": 400},
    {"logo": ("logo_test.png", logo_png, "image/png")},
)
check("logo QR: status 200", status == 200, str(data[:200]))
check("logo QR: note header explains error level change",
      "Error correction was set to H" in headers.get("X-Prinsync-Note", ""),
      headers.get("X-Prinsync-Note", "(missing)"))
with_logo = png_image(data).convert("RGB")
with_logo.save(OUT / "qr_with_logo.png")
check("logo QR: still decodes with logo present",
      decode_image(data, "qr_with_logo_decode") == "Logo test", "")
check("logo QR: image size near requested 400",
      360 <= with_logo.width <= 440, "{}x{}".format(*with_logo.size))

status, headers, plain = qr({"data_type": "text", "text": "Logo test", "size": 400,
                             "error_level": "H"})
plain_image = png_image(plain).convert("RGB")
plain_image.save(OUT / "qr_without_logo_H.png")
check("logo QR: same pixels size as plain EC-H QR", with_logo.size == plain_image.size,
      "{} vs {}".format(with_logo.size, plain_image.size))

total_pixels = with_logo.width * with_logo.height
different = sum(
    1
    for x in range(with_logo.width)
    for y in range(with_logo.height)
    if with_logo.getpixel((x, y)) != plain_image.getpixel((x, y))
)
covered_ratio = different / total_pixels
check("logo QR: logo only covers a small centre area (2%-10% of image)",
      0.02 <= covered_ratio <= 0.10, "covered {:.2%}".format(covered_ratio))

centre = (plain_image.width // 2, plain_image.height // 2)
check("logo QR: centre pixels differ from plain QR",
      with_logo.getpixel(centre) != plain_image.getpixel(centre), "")

min_x, min_y, max_x, max_y = with_logo.width, with_logo.height, -1, -1
for y in range(with_logo.height):
    for x in range(with_logo.width):
        red, green, blue = with_logo.getpixel((x, y))
        if not (red == green == blue):
            min_x, min_y = min(min_x, x), min(min_y, y)
            max_x, max_y = max(max_x, x), max(max_y, y)
logo_width, logo_height = max_x - min_x + 1, max_y - min_y + 1
ratio = logo_width / logo_height
check("logo QR: original aspect ratio kept (2:1 logo)",
      1.75 <= ratio <= 2.25 and logo_width > 30,
      "logo box {}x{} ratio {:.2f}".format(logo_width, logo_height, ratio))
check("logo QR: logo sits in the centre",
      abs((min_x + max_x) / 2 - with_logo.width / 2) < 8
      and abs((min_y + max_y) / 2 - with_logo.height / 2) < 8,
      "centre of logo = ({}, {})".format((min_x + max_x) / 2, (min_y + max_y) / 2))

status, headers, data = qr(
    {"data_type": "text", "text": "Logo H", "error_level": "H"},
    {"logo": ("logo_test.png", logo_png, "image/png")},
)
check("logo QR with error_level H: note still explains H",
      status == 200 and "error correction" in (headers.get("X-Prinsync-Note") or "").lower(),
      str(headers.get("X-Prinsync-Note")))

status, headers, data = qr(
    {"data_type": "text", "text": "JPEG logo"},
    {"logo": ("logo_test.jpg", logo_jpg, "image/jpeg")},
)
check("JPEG logo accepted", status == 200 and decode_image(data, "qr_logo_jpeg") == "JPEG logo",
      str(data[:200]))

status, headers, data = qr({"data_type": "text", "text": "Logo test", "size": 400,
                            "error_level": "H"})
no_logo_image = png_image(data).convert("RGB")
check("QR without logo: identical to a plain QR (logo fully removed)",
      status == 200 and no_logo_image.tobytes() == plain_image.tobytes(), "")
check("QR without logo: no note header", not headers.get("X-Prinsync-Note"), "")

print()
print("=" * 70)
print("5. QR VALIDATION ERRORS (400 hona chahiye)")
print("=" * 70)

cases = [
    ("empty text", {"data_type": "text", "text": "   "}, "Please enter the text"),
    ("url with space", {"data_type": "url", "url": "my site.com"}, "cannot contain spaces"),
    ("invalid url", {"data_type": "url", "url": "notaurl"}, "valid website address"),
    ("wifi without ssid", {"data_type": "wifi", "wifi_ssid": ""}, "SSID"),
    ("wifi without password", {"data_type": "wifi", "wifi_ssid": "Net", "wifi_encryption": "WPA"}, "password"),
    ("bad wifi encryption", {"data_type": "wifi", "wifi_ssid": "Net", "wifi_password": "x",
                             "wifi_encryption": "WPA9"}, "security type"),
    ("invalid email", {"data_type": "email", "email_to": "abc@"}, "valid email"),
    ("invalid phone", {"data_type": "phone", "phone": "abc"}, "valid phone"),
    ("empty contact", {"data_type": "contact"}, "at least a name"),
    ("bad colour", {"data_type": "text", "text": "x", "foreground": "#zzzzzz"}, "hex colour"),
    ("size too big", {"data_type": "text", "text": "x", "size": 5000}, "between 128 and 1024"),
    ("bad error level", {"data_type": "text", "text": "x", "error_level": "Z"}, "Error correction"),
    ("unknown type", {"data_type": "random", "text": "x"}, "Unknown QR type"),
    ("text too long", {"data_type": "text", "text": "a" * 1200}, "too long"),
    ("logo is not an image", {"data_type": "text", "text": "x"}, None),
]
for name, fields, expected_message in cases:
    files = {"logo": ("not_an_image.png", broken, "image/png")} if name == "logo is not an image" else None
    status, headers, data = qr(fields, files)
    detail = json.loads(data.decode("utf-8")).get("detail", "") if status == 400 else str(data[:120])
    if expected_message is None:
        check("bad logo file rejected ({})".format(name),
              status == 400 and "could not be read as an image" in detail, "status={} {}".format(status, detail))
    else:
        check("{} rejected".format(name),
              status == 400 and expected_message in detail,
              "status={} {}".format(status, detail))

status, headers, data = post_multipart(
    "/generate-qr",
    {"data_type": "text", "text": "x"},
    {"logo": ("logo.txt", broken, "text/plain")},
)
check("logo with wrong MIME type rejected",
      status == 400 and "PNG or JPEG" in json.loads(data.decode()).get("detail", ""),
      "status={} {}".format(status, data[:150]))

big_logo = logo_png + b"\x00" * (3 * 1024 * 1024)
status, headers, data = post_multipart(
    "/generate-qr", {"data_type": "text", "text": "x"}, {"logo": ("big.png", big_logo, "image/png")}
)
check("logo bigger than 2 MB rejected",
      status == 400 and "too large" in json.loads(data.decode()).get("detail", ""),
      "status={} {}".format(status, data[:200]))

print()
print("=" * 70)
print("6. BARCODE GENERATION + DECODE")
print("=" * 70)

status, headers, data = barcode({"data": "PRINSYNC-2026", "barcode_format": "code128"})
check("code128: status 200", status == 200, str(data[:200]))
check("code128: content-type image/png", headers.get("content-type") == "image/png", "")
check("code128: filename header", "prinsync-barcode-code128-" in headers.get("content-disposition", ""),
      headers.get("content-disposition", ""))
decoded = decode_image(data, "barcode_code128")
check("code128: decodes", decoded == "PRINSYNC-2026", str(decoded))

status, headers, data = barcode({"data": "abc-123 xyz", "barcode_format": "code39"})
decoded = decode_image(data, "barcode_code39")
check("code39: lower case uppercased + decodes", decoded == "ABC-123 XYZ", str(decoded))

status, headers, data = barcode({"data": "590123412345", "barcode_format": "ean13"})
check("ean13 (12 digits): status 200", status == 200, str(data[:200]))
check("ean13: check digit note added",
      "Check digit 7 was calculated" in headers.get("X-Prinsync-Note", ""),
      headers.get("X-Prinsync-Note", "(missing)"))
decoded = decode_image(data, "barcode_ean13")
check("ean13: decodes with correct check digit", decoded == "5901234123457", str(decoded))

status, headers, data = barcode({"data": "5901234123457", "barcode_format": "ean13"})
check("ean13 (13 digits, valid check digit): accepted",
      status == 200 and decode_image(data, "barcode_ean13_full") == "5901234123457", str(data[:150]))

status, headers, data = barcode({"data": "4006381333931", "barcode_format": "ean13"})
check("ean13 (13 digits, real EAN): accepted",
      status == 200 and decode_image(data, "barcode_ean13_real") == "4006381333931", str(data[:150]))

status, headers, data = barcode({"data": "96385074", "barcode_format": "ean8"})
check("ean8: accepted", status == 200, str(data[:150]))

status, headers, data = barcode({"data": "03600029145", "barcode_format": "upca"})
decoded = decode_image(data, "barcode_upca")
check("upca: decodes as 036000291452 (or with EAN leading zero)",
      decoded in ("036000291452", "0036000291452"), str(decoded))

status, headers, data = barcode({"data": "1234567890", "barcode_format": "code128",
                                 "foreground": "#8b0000", "background": "#fffbe6"})
image = png_image(data).convert("RGB")
colour_set = {c for _, c in image.getcolors(maxcolors=1000000)}
check("barcode colours applied", (139, 0, 0) in colour_set and (255, 251, 230) in colour_set,
      str(sorted(colour_set)[:4]))

status, headers, data = barcode({"data": "NO-LABEL-TEXT", "barcode_format": "code128", "show_text": False})
no_text = png_image(data)
status2, headers2, data2 = barcode({"data": "NO-LABEL-TEXT", "barcode_format": "code128", "show_text": True})
with_text = png_image(data2)
check("barcode show_text=False makes image shorter", no_text.height < with_text.height,
      "{} vs {}".format(no_text.height, with_text.height))
check("barcode still decodes without text", decode_image(data, "barcode_no_text") == "NO-LABEL-TEXT", "")

status, headers, data = barcode({"data": "TALL", "barcode_format": "code128", "bar_height": 25})
check("bar height option accepted", status == 200, str(data[:150]))

print()
print("=" * 70)
print("7. BARCODE VALIDATION ERRORS (400 hona chahiye)")
print("=" * 70)

barcode_cases = [
    ("empty data", {"data": "  ", "barcode_format": "code128"}, "Please enter the data"),
    ("ean13 wrong length", {"data": "12345", "barcode_format": "ean13"}, "needs exactly 12 digits"),
    ("ean13 letters", {"data": "59012abc2345", "barcode_format": "ean13"}, "digits only"),
    ("ean13 wrong check digit", {"data": "5901234123458", "barcode_format": "ean13"}, "Invalid check digit"),
    ("ean8 wrong length", {"data": "963850741", "barcode_format": "ean8"}, "needs exactly 7 digits"),
    ("upca wrong length", {"data": "123", "barcode_format": "upca"}, "needs exactly 11 digits"),
    ("code39 unsupported char", {"data": "ABC#123", "barcode_format": "code39"}, "does not support"),
    ("code128 non ascii", {"data": "नमस्ते", "barcode_format": "code128"}, "only English"),
    ("data too long", {"data": "A" * 60, "barcode_format": "code128"}, "at most 48"),
    ("unknown format", {"data": "123", "barcode_format": "pdf417"}, "Unsupported barcode format"),
    ("bad barcode colour", {"data": "123", "barcode_format": "code128", "foreground": "red"}, "hex colour"),
    ("bar height out of range", {"data": "123", "barcode_format": "code128", "bar_height": 90},
     "between 5 and 30"),
]
for name, fields, expected in barcode_cases:
    status, headers, data = barcode(fields)
    detail = json.loads(data.decode("utf-8")).get("detail", "") if status == 400 else str(data[:120])
    check("{} rejected".format(name), status == 400 and expected in detail,
          "status={} {}".format(status, detail))

print()
print("=" * 70)
print("RESULT: {} passed, {} failed".format(passed, len(failed)))
print("=" * 70)
for item in failed:
    print("  FAILED:", item)
sys.exit(1 if failed else 0)
