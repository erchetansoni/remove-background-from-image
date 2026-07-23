"""
Remove image backgrounds while preserving quality.

Usage:
    uv run remove_bg.py input.jpg
    uv run remove_bg.py input.jpg -o output.png
    uv run remove_bg.py input.jpg --model isnet-general-use --matting
    uv run remove_bg.py ./photos -o ./cutouts          # whole folder

Notes:
    - Output is always PNG (lossless) so transparency + full quality are kept.
    - --matting gives noticeably cleaner edges (hair, fur) but is slower.
    - The chosen model downloads automatically on first run.
"""

import argparse
import sys
from pathlib import Path

from rembg import remove, new_session
from PIL import Image
import io

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}


def process_one(src: Path, dst: Path, session, matting: bool) -> None:
    with open(src, "rb") as f:
        data = f.read()

    kwargs = dict(session=session)
    if matting:
        # Alpha matting refines soft/fuzzy edges
        kwargs.update(
            alpha_matting=True,
            alpha_matting_foreground_threshold=270,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=11,
        )

    result = remove(data, **kwargs)

    # Re-open through PIL to guarantee a clean, full-quality PNG with alpha
    img = Image.open(io.BytesIO(result)).convert("RGBA")
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, format="PNG", optimize=True)
    print(f"  {src.name} -> {dst}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove image backgrounds (high quality).")
    parser.add_argument("input", help="Input image file or a folder of images")
    parser.add_argument("-o", "--output", help="Output file or folder (default: <name>_nobg.png)")
    parser.add_argument(
        "--model",
        default="isnet-general-use",
        help="rembg model: isnet-general-use (best general), u2net, u2netp, "
             "birefnet-general (highest quality, heavier)",
    )
    parser.add_argument("--matting", action="store_true", help="Enable alpha matting for cleaner edges")
    args = parser.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"Error: '{in_path}' does not exist.", file=sys.stderr)
        return 1

    session = new_session(args.model)

    if in_path.is_dir():
        out_dir = Path(args.output) if args.output else in_path / "cutouts"
        images = [p for p in in_path.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        if not images:
            print("No images found in folder.", file=sys.stderr)
            return 1
        print(f"Processing {len(images)} image(s) with '{args.model}':")
        for img in images:
            process_one(img, out_dir / f"{img.stem}_nobg.png", session, args.matting)
    else:
        if args.output:
            out_file = Path(args.output)
        else:
            out_file = in_path.with_name(f"{in_path.stem}_nobg.png")
        print(f"Processing '{in_path.name}' with '{args.model}':")
        process_one(in_path, out_file, session, args.matting)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())