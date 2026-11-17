import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { THEMES, type VisionTheme } from '../../../renderer/themes';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

/** Monaco's name for a VISION theme. */
export function monacoThemeName(themeId: string): string {
  return `vision-${themeId}`;
}

function defineMonacoTheme(visionTheme: VisionTheme): void {
  const { colors, syntax } = visionTheme;
  monaco.editor.defineTheme(monacoThemeName(visionTheme.id), {
    base: visionTheme.scheme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: syntax.text },
      { token: 'comment', foreground: syntax.comment, fontStyle: 'italic' },
      { token: 'keyword', foreground: syntax.keyword },
      { token: 'keyword.md', foreground: syntax.text, fontStyle: 'bold' },
      { token: 'string', foreground: syntax.string },
      { token: 'string.link.md', foreground: syntax.link },
      { token: 'number', foreground: syntax.number },
      { token: 'type', foreground: syntax.type },
      { token: 'tag', foreground: syntax.keyword },
      { token: 'attribute.name', foreground: syntax.attributeName },
      { token: 'attribute.value', foreground: syntax.string },
      { token: 'delimiter', foreground: syntax.delimiter },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': colors.card,
      'editor.lineHighlightBackground': colors.sidebar,
      'editor.lineHighlightBorder': colors.sidebar,
      'editorLineNumber.foreground': colors.textFaint,
      'editorLineNumber.activeForeground': colors.textMuted,
      'editorCursor.foreground': colors.accent,
      'editor.selectionBackground': syntax.selection,
      'editorIndentGuide.background1': syntax.indentGuide,
      'scrollbarSlider.background': syntax.scrollbar,
      'scrollbarSlider.hoverBackground': syntax.scrollbarHover,
    },
  });
}

THEMES.forEach(defineMonacoTheme);

// Use the bundled Monaco instead of loading it from a CDN, so the editor works offline.
loader.config({ monaco });
