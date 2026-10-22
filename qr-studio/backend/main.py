import re
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from io import BytesIO

import barcodes
import qr

app = FastAPI(
    title="PrinSync 2.1 API",
    version="2.1",
    description=(
        "Simple REST API that generates QR codes (with an optional centre logo) "
        "and barcodes as PNG images."
    ),
)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Prinsync-Note"],
)

HEX_COLOR_PATTERN = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

MIN_QR_SIZE = 128
MAX_QR_SIZE = 1024
MAX_BORDER = 8
ERROR_LEVELS = ("L", "M", "Q", "H")

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
}


def check_color(value, field_label, default_color):
    color = (value or "").strip() or default_color
    if not HEX_COLOR_PATTERN.match(color):
        raise HTTPException(
            status_code=400,
            detail="{} must be a hex colour like #000000 or #ffffff.".format(field_label),
        )
    if len(color) == 4:
        color = "#" + "".join(character * 2 for character in color[1:])
    return color.lower()


def check_range(value, field_label, minimum, maximum):
    if value < minimum or value > maximum:
        raise HTTPException(
            status_code=400,
            detail="{} must be between {} and {}.".format(field_label, minimum, maximum),
        )
    return value


def build_filename(prefix, extension="png"):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return "prinsync-{}-{}.{}".format(prefix, timestamp, extension)


def png_response(image_bytes, filename, note=""):
    headers = {
        "Content-Disposition": 'inline; filename="{}"'.format(filename),
        "Cache-Control": "no-store",
    }
    if note:
        headers["X-Prinsync-Note"] = note
    return Response(content=image_bytes, media_type="image/png", headers=headers)


async def read_logo_bytes(logo):
    if logo is None or not logo.filename:
        return None

    if logo.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Logo must be a PNG or JPEG image (received '{}').".format(
                logo.content_type or "unknown"
            ),
        )

    image_bytes = await logo.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded logo file is empty.")
    if len(image_bytes) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Logo is too large. Please upload an image smaller than 2 MB.",
        )

    try:
        with Image.open(BytesIO(image_bytes)) as probe:
            probe.verify()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="This file could not be read as an image. Please upload a PNG or JPEG file.",
        )
    return image_bytes


@app.get("/")
def api_information():
    return {
        "name": "PrinSync 2.1 API",
        "version": "2.1",
        "description": "QR code and barcode generator API.",
        "docs": "/docs",
        "endpoints": [
            "GET  /",
            "GET  /health",
            "POST /generate-qr",
            "POST /generate-barcode",
        ],
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "prinsync-api",
        "version": "2.1",
        "time": datetime.now().isoformat(timespec="seconds"),
    }


@app.post("/generate-qr")
async def generate_qr(
    data_type: str = Form("text"),
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    wifi_ssid: Optional[str] = Form(None),
    wifi_password: Optional[str] = Form(None),
    wifi_encryption: Optional[str] = Form("WPA"),
    wifi_hidden: Optional[bool] = Form(False),
    email_to: Optional[str] = Form(None),
    email_subject: Optional[str] = Form(None),
    email_body: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    contact_first_name: Optional[str] = Form(None),
    contact_last_name: Optional[str] = Form(None),
    contact_phone: Optional[str] = Form(None),
    contact_email: Optional[str] = Form(None),
    contact_organization: Optional[str] = Form(None),
    foreground: str = Form("#000000"),
    background: str = Form("#FFFFFF"),
    size: int = Form(400),
    border: int = Form(4),
    error_level: str = Form("M"),
    logo: Optional[UploadFile] = File(None),
):
    foreground = check_color(foreground, "Foreground colour", "#000000")
    background = check_color(background, "Background colour", "#FFFFFF")
    size = check_range(size, "QR size", MIN_QR_SIZE, MAX_QR_SIZE)
    border = check_range(border, "Border", 0, MAX_BORDER)

    error_level = (error_level or "M").strip().upper()
    if error_level not in ERROR_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Error correction must be one of {}.".format(", ".join(ERROR_LEVELS)),
        )

    logo_bytes = await read_logo_bytes(logo)

    note = ""
    if logo_bytes:
        error_level = "H"
        note = "Error correction was set to H (30%) because a centre logo is included."

    try:
        payload = qr.build_payload(data_type, {
            "text": text,
            "url": url,
            "wifi_ssid": wifi_ssid,
            "wifi_password": wifi_password,
            "wifi_encryption": wifi_encryption,
            "wifi_hidden": wifi_hidden,
            "email_to": email_to,
            "email_subject": email_subject,
            "email_body": email_body,
            "phone": phone,
            "contact_first_name": contact_first_name,
            "contact_last_name": contact_last_name,
            "contact_phone": contact_phone,
            "contact_email": contact_email,
            "contact_organization": contact_organization,
        })
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    try:
        image_bytes = qr.make_qr_png(
            payload=payload,
            foreground=foreground,
            background=background,
            target_size=size,
            border=border,
            error_level=error_level,
            logo_bytes=logo_bytes,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Could not generate the QR image: {}".format(error),
        )

    filename = build_filename("qr-" + (data_type or "text").lower())
    return png_response(image_bytes, filename, note)


@app.post("/generate-barcode")
def generate_barcode(
    data: str = Form(...),
    barcode_format: str = Form("code128"),
    foreground: str = Form("#000000"),
    background: str = Form("#FFFFFF"),
    show_text: bool = Form(True),
    bar_height: float = Form(15.0),
):
    foreground = check_color(foreground, "Foreground colour", "#000000")
    background = check_color(background, "Background colour", "#FFFFFF")

    if bar_height < 5 or bar_height > 30:
        raise HTTPException(
            status_code=400, detail="Bar height must be between 5 and 30."
        )

    barcode_format = (barcode_format or "code128").strip().lower()

    try:
        clean_data, note = barcodes.validate_input(barcode_format, data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    try:
        image_bytes = barcodes.make_barcode_png(
            format_key=barcode_format,
            data=clean_data,
            foreground=foreground,
            background=background,
            show_text=show_text,
            bar_height=bar_height,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Could not generate the barcode: {}".format(error),
        )

    filename = build_filename("barcode-" + barcode_format)
    return png_response(image_bytes, filename, note)
