import { CHAT_MARKERS } from './plaintext';

export type PlainTextStyle = 'chat' | 'minimal';

export interface CopyForEmailSettings {
  /** Resolution multiplier when rasterizing diagrams and math into PNGs. */
  diagramScale: number;
  /** Download http(s) images and inline them as data URIs. */
  embedExternalImages: boolean;
  /** Prepend the note title as a heading when copying a whole note. */
  includeNoteTitle: boolean;
  /** How the text/plain clipboard flavor (what chat apps paste) is decorated. */
  plainTextStyle: PlainTextStyle;
  ptH1Prefix: string;
  ptH1Suffix: string;
  ptH2Prefix: string;
  ptH2Suffix: string;
  ptH3Prefix: string;
  ptH3Suffix: string;
  ptH4Prefix: string;
  ptH4Suffix: string;
  ptEmphasisPrefix: string;
  ptEmphasisSuffix: string;
  ptCalloutPrefix: string;
  ptCalloutSuffix: string;
  ptQuoteBar: string;
  ptDivider: string;
  ptCircledNumbers: boolean;
}

/** The marker fields of the settings object — all plain strings. */
export const PT_MARKER_KEYS = [
  'ptH1Prefix', 'ptH1Suffix', 'ptH2Prefix', 'ptH2Suffix',
  'ptH3Prefix', 'ptH3Suffix', 'ptH4Prefix', 'ptH4Suffix',
  'ptEmphasisPrefix', 'ptEmphasisSuffix', 'ptCalloutPrefix', 'ptCalloutSuffix',
  'ptQuoteBar', 'ptDivider',
] as const;

export type PtMarkerKey = (typeof PT_MARKER_KEYS)[number];

export const DEFAULT_SETTINGS: CopyForEmailSettings = {
  diagramScale: 2,
  embedExternalImages: false,
  includeNoteTitle: false,
  plainTextStyle: 'chat',
  ptH1Prefix: CHAT_MARKERS.h1[0],
  ptH1Suffix: CHAT_MARKERS.h1[1],
  ptH2Prefix: CHAT_MARKERS.h2[0],
  ptH2Suffix: CHAT_MARKERS.h2[1],
  ptH3Prefix: CHAT_MARKERS.h3[0],
  ptH3Suffix: CHAT_MARKERS.h3[1],
  ptH4Prefix: CHAT_MARKERS.h4[0],
  ptH4Suffix: CHAT_MARKERS.h4[1],
  ptEmphasisPrefix: CHAT_MARKERS.emphasis[0],
  ptEmphasisSuffix: CHAT_MARKERS.emphasis[1],
  ptCalloutPrefix: CHAT_MARKERS.calloutTitle[0],
  ptCalloutSuffix: CHAT_MARKERS.calloutTitle[1],
  ptQuoteBar: CHAT_MARKERS.quoteBar,
  ptDivider: CHAT_MARKERS.divider,
  ptCircledNumbers: CHAT_MARKERS.circledNumbers,
};
