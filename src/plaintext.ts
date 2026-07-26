// Serialize the transformed subtree into clean, readable plain text — the
// clipboard flavor chat apps (WeChat, Slack, iMessage) pick up. No markdown
// syntax survives; structure is redrawn with chat-friendly glyphs instead:
// 【h1】/ ■ h2 / ▍h3 / ・h4+, 「bold/highlight」, ①②③ ordered items,
// ▏ quote bars, ※ callout titles, full-width indents for nesting. Chat
// renders in proportional fonts, so hierarchy must live in glyphs, not
// spacing or font weight. Every glyph is user-configurable via settings.

export interface PlainTextMarkers {
  /** [prefix, suffix] pairs; two empty strings mean unmarked. */
  h1: [string, string];
  h2: [string, string];
  h3: [string, string];
  /** Shared by h4–h6. */
  h4: [string, string];
  /** Wraps <strong>/<b>/<mark>; italics stay unmarked by design. */
  emphasis: [string, string];
  calloutTitle: [string, string];
  /** Per-line quote prefix, spacing included; trimmed on blank lines. */
  quoteBar: string;
  /** Per-line prefix for callout bodies; empty leaves them flush. */
  calloutBodyBar: string;
  divider: string;
  /** ①②③ when true, "1. 2. 3." when false. */
  circledNumbers: boolean;
  /** One repetition per list nesting level. */
  indent: string;
}

export const CHAT_MARKERS: PlainTextMarkers = {
  h1: ['【', '】'],
  h2: ['■ ', ''],
  h3: ['▍', ''],
  h4: ['・', ''],
  emphasis: ['「', '」'],
  calloutTitle: ['※ ', ''],
  quoteBar: '▏ ',
  calloutBodyBar: '▏ ',
  divider: '————————',
  circledNumbers: true,
  indent: '　',
};

// The undecorated style: bare heading lines, markdown-ish "> " quotes. Half
// the audience pastes into terminals or plain-text email — keep it available.
export const MINIMAL_MARKERS: PlainTextMarkers = {
  h1: ['', ''],
  h2: ['', ''],
  h3: ['', ''],
  h4: ['', ''],
  emphasis: ['', ''],
  calloutTitle: ['【', '】'],
  quoteBar: '> ',
  calloutBodyBar: '',
  divider: '———',
  circledNumbers: false,
  indent: '  ',
};

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre',
  'blockquote', 'table', 'hr', 'div', 'section', 'figure', 'details',
]);

const EMPHASIS_TAGS = new Set(['strong', 'b', 'mark']);

export function toPlainText(root: HTMLElement, markers: PlainTextMarkers = CHAT_MARKERS): string {
  const out = blockChildren(root, 0, markers);
  return `${out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function wrapPair(pair: [string, string], text: string): string {
  return text ? `${pair[0]}${text}${pair[1]}` : '';
}

// Prefix every line of a multi-line block; blank lines get the bar alone.
function barLines(bar: string, text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `${bar}${line}` : bar.trimEnd()))
    .join('\n');
}

function blockChildren(el: Element, listDepth: number, m: PlainTextMarkers): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.trim()) out += text;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    out += blockText(node as Element, listDepth, m);
  }
  return out;
}

function blockText(el: Element, listDepth: number, m: PlainTextMarkers): string {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      // The heading marker already carries the emphasis; suppress 「」 inside.
      const text = inlineText(el, m, true).trim();
      if (!text) return '';
      const pair = tag === 'h1' ? m.h1 : tag === 'h2' ? m.h2 : tag === 'h3' ? m.h3 : m.h4;
      return `\n${wrapPair(pair, text)}\n\n`;
    }
    case 'p': {
      const text = inlineText(el, m).trim();
      return text ? `${text}\n\n` : '';
    }
    case 'ul':
    case 'ol':
      return `${listText(el, listDepth, m)}${listDepth === 0 ? '\n' : ''}`;
    case 'pre': {
      const text = (el.textContent ?? '').replace(/\n+$/, '');
      return text.trim() ? `${text}\n\n` : '';
    }
    case 'blockquote': {
      const inner = blockChildren(el, listDepth, m).trim();
      if (!inner) return '';
      return `${barLines(m.quoteBar, inner)}\n\n`;
    }
    case 'table':
      return `${tableText(el, m)}\n`;
    case 'hr':
      return `${m.divider}\n\n`;
    case 'br':
      return '\n';
    case 'img':
      return `${imageText(el)}\n\n`;
    default:
      // A bare emphasis element (e.g. <strong> directly under an <li>) reaches
      // here as the element itself, not as someone's inline child — wrap it.
      if (EMPHASIS_TAGS.has(tag)) {
        return wrapPair(m.emphasis, inlineText(el, m, true).trim());
      }
      if (BLOCK_TAGS.has(tag)) {
        // Callout titles read better marked, and must not run into the body.
        if (el.classList.contains('callout-title')) {
          const title = inlineText(el, m, true).trim();
          return title ? `${wrapPair(m.calloutTitle, title)}\n` : '';
        }
        // Callout bodies keep their boxed feel via quote bars under the title.
        if (el.classList.contains('callout-content') && m.calloutBodyBar) {
          const inner = blockChildren(el, listDepth, m).trim();
          if (!inner) return '';
          return `${barLines(m.calloutBodyBar, inner)}\n\n`;
        }
        // A container whose content ended inline (e.g. a div wrapping an
        // image or bare text) still needs to terminate its line.
        const out = blockChildren(el, listDepth, m);
        return out && !out.endsWith('\n') ? `${out}\n` : out;
      }
      return inlineText(el, m);
  }
}

function listText(list: Element, depth: number, m: PlainTextMarkers): string {
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
        own += blockText(child as Element, depth + 1, m);
      } else if (child.nodeType === Node.TEXT_NODE) {
        own += (child.textContent ?? '').replace(/\s+/g, ' ');
      }
    }

    const text = own.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const indent = m.indent.repeat(depth);
    // Task items already start with a ☑/☐ glyph; don't double up with a bullet.
    const isTask = /^[☑☐]/.test(text);
    const bullet = isTask ? '' : ordered ? `${numberGlyph(index, m.circledNumbers)} ` : '• ';
    if (text) out += `${indent}${bullet}${text}\n`;
    for (const sub of nested) {
      out += listText(sub, depth + 1, m);
    }
    index += 1;
  }

  return out;
}

const CIRCLED_DIGITS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
];

// Circled digits survive line wrapping unambiguously; past ⑳ fall back to "n."
function numberGlyph(n: number, circled: boolean): string {
  return circled && n >= 1 && n <= CIRCLED_DIGITS.length ? CIRCLED_DIGITS[n - 1] : `${n}.`;
}

function tableText(table: Element, m: PlainTextMarkers): string {
  let out = '';
  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('th, td')).map((c) =>
      inlineText(c, m).replace(/\s+/g, ' ').trim(),
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

function inlineText(el: Element, m: PlainTextMarkers, noEmphasis = false): string {
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
    } else if (EMPHASIS_TAGS.has(tag)) {
      // Suppress nesting (bold inside highlight) so text wraps only once.
      const text = inlineText(child, m, true).trim();
      if (text) out += noEmphasis ? text : wrapPair(m.emphasis, text);
    } else if (tag === 'a') {
      const href = child.getAttribute('href') ?? '';
      const text = inlineText(child, m).trim();
      if (/^https?:/i.test(href) && text && text !== href && !href.startsWith(text)) {
        out += `${text} (${href})`;
      } else {
        out += text || href;
      }
    } else if (BLOCK_TAGS.has(tag)) {
      out += blockText(child, 0, m);
    } else {
      out += inlineText(child, m, noEmphasis);
    }
  }
  return out;
}
