import { App, Platform, TFile, requestUrl } from 'obsidian';
import { domToPng } from 'modern-screenshot';
import { CopyForEmailSettings } from './settings';

// ---------------------------------------------------------------------------
// Fixed light palette. Mail clients render on a white background, so the
// copied HTML must NOT inherit the active Obsidian theme (a dark theme would
// produce light-on-white text). Diagrams are the one exception: they are
// rasterized against the app background so they always stay readable.
// ---------------------------------------------------------------------------
const TEXT = '#1f2328';
const MUTED = '#57606a';
const LINK = '#0969da';
const BORDER = '#d0d7de';
const SURFACE = '#f6f8fa';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";
const MONO_STACK = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export const BASE_TEXT_STYLE = `font-family: ${FONT_STACK}; font-size: 15px; color: ${TEXT}; line-height: 1.65;`;

// Every text-bearing element repeats the font styles: many clients unwrap or
// rewrite container elements on paste, so inheritance alone is not reliable.
const TAG_STYLES: Record<string, string> = {
  h1: `${BASE_TEXT_STYLE} font-size: 23px; font-weight: 600; line-height: 1.3; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid ${BORDER};`,
  h2: `${BASE_TEXT_STYLE} font-size: 19px; font-weight: 600; line-height: 1.3; margin: 18px 0 10px; padding-bottom: 5px; border-bottom: 1px solid ${BORDER};`,
  h3: `${BASE_TEXT_STYLE} font-size: 17px; font-weight: 600; line-height: 1.3; margin: 16px 0 8px;`,
  h4: `${BASE_TEXT_STYLE} font-size: 15px; font-weight: 600; line-height: 1.3; margin: 14px 0 8px;`,
  h5: `${BASE_TEXT_STYLE} font-size: 14px; font-weight: 600; line-height: 1.3; margin: 14px 0 8px;`,
  h6: `${BASE_TEXT_STYLE} font-size: 13px; font-weight: 600; line-height: 1.3; margin: 14px 0 8px; color: ${MUTED};`,
  p: `${BASE_TEXT_STYLE} margin: 0 0 12px;`,
  ul: `${BASE_TEXT_STYLE} margin: 0 0 12px; padding-left: 26px;`,
  ol: `${BASE_TEXT_STYLE} margin: 0 0 12px; padding-left: 26px;`,
  li: `${BASE_TEXT_STYLE} margin: 3px 0;`,
  blockquote: `${BASE_TEXT_STYLE} margin: 0 0 12px; padding: 2px 0 2px 14px; border-left: 3px solid ${BORDER}; color: ${MUTED};`,
  pre: `margin: 0 0 14px; padding: 12px 14px; background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 6px; font-family: ${MONO_STACK}; font-size: 13px; line-height: 1.55; color: ${TEXT}; white-space: pre-wrap; word-wrap: break-word;`,
  table: `${BASE_TEXT_STYLE} font-size: 14px; border-collapse: collapse; margin: 0 0 14px;`,
  th: `font-family: ${FONT_STACK}; font-size: 14px; color: ${TEXT}; line-height: 1.5; border: 1px solid ${BORDER}; padding: 6px 11px; background: ${SURFACE}; font-weight: 600;`,
  td: `font-family: ${FONT_STACK}; font-size: 14px; color: ${TEXT}; line-height: 1.5; border: 1px solid ${BORDER}; padding: 6px 11px;`,
  hr: `border: none; border-top: 1px solid ${BORDER}; margin: 22px 0;`,
  img: 'max-width: 100%; height: auto;',
  a: `color: ${LINK};`,
  mark: `background: #fff8c5; color: ${TEXT}; padding: 0 2px;`,
  strong: 'font-weight: 600;',
  b: 'font-weight: 600;',
  sup: 'font-size: 11px; line-height: 1;',
  sub: 'font-size: 11px; line-height: 1;',
};

const INLINE_CODE_STYLE = `font-family: ${MONO_STACK}; font-size: 0.92em; background: #eff1f3; color: ${TEXT}; padding: 1px 5px; border-radius: 4px;`;
const CODE_IN_PRE_STYLE = `font-family: ${MONO_STACK}; font-size: 13px; background: none; color: ${TEXT}; padding: 0;`;

// GitHub-light-ish colors for Prism token classes (reading view highlighting).
const TOKEN_COLORS: Array<{ classes: string[]; color: string; italic?: boolean }> = [
  { classes: ['comment', 'prolog', 'doctype', 'cdata'], color: '#6e7781', italic: true },
  { classes: ['keyword', 'important', 'atrule'], color: '#cf222e' },
  { classes: ['string', 'char', 'attr-value', 'url'], color: '#0a3069' },
  { classes: ['function', 'function-name', 'method'], color: '#8250df' },
  { classes: ['number', 'boolean', 'constant', 'symbol', 'deleted'], color: '#0550ae' },
  { classes: ['class-name', 'builtin', 'type', 'namespace'], color: '#953800' },
  { classes: ['tag', 'selector'], color: '#116329' },
  { classes: ['property', 'attr-name', 'variable', 'regex'], color: '#0550ae' },
];

const CALLOUT_COLORS: Record<string, { border: string; bg: string }> = {
  note: { border: '#0969da', bg: '#ddf4ff' },
  info: { border: '#0969da', bg: '#ddf4ff' },
  todo: { border: '#0969da', bg: '#ddf4ff' },
  abstract: { border: '#57606a', bg: '#f6f8fa' },
  summary: { border: '#57606a', bg: '#f6f8fa' },
  tldr: { border: '#57606a', bg: '#f6f8fa' },
  quote: { border: '#57606a', bg: '#f6f8fa' },
  cite: { border: '#57606a', bg: '#f6f8fa' },
  example: { border: '#8250df', bg: '#fbefff' },
  tip: { border: '#1a7f37', bg: '#dcffe4' },
  hint: { border: '#1a7f37', bg: '#dcffe4' },
  important: { border: '#8250df', bg: '#fbefff' },
  success: { border: '#1a7f37', bg: '#dcffe4' },
  check: { border: '#1a7f37', bg: '#dcffe4' },
  done: { border: '#1a7f37', bg: '#dcffe4' },
  question: { border: '#9a6700', bg: '#fff8c5' },
  help: { border: '#9a6700', bg: '#fff8c5' },
  faq: { border: '#9a6700', bg: '#fff8c5' },
  warning: { border: '#9a6700', bg: '#fff8c5' },
  caution: { border: '#9a6700', bg: '#fff8c5' },
  attention: { border: '#9a6700', bg: '#fff8c5' },
  failure: { border: '#cf222e', bg: '#ffebe9' },
  fail: { border: '#cf222e', bg: '#ffebe9' },
  missing: { border: '#cf222e', bg: '#ffebe9' },
  danger: { border: '#cf222e', bg: '#ffebe9' },
  error: { border: '#cf222e', bg: '#ffebe9' },
  bug: { border: '#cf222e', bg: '#ffebe9' },
};
const DEFAULT_CALLOUT = { border: '#0969da', bg: '#ddf4ff' };

// UI chrome that must never appear in the copied output.
const CHROME_SELECTORS = [
  '.edit-block-button',
  '.copy-code-button',
  '.collapse-indicator',
  '.heading-collapse-indicator',
  '.callout-fold',
  '.callout-icon',
  '.frontmatter',
  '.frontmatter-container',
  '.mod-frontmatter',
  '.metadata-container',
  '.markdown-preview-pusher',
  '.markdown-embed-link',
  '.embed-title',
  '.inline-title',
  '.footnote-backref',
  'button',
  'input:not([type="checkbox"])',
].join(', ');

const ATTR_WHITELIST = new Set([
  'style', 'href', 'src', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'start', 'align', 'rel',
]);

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

const MAX_EMBED_BYTES = 8 * 1024 * 1024; // per image

export interface EmailifyStats {
  diagrams: number;
  embeddedImages: number;
  embeddedBytes: number;
  skipped: string[];
}

/**
 * Rewrite a rendered markdown subtree into email-safe HTML: every element
 * carries inline styles, diagrams/math become PNG data URIs, vault images are
 * embedded, and Obsidian-specific markup is stripped.
 */
export async function emailify(
  app: App,
  inner: HTMLElement,
  sourcePath: string,
  settings: CopyForEmailSettings,
  rasterBackground: string,
): Promise<EmailifyStats> {
  const stats: EmailifyStats = { diagrams: 0, embeddedImages: 0, embeddedBytes: 0, skipped: [] };

  removeChrome(inner);
  convertCanvases(inner, stats);
  await rasterizeDynamicBlocks(inner, settings, rasterBackground, stats);
  transformCheckboxes(inner);
  transformCallouts(inner);
  transformLinks(inner);
  await transformImages(app, inner, sourcePath, settings, stats);
  colorizeCodeTokens(inner);
  applyStyleMap(inner);
  stripAttributes(inner);

  return stats;
}

/** Move the transformed content into a styled wrapper and serialize it. */
export function buildEmailHtml(inner: HTMLElement): string {
  const out = activeDocument.createElement('div');
  out.setAttribute('style', `${BASE_TEXT_STYLE} max-width: 700px;`);
  while (inner.firstChild) out.appendChild(inner.firstChild);
  return out.outerHTML;
}

function removeChrome(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll(CHROME_SELECTORS))) {
    el.remove();
  }
}

// Canvas content does not survive serialization; snapshot each one to a PNG.
function convertCanvases(root: HTMLElement, stats: EmailifyStats): void {
  for (const canvas of Array.from(root.querySelectorAll('canvas'))) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = makeBlockImage(dataUrl, canvas.getBoundingClientRect().width, 'chart');
      canvas.replaceWith(img);
      stats.diagrams += 1;
    } catch (e) {
      console.warn('[copy-for-email] canvas snapshot failed', e);
      canvas.replaceWith(makePlaceholder('[chart]'));
      stats.skipped.push('chart');
    }
  }
}

// Mermaid diagrams, MathJax output and other SVG blocks do not survive mail
// clients (Gmail strips SVG entirely), so rasterize them to PNG data URIs.
async function rasterizeDynamicBlocks(
  root: HTMLElement,
  settings: CopyForEmailSettings,
  background: string,
  stats: EmailifyStats,
): Promise<void> {
  const targets = new Set<Element>();

  for (const el of Array.from(root.querySelectorAll('mjx-container'))) {
    targets.add(el);
  }
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    if (svg.closest('mjx-container')) continue;
    const block = svg.closest('[class*="block-language-"]');
    targets.add(block ?? svg);
  }

  for (const target of Array.from(targets)) {
    const isInline =
      target.closest('.math-inline') !== null ||
      (target.tagName.toLowerCase() === 'mjx-container' && target.getAttribute('display') !== 'true');
    // For math, replace the whole .math wrapper so stray script/text nodes go too.
    const replaceTarget = target.closest('.math') ?? target;
    const rect = target.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) {
      replaceTarget.remove();
      continue;
    }

    if (Platform.isMobile) {
      // Rasterizing re-rendered offscreen subtrees is unreliable on iOS
      // (comes back blank); degrade to a placeholder instead of a broken image.
      replaceTarget.replaceWith(makePlaceholder(isInline ? '[formula]' : '[diagram]'));
      stats.skipped.push(isInline ? 'formula' : 'diagram');
      continue;
    }

    try {
      const dataUrl = await domToPng(target as HTMLElement, {
        scale: settings.diagramScale,
        backgroundColor: background,
      });
      if (isInline) {
        const img = activeDocument.createElement('img');
        img.src = dataUrl;
        img.alt = 'formula';
        img.setAttribute('width', String(Math.round(rect.width)));
        img.setAttribute('height', String(Math.round(rect.height)));
        img.setAttribute('style', 'vertical-align: middle;');
        replaceTarget.replaceWith(img);
      } else {
        replaceTarget.replaceWith(makeBlockImage(dataUrl, rect.width, 'diagram'));
      }
      stats.diagrams += 1;
    } catch (e) {
      console.warn('[copy-for-email] diagram rasterization failed', e);
      replaceTarget.replaceWith(makePlaceholder('[diagram]'));
      stats.skipped.push('diagram');
    }
  }
}

function makeBlockImage(dataUrl: string, cssWidth: number, alt: string): HTMLElement {
  const holder = activeDocument.createElement('div');
  holder.setAttribute('style', 'margin: 0 0 14px;');
  const img = activeDocument.createElement('img');
  img.src = dataUrl;
  img.alt = alt;
  if (cssWidth > 0) img.setAttribute('width', String(Math.round(cssWidth)));
  img.setAttribute('style', 'max-width: 100%; height: auto;');
  holder.appendChild(img);
  return holder;
}

function makePlaceholder(text: string): HTMLElement {
  const span = activeDocument.createElement('span');
  span.setAttribute('style', `color: ${MUTED}; font-style: italic;`);
  span.textContent = text;
  return span;
}

// Mail clients strip <input>; replace task checkboxes with unicode glyphs.
function transformCheckboxes(root: HTMLElement): void {
  for (const input of Array.from(root.querySelectorAll('input[type="checkbox"]'))) {
    const checked = input.hasAttribute('checked') || (input as { checked?: boolean }).checked === true;
    const span = activeDocument.createElement('span');
    span.textContent = checked ? '☑ ' : '☐ ';
    input.replaceWith(span);
  }
  for (const list of Array.from(root.querySelectorAll('ul.contains-task-list'))) {
    prependCss(list, 'list-style: none; padding-left: 8px;');
  }
}

function transformCallouts(root: HTMLElement): void {
  for (const callout of Array.from(root.querySelectorAll('.callout'))) {
    const type = (callout.getAttribute('data-callout') ?? 'note').toLowerCase();
    const colors = CALLOUT_COLORS[type] ?? DEFAULT_CALLOUT;
    callout.setAttribute(
      'style',
      `${BASE_TEXT_STYLE} margin: 0 0 14px; padding: 12px 16px; border-left: 4px solid ${colors.border}; border-radius: 5px; background: ${colors.bg};`,
    );
    const title = callout.querySelector('.callout-title');
    if (title) {
      title.setAttribute('style', `font-weight: 600; color: ${colors.border}; margin: 0 0 6px;`);
    }
    const content = callout.querySelector('.callout-content');
    if (content) {
      content.setAttribute('style', 'margin: 0;');
      const lastChild = content.lastElementChild;
      if (lastChild) prependCss(lastChild, 'margin-bottom: 0;');
    }
  }
}

// Internal links and tags mean nothing to a mail recipient: keep the text.
// External links keep their href.
function transformLinks(root: HTMLElement): void {
  for (const a of Array.from(root.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    const isExternal = /^(https?:|mailto:)/i.test(href);
    if (isExternal && !a.classList.contains('internal-link') && !a.classList.contains('tag')) {
      continue;
    }
    const span = activeDocument.createElement('span');
    if (a.classList.contains('tag')) {
      span.setAttribute('style', `color: ${MUTED};`);
    }
    span.textContent = a.textContent ?? '';
    a.replaceWith(span);
  }
}

async function transformImages(
  app: App,
  root: HTMLElement,
  sourcePath: string,
  settings: CopyForEmailSettings,
  stats: EmailifyStats,
): Promise<void> {
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('data:')) continue;

    const file = resolveVaultImage(app, img, sourcePath);
    if (file) {
      await embedVaultImage(app, img, file, stats);
      continue;
    }

    if (/^https?:/i.test(src)) {
      if (settings.embedExternalImages) {
        await embedExternalImage(img, src, stats);
      }
      continue;
    }

    // Unresolvable app:// / capacitor:// resource: a recipient could never
    // load it, so degrade to a visible placeholder.
    img.replaceWith(makePlaceholder(`[image: ${img.getAttribute('alt') || 'unavailable'}]`));
    stats.skipped.push('image');
  }
}

function resolveVaultImage(app: App, img: HTMLImageElement, sourcePath: string): TFile | null {
  // The embed wrapper keeps the original link text, which is the most
  // reliable way back to the vault file.
  const linkText = img.closest('.internal-embed')?.getAttribute('src');
  if (linkText) {
    const file = app.metadataCache.getFirstLinkpathDest(linkText.split('#')[0], sourcePath);
    if (file) return file;
  }

  const src = img.getAttribute('src') ?? '';
  if (!/^(app|file):/i.test(src)) return null;
  const basePath = getVaultBasePath(app);
  if (!basePath) return null;
  try {
    const url = new URL(src);
    const fsPath = decodeURIComponent(url.pathname).replace(/\\/g, '/');
    const base = basePath.replace(/\\/g, '/');
    const idx = fsPath.indexOf(base);
    if (idx === -1) return null;
    const rel = fsPath.slice(idx + base.length).replace(/^\/+/, '');
    const af = app.vault.getAbstractFileByPath(rel);
    return af instanceof TFile ? af : null;
  } catch {
    return null;
  }
}

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter as { getBasePath?: () => string };
  return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : null;
}

async function embedVaultImage(
  app: App,
  img: HTMLImageElement,
  file: TFile,
  stats: EmailifyStats,
): Promise<void> {
  const ext = file.extension.toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) {
    img.replaceWith(makePlaceholder(`[file: ${file.name}]`));
    stats.skipped.push(file.name);
    return;
  }

  // SVG data URIs are stripped by most mail clients; rasterize to PNG first.
  if (ext === 'svg') {
    try {
      const dataUrl = await imgElementToPng(img, 2);
      img.src = dataUrl;
      stats.embeddedImages += 1;
      stats.embeddedBytes += dataUrl.length;
      return;
    } catch (e) {
      console.warn('[copy-for-email] svg rasterization failed, embedding as svg', e);
    }
  }

  try {
    const data = await app.vault.readBinary(file);
    if (data.byteLength > MAX_EMBED_BYTES) {
      img.replaceWith(makePlaceholder(`[image too large: ${file.name}]`));
      stats.skipped.push(file.name);
      return;
    }
    img.src = `data:${mime};base64,${arrayBufferToBase64(data)}`;
    if (!img.getAttribute('alt')) img.setAttribute('alt', file.basename);
    stats.embeddedImages += 1;
    stats.embeddedBytes += data.byteLength;
  } catch (e) {
    console.warn('[copy-for-email] failed to read vault image', file.path, e);
    img.replaceWith(makePlaceholder(`[image: ${file.name}]`));
    stats.skipped.push(file.name);
  }
}

async function embedExternalImage(img: HTMLImageElement, src: string, stats: EmailifyStats): Promise<void> {
  try {
    const resp = await requestUrl({ url: src });
    if (resp.arrayBuffer.byteLength > MAX_EMBED_BYTES) return;
    const mime = resp.headers['content-type']?.split(';')[0] || guessMimeFromUrl(src) || 'image/png';
    img.src = `data:${mime};base64,${arrayBufferToBase64(resp.arrayBuffer)}`;
    stats.embeddedImages += 1;
    stats.embeddedBytes += resp.arrayBuffer.byteLength;
  } catch (e) {
    // Keep the remote URL; most clients will still load it.
    console.warn('[copy-for-email] failed to download external image', src, e);
  }
}

function guessMimeFromUrl(src: string): string | null {
  const m = src.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
  return m ? IMAGE_MIME[m[1]] ?? null : null;
}

async function imgElementToPng(img: HTMLImageElement, scale: number): Promise<string> {
  await img.decode().catch(() => undefined);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('image not loaded');
  const canvas = activeDocument.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function colorizeCodeTokens(root: HTMLElement): void {
  for (const span of Array.from(root.querySelectorAll('pre code span'))) {
    if (!span.classList.contains('token')) continue;
    for (const entry of TOKEN_COLORS) {
      if (entry.classes.some((c) => span.classList.contains(c))) {
        prependCss(span, `color: ${entry.color};${entry.italic ? ' font-style: italic;' : ''}`);
        break;
      }
    }
  }
}

function applyStyleMap(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    let css = TAG_STYLES[tag];
    if (tag === 'code') {
      css = el.closest('pre') ? CODE_IN_PRE_STYLE : INLINE_CODE_STYLE;
    }
    if (css) prependCss(el, css);
  }
}

// Prepend our styles so any inline style already on the element (e.g. the
// renderer's text-align on table cells) keeps the final word.
function prependCss(el: Element, css: string): void {
  const existing = el.getAttribute('style');
  el.setAttribute('style', existing ? `${css};${existing}` : css);
}

function stripAttributes(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (!ATTR_WHITELIST.has(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
