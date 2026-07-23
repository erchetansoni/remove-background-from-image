"""Back-cover size presets.

All dimensions in millimetres. `corner_radius_mm` is only used for the on-screen
preview and the (optional) faint cut outline in the PDF — the physical crop marks
are drawn as straight corner registration marks regardless.

Start with iPhone 15; add more presets here as the app grows.
"""

CASE_PRESETS: dict[str, dict] = {
    "iphone-15": {
        "label": "iPhone 15",
        "width_mm": 71.6,
        "height_mm": 147.6,
        "corner_radius_mm": 10.0,
    },
}
