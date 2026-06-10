# Copy for Email

Copy a selection or a whole note as **email-ready rich text**. Paste it into Gmail, Outlook, Apple Mail, Word or a WeChat official-account editor and the formatting survives — headings, tables, callouts, highlighted code, task lists, and even Mermaid diagrams and math (converted to images).

Plain markdown copied out of Obsidian pastes as raw syntax (`**bold**`, `# heading`, `| tables |`). Existing "copy as HTML" approaches rely on classes and `<style>` blocks, which mail clients strip on paste. This plugin instead:

- **Inlines every style** on every element — the only formatting mail clients reliably keep.
- **Rasterizes what mail can't render**: Mermaid diagrams, charts, MathJax formulas and SVGs become embedded PNG images.
- **Embeds vault images** as data URIs so they paste along with the text.
- **Uses a fixed light palette** so text stays readable in a white email body even if you run a dark Obsidian theme.
- **Writes a clean plain-text flavor too**: chat apps (WeChat, Slack, iMessage) that ignore rich text get readable text with no markdown syntax — bullets, `a | b` table rows and `☑/☐` task glyphs instead of `*`, `|`, `[x]`.

## Usage

- **Copy selection** — command palette, or right-click a selection → *Copy for email* (editing view). Works in reading view too: select rendered text, then run the command.
- **Copy note** — copies the active note (frontmatter excluded; optionally prepends the title).

Then paste into your mail compose window.

> [!note]
> A plain `Cmd/Ctrl+C` is still Obsidian's native copy (markdown text, or theme-styled HTML from reading view, which mail clients render poorly). Use the plugin command or menu item to get the email-ready version.

## What maps to what

| In Obsidian | In the email |
| --- | --- |
| Headings, bold/italic, highlight | Styled text (GitHub-light palette) |
| Tables (with column alignment) | Bordered tables |
| Callouts | Tinted boxes with colored left border |
| Code blocks | Boxed monospace with syntax colors |
| Task lists | ☑ / ☐ |
| Mermaid / charts / math / SVG | PNG images |
| Vault image embeds | Embedded images (data URIs) |
| Internal links & tags | Plain text |
| External links | Real links |

## Notes & limitations

- Pasted data-URI images work in Gmail, Apple Mail, Outlook for Mac and new Outlook. Classic Outlook for Windows may not display them while composing; recipients are unaffected when sending from the supported clients.
- Diagrams are rasterized against your current Obsidian background, so they always stay readable; for light-styled diagrams in email, use a light theme.
- On mobile, diagrams/math degrade to a `[diagram]` placeholder (iOS cannot reliably rasterize off-screen renders); text, tables and images copy fine.

## Install

Manual: download `main.js`, `manifest.json`, `styles.css` from the latest release into `<vault>/.obsidian/plugins/copy-for-email/`, then enable it in *Settings → Community plugins*.

## License

MIT
