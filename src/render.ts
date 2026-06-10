import { App, Component, MarkdownRenderer } from 'obsidian';

// Fixed render width so diagrams rasterize at a sane, email-like column width.
const RENDER_WIDTH_PX = 700;
const FONT_TIMEOUT_MS = 1000;
const IMAGE_TIMEOUT_MS = 4000;
const DYNAMIC_BLOCK_TIMEOUT_MS = 3500;
const DYNAMIC_BLOCK_POLL_MS = 120;

export interface RenderedMarkdown {
  /** Off-screen container attached to the document (needed for layout/diagrams). */
  wrap: HTMLDivElement;
  /** The element MarkdownRenderer rendered into. */
  inner: HTMLDivElement;
  /** Unload the render Component and detach the container. */
  dispose: () => void;
}

function createOffscreenContainer(): { wrap: HTMLDivElement; inner: HTMLDivElement } {
  const wrap = activeDocument.createElement('div');
  wrap.className = 'copy-for-email-offscreen';
  // Positioning/sizing is runtime state, so it stays inline; everything
  // static lives in styles.css scoped to .copy-for-email-inner.
  wrap.style.cssText = [
    'position: fixed',
    'left: -10000px',
    'top: 0',
    'z-index: -1',
    'pointer-events: none',
    `width: ${RENDER_WIDTH_PX}px`,
    'height: auto',
    'background: var(--background-primary)',
    'color: var(--text-normal)',
    'font-family: var(--font-text)',
    'font-size: var(--font-text-size, 16px)',
    'line-height: var(--line-height-normal, 1.6)',
  ].join(';');

  const inner = activeDocument.createElement('div');
  inner.className = 'markdown-preview-view markdown-rendered copy-for-email-inner';
  wrap.appendChild(inner);
  activeDocument.body.appendChild(wrap);

  return { wrap, inner };
}

/**
 * Render markdown into an off-screen, attached container and wait for the
 * asynchronous parts (Mermaid, MathJax, images, fonts) to settle. The caller
 * MUST call dispose() when done.
 */
export async function renderMarkdownOffscreen(
  app: App,
  markdown: string,
  sourcePath: string,
): Promise<RenderedMarkdown> {
  const { wrap, inner } = createOffscreenContainer();

  // Short-lived Component scoped to this render, unloaded in dispose(), so
  // transient child renderers are not retained for the plugin's lifetime.
  const component = new Component();
  component.load();
  const dispose = (): void => {
    component.unload();
    wrap.remove();
  };

  try {
    await MarkdownRenderer.render(app, markdown, inner, sourcePath, component);
    await waitForDynamicBlocks(inner);
    await waitForAssets(inner);
    await nextAnimationFrame();
  } catch (e) {
    dispose();
    throw e;
  }

  return { wrap, inner, dispose };
}

/**
 * Build the off-screen container from an already-rendered selection (reading
 * view). The clone is attached and laid out so diagrams can still be measured
 * and rasterized; Mermaid/MathJax are already processed in the live DOM.
 */
export async function renderSelectionOffscreen(range: Range): Promise<RenderedMarkdown> {
  const { wrap, inner } = createOffscreenContainer();
  inner.appendChild(range.cloneContents());
  const dispose = (): void => {
    wrap.remove();
  };

  try {
    await waitForAssets(inner);
    await nextAnimationFrame();
  } catch (e) {
    dispose();
    throw e;
  }

  return { wrap, inner, dispose };
}

// Mermaid and MathJax process their blocks asynchronously after render()
// resolves (both libraries load lazily on first use). Poll until no block is
// still pending, bounded by a timeout so a broken block can't hang the copy.
async function waitForDynamicBlocks(root: HTMLElement): Promise<void> {
  const deadline = Date.now() + DYNAMIC_BLOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!hasPendingDynamicBlocks(root)) return;
    await sleep(DYNAMIC_BLOCK_POLL_MS);
  }
}

function hasPendingDynamicBlocks(root: HTMLElement): boolean {
  // An unprocessed Mermaid block is still a plain code element.
  if (root.querySelector('code.language-mermaid')) return true;
  // A math block without MathJax output has not been typeset yet.
  const mathBlocks = Array.from(root.querySelectorAll('.math'));
  return mathBlocks.some((m) => !m.querySelector('mjx-container, svg'));
}

async function waitForAssets(root: HTMLElement): Promise<void> {
  try {
    await withTimeout(activeDocument.fonts.ready, FONT_TIMEOUT_MS);
  } catch {
    /* fonts.ready can reject in odd states; not fatal */
  }
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(null);
      return Promise.race([
        img.decode().catch(() => null),
        sleep(IMAGE_TIMEOUT_MS),
      ]);
    }),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

function sleep(ms: number): Promise<null> {
  return new Promise((resolve) => window.setTimeout(() => resolve(null), ms));
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
