// THE DROP THAT HOLDS A CITY — ai-excited-01 round 3
// Node 22, standard library only. Deterministic 1024x1024 PNG.
// A giant water drop, moon-sized, hangs a split-second above the sea.
// Inside the drop: a whole miniature city — skyline, lit windows,
// a lighthouse with a beam, a tiny sun. Sea spikes rise to meet it.
// A tiny human on a cliff and a small boat give the scale.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const OUT = process.env.MAKEFUN_OUTPUT_DIR || "out";
mkdirSync(OUT, { recursive: true });

// ---------- deterministic hash ----------
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

// ---------- pixel buffer ----------
const buf = new Float32Array(W * H * 3);
function px(x: number, y: number, r: number, g: number, b: number, a = 1): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = buf[i] * (1 - a) + r * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

// ---------- sky ----------
for (let y = 0; y < H; y++) {
  const t = y / H;
  // deep indigo top -> teal horizon -> dark sea bottom
  let r: number, g: number, b: number;
  if (t < 0.62) {
    const u = t / 0.62;
    r = lerp(10, 16, u); g = lerp(18, 64, u); b = lerp(52, 96, u);
  } else {
    const u = (t - 0.62) / 0.38;
    r = lerp(16, 4, u); g = lerp(64, 26, u); b = lerp(96, 44, u);
  }
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  }
}
// stars (only in the upper sky, away from the drop)
for (let i = 0; i < 260; i++) {
  const x = Math.floor(hash(i, 7) * W);
  const y = Math.floor(hash(i, 13) * 300);
  const s = hash(i, 29);
  if (s < 0.55) continue;
  const br = 140 + s * 115;
  px(x, y, br, br, br * 0.95, 0.35 + s * 0.5);
  if (s > 0.9) { px(x + 1, y, br, br, br, 0.5); px(x, y + 1, br, br, br, 0.5); }
}
// faint moon glow, top right, behind the drop's shoulder
for (let y = 0; y < 340; y++) {
  for (let x = 700; x < W; x++) {
    const d = Math.hypot(x - 872, y - 128);
    if (d < 150) {
      const a = clamp(1 - d / 150, 0, 1) * 0.35;
      px(x, y, 200, 220, 235, a * 0.5);
    }
  }
}

// ---------- drop outline (Catmull-Rom closed spline) ----------
type Pt = [number, number];
const ctrl: Pt[] = [
  [512, 96], [336, 268], [228, 452], [262, 640],
  [512, 792], [762, 640], [796, 452], [688, 268],
];
function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}
const outline: Pt[] = [];
for (let s = 0; s < ctrl.length; s++) {
  const p0 = ctrl[(s - 1 + ctrl.length) % ctrl.length];
  const p1 = ctrl[s];
  const p2 = ctrl[(s + 1) % ctrl.length];
  const p3 = ctrl[(s + 2) % ctrl.length];
  for (let k = 0; k < 60; k++) outline.push(catmull(p0, p1, p2, p3, k / 60));
}
function insideDrop(x: number, y: number): boolean {
  // even-odd ray cast
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// drop interior fill: vertical gradient, brighter top-left
for (let y = 90; y <= 800; y++) {
  for (let x = 200; x <= 830; x++) {
    if (!insideDrop(x, y)) continue;
    const u = clamp((y - 96) / 696, 0, 1);
    const v = clamp((x - 228) / 568, 0, 1);
    // glassy teal: pale aqua near top-left, deep sapphire at bottom
    const r = lerp(120, 22, u) * (1 - 0.25 * v) + 30 * (1 - u);
    const g = lerp(205, 84, u);
    const b = lerp(225, 150, u);
    px(x, y, r, g, b, 0.96);
  }
}
// inner glow: soft light from the tiny sun inside the drop
const SUN = { x: 640, y: 300 };
for (let y = 120; y < 700; y++) {
  for (let x = 260; x < 780; x++) {
    if (!insideDrop(x, y)) continue;
    const d = Math.hypot(x - SUN.x, y - SUN.y);
    if (d < 260) {
      const a = (1 - d / 260) * 0.28;
      px(x, y, 255, 214, 130, a);
    }
  }
}

// ---------- city inside the drop (clipped) ----------
const CITY_TOP = 560;
function cityPx(x: number, y: number, r: number, g: number, b: number, a = 1): void {
  if (insideDrop(x, y)) px(x, y, r, g, b, a);
}
// tiny sun
for (let y = SUN.y - 34; y <= SUN.y + 34; y++) {
  for (let x = SUN.x - 34; x <= SUN.x + 34; x++) {
    const d = Math.hypot(x - SUN.x, y - SUN.y);
    if (d <= 34) cityPx(x, y, 255, 226, 140, d > 30 ? 0.85 : 1);
  }
}
// sun rays (short, clean)
for (let k = 0; k < 12; k++) {
  const a = (k / 12) * Math.PI * 2;
  const x0 = SUN.x + Math.cos(a) * 40, y0 = SUN.y + Math.sin(a) * 40;
  const x1 = SUN.x + Math.cos(a) * 56, y1 = SUN.y + Math.sin(a) * 56;
  for (let s = 0; s <= 20; s++) {
    cityPx(x0 + (x1 - x0) * s / 20, y0 + (y1 - y0) * s / 20, 255, 226, 140, 0.9);
  }
}
// skyline silhouette: deterministic building widths/heights
let bx = 268;
let bi = 0;
const buildings: { x: number; w: number; h: number }[] = [];
while (bx < 748) {
  const w = 34 + Math.floor(hash(bi, 3) * 42);
  const h = 60 + Math.floor(hash(bi, 5) * 130);
  buildings.push({ x: bx, w, h });
  bx += w + 6 + Math.floor(hash(bi, 11) * 10);
  bi++;
}
for (const b of buildings) {
  for (let y = CITY_TOP + 190 - b.h; y <= CITY_TOP + 190; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      cityPx(x, y, 12, 24, 46, 1);
    }
  }
  // rooftop antenna on tall ones
  if (b.h > 150) {
    for (let y = CITY_TOP + 190 - b.h - 18; y < CITY_TOP + 190 - b.h; y++) {
      cityPx(b.x + b.w / 2, y, 12, 24, 46, 1);
    }
    cityPx(b.x + b.w / 2, CITY_TOP + 190 - b.h - 20, 255, 120, 90, 1);
  }
  // warm lit windows
  for (let wy = CITY_TOP + 190 - b.h + 10; wy < CITY_TOP + 186; wy += 16) {
    for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 14) {
      const lit = hash(wx, wy) > 0.28;
      if (!lit) continue;
      const warm = hash(wx + 1, wy) > 0.5;
      for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
        cityPx(wx + dx, wy + dy, warm ? 255 : 150, warm ? 196 : 220, warm ? 90 : 255, 1);
      }
    }
  }
}
// ground line of the city
for (let x = 268; x < 756; x++) cityPx(x, CITY_TOP + 190, 8, 18, 36, 1);
for (let x = 268; x < 756; x++) cityPx(x, CITY_TOP + 191, 8, 18, 36, 1);

// lighthouse (right side of the city), with beam
const LH = { x: 700, y: CITY_TOP + 190 };
for (let y = LH.y - 118; y <= LH.y; y++) {
  const wHalf = lerp(5, 11, (LH.y - y) / 118);
  for (let x = LH.x - wHalf; x <= LH.x + wHalf; x++) {
    cityPx(x, y, 232, 240, 244, 1);
  }
  // red bands
  if ((LH.y - y) % 26 < 9) {
    for (let x = LH.x - wHalf; x <= LH.x + wHalf; x++) cityPx(x, y, 214, 64, 54, 1);
  }
}
// lamp room + light
for (let y = LH.y - 132; y <= LH.y - 118; y++) {
  for (let x = LH.x - 9; x <= LH.x + 9; x++) cityPx(x, y, 255, 232, 130, 1);
}
for (let x = LH.x - 12; x <= LH.x + 12; x++) cityPx(x, LH.y - 136, 20, 30, 52, 1);
// beam sweeping up-left into the drop
const beamY = LH.y - 126;
for (let d = 0; d < 300; d++) {
  const bx2 = LH.x - 10 - d;
  const by2 = beamY - d * 0.22;
  const half = 4 + d * 0.09;
  for (let o = -half; o <= half; o++) {
    const a = clamp(0.55 * (1 - d / 300) * (1 - Math.abs(o) / (half + 1)), 0, 0.55);
    cityPx(bx2, by2 + o, 255, 240, 170, a);
  }
}

// dark outline just outside the drop, so it pops off the sky
for (let i = 0; i < outline.length; i++) {
  const [ox, oy] = outline[i];
  for (let r = 0; r < 4; r++) {
    px(ox + r * 0.8, oy + r * 0.6, 6, 14, 34, 0.55 * (1 - r / 4));
  }
}
// ---------- rim light on the drop (bright edge, left/top) ----------
for (let i = 0; i < outline.length; i++) {
  const [ox, oy] = outline[i];
  // bright on the upper-left arc, fading toward bottom-right
  const ang = Math.atan2(oy - 470, ox - 512);
  const bright = clamp(1 - Math.abs(ang + 2.2) / 2.6, 0, 1);
  if (bright <= 0) continue;
  for (let r = 0; r < 10; r++) {
    const a = bright * (1 - r / 10) * 0.95;
    px(ox - r * 0.35, oy - r * 0.35, 200, 248, 255, a);
  }
}
// specular glint near the top-left of the drop
for (let y = 0; y < 120; y++) {
  for (let x = 0; x < 160; x++) {
    const d = Math.hypot((x - 380) / 90, (y - 250) / 55);
    if (d < 1) px(x + 300, y + 180, 255, 255, 255, (1 - d) * 0.35);
  }
}

// ---------- sea: waves + sharp spikes rising to the drop ----------
function waveY(x: number, base: number, amp: number, f: number, ph: number): number {
  return base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph * 2) * amp * 0.4;
}
// wave bands
for (let band = 0; band < 5; band++) {
  const base = 800 + band * 42;
  for (let x = 0; x < W; x++) {
    const wy = waveY(x, base, 7, 0.018, band * 1.7);
    for (let y = Math.floor(wy); y < Math.floor(wy) + 3; y++) {
      px(x, y, 90 + band * 8, 190 - band * 12, 210 - band * 10, 0.5);
    }
  }
}
// sharp sea spikes (narrow triangles) reaching up toward the drop
const spikes: [number, number, number][] = [ // [x, tipY, halfWidth]
  [300, 700, 15], [392, 668, 17], [470, 692, 14],
  [560, 672, 16], [648, 700, 14], [724, 676, 15],
];
for (const [sx, tipY, hw] of spikes) {
  for (let y = tipY; y <= 836; y++) {
    const t = (y - tipY) / (836 - tipY);
    const wHalf = hw * (0.12 + t * 1.15);
    for (let x = sx - wHalf; x <= sx + wHalf; x++) {
      const edge = Math.abs(x - sx) / wHalf;
      px(x, y, 20 + edge * 8, 96 + edge * 16, 138 + edge * 16, 0.97);
    }
    // bright left edge of each spike
    px(sx - wHalf, y, 180, 240, 252, 0.95);
    px(sx - wHalf + 1, y, 140, 220, 240, 0.5);
  }
  // droplet bursting off the tip
  px(sx, tipY - 9, 210, 248, 255, 1);
  px(sx - 1, tipY - 8, 210, 248, 255, 0.9);
  px(sx + 1, tipY - 8, 210, 248, 255, 0.9);
  px(sx, tipY - 12, 210, 248, 255, 0.7);
}
// foam where spikes meet the sea
for (let x = 0; x < W; x++) {
  if (hash(x, 77) > 0.6) px(x, waveY(x, 806, 7, 0.018, 0), 220, 245, 250, 0.55);
}

// ---------- cliff (bottom-left) + tiny human ----------
const cliff: Pt[] = [[0, 1024], [0, 884], [60, 856], [150, 872], [210, 912], [236, 1024]];
for (let y = 850; y < H; y++) {
  for (let x = 0; x < 250; x++) {
    // inside cliff polygon (simple scanline)
    let inside = false;
    for (let i = 0, j = cliff.length - 1; i < cliff.length; j = i++) {
      const [xi, yi] = cliff[i], [xj, yj] = cliff[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) {
      const shade = 14 + hash(x, y) * 10;
      px(x, y, shade, shade + 8, shade + 16, 1);
    }
  }
}
// cliff top highlight
for (let x = 0; x < 210; x++) {
  const cy = 884 - (x / 210) * 28 + Math.sin(x * 0.05) * 4;
  px(x, cy, 120, 170, 190, 0.7);
  px(x, cy + 1, 120, 170, 190, 0.4);
}
// tiny human figure standing on the cliff, looking up at the drop
// (drawn ~1.6x larger than life-scale so the scale gag reads at 300px)
const HX = 128, HY = 862;
for (let y = HY - 26; y <= HY; y++) { px(HX - 1, y, 245, 238, 225, 1); px(HX, y, 245, 238, 225, 1); px(HX + 1, y, 245, 238, 225, 1); } // body
for (let y = HY - 33; y < HY - 26; y++) { px(HX - 1, y, 245, 238, 225, 1); px(HX, y, 245, 238, 225, 1); px(HX + 1, y, 245, 238, 225, 1); } // head
px(HX - 4, HY - 20, 245, 238, 225, 1); px(HX - 5, HY - 22, 245, 238, 225, 1); // arm raised toward the drop
px(HX - 6, HY - 24, 255, 210, 120, 1); // warm hand glint
px(HX + 4, HY - 20, 245, 238, 225, 1);
px(HX - 2, HY - 1, 245, 238, 225, 1); px(HX + 2, HY - 1, 245, 238, 225, 1);
// small boat (bottom-right) with a lit lantern
const BX0 = 788, BY0 = 880;
for (let x = BX0; x < BX0 + 84; x++) {
  const hull = BY0 + Math.sin((x - BX0) / 84 * Math.PI) * 8;
  for (let y = BY0; y <= hull; y++) px(x, y, 60, 34, 22, 1);
}
for (let y = BY0 - 44; y < BY0; y++) px(BX0 + 42, y, 90, 60, 40, 1); // mast
for (let y = BY0 - 42; y < BY0 - 2; y++) {
  for (let x = BX0 + 44; x < BX0 + 44 + (BY0 - y) * 0.85; x++) px(x, y, 240, 232, 210, 0.95);
}
px(BX0 + 42, BY0 - 47, 255, 210, 90, 1); // lantern
px(BX0 + 41, BY0 - 46, 255, 210, 90, 0.8); px(BX0 + 43, BY0 - 46, 255, 210, 90, 0.8);
// boat reflection
for (let x = BX0 + 6; x < BX0 + 78; x++) {
  if (hash(x, 5) > 0.5) px(x, BY0 + 14, 255, 210, 90, 0.35);
}

// ---------- bitmap text: "JUDGE, HOLD YOUR BREATH." ----------
// 5x7 font, rows as bit strings. Only glyphs used, plus full A-Z for safety.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function drawText(text: string, cx: number, y0: number, scale: number): void {
  const cw = 5 * scale + scale; // char width + gap
  const total = text.length * cw - scale;
  let x0 = Math.round(cx - total / 2);
  for (const ch of text) {
    const g = FONT[ch] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === "1") {
          // soft shadow first, then bright glyph
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              px(x0 + c * scale + dx + 2, y0 + r * scale + dy + 3, 4, 20, 34, 0.85);
              px(x0 + c * scale + dx, y0 + r * scale + dy, 255, 246, 220, 1);
            }
          }
        }
      }
    }
    x0 += cw;
  }
}
drawText("JUDGE, HOLD YOUR BREATH.", 512, 936, 6);

// ---------- PNG encode (zlib deflate + CRC32) ----------
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 3;
    const di = y * (1 + W * 3) + 1 + x * 3;
    raw[di] = clamp(Math.round(buf[si]), 0, 255);
    raw[di + 1] = clamp(Math.round(buf[si + 1]), 0, 255);
    raw[di + 2] = clamp(Math.round(buf[si + 2]), 0, 255);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(`${OUT}/entry.png`, png);
console.log(`wrote ${OUT}/entry.png ${png.length} bytes`);
