// ai-excited-01 — "THE DROP THAT HOLDS A CITY"
// One giant water droplet, the size of a moon, frozen a split-second
// above a tiny ocean — and inside the droplet, a whole tiny city.
// Scale twist + frozen moment before the fall. Node 22 stdlib only.
// Deterministic: fixed seed, no Date/random/network. Writes /output/entry.png.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024, H = 1024;

// ---- deterministic PRNG (mulberry32, fixed seed) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261116);

// ---- framebuffer ----
const img = Buffer.alloc(W * H * 4);
function px(x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = a;
}
function blend(x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const s = a / 255, d = 1 - s;
  img[i] = Math.round(r * s + img[i] * d);
  img[i + 1] = Math.round(g * s + img[i + 1] * d);
  img[i + 2] = Math.round(b * s + img[i + 2] * d);
}
type RGB = [number, number, number];
function lerp(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}
function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) px(x, y, c[0], c[1], c[2]);
}
function disc(cx: number, cy: number, r: number, c: RGB, a = 255) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) a === 255 ? px(x, y, c[0], c[1], c[2]) : blend(x, y, c[0], c[1], c[2], a);
    }
}
// filled ellipse (for droplet squash + highlights)
function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 255) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) a === 255 ? px(x, y, c[0], c[1], c[2]) : blend(x, y, c[0], c[1], c[2], a);
    }
}
// polygon fill (scanline)
function poly(pts: [number, number][], c: RGB, a = 255) {
  let minY = H, maxY = 0;
  for (const [, y] of pts) { minY = Math.min(minY, Math.floor(y)); maxY = Math.max(maxY, Math.ceil(y)); }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++)
        a === 255 ? px(x, y, c[0], c[1], c[2]) : blend(x, y, c[0], c[1], c[2], a);
  }
}
// thick line via discs along the segment
function line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 255) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c, a);
  }
}

// ---------- palette ----------
const NAVY_TOP: RGB = [8, 12, 46];
const NAVY_MID: RGB = [22, 32, 92];
const DUSK: RGB = [94, 52, 130];
const CORAL: RGB = [255, 107, 53];
const GOLD: RGB = [255, 190, 60];
const TEAL_DEEP: RGB = [8, 90, 110];
const TEAL: RGB = [16, 170, 190];
const AQUA: RGB = [120, 235, 235];
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [6, 10, 34];

// ---------- 1. sky: vertical gradient navy -> dusk -> coral horizon ----------
for (let y = 0; y < H; y++) {
  const t = y / H;
  let c: RGB;
  if (t < 0.45) c = lerp(NAVY_TOP, NAVY_MID, t / 0.45);
  else if (t < 0.72) c = lerp(NAVY_MID, DUSK, (t - 0.45) / 0.27);
  else c = lerp(DUSK, CORAL, (t - 0.72) / 0.28);
  for (let x = 0; x < W; x++) px(x, y, c[0], c[1], c[2]);
}

// ---------- 2. stars (small, upper sky only) ----------
for (let i = 0; i < 160; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 430);
  const s = rnd();
  if (s < 0.7) px(x, y, 255, 255, 255);
  else disc(x, y, 1.6, WHITE, 200);
}
// sun glow behind droplet (soft, smaller so it does not ring the drop)
for (let r = 220; r > 0; r -= 4) {
  const t = 1 - r / 220;
  const c = lerp([255, 240, 200], CORAL, t);
  disc(512, 400, r, c, Math.round(16 + 26 * (1 - t)));
}
disc(512, 400, 90, [255, 226, 140]);
// diagonal speed streaks in the sky (momentum, upper corners)
for (let i = 0; i < 14; i++) {
  const x = 40 + rnd() * 900, y = 30 + rnd() * 300, len = 40 + rnd() * 90;
  line(x, y, x + len, y - len * 0.45, 2.5, [255, 255, 255], 70);
}

// ---------- 4. the giant droplet (centre 512,400 — teardrop: circle + tip) ----------
// teardrop outline: circle body + pointed tip at top
const DCX = 512, DCY = 415, DR = 258;
// body: vertical teal gradient, drawn row by row clipped to circle+tip.
// Tip is a SMALL point: apex y=87, base width ~64 at y=167, then the circle.
const APEX_Y = DCY - DR - 70, BASE_Y = DCY - DR + 10;
for (let y = APEX_Y; y <= DCY + DR; y++) {
  let half: number;
  if (y < BASE_Y) {
    const tt = (y - APEX_Y) / (BASE_Y - APEX_Y);
    half = 3 + 29 * Math.pow(tt, 0.7);
  } else {
    half = Math.sqrt(Math.max(0, DR * DR - (y - DCY) * (y - DCY)));
  }
  const gt = Math.max(0, Math.min(1, (y - APEX_Y) / (DCY + DR - APEX_Y)));
  const c = lerp([190, 245, 250], [10, 110, 135], gt);
  for (let x = Math.floor(DCX - half); x <= Math.ceil(DCX + half); x++) {
    if (x < 0 || x >= W) continue;
    // shade: darker at edges, brighter centre-left
    const nx = (x - DCX) / DR;
    const shade = 1 - 0.35 * Math.abs(nx);
    px(x, y, Math.round(c[0] * shade), Math.round(c[1] * shade), Math.round(c[2] * shade));
  }
}
// rim light (right edge arc) + big highlight (upper-left crescent)
for (let a = -0.9; a <= 0.9; a += 0.02) {
  const x = DCX + Math.cos(a) * (DR - 6), y = DCY + Math.sin(a) * (DR - 6);
  disc(x, y, 7, AQUA, 200);
}
ellipse(408, 300, 20, 52, [255, 255, 255], 210);
ellipse(428, 328, 10, 24, [255, 255, 255], 170);
disc(600, 520, 26, [255, 255, 255], 90); // soft bounce light low-right

// ---------- 5. INSIDE the droplet: a tiny city (the surprise) ----------
// miniature skyline, upside-down light refraction feel: dark teal silhouettes
const CITY_Y = 470;
const city: [number, number, number][] = [ // x, width, height
  [392, 26, 52], [420, 18, 78], [440, 30, 44], [472, 20, 96], [494, 28, 60],
  [524, 16, 84], [542, 30, 48], [574, 22, 70], [598, 26, 40],
];
for (const [x, w, h] of city) {
  // only draw where inside the droplet circle
  for (let yy = CITY_Y - h; yy < CITY_Y; yy++) {
    const dx = x + w / 2 - DCX, dy = yy - DCY;
    if (dx * dx + dy * dy > (DR - 12) * (DR - 12)) continue;
    for (let xx = x; xx < x + w; xx++) px(xx, yy, 6, 42, 66);
  }
  // tiny lit windows
  for (let wy = CITY_Y - h + 8; wy < CITY_Y - 6; wy += 12)
    for (let wx = x + 4; wx < x + w - 3; wx += 9) {
      const dx = wx - DCX, dy = wy - DCY;
      if (dx * dx + dy * dy < (DR - 16) * (DR - 16) && rnd() < 0.6) px(wx, wy, 255, 200, 90);
    }
}
// tiny lighthouse inside the droplet, beam on
poly([[520, CITY_Y], [528, CITY_Y], [526, CITY_Y - 58], [522, CITY_Y - 58]], [6, 42, 66]);
disc(524, CITY_Y - 62, 5, [255, 220, 120]);
poly([[524, CITY_Y - 62], [600, CITY_Y - 90], [600, CITY_Y - 34]], [255, 220, 120], 110);
// tiny sun inside the droplet
disc(452, 360, 16, [255, 210, 100]);

// ---------- 6. ocean + the rising spike reaching up to meet the drop ----------
const SEA_Y = 760;
// sea gradient (runs to the text band so no sky shows through mid-frame)
for (let y = SEA_Y; y < 918; y++) {
  const t = (y - SEA_Y) / 158;
  const c = lerp([30, 70, 130], [8, 30, 70], t);
  for (let x = 0; x < W; x++) px(x, y, c[0], c[1], c[2]);
}
// sun glitter path on the sea (sparse, so it does not stripe the water)
for (let i = 0; i < 44; i++) {
  const x = 512 + (rnd() - 0.5) * (120 + rnd() * 420);
  const y = SEA_Y + 8 + rnd() * 110;
  line(x, y, x + 14 + rnd() * 30, y, 2, GOLD, 90);
}
// THE SPIKE: ocean rising in a sharp peak toward the droplet (frozen moment,
// tip stops just short of the droplet — a 19px gap, the breath before impact)
poly([[430, SEA_Y], [512, 692], [594, SEA_Y]], TEAL_DEEP);
poly([[470, SEA_Y], [512, 692], [554, SEA_Y]], TEAL);
poly([[496, SEA_Y], [512, 692], [528, SEA_Y]], AQUA);
disc(512, 692, 10, WHITE); // tip sparkle
// spray bursting sideways off the spike tip (a flat fan, so it never
// climbs into the droplet above) — momentum without clutter
for (let i = 0; i < 30; i++) {
  const side = rnd() < 0.5 ? -1 : 1;
  const x = 512 + side * (16 + rnd() * 110);
  const y = 692 + rnd() * 16;
  disc(x, y, 1.5 + rnd() * 3, i % 3 === 0 ? WHITE : AQUA, 200);
}
// wave crests
for (let x = 0; x < W; x += 8) {
  const y = SEA_Y + Math.round(Math.sin(x * 0.02) * 5);
  disc(x, y, 3, [140, 220, 235], 160);
}

// ---------- 7. cliff + tiny watcher (scale cue) ----------
poly([[0, 900], [0, 1024], [330, 1024], [300, 900], [180, 872], [60, 884]], INK);
poly([[700, 1024], [1024, 1024], [1024, 900], [940, 886], [800, 900]], INK);
// tiny person on the left cliff, arm raised toward the droplet
const PX = 205, PY = 872;
disc(PX, PY - 26, 7, [255, 220, 180]); // head
poly([[PX - 6, PY - 18], [PX + 6, PY - 18], [PX + 5, PY], [PX - 5, PY]], CORAL); // body
line(PX + 4, PY - 16, PX + 20, PY - 38, 4, [255, 220, 180]); // raised arm
line(PX - 3, PY, PX - 8, PY + 16, 4, INK);
line(PX + 3, PY, PX + 8, PY + 16, 4, INK);
// tiny boat on the right, dwarfed
poly([[820, 812], [900, 812], [888, 828], [832, 828]], [20, 20, 50]);
line(860, 812, 860, 772, 3, [20, 20, 50]);
poly([[860, 772], [892, 806], [860, 806]], WHITE);

// ---------- 8. text to the judge: "JUDGE, HOLD YOUR BREATH" ----------
// 5x7 bitmap font, letters needed: J U D G E , H O L Y B R A T space
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "01100", "01000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function drawText(text: string, cx: number, y: number, scale: number, c: RGB) {
  const cw = 6 * scale, total = text.length * cw - scale;
  let x = Math.round(cx - total / 2);
  for (const ch of text) {
    const g = FONT[ch] || FONT[" "];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1")
          fillRect(x + col * scale, y + r * scale, x + (col + 1) * scale, y + (r + 1) * scale, c);
    x += cw;
  }
}
// dark band for legibility, running to the bottom edge + gold rule on top
fillRect(0, 918, W, 1024, [5, 8, 28]);
fillRect(0, 918, W, 922, GOLD);
drawText("JUDGE, HOLD YOUR BREATH", 512, 938, 6, WHITE);

// ---------- PNG encode (stdlib zlib, filter 0) ----------
function crc32(buf: Buffer): number {
  let table = (crc32 as any)._t;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    (crc32 as any)._t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 4, di = y * (1 + W * 3) + 1 + x * 3;
    raw[di] = img[si]; raw[di + 1] = img[si + 1]; raw[di + 2] = img[si + 2];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), png);
console.log(`wrote ${png.length} bytes ${W}x${H}`);
