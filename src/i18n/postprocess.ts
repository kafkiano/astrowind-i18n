/**
 * HTML post-processing: translates English strings in HTML content
 * with translations from JSON catalogs for non-English locale pages.
 * All I/O is async (fs/promises).
 */

import { parseDocument } from 'htmlparser2';
import { hasChildren, isTag } from 'domhandler';
import type { Element } from 'domhandler';
import render from 'dom-serializer';
import type { Catalog, CatalogSet } from './catalog';

/**
 * Walk a DOM tree and normalize for canonical comparison:
 * - Sort class attribute values alphabetically (fixes Tailwind v4 reordering)
 */
function normalizeDom(node: Parameters<typeof hasChildren>[0]): void {
  if (!hasChildren(node)) return;
  for (const child of node.children) {
    if (isTag(child)) {
      if (child.attribs && child.attribs['class']) {
        child.attribs['class'] = child.attribs['class'].split(/\s+/).filter(Boolean).sort().join(' ');
      }
      normalizeDom(child);
    }
  }
}

/**
 * Parse and normalize an HTML string for canonical comparison.
 * Normalizes: class ordering, whitespace around tag boundaries,
 * and leading/trailing whitespace.
 */
function canonicalInnerHtml(html: string): string {
  const doc = parseDocument(html);
  normalizeDom(doc);
  return render(doc.children).replace(/>\s+/g, '>').replace(/\s+</g, '<').trim();
}

/** Attribute names whose values can be translated. */
const TRANSLATABLE_ATTRS = new Set(['alt', 'aria-label', 'title', 'placeholder', 'content']);

/**
 * Determine whether an attribute value should be considered for translation.
 * Excludes empty strings, URLs, icon identifiers, and numeric values.
 */
function isTranslatableAttributeValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
  if (/^(https?:\/\/|\/\/|mailto:|tel:|sms:|\/|#)/i.test(trimmed)) return false;
  if (/^tabler:/i.test(trimmed)) return false;
  return true;
}

/**
 * Build an exact-string translation map for attribute values.
 * Only includes catalog entries whose translation differs from the key,
 * is non-empty, and passes attribute-value heuristics.
 */
function buildAttributeTranslationMap(catalog: Catalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, translation] of Object.entries(catalog)) {
    if (!translation || translation === key) continue;
    const trimmed = key.trim();
    if (!trimmed || !isTranslatableAttributeValue(trimmed)) continue;
    map.set(trimmed, translation);
  }
  return map;
}

/**
 * Replace English text content in HTML with catalog translations.
 * Uses DOM-based approach (htmlparser2) to correctly handle inline HTML
 * in translation strings (e.g. `<span>` tags inside attribute values).
 * Full-string matching only — no substring tokenization.
 */
export function translateHtml(html: string, locale: string, catalogs: CatalogSet, sourceLocale: string): string {
  if (locale === sourceLocale) return html;

  const targetCatalog = catalogs[locale];
  if (!targetCatalog) return html;

  // Build a lookup map: normalized innerHTML → translation.
  // Normalization: parse→sort classes→serialize for canonical form.
  const translationMap = new Map<string, string>();
  for (const [key, translation] of Object.entries(targetCatalog)) {
    if (!translation || translation === key) continue;
    const trimmed = key.trim();
    if (!trimmed) continue;

    const canonical = canonicalInnerHtml(trimmed);
    if (canonical && canonical !== translation) {
      translationMap.set(canonical, translation);
    }
  }

  // Build an exact-string map for attribute values.
  const attributeTranslationMap = buildAttributeTranslationMap(targetCatalog);

  if (translationMap.size === 0 && attributeTranslationMap.size === 0) return html;

  // Parse the full HTML into a DOM
  const doc = parseDocument(html);
  normalizeDom(doc);

  let replaced = 0;

  /**
   * Walk all element nodes. For each, check if its innerHTML (trimmed)
   * matches a catalog key's canonical form. If so, swap children with
   * the parsed translation.
   */
  function walk(node: Parameters<typeof hasChildren>[0]): void {
    if (!hasChildren(node)) return;

    // Copy-iteration: child replacement (text node → elements) mutates the array,
    // so we iterate over a snapshot to avoid skipping or double-visiting nodes.
    for (const child of [...node.children]) {
      // ── Text nodes: match trimmed content against catalog keys ──────
      if (child.type === 'text') {
        const content = (child.data as string).trim();
        if (!content) continue;
        const translation = translationMap.get(content);
        if (translation) {
          const translatedDoc = parseDocument(translation);
          const newNodes = getTopLevelNodes(translatedDoc);
          const idx = node.children.indexOf(child);
          if (idx !== -1) node.children.splice(idx, 1, ...newNodes);
          replaced++;
        }
        continue;
      }

      if (!isTag(child)) continue;

      // Skip <script> tags
      if (child.name === 'script') continue;

      // Translate eligible attribute values with exact-string matching
      if (attributeTranslationMap.size > 0) {
        translateElementAttributes(child, attributeTranslationMap);
      }

      // Check element BEFORE recursing into children (top-down).
      // If the element's innerHTML matches a catalog key, replace its
      // children wholesale and skip recursion — avoids the depth-first
      // race condition where a child's translation corrupts the parent's
      // innerHTML before the parent can match.
      const normalized = render(child.children).replace(/>\s+/g, '>').replace(/\s+</g, '<').trim();
      if (normalized) {
        const translation = translationMap.get(normalized);
        if (translation) {
          const translatedDoc = parseDocument(translation);
          child.children = getTopLevelNodes(translatedDoc);
          replaced++;
          continue; // skip recursion — children already replaced
        }
      }

      // No match at this level — recurse into children
      walk(child);
    }
  }

  walk(doc);

  // Also check top-level text segments in the document root
  // (handles cases where the full HTML is a single top-level element)
  if (replaced === 0 && hasChildren(doc)) {
    const rootInner = render(doc.children).replace(/>\s+/g, '>').replace(/\s+</g, '<').trim();
    const translation = translationMap.get(rootInner);
    if (translation) {
      const translatedDoc = parseDocument(translation);
      doc.children = getTopLevelNodes(translatedDoc);
    }
  }

  return render(doc);
}

/**
 * Translate eligible attribute values on an element using exact-string matching.
 */
function translateElementAttributes(element: Element, attributeMap: Map<string, string>): void {
  for (const [name, value] of Object.entries(element.attribs)) {
    if (!TRANSLATABLE_ATTRS.has(name)) continue;
    if (name === 'content' && element.name !== 'meta') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const translation = attributeMap.get(trimmed);
    if (translation) {
      element.attribs[name] = translation;
    }
  }
}

/** Extract top-level child nodes from a Document. */
function getTopLevelNodes(doc: ReturnType<typeof parseDocument>) {
  return hasChildren(doc) ? [...doc.children] : [];
}
