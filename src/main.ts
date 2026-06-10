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
import { toPlainText } from './plaintext';
import { renderMarkdownOffscreen } from './render';
import { CopyForEmailSettings, DEFAULT_SETTINGS } from './settings';

const LARGE_CLIPBOARD_BYTES = 8 * 1024 * 1024;

export default class CopyForEmailPlugin extends Plugin {
  settings: CopyForEmailSettings = { ...DEFAULT_SETTINGS };
  private running = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: 'copy-selection',
      name: 'Copy selection',
      editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        void this.copySelection(editor, ctx);
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
            .setTitle('Copy for email')
            .setIcon('mail')
            .onClick(() => {
              void this.copySelection(editor, ctx);
            }),
        );
      }),
    );

    this.addSettingTab(new CopyForEmailSettingTab(this.app, this));
  }

  private async copySelection(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Promise<void> {
    const markdown = editor.getSelection();
    if (!markdown.trim()) {
      new Notice('Select some text first, or use "Copy note".');
      return;
    }
    await this.runCopy(markdown, ctx.file?.path ?? '');
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
    if (this.running) {
      new Notice('A copy is already in progress.');
      return;
    }
    this.running = true;

    try {
      const rendered = await renderMarkdownOffscreen(this.app, markdown, sourcePath);
      try {
        const rasterBg = resolveRasterBackground(rendered.wrap);
        const stats = await emailify(this.app, rendered.inner, sourcePath, this.settings, rasterBg);
        // Plain text first: it still wants the classes that strip removes.
        const text = toPlainText(rendered.inner);
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
    new Notice(`Copied for email${detail}`, 3000);

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
  }
}
