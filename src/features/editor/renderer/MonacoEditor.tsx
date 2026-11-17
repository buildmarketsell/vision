import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoNs } from 'monaco-editor';
import { enableImagePaste } from './imagePaste';
import { monacoThemeName } from './monacoSetup';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { theme } from '../../../renderer/theme';
import { useEditor } from './editorStore';

interface MonacoEditorProps {
  path: string;
  value: string;
}

/** Loaded lazily: Monaco is the heaviest part of the app. */
export default function MonacoEditor({ path, value }: MonacoEditorProps) {
  const cleanupRef = useRef<() => void>(() => {});
  const markdown = /\.(md|markdown)$/i.test(path);

  const onMount = (editor: MonacoNs.IStandaloneCodeEditor) => {
    if (markdown) cleanupRef.current = enableImagePaste(editor, path);
  };
  useEffect(() => () => cleanupRef.current(), []);
  const themeId = useAppTheme((state) => state.active.id);

  return (
    <Editor
      onMount={onMount}
      path={path}
      value={value}
      theme={monacoThemeName(themeId)}
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
