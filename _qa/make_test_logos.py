from pathlib import Path

from PIL import Image, ImageDraw

out = Path(__file__).parent

img = Image.new("RGBA", (600, 300), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)
draw.ellipse((10, 10, 290, 290), fill=(30, 90, 168, 255))
draw.rectangle((330, 90, 580, 210), fill=(220, 60, 60, 255))
img.save(out / "logo_test.png")

flat = Image.new("RGB", (300, 300), (255, 255, 255))
d2 = ImageDraw.Draw(flat)
d2.rectangle((40, 40, 260, 260), fill=(16, 120, 90))
flat.save(out / "logo_test.jpg", quality=90)

(out / "not_an_image.png").write_bytes(b"this is not really a png file")

print("created:", [p.name for p in out.iterdir() if p.is_file()])
