import { unified } from 'unified';
import remarkParse from 'remark-parse';
import yaml from 'js-yaml';
import type { Root, RootContent, PhrasingContent, Parent, Image, Text } from 'mdast';

export interface Message {
  index: number;
  text: string;
  context: string; // e.g. "frontmatter:title" or "body:paragraph:2"
}

export interface Skeleton {
  frontmatter: Record<string, string | number | boolean | Date | null | Record<string, unknown> | unknown[]>;
  body: Root;
}

// Sentinel pattern: __W_MSG_<n>__
export const SENTINEL_PREFIX = '__W_MSG_';
const SENTINEL_SUFFIX = '__';

function makeSentinel(index: number): string {
  return `${SENTINEL_PREFIX}${index}${SENTINEL_SUFFIX}`;
}

export function parseSentinel(text: string): number | null {
  const match = text.match(/^__W_MSG_(\d+)__$/);
  return match ? Number(match[1]) : null;
}

/** Normalize extracted text: collapse whitespace to single spaces, trim. */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Serialize phrasing content to a plain text string.
 * Preserves inline formatting as literal markdown.
 * Link URLs are NOT included — only link text is extracted.
 * Inline code is preserved as-is (not translatable).
 */
function serializePhrasing(nodes: PhrasingContent[]): string {
  let result = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.value;
        break;
      case 'emphasis':
        result += `*${serializePhrasing(node.children)}*`;
        break;
      case 'strong':
        result += `**${serializePhrasing(node.children)}**`;
        break;
      case 'inlineCode':
        // Inline code is not translated - keep as-is
        result += `\`${node.value}\``;
        break;
      case 'link':
        // Only extract link text, NOT the URL
        result += serializePhrasing(node.children);
        break;
      case 'image':
        // Images handled separately (alt text extracted in walkNode)
        result += node.alt || '';
        break;
      case 'break':
        result += '  \n';
        break;
      case 'delete':
        result += `~~${serializePhrasing(node.children)}~~`;
        break;
      default: {
        const nodeRecord = node as unknown as Record<string, unknown>;
        if ('value' in nodeRecord && typeof nodeRecord.value === 'string') {
          result += nodeRecord.value;
        } else if ('children' in nodeRecord && Array.isArray(nodeRecord.children)) {
          result += serializePhrasing(nodeRecord.children as PhrasingContent[]);
        }
        break;
      }
    }
  }
  return result;
}

/**
 * Serialize a block-level node's text content for extraction.
 * Only extracts the text/inline portion, not structural markdown.
 */
function serializeBlockText(node: RootContent): string | null {
  switch (node.type) {
    case 'paragraph':
      return serializePhrasing(node.children);
    case 'heading': {
      // Strip heading anchor {#id} from the text
      const text = serializePhrasing(node.children);
      return text.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, '');
    }
    case 'listItem': {
      // listItem can contain paragraphs and nested lists
      // We extract text from direct paragraph children
      if (node.children.length === 1 && node.children[0].type === 'paragraph') {
        const para = node.children[0];
        // Skip list items that are entirely a single link (e.g., TOC entries)
        // These are structural, not translatable content
        if (para.children.length === 1 && para.children[0].type === 'link') {
          return null;
        }
        return serializePhrasing(para.children);
      }
      // For complex list items (with nested lists), only extract first paragraph
      const firstPara = node.children.find((c) => c.type === 'paragraph');
      if (firstPara && firstPara.type === 'paragraph') {
        // Skip if the paragraph is entirely a single link
        if (firstPara.children.length === 1 && firstPara.children[0].type === 'link') {
          return null;
        }
        return serializePhrasing(firstPara.children);
      }
      return null;
    }
    case 'blockquote': {
      const texts: string[] = [];
      for (const child of node.children) {
        if (child.type === 'paragraph') {
          texts.push(serializePhrasing(child.children));
        }
      }
      return texts.length > 0 ? texts.join('\n\n') : null;
    }
    case 'tableRow':
      // Table rows contain cells — handled at cell level
      return null;
    case 'tableCell':
      return serializePhrasing(node.children);
    default:
      return null;
  }
}

/**
 * Parse markdown source into frontmatter and MDAST body.
 */
function parseMarkdown(source: string): {
  frontmatter: Record<string, string | number | boolean | Date | null | Record<string, unknown> | unknown[]>;
  body: Root;
} {
  let frontmatter: Skeleton['frontmatter'] = {};
  let bodySource = source;

  const trimmed = source.trimStart();
  if (trimmed.startsWith('---')) {
    const secondDelimiter = trimmed.indexOf('---', 3);
    if (secondDelimiter !== -1) {
      const yamlSource = trimmed.substring(3, secondDelimiter).trim();
      const loaded = yaml.load(yamlSource);
      frontmatter = (typeof loaded === 'object' && loaded !== null ? loaded : {}) as Skeleton['frontmatter'];
      bodySource = trimmed.substring(secondDelimiter + 3).trimStart();
    }
  }

  // Parse body with remark
  const tree = unified().use(remarkParse).parse(bodySource) as Root;

  return { frontmatter, body: tree };
}

/**
 * Deep clone a frontmatter value, preserving Date objects.
 * JSON.parse(JSON.stringify()) converts Dates to strings, breaking
 * content collection schemas that expect z.date().
 */
function cloneFrontmatter(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(cloneFrontmatter);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const cloned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      cloned[k] = cloneFrontmatter(v);
    }
    return cloned;
  }
  return value;
}

/**
 * Check if a list item contains only a single link (e.g., TOC entries).
 */
function isLinkOnlyListItem(node: RootContent): boolean {
  if (node.type !== 'listItem') return false;
  const para = node.children.find((c) => c.type === 'paragraph');
  if (!para || para.type !== 'paragraph') return false;
  return para.children.length === 1 && para.children[0].type === 'link';
}

/**
 * Extract translatable strings from a markdown file.
 *
 * @param source - Raw markdown string
 * @param filename - Source filename for context
 * @param translatableFrontmatterKeys - Frontmatter keys to extract (supports dot notation for nested)
 * @returns Messages array and skeleton for rendering
 */
export function extract(
  source: string,
  filename: string,
  translatableFrontmatterKeys: string[]
): { messages: Message[]; skeleton: Skeleton } {
  void filename; // reserved for future use in context strings
  const messages: Message[] = [];
  let messageIndex = 0;

  const { frontmatter, body } = parseMarkdown(source);

  // --- Extract from frontmatter ---
  // Deep clone preserving Date objects (JSON round-trip destroys them)
  const skeletonFrontmatter: Record<string, unknown> = cloneFrontmatter(frontmatter) as Record<string, unknown>;

  for (const key of translatableFrontmatterKeys) {
    const value = getNestedValue(frontmatter, key);
    if (typeof value === 'string' && value.trim()) {
      const index = messageIndex++;
      messages.push({
        index,
        text: normalizeText(value),
        context: `frontmatter:${key}`,
      });
      setNestedValue(skeletonFrontmatter, key, makeSentinel(index));
    }
  }

  // --- Extract from body AST ---

  const translatableBlocks = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'tableCell']);

  function walkNode(node: Parent, path: string[] = []): void {
    if (!('children' in node)) return;

    const childCounters: Record<string, number> = {};

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i] as RootContent;
      const childType = child.type;

      // Count nodes of this type for context
      childCounters[childType] = (childCounters[childType] || 0) + 1;
      const count = childCounters[childType];

      // Skip code blocks and HTML — never extract
      if (childType === 'code' || childType === 'html' || childType === 'yaml') {
        continue;
      }

      if (childType === 'image') {
        const imageNode = child as Image;
        if (imageNode.alt && imageNode.alt.trim()) {
          const index = messageIndex++;
          messages.push({
            index,
            text: normalizeText(imageNode.alt),
            context: `body:image:${count}`,
          });
          (child as Image).alt = makeSentinel(index);
        }
        continue;
      }

      // Skip list items that are entirely a single link (e.g., TOC entries)
      if (childType === 'listItem' && isLinkOnlyListItem(child)) {
        continue;
      }

      if (translatableBlocks.has(childType) && 'children' in child) {
        const text = normalizeText(serializeBlockText(child as RootContent) || '');
        if (text) {
          const index = messageIndex++;
          const contextPath = [...path, `${childType}:${count}`].join(':');
          messages.push({
            index,
            text,
            context: `body:${contextPath}`,
          });
          replaceBlockText(child as RootContent, makeSentinel(index));
          continue;
        }
      }

      // Recurse into container nodes
      if ('children' in child) {
        walkNode(child as Parent, [...path, `${childType}:${count}`]);
      }
    }
  }

  walkNode(body);

  return {
    messages,
    skeleton: {
      frontmatter: skeletonFrontmatter as Skeleton['frontmatter'],
      body,
    },
  };
}

/**
 * Replace the text content of a block node with a sentinel string.
 * The translated text (which includes inline formatting as literal markdown)
 * will be substituted back by the renderer.
 */
function replaceBlockText(node: RootContent, sentinel: string): void {
  const textNode: Text = { type: 'text', value: sentinel };

  switch (node.type) {
    case 'paragraph':
      node.children = [textNode];
      break;
    case 'heading':
      node.children = [textNode];
      break;
    case 'listItem': {
      const para = node.children.find((c) => c.type === 'paragraph');
      if (para && para.type === 'paragraph') {
        para.children = [textNode];
      }
      break;
    }
    case 'blockquote':
      node.children = [{ type: 'paragraph', children: [textNode] }];
      break;
    case 'tableCell':
      node.children = [textNode];
      break;
  }
}

/**
 * Get a nested value from an object using dot notation.
 * e.g., getNestedValue(obj, 'seo.title') => obj.seo.title
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | number | boolean | null | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as string | number | boolean | null | undefined;
}

/**
 * Set a nested value in an object using dot notation.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
