/**
 * Extract translatable strings from .astro files.
 *
 * Template: @astrojs/compiler's typed AST (RootNode), walked with the `is.*`
 * type guards. Frontmatter + expression props: acorn ESTree, walked with
 * estree-walker. Both ASTs are typed — no `any`.
 */

import { parse } from '@astrojs/compiler';
import { is } from '@astrojs/compiler/utils';
import { walk as walkEstree } from 'estree-walker';
import type { Node as EstreeNode } from 'estree';
import { Parser } from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import type { StringContext } from './heuristic';
import { classifyString, IGNORE_ELEMENTS } from './heuristic';

/** @astrojs/compiler's typed AST node (derived from the `is.*` guard inputs). */
type CompilerNode = Parameters<typeof is.text>[0];
/** The root node returned by `parse()` (derived from its return type). */
type CompilerRootNode = Awaited<ReturnType<typeof parse>>['ast'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedString {
  msgid: string;
  file: string;
  scope: 'markup' | 'attribute' | 'script' | 'expression';
  element?: string;
  attribute?: string;
}

// ---------------------------------------------------------------------------
// Acorn setup (frontmatter + expression props)
// ---------------------------------------------------------------------------

const scriptParser = Parser.extend(tsPlugin());

const SCRIPT_OPTIONS = {
  sourceType: 'module' as const,
  ecmaVersion: 'latest' as const,
  locations: true,
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowImportExportEverywhere: true,
};

/** Classify a candidate string; if translatable, dedup-push it into results. */
function pushIfTranslatable(
  str: string,
  ctx: StringContext,
  file: string,
  seen: Set<string>,
  results: ExtractedString[]
): void {
  if (!str) return;
  if (classifyString(str, ctx) !== 'message') return;
  const key = `${str}::${file}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({
    msgid: str,
    file,
    scope: ctx.scope as ExtractedString['scope'],
    element: ctx.element,
    attribute: ctx.attribute,
  });
}

/**
 * Walk an acorn/ESTree AST and extract translatable string literals
 * (Literal string values + TemplateLiteral quasis). Used for both .astro
 * frontmatter (scope: 'script') and expression-prop values (scope: 'expression').
 */
function walkEstreeLiterals(
  ast: ReturnType<typeof scriptParser.parse>,
  scope: 'script' | 'expression',
  file: string,
  seen: Set<string>,
  results: ExtractedString[]
): void {
  // acorn produces an ESTree-shaped AST; its Program type isn't structurally
  // identical to estree-walker's Node param, so bridge with a cast (acorn
  // guarantees the ESTree shape).
  walkEstree(ast as unknown as EstreeNode, {
    enter(node: EstreeNode) {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        // Literals are classified untrimmed (leading whitespace would fail the
        // first-char heuristic, matching prior behavior).
        pushIfTranslatable(node.value, { scope }, file, seen, results);
      } else if (node.type === 'TemplateLiteral') {
        for (const q of node.quasis) {
          pushIfTranslatable((q.value.cooked ?? '').trim(), { scope }, file, seen, results);
        }
      }
    },
  });
}

/** Extract string literals from .astro frontmatter (scope: 'script'). */
function extractScriptStrings(code: string, file: string): ExtractedString[] {
  let ast: ReturnType<typeof scriptParser.parse>;
  try {
    ast = scriptParser.parse(code, SCRIPT_OPTIONS);
  } catch {
    return [];
  }
  const results: ExtractedString[] = [];
  const seen = new Set<string>();
  walkEstreeLiterals(ast, 'script', file, seen, results);
  return results;
}

// ---------------------------------------------------------------------------
// Template extraction (@astrojs/compiler typed AST)
// ---------------------------------------------------------------------------

const INLINE_PHRASING_ELEMENTS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'dfn',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
]);

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Whether an element's children are all text or inline-phrasing elements. */
function isInlineOnly(node: CompilerNode): boolean {
  if (!is.element(node)) return true; // non-elements (text) are inline by default
  if (node.children.length === 0) return true;
  for (const child of node.children) {
    if (is.text(child)) continue;
    if (!is.element(child)) return false;
    const name = child.name.toLowerCase();
    if (!INLINE_PHRASING_ELEMENTS.has(name)) return false;
    if (IGNORE_ELEMENTS.has(name)) return false;
    if (!isInlineOnly(child)) return false;
  }
  return true;
}

/** Serialize a template node to the HTML string form used as a catalog key. */
function buildHtml(node: CompilerNode): string {
  if (is.text(node)) return node.value || '';
  if (!is.element(node)) return '';
  const name = node.name;
  let attrStr = '';
  for (const attr of node.attributes) {
    if (attr.kind === 'quoted') {
      attrStr += attr.raw ? ` ${attr.name}=${attr.raw}` : ` ${attr.name}="${attr.value ?? ''}"`;
    } else if (attr.kind === 'empty') {
      attrStr += ` ${attr.name}`;
    } else if (attr.kind === 'expression' && attr.value !== undefined) {
      attrStr += ` ${attr.name}={${attr.value}}`;
    } else if (attr.kind === 'spread') {
      attrStr += ` {...${attr.name}}`;
    }
    // 'shorthand' | 'template-literal': intentionally not serialized — preserves
    // the existing catalog-key format (handling them would change inline-merge keys).
  }
  if (VOID_ELEMENTS.has(name.toLowerCase())) return `<${name}${attrStr}>`;
  const childHtml = node.children.map(buildHtml).join('');
  return `<${name}${attrStr}>${childHtml}</${name}>`;
}

function getInnerHtml(node: CompilerNode): string {
  return is.element(node) ? node.children.map(buildHtml).join('') : '';
}

function getTextContent(node: CompilerNode): string {
  if (is.text(node)) return node.value || '';
  if (is.element(node)) return node.children.map(getTextContent).join('');
  return '';
}

/**
 * Walk the @astrojs/compiler template AST and extract translatable strings.
 *
 * Control-flow invariants (preserved from the prior implementation — these are
 * exactly the behaviors `any` was hiding):
 *  - text nodes → markup extraction (suppressed inside a merged inline element)
 *  - expression nodes → children are NOT recursed (raw expression source is JS,
 *    not UI text; recursing would extract variable names like `label`)
 *  - frontmatter/doctype/comment → no-op (ValueNodes, no children)
 *  - element/component/custom-element → handle attributes; inline-merge is
 *    ELEMENT-ONLY (components/custom-elements keep individual text children)
 */
function extractTemplateStrings(ast: CompilerRootNode, file: string): ExtractedString[] {
  const results: ExtractedString[] = [];
  const seen = new Set<string>();

  function walkNode(node: CompilerNode, parentEl: string | undefined, suppressMarkup: boolean): void {
    // Text node → markup extraction (unless suppressed)
    if (is.text(node)) {
      if (suppressMarkup) return;
      const text = node.value.replace(/\s+/g, ' ').trim();
      if (text) pushIfTranslatable(text, { scope: 'markup', element: parentEl }, file, seen, results);
      return;
    }

    // Expression node → do NOT recurse into children (raw expression source is code).
    if (is.expression(node)) return;

    // Value nodes with no children → no-op.
    if (is.frontmatter(node) || is.doctype(node) || is.comment(node)) return;

    // Element / component / custom-element → attributes + (element-only) inline-merge.
    if (is.element(node) || is.component(node) || is.customElement(node)) {
      const currentEl = node.name;

      for (const attr of node.attributes) {
        if (attr.kind === 'quoted' && typeof attr.value === 'string') {
          const val = attr.value.replace(/\s+/g, ' ').trim();
          if (val) {
            pushIfTranslatable(
              val,
              { scope: 'attribute', element: currentEl, attribute: attr.name },
              file,
              seen,
              results
            );
          }
        } else if (attr.kind === 'expression' && typeof attr.value === 'string') {
          // Expression prop: wrap in a declaration, acorn-parse, walk for literals.
          // Per-attribute try/catch preserves robustness against malformed expressions.
          try {
            const jsAst = scriptParser.parse(`const __x = ${attr.value}`, SCRIPT_OPTIONS);
            walkEstreeLiterals(jsAst, 'expression', file, seen, results);
          } catch {
            // Malformed expression — skip silently
          }
        }
      }

      // Inline-merge: ELEMENT ONLY (components/custom-elements keep individual text children).
      if (!suppressMarkup && is.element(node) && isInlineOnly(node)) {
        if (node.children.length > 0) {
          const innerHtml = getInnerHtml(node);
          const textContent = getTextContent(node).replace(/\s+/g, ' ').trim();
          // Classify the TEXT content, but key by the innerHTML — postprocess matches
          // the HTML structure, and classifyString would reject the inline tags.
          if (textContent && classifyString(textContent, { scope: 'markup', element: currentEl }) === 'message') {
            const key = `${innerHtml}::${file}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ msgid: innerHtml, file, scope: 'markup', element: currentEl });
            }
          }
        }
        // Recurse children with suppressMarkup=true to still extract their attrs/expression-props.
        for (const child of node.children) walkNode(child, currentEl, true);
        return;
      }

      for (const child of node.children) walkNode(child, currentEl, suppressMarkup);
      return;
    }

    // Root / fragment / other parent nodes → recurse children.
    if (is.parent(node)) {
      for (const child of node.children) walkNode(child, parentEl, suppressMarkup);
    }
  }

  walkNode(ast, undefined, false);
  return results;
}

// ---------------------------------------------------------------------------
// Config extraction (src/config.yaml)
// ---------------------------------------------------------------------------

/**
 * Config keys whose values are content-blind identifiers the heuristic cannot
 * reliably classify (API keys / UUIDs / verification IDs, arbitrary alphanumeric
 * IDs, multi-token CSS class lists). Small residue — most identifier patterns
 * (URLs, paths, icons, kebab enums, locale codes) are caught generically by
 * classifyString's config scope.
 */
const NON_TRANSLATABLE_CONFIG_KEYS = new Set([
  'apiKey',
  'geminiApiKey',
  'deeplApiKey',
  'googleSiteVerificationId',
  'id',
  'class',
  'classes',
  'style',
]);

/**
 * Extract translatable strings from the parsed `src/config.yaml` object.
 * Recursively walks nested mappings and sequences, skips known identifier keys,
 * and applies the same heuristic used for UI strings.
 */
export function extractFromConfig(config: Record<string, unknown>): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  function walk(value: unknown, key: string | undefined) {
    if (typeof value === 'string') {
      if (!key || NON_TRANSLATABLE_CONFIG_KEYS.has(key)) return;
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (!normalized) return;
      const ctx: StringContext = { scope: 'config' };
      if (classifyString(normalized, ctx) === 'message' && !seen.has(normalized)) {
        seen.add(normalized);
        results.push(normalized);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, key);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) walk(childValue, childKey);
    }
  }

  walk(config, undefined);
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractFromAstro(content: string, file: string): Promise<ExtractedString[]> {
  let frontmatterCode = '';
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) frontmatterCode = fmMatch[1];

  const { ast } = await parse(content.trim());
  const templateStrings = extractTemplateStrings(ast, file);
  const scriptStrings = extractScriptStrings(frontmatterCode, file);

  return [...scriptStrings, ...templateStrings];
}
