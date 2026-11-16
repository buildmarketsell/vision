import Editor from '@monaco-editor/react';
import { MONACO_THEME } from './monacoSetup';
import { theme } from '../../../renderer/theme';
import { useEditor } from './editorStore';

interface MonacoEditorProps {
  path: string;
  value: string;
}

/** Loaded lazily: Monaco is the heaviest part of the app. */
export default function MonacoEditor({ path, value }: MonacoEditorProps) {
  return (
    <Editor
      path={path}
      value={value}
      theme={MONACO_THEME}
      onChange={(text) => useEditor.getState().edit(path, text ?? '')}
      loading={<div className="spinner" aria-label="Loading editor" />}
      options={{
        fontFamily: theme.font.mono,
        fontSize: theme.font.sizeEditor,
        lineHeight: 20,
        fontLigatures: false,
        cursorSmoothCaretAnimation: 'on',
        cursorBlinking: 'smooth',
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        wordWrap: path.endsWith('.md') || path.endsWith('.txt') ? 'on' : 'off',
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  );
}
