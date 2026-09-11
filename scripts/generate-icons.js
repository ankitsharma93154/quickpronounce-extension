#!/usr/bin/env node
/*
 * Writes icons/icon{16,32,48,128}.png.
 *
 *   node scripts/generate-icons.js
 *
 * Source of truth: icons/source-logo.png - the QuickPronounce mark copied from
 * Pronounce_web/src/images/Logo_icon.png (the gradient "Q" the site header
 * uses). This script decodes it and produces the four sizes by area-averaged
 * downscaling. If source-logo.png is missing it falls back to a drawn
 * placeholder mark so the script still runs standalone.
 *
 * Stdlib only (zlib). No image libraries.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "icons");
const SOURCE = path.join(OUT_DIR, "source-logo.png");
const SIZES = [16, 32, 48, 128];

// The source art leaves a wide white margin around the mark, which makes the
// pinned toolbar icon look small. Crop to the coloured content plus a little
// breathing room so the mark fills this fraction of the icon's wider axis,
// then round the corners so the remaining white reads as a card, not a box.
const CONTENT_FILL = 1.02; // >1 crops slightly into the mark's own edge whitespace
const CORNER_RADIUS_FRAC = 0.12;

// --- PNG decode: colorType 3 (palette), 8-bit, non-interlaced -------------
function decodePNG(buf) {
  if (buf.length < 8 || buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error("not a PNG");
  }
  let i = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];

  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      plte = Buffer.from(data);
    } else if (type === "tRNS") {
      trns = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    i += 12 + len;
  }

  if (colorType !== 3 || bitDepth !== 8 || interlace !== 0 || !plte) {
    throw new Error(
      `unsupported PNG (colorType ${colorType}, bitDepth ${bitDepth}, interlace ${interlace}) - ` +
        "re-export source-logo.png as an 8-bit non-interlaced PNG, or let the drawn fallback run"
    );
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const idx = new Uint8Array(width * height);
  const prev = new Uint8Array(width);
  const cur = new Uint8Array(width);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < width; x++) {
      const rb = raw[pos++];
      const a = x >= 1 ? cur[x - 1] : 0;
      const b = prev[x];
      const c = x >= 1 ? prev[x - 1] : 0;
      let v;
      if (filter === 0) v = rb;
      else if (filter === 1) v = (rb + a) & 0xff;
      else if (filter === 2) v = (rb + b) & 0xff;
      else if (filter === 3) v = (rb + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (rb + pr) & 0xff;
      } else {
        throw new Error("bad scanline filter " + filter);
      }
      cur[x] = v;
    }
    idx.set(cur, y * width);
    prev.set(cur);
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const k = idx[p];
    rgba[p * 4] = plte[k * 3];
    rgba[p * 4 + 1] = plte[k * 3 + 1];
    rgba[p * 4 + 2] = plte[k * 3 + 2];
    rgba[p * 4 + 3] = trns && k < trns.length ? trns[k] : 255;
  }
  return { width, height, rgba };
}

// --- bounding box of the coloured (non-white, opaque) content -----------
function contentBox(rgba, w, h) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3];
      const nearWhite = rgba[i] > 238 && rgba[i + 1] > 238 && rgba[i + 2] > 238;
      if (a > 8 && !nearWhite) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  return { x0, y0, x1, y1 };
}

// Square crop of `src` centred on the content, sized so the content's wider
// axis is CONTENT_FILL of the crop. Areas pulled from outside the source are
// filled white (the source's own margin colour), keeping the card look.
function cropToContent(src, w, h) {
  const b = contentBox(src, w, h);
  const cw = b.x1 - b.x0 + 1;
  const ch = b.y1 - b.y0 + 1;
  const side = Math.round(Math.max(cw, ch) / CONTENT_FILL);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);

  const out = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const sx = left + x;
      const sy = top + y;
      const di = (y * side + x) * 4;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) {
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 255; // white card
      } else {
        const si = (sy * w + sx) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = src[si + 3];
      }
    }
  }
  return { rgba: out, size: side };
}

// Round the corners: alpha 0 outside a rounded square, with 3x3 coverage AA.
function roundCorners(rgba, size) {
  const r = size * CORNER_RADIUS_FRAC;
  const inside = (px, py) => {
    const x0 = 0;
    const y0 = 0;
    const x1 = size - 1;
    const y1 = size - 1;
    if (px >= x0 + r && px <= x1 - r) return true;
    if (py >= y0 + r && py <= y1 - r) return true;
    const cx = Math.min(Math.max(px, x0 + r), x1 - r);
    const cy = Math.min(Math.max(py, y0 + r), y1 - r);
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hit++;
        }
      }
      if (hit < 9) {
        const i = (y * size + x) * 4;
        rgba[i + 3] = Math.round((rgba[i + 3] * hit) / 9);
      }
    }
  }
  return rgba;
}

// --- area-averaged downscale (premultiplied so edges don't darken) -------
function resample(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const scaleX = sw / dw;
  const scaleY = sh / dh;

  for (let dy = 0; dy < dh; dy++) {
    const y0 = dy * scaleY;
    const y1 = (dy + 1) * scaleY;
    for (let dx = 0; dx < dw; dx++) {
      const x0 = dx * scaleX;
      const x1 = (dx + 1) * scaleX;

      let R = 0;
      let G = 0;
      let B = 0;
      let A = 0;
      let W = 0;

      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          const w = wx * wy;
          const si = (yy * sw + xx) * 4;
          const a = src[si + 3];
          R += src[si] * a * w;
          G += src[si + 1] * a * w;
          B += src[si + 2] * a * w;
          A += a * w;
          W += w;
        }
      }

      const di = (dy * dw + dx) * 4;
      if (A <= 0) {
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0;
      } else {
        out[di] = Math.round(R / A);
        out[di + 1] = Math.round(G / A);
        out[di + 2] = Math.round(B / A);
        out[di + 3] = Math.round(A / W);
      }
    }
  }
  return out;
}

// --- drawn fallback mark (only if source-logo.png is absent) -------------
function drawFallback(size) {
  const SS = 4;
  const S = size * SS;
  const hi = new Uint8Array(S * S * 4);
  const rad = S * 0.22;
  const inRR = (x, y, x0, y0, x1, y1, r) => {
    if (x >= x0 + r && x <= x1 - r && y >= y0 && y <= y1) return true;
    if (y >= y0 + r && y <= y1 - r && x >= x0 && x <= x1) return true;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (!inRR(x + 0.5, y + 0.5, 0, 0, S - 1, S - 1, rad)) continue;
      const t = y / (S - 1);
      hi[i] = Math.round(0x4a + (0x6e - 0x4a) * t);
      hi[i + 1] = Math.round(0x6c + (0x45 - 0x6c) * t);
      hi[i + 2] = Math.round(0xf7 + (0xe2 - 0xf7) * t);
      hi[i + 3] = 255;
    }
  }
  const bw = Math.round(S * 0.12);
  const gap = Math.round(S * 0.085);
  const hs = [0.3, 0.54, 0.4].map((f) => Math.round(S * f));
  let bx = Math.round((S - (bw * 3 + gap * 2)) / 2);
  for (let k = 0; k < 3; k++) {
    const y0 = Math.round(S / 2 - hs[k] / 2);
    const y1 = Math.round(S / 2 + hs[k] / 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = bx; x <= bx + bw; x++) {
        if (x < 0 || y < 0 || x >= S || y >= S) continue;
        if (inRR(x + 0.5, y + 0.5, bx, y0, bx + bw - 1, y1 - 1, bw / 2)) {
          const i = (y * S + x) * 4;
          hi[i] = hi[i + 1] = hi[i + 2] = hi[i + 3] = 255;
        }
      }
    }
    bx += bw + gap;
  }
  return resample(Buffer.from(hi), S, S, size, size);
}

// --- minimal PNG encoder (RGBA) ----------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// --- run --------------------------------------------------------------
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let cropped = null;
if (fs.existsSync(SOURCE)) {
  const src = decodePNG(fs.readFileSync(SOURCE));
  cropped = cropToContent(src.rgba, src.width, src.height);
  console.log(
    `source: icons/source-logo.png (${src.width}x${src.height}) -> cropped to ${cropped.size}x${cropped.size} (fill ${CONTENT_FILL})`
  );
} else {
  console.log("source: icons/source-logo.png not found - using drawn fallback mark");
}

for (const size of SIZES) {
  const rgba = cropped
    ? roundCorners(resample(cropped.rgba, cropped.size, cropped.size, size, size), size)
    : drawFallback(size);
  const png = encodePNG(rgba, size);
  fs.writeFileSync(path.join(OUT_DIR, `icon${size}.png`), png);
  console.log(`  wrote icons/icon${size}.png (${png.length} bytes)`);
}
console.log("done");
