/**
 * Frontmatter helpers for the i18n pipeline.
 *
 * Pure utilities that partition a parsed YAML frontmatter object into
 * translatable string leaves vs. non-translatable identifiers/paths, and
 * split a markdown file into its frontmatter + body. Shared by the
 * extraction pass (src/i18n/integration.ts) and the virtual content
 * loader (src/i18n/virtual-loader.ts).
 *
 * No collection is physically translated anymore — all content is served
 * by the virtual loader from source files + the shared source-text-as-key
 * catalog. This module holds only the classification + parsing helpers.
 */

/** Keys whose values are identifiers/enums and should never be translated. */
export const NON_TRANSLATABLE_KEYS = new Set([
  'showIn',
  'target',
  'variant',
  'icon',
  'name',
  'job',
  'type',
  'href',
  'src',
  'slug',
  'pathname',
  'page',
  'base',
  'rel',
  'lang',
  'dir',
  'id',
  'key',
  'url',
  'link',
  'to',
  'from',
  'ref',
  'class',
  'classes',
  'style',
  'tags',
  'category',
]);

/** Recursively collect all translatable string leaf values from a parsed YAML object. */
export function collectTranslatableStrings(obj: unknown, prefix = ''): Array<{ path: string; value: string }> {
  const result: Array<{ path: string; value: string }> = [];

  if (typeof obj === 'string') {
    // Extract the leaf key name from the path (last segment after . or [)
    // eslint-disable-next-line no-useless-escape
    const leafKey = prefix.replace(/^.*[.\[]/, '').replace(/\]$/, '');
    if (!NON_TRANSLATABLE_KEYS.has(leafKey) && isTranslatable(obj)) {
      result.push({ path: prefix, value: obj });
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const childResults = collectTranslatableStrings(obj[i], `${prefix}[${i}]`);
      result.push(...childResults);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const childResults = collectTranslatableStrings(val, prefix ? `${prefix}.${key}` : key);
      result.push(...childResults);
    }
  }

  return result;
}

const ASSET_EXTENSION_RE = /\.(jpe?g|png|webp|svg|pdf|mdx?)$/i;

/** Check if a string value should be translated (exclude URLs, icons, emails, phones, numbers). */
export function isTranslatable(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  // Relative paths and URL-like identifiers
  if (/^[~./]/.test(trimmed)) return false;
  // URLs with common schemes, anchors, and protocol URLs
  if (/^(https?:\/\/|mailto:|tel:|sms:|#)/i.test(trimmed)) return false;
  // Common asset extensions
  if (ASSET_EXTENSION_RE.test(trimmed)) return false;
  // CSS class-like strings (single Tailwind class or modifier variant)
  if (/^(text-|bg-|font-|hover:|dark:|sm:|md:|lg:|xl:)[a-z0-9-:/]+$/i.test(trimmed)) return false;
  // Icon references (e.g. tabler:brand-facebook)
  if (/^[a-z][a-z0-9]*(:[a-z][a-z0-9-]*)+$/i.test(trimmed)) return false;
  // Email addresses
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return false;
  // Phone/fax numbers (mostly digits, +, spaces, dashes, parens)
  if (/^[+\d\s\-()]{6,}$/.test(trimmed)) return false;
  // Pure numbers
  if (/^\d+$/.test(trimmed)) return false;
  // HTML fragments (contain tags)
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return false;
  return true;
}

/** Indexable type for traversing nested YAML/object structures. */
type NestedIndexable = { [key: string]: unknown } | unknown[];

/** Set a value at a dotted/array path in a nested object. */
export function setValueAtPath(obj: Record<string, unknown>, path: string, value: string): void {
  // eslint-disable-next-line no-useless-escape
  const parts = path.split(/(?<=[^\[\]])\.|(?<=\])\.|\[|\]/).filter(Boolean);
  let current: NestedIndexable = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (/^\d+$/.test(key)) {
      const arr = current as unknown[];
      current = arr[parseInt(key)] as NestedIndexable;
    } else {
      const obj = current as { [key: string]: unknown };
      if (obj[key] === undefined) return; // safety: path doesn't exist
      current = obj[key] as NestedIndexable;
    }
  }

  const lastKey = parts[parts.length - 1];
  if (/^\d+$/.test(lastKey)) {
    (current as unknown[])[parseInt(lastKey)] = value;
  } else {
    (current as { [key: string]: unknown })[lastKey] = value;
  }
}

/** Split a markdown file into its YAML frontmatter and body. */
export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return { frontmatter: '', body: content };
  const secondSep = trimmed.indexOf('\n---', 3);
  if (secondSep === -1) {
    const alt = trimmed.indexOf('---', 3);
    if (alt === -1) return { frontmatter: '', body: content };
    return { frontmatter: trimmed.slice(4, alt).trim(), body: trimmed.slice(alt + 3).trim() };
  }
  return { frontmatter: trimmed.slice(4, secondSep).trim(), body: trimmed.slice(secondSep + 4).trim() };
}
