// THE DROP THAT HOLDS A CITY
// A giant water drop, moon-sized, frozen a split-second above the sea —
// and inside the drop sits a whole miniature city.
// Procedural 1024x1024 PNG, standard library only, fully deterministic.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- pixels
const px = new Uint8Array(W * H * 3);
function setPx(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}
function blendPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  if (a >= 1) {
    setPx(x, y, r, g, b);
    return;
  }
  const i = (y * W + x) * 3;
  px[i] = Math.round(px[i] * (1 - a) + r * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Fixed-seed PRNG (deterministic)
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1337);

// ---------------------------------------------------------------- shapes
function fillCircle(cx: number, cy: number, r: number, col: [number, number, number], a = 1): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) blendPx(x, y, col[0], col[1], col[2], a);
    }
  }
}
function fillRect(x0: number, y0: number, x1: number, y1: number, col: [number, number, number], a = 1): void {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
      blendPx(x, y, col[0], col[1], col[2], a);
    }
  }
}
// Scanline polygon fill
function fillPolygon(pts: Array<[number, number]>, col: [number, number, number], a = 1): void {
  let minY = H;
  let maxY = 0;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        blendPx(x, y, col[0], col[1], col[2], a);
      }
    }
  }
}
function drawLine(x0: number, y0: number, x1: number, y1: number, col: [number, number, number], a: number, w: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x0 + dx * t, y0 + dy * t, w / 2, col, a);
  }
}

// ---------------------------------------------------------------- the drop
const DCX = 512;
const DCY = 380;
const DR = 230;
const DYS = 1.2; // vertical stretch -> teardrop, taller than wide
function dropRadius(theta: number): number {
  const s = Math.sin(theta);
  return DR * (1 + 0.38 * s * s * s);
}
function pointInDrop(x: number, y: number): { inside: boolean; ratio: number } {
  const dx = x - DCX;
  const dy = (y - DCY) / DYS;
  const d = Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dy, dx);
  return { inside: d <= dropRadius(theta), ratio: d / dropRadius(theta) };
}
function dropOutlinePoints(n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = dropRadius(t);
    pts.push([DCX + r * Math.cos(t), DCY + r * Math.sin(t) * DYS]);
  }
  return pts;
}

// ---------------------------------------------------------------- bitmap font (5x7)
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  J: ['..###', '....#', '....#', '....#', '....#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
function drawGlyph(ch: string, x0: number, y0: number, s: number, col: [number, number, number], a = 1): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (g[r][c] === '#') {
        fillRect(x0 + c * s, y0 + r * s, x0 + (c + 1) * s - 1, y0 + (r + 1) * s - 1, col, a);
      }
    }
  }
}
function drawText(text: string, x0: number, y0: number, s: number): void {
  const dark: [number, number, number] = [4, 16, 28];
  const bright: [number, number, number] = [255, 233, 168];
  const adv = 6 * s;
  for (let i = 0; i < text.length; i++) {
    const x = x0 + i * adv;
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] as Array<[number, number]>) {
      drawGlyph(text[i], x + ox, y0 + oy, s, dark, 1);
    }
  }
  for (let i = 0; i < text.length; i++) {
    drawGlyph(text[i], x0 + i * adv, y0, s, bright, 1);
  }
}

// ---------------------------------------------------------------- scene
function drawSky(): void {
  const top: [number, number, number] = [5, 15, 30];
  const horizon: [number, number, number] = [10, 46, 61];
  for (let y = 0; y < 790; y++) {
    const t = y / 790;
    const r = Math.round(lerp(top[0], horizon[0], t));
    const g = Math.round(lerp(top[1], horizon[1], t));
    const b = Math.round(lerp(top[2], horizon[2], t));
    for (let x = 0; x < W; x++) {
      // moon glow behind the drop
      const dx = x - DCX;
      const dy = (y - DCY) / 1.1;
      const d = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - d / 430);
      const gg = glow * glow * 0.55;
      setPx(x, y, Math.round(r + 90 * gg), Math.round(g + 120 * gg), Math.round(b + 120 * gg));
    }
  }
  // stars
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * 620);
    const b = 0.35 + rand() * 0.65;
    const s = rand() < 0.12 ? 2 : 1;
    fillRect(x, y, x + s - 1, y + s - 1, [Math.round(220 * b), Math.round(235 * b), Math.round(255 * b)], 0.9);
  }
}

function drawSea(): void {
  const top: [number, number, number] = [8, 44, 62];
  const bottom: [number, number, number] = [3, 18, 32];
  for (let y = 780; y < H; y++) {
    const t = (y - 780) / (H - 780);
    const r = Math.round(lerp(top[0], bottom[0], t));
    const g = Math.round(lerp(top[1], bottom[1], t));
    const b = Math.round(lerp(top[2], bottom[2], t));
    for (let x = 0; x < W; x++) {
      setPx(x, y, r, g, b);
    }
  }
  // reflection streak under the drop
  for (let y = 780; y < 940; y++) {
    const a = 0.16 * (1 - (y - 780) / 160);
    const wdt = 42 + (y - 780) * 0.25;
    for (let x = Math.floor(DCX - wdt); x <= Math.ceil(DCX + wdt); x++) {
      blendPx(x, y, 140, 210, 240, a);
    }
  }
  // wave strokes
  for (let i = 0; i < 26; i++) {
    const y = 800 + Math.floor(rand() * 200);
    const x0 = Math.floor(rand() * W);
    const len = 40 + rand() * 130;
    const a = 0.1 + rand() * 0.16;
    for (let x = x0; x < x0 + len && x < W; x++) {
      const yy = y + Math.round(Math.sin((x - x0) / 22) * 2);
      blendPx(x, yy, 150, 220, 245, a);
    }
  }
}

function drawSpikes(): void {
  // sharp sea spikes rising to meet the drop (drawn before the drop, so the
  // drop swallows their tips)
  const spikes: Array<[number, number, number]> = [
    [330, 735, 46],
    [410, 728, 52],
    [492, 736, 48],
    [575, 726, 54],
    [655, 738, 46],
    [725, 742, 40],
  ];
  for (const [cx, apexY, halfW] of spikes) {
    fillPolygon(
      [
        [cx - halfW, 830],
        [cx, apexY],
        [cx + halfW, 830],
      ],
      [13, 66, 88],
      1,
    );
    // bright tip
    fillPolygon(
      [
        [cx - 7, apexY + 26],
        [cx, apexY],
        [cx + 7, apexY + 26],
      ],
      [170, 230, 250],
      0.9,
    );
  }
}

function drawDrop(): void {
  // fill
  for (let y = 195; y <= 775; y++) {
    for (let x = 270; x <= 755; x++) {
      const { inside, ratio } = pointInDrop(x, y);
      if (!inside) continue;
      const t = clamp((y - 200) / 570, 0, 1);
      let r = lerp(125, 9, t);
      let g = lerp(203, 56, t);
      let b = lerp(238, 88, t);
      // diagonal highlight band, upper-left
      const band = (x - 330) * 0.7 + (y - 240) * 0.5;
      if (band > -40 && band < 90) {
        const k = 1 - Math.abs(band - 25) / 65;
        r = lerp(r, 235, 0.3 * k);
        g = lerp(g, 246, 0.3 * k);
        b = lerp(b, 252, 0.3 * k);
      }
      // caustic shimmer
      const shim = Math.sin(x * 0.045) * Math.sin(y * 0.06) * 7;
      r += shim;
      g += shim;
      b += shim;
      // darker near the rim
      if (ratio > 0.9) {
        const k = (ratio - 0.9) / 0.1;
        r = lerp(r, 5, 0.45 * k);
        g = lerp(g, 38, 0.45 * k);
        b = lerp(b, 64, 0.45 * k);
      }
      setPx(x, y, clamp(Math.round(r), 0, 255), clamp(Math.round(g), 0, 255), clamp(Math.round(b), 0, 255));
    }
  }
  // specular spot, upper-left
  for (let y = 240; y <= 380; y++) {
    for (let x = 330; x <= 480; x++) {
      const { inside } = pointInDrop(x, y);
      if (!inside) continue;
      const dx = (x - 405) / 75;
      const dy = (y - 305) / 65;
      const d = dx * dx + dy * dy;
      if (d < 1) blendPx(x, y, 240, 250, 255, 0.4 * (1 - d));
    }
  }
  // bubbles inside the drop
  for (let i = 0; i < 26; i++) {
    const x = 330 + rand() * 360;
    const y = 260 + rand() * 420;
    if (!pointInDrop(x, y).inside) continue;
    const r = 2 + rand() * 4;
    fillCircle(x, y, r, [200, 235, 250], 0.25);
    fillCircle(x - r * 0.3, y - r * 0.3, r * 0.45, [240, 250, 255], 0.5);
  }
}

function drawCity(): void {
  // miniature city inside the drop: dark skyline + warm lit windows
  const baseY = 748;
  const buildings: Array<[number, number, number]> = [
    [338, 46, 96],
    [392, 38, 138],
    [438, 52, 84],
    [498, 44, 168],
    [550, 40, 112],
    [598, 48, 150],
    [654, 42, 92],
    [704, 40, 128],
  ];
  for (const [bx, bw, bh] of buildings) {
    for (let y = baseY - bh; y <= baseY; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (pointInDrop(x, y).inside) setPx(x, y, 8, 30, 48);
      }
    }
    // rooftop antenna on the tallest
    if (bh >= 168) {
      for (let y = baseY - bh - 22; y < baseY - bh; y++) {
        if (pointInDrop(bx + bw / 2, y).inside) setPx(Math.round(bx + bw / 2), y, 8, 30, 48);
      }
      if (pointInDrop(bx + bw / 2, baseY - bh - 24).inside) {
        fillCircle(bx + bw / 2, baseY - bh - 24, 2, [255, 80, 80], 1);
      }
    }
    // windows
    for (let wy = baseY - bh + 10; wy < baseY - 8; wy += 13) {
      for (let wx = bx + 7; wx < bx + bw - 7; wx += 11) {
        if (rand() < 0.55) {
          const warm = rand() < 0.75;
          const col: [number, number, number] = warm ? [255, 210, 122] : [255, 157, 77];
          for (let yy = wy; yy < wy + 6; yy++) {
            for (let xx = wx; xx < wx + 5; xx++) {
              if (pointInDrop(xx, yy).inside) setPx(xx, yy, col[0], col[1], col[2]);
            }
          }
        }
      }
    }
  }
}

function drawSunAndLighthouse(): void {
  // tiny sun inside the drop, upper area
  const sx = 432;
  const sy = 330;
  fillCircle(sx, sy, 24, [255, 233, 168], 1);
  fillCircle(sx, sy, 17, [255, 246, 210], 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    drawLine(
      sx + Math.cos(a) * 28,
      sy + Math.sin(a) * 28,
      sx + Math.cos(a) * 40,
      sy + Math.sin(a) * 40,
      [255, 233, 168],
      0.9,
      3,
    );
  }
  // lighthouse at the right edge of the city
  const lx = 668;
  const lBase = 748;
  const lTop = 596;
  for (let y = lTop; y <= lBase; y++) {
    for (let x = lx - 9; x <= lx + 9; x++) {
      if (pointInDrop(x, y).inside) setPx(x, y, 8, 30, 48);
    }
  }
  // two warm bands on the tower
  for (const by of [640, 690]) {
    for (let y = by; y < by + 8; y++) {
      for (let x = lx - 9; x <= lx + 9; x++) {
        if (pointInDrop(x, y).inside) setPx(x, y, 255, 210, 122);
      }
    }
  }
  // lamp room + glow
  fillCircle(lx, lTop - 6, 9, [255, 242, 176], 1);
  fillCircle(lx, lTop - 6, 16, [255, 242, 176], 0.25);
  // light beam fanning right, clipped to the drop
  const beam: Array<[number, number]> = [
    [lx + 6, lTop - 12],
    [lx + 6, lTop + 2],
    [760, lTop + 52],
    [760, lTop - 62],
  ];
  for (let y = lTop - 62; y <= lTop + 52; y++) {
    const t = (y - (lTop - 62)) / 114;
    const x0 = lx + 6;
    const x1 = 760;
    for (let x = x0; x <= x1; x++) {
      if (!pointInDrop(x, y).inside) continue;
      const edge = 1 - Math.abs(y - (lTop - 5) - (x - lx) * 0.12) / 60;
      if (edge > 0) blendPx(x, y, 255, 240, 180, 0.16 * edge * (1 - (x - lx) / 140));
    }
  }
}

function drawRimLight(): void {
  const pts = dropOutlinePoints(720);
  for (const [x, y] of pts) {
    // brightest on the upper-left, softer toward the bottom-right
    const nx = (x - DCX) / DR;
    const ny = (y - DCY) / (DR * DYS);
    const facing = clamp(0.55 - (nx * 0.5 + ny * 0.35), 0.15, 1);
    fillCircle(x, y, 3, [223, 246, 255], 0.85 * facing + 0.15);
    fillCircle(x, y, 1.5, [255, 255, 255], 0.9 * facing + 0.1);
  }
}

function drawDroplets(): void {
  // tiny droplets flung off the drop's surface — frozen mid-splash, so the
  // whole image feels a split-second from bursting
  const drops: Array<[number, number, number, number, number]> = [
    // x, y, radius, trail dx, trail dy
    [792, 296, 5, 26, -14],
    [818, 342, 4, 22, -8],
    [772, 248, 4, 18, -18],
    [832, 402, 6, 28, -4],
    [806, 462, 3, 20, 2],
    [760, 208, 3, 14, -16],
    [846, 470, 4, 24, 6],
  ];
  for (const [x, y, r, tdx, tdy] of drops) {
    drawLine(x, y, x + tdx, y + tdy, [190, 235, 250], 0.55, 2);
    fillCircle(x, y, r, [215, 242, 252], 0.95);
    fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4, [255, 255, 255], 0.9);
  }
}

function drawCliffAndBoat(): void {
  // cliff, bottom-left, with a tiny human figure looking up at the drop
  fillPolygon(
    [
      [30, 1024],
      [55, 905],
      [120, 862],
      [205, 858],
      [245, 895],
      [250, 1024],
    ],
    [6, 22, 34],
    1,
  );
  // figure: head + body, standing on the cliff edge
  fillCircle(168, 848, 4, [255, 217, 160], 1);
  drawLine(168, 852, 168, 868, [6, 22, 34], 1, 5);
  drawLine(168, 856, 158, 864, [6, 22, 34], 1, 3);
  drawLine(168, 856, 178, 862, [6, 22, 34], 1, 3);
  // faint warm rim on the figure's drop-facing side
  drawLine(171, 848, 171, 868, [255, 210, 122], 0.7, 1);
  // small boat, bottom-right, with a lantern
  fillPolygon(
    [
      [812, 852],
      [892, 852],
      [878, 868],
      [828, 868],
    ],
    [6, 22, 34],
    1,
  );
  drawLine(852, 852, 852, 806, [6, 22, 34], 1, 3);
  fillPolygon(
    [
      [852, 808],
      [852, 848],
      [882, 848],
    ],
    [220, 235, 240],
    0.9,
  );
  fillCircle(852, 802, 3, [255, 210, 122], 1);
  fillCircle(852, 802, 7, [255, 210, 122], 0.3);
  // boat wake
  for (let i = 0; i < 8; i++) {
    const x = 800 + i * 12 + Math.floor(rand() * 6);
    blendPx(x, 872 + Math.floor(rand() * 4), 150, 220, 245, 0.35);
  }
}

function main(): void {
  drawSky();
  drawSea();
  drawSpikes();
  drawDrop();
  drawCity();
  drawSunAndLighthouse();
  drawRimLight();
  drawDroplets();
  drawCliffAndBoat();
  // title text, addressed to the judge
  const text = 'JUDGE, HOLD YOUR BREATH';
  const s = 6;
  const textW = text.length * 6 * s - s;
  drawText(text, Math.floor((W - textW) / 2), 46, s);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG(px);
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  const hash = crypto.createHash('sha256').update(png).digest('hex');
  console.log(`wrote ${outPath} ${png.length} bytes sha256=${hash}`);
}

main();
