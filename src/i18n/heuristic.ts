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
  scope: 'markup' | 'attribute' | 'script';
  element?: string;
  attribute?: string;
  call?: string;
  declaring?: string;
}

/** Elements whose text content is never translatable */
const IGNORE_ELEMENTS = new Set(['script', 'style', 'path', 'code', 'pre']);

/** Attribute values that are never translatable: [element, attribute] */
const IGNORE_ATTRIBUTES: [string, string][] = [['form', 'method']];

/** Function calls whose arguments are never translatable */
const IGNORE_CALLS = new Set(['fetch']);

/** Attributes whose values are URLs (detected, not translated) */
const URL_ATTRIBUTES: [string, string][] = [['a', 'href']];

/** Function calls whose string arguments are URLs */
const URL_CALLS: string[] = [];

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

  if (looksLikeUrl && (ctx.scope === 'script' || ctx.scope === 'attribute')) {
    if (ctx.call && URL_CALLS.includes(ctx.call)) return 'url';
    if (ctx.attribute) {
      for (const [el, attr] of URL_ATTRIBUTES) {
        if (ctx.element === el && ctx.attribute === attr) return 'url';
      }
    }
  }

  // Markup text: always translatable
  if (ctx.scope === 'markup') return 'message';

  // ── Script and attribute scope ──

  // Skip: non-letter first character
  if (!/\p{L}/u.test(str[0])) return false;

  // Skip: starts with lowercase ASCII letter (likely variable/method names)
  if (/[a-z]/.test(str[0])) return false;

  // Skip: all uppercase + non-letters (CONSTANTS, abbreviations)
  if (/^([A-Z]|\P{L})+$/u.test(str)) return false;

  // Attribute: acceptable after filtering
  if (ctx.scope === 'attribute') return 'message';

  // Script scope: expression without function context → skip
  if (ctx.declaring === 'expression') return false;

  // Function calls: skip console.* and ignored calls
  if (ctx.call) {
    if (ctx.call.startsWith('console.') || IGNORE_CALLS.has(ctx.call)) return false;
  }

  return 'message';
}
