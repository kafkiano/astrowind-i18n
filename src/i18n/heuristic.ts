/**
 * Heuristic for classifying strings as translatable or not.
 * Ported from Wuchale's defaultHeuristic (MIT license).
 *
 * Rules:
 * - Markup text nodes: always translatable
 * - Attribute strings: filtered by element/attribute ignore list
 * - Script strings (frontmatter): filtered by character patterns
 * - URLs: detected but not translated (return 'url' for separate handling)
 */

export type HeuristicResult = 'message' | 'url' | false;

export interface StringContext {
  scope: 'markup' | 'attribute' | 'script' | 'expression' | 'config';
  element?: string;
  attribute?: string;
}

/** Elements whose text content is never translatable */
export const IGNORE_ELEMENTS = new Set(['script', 'style', 'path', 'code', 'pre']);

/** Attribute values that are never translatable: [element, attribute] */
const IGNORE_ATTRIBUTES: [string, string][] = [['form', 'method']];

/** Attributes whose values are URLs (detected, not translated) */
const URL_ATTRIBUTES: [string, string][] = [['a', 'href']];

/**
 * Classify a string as translatable, URL, or not translatable.
 */
export function classifyString(str: string, ctx: StringContext): HeuristicResult {
  // Empty or whitespace-only: skip
  if (!str.trim()) return false;

  // Must contain at least one Unicode letter
  if (!/\p{L}/u.test(str)) return false;

  // Element content: skip for ignored elements
  if (ctx.element && IGNORE_ELEMENTS.has(ctx.element)) return false;

  // Attribute: skip for ignored element/attribute combinations
  if (ctx.scope === 'attribute' && ctx.element && ctx.attribute) {
    for (const [el, attr] of IGNORE_ATTRIBUTES) {
      if (ctx.element === el && ctx.attribute === attr) return false;
    }
  }

  // URL detection: starts with / and no spaces
  const looksLikeUrl = str.startsWith('/') && !str.includes(' ');

  if (looksLikeUrl && (ctx.scope === 'script' || ctx.scope === 'attribute' || ctx.scope === 'expression')) {
    if (ctx.attribute) {
      for (const [el, attr] of URL_ATTRIBUTES) {
        if (ctx.element === el && ctx.attribute === attr) return 'url';
      }
    }
  }

  // Config/frontmatter scope: user-facing YAML values — permissive but filtered.
  // Serves both src/config.yaml and markdown frontmatter leaves (the unified
  // classifier — src/i18n/markdown.ts delegates here via scope: 'config').
  if (ctx.scope === 'config') {
    // URLs / paths / protocols
    if (/^(https?:|mailto:|tel:|sms:|\/\/|\/|~\/|#)/i.test(str)) return false;
    // Email addresses
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return false;
    // Social handles / usernames
    if (str.startsWith('@')) return false;
    // Icon identifiers (e.g. tabler:brand-github, lucide:menu, remix:home)
    if (/^[a-z][a-z0-9]*(:[a-z][a-z0-9-]*)+$/.test(str)) return false;
    // Asset filenames / file extensions (e.g. photo.jpg, logo.svg, data.json) — not prose
    if (/\.(jpe?g|png|webp|svg|gif|avif|ico|pdf|mdx?|json|ya?ml|css)$/i.test(str)) return false;
    // Single-token lowercase identifier / enum / slug / kebab-case (e.g. primary, _blank, landing-pages)
    if (!str.includes(' ') && /^[_a-z][_a-z0-9_:-]*$/.test(str)) return false;
    return 'message';
  }

  // Markup text: always translatable
  if (ctx.scope === 'markup') return 'message';

  // ── Script, attribute, and expression scope ──

  // Skip: first character must be a Unicode letter or < (HTML-starting strings).
  // Rejects URLs (/...), CSS classes (2xl:...), link targets (_blank), etc.
  if (!/[\p{L}<]/u.test(str[0])) return false;

  // Skip: starts with lowercase ASCII letter (likely variable/method names)
  if (/[a-z]/.test(str[0])) return false;

  // Skip: all uppercase + non-letters (CONSTANTS, abbreviations)
  if (/^([A-Z]|\P{L})+$/u.test(str)) return false;

  // Attribute: acceptable after filtering
  if (ctx.scope === 'attribute') return 'message';

  // Expression: acceptable after filtering (same as attribute — UI text in expression props)
  if (ctx.scope === 'expression') return 'message';

  return 'message';
}
