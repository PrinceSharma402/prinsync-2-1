from io import BytesIO

import barcode as python_barcode
from barcode.writer import ImageWriter

FORMATS = {
    "code128": {"label": "Code 128", "digits": None, "min_length": 1, "max_length": 48},
    "code39": {"label": "Code 39", "digits": None, "min_length": 1, "max_length": 40},
    "ean13": {"label": "EAN-13", "digits": 12, "min_length": 12, "max_length": 13},
    "ean8": {"label": "EAN-8", "digits": 7, "min_length": 7, "max_length": 8},
    "upca": {"label": "UPC-A", "digits": 11, "min_length": 11, "max_length": 12},
}

CODE39_CHARACTERS = set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%")


def calculate_check_digit(number):
    total = 0
    for index, digit_character in enumerate(reversed(number)):
        digit = int(digit_character)
        total += digit * (3 if index % 2 == 0 else 1)
    return str((10 - total % 10) % 10)


def validate_input(format_key, raw_data):
    if format_key not in FORMATS:
        raise ValueError(
            "Unsupported barcode format '{}'. Supported formats: {}.".format(
                format_key, ", ".join(FORMATS.keys())
            )
        )

    rules = FORMATS[format_key]
    data = (raw_data or "").strip()
    note = ""

    if not data:
        raise ValueError("Please enter the data you want to encode in the barcode.")

    if format_key == "code128":
        if len(data) > rules["max_length"]:
            raise ValueError(
                "Code 128 allows at most {} characters. You entered {}.".format(
                    rules["max_length"], len(data)
                )
            )
        try:
            data.encode("ascii")
        except UnicodeEncodeError:
            raise ValueError(
                "Code 128 supports only English letters, numbers and symbols "
                "(no Devanagari or emoji)."
            )
        if len(data) < rules["min_length"]:
            raise ValueError("Code 128 needs at least 1 character.")
        return data, note

    if format_key == "code39":
        if len(data) > rules["max_length"]:
            raise ValueError(
                "Code 39 allows at most {} characters. You entered {}.".format(
                    rules["max_length"], len(data)
                )
            )
        upper_data = data.upper()
        invalid = [character for character in upper_data if character not in CODE39_CHARACTERS]
        if invalid:
            raise ValueError(
                "Code 39 does not support these characters: {}. "
                "Allowed: A-Z, 0-9 and - . $ / + % and space.".format(
                    " ".join(sorted(set(invalid)))
                )
            )
        return upper_data, note

    if not data.isdigit():
        raise ValueError("{} accepts digits only.".format(rules["label"]))

    digits = rules["digits"]
    if len(data) == digits:
        check_digit = calculate_check_digit(data)
        note = "Check digit {} was calculated and added automatically.".format(check_digit)
        return data, note

    if len(data) == digits + 1:
        body, given_check_digit = data[:digits], data[digits]
        expected_check_digit = calculate_check_digit(body)
        if given_check_digit != expected_check_digit:
            raise ValueError(
                "Invalid check digit for {}: you entered {}, but it should be {}. "
                "Either fix the last digit or enter only the first {} digits.".format(
                    rules["label"], given_check_digit, expected_check_digit, digits
                )
            )
        return body, note

    raise ValueError(
        "{} needs exactly {} digits (or {} digits with the check digit). "
        "You entered {}.".format(rules["label"], digits, digits + 1, len(data))
    )


def make_barcode_png(format_key, data, foreground, background, show_text, bar_height):
    barcode_class = python_barcode.get_barcode_class(format_key)
    writer = ImageWriter()

    extra_options = {}
    if format_key == "code39":
        extra_options["add_checksum"] = False

    barcode_object = barcode_class(data, writer=writer, **extra_options)

    options = {
        "foreground": foreground,
        "background": background,
        "write_text": show_text,
        "module_height": bar_height,
        "module_width": 0.22,
        "quiet_zone": 6.5,
        "font_size": 11,
        "text_distance": 4.0,
    }

    buffer = BytesIO()
    barcode_object.write(buffer, options)
    return buffer.getvalue()
