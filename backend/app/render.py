"""Render the composited case artwork and the printable A4 PDF.

The browser positions the photo over the case in *millimetres*. This module
reproduces the identical transform at 300 DPI, so the print matches the preview
exactly.

Coordinate convention (shared with the frontend):
  - The case is a rectangle `case_width_mm` x `case_height_mm`.
  - The photo is drawn as a box `img_width_mm` x `img_height_mm` whose top-left
    corner sits at (`offset_x_mm`, `offset_y_mm`) relative to the case top-left.
  - `rotation_deg` rotates the photo clockwise about its own centre (matching
    the CSS `rotate()` used in the preview).
  - Anything outside the case rectangle is clipped.
"""

import io

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas

DPI = 300
PX_PER_MM = DPI / 25.4  # ~11.811


def _mm_to_px(value_mm: float) -> int:
    return max(1, int(round(value_mm * PX_PER_MM)))


def compose_case(
    png_bytes: bytes,
    case_width_mm: float,
    case_height_mm: float,
    img_width_mm: float,
    img_height_mm: float,
    offset_x_mm: float,
    offset_y_mm: float,
    rotation_deg: float = 0.0,
) -> Image.Image:
    """Composite the photo onto a transparent, case-sized canvas at 300 DPI."""
    canvas_w = _mm_to_px(case_width_mm)
    canvas_h = _mm_to_px(case_height_mm)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    photo = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    photo = photo.resize(
        (_mm_to_px(img_width_mm), _mm_to_px(img_height_mm)),
        Image.LANCZOS,
    )

    if rotation_deg:
        # CSS rotate() is clockwise-positive; PIL rotate() is counter-clockwise.
        photo = photo.rotate(-rotation_deg, expand=True, resample=Image.BICUBIC)

    # Place by centre so rotation behaves like the CSS preview.
    center_x_px = (offset_x_mm + img_width_mm / 2) * PX_PER_MM
    center_y_px = (offset_y_mm + img_height_mm / 2) * PX_PER_MM
    paste_x = int(round(center_x_px - photo.width / 2))
    paste_y = int(round(center_y_px - photo.height / 2))

    canvas.alpha_composite(photo, (paste_x, paste_y))  # clipped to canvas bounds
    return canvas


def build_pdf(
    case_img: Image.Image,
    case_width_mm: float,
    case_height_mm: float,
    crop_marks: bool = True,
    caption: str | None = None,
) -> bytes:
    """Place the case artwork at exact physical size, centred on an A4 page."""
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    case_w = case_width_mm * mm
    case_h = case_height_mm * mm
    x0 = (page_w - case_w) / 2
    y0 = (page_h - case_h) / 2
    x1 = x0 + case_w
    y1 = y0 + case_h

    # Artwork (transparent areas fall through to white paper).
    img_buf = io.BytesIO()
    case_img.save(img_buf, format="PNG")
    img_buf.seek(0)
    c.drawImage(ImageReader(img_buf), x0, y0, width=case_w, height=case_h, mask="auto")

    if crop_marks:
        # Faint dashed trim outline showing the exact cut rectangle.
        c.saveState()
        c.setDash(2, 2)
        c.setLineWidth(0.3)
        c.setStrokeColorRGB(0.6, 0.6, 0.6)
        c.rect(x0, y0, case_w, case_h, stroke=1, fill=0)
        c.restoreState()

        # Straight corner registration marks, offset outside the trim box.
        gap = 2 * mm
        length = 5 * mm
        c.setLineWidth(0.4)
        c.setStrokeColorRGB(0, 0, 0)

        def corner(x: float, y: float, sx: int, sy: int) -> None:
            c.line(x + sx * gap, y, x + sx * (gap + length), y)  # horizontal arm
            c.line(x, y + sy * gap, x, y + sy * (gap + length))  # vertical arm

        corner(x0, y0, -1, -1)  # bottom-left
        corner(x1, y0, +1, -1)  # bottom-right
        corner(x0, y1, -1, +1)  # top-left
        corner(x1, y1, +1, +1)  # top-right

    if caption:
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawCentredString(page_w / 2, 12 * mm, caption)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
