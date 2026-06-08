/**
 * Extract translatable strings from .astro files.
 *
 * Parses frontmatter with acorn and template with @astrojs/compiler,
 * applies heuristic to identify translatable strings.
 */

import { parse } from '@astrojs/compiler';
import { Parser } from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import type { StringContext } from './heuristic';
import { classifyString } from './heuristic';

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
// Script parser (frontmatter)
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

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

function extractScriptStrings(code: string, file: string): ExtractedString[] {
  const results: ExtractedString[] = [];
  const seen = new Set<string>();

  let ast: ReturnType<typeof scriptParser.parse>;
  try {
    ast = scriptParser.parse(code, SCRIPT_OPTIONS) as ReturnType<typeof scriptParser.parse>;
  } catch {
    return results;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any, declaring?: string) {
    if (!node || typeof node !== 'object') return;

    // String literals
    if (node.type === 'Literal' && typeof node.value === 'string') {
      const str: string = node.value;
      if (str.length > 0) {
        const ctx: StringContext = { scope: 'script', declaring };
        if (classifyString(str, ctx) === 'message') {
          const key = `${str}::${file}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ msgid: str, file, scope: 'script' });
          }
        }
      }
    }

    // Template literals — static parts
    if (node.type === 'TemplateLiteral' && Array.isArray(node.quasis)) {
      for (const q of node.quasis) {
        const str: string = q.value?.cooked?.trim() ?? '';
        if (str.length > 0) {
          const ctx: StringContext = { scope: 'script', declaring };
          if (classifyString(str, ctx) === 'message') {
            const key = `${str}::${file}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ msgid: str, file, scope: 'script' });
            }
          }
        }
      }
    }

    // Track declaring context
    let childDeclaring = declaring;
    if (node.type === 'VariableDeclaration') childDeclaring = 'variable';
    else if (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression')
      childDeclaring = 'function';

    // Recurse
    for (const key of Object.keys(node)) {
      if (['type', 'start', 'end', 'loc', 'range', 'leadingComments', 'trailingComments'].includes(key)) continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const item of val) walk(item, childDeclaring);
      } else if (typeof val === 'object' && val !== null) {
        walk(val, childDeclaring);
      }
    }
  }

  walk(ast, undefined);
  return results;
}

// ---------------------------------------------------------------------------
// Template extraction
// ---------------------------------------------------------------------------

const TAG_NODES = new Set(['element', 'component', 'custom-element']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTemplateStrings(ast: any, _content: string, file: string): ExtractedString[] {
  const results: ExtractedString[] = [];
  const seen = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any, parentEl?: string) {
    if (!node || typeof node !== 'object') return;

    const type = node.type as string | undefined;

    // Text nodes
    if (type === 'text') {
      const text = (node.value as string)?.replace(/\s+/g, ' ').trim();
      if (text && text.length > 0) {
        const ctx: StringContext = { scope: 'markup', element: parentEl };
        if (classifyString(text, ctx) === 'message') {
          const key = `${text}::${file}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ msgid: text, file, scope: 'markup', element: parentEl });
          }
        }
      }
    }

    // Element / Component → track name, check attributes
    let currentEl = parentEl;
    if (type && TAG_NODES.has(type)) {
      currentEl = (node.name as string) || parentEl;

      const attrs = node.attributes as Array<Record<string, unknown>> | undefined;
      if (attrs) {
        for (const attr of attrs) {
          if (attr.kind === 'quoted' && typeof attr.value === 'string') {
            const val = (attr.value as string).replace(/\s+/g, ' ').trim();
            if (val.trim()) {
              const ctx: StringContext = {
                scope: 'attribute',
                element: currentEl,
                attribute: attr.name as string,
              };
              if (classifyString(val, ctx) === 'message') {
                const key = `${val}::${file}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push({
                    msgid: val,
                    file,
                    scope: 'attribute',
                    element: ctx.element,
                    attribute: ctx.attribute,
                  });
                }
              }
            }
          }

          // Expression props: parse JS value with acorn, extract string literals
          if (attr.kind === 'expression' && typeof attr.value === 'string') {
            const exprCode = `const __x = ${attr.value}`;
            try {
              const jsAst = scriptParser.parse(exprCode, SCRIPT_OPTIONS) as ReturnType<typeof scriptParser.parse>;
              const exprSeen = new Set<string>();

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              function walkJs(node: any): void {
                if (!node || typeof node !== 'object') return;

                // String literals
                if (node.type === 'Literal' && typeof node.value === 'string' && node.value.length > 0) {
                  const str = node.value;
                  const ctx: StringContext = {
                    scope: 'expression',
                    element: currentEl,
                    attribute: attr.name as string,
                  };
                  if (classifyString(str, ctx) === 'message') {
                    const key = `${str}::${file}`;
                    if (!seen.has(key) && !exprSeen.has(key)) {
                      exprSeen.add(key);
                      results.push({
                        msgid: str,
                        file,
                        scope: 'expression',
                        element: ctx.element,
                        attribute: ctx.attribute,
                      });
                    }
                  }
                }

                // Template literal static parts (quasis)
                if (node.type === 'TemplateLiteral' && Array.isArray(node.quasis)) {
                  for (const q of node.quasis) {
                    const str: string = q.value?.cooked?.trim() ?? '';
                    if (str.length > 0) {
                      const ctx: StringContext = {
                        scope: 'expression',
                        element: currentEl,
                        attribute: attr.name as string,
                      };
                      if (classifyString(str, ctx) === 'message') {
                        const key = `${str}::${file}`;
                        if (!seen.has(key) && !exprSeen.has(key)) {
                          exprSeen.add(key);
                          results.push({
                            msgid: str,
                            file,
                            scope: 'expression',
                            element: ctx.element,
                            attribute: ctx.attribute,
                          });
                        }
                      }
                    }
                  }
                }

                // Recurse
                for (const key of Object.keys(node)) {
                  if (['type', 'start', 'end', 'loc', 'range', 'leadingComments', 'trailingComments'].includes(key)) continue;
                  const val = node[key];
                  if (Array.isArray(val)) {
                    for (const item of val) walkJs(item);
                  } else if (typeof val === 'object' && val !== null) {
                    walkJs(val);
                  }
                }
              }

              walkJs(jsAst);
            } catch {
              // Malformed expression — skip silently
            }
          }
        }
      }
    }

    // Recurse into children — skip expression nodes (JS code, not UI text)
    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (children && type !== 'expression') {
      for (const child of children) {
        walk(child, currentEl);
      }
    }
  }

  walk(ast, undefined);
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
  const templateStrings = extractTemplateStrings(ast, content, file);
  const scriptStrings = extractScriptStrings(frontmatterCode, file);

  return [...scriptStrings, ...templateStrings];
}
