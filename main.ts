// ai-excited-01 — ROUND 5: THE CITY THAT BURSTS OUT OF THE DROP
// A giant water drop shatters mid-air above the sea and the miniature city
// inside it explodes outward: skyscrapers bursting through the breaking
// surface, water shards and spray flying, warm lit windows scattering,
// a lighthouse tumbling out with its beam sweeping, a tiny sun breaking free.
// Node 22, standard library only. Deterministic: fixed seed, no time, no I/O
// beyond writing entry.png. Own PNG encoder (zlib deflate + CRC32).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024, H = 1024;
const OUT = process.env.MAKEFUN_OUTPUT_DIR || "out";

// ---------- deterministic PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x9e3779b9);

// ---------- canvas ----------
const px = new Uint8ClampedArray(W * H * 4);
function setPx(x, y, r, g, b, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  if (a >= 255) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; return; }
  const ia = a / 255, oa = 1 - ia;
  px[i] = r * ia + px[i] * oa;
  px[i + 1] = g * ia + px[i + 1] * oa;
  px[i + 2] = b * ia + px[i + 2] * oa;
  px[i + 3] = 255;
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

function hline(x0, x1, y, r, g, b, a = 255) {
  if (y < 0 || y >= H) return;
  x0 = Math.max(0, x0 | 0); x1 = Math.min(W - 1, x1 | 0);
  for (let x = x0; x <= x1; x++) setPx(x, y, r, g, b, a);
}
function vline(x, y0, y1, r, g, b, a = 255) {
  if (x < 0 || x >= W) return;
  y0 = Math.max(0, y0 | 0); y1 = Math.min(H - 1, y1 | 0);
  for (let y = y0; y <= y1; y++) setPx(x, y, r, g, b, a);
}
function line(x0, y0, x1, y1, r, g, b, a = 255, w = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = x0 + dx * t, y = y0 + dy * t;
    if (w <= 1) setPx(Math.round(x), Math.round(y), r, g, b, a);
    else for (let ox = -((w / 2) | 0); ox <= (w / 2) | 0; ox++)
      for (let oy = -((w / 2) | 0); oy <= (w / 2) | 0; oy++)
        setPx(Math.round(x) + ox, Math.round(y) + oy, r, g, b, a);
  }
}
// scanline polygon fill; pts = [[x,y],...]
function poly(pts, r, g, b, a = 255) {
  let minY = H, maxY = 0;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) hline(Math.ceil(xs[k]), Math.floor(xs[k + 1]), y, r, g, b, a);
  }
}
function disc(cx, cy, rad, r, g, b, a = 255) {
  const rr = rad * rad;
  for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(H - 1, Math.ceil(cy + rad)); y++)
    for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(W - 1, Math.ceil(cx + rad)); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= rr) setPx(x, y, r, g, b, a);
    }
}
function ellipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++)
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, Math.ceil(cx + rx)); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(x, y, r, g, b, a);
    }
}
// rotated rectangle (filled quad), angle in radians
function rrect(cx, cy, w, h, ang, r, g, b, a = 255) {
  const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hh = h / 2;
  const corner = (ox, oy) => [cx + ox * c - oy * s, cy + ox * s + oy * c];
  poly([corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)], r, g, b, a);
}
// soft radial glow: additive-ish layered discs
function glow(cx, cy, rad, r, g, b, peak) {
  for (let k = 6; k >= 1; k--) {
    const t = k / 6;
    disc(cx, cy, rad * t, r, g, b, Math.round(peak * (1 - t) * 0.55));
  }
}

// ---------- 5x7 bitmap font (rows as 5-bit numbers) ----------
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e], E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  J: [0x07, 0x04, 0x04, 0x04, 0x04, 0x14, 0x0c], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04], U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c], " ": [0, 0, 0, 0, 0, 0, 0],
};
function drawText(str, x0, y0, sc, r, g, b, a = 255) {
  let x = x0;
  for (const ch of str) {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        if (glyph[row] & (1 << (4 - col)))
          for (let dy = 0; dy < sc; dy++)
            for (let dx = 0; dx < sc; dx++)
              setPx(x + col * sc + dx, y0 + row * sc + dy, r, g, b, a);
    x += 6 * sc;
  }
  return x;
}
function textWidth(str, sc) { return str.length * 6 * sc - sc; }

// ---------- palette ----------
const SKY_TOP = [8, 14, 46], SKY_MID = [14, 42, 84], SKY_LOW = [16, 74, 104];
const DROP_DEEP = [10, 52, 96], DROP_MID = [24, 110, 150], DROP_LITE = [120, 210, 235];
const RIM = [205, 245, 255];
const WARM = [255, 196, 110], WARM2 = [255, 150, 70], GOLD = [255, 220, 140];
const SEA_DEEP = [6, 30, 58], SEA_MID = [12, 62, 96];
const FOAM = [220, 245, 250];

// ================= SKY =================
for (let y = 0; y < H; y++) {
  const t = y / H;
  const c = t < 0.45 ? mix(SKY_TOP, SKY_MID, t / 0.45) : mix(SKY_MID, SKY_LOW, (t - 0.45) / 0.55);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
}
// stars (upper sky, avoid text band y<110 mostly)
for (let i = 0; i < 260; i++) {
  const x = rnd() * W, y = 120 + rnd() * 420, s = rnd();
  const b = 140 + rnd() * 115;
  if (s < 0.12) { line(x - 3, y, x + 3, y, b, b, 230, 200); line(x, y - 3, x, y + 3, b, b, 230, 200); }
  else setPx(x, y, b, b, 230, 220);
}
// moon glow top-left + crescent moon
glow(150, 150, 90, 190, 210, 235, 90);
disc(150, 150, 34, 232, 238, 245);
disc(162, 142, 30, 16, 40, 76);
// soft clouds, low alpha teal
for (let i = 0; i < 26; i++) {
  const x = rnd() * W, y = 130 + rnd() * 380, rx = 40 + rnd() * 110, ry = 8 + rnd() * 16;
  ellipse(x, y, rx, ry, 30, 70, 110, 26);
}
// rain streaks (faint diagonal texture in sky)
for (let i = 0; i < 240; i++) {
  const x = rnd() * W, y = 120 + rnd() * 480, l = 8 + rnd() * 18;
  line(x, y, x - l * 0.25, y + l, 150, 200, 220, 26);
}

// ================= SEA (horizon ~y 780, drawn before drop so drop overlaps) =================
const HORIZON = 786;
for (let y = HORIZON; y < H; y++) {
  const t = (y - HORIZON) / (H - HORIZON);
  const c = mix(SEA_MID, SEA_DEEP, t);
  for (let x = 0; x < W; x++) {
    const wob = Math.sin(x * 0.021 + y * 0.11) * 4 + Math.sin(x * 0.047 - y * 0.05) * 3;
    const i = (y * W + x) * 4;
    px[i] = clamp(c[0] + wob, 0, 255); px[i + 1] = clamp(c[1] + wob * 1.2, 0, 255); px[i + 2] = clamp(c[2] + wob * 1.4, 0, 255);
  }
}
// distant wave bands
for (let b = 0; b < 9; b++) {
  const y = HORIZON + 14 + b * 26;
  for (let x = 0; x < W; x += 3) {
    const h = Math.sin(x * 0.03 + b * 2.1) * 3 + Math.sin(x * 0.011 + b) * 5;
    line(x, y + h, x + 14, y + h, 90, 160, 190, 60 - b * 4, 2);
  }
}
// ================= THE GIANT DROP =================
const DCX = 512, DCY = 448, DR = 318;
// teardrop half-width profile: pointed at top, full at bottom
function dropHalfW(y) {
  const dy = (y - DCY) / DR;
  if (dy < -1 || dy > 1) return 0;
  const base = DR * Math.sqrt(Math.max(0, 1 - dy * dy));
  const taper = 0.52 + 0.48 * ((dy + 1) / 2); // narrow at top
  return base * taper;
}
// fill drop with radial/vertical gradient + internal caustics
for (let y = DCY - DR; y <= DCY + DR; y++) {
  const hw = dropHalfW(y);
  if (hw <= 0) continue;
  for (let x = Math.ceil(DCX - hw); x <= Math.floor(DCX + hw); x++) {
    const dx = (x - DCX) / hw, dy = (y - DCY) / DR;
    const dist = Math.sqrt(dx * dx + dy * dy * 0.8);
    let c = mix(DROP_MID, DROP_DEEP, clamp(dist * 1.1, 0, 1));
    // bright upper-left light + lower glow
    const li = Math.max(0, 1 - Math.hypot((x - (DCX - 110)) / 190, (y - (DCY - 130)) / 200));
    c = mix(c, DROP_LITE, li * 0.55);
    const lo = Math.max(0, 1 - Math.hypot((x - DCX) / 260, (y - (DCY + 200)) / 130));
    c = mix(c, [40, 140, 170], lo * 0.35);
    // caustic streaks
    const ca = Math.sin(x * 0.045 + y * 0.03 + Math.sin(y * 0.02) * 2) * 0.5 + 0.5;
    if (ca > 0.82) c = mix(c, [170, 230, 245], (ca - 0.82) * 2.2);
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
}
// drop rim light: bright edge on the left/top, dark edge on right/bottom
for (let y = DCY - DR; y <= DCY + DR; y++) {
  const hw = dropHalfW(y);
  if (hw <= 0) continue;
  const xl = DCX - hw, xr = DCX + hw;
  for (let k = 0; k < 5; k++) {
    setPx(xl + k, y, 200, 240, 255, 200 - k * 32);
    setPx(xr - k, y, 8, 40, 70, 150 - k * 24);
  }
}
// bold glowing outline tracing the whole teardrop profile, so the drop reads
for (let y = DCY - DR; y <= DCY + DR; y++) {
  const hw = dropHalfW(y);
  if (hw <= 0) continue;
  for (const sx of [DCX - hw, DCX + hw]) {
    for (let k = -3; k <= 3; k++) setPx(sx + k, y, 150, 225, 250, k === 0 ? 235 : 110);
  }
}
// pointed tip highlight above the drop crown
for (let k = 0; k < 26; k++) {
  const ty = DCY - DR - 4 + k;
  const tw = 3 + k * 0.9;
  line(DCX - tw, ty, DCX + tw, ty, 190, 240, 255, 200 - k * 5, 2);
}
// highlight streaks on the drop surface (specular arcs)
for (let k = 0; k < 3; k++) {
  const a0 = -2.4 + k * 0.35, a1 = -1.2 + k * 0.3;
  for (let a = a0; a < a1; a += 0.02) {
    const r = DR * (0.62 + k * 0.1);
    line(DCX + Math.cos(a) * r, DCY + Math.sin(a) * r * 0.94,
         DCX + Math.cos(a + 0.02) * r, DCY + Math.sin(a + 0.02) * r * 0.94,
         210, 245, 255, 120, 3);
  }
}

// ================= CITY BURSTING OUT =================
// buildings: [baseX, baseY, w, h, tilt(rad), bodyColor]
const BUILDINGS = [
  [300, 560, 74, 300, -0.34, [16, 26, 52]], [392, 600, 60, 250, -0.16, [20, 30, 58]],
  [470, 620, 84, 330, 0.05, [14, 24, 48]], [560, 610, 66, 290, 0.18, [18, 28, 56]],
  [648, 570, 58, 240, 0.32, [15, 25, 50]], [716, 520, 52, 200, 0.45, [20, 32, 60]],
  [252, 480, 46, 170, -0.5, [22, 34, 62]], [790, 470, 44, 150, 0.58, [16, 28, 54]],
  [352, 700, 52, 170, -0.1, [24, 36, 64]], [610, 690, 56, 180, 0.12, [13, 22, 46]],
  [430, 470, 40, 150, -0.05, [18, 30, 58]], [520, 460, 44, 160, 0.1, [21, 32, 60]],
  [180, 560, 40, 130, -0.62, [17, 28, 52]], [850, 560, 38, 120, 0.66, [19, 30, 56]],
];
function drawBuilding(bx, by, w, h, tilt, body) {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const top = [bx + Math.sin(tilt) * -h * 0.5, by - Math.cos(tilt) * h];
  // body quad: base corners at (bx±w/2, by), top at rotated offset
  const p = (ox, oy) => [bx + ox * c - oy * s, by + ox * s + oy * c];
  poly([p(-w / 2, 0), p(w / 2, 0), p(w / 2, -h), p(-w / 2, -h)], body[0], body[1], body[2]);
  // roof edge highlight
  line(p(-w / 2, -h)[0], p(-w / 2, -h)[1], p(w / 2, -h)[0], p(w / 2, -h)[1], 190, 220, 240, 170, 2);
  // lit windows: grid in local coords
  const cols = Math.max(3, Math.floor(w / 11)), rows = Math.max(6, Math.floor(h / 15));
  for (let rI = 0; rI < rows; rI++) {
    for (let cI = 0; cI < cols; cI++) {
      if (rnd() < 0.28) continue; // some dark windows
      const lx = -w / 2 + 6 + cI * ((w - 12) / cols);
      const ly = -h + 10 + rI * ((h - 18) / rows);
      const [wx, wy] = p(lx + 2.5, ly + 3);
      const warm = rnd();
      const wc = warm < 0.6 ? WARM : warm < 0.85 ? GOLD : [150, 220, 255];
      rrect(wx, wy, 5, 6, tilt, wc[0], wc[1], wc[2], 235);
    }
  }
  // antenna / spire on some
  if (rnd() < 0.5) {
    const [tx, ty] = p(0, -h);
    line(tx, ty, tx + Math.sin(tilt) * -26, ty - Math.cos(tilt) * 26, 200, 220, 235, 200, 2);
    disc(tx + Math.sin(tilt) * -28, ty - Math.cos(tilt) * 28, 2.5, 255, 120, 90);
  }
  // splash collar where it breaks the drop surface
  const splashY = by + 6;
  for (let k = 0; k < 14; k++) {
    const sx = bx + (rnd() - 0.5) * (w + 34);
    const sy = splashY + (rnd() - 0.5) * 10;
    disc(sx, sy, 2 + rnd() * 4, 220, 245, 250, 150);
  }
}
for (const b of BUILDINGS) drawBuilding(...b);

// tiny sun breaking free at top-right of the drop
glow(812, 168, 74, 255, 200, 90, 120);
disc(812, 168, 30, 255, 214, 120);
disc(812, 168, 20, 255, 238, 170);
for (let k = 0; k < 12; k++) {
  const a = (k / 12) * Math.PI * 2 + 0.26;
  line(812 + Math.cos(a) * 36, 168 + Math.sin(a) * 36, 812 + Math.cos(a) * (56 + rnd() * 14), 168 + Math.sin(a) * (56 + rnd() * 14), 255, 210, 110, 200, 3);
}

// tumbling lighthouse, upper right, beam sweeping
const LH = { x: 742, y: 330, tilt: 0.62 };
rrect(LH.x, LH.y, 26, 96, LH.tilt, 235, 235, 225);
rrect(LH.x - 6, LH.y - 20, 14, 40, LH.tilt, 200, 60, 50);
disc(LH.x - Math.sin(LH.tilt) * 52, LH.y - Math.cos(LH.tilt) * 52, 7, 255, 230, 140);
const beamA = -0.55, beamLen = 150;
const lampX = LH.x - Math.sin(LH.tilt) * 52, lampY = LH.y - Math.cos(LH.tilt) * 52;
// narrow warm beam sweeping up-left from the lamp
poly([[lampX, lampY],
      [lampX + Math.cos(beamA) * beamLen, lampY + Math.sin(beamA) * beamLen + 18],
      [lampX + Math.cos(beamA) * beamLen, lampY + Math.sin(beamA) * beamLen - 18]], 255, 225, 130, 55);
poly([[lampX, lampY],
      [lampX - Math.cos(beamA + 0.7) * 110, lampY - Math.sin(beamA + 0.7) * 110 + 14],
      [lampX - Math.cos(beamA + 0.7) * 110, lampY - Math.sin(beamA + 0.7) * 110 - 14]], 255, 225, 130, 30);

// ================= FRACTURE CRACKS across the drop =================
// short jagged cracks radiating from the burst core, stopping mid-drop
for (let k = 0; k < 10; k++) {
  const a = (k / 10) * Math.PI * 2 + rnd() * 0.5;
  let x = DCX + Math.cos(a) * 46, y = DCY + Math.sin(a) * 40;
  const steps = 3 + ((rnd() * 2) | 0);
  for (let s = 0; s < steps; s++) {
    const len = 30 + rnd() * 30;
    const na = a + (rnd() - 0.5) * 0.9;
    const nx = x + Math.cos(na) * len, ny = y + Math.sin(na) * len;
    line(x, y, nx, ny, 6, 26, 52, 200, 5);
    line(x, y, nx, ny, 235, 250, 255, 235, 3);
    x = nx; y = ny;
  }
}

// ================= WATER SHARDS flying outward =================
for (let k = 0; k < 46; k++) {
  const a = rnd() * Math.PI * 2;
  const d = DR * (0.95 + rnd() * 0.55);
  const cx = DCX + Math.cos(a) * d, cy = DCY + Math.sin(a) * d * 0.92;
  const sz = 14 + rnd() * 46;
  const rot = rnd() * Math.PI;
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [];
  const n = 3 + ((rnd() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const aa = (i / n) * Math.PI * 2;
    const rr = sz * (0.5 + rnd() * 0.7);
    pts.push([cx + Math.cos(aa) * rr * c - Math.sin(aa) * rr * 0.45 * s,
              cy + Math.cos(aa) * rr * s + Math.sin(aa) * rr * 0.45 * c]);
  }
  const shade = 0.7 + rnd() * 0.5;
  poly(pts, Math.round(60 * shade), Math.round(140 * shade), Math.round(180 * shade), 235);
  // bright rim on one edge
  line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 215, 245, 255, 230, 2);
  line(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 215, 245, 255, 160, 2);
}

// ================= SPRAY — thousands of droplets radiating out =================
for (let k = 0; k < 2600; k++) {
  const a = rnd() * Math.PI * 2;
  const d = DR * (0.55 + Math.pow(rnd(), 1.6) * 0.85);
  const x = DCX + Math.cos(a) * d, y = DCY + Math.sin(a) * d * 0.9;
  const len = 3 + rnd() * 12;
  const bright = rnd();
  const col = bright < 0.7 ? [225, 246, 252] : bright < 0.9 ? [150, 215, 240] : [255, 225, 160];
  line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, col[0], col[1], col[2], 150 + rnd() * 100, bright < 0.15 ? 2 : 1);
}
// droplet dots near the burst
for (let k = 0; k < 700; k++) {
  const a = rnd() * Math.PI * 2;
  const d = DR * (0.8 + rnd() * 0.6);
  const x = DCX + Math.cos(a) * d, y = DCY + Math.sin(a) * d * 0.9;
  disc(x, y, 1 + rnd() * 2.4, 220, 244, 252, 200);
}

// ================= SEA ERUPTS =================
// big spikes of water around the drop's base: thin, curved, translucent,
// leaning at random angles with foam tips — erupting water, not mountains
for (let k = 0; k < 20; k++) {
  const bx = 120 + rnd() * 784;
  const hgt = 50 + rnd() * 170 * (1 - Math.abs(bx - 512) / 800);
  const lean = (rnd() - 0.5) * 90;
  const bw = 8 + rnd() * 14;
  const yb = HORIZON + 4 + rnd() * 30;
  const tx = bx + lean, ty = yb - hgt;
  poly([[bx - bw, yb], [bx + bw, yb], [tx + 4, ty], [tx - 4, ty]],
       60 + rnd() * 40, 150 + rnd() * 40, 190 + rnd() * 30, 205);
  // bright leading edge + foam tip + spray
  line(bx - bw, yb, tx, ty, 225, 246, 252, 200, 2);
  disc(tx, ty, 4 + rnd() * 6, 235, 248, 252, 230);
  for (let s = 0; s < 6; s++) disc(tx + (rnd() - 0.5) * 30, ty + (rnd() - 0.5) * 20, 1 + rnd() * 2.5, 230, 246, 252, 200);
}
// foam + spray at the waterline
for (let k = 0; k < 700; k++) {
  const x = rnd() * W, y = HORIZON + rnd() * 120;
  disc(x, y, 1 + rnd() * 3, 225, 245, 250, 120 + rnd() * 110);
}
// warm window-light reflections on the sea
for (let k = 0; k < 120; k++) {
  const x = 300 + rnd() * 440, y = HORIZON + 10 + rnd() * 190;
  const len = 10 + rnd() * 44;
  const warm = rnd() < 0.75;
  line(x, y, x + (rnd() - 0.5) * 8, y + len, warm ? 255 : 200, warm ? 190 : 225, warm ? 110 : 240, 90, 2);
}

// ================= CLIFF + HUMANS + BOAT =================
// cliff bottom-left
poly([[0, 1024], [0, 930], [70, 900], [150, 916], [210, 880], [260, 900], [300, 960], [280, 1024]],
     12, 20, 34);
poly([[0, 1024], [0, 960], [90, 940], [180, 952], [240, 990], [220, 1024]], 20, 32, 50);
// rock highlights
for (let k = 0; k < 40; k++) {
  const x = rnd() * 260, y = 900 + rnd() * 110;
  line(x, y, x + 8 + rnd() * 18, y + (rnd() - 0.5) * 6, 60, 90, 120, 90, 2);
}
// tiny human 1: shielding face (on cliff)
const HX1 = 150, HY1 = 884;
rrect(HX1, HY1, 7, 16, 0.08, 235, 90, 70);            // body (red jacket)
disc(HX1 + 1, HY1 - 12, 5, 232, 200, 170);            // head
line(HX1 + 2, HY1 - 8, HX1 + 12, HY1 - 18, 232, 200, 170, 255, 3); // arm shielding face
line(HX1 - 2, HY1 + 8, HX1 - 4, HY1 + 22, 40, 50, 70, 255, 3);     // legs
line(HX1 + 3, HY1 + 8, HX1 + 6, HY1 + 22, 40, 50, 70, 255, 3);
// tiny human 2: pointing up in shock
const HX2 = 205, HY2 = 872;
rrect(HX2, HY2, 7, 16, -0.06, 255, 210, 90);           // body (yellow jacket)
disc(HX2, HY2 - 12, 5, 232, 200, 170);
line(HX2 + 1, HY2 - 8, HX2 + 14, HY2 - 30, 232, 200, 170, 255, 3); // pointing arm
line(HX2 - 3, HY2 + 8, HX2 - 6, HY2 + 22, 40, 50, 70, 255, 3);
line(HX2 + 3, HY2 + 8, HX2 + 7, HY2 + 22, 40, 50, 70, 255, 3);
// shock lines above human 2
line(HX2 + 18, HY2 - 38, HX2 + 24, HY2 - 46, 255, 240, 150, 220, 2);
line(HX2 + 10, HY2 - 40, HX2 + 12, HY2 - 50, 255, 240, 150, 220, 2);
// small boat tossed by a wave, bottom-right
const BX = 830, BY = 920;
poly([[BX - 46, BY], [BX + 46, BY], [BX + 30, BY + 18], [BX - 30, BY + 18]], 120, 60, 30);
line(BX + 4, BY, BX + 4, BY - 52, 90, 60, 40, 255, 3);
poly([[BX + 4, BY - 52], [BX + 4, BY - 12], [BX + 34, BY - 12]], 240, 240, 230, 240);
disc(BX - 20, BY - 6, 4, 232, 200, 170);
line(BX - 46, BY + 22, BX - 70, BY + 8, 220, 244, 250, 200, 3);
line(BX + 46, BY + 22, BX + 72, BY + 6, 220, 244, 250, 200, 3);

// ================= TITLE TEXT =================
const TITLE = "JUDGE, HOLD YOUR BREATH.";
const SC = 7;
const tw = textWidth(TITLE, SC);
const tx = Math.round((W - tw) / 2), ty = 30;
// dark outline pass
for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]])
  drawText(TITLE, tx + ox, ty + oy, SC, 6, 18, 42, 255);
// glow pass
drawText(TITLE, tx, ty, SC, 90, 160, 200, 90);
// face pass
drawText(TITLE, tx, ty, SC, 255, 246, 225, 255);

// ================= FINE GRAIN (texture, no flat fills) =================
for (let i = 0; i < W * H; i++) {
  const n = ((rnd() - 0.5) * 3) | 0;
  if (n === 0) continue;
  const j = i * 4;
  px[j] = clamp(px[j] + n, 0, 255);
  px[j + 1] = clamp(px[j + 1] + n, 0, 255);
  px[j + 2] = clamp(px[j + 2] + n, 0, 255);
}

// ================= PNG ENCODER =================
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // per-row adaptive filter: pick 0 (None), 1 (Sub) or 2 (Up) by smallest
  // sum of absolute signed-byte values — keeps dense/noisy art under 1 MiB
  const raw = Buffer.alloc(H * (1 + W * 4));
  const prev = Buffer.alloc(W * 4);
  const cur = Buffer.alloc(W * 4);
  for (let y = 0; y < H; y++) {
    Buffer.from(px.buffer, y * W * 4, W * 4).copy(cur);
    const cands = [Buffer.alloc(W * 4), Buffer.alloc(W * 4), Buffer.alloc(W * 4)];
    for (let i = 0; i < W * 4; i++) {
      cands[0][i] = cur[i];
      const left = i >= 4 ? cur[i - 4] : 0;
      cands[1][i] = (cur[i] - left) & 0xff;
      cands[2][i] = (cur[i] - prev[i]) & 0xff;
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 3; f++) {
      let score = 0;
      for (let i = 0; i < W * 4; i++) { const v = cands[f][i]; score += v < 128 ? v : 256 - v; }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    const off = y * (1 + W * 4);
    raw[off] = best;
    cands[best].copy(raw, off + 1);
    cur.copy(prev);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/entry.png`, encodePNG());
console.log(`wrote ${OUT}/entry.png`);
