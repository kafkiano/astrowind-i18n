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
  frontmatter: Record<string, string | number | boolean | null | Record<string, unknown>>;
  body: Root;
}

// Sentinel pattern: __W_MSG_<n>__
const SENTINEL_RE = /__W_MSG_(\d+)__/g;
export const SENTINEL_PREFIX = '__W_MSG_';
export const SENTINEL_SUFFIX = '__';

export function makeSentinel(index: number): string {
  return `${SENTINEL_PREFIX}${index}${SENTINEL_SUFFIX}`;
}

export function parseSentinel(text: string): number | null {
  const match = text.match(/^__W_MSG_(\d+)__$/);
  return match ? Number(match[1]) : null;
}

export function hasSentinel(text: string): boolean {
  return SENTINEL_RE.test(text);
}

/**
 * Extract all sentinel indices from a string.
 */
export function extractSentinelIndices(text: string): number[] {
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  const re = /__W_MSG_(\d+)__/g;
  while ((match = re.exec(text)) !== null) {
    indices.push(Number(match[1]));
  }
  return indices;
}

/**
 * Serialize phrasing content for extraction.
 * Only extracts translatable text, preserving inline formatting as literal markdown.
 * Link URLs are NOT included - only link text is extracted.
 * Inline code is preserved as-is (not translatable).
 */
function serializePhrasingForExtraction(nodes: PhrasingContent[]): string {
  let result = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.value;
        break;
      case 'emphasis':
        result += `*${serializePhrasingForExtraction(node.children)}*`;
        break;
      case 'strong':
        result += `**${serializePhrasingForExtraction(node.children)}**`;
        break;
      case 'inlineCode':
        // Inline code is not translated - keep as-is
        result += `\`${node.value}\``;
        break;
      case 'link':
        // Only extract link text, NOT the URL
        result += serializePhrasingForExtraction(node.children);
        break;
      case 'image':
        // Images handled separately (alt text extracted in walkNode)
        result += node.alt || '';
        break;
      case 'break':
        result += '  \n';
        break;
      case 'delete':
        result += `~~${serializePhrasingForExtraction(node.children)}~~`;
        break;
      default: {
        const nodeRecord = node as unknown as Record<string, unknown>;
        if ('value' in nodeRecord && typeof nodeRecord.value === 'string') {
          result += nodeRecord.value;
        } else if ('children' in nodeRecord && Array.isArray(nodeRecord.children)) {
          result += serializePhrasingForExtraction(nodeRecord.children as PhrasingContent[]);
        }
        break;
      }
    }
  }
  return result;
}

/**
 * Serialize phrasing content (inline nodes) to a markdown string.
 * This preserves inline formatting as literal markdown INCLUDING link URLs.
 * Used for rendering, not extraction.
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
        result += `\`${node.value}\``;
        break;
      case 'link':
        result += `[${serializePhrasing(node.children)}](${node.url}${node.title ? ` "${node.title}"` : ''})`;
        break;
      case 'image':
        result += `![${node.alt || ''}](${node.url}${node.title ? ` "${node.title}"` : ''})`;
        break;
      case 'break':
        result += '  \n';
        break;
      case 'delete':
        result += `~~${serializePhrasing(node.children)}~~`;
        break;
      default: {
        // For any unknown inline node, try to serialize its value or children
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
 * Serialize a block-level node's text content to markdown.
 * Only extracts the text/inline portion, not structural markdown.
 * Uses serializePhrasingForExtraction to exclude link URLs from extracted text.
 */
function serializeBlockText(node: RootContent): string | null {
  switch (node.type) {
    case 'paragraph':
      return serializePhrasingForExtraction(node.children);
    case 'heading': {
      // Strip heading anchor {#id} from the text
      const text = serializePhrasingForExtraction(node.children);
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
        return serializePhrasingForExtraction(para.children);
      }
      // For complex list items (with nested lists), only extract first paragraph
      const firstPara = node.children.find((c) => c.type === 'paragraph');
      if (firstPara && firstPara.type === 'paragraph') {
        // Skip if the paragraph is entirely a single link
        if (firstPara.children.length === 1 && firstPara.children[0].type === 'link') {
          return null;
        }
        return serializePhrasingForExtraction(firstPara.children);
      }
      return null;
    }
    case 'blockquote': {
      // blockquote contains block children, we recursively handle
      // For now, extract text from direct paragraph children
      const texts: string[] = [];
      for (const child of node.children) {
        if (child.type === 'paragraph') {
          texts.push(serializePhrasingForExtraction(child.children));
        }
      }
      return texts.length > 0 ? texts.join('\n\n') : null;
    }
    case 'tableRow':
      // Table rows contain cells
      // We don't extract from tableRow directly; handled at cell level
      return null;
    case 'tableCell':
      return serializePhrasingForExtraction(node.children);
    default:
      return null;
  }
}

/**
 * Check if a node type is a translatable block type.
 */
function isTranslatableBlock(type: string): boolean {
  return ['paragraph', 'heading', 'listItem', 'blockquote', 'tableCell'].includes(type);
}

/**
 * Parse markdown source into frontmatter and MDAST body.
 */
function parseMarkdown(source: string): {
  frontmatter: Record<string, string | number | boolean | null | Record<string, unknown>>;
  body: Root;
} {
  // Split frontmatter from body
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
 * Walk phrasing content (inline nodes) and extract link text as separate messages.
 * Keeps the link structure in the skeleton, only replacing the link text with sentinels.
 * Returns the modified phrasing content array.
 */
function extractPhrasingLinks(
  nodes: PhrasingContent[],
  messages: Message[],
  messageIndexRef: { value: number },
  context: string
): PhrasingContent[] {
  const result: PhrasingContent[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'link': {
        // Extract link text as a separate message
        const linkText = serializePhrasingForExtraction(node.children);
        if (linkText && linkText.trim()) {
          const index = messageIndexRef.value++;
          messages.push({
            index,
            text: linkText,
            context: `${context}:link`,
          });
          // Keep link structure, replace text with sentinel
          result.push({
            ...node,
            children: [{ type: 'text', value: makeSentinel(index) }],
          });
        } else {
          result.push(node);
        }
        break;
      }
      case 'emphasis':
        result.push({ ...node, children: extractPhrasingLinks(node.children, messages, messageIndexRef, `${context}:em`) });
        break;
      case 'strong':
        result.push({ ...node, children: extractPhrasingLinks(node.children, messages, messageIndexRef, `${context}:strong`) });
        break;
      case 'delete':
        result.push({ ...node, children: extractPhrasingLinks(node.children, messages, messageIndexRef, `${context}:del`) });
        break;
      default:
        result.push(node);
        break;
    }
  }

  return result;
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
  const skeletonFrontmatter: Record<string, unknown> = JSON.parse(JSON.stringify(frontmatter));

  for (const key of translatableFrontmatterKeys) {
    const value = getNestedValue(frontmatter, key);
    if (typeof value === 'string' && value.trim()) {
      const index = messageIndex++;
      messages.push({
        index,
        text: value,
        context: `frontmatter:${key}`,
      });
      setNestedValue(skeletonFrontmatter, key, makeSentinel(index));
    }
  }

  // --- Extract from body AST ---
  // Walk the tree depth-first, extracting text from translatable nodes
  function walkNode(node: Parent, path: string[] = []): void {
    if (!('children' in node)) return;

    const childCounters: Record<string, number> = {};

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i] as RootContent;
      const childType = child.type;

      // Count nodes of this type for context
      childCounters[childType] = (childCounters[childType] || 0) + 1;
      const count = childCounters[childType];

      // Skip code blocks and HTML - never extract
      if (childType === 'code' || childType === 'html' || childType === 'yaml') {
        continue;
      }

      if (childType === 'image') {
        // Extract alt text from images
        const imageNode = child as Image;
        if (imageNode.alt && imageNode.alt.trim()) {
          const index = messageIndex++;
          messages.push({
            index,
            text: imageNode.alt,
            context: `body:image:${count}`,
          });
          // Replace alt with sentinel
          (child as Image).alt = makeSentinel(index);
        }
        continue;
      }

      // Special handling for list items that are entirely a single link (e.g., TOC entries)
      // Don't extract these - preserve the original link structure
      // The link text won't be translated, but the links will work correctly
      if (childType === 'listItem' && isLinkOnlyListItem(child)) {
        // Don't recurse - preserve the list item as-is
        continue;
      }

      if (isTranslatableBlock(childType) && 'children' in child) {
        const text = serializeBlockText(child as RootContent);
        if (text && text.trim()) {
          const index = messageIndex++;
          const contextPath = [...path, `${childType}:${count}`].join(':');
          messages.push({
            index,
            text,
            context: `body:${contextPath}`,
          });

          // Replace text content with sentinel
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
 * Replaces the entire block's children with a single text node.
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
      // Replace first paragraph's children
      const para = node.children.find((c) => c.type === 'paragraph');
      if (para && para.type === 'paragraph') {
        para.children = [textNode];
      }
      break;
    }
    case 'blockquote':
      // Replace with single paragraph containing sentinel
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
