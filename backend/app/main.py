"""FastAPI app: background removal + printable A4 phone-case PDF.

The service is stateless — the browser holds the cut-out PNG and posts it back
with the placement parameters when it wants a PDF. No uploads are persisted.
"""

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .bg_removal import remove_background
from .cases import CASE_PRESETS
from .render import build_pdf, compose_case

app = FastAPI(title="Phone Case Print Studio")

# The Next.js dev server proxies /api/* to us (same-origin), so CORS is not
# strictly needed — kept permissive for direct calls / local tooling.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/cases")
def list_cases() -> dict:
    return CASE_PRESETS


@app.post("/api/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    matting: bool = Form(False),
    model: str = Form("isnet-general-use"),
) -> Response:
    data = await file.read()
    png = remove_background(data, model=model, matting=matting)
    return Response(content=png, media_type="image/png")


@app.post("/api/generate-pdf")
async def generate_pdf(
    file: UploadFile = File(...),
    case_width_mm: float = Form(...),
    case_height_mm: float = Form(...),
    img_width_mm: float = Form(...),
    img_height_mm: float = Form(...),
    offset_x_mm: float = Form(...),
    offset_y_mm: float = Form(...),
    rotation_deg: float = Form(0.0),
    crop_marks: bool = Form(True),
    label: str = Form("Custom"),
) -> Response:
    data = await file.read()
    case_img = compose_case(
        data,
        case_width_mm=case_width_mm,
        case_height_mm=case_height_mm,
        img_width_mm=img_width_mm,
        img_height_mm=img_height_mm,
        offset_x_mm=offset_x_mm,
        offset_y_mm=offset_y_mm,
        rotation_deg=rotation_deg,
    )
    caption = (
        f"{label}  •  {case_width_mm:.1f} x {case_height_mm:.1f} mm"
        f"  •  A4 @ 300 DPI"
    )
    pdf = build_pdf(
        case_img,
        case_width_mm=case_width_mm,
        case_height_mm=case_height_mm,
        crop_marks=crop_marks,
        caption=caption,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="phone-case-print.pdf"'},
    )
