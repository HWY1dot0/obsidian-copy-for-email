export interface CopyForEmailSettings {
  /** Resolution multiplier when rasterizing diagrams and math into PNGs. */
  diagramScale: number;
  /** Download http(s) images and inline them as data URIs. */
  embedExternalImages: boolean;
  /** Prepend the note title as a heading when copying a whole note. */
  includeNoteTitle: boolean;
}

export const DEFAULT_SETTINGS: CopyForEmailSettings = {
  diagramScale: 2,
  embedExternalImages: false,
  includeNoteTitle: false,
};
