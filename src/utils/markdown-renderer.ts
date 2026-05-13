import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import yaml from 'js-yaml';
import type { Root, RootContent, PhrasingContent, Image, Parent } from 'mdast';
import type { Skeleton } from './markdown-extractor';
import { SENTINEL_PREFIX, parseSentinel } from './markdown-extractor';

/**
 * Render a skeleton with translated messages back to markdown.
 *
 * @param skeleton - The skeleton from extract()
 * @param resolveMessage - Function to resolve a message index to translated text
 * @returns Complete markdown string ready to write to disk
 */
export function render(skeleton: Skeleton, resolveMessage: (index: number) => string): string {
  // Deep clone the body to avoid mutating the original
  const body = JSON.parse(JSON.stringify(skeleton.body)) as Root;

  // Resolve sentinels in the body AST
  resolveNode(body, resolveMessage);

  // Stringify body to markdown
  const bodyMarkdown = unified()
    .use(remarkStringify, {
      bullet: '-',
      listItemIndent: 'one',
      emphasis: '*',
      strong: '*',
      fences: true,
      incrementListMarker: true,
    })
    .stringify(body);

  // Resolve sentinels in frontmatter
  const frontmatter = resolveFrontmatter(skeleton.frontmatter, resolveMessage);

  // Build frontmatter YAML
  const frontmatterYaml = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    quotingType: "'",
    forceQuotes: false,
  });

  // Combine: frontmatter + body
  const parts: string[] = [];
  if (Object.keys(frontmatter).length > 0) {
    parts.push('---');
    parts.push(frontmatterYaml.trimEnd());
    parts.push('---');
    parts.push('');
  }
  parts.push(bodyMarkdown);

  return parts.join('\n');
}

/**
 * Resolve sentinels in phrasing content (inline nodes).
 */
function resolvePhrasing(nodes: PhrasingContent[], resolveMessage: (index: number) => string): PhrasingContent[] {
  const resolved: PhrasingContent[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        // Check if the entire text is a single sentinel
        const index = parseSentinel(node.value);
        if (index !== null) {
          resolved.push({ type: 'text', value: resolveMessage(index) });
        } else if (node.value.includes(SENTINEL_PREFIX)) {
          // Mixed text with sentinels - replace inline
          const replaced = replaceSentinelsInText(node.value, resolveMessage);
          resolved.push({ type: 'text', value: replaced });
        } else {
          resolved.push(node);
        }
        break;
      }
      case 'emphasis':
        resolved.push({
          ...node,
          children: resolvePhrasing(node.children, resolveMessage) as PhrasingContent[],
        });
        break;
      case 'strong':
        resolved.push({
          ...node,
          children: resolvePhrasing(node.children, resolveMessage) as PhrasingContent[],
        });
        break;
      case 'link':
        resolved.push({
          ...node,
          children: resolvePhrasing(node.children, resolveMessage) as PhrasingContent[],
        });
        break;
      case 'image': {
        // Resolve alt text
        const imgIndex = parseSentinel(node.alt || '');
        if (imgIndex !== null) {
          resolved.push({ ...node, alt: resolveMessage(imgIndex) });
        } else {
          resolved.push(node);
        }
        break;
      }
      case 'delete':
        resolved.push({
          ...node,
          children: resolvePhrasing(node.children, resolveMessage) as PhrasingContent[],
        });
        break;
      default:
        resolved.push(node);
        break;
    }
  }

  return resolved;
}

/**
 * Replace sentinel patterns in a text string.
 */
function replaceSentinelsInText(text: string, resolveMessage: (index: number) => string): string {
  return text.replace(/__W_MSG_(\d+)__/g, (_match, indexStr) => {
    return resolveMessage(Number(indexStr));
  });
}

/**
 * Resolve sentinels throughout the MDAST tree.
 */
function resolveNode(node: Parent, resolveMessage: (index: number) => string): void {
  if (!('children' in node)) return;

  const resolvedChildren: RootContent[] = [];

  for (const child of node.children as RootContent[]) {
    switch (child.type) {
      case 'paragraph':
      case 'heading':
      case 'tableCell':
        child.children = resolvePhrasing(child.children as PhrasingContent[], resolveMessage) as typeof child.children;
        resolvedChildren.push(child);
        break;
      case 'listItem':
        resolveNode(child as unknown as Parent, resolveMessage);
        resolvedChildren.push(child);
        break;
      case 'blockquote':
        resolveNode(child as unknown as Parent, resolveMessage);
        resolvedChildren.push(child);
        break;
      case 'list':
      case 'table':
      case 'tableRow':
        resolveNode(child as unknown as Parent, resolveMessage);
        resolvedChildren.push(child);
        break;
      case 'image': {
        const imgIndex = parseSentinel((child as Image).alt || '');
        if (imgIndex !== null) {
          (child as Image).alt = resolveMessage(imgIndex);
        }
        resolvedChildren.push(child);
        break;
      }
      default:
        // Code, HTML, thematicBreak, etc. - pass through
        resolvedChildren.push(child);
        break;
    }
  }

  (node as unknown as Record<string, unknown>).children = resolvedChildren;
}

/**
 * Resolve sentinels in frontmatter values.
 */
function resolveFrontmatter(
  frontmatter: Skeleton['frontmatter'],
  resolveMessage: (index: number) => string
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'string') {
      const index = parseSentinel(value);
      if (index !== null) {
        resolved[key] = resolveMessage(index);
      } else if (value.includes(SENTINEL_PREFIX)) {
        resolved[key] = replaceSentinelsInText(value, resolveMessage);
      } else {
        resolved[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveFrontmatter(value as Skeleton['frontmatter'], resolveMessage);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}
