# Remove Background From Image

A simple command-line tool to remove the background from images while keeping the
quality high. Built with [rembg](https://github.com/danielgatis/rembg) (AI-powered
background removal) and managed with [uv](https://github.com/astral-sh/uv).

Output is always a **PNG** with a transparent background, so no quality is lost.

---

## Requirements

- [uv](https://github.com/astral-sh/uv) installed
- Python 3.10–3.12 (uv will set this up for you)

## Setup

Clone or download this project, then from the project folder run:

```bash
uv add rembg pillow onnxruntime "numba>=0.60"
```

> **Why the `numba>=0.60` bit?** `rembg` depends on `numba`, and uv's default pick is
> an old version that doesn't support Python 3.11+. Forcing `numba>=0.60` uses a
> modern version with prebuilt wheels, so it installs without any build errors.

That's it — you're ready to go.

---

## Usage

### Remove the background from one image

```bash
uv run remove_bg.py input.jpg
```

This creates `input_nobg.png` next to the original.

### Choose where to save the result

```bash
uv run remove_bg.py input.jpg -o result.png
```

### Cleaner edges (hair, fur, fine detail)

```bash
uv run remove_bg.py input.jpg --matting
```

Slower, but noticeably smoother around tricky edges.

### Process a whole folder at once

```bash
uv run remove_bg.py ./photos -o ./cutouts
```

Every image in `./photos` gets a `_nobg.png` version in `./cutouts`.

### Pick a different AI model

```bash
uv run remove_bg.py input.jpg --model birefnet-general --matting
```

| Model                | Best for                                   |
| -------------------- | ------------------------------------------ |
| `isnet-general-use`  | Default — great balance of quality & speed |
| `u2net`              | Reliable general-purpose alternative       |
| `u2netp`             | Lighter/faster, slightly lower quality     |
| `birefnet-general`   | Highest quality (slower, heavier)          |

---

## Options Reference

| Option           | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `input`          | Path to an image **or** a folder of images (required)    |
| `-o`, `--output` | Output file or folder (default: `<name>_nobg.png`)       |
| `--model`        | AI model to use (default: `isnet-general-use`)           |
| `--matting`      | Enable alpha matting for cleaner edges                   |

---

## Notes

- **First run downloads the model** (a few hundred MB). This happens once, then it's
  cached for all future runs.
- **Output is always PNG.** PNG is lossless and supports transparency — JPG can't do
  either, so it's never used for cutouts.
- The `--matting` option is the only feature that uses `numba`; plain removal works
  without touching it.

---

## Troubleshooting

**Install fails with a `numba` build error on Python 3.11/3.12**
Make sure you included `"numba>=0.60"` in the `uv add` command above. If it still
fails, you can pin the project to Python 3.11 instead:

```bash
uv python pin 3.11
uv add rembg pillow onnxruntime
```

**First run is slow or seems stuck**
It's downloading the model. Give it a minute — subsequent runs are fast.