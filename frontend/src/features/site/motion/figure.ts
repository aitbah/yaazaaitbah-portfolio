/**
 * What the page needs to know about the portrait, read from its own pixels:
 * whether it has a transparent background (a cutout stands in the page; a
 * photograph with its backdrop falls away at its edges instead), where the head
 * is (the disc stands behind it). Nothing about the photograph is stored; a
 * new upload is read the same way.
 */

export type FigureShape = {
  /** Width over height. */
  aspect: number;
  /** A transparent background, as opposed to a photograph's own backdrop. */
  cut: boolean;
  /** Fractions of the image: the crown, the neck, the head's centre and half-width, the eyes. */
  head: { top: number; neck: number; cx: number; half: number; eye: number };
};

/** The defaults when the image cannot be read: a centred head-and-shoulders portrait. */
export const DEFAULT_HEAD: FigureShape['head'] = {
  top: 0.06,
  neck: 0.39,
  cx: 0.5,
  half: 0.2,
  eye: 0.23,
};

/** Reads RGBA pixels (`w` × `h`) of the portrait. */
export function readFigure(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
): Omit<FigureShape, 'aspect'> {
  const n = w * h;
  const alpha = new Float32Array(n);
  let clear = 0;

  for (let i = 0; i < n; i += 1) {
    alpha[i] = pixels[i * 4 + 3]! / 255;
    if (alpha[i]! < 0.5) clear += 1;
  }

  // A few transparent pixels are an edge; a background is a good share of the image.
  const cut = clear > n * 0.04;

  if (!cut) alpha.fill(1);

  const left = new Int32Array(h).fill(-1);
  const right = new Int32Array(h).fill(-1);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alpha[y * w + x]! > 0.5) {
        if (left[y]! < 0) left[y] = x;
        right[y] = x;
      }
    }
  }

  let top = 0;

  while (top < h && left[top]! < 0) top += 1;

  if (!cut || top >= h) {
    return { cut, head: DEFAULT_HEAD };
  }

  // The neck: the narrowest row between just below the crown and the middle.
  let neck = Math.round(h * 0.4);
  let narrowest = Infinity;

  for (let y = top + Math.round(h * 0.1); y < h * 0.55; y += 1) {
    if (left[y]! >= 0 && right[y]! - left[y]! < narrowest) {
      narrowest = right[y]! - left[y]!;
      neck = y;
    }
  }

  let half = 0;
  let mid = 0;
  let rows = 0;

  for (let y = top; y < neck; y += 1) {
    if (left[y]! < 0) continue;
    half = Math.max(half, (right[y]! - left[y]!) / 2);
    mid += (right[y]! + left[y]!) / 2;
    rows += 1;
  }

  return {
    cut,
    head: {
      top: top / h,
      neck: neck / h,
      cx: rows ? mid / rows / w : 0.5,
      half: half / w || DEFAULT_HEAD.half,
      eye: (top + (neck - top) * 0.52) / h,
    },
  };
}

/** Reads a loaded, same-origin image. `null` when the browser will not hand over its pixels. */
export function measureFigure(img: HTMLImageElement): FigureShape | null {
  if (!img.naturalWidth || !img.naturalHeight) {
    return null;
  }

  const h = 240;
  const w = Math.max(1, Math.round((h * img.naturalWidth) / img.naturalHeight));
  const canvas = document.createElement('canvas');

  canvas.width = w;
  canvas.height = h;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  try {
    context.drawImage(img, 0, 0, w, h);

    return {
      aspect: img.naturalWidth / img.naturalHeight,
      ...readFigure(context.getImageData(0, 0, w, h).data, w, h),
    };
  } catch {
    // A cross-origin image taints the canvas; the page still works without the reading.
    return null;
  }
}
