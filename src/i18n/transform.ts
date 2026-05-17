/**
 * Vite plugin providing the i18n virtual module and .astro template transform.
 *
 * - Resolves `virtual:i18n-runtime` → _t() function
 * - Transforms .astro templates: text nodes and quoted attributes → {_t("...")}
 * - Injects `import { _t } from 'virtual:i18n-runtime'` into frontmatter
 */

import { parse } from '@astrojs/compiler';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';
import type { StringContext } from './heuristic';
import { classifyString } from './heuristic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIRTUAL_ID = 'virtual:i18n-runtime';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;
const RUNTIME_IMPORT = `import { _t } from '${VIRTUAL_ID}';`;

const TAG_NODES = new Set(['element', 'component', 'custom-element']);

// ---------------------------------------------------------------------------
// Runtime code (injected as virtual module)
// ---------------------------------------------------------------------------

const runtimeCode = `
import { loadAllCatalogs } from '~/i18n/catalog';
import { locales } from '~/locales/data';

let _locale = 'en';
let _catalogs;

export function setLocale(l) { _locale = l; }
export function getLocale() { return _locale; }

export function _t(msgid) {
  if (_locale === 'en') return msgid;
  if (!_catalogs) _catalogs = loadAllCatalogs('src/locales', locales);
  const t = _catalogs[_locale]?.[msgid];
  return (t && t !== msgid) ? t : msgid;
}
`;

// ---------------------------------------------------------------------------
// Byte → character offset
// ---------------------------------------------------------------------------

function byteToCharOffset(content: string, byteOffset: number): number {
  const buf = Buffer.from(content, 'utf-8');
  return Buffer.from(buf.subarray(0, byteOffset)).toString('utf-8').length;
}

// ---------------------------------------------------------------------------
// Template transform
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformTemplate(s: MagicString, ast: any, content: string): boolean {
  let hasTransformed = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any, parentEl?: string) {
    if (!node || typeof node !== 'object') return;

    const type = node.type as string | undefined;

    // Text nodes
    if (type === 'text') {
      const raw = node.value as string;
      const text = raw.trim();
      if (text && text.length > 0) {
        const ctx: StringContext = { scope: 'markup', element: parentEl };
        if (classifyString(text, ctx) === 'message') {
          const pos = node.position;
          if (pos?.start?.offset != null && pos?.end?.offset != null) {
            const start = byteToCharOffset(content, pos.start.offset);
            const end = byteToCharOffset(content, pos.end.offset);
            const leading = raw.match(/^\s*/)?.[0] ?? '';
            const trailing = raw.match(/\s*$/)?.[0] ?? '';
            const escaped = text
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n');
            s.overwrite(start, end, `${leading}{_t("${escaped}")}${trailing}`);
            hasTransformed = true;
          }
        }
      }
    }

    // Elements / Components
    let currentEl = parentEl;
    if (type && TAG_NODES.has(type)) {
      currentEl = (node.name as string) || parentEl;

      // Quoted attributes
      const attrs = node.attributes as Array<Record<string, unknown>> | undefined;
      if (attrs) {
        for (const attr of attrs) {
          if (attr.kind === 'quoted' && typeof attr.value === 'string') {
            const val = attr.value as string;
            if (val.trim()) {
              const ctx: StringContext = {
                scope: 'attribute',
                element: currentEl,
                attribute: attr.name as string,
              };
              if (classifyString(val, ctx) === 'message') {
                const pos = attr.position;
                if (pos?.start?.offset != null && pos?.end?.offset != null) {
                  const attrStart = byteToCharOffset(content, pos.start.offset);
                  const attrEnd = byteToCharOffset(content, pos.end.offset);
                  const attrText = content.slice(attrStart, attrEnd);
                  const eqIdx = attrText.indexOf('=');
                  if (eqIdx >= 0) {
                    const valueStart = attrStart + eqIdx + 1;
                    const escaped = val
                      .replace(/\\/g, '\\\\')
                      .replace(/"/g, '\\"')
                      .replace(/\n/g, '\\n');
                    s.overwrite(valueStart, attrEnd, `{_t("${escaped}")}`);
                    hasTransformed = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Recurse — but skip expression nodes (their children are JS code, not UI text)
    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (children && type !== 'expression') {
      for (const child of children) {
        walk(child, currentEl);
      }
    }
  }

  walk(ast, undefined);
  return hasTransformed;
}

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------

export function i18nTransformPlugin(): Plugin {
  return {
    name: 'astrowind-i18n',

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) return runtimeCode;
      return null;
    },

    async transform(code, id) {
      if (!id.endsWith('.astro')) return null;
      if (id.includes('node_modules')) return null;

      const trimmed = code.trim();
      const { ast } = await parse(trimmed);
      const s = new MagicString(trimmed);
      const hasTransform = transformTemplate(s, ast, trimmed);

      if (!hasTransform) return null;

      // Inject import at top of frontmatter
      const fmStart = trimmed.startsWith('---\n') ? 4 : 0;

      if (trimmed.startsWith('---\n')) {
        s.appendRight(fmStart, `${RUNTIME_IMPORT}\n`);
      } else {
        s.prepend(`---\n${RUNTIME_IMPORT}\n---\n`);
      }

      return { code: s.toString(), map: null };
    },
  };
}
