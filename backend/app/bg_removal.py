"""Background removal — the same rembg + Pillow pipeline as the CLI, exposed
as an in-memory function so the API never touches the filesystem.

Sessions are cached per-model so the ONNX model is loaded only once.
"""

import io
from functools import lru_cache

from PIL import Image
from rembg import new_session, remove


@lru_cache(maxsize=4)
def _session(model: str):
    # Model downloads automatically on first use, then is cached on disk
    # (see U2NET_HOME / the mounted docker volume).
    return new_session(model)


def remove_background(
    data: bytes,
    model: str = "isnet-general-use",
    matting: bool = False,
) -> bytes:
    """Return a full-quality transparent PNG with the background removed."""
    kwargs: dict = dict(session=_session(model))
    if matting:
        # Alpha matting refines soft/fuzzy edges (hair, fur) — slower.
        kwargs.update(
            alpha_matting=True,
            alpha_matting_foreground_threshold=270,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=11,
        )

    result = remove(data, **kwargs)

    # Re-open through PIL to guarantee a clean RGBA PNG.
    img = Image.open(io.BytesIO(result)).convert("RGBA")
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    out.seek(0)
    return out.read()
