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
  rules: [],
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
