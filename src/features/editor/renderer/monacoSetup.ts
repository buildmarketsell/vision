import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { theme } from '../../../renderer/theme';

export const MONACO_THEME = 'vision-light';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

monaco.editor.defineTheme(MONACO_THEME, {
  base: 'vs',
  inherit: true,
  // A calm, warm palette next to the orange accent (Monaco's default blue clashes with it).
  rules: [
    { token: '', foreground: '37352F' },
    { token: 'comment', foreground: '9A9893', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'B4532A' },
    { token: 'keyword.md', foreground: '37352F', fontStyle: 'bold' },
    { token: 'string', foreground: '2F7D5B' },
    { token: 'string.link.md', foreground: 'B4532A' },
    { token: 'number', foreground: '3B6EA8' },
    { token: 'type', foreground: '1F7A8C' },
    { token: 'tag', foreground: 'B4532A' },
    { token: 'attribute.name', foreground: '8A6D1F' },
    { token: 'attribute.value', foreground: '2F7D5B' },
    { token: 'delimiter', foreground: '6E6D69' },
    { token: 'strong', fontStyle: 'bold' },
    { token: 'emphasis', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': theme.colors.card,
    'editor.lineHighlightBackground': theme.colors.sidebar,
    'editor.lineHighlightBorder': theme.colors.sidebar,
    'editorLineNumber.foreground': theme.colors.textFaint,
    'editorLineNumber.activeForeground': theme.colors.textMuted,
    'editorCursor.foreground': theme.colors.accent,
    'editor.selectionBackground': '#F26B3A2E',
    'editorIndentGuide.background1': '#00000010',
    'scrollbarSlider.background': '#0000001A',
    'scrollbarSlider.hoverBackground': '#00000026',
  },
});

// Use the bundled Monaco instead of loading it from a CDN, so the editor works offline.
loader.config({ monaco });
