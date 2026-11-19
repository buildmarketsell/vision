import type { VisionTheme } from './types';

/** The look: Notion's flat sidebar, gray tab strip and white page, with clonk's orange accent. */
export const visionLightColors = {
  accent: '#F26B3A',
  /** Claude's own orange, for the Claude logo. */
  claude: '#D97757',
  accentHover: '#E35A28',
  accentSoft: 'rgba(242, 107, 58, 0.12)',
  /** Text and icons on an accent-colored button. */
  onAccent: '#FFFFFF',
  card: '#FFFFFF',
  sidebar: '#F7F7F5',
  text: '#37352F',
  textMuted: '#6E6D69',
  /** Small labels: still 4.5:1 on the sidebar. */
  textFaint: '#8A8985',
  rowHover: 'rgba(55, 53, 47, 0.06)',
  rowPressed: 'rgba(55, 53, 47, 0.11)',
  rowSelected: 'rgba(55, 53, 47, 0.09)',
  border: 'rgba(0, 0, 0, 0.06)',
  composerBorder: 'rgba(55, 53, 47, 0.16)',
  composerBorderFocus: 'rgba(55, 53, 47, 0.32)',
  pillHover: '#FDFDFC',
  danger: '#D44C47',
  success: '#2F7D5B',
  diffAddedBackground: 'rgba(47, 125, 91, 0.10)',
  diffRemovedBackground: 'rgba(212, 76, 71, 0.10)',
  codeBackground: '#F7F6F3',
  inlineCode: '#B4532A',
  dangerSoft: 'rgba(212, 76, 71, 0.1)',
  warningSoft: 'rgba(242, 107, 58, 0.1)',
  terminalBackground: '#1C1A19',
  terminalText: '#ECE9E4',
  terminalMuted: '#8F8A84',
  /** Light terminal: the app's own warm off-white and text colors. */
  terminalLightBackground: '#F7F6F3',
  terminalLightText: '#37352F',
  terminalLightMuted: '#6E6D69',
  focusRing: 'rgba(242, 107, 58, 0.45)',
  /** Notion's selection highlight: a soft see-through blue. */
  selection: 'rgba(35, 131, 226, 0.28)',
  /** Inbox: WhatsApp's chat colors (beige wall, green outgoing bubbles, blue ticks). */
  inboxWall: '#EFEAE2',
  inboxBar: '#F0F2F5',
  inboxBubble: '#D9FDD3',
  inboxMeta: '#667781',
  inboxTicks: '#53BDEB',
  inboxSend: '#00A884',
  inboxSendHover: '#008F72',
  inboxAvatar: '#DFE5E7',
  /** To-do status tags and board columns: Notion's gray, blue and green. */
  tagGray: 'rgba(227, 226, 224, 0.6)',
  tagGrayText: '#32302C',
  tagBlue: '#D3E5EF',
  tagBlueText: '#183347',
  tagGreen: '#DBEDDB',
  tagGreenText: '#1C3829',
  columnGray: 'rgba(227, 226, 224, 0.22)',
  columnBlue: 'rgba(211, 229, 239, 0.32)',
  columnGreen: 'rgba(219, 237, 219, 0.32)',
};

export const visionLight: VisionTheme = {
  id: 'vision-light',
  name: 'VISION Light',
  scheme: 'light',
  colors: visionLightColors,
  /** Bigger surfaces read as further away: deeper, softer shadows. */
  shadow: {
    card: '0 0 0 0.5px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.12)',
    control: '0 0 0 0.5px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.06)',
    popover: '0 0 0 0.5px rgba(15, 23, 42, 0.08), 0 8px 24px rgba(15, 23, 42, 0.16)',
  },
  // A calm, warm palette next to the orange accent (Monaco's default blue clashes with it).
  syntax: {
    text: '37352F',
    comment: '9A9893',
    keyword: 'B4532A',
    string: '2F7D5B',
    link: 'B4532A',
    number: '3B6EA8',
    type: '1F7A8C',
    attributeName: '8A6D1F',
    delimiter: '6E6D69',
    selection: '#F26B3A2E',
    indentGuide: '#00000010',
    scrollbar: '#0000001A',
    scrollbarHover: '#00000026',
  },
};
