// Serialize the transformed subtree into clean, readable plain text — the
// clipboard flavor chat apps (WeChat, Slack, iMessage) pick up. No markdown
// syntax survives: headings become bare lines, lists get bullets, tables
// become "a | b | c" rows.

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre',
  'blockquote', 'table', 'hr', 'div', 'section', 'figure', 'details',
]);

export function toPlainText(root: HTMLElement): string {
  const out = blockChildren(root, 0);
  return `${out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function blockChildren(el: Element, listDepth: number): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.trim()) out += text;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    out += blockText(node as Element, listDepth);
  }
  return out;
}

function blockText(el: Element, listDepth: number): string {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n${inlineText(el).trim()}\n\n`;
    case 'p': {
      const text = inlineText(el).trim();
      return text ? `${text}\n\n` : '';
    }
    case 'ul':
    case 'ol':
      return `${listText(el, listDepth)}${listDepth === 0 ? '\n' : ''}`;
    case 'pre': {
      const text = (el.textContent ?? '').replace(/\n+$/, '');
      return text.trim() ? `${text}\n\n` : '';
    }
    case 'blockquote': {
      const inner = blockChildren(el, listDepth).trim();
      if (!inner) return '';
      const quoted = inner.split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n');
      return `${quoted}\n\n`;
    }
    case 'table':
      return `${tableText(el)}\n`;
    case 'hr':
      return '———\n\n';
    case 'br':
      return '\n';
    case 'img':
      return `${imageText(el)}\n\n`;
    default:
      if (BLOCK_TAGS.has(tag)) {
        // Callout titles read better marked, and must not run into the body.
        if (el.classList.contains('callout-title')) {
          const title = inlineText(el).trim();
          return title ? `【${title}】\n` : '';
        }
        // A container whose content ended inline (e.g. a div wrapping an
        // image or bare text) still needs to terminate its line.
        const out = blockChildren(el, listDepth);
        return out && !out.endsWith('\n') ? `${out}\n` : out;
      }
      return inlineText(el);
  }
}

function listText(list: Element, depth: number): string {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const start = parseInt(list.getAttribute('start') ?? '1', 10) || 1;
  let index = start;
  let out = '';

  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;

    let own = '';
    const nested: Element[] = [];
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTag = (child as Element).tagName.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          nested.push(child as Element);
          continue;
        }
        own += blockText(child as Element, depth + 1);
      } else if (child.nodeType === Node.TEXT_NODE) {
        own += (child.textContent ?? '').replace(/\s+/g, ' ');
      }
    }

    const text = own.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const indent = '  '.repeat(depth);
    // Task items already start with a ☑/☐ glyph; don't double up with a bullet.
    const isTask = /^[☑☐]/.test(text);
    const bullet = isTask ? '' : ordered ? `${index}. ` : '• ';
    if (text) out += `${indent}${bullet}${text}\n`;
    for (const sub of nested) {
      out += listText(sub, depth + 1);
    }
    index += 1;
  }

  return out;
}

function tableText(table: Element): string {
  let out = '';
  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('th, td')).map((c) =>
      inlineText(c).replace(/\s+/g, ' ').trim(),
    );
    if (cells.some((c) => c)) out += `${cells.join(' | ')}\n`;
  }
  return out;
}

// Inline form; block-level callers add their own line breaks.
function imageText(el: Element): string {
  const alt = el.getAttribute('alt');
  if (alt === 'diagram' || alt === 'chart') return '[diagram]';
  if (alt === 'formula') return '[formula]';
  return `[image${alt ? `: ${alt}` : ''}]`;
}

function inlineText(el: Element): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replace(/\s+/g, ' ');
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    const tag = child.tagName.toLowerCase();
    if (tag === 'br') {
      out += '\n';
    } else if (tag === 'img') {
      out += imageText(child);
    } else if (tag === 'a') {
      const href = child.getAttribute('href') ?? '';
      const text = inlineText(child).trim();
      if (/^https?:/i.test(href) && text && text !== href && !href.startsWith(text)) {
        out += `${text} (${href})`;
      } else {
        out += text || href;
      }
    } else if (BLOCK_TAGS.has(tag)) {
      out += blockText(child, 0);
    } else {
      out += inlineText(child);
    }
  }
  return out;
}
