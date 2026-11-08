// Generates every SVG the profile README uses, into ../assets/profile:
//
//   hero.svg              a coding-agent terminal: the name decodes out of noise and keeps turning,
//                         then a welcome panel draws itself with an ASCII ouroboros inside
//   site.svg              rithvik.ai arriving as a tool call, in square-pixel block letters
//   contact-*.svg         the /contact selection menu, one image per row so each can be a link
//
// Everything animates with CSS keyframes on opacity, transform and stroke-dashoffset, which
// GitHub keeps when it shows an SVG as an <img>. Geist Mono is embedded (subset to the glyphs
// each file uses) because GitHub blocks external fonts. Glyphs Geist Mono lacks are drawn as paths.
//
//   cd scripts && npm install && node make_profile.mjs
//
// The words live in the constants below. Change them and run it again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import subsetFont from 'subset-font';

/* ================================================================== content */

const HERO = {
  title: '~/rithvikpkx',
  prompt: '~/rithvikpkx $',
  command: 'rithvik --hello',
  label: 'rithvikpkx',
  name: 'Rithvik Praveen Kumar',
  place: 'Greater Boston, MA',
  // Right column of the welcome panel, top to bottom. { rule } is a divider, { gap } a small space.
  right: [
    { h: 'About' },
    { p: 'CS + Math @ Purdue.' },
    { p: 'Builds intelligent software for an intelligent world.' },
    { rule: true },
    { h: 'Stack' },
    { p: 'Python · TypeScript · Java · C++ · React · AWS' },
    { gap: true },
    { h: 'Into' },
    { p: 'AI systems · applied ML · brain-computer interfaces' },
  ],
  suggestion: 'Try "open rithvik.ai"',
  hintLeft: '? for shortcuts',
  hintRight: '42.36°N 71.06°W',
};

const SITE = {
  tool: 'Fetch',
  url: 'https://rithvik.ai',
  result: "200 OK · projects, experience and what I'm building now",
  blocks: 'rithvik.ai',
  enter: 'open',
};

const CONTACT = {
  head: '/contact',
  hint: 'where to reach me · ↑↓ to move · enter to open',
  rows: [
    { file: 'contact-website.svg', label: '1. Website', value: 'rithvik.ai', on: true },
    { file: 'contact-linkedin.svg', label: '2. LinkedIn', value: 'in/rithvik-praveen-kumar' },
    { file: 'contact-email.svg', label: '3. Email', value: 'rithvikpkx@gmail.com' },
  ],
};

// Motion knobs.
const WM_FPS = 7;            // the name turns at 7 frames a second
const DECODE_AT = 1.05;      // seconds after load when the name starts resolving out of noise
const DECODE_DUR = 1.15;     // how long it takes
const DECODE_FRAMES = 12;    // precomputed noise frames, played once
const OURO_FRAMES = 96;      // ouroboros frames per revolution (12 fps at 8 s a turn, as in the mockup)
const OURO_TURN = 8;         // seconds per revolution
const GLINT_CYCLE = 4.6;     // the amber glint crosses rithvik.ai every 4.6 s
const GLINT_SWEEP = 2.6;     // and takes 2.6 s to do it

/* ================================================================== setup */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'assets', 'profile');
const DATA = path.join(HERE, 'data');
fs.mkdirSync(OUT, { recursive: true });

const fontFile = (pkg, file) => fs.readFileSync(path.join(HERE, 'node_modules', '@fontsource', pkg, 'files', file));
const parse = (b) => opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const MONO_FILES = { 500: fontFile('geist-mono', 'geist-mono-latin-500-normal.woff'), 700: fontFile('geist-mono', 'geist-mono-latin-700-normal.woff') };
const MONO = parse(MONO_FILES[500]);
const SANS_800 = parse(fontFile('geist-sans', 'geist-sans-latin-800-normal.woff'));

// Geist Mono metrics, so baselines land where the browser put them in the mockup.
const UPM = MONO.unitsPerEm;
const ASC = MONO.tables.hhea.ascender / UPM, DESC = -MONO.tables.hhea.descender / UPM;
const ADV = MONO.charToGlyph('a').advanceWidth / UPM; // 0.6
// Baseline of a line box of height `lh` whose top is at `top`, for text of `size` px.
const base = (top, lh, size) => +(top + (lh - (ASC + DESC) * size) / 2 + ASC * size).toFixed(2);

// Glyphs Geist Mono does not have. They are drawn as shapes instead of text.
const DRAWN = new Set(['✻', '⎿', '❯', '↵', '●', '█']);
for (const ch of '·°↑↓') if (!MONO.charToGlyphIndex(ch)) throw new Error(`Geist Mono lacks ${ch}`);

const C = {
  bg: '#0c0c0c', bar: '#161616', ink: '#ededed', soft: '#a3a3a3', dim: '#686868', line: '#383838',
  acc: '#e8a468', ok: '#5ad08a', edge: '#1e1e1e', box: '#575757', dot: '#3a3a3a',
  d: '#474747', m: '#9b9b9b', h: '#f4f4f4', shade: '#2a2a2a', face: '#ececec', pale: '#f6d2ae',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => String(+v.toFixed(2));

// Deterministic randomness, so regenerating gives the same files.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================== an SVG under construction */

function doc() {
  const used = { 500: new Set(), 700: new Set() };
  const note = (s, w = 500) => { for (const ch of s) if (!DRAWN.has(ch)) used[w].add(ch); };
  // One line of text. `cls` carries colour, size comes inline.
  const text = (x, y, s, { cls = 'soft', size = 13, w = 500, anchor, extra = '' } = {}) => {
    note(s, w);
    return `<text x="${n2(x)}" y="${n2(y)}" class="${cls}${w === 700 ? ' b' : ''}"${size !== 13 ? ` style="font-size:${size}px"` : ''}${anchor ? ` text-anchor="${anchor}"` : ''}${extra}>${esc(s)}</text>`;
  };
  async function fonts() {
    let css = '';
    for (const w of [500, 700]) {
      if (!used[w].size) continue;
      const sub = await subsetFont(MONO_FILES[w], [...used[w]].join(''), { targetFormat: 'woff2' });
      css += `@font-face{font-family:GM;font-weight:${w};src:url(data:font/woff2;base64,${sub.toString('base64')}) format('woff2')}`;
    }
    return css;
  }
  return { text, note, fonts };
}

const BASE_CSS = `text{font-family:GM,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:500;white-space:pre;font-kerning:none;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}
.b{font-weight:700}.ink{fill:${C.ink}}.soft{fill:${C.soft}}.dim{fill:${C.dim}}.acc{fill:${C.acc}}
.d{fill:${C.d}}.m{fill:${C.m}}.h{fill:${C.h}}.k{fill:${C.acc}}`;

// Shared motion. Every element's own style is its resting state; keyframes only describe the intro,
// so turning animation off (reduced motion) leaves the finished terminal.
const MOTION_CSS = `.fx{animation:fx .55s cubic-bezier(.2,.8,.2,1) both}@keyframes fx{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.fxx{animation:fxx .6s cubic-bezier(.65,0,.35,1) both}@keyframes fxx{from{transform:scaleX(0)}to{transform:none}}
.fxy{animation:fxy .6s cubic-bezier(.65,0,.35,1) both}@keyframes fxy{from{transform:scaleY(0)}to{transform:none}}
.hide{animation:hide linear}@keyframes hide{from,to{opacity:0}}
.once{opacity:0;animation:once linear}@keyframes once{from,to{opacity:1}}`;
const REDUCED = `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

function svg({ w, h, label, title, css, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(label)}" xml:space="preserve">
<title>${esc(title)}</title>
<style>${css.replace(/\n/g, '')}</style>
${body}
</svg>`;
}

/* ================================================================== drawn glyphs */

// ✻ teardrop-spoked asterisk, centred in a mono cell whose left edge is x.
function glyphStar(x, baseline, size, fill) {
  const cx = x + (ADV * size) / 2, cy = baseline - size * 0.37, r = size * 0.36;
  const k = r / 4.6; // drawn at r = 4.6, then scaled
  const spoke = `M0.6 0L3.75 0.5A0.78 0.78 0 1 0 3.75 -0.5Z`;
  let d = '';
  for (let i = 0; i < 8; i++) d += `<path d="${spoke}" transform="rotate(${i * 45 - 90})"/>`;
  return `<g fill="${fill}" transform="translate(${n2(cx)} ${n2(cy)}) scale(${n2(k)})">${d}</g>`;
}
// ⎿ the tree corner Claude Code puts under a tool call.
function glyphCorner(x, baseline, size, stroke) {
  const x0 = x + size * 0.58, top = baseline - size * 0.92, bot = baseline + size * 0.02, x1 = x0 + size * 0.55;
  return `<path d="M${n2(x0)} ${n2(top)}V${n2(bot)}H${n2(x1)}" stroke="${stroke}" stroke-width="1.05"/>`;
}
// ❯ selection caret.
function glyphCaret(x, baseline, size, stroke) {
  const a = x + size * 0.2, b = x + size * 0.48, m = baseline - size * 0.37, hh = size * 0.3;
  return `<path d="M${n2(a)} ${n2(m - hh)}L${n2(b)} ${n2(m)}L${n2(a)} ${n2(m + hh)}" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}
// ↵ return.
function glyphReturn(x, baseline, size, stroke) {
  const r = x + size * 0.5, l = x + size * 0.1, y = baseline - size * 0.28, t = baseline - size * 0.72, a = size * 0.17;
  return `<path d="M${n2(r)} ${n2(t)}V${n2(y)}H${n2(l)}M${n2(l + a)} ${n2(y - a)}L${n2(l)} ${n2(y)}L${n2(l + a)} ${n2(y + a)}" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/* ================================================================== ASCII frames */

const RAMP = '.,-~:;=!*#$@';
const rampTone = (ch) => { if (ch === 'O') return 3; const i = RAMP.indexOf(ch); return i < 4 ? 0 : i < 8 ? 1 : 2; };
const wmTone = (ch) => (ch === 'S' || ch === 's' || ch === '*') ? 2 : ch === '+' ? 1 : 0;
const TONES = ['d', 'm', 'h', 'k'];

// One frame as SVG text. Two encodings, the smaller wins:
//  layers  one <text> per tone, each row a tspan holding that tone's characters with spaces between
//  runs    one <text> per row, runs of a tone wrapped in a tspan
// tones[r][c] is the tone index of rows[r][c]. Positions are relative to the frame's group.
function frameText(rows, tones, { adv, lh, b0 }) {
  const R = rows.length;
  const y = (r) => n2(b0 + r * lh);
  let layers = '';
  for (let t = 0; t < TONES.length; t++) {
    let body = '';
    for (let r = 0; r < R; r++) {
      let s = '';
      for (let c = 0; c < rows[r].length; c++) s += rows[r][c] !== ' ' && tones[r][c] === t ? rows[r][c] : ' ';
      const lead = s.length - s.trimStart().length;
      s = s.trim();
      if (s) body += `<tspan x="${n2(lead * adv)}" y="${y(r)}">${esc(s)}</tspan>`;
    }
    if (body) layers += `<text class="${TONES[t]}">${body}</text>`;
  }
  let runs = '';
  for (let r = 0; r < R; r++) {
    const row = rows[r];
    const lead = row.length - row.trimStart().length, s = row.trimEnd();
    if (!s.trim()) continue;
    // The commonest tone in the row goes on the <text>, the rest in tspans.
    const count = [0, 0, 0, 0];
    for (let c = lead; c < s.length; c++) if (s[c] !== ' ') count[tones[r][c]]++;
    const main = count.indexOf(Math.max(...count));
    let out = '', cur = -1, buf = '';
    const flush = () => { if (buf) out += cur === main ? esc(buf) : `<tspan class="${TONES[cur]}">${esc(buf)}</tspan>`; buf = ''; };
    for (let c = lead; c < s.length; c++) {
      const t = s[c] === ' ' ? (cur < 0 ? main : cur) : tones[r][c];
      if (t !== cur) { flush(); cur = t; }
      buf += s[c];
    }
    flush();
    runs += `<text x="${n2(lead * adv)}" y="${y(r)}" class="${TONES[main]}">${out}</text>`;
  }
  return layers.length <= runs.length ? layers : runs;
}

/* ---------------------------------------------------------------- wordmark: decode, then turn */

const WM = JSON.parse(fs.readFileSync(path.join(DATA, 'wordmark.json'), 'utf8'));

function wordmarkDecodeFrames() {
  const R = WM[0].length, Cn = WM[0][0].length, rand = rng(1050);
  const thr = new Float32Array(R * Cn);
  for (let i = 0; i < thr.length; i++) thr[i] = ((i % Cn) / Cn) * 0.68 + rand() * 0.32;
  const NOISE = '!<>-_\\/[]{}=+*^?#%&$@';
  const out = [];
  for (let k = 0; k < DECODE_FRAMES; k++) {
    const p = k / DECODE_FRAMES, rows = [], tones = [];
    for (let r = 0; r < R; r++) {
      let s = ''; const tr = [];
      for (let c = 0; c < Cn; c++) {
        const ch = WM[0][r][c], i = r * Cn + c;
        if (ch === ' ') { s += ' '; tr.push(0); continue; }
        if (p >= thr[i]) { s += ch; tr.push(wmTone(ch)); }
        else if (p > thr[i] - 0.4) { s += NOISE[(rand() * NOISE.length) | 0]; tr.push(rand() < 0.22 ? 2 : 0); }
        else { s += ' '; tr.push(0); }
      }
      rows.push(s); tones.push(tr);
    }
    out.push({ rows, tones });
  }
  return out;
}
const wmFrame = (f) => ({ rows: f, tones: f.map((row) => [...row].map(wmTone)) });

/* ---------------------------------------------------------------- ouroboros
   A tapered tube on a ring, head bulging at u=0 and the tail thinning into its mouth. The ring
   turns head-first, a slither wave runs along it, scales come from a diamond pattern on the
   surface. Lit like donut.c, z-buffered per cell. The eye is 'O', drawn in amber. */

function ouroGeo() {
  const TAU = Math.PI * 2, U = 640, V = 28, LEN = TAU * 0.972, tailS = TAU * 0.48;
  const p = new Float32Array(U * V * 9), eye = new Uint8Array(U * V);
  let n = 0;
  for (let i = 0; i < U; i++) {
    const u = (i / (U - 1)) * LEN;
    let rb = 0.25 + 0.17 * Math.exp(-(((u - 0.26) / 0.17) ** 2));
    if (u > tailS) rb *= 1 - 0.9 * ((u - tailS) / (LEN - tailS)) ** 1.1;
    if (u < 0.08) rb *= 0.55 + 0.45 * (u / 0.08);
    const cu = Math.cos(u), su = Math.sin(u), s4 = Math.sin(4 * u), c4 = Math.cos(4 * u);
    for (let j = 0; j < V; j++) {
      const v = (j / V) * TAU, cv = Math.cos(v), sv = Math.sin(v), o = n * 9;
      p[o] = (1 + rb * cv) * cu; p[o + 1] = (1 + rb * cv) * su; p[o + 2] = rb * sv;
      p[o + 3] = cv * cu; p[o + 4] = cv * su; p[o + 5] = sv;
      p[o + 6] = s4; p[o + 7] = c4;
      const sc = Math.sin(u * 46 + v * 2) * Math.sin(v * 5 - u * 23);
      p[o + 8] = sc > 0.3 ? 0.12 : sc < -0.3 ? -0.18 : 0;
      const dv = Math.atan2(Math.sin(v + 0.9), Math.cos(v + 0.9));
      eye[n] = (Math.abs(u - 0.3) < 0.05 && Math.abs(dv) < 0.34) ? 1 : 0;
      n++;
    }
  }
  return { p, eye, n };
}

function ouroFrames(cols, rows, F) {
  const g = ouroGeo(), TAU = Math.PI * 2;
  const K2 = 5, Kx = cols * 0.47 * K2 / 1.44, Ky = Kx * 0.6;
  const ll = Math.hypot(-0.45, 0.7, -0.75), Lx = -0.45 / ll, Ly = 0.7 / ll, Lz = -0.75 / ll;
  const frames = [];
  for (let f = 0; f < F; f++) {
    const A = (f / F) * TAU, spin = -A, tilt = 1.1 + 0.1 * Math.sin(A), ph = 3 * A;
    const cs = Math.cos(spin), ss = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
    const cph = Math.cos(ph), sph = Math.sin(ph);
    const zb = new Float32Array(cols * rows), out = new Array(cols * rows).fill(' ');
    const P = g.p;
    for (let k = 0; k < g.n; k++) {
      const o = k * 9;
      const x = P[o], y = P[o + 1], z = P[o + 2] + 0.075 * (P[o + 6] * cph - P[o + 7] * sph);
      const x1 = x * cs - y * ss, y1 = x * ss + y * cs;
      const y2 = y1 * ct - z * st, z2 = y1 * st + z * ct;
      const ooz = 1 / (z2 + K2);
      const col = Math.round(cols / 2 - 0.5 + Kx * x1 * ooz), row = Math.round(rows / 2 - 0.5 - Ky * y2 * ooz);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const i = row * cols + col;
      if (ooz <= zb[i]) continue;
      zb[i] = ooz;
      const nx = P[o + 3], ny = P[o + 4], nz = P[o + 5];
      const nx1 = nx * cs - ny * ss, ny1 = nx * ss + ny * cs;
      const ny2 = ny1 * ct - nz * st, nz2 = ny1 * st + nz * ct;
      const lum = nx1 * Lx + ny2 * Ly + nz2 * Lz + P[o + 8];
      if (g.eye[k] && nz2 < 0.1) { out[i] = 'O'; continue; }
      const li = Math.max(0, Math.min(11, Math.floor(Math.max(0, (lum + 1) / 2) ** 1.25 * 12)));
      out[i] = RAMP[li];
    }
    const rs = [];
    for (let r = 0; r < rows; r++) rs.push(out.slice(r * cols, (r + 1) * cols).join(''));
    frames.push({ rows: rs, tones: rs.map((row) => [...row].map(rampTone)) });
  }
  return frames;
}

/* ---------------------------------------------------------------- block letters
   Text from a bold face sampled into a cell grid: a cell is lit when more than 42% of it is ink.
   Same rule as the mockup's canvas, but rasterised here from the font outlines. */

function textMask(font, s, cols, rows, S = 6) {
  const W = cols * S, H = rows * S;
  const bb0 = font.getPath(s, 0, 0, 100).getBoundingBox();
  const k = Math.min((W * 0.985) / (bb0.x2 - bb0.x1), (H * 0.97) / (bb0.y2 - bb0.y1));
  const size = 100 * k;
  const bb = font.getPath(s, 0, 0, size).getBoundingBox();
  const ox = (W - (bb.x2 - bb.x1)) / 2 - bb.x1, oy = (H - (bb.y2 - bb.y1)) / 2 - bb.y1;
  // Flatten the outline into edges.
  const edges = [];
  let px = 0, py = 0, sx = 0, sy = 0;
  const line = (x, y) => { edges.push([px, py, x, y]); px = x; py = y; };
  for (const c of font.getPath(s, ox, oy, size).commands) {
    if (c.type === 'M') { px = sx = c.x; py = sy = c.y; }
    else if (c.type === 'L') line(c.x, c.y);
    else if (c.type === 'Q') { const x0 = px, y0 = py; for (let i = 1; i <= 12; i++) { const t = i / 12, u = 1 - t; line(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
    else if (c.type === 'C') { const x0 = px, y0 = py; for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; line(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
    else if (c.type === 'Z') { if (px !== sx || py !== sy) line(sx, sy); }
  }
  // Coverage with 2x2 samples per pixel, nonzero winding, scanline by scanline.
  const cov = new Float32Array(W * H);
  for (let yy = 0; yy < H * 2; yy++) {
    const y = (yy + 0.5) / 2, hits = [];
    for (const [x0, y0, x1, y1] of edges) {
      if (y0 === y1) continue;
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) hits.push([x0 + ((y - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    for (let xx = 0; xx < W * 2; xx++) {
      const x = (xx + 0.5) / 2;
      let wnd = 0;
      for (const [hx, dir] of hits) { if (hx > x) break; wnd += dir; }
      if (wnd !== 0) cov[(yy >> 1) * W + (xx >> 1)] += 0.25;
    }
  }
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    let a = 0;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) a += cov[(r * S + yy) * W + q * S + xx];
    mask[r * cols + q] = a / (S * S) > 0.42 ? 1 : 0;
  }
  return mask;
}

/* ================================================================== hero */

async function hero() {
  const W = 846, H = 520;
  const D = doc();
  const T = D.text;
  const css = [];
  const fx = (d) => `class="fx" style="animation-delay:${d}s"`;
  let body = '';

  // Window and title bar.
  body += `<defs><clipPath id="win"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<rect width="${W}" height="${H}" rx="12" fill="${C.bg}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="11.5" stroke="${C.edge}"/>
<g clip-path="url(#win)">
<rect width="${W}" height="30" fill="${C.bar}"/>
${[0, 1, 2].map((i) => `<circle cx="${19.5 + i * 18}" cy="15" r="5.5" fill="${C.dot}"/>`).join('')}
${T(W / 2, base(6, 18, 12), HERO.title, { cls: 'dim', size: 12, anchor: 'middle' })}
</g>`;

  // The command, typed. Each character waits for its turn on the typewriter's clock.
  const cmdY = base(44, 18, 13), cw = ADV * 13;
  const typedX = 40 + HERO.prompt.length * cw + 9;
  const n = HERO.command.length, typeAt = 0.3, typeDur = 0.62;
  let typed = '';
  [...HERO.command].forEach((ch, i) => {
    if (ch === ' ') return;
    typed += T(typedX + i * cw, cmdY, ch, { cls: 'ink hide', extra: ` style="animation-duration:${(typeAt + ((i + 1) * typeDur) / n).toFixed(3)}s"` });
  });
  body += `\n<g ${fx(0.05)}>${T(40, cmdY, HERO.prompt, { cls: 'dim' })}${typed}</g>`;

  // The name: resolves out of noise once, then turns forever.
  const wmCfg = { adv: 10.2 * ADV, lh: 11, b0: base(0, 11, 10.2) };
  const dd = DECODE_DUR / DECODE_FRAMES;
  let wm = '';
  wordmarkDecodeFrames().forEach((f, k) => {
    for (const r of f.rows) D.note(r);
    wm += `<g class="once" style="animation-delay:${(DECODE_AT + k * dd).toFixed(3)}s;animation-duration:${dd.toFixed(3)}s">${frameText(f.rows, f.tones, wmCfg)}</g>`;
  });
  const loopAt = DECODE_AT + DECODE_DUR, wdt = 1 / WM_FPS, wloop = WM.length * wdt;
  let wmLoop = '';
  WM.forEach((f, i) => {
    for (const r of f) D.note(r);
    const fr = wmFrame(f);
    wmLoop += `<g class="wf${i ? '' : ' f0'}" style="animation-delay:${(loopAt + i * wdt).toFixed(3)}s">${frameText(fr.rows, fr.tones, wmCfg)}</g>`;
  });
  css.push(`.wm text{font-size:10.2px}.wf{opacity:0;animation:wf ${wloop.toFixed(3)}s step-end infinite}.wf.f0{opacity:1}@keyframes wf{0%{opacity:1}${(100 / WM.length).toFixed(3)}%{opacity:0}100%{opacity:0}}`);
  body += `\n<g class="wm" transform="translate(40 74)">${wm}<g class="hide" style="animation-duration:${loopAt}s">${wmLoop}</g></g>`;

  // Welcome panel. Its border draws in, then the contents arrive one after another.
  const P = { x: 24, y: 224, w: 798, h: 214 };
  css.push(`.dr{stroke-dasharray:1;animation:dr .9s cubic-bezier(.65,0,.35,1) 1.95s both}@keyframes dr{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}`);
  body += `\n<rect x="${P.x + 0.6}" y="${P.y + 0.6}" width="${P.w - 1.2}" height="${P.h - 1.2}" rx="8" stroke="${C.line}" stroke-width="1.2" pathLength="1" class="dr"/>`;
  const labY = base(P.y - 8, 16, 13);
  body += `\n<g ${fx(2.3)}><rect x="${P.x + 14}" y="${P.y - 8}" width="${n2(14 + (HERO.label.length + 2) * cw)}" height="16" fill="${C.bg}"/>${glyphStar(P.x + 21, labY, 13, C.acc)}${T(P.x + 21 + 2 * cw, labY, HERO.label)}</g>`;

  // Left column, centred like the mockup's flex column: name, ouroboros, place.
  const colX = P.x + 153;
  const nameLH = 14.5 * 1.5, placeLH = 12.5 * 1.5, ouroH = 136, gap = 9;
  const top = P.y + (P.h - (nameLH + gap + ouroH + gap + placeLH)) / 2;
  body += `\n<g ${fx(2.45)}>${T(colX, base(top, nameLH, 14.5), HERO.name, { cls: 'ink', size: 14.5, w: 700, anchor: 'middle' })}</g>`;
  const OC = 44, OR = 17, ouroW = OC * 8 * ADV;
  const odt = OURO_TURN / OURO_FRAMES;
  let ouro = '';
  ouroFrames(OC, OR, OURO_FRAMES).forEach((f, i) => {
    for (const r of f.rows) D.note(r);
    ouro += `<g class="of${i ? '' : ' f0'}" style="animation-delay:${(-(OURO_TURN - i * odt)).toFixed(3)}s">${frameText(f.rows, f.tones, { adv: 8 * ADV, lh: 8, b0: base(0, 8, 8) })}</g>`;
  });
  css.push(`.ou text{font-size:8px}.of{opacity:0;animation:of ${OURO_TURN}s step-end infinite}.of.f0{opacity:1}@keyframes of{0%{opacity:1}${(100 / OURO_FRAMES).toFixed(3)}%{opacity:0}100%{opacity:0}}`);
  body += `\n<g ${fx(2.5)}><g class="ou" transform="translate(${n2(colX - ouroW / 2)} ${n2(top + nameLH + gap)})">${ouro}</g></g>`;
  body += `\n<g ${fx(2.55)}>${T(colX, base(top + nameLH + gap + ouroH + gap, placeLH, 12.5), HERO.place, { cls: 'dim', size: 12.5, anchor: 'middle' })}</g>`;

  // Divider.
  const dvX = P.x + 306 + 0.6, dvT = P.y + 22, dvB = P.y + P.h - 22;
  body += `\n<path d="M${dvX} ${dvT}V${dvB}" stroke="${C.line}" stroke-width="1.2" class="fxy" style="animation-delay:2.35s;transform-origin:${dvX}px ${(dvT + dvB) / 2}px"/>`;

  // Right column.
  const RX = P.x + 330, RR = P.x + P.w - 24;
  let y = P.y + 22, at = 2.5, right = '';
  for (const item of HERO.right) {
    if (item.rule) {
      y += 10;
      right += `<rect x="${RX}" y="${y}" width="${RR - RX}" height="1" fill="${C.line}" class="fxx" style="animation-delay:${at.toFixed(2)}s;transform-origin:${RX}px ${y}px"/>`;
      y += 12; at += 0.05; continue;
    }
    if (item.gap) { y += 9; at += 0.05; continue; }
    right += `<g ${fx(at.toFixed(2))}>${item.h ? T(RX, base(y, 20, 13), item.h, { cls: 'ink', w: 700 }) : T(RX, base(y, 20, 13), item.p)}</g>`;
    y += 20; at += 0.05;
  }
  body += `\n${right}`;

  // Prompt box, cursor waiting, a suggestion in grey.
  const PY = 452, PH = 38, mid = PY + PH / 2, pY = base(mid - 13.5 * 0.75, 13.5 * 1.5, 13.5), pw = ADV * 13.5;
  const px0 = P.x + 1.2 + 14;
  css.push(`.bl{animation:bl 1.05s steps(1) infinite}@keyframes bl{50%{opacity:0}}`);
  body += `\n<g ${fx(3.05)}><rect x="${P.x + 0.6}" y="${PY + 0.6}" width="${P.w - 1.2}" height="${PH - 1.2}" rx="6" stroke="${C.box}" stroke-width="1.2"/>`
    + T(px0, pY, '>', { cls: 'ink', size: 13.5 })
    + `<rect x="${n2(px0 + pw + 9)}" y="${mid - 8}" width="8" height="16" fill="${C.ink}" class="bl"/>`
    + T(px0 + pw + 9 + 8 + 9, pY, HERO.suggestion, { cls: 'dim', size: 13.5 }) + `</g>`;

  // Hint row.
  const hY = base(498, 18, 12);
  body += `\n<g ${fx(3.2)}>${T(38, hY, HERO.hintLeft, { cls: 'dim', size: 12 })}${T(W - 38, hY, HERO.hintRight, { cls: 'dim', size: 12, anchor: 'end' })}</g>`;

  const label = `A terminal styled like a coding agent CLI. The command "${HERO.command}" prints RITHVIK in rotating ASCII letters, then a welcome panel for ${HERO.name}, ${HERO.place}, with a turning ASCII ouroboros. `
    + HERO.right.filter((r) => r.h || r.p).map((r) => r.h ? `${r.h}:` : r.p.replace(/ · /g, ', ').replace(/([^.])$/, '$1.')).join(' ');
  return svg({
    w: W, h: H, label, title: HERO.name,
    css: `${await D.fonts()}${BASE_CSS}${MOTION_CSS}${css.join('')}${REDUCED}`,
    body,
  });
}

/* ================================================================== site */

async function site() {
  const W = 846, H = 192, cw = ADV * 13;
  const D = doc(), T = D.text;
  let body = `<rect width="${W}" height="${H}" rx="12" fill="${C.bg}"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="11.5" stroke="${C.edge}"/>`;

  // ● Fetch(https://rithvik.ai)
  const y1 = base(20, 18, 13);
  body += `\n<circle cx="30" cy="29" r="4" fill="${C.ok}"/>${T(43, y1, SITE.tool, { cls: 'ink', w: 700 })}${T(43 + SITE.tool.length * cw + 9, y1, `(${SITE.url})`)}`;
  // ⎿  200 OK · ...
  const y2 = base(42, 18, 13);
  // The mockup's fallback font drew ⎿ about two cells wide, then a non-breaking space and a space.
  body += `\n${glyphCorner(30, y2, 13, C.dim)}${T(60, y2, SITE.result, { cls: 'dim' })}`;

  // The box with the block letters.
  const BX = 24, BY = 72, BW = 798, BH = 100;
  body += `\n<rect x="${BX + 0.6}" y="${BY + 0.6}" width="${BW - 1.2}" height="${BH - 1.2}" rx="8" stroke="${C.line}" stroke-width="1.2"/>`;
  const cols = 112, rows = 14, cell = 6, mask = textMask(SANS_800, SITE.blocks, cols, rows);
  const ox = Math.round(BX + 1.2 + 24), oy = Math.round(BY + 1.2 + 8);
  const sq = (c, r, dx = 0) => `M${n2(ox + c * cell + dx)} ${n2(oy + r * cell + dx)}h5v5h-5z`;
  let shade = '', face = '';
  const lit = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (mask[r * cols + c]) lit.push([c, r]);
  for (const [c, r] of lit) { shade += sq(c, r, cell * 0.55); face += sq(c, r); }
  body += `\n<path d="${shade}" fill="${C.shade}"/><path d="${face}" fill="${C.face}"/>`;

  // The glint. The canvas lit a cell amber when it sat within 4.16 cells of a slanted line moving
  // across, and pale within 7.28. Here every slanted column of cells is an amber copy and a pale
  // copy that blink on when the line passes, each on its own delay.
  const v = (cols + 40) / GLINT_SWEEP; // cells per second
  const bands = [[C.pale, 5 * Math.sqrt(Math.log(1 / 0.12)), 'gp'], [C.acc, 5 * Math.sqrt(Math.log(2)), 'ga']];
  const css = [];
  let glint = '';
  for (const [fill, half, cls] of bands) {
    const on = (2 * half) / v;
    css.push(`.${cls}{opacity:0;animation:${cls} ${GLINT_CYCLE}s step-end infinite}@keyframes ${cls}{0%{opacity:1}${((on / GLINT_CYCLE) * 100).toFixed(3)}%{opacity:0}100%{opacity:0}}`);
    const groups = new Map();
    for (const [c, r] of lit) {
      const s = Math.round(c + r * 0.6);
      groups.set(s, (groups.get(s) || '') + sq(c, r));
    }
    for (const [s, d] of [...groups].sort((a, b) => a[0] - b[0])) {
      const start = (s + 20 - half) / v;
      glint += `<path d="${d}" fill="${fill}" class="${cls}" style="animation-delay:${start.toFixed(3)}s"/>`;
    }
  }
  body += `\n${glint}`;

  // ↵ open
  const ey = base(BY + BH - 1.2 - 12 - 18, 18, 12), ecw = ADV * 12;
  const ex = BX + BW - 1.2 - 18 - (SITE.enter.length + 2) * ecw;
  body += `\n${glyphReturn(ex, ey, 12, C.acc)}${T(ex + 2 * ecw, ey, SITE.enter, { cls: 'dim', size: 12 })}`;

  return svg({
    w: W, h: H,
    label: `${SITE.tool} ${SITE.url}: ${SITE.result}. ${SITE.blocks} in square-pixel block letters with an amber glint passing over them. Opens ${SITE.url}.`,
    title: SITE.blocks,
    css: `${await D.fonts()}${BASE_CSS}${css.join('')}${REDUCED}`,
    body,
  });
}

/* ================================================================== contact menu */

async function contactHead(light) {
  const W = 846, H = 30, D = doc(), T = D.text;
  const y = base(15 - 12.5 * 0.75, 12.5 * 1.5, 12.5);
  // GitHub's light theme gets darker ink, since this row has no card behind it.
  const ink = light ? '#1f2328' : C.ink, dim = light ? '#59636e' : C.dim;
  const body = `<text x="4" y="${y}" style="font-size:12.5px" fill="${ink}">${esc(CONTACT.head)}</text>`
    + `<text x="${n2(4 + CONTACT.head.length * 12.5 * ADV + 14)}" y="${y}" style="font-size:12.5px" fill="${dim}">${esc(CONTACT.hint)}</text>`;
  D.note(CONTACT.head + CONTACT.hint);
  return svg({
    w: W, h: H, label: `${CONTACT.head}: ${CONTACT.hint.replace('↑↓', 'up and down arrows')}`, title: CONTACT.head,
    css: `${await D.fonts()}${BASE_CSS}`, body,
  });
}

async function contactRow(row) {
  const W = 846, H = 38, D = doc(), T = D.text;
  const y = base(19 - 9.75, 19.5, 13);
  let body = `<rect width="${W}" height="${H}" rx="8" fill="${C.bg}"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="7.5" stroke="${C.edge}"/>`;
  if (row.on) body += glyphCaret(20, y, 13, C.acc);
  body += T(42, y, row.label, { cls: row.on ? 'acc' : 'soft' }) + T(192, y, row.value, { cls: row.on ? 'acc' : 'dim' });
  return svg({
    w: W, h: H, label: `${row.label}: ${row.value}${row.on ? ' (selected)' : ''}`, title: `${row.label.replace(/^\d+\.\s*/, '')}: ${row.value}`,
    css: `${await D.fonts()}${BASE_CSS}`, body,
  });
}

/* ================================================================== main */

const write = (name, s) => {
  fs.writeFileSync(path.join(OUT, name), s);
  console.log(name.padEnd(26), `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`);
};

write('hero.svg', await hero());
write('site.svg', await site());
write('contact-head.svg', await contactHead(false));
write('contact-head-light.svg', await contactHead(true));
for (const row of CONTACT.rows) write(row.file, await contactRow(row));
