import type { visionLightColors } from './visionLight';

/** Every theme fills in the same color names (VISION Light defines the list). */
export type ThemeColors = Record<keyof typeof visionLightColors, string>;

/** Colors for the code editor (Monaco), as hex without the '#' for syntax tokens. */
export interface SyntaxColors {
  text: string;
  comment: string;
  keyword: string;
  string: string;
  link: string;
  number: string;
  type: string;
  attributeName: string;
  delimiter: string;
  /** Editor chrome, as #RRGGBBAA. */
  selection: string;
  indentGuide: string;
  scrollbar: string;
  scrollbarHover: string;
}

export interface VisionTheme {
  /** Stored in localStorage; letters, digits and dashes. */
  id: string;
  name: string;
  /** Native scrollbars and controls, and the editor's base theme. */
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  shadow: { card: string; control: string; popover: string };
  syntax: SyntaxColors;
}
