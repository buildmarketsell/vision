# Progress

## Done
- 2026-11-16: v0.1 and Claude sessions merged into `main`.
- Kickoff: plan, rules, private repo.
- v0.1 (branch `feature/v0-1-skeleton`): window with wallpaper and floating cards (Notion-style sidebar, clonk-style Claude pane), Welcome screen with recent folders, open any folder (Cmd+O, drag a folder onto the window, one folder per window, Cmd+Shift+N), file tree (create, rename, Move to Trash, live updates, hidden files toggle), Monaco editor (Cmd+S, unsaved dot, reload or keep edits when the file changes on disk, binary and >5 MB files refused), split panes with tabs (dockview), Claude terminal (runs `claude` in the folder, restart, resize), layout and windows restored on relaunch, `.app` build. Unit tests (12) and end-to-end tests (3) pass on the dev build and the packaged app.

- Claude sessions (branch `feature/claude-sessions`): open and close as many Claude sessions as wanted (sidebar "+ New session", ⌘T), each a tab named after its conversation, a "Claude" sidebar section with live dots, ⌘L jumps to the last session. Sidebar sections now stack (Claude above Files).

## Next
- v0.2: custom Claude interface (stream-json). Step 1 is logging real events.

## Known issues
- `npm audit`: 6 moderate warnings in electron-builder's minimatch (build tool only, not in the app).
- In dev mode the menu bar says "Electron"; the built `.app` says "VISION".
- The main UI bundle is about 1.9 MB; Monaco is already lazy loaded. Fine for a local app, revisit if startup feels slow.
- No app icon yet (uses Electron's default).
