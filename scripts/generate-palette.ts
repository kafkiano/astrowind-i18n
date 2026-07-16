/**
 * Dev-time palette generator for the website-farm theming system.
 *
 * Input: one brand hex per chromatic color (primary/secondary/accent) + an optional
 * neutral family. Output: the `--aw-color-*` scale CSS block, ready to paste into
 * src/components/CustomStyles.astro (`:root`, and `.dark` if `--<color>-dark` given).
 *
 * The ramp is brand-anchored: 500 = the input hex, 50–400 lighten toward white, 600–950
 * darken toward near-black, hue held constant (chromatic colors) or zero (achromatic).
 * OKLCH is used so the lightness progression is perceptually uniform. The dark end of a
 * saturated hue can look muddy (e.g. gold → bronze) — this is correct, but REVIEW the
 * 800–950 stops by eye before shipping. The script never writes files; paste what it prints.
 *
 * Usage:
 *   bun run scripts/generate-palette.ts \
 *     --primary #0161ef --secondary #0154cf --accent #6d28d9 \
 *     [--primary-dark #6db9ff] [--neutral slate]
 *
 * Mode-varying themes: pass `--<color>-dark` for each color that should differ in dark mode;
 * a `.dark { ... }` override block is emitted for those. Colors without a `-dark` variant
 * inherit the `:root` ramp (mode-invariant, the default-theme pattern).
 *
 * See dev/docs/theming-tokens.md for the architecture and the 500=brand contract.
 */
// No imports — self-contained, no dependencies. Runs under bun (or any TS runtime).

// ----------------------------------------------------------------------------
// sRGB <-> OKLCH (Ottosson's OKLab, D65). Constants verified against oklch.com.
// ----------------------------------------------------------------------------

// sRGB <-> OKLCH via Ottosson's OKLab (D65), full-precision values from
// bottosson.github.io/posts/oklab (updated 2021-01-25). The forward and reverse
// matrices are published as exact inverse pairs there, so round-trips are exact.
const LIN_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const OKLAB_FROM_LMS = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const LMS_FROM_OKLAB = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.0638541728],
  [1.0, -0.0894841775, -1.291485548],
];
const LIN_FROM_LMS = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const dot = (m: number[][], v: number[]) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

type OKLCH = { l: number; c: number; h: number };

function hexToSrgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color (expected #rrggbb): ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
}

function srgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v * 255)));
  const h = (to(r) << 16) | (to(g) << 8) | to(b);
  return `#${h.toString(16).padStart(6, '0')}`;
}

function srgbToOklch(r: number, g: number, b: number): OKLCH {
  const lin = [srgbToLin(r), srgbToLin(g), srgbToLin(b)];
  const lms = dot(LIN_TO_LMS, lin).map((v) => Math.cbrt(v));
  const [L, a, bb] = dot(OKLAB_FROM_LMS, lms);
  return { l: L, c: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}

function oklchToLinSrgb(L: number, C: number, hRad: number): [number, number, number] {
  const a = C * Math.cos(hRad);
  const bb = C * Math.sin(hRad);
  const lms = dot(LMS_FROM_OKLAB, [L, a, bb]).map((v) => v ** 3);
  return dot(LIN_FROM_LMS, lms) as [number, number, number];
}

/** Gamut-map an OKLCH color into sRGB by reducing chroma until all channels are in [0,1]. */
function oklchToSrgbClamped(L: number, C: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const inGamut = (c: number) => {
    const [r, g, b] = oklchToLinSrgb(L, c, hRad);
    return [linToSrgb(Math.max(0, r)), linToSrgb(Math.max(0, g)), linToSrgb(Math.max(0, b))];
  };
  let lo = 0;
  let hi = C;
  let best = inGamut(0);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const [r, g, b] = inGamut(mid);
    if (r >= -0.0001 && r <= 1.0001 && g >= -0.0001 && g <= 1.0001 && b >= -0.0001 && b <= 1.0001) {
      best = [r, g, b];
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

// ----------------------------------------------------------------------------
// Ramp generation
// ----------------------------------------------------------------------------

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Target lightness endpoints (OKLCH L), matching Tailwind's scale shape.
const L_LIGHT = 0.97;
const L_DARK = 0.16;

function ramp(hex: string): { stop: number; hex: string }[] {
  const [r, g, b] = hexToSrgb(hex);
  const { l: L0, c: C0, h: H0 } = srgbToOklch(r, g, b);
  const achromatic = C0 < 0.02;
  const H = achromatic ? 0 : H0;
  // Index of 500 in STOPS — the anchor. Everything interpolates toward it.
  const anchorIdx = STOPS.indexOf(500);
  return STOPS.map((stop, i) => {
    let L: number;
    if (i <= anchorIdx) {
      const t = i / anchorIdx; // 0 at 50, 1 at 500
      L = L_LIGHT * (1 - t) + L0 * t;
    } else {
      const t = (i - anchorIdx) / (STOPS.length - 1 - anchorIdx); // 0 at 500, 1 at 950
      L = L0 * (1 - t) + L_DARK * t;
    }
    let C: number;
    if (achromatic) {
      C = 0;
    } else if (i <= anchorIdx) {
      // Tints: fade chroma toward white (C -> 0 as L -> 1).
      C = C0 * (1 - (L - L0) / (1 - L0));
    } else {
      // Shades: gently desaturate toward black (avoids oversaturated mud at 950).
      C = C0 * (1 - 0.4 * ((L0 - L) / (L0 - L_DARK)));
    }
    C = Math.max(0, C);
    const [rr, gg, bb] = oklchToSrgbClamped(L, C, H);
    return { stop, hex: srgbToHex(rr, gg, bb) };
  });
}

// Built-in Tailwind neutral families (50-950). Clients pick one for --aw-color-neutral-*.
const NEUTRALS: Record<string, string[]> = {
  slate: [
    '#f8fafc',
    '#f1f5f9',
    '#e2e8f0',
    '#cbd5e1',
    '#94a3b8',
    '#64748b',
    '#475569',
    '#334155',
    '#1e293b',
    '#0f172a',
    '#020817',
  ],
  stone: [
    '#fafaf9',
    '#f5f5f4',
    '#e7e5e4',
    '#d6d3d1',
    '#a8a29e',
    '#78716c',
    '#57534e',
    '#44403c',
    '#292524',
    '#1c1917',
    '#0c0a09',
  ],
  zinc: [
    '#fafafa',
    '#f4f4f5',
    '#e4e4e7',
    '#d4d4d8',
    '#a1a1aa',
    '#71717a',
    '#52525b',
    '#3f3f46',
    '#27272a',
    '#18181b',
    '#09090b',
  ],
  gray: [
    '#f9fafb',
    '#f3f4f6',
    '#e5e7eb',
    '#d1d5db',
    '#9ca3af',
    '#6b7280',
    '#4b5563',
    '#374151',
    '#1f2937',
    '#111827',
    '#030712',
  ],
  neutral: [
    '#fcfcfc',
    '#f5f5f5',
    '#e5e5e5',
    '#d4d4d4',
    '#a3a3a3',
    '#737373',
    '#525252',
    '#404040',
    '#262626',
    '#171717',
    '#0a0a0a',
  ],
};

// ----------------------------------------------------------------------------
// CSS emission
// ----------------------------------------------------------------------------

function block(colors: Record<string, string | undefined>, neutralFamily?: string): string[] {
  const lines: string[] = [];
  for (const token of ['primary', 'secondary', 'accent']) {
    const hex = colors[token];
    if (!hex) continue;
    const stops = ramp(hex);
    const { l, c, h } = srgbToOklch(...hexToSrgb(hex));
    const achromatic = c < 0.02;
    lines.push(
      `    /* ${token} — generated from ${hex} (oklch ${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(0)})${achromatic ? ' [achromatic — gray ramp]' : ''} */`
    );
    for (const { stop, hex: sh } of stops) lines.push(`    --aw-color-${token}-${stop}: ${sh};`);
    lines.push(`    --aw-color-${token}: var(--aw-color-${token}-500);`);
    lines.push('');
  }
  if (neutralFamily) {
    const scale = NEUTRALS[neutralFamily];
    if (!scale)
      throw new Error(`Unknown neutral family '${neutralFamily}'. Use one of: ${Object.keys(NEUTRALS).join(', ')}`);
    lines.push(`    /* neutral — Tailwind ${neutralFamily} */`);
    for (let i = 0; i < STOPS.length; i++) lines.push(`    --aw-color-neutral-${STOPS[i]}: ${scale[i]};`);
    lines.push('');
  }
  return lines;
}

// ----------------------------------------------------------------------------
// Self-test: round-trip known hexes through OKLCH and back; verify the published
// oklch(0.5 0.15 30) -> sRGB example. Aborts before producing output if it fails.
// ----------------------------------------------------------------------------

function selfTest() {
  const cases = ['#0161ef', '#cfc09f', '#0a0a0a', '#ffffff', '#000000', '#6d28d9', '#00efd1'];
  for (const hex of cases) {
    const [r, g, b] = hexToSrgb(hex);
    const { l, c, h } = srgbToOklch(r, g, b);
    const [rr, gg, bb] = oklchToSrgbClamped(l, c, h);
    const back = srgbToHex(rr, gg, bb);
    if (back.toLowerCase() !== hex.toLowerCase()) {
      throw new Error(`Self-test FAILED: ${hex} -> ${back} (oklch ${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(0)})`);
    }
  }
  // Published reference: oklch(0.5 0.15 30) -> sRGB ~[0.658, 0.217, 0.165] (texel-org/color).
  const [r, g, b] = oklchToSrgbClamped(0.5, 0.15, 30);
  const near = (v: number, t: number, eps = 0.01) => Math.abs(v - t) < eps;
  if (!near(r, 0.658) || !near(g, 0.217) || !near(b, 0.165)) {
    throw new Error(
      `Self-test FAILED: oklch(0.5 0.15 30) -> rgb(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}), expected ~(0.658, 0.217, 0.165)`
    );
  }
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

function parseArgs(argv: string[]): { colors: Record<string, string>; dark: Record<string, string>; neutral?: string } {
  const colors: Record<string, string> = {};
  const dark: Record<string, string> = {};
  let neutral: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = /^--(primary|secondary|accent)(-dark)?$/.exec(a);
    if (m) {
      const val = argv[++i];
      if (!val) throw new Error(`${a} requires a hex value`);
      (m[2] ? dark : colors)[m[1]] = val;
    } else if (a === '--neutral') {
      neutral = argv[++i];
      if (!neutral) throw new Error('--neutral requires a family name');
    } else if (a === '--help' || a === '-h') {
      console.log(
        `Usage: bun run scripts/generate-palette.ts --primary #hex [--secondary #hex] [--accent #hex] [--primary-dark #hex ...] [--neutral slate|stone|zinc|gray|neutral]`
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return { colors, dark, neutral };
}

function main() {
  selfTest();
  const { colors, dark, neutral } = parseArgs(process.argv.slice(2));
  if (Object.keys(colors).length === 0 && !neutral) {
    console.error('Nothing to generate. Pass at least one of --primary/--secondary/--accent/--neutral. See --help.');
    process.exit(1);
  }
  const header = `# Paste into src/components/CustomStyles.astro — replace the existing color scale lines.\n# Review the 800-950 stops by eye (saturated hues go muddy at the dark end).\n`;
  const rootLines = block(colors, neutral);
  const out: string[] = [header];
  if (rootLines.length) {
    out.push('  :root {');
    out.push(...rootLines.map((l) => (l.trim() === '' ? '' : l)));
    if (colors.primary) out.push('    --aw-color-link: var(--aw-color-primary-700);');
    out.push('  }');
  }
  if (Object.keys(dark).length) {
    out.push('');
    out.push('  /* Dark-mode overrides — only for colors that differ from :root. */');
    out.push('  .dark {');
    const darkLines = block(dark);
    for (const l of darkLines) out.push(l.trim() === '' ? '' : l);
    if (dark.primary) out.push('    --aw-color-link: var(--aw-color-primary-300);');
    out.push('  }');
  }
  console.log(out.join('\n'));
}

try {
  main();
} catch (e) {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}
