# Phone Case Print Studio (web app)

A localhost web app to remove a photo's background, position it on a phone
back-cover, preview the result, and download a **print-accurate A4 PDF cutout
template** you can physically cut.

- **Backend** — `backend/` · FastAPI + rembg + Pillow + ReportLab
- **Frontend** — `frontend/` · Next.js 15 (App Router, TypeScript)
- **Orchestration** — one root `docker-compose.yml`

The CLI tool (`main.py`) is unchanged and still works independently.

---

## Run it

```bash
docker compose up --build
```

Then open **http://localhost:3000**.

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000 (docs at `/docs`)

> First background removal downloads the AI model (~100–200 MB). It's cached in
> the `model-cache` Docker volume, so it only happens once.

Stop with `Ctrl+C`, or `docker compose down`.

---

## How to use

1. **Photo** — optionally enable *alpha matting* (cleaner hair/fur edges), then
   choose an image. The background is removed automatically.
2. **Back-cover size** — pick **iPhone 15** or **Custom size** and type width ×
   height in millimetres.
3. **Position** — drag the photo to reposition, use **Zoom** and **Rotation**,
   or **Reset position** to re-fit.
4. **Print** — toggle **crop marks & cut outline** on/off, then **Download A4
   PDF**.

The PDF places the artwork at exact physical size (300 DPI) centred on A4, so
what you preview is what prints.

---

## How it fits together

Everything is measured in **millimetres relative to the case rectangle**. The
browser previews at a scaled `pxPerMm`; the backend reproduces the same
transform at 300 DPI. The service is **stateless** — the browser keeps the
cut-out PNG and posts it back with the placement parameters when generating the
PDF. Nothing is stored on the server.

### API

| Method | Path                | Purpose                                  |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/cases`        | Case-size presets                        |
| POST   | `/api/remove-bg`    | Image → transparent PNG (bg removed)     |
| POST   | `/api/generate-pdf` | PNG + placement → A4 PDF                 |

The Next.js dev server proxies `/api/*` to the backend (`INTERNAL_API_URL`), so
the browser talks same-origin and there's no CORS to configure.

---

## Adding more case sizes

Add an entry to `backend/app/cases.py`:

```python
CASE_PRESETS = {
    "iphone-15": {...},
    "iphone-15-pro-max": {
        "label": "iPhone 15 Pro Max",
        "width_mm": 76.7,
        "height_mm": 159.9,
        "corner_radius_mm": 10.0,
    },
}
```

It appears in the dropdown automatically — no frontend change needed.
