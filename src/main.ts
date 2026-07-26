import {
  App,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from 'obsidian';
import { writeRichClipboard } from './clipboard';
import { buildEmailHtml, emailify, EmailifyStats, stripEmailAttributes } from './emailify';
import { CHAT_MARKERS, MINIMAL_MARKERS, PlainTextMarkers, toPlainText } from './plaintext';
import { RenderedMarkdown, renderMarkdownOffscreen, renderSelectionOffscreen } from './render';
import { CopyForEmailSettings, DEFAULT_SETTINGS, PT_MARKER_KEYS, PtMarkerKey } from './settings';

const LARGE_CLIPBOARD_BYTES = 8 * 1024 * 1024;

export default class CopyForEmailPlugin extends Plugin {
  settings: CopyForEmailSettings = { ...DEFAULT_SETTINGS };
  private running = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    // One-click alternative to the command palette: selection if there is
    // one, whole note otherwise. Users who don't want it can hide it via
    // Obsidian's own ribbon configuration.
    this.addRibbonIcon('mail', 'Copy for email and chat (selection or note)', () => {
      void this.copyFromRibbon();
    });

    this.addCommand({
      id: 'copy-selection',
      name: 'Copy selection',
      // checkCallback (not editorCallback) so the command also works in
      // reading view, where the selection lives in the preview DOM.
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (!checking) void this.copySelection(view.editor, view);
        return true;
      },
    });

    this.addCommand({
      id: 'copy-note',
      name: 'Copy note',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (!checking) void this.copyNote(file);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, ctx) => {
        if (!editor.getSelection().trim()) return;
        menu.addItem((item) =>
          item
            .setTitle('Copy for email and chat')
            .setIcon('mail')
            .onClick(() => {
              void this.copySelection(editor, ctx);
            }),
        );
      }),
    );

    this.addSettingTab(new CopyForEmailSettingTab(this.app, this));
  }

  private async copyFromRibbon(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      if (view.editor.getSelection().trim()) {
        await this.copySelection(view.editor, view);
        return;
      }
      // Reading view keeps its selection in the preview DOM, not the editor.
      if (await this.copyDomSelection(view)) return;
    }
    const file = this.app.workspace.getActiveFile();
    if (file && file.extension === 'md') {
      await this.copyNote(file);
      return;
    }
    new Notice('Open a markdown note first.');
  }

  private async copySelection(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Promise<void> {
    const markdown = editor.getSelection();
    if (markdown.trim()) {
      await this.runCopy(markdown, ctx.file?.path ?? '');
      return;
    }
    // Reading view: the selection is rendered DOM, not editor text.
    if (await this.copyDomSelection(ctx)) return;
    new Notice('Select some text first, or use "Copy note".');
  }

  // Copy an already-rendered selection (reading view) by cloning the live DOM
  // and running it through the same email pipeline.
  private async copyDomSelection(ctx: MarkdownView | MarkdownFileInfo): Promise<boolean> {
    const sel = activeWindow.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!el?.closest('.markdown-preview-view')) return false;
    await this.runCopyPipeline(() => renderSelectionOffscreen(range), ctx.file?.path ?? '');
    return true;
  }

  private async copyNote(file: TFile): Promise<void> {
    let markdown = await this.app.vault.cachedRead(file);
    markdown = stripFrontmatter(markdown);
    if (this.settings.includeNoteTitle) {
      markdown = `# ${file.basename}\n\n${markdown}`;
    }
    if (!markdown.trim()) {
      new Notice('Note is empty.');
      return;
    }
    await this.runCopy(markdown, file.path);
  }

  private async runCopy(markdown: string, sourcePath: string): Promise<void> {
    await this.runCopyPipeline(() => renderMarkdownOffscreen(this.app, markdown, sourcePath), sourcePath);
  }

  private async runCopyPipeline(build: () => Promise<RenderedMarkdown>, sourcePath: string): Promise<void> {
    if (this.running) {
      new Notice('A copy is already in progress.');
      return;
    }
    this.running = true;

    try {
      const rendered = await build();
      try {
        const rasterBg = resolveRasterBackground(rendered.wrap);
        const stats = await emailify(this.app, rendered.inner, sourcePath, this.settings, rasterBg);
        // Plain text first: it still wants the classes that strip removes.
        const text = toPlainText(rendered.inner, markersFromSettings(this.settings));
        stripEmailAttributes(rendered.inner);
        const html = buildEmailHtml(rendered.inner);
        const mode = await writeRichClipboard(html, text);
        this.showResult(mode, stats, html.length);
      } finally {
        rendered.dispose();
      }
    } catch (e) {
      console.error('[copy-for-email]', e);
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Copy failed: ${msg}`, 4000);
    } finally {
      this.running = false;
    }
  }

  private showResult(mode: 'rich' | 'plain', stats: EmailifyStats, htmlBytes: number): void {
    if (mode === 'plain') {
      new Notice('Rich copy unavailable here — copied clean plain text instead.', 3500);
      return;
    }
    const parts: string[] = [];
    if (stats.diagrams > 0) parts.push(`${stats.diagrams} diagram${stats.diagrams > 1 ? 's' : ''}`);
    if (stats.embeddedImages > 0) {
      parts.push(`${stats.embeddedImages} image${stats.embeddedImages > 1 ? 's' : ''} embedded`);
    }
    if (stats.skipped.length > 0) parts.push(`${stats.skipped.length} skipped`);
    const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    new Notice(`Copied for email and chat${detail}`, 3000);

    if (htmlBytes > LARGE_CLIPBOARD_BYTES) {
      new Notice(
        `Clipboard is large (${(htmlBytes / 1024 / 1024).toFixed(1)} MB) — some apps may paste slowly.`,
        4000,
      );
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<CopyForEmailSettings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '');
}

function markersFromSettings(s: CopyForEmailSettings): PlainTextMarkers {
  if (s.plainTextStyle === 'minimal') return MINIMAL_MARKERS;
  return {
    h1: [s.ptH1Prefix, s.ptH1Suffix],
    h2: [s.ptH2Prefix, s.ptH2Suffix],
    h3: [s.ptH3Prefix, s.ptH3Suffix],
    h4: [s.ptH4Prefix, s.ptH4Suffix],
    emphasis: [s.ptEmphasisPrefix, s.ptEmphasisSuffix],
    calloutTitle: [s.ptCalloutPrefix, s.ptCalloutSuffix],
    quoteBar: s.ptQuoteBar,
    calloutBodyBar: s.ptQuoteBar,
    divider: s.ptDivider,
    circledNumbers: s.ptCircledNumbers,
    indent: CHAT_MARKERS.indent,
  };
}

function resolveRasterBackground(wrap: HTMLElement): string {
  const bg = getComputedStyle(wrap).backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return '#ffffff';
  return bg;
}

class CopyForEmailSettingTab extends PluginSettingTab {
  private plugin: CopyForEmailPlugin;

  constructor(app: App, plugin: CopyForEmailPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Diagram image scale')
      .setDesc('Resolution multiplier when Mermaid diagrams, charts and math are converted to images.')
      .addDropdown((dd) =>
        dd
          .addOptions({ '1': '1×', '1.5': '1.5×', '2': '2× (recommended)', '3': '3×' })
          .setValue(String(this.plugin.settings.diagramScale))
          .onChange(async (value) => {
            this.plugin.settings.diagramScale = parseFloat(value) || 2;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Embed external images')
      .setDesc(
        'Download http(s) images and embed them into the copied content. Off keeps the original links, which most mail clients load fine.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.embedExternalImages).onChange(async (value) => {
          this.plugin.settings.embedExternalImages = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Include note title')
      .setDesc('Prepend the note title as a heading when copying a whole note.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeNoteTitle).onChange(async (value) => {
          this.plugin.settings.includeNoteTitle = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName('Plain text').setHeading();

    new Setting(containerEl)
      .setName('Style')
      .setDesc(
        'Chat apps (WeChat, Slack, iMessage) paste the plain-text flavor. ' +
          '"Chat glyphs" redraws headings, emphasis and quotes with visible markers; ' +
          '"Minimal" keeps bare lines.',
      )
      .addDropdown((dd) =>
        dd
          .addOptions({ chat: 'Chat glyphs', minimal: 'Minimal' })
          .setValue(this.plugin.settings.plainTextStyle)
          .onChange(async (value) => {
            this.plugin.settings.plainTextStyle = value === 'minimal' ? 'minimal' : 'chat';
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.plainTextStyle === 'chat') {
      this.addMarkerPair('Heading 1', 'ptH1Prefix', 'ptH1Suffix');
      this.addMarkerPair('Heading 2', 'ptH2Prefix', 'ptH2Suffix');
      this.addMarkerPair('Heading 3', 'ptH3Prefix', 'ptH3Suffix');
      this.addMarkerPair('Headings 4–6', 'ptH4Prefix', 'ptH4Suffix');
      this.addMarkerPair('Bold & highlight', 'ptEmphasisPrefix', 'ptEmphasisSuffix', 'Leave both empty to keep emphasis unmarked.');
      this.addMarkerPair('Callout title', 'ptCalloutPrefix', 'ptCalloutSuffix');

      new Setting(containerEl)
        .setName('Quote bar')
        .setDesc('Per-line prefix for quotes and callout bodies. Spacing counts.')
        .addText((t) =>
          t.setValue(this.plugin.settings.ptQuoteBar).onChange(async (value) => {
            this.plugin.settings.ptQuoteBar = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName('Divider')
        .setDesc('Replaces horizontal rules.')
        .addText((t) =>
          t.setValue(this.plugin.settings.ptDivider).onChange(async (value) => {
            this.plugin.settings.ptDivider = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName('Circled numbers')
        .setDesc('Render ordered lists as ① ② ③, falling back to "21." past twenty.')
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.ptCircledNumbers).onChange(async (value) => {
            this.plugin.settings.ptCircledNumbers = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName('Restore default markers')
        .setDesc('Reset every marker above to the built-in chat glyphs.')
        .addButton((btn) =>
          btn.setButtonText('Restore').onClick(async () => {
            for (const key of PT_MARKER_KEYS) {
              this.plugin.settings[key] = DEFAULT_SETTINGS[key];
            }
            this.plugin.settings.ptCircledNumbers = DEFAULT_SETTINGS.ptCircledNumbers;
            await this.plugin.saveSettings();
            this.display();
          }),
        );
    }
  }

  // A prefix/suffix pair rendered as two side-by-side text boxes.
  private addMarkerPair(name: string, prefixKey: PtMarkerKey, suffixKey: PtMarkerKey, desc = ''): void {
    const setting = new Setting(this.containerEl)
      .setName(name)
      .addText((t) =>
        t.setPlaceholder('prefix').setValue(this.plugin.settings[prefixKey]).onChange(async (value) => {
          this.plugin.settings[prefixKey] = value;
          await this.plugin.saveSettings();
        }),
      )
      .addText((t) =>
        t.setPlaceholder('suffix').setValue(this.plugin.settings[suffixKey]).onChange(async (value) => {
          this.plugin.settings[suffixKey] = value;
          await this.plugin.saveSettings();
        }),
      );
    if (desc) setting.setDesc(desc);
  }
}
