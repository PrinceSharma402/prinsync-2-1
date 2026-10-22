import re
from io import BytesIO
from urllib.parse import quote, urlencode, urlparse

import qrcode
from PIL import Image
from qrcode.constants import (
    ERROR_CORRECT_H,
    ERROR_CORRECT_L,
    ERROR_CORRECT_M,
    ERROR_CORRECT_Q,
)

ERROR_LEVELS = {
    "L": ERROR_CORRECT_L,
    "M": ERROR_CORRECT_M,
    "Q": ERROR_CORRECT_Q,
    "H": ERROR_CORRECT_H,
}

LOGO_AREA_RATIO = 0.22
LOGO_PADDING_RATIO = 0.10

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")

DATA_TYPES = ("text", "url", "wifi", "email", "phone", "contact")


def _clean(value):
    return (value or "").strip()


def _hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def _escape_wifi(value):
    for character in ("\\", ";", ",", ":", '"'):
        value = value.replace(character, "\\" + character)
    return value


def _escape_vcard(value):
    value = value.replace("\\", "\\\\")
    value = value.replace(";", "\\;").replace(",", "\\,")
    return value.replace("\n", "\\n")


def _payload_text(data):
    text = _clean(data.get("text"))
    if not text:
        raise ValueError("Please enter the text you want to convert into a QR code.")
    if len(text) > 1000:
        raise ValueError("Text is too long. Please keep it under 1000 characters.")
    return text


def _payload_url(data):
    url = _clean(data.get("url"))
    if not url:
        raise ValueError("Please enter a website URL.")
    if " " in url:
        raise ValueError("A URL cannot contain spaces.")
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.netloc or ("." not in parsed.netloc and parsed.netloc != "localhost"):
        raise ValueError("This does not look like a valid website address.")
    return url


def _payload_wifi(data):
    ssid = _clean(data.get("wifi_ssid"))
    password = _clean(data.get("wifi_password"))
    encryption = _clean(data.get("wifi_encryption") or "WPA")
    hidden = str(data.get("wifi_hidden", "")).lower() in ("true", "1", "on", "yes")

    if not ssid:
        raise ValueError("Wi-Fi network name (SSID) is required.")
    if encryption not in ("WPA", "WEP", "nopass"):
        raise ValueError("Wi-Fi security type must be WPA, WEP or nopass.")
    if encryption != "nopass" and not password:
        raise ValueError("Wi-Fi password is required. Choose 'Open / no password' if the network is open.")

    if encryption == "nopass":
        return "WIFI:T:nopass;S:{};;".format(_escape_wifi(ssid))

    payload = "WIFI:T:{};S:{};P:{};".format(
        encryption, _escape_wifi(ssid), _escape_wifi(password)
    )
    if hidden:
        payload += "H:true;"
    return payload + ";"


def _payload_email(data):
    to = _clean(data.get("email_to"))
    subject = _clean(data.get("email_subject"))
    body = _clean(data.get("email_body"))

    if not to:
        raise ValueError("Email address is required.")
    if not EMAIL_PATTERN.match(to):
        raise ValueError("Please enter a valid email address, for example name@example.com.")

    parameters = {}
    if subject:
        parameters["subject"] = subject
    if body:
        parameters["body"] = body
    if not parameters:
        return "mailto:" + to
    return "mailto:{}?{}".format(to, urlencode(parameters, quote_via=quote))


def _payload_phone(data):
    phone = _clean(data.get("phone"))
    if not phone:
        raise ValueError("Phone number is required.")
    if not re.match(r"^\+?[0-9\s\-()]{6,20}$", phone):
        raise ValueError("Please enter a valid phone number (digits and + only).")
    cleaned = re.sub(r"[\s\-()]", "", phone)
    return "tel:" + cleaned


def _payload_contact(data):
    first_name = _clean(data.get("contact_first_name"))
    last_name = _clean(data.get("contact_last_name"))
    phone = _clean(data.get("contact_phone"))
    email = _clean(data.get("contact_email"))
    organization = _clean(data.get("contact_organization"))

    if not (first_name or last_name or phone or email):
        raise ValueError("Please fill at least a name, phone number or email for the contact card.")
    if email and not EMAIL_PATTERN.match(email):
        raise ValueError("Please enter a valid email address.")
    if phone and not re.match(r"^\+?[0-9\s\-()]{6,20}$", phone):
        raise ValueError("Please enter a valid phone number.")

    full_name = (first_name + " " + last_name).strip()
    lines = ["BEGIN:VCARD", "VERSION:3.0"]
    if last_name or first_name:
        lines.append("N:{};{};;;".format(_escape_vcard(last_name), _escape_vcard(first_name)))
    lines.append("FN:" + _escape_vcard(full_name or organization or phone or email))
    if organization:
        lines.append("ORG:" + _escape_vcard(organization))
    if phone:
        lines.append("TEL;TYPE=CELL:" + _escape_vcard(phone))
    if email:
        lines.append("EMAIL;TYPE=INTERNET:" + _escape_vcard(email))
    lines.append("END:VCARD")
    return "\r\n".join(lines)


def build_payload(data_type, data):
    data_type = _clean(data_type).lower()
    if data_type == "text":
        return _payload_text(data)
    if data_type == "url":
        return _payload_url(data)
    if data_type == "wifi":
        return _payload_wifi(data)
    if data_type == "email":
        return _payload_email(data)
    if data_type == "phone":
        return _payload_phone(data)
    if data_type == "contact":
        return _payload_contact(data)
    raise ValueError("Unknown QR type: '{}'. Allowed types: {}.".format(
        data_type, ", ".join(DATA_TYPES)))


def add_logo(qr_image, logo_bytes, background_color):
    logo = Image.open(BytesIO(logo_bytes))
    logo.load()
    if logo.mode != "RGBA":
        logo = logo.convert("RGBA")

    qr_width, qr_height = qr_image.size
    plate_side = max(24, int(min(qr_width, qr_height) * LOGO_AREA_RATIO))
    inner_side = max(16, int(plate_side * (1 - 2 * LOGO_PADDING_RATIO)))

    logo.thumbnail((inner_side, inner_side), Image.LANCZOS)

    plate = Image.new("RGBA", (plate_side, plate_side), _hex_to_rgb(background_color) + (255,))
    logo_x = (plate_side - logo.width) // 2
    logo_y = (plate_side - logo.height) // 2
    plate.paste(logo, (logo_x, logo_y), logo)

    qr_image.paste(
        plate,
        ((qr_width - plate_side) // 2, (qr_height - plate_side) // 2),
        plate,
    )
    return qr_image


def make_qr_png(payload, foreground, background, target_size, border, error_level,
                logo_bytes=None):
    qr = qrcode.QRCode(
        error_correction=ERROR_LEVELS[error_level],
        border=border,
        box_size=10,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    total_modules = qr.modules_count + border * 2
    qr.box_size = max(2, round(target_size / total_modules))

    image = qr.make_image(fill_color=foreground, back_color=background).convert("RGB")

    if logo_bytes:
        image = add_logo(image, logo_bytes, background)

    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
