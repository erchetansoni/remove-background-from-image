"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * All geometry is stored in millimetres relative to the case rectangle.
 * The preview renders at `pxPerMm`; the backend renders the identical
 * transform at 300 DPI, so preview == print.
 */
type CasePreset = {
  label: string;
  width_mm: number;
  height_mm: number;
  corner_radius_mm: number;
};

type Transform = {
  imgWidthMm: number;
  imgHeightMm: number; // derived from image aspect ratio
  offsetXMm: number; // top-left of the photo relative to case top-left
  offsetYMm: number;
  rotationDeg: number;
};

const CUSTOM = "custom";

// Preview box the case is scaled to fit within.
const PREVIEW_MAX_W = 340;
const PREVIEW_MAX_H = 620;

export default function Home() {
  const [presets, setPresets] = useState<Record<string, CasePreset>>({});
  const [caseKey, setCaseKey] = useState<string>("iphone-15");
  const [customW, setCustomW] = useState(71.6);
  const [customH, setCustomH] = useState(147.6);

  const [matting, setMatting] = useState(false);
  const [cropMarks, setCropMarks] = useState(true);

  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const processedBlob = useRef<Blob | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const [transform, setTransform] = useState<Transform | null>(null);
  const [busy, setBusy] = useState<null | "removing" | "pdf">(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Case dimensions (preset or custom) ----------------------------------
  const preset = presets[caseKey];
  const caseW = caseKey === CUSTOM ? customW : preset?.width_mm ?? 71.6;
  const caseH = caseKey === CUSTOM ? customH : preset?.height_mm ?? 147.6;
  const cornerMm = caseKey === CUSTOM ? 6 : preset?.corner_radius_mm ?? 8;

  const pxPerMm = Math.min(PREVIEW_MAX_W / caseW, PREVIEW_MAX_H / caseH);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data: Record<string, CasePreset>) => setPresets(data))
      .catch(() => {
        /* backend not ready yet — presets stay empty, defaults still work */
      });
  }, []);

  // ---- Fit the photo inside the case (contain), centred --------------------
  const fitTransform = useCallback(
    (natW: number, natH: number, cw: number, ch: number): Transform => {
      const aspectImg = natW / natH;
      const aspectCase = cw / ch;
      let w: number;
      let h: number;
      if (aspectImg > aspectCase) {
        w = cw;
        h = cw / aspectImg;
      } else {
        h = ch;
        w = ch * aspectImg;
      }
      return {
        imgWidthMm: w,
        imgHeightMm: h,
        offsetXMm: (cw - w) / 2,
        offsetYMm: (ch - h) / 2,
        rotationDeg: 0,
      };
    },
    []
  );

  const resetPosition = useCallback(() => {
    if (!natural) return;
    setTransform(fitTransform(natural.w, natural.h, caseW, caseH));
  }, [natural, caseW, caseH, fitTransform]);

  // Re-fit whenever the case size changes.
  useEffect(() => {
    if (natural) setTransform(fitTransform(natural.w, natural.h, caseW, caseH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseW, caseH]);

  // ---- Upload + background removal -----------------------------------------
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy("removing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("matting", String(matting));
      const res = await fetch("/api/remove-bg", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Background removal failed (${res.status})`);
      const blob = await res.blob();
      processedBlob.current = blob;
      const url = URL.createObjectURL(blob);
      setProcessedUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      // Read natural dimensions, then fit into the current case.
      const img = new Image();
      img.onload = () => {
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        setTransform(fitTransform(img.naturalWidth, img.naturalHeight, caseW, caseH));
      };
      img.src = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  // ---- Scale (keeps the photo centred on its current centre) ---------------
  function setImgWidth(newW: number) {
    if (!transform || !natural) return;
    const aspect = natural.w / natural.h;
    const newH = newW / aspect;
    const centerX = transform.offsetXMm + transform.imgWidthMm / 2;
    const centerY = transform.offsetYMm + transform.imgHeightMm / 2;
    setTransform({
      ...transform,
      imgWidthMm: newW,
      imgHeightMm: newH,
      offsetXMm: centerX - newW / 2,
      offsetYMm: centerY - newH / 2,
    });
  }

  // ---- Drag to reposition ---------------------------------------------------
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!transform) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      ox: transform.offsetXMm,
      oy: transform.offsetYMm,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !transform) return;
    const dxMm = (e.clientX - drag.current.x) / pxPerMm;
    const dyMm = (e.clientY - drag.current.y) / pxPerMm;
    setTransform({
      ...transform,
      offsetXMm: drag.current.ox + dxMm,
      offsetYMm: drag.current.oy + dyMm,
    });
  }
  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  // ---- Generate the printable PDF ------------------------------------------
  async function generatePdf() {
    if (!processedBlob.current || !transform) return;
    setError(null);
    setBusy("pdf");
    try {
      const fd = new FormData();
      fd.append("file", processedBlob.current, "cutout.png");
      fd.append("case_width_mm", String(caseW));
      fd.append("case_height_mm", String(caseH));
      fd.append("img_width_mm", String(transform.imgWidthMm));
      fd.append("img_height_mm", String(transform.imgHeightMm));
      fd.append("offset_x_mm", String(transform.offsetXMm));
      fd.append("offset_y_mm", String(transform.offsetYMm));
      fd.append("rotation_deg", String(transform.rotationDeg));
      fd.append("crop_marks", String(cropMarks));
      fd.append("label", caseKey === CUSTOM ? "Custom size" : preset?.label ?? "Custom");

      const res = await fetch("/api/generate-pdf", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`PDF generation failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phone-case-print.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const maxScaleW = caseW * 3;
  const minScaleW = caseW * 0.15;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={S.h1}>Phone Case Print Studio</h1>
        <p style={S.sub}>
          Upload a photo, remove its background, position it on the case, and print an
          exact-size A4 cutout template.
        </p>
      </header>

      <div style={S.layout}>
        {/* ------------------------------- Controls ------------------------ */}
        <section style={S.panel}>
          <h2 style={S.h2}>1 · Photo</h2>
          <label style={S.row}>
            <input type="checkbox" checked={matting} onChange={(e) => setMatting(e.target.checked)} />
            <span>Alpha matting (cleaner hair/fur edges — slower)</span>
          </label>
          <label style={S.fileBtn}>
            {busy === "removing" ? "Removing background…" : "Choose image…"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={busy !== null}
              style={{ display: "none" }}
            />
          </label>

          <h2 style={S.h2}>2 · Back-cover size</h2>
          <select value={caseKey} onChange={(e) => setCaseKey(e.target.value)} style={S.select}>
            {Object.entries(presets).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label} ({p.width_mm} × {p.height_mm} mm)
              </option>
            ))}
            <option value={CUSTOM}>Custom size…</option>
          </select>

          {caseKey === CUSTOM && (
            <div style={S.grid2}>
              <label style={S.field}>
                <span style={S.label}>Width (mm)</span>
                <input
                  type="number"
                  value={customW}
                  min={10}
                  step={0.1}
                  onChange={(e) => setCustomW(Math.max(10, Number(e.target.value) || 0))}
                  style={S.input}
                />
              </label>
              <label style={S.field}>
                <span style={S.label}>Height (mm)</span>
                <input
                  type="number"
                  value={customH}
                  min={10}
                  step={0.1}
                  onChange={(e) => setCustomH(Math.max(10, Number(e.target.value) || 0))}
                  style={S.input}
                />
              </label>
            </div>
          )}

          <h2 style={S.h2}>3 · Position</h2>
          {!transform ? (
            <p style={S.muted}>Upload a photo to start positioning.</p>
          ) : (
            <>
              <label style={S.field}>
                <span style={S.label}>Zoom · {Math.round((transform.imgWidthMm / caseW) * 100)}%</span>
                <input
                  type="range"
                  min={minScaleW}
                  max={maxScaleW}
                  step={0.1}
                  value={transform.imgWidthMm}
                  onChange={(e) => setImgWidth(Number(e.target.value))}
                />
              </label>
              <label style={S.field}>
                <span style={S.label}>Rotation · {Math.round(transform.rotationDeg)}°</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={transform.rotationDeg}
                  onChange={(e) =>
                    setTransform({ ...transform, rotationDeg: Number(e.target.value) })
                  }
                />
              </label>
              <button style={S.ghostBtn} onClick={resetPosition}>
                Reset position
              </button>
            </>
          )}

          <h2 style={S.h2}>4 · Print</h2>
          <label style={S.row}>
            <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} />
            <span>Include crop marks &amp; cut outline</span>
          </label>
          <button
            style={{ ...S.primaryBtn, opacity: transform && busy === null ? 1 : 0.5 }}
            disabled={!transform || busy !== null}
            onClick={generatePdf}
          >
            {busy === "pdf" ? "Generating PDF…" : "Download A4 PDF"}
          </button>

          {error && <p style={S.error}>{error}</p>}
        </section>

        {/* ------------------------------- Preview ------------------------- */}
        <section style={S.previewWrap}>
          <div style={S.canvasArea}>
            <div
              style={{
                position: "relative",
                width: caseW * pxPerMm,
                height: caseH * pxPerMm,
                borderRadius: cornerMm * pxPerMm,
                overflow: "hidden",
                background:
                  "repeating-conic-gradient(#2a2f3a 0% 25%, #222630 0% 50%) 50% / 20px 20px",
                boxShadow: "0 0 0 2px var(--border), 0 20px 60px rgba(0,0,0,0.5)",
                touchAction: "none",
              }}
            >
              {processedUrl && transform && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={processedUrl}
                  alt="cutout"
                  draggable={false}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  style={{
                    position: "absolute",
                    left: transform.offsetXMm * pxPerMm,
                    top: transform.offsetYMm * pxPerMm,
                    width: transform.imgWidthMm * pxPerMm,
                    height: transform.imgHeightMm * pxPerMm,
                    transform: `rotate(${transform.rotationDeg}deg)`,
                    transformOrigin: "center center",
                    cursor: "grab",
                    userSelect: "none",
                  }}
                />
              )}
            </div>
          </div>
          <p style={S.dims}>
            Case: {caseW.toFixed(1)} × {caseH.toFixed(1)} mm
            {processedUrl ? " · drag the photo to reposition" : " · preview"}
          </p>
        </section>
      </div>
    </main>
  );
}

// --- Inline styles (kept local to this single-file v1) ---------------------
const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "32px 20px 64px" },
  header: { marginBottom: 24 },
  h1: { fontSize: 26, margin: "0 0 6px" },
  sub: { color: "var(--muted)", margin: 0, fontSize: 14 },
  layout: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" },
  panel: {
    flex: "1 1 320px",
    minWidth: 300,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 20,
  },
  h2: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", margin: "22px 0 10px" },
  row: { display: "flex", gap: 10, alignItems: "center", fontSize: 14, margin: "8px 0" },
  field: { display: "block", margin: "10px 0" },
  label: { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "9px 10px",
    background: "var(--panel-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
  },
  select: {
    width: "100%",
    padding: "10px",
    background: "var(--panel-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  fileBtn: {
    display: "block",
    textAlign: "center",
    padding: "11px",
    background: "var(--panel-2)",
    border: "1px dashed var(--border)",
    borderRadius: 8,
    marginTop: 8,
  },
  primaryBtn: {
    width: "100%",
    padding: "12px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    marginTop: 4,
  },
  ghostBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  },
  previewWrap: { flex: "1 1 360px", minWidth: 320 },
  canvasArea: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 480,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 24,
  },
  dims: { textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 10 },
  muted: { color: "var(--muted)", fontSize: 14 },
  error: { color: "var(--danger)", fontSize: 14, marginTop: 12 },
};
