interface ElectronClipboardModule {
  clipboard?: {
    write?: (data: { text?: string; html?: string }) => void;
  };
}

// Desktop-only fallback: reach Electron's clipboard through require('electron')
// without an `any` cast (require is not in the renderer's typed globals).
function getElectronClipboardModule(): ElectronClipboardModule | null {
  const req = (window as unknown as { require?: (id: string) => unknown }).require;
  if (typeof req !== 'function') return null;
  try {
    return req('electron') as ElectronClipboardModule;
  } catch {
    return null;
  }
}

export type ClipboardWriteMode = 'rich' | 'plain';

/**
 * Write both flavors to the clipboard: text/html for rich-paste targets
 * (mail clients, Word, web editors) and text/plain for everything else.
 * Falls back to plain text only when no rich path is available.
 */
export async function writeRichClipboard(html: string, text: string): Promise<ClipboardWriteMode> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return 'rich';
  } catch (e) {
    console.warn('[copy-for-email] navigator.clipboard.write failed, trying Electron clipboard', e);
  }

  const electron = getElectronClipboardModule();
  if (electron?.clipboard?.write) {
    electron.clipboard.write({ html, text });
    return 'rich';
  }

  await navigator.clipboard.writeText(text);
  return 'plain';
}
