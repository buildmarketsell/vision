# Progress

## Done
- 2026-11-16: v0.1 and Claude sessions merged into `main`.
- Kickoff: plan, rules, private repo.
- v0.1 (branch `feature/v0-1-skeleton`): window with wallpaper and floating cards (Notion-style sidebar, clonk-style Claude pane), Welcome screen with recent folders, open any folder (Cmd+O, drag a folder onto the window, one folder per window, Cmd+Shift+N), file tree (create, rename, Move to Trash, live updates, hidden files toggle), Monaco editor (Cmd+S, unsaved dot, reload or keep edits when the file changes on disk, binary and >5 MB files refused), split panes with tabs (dockview), Claude terminal (runs `claude` in the folder, restart, resize), layout and windows restored on relaunch, `.app` build. Unit tests (12) and end-to-end tests (3) pass on the dev build and the packaged app.

- Claude sessions (branch `feature/claude-sessions`): open and close as many Claude sessions as wanted (sidebar "+ New session", ⌘T), each a tab named after its conversation, a "Claude" sidebar section with live dots, ⌘L jumps to the last session. Sidebar sections now stack (Claude above Files).
- Design polish (branch `feature/design-polish`): San Francisco type with size-specific tracking, press feedback, menus that grow from the click, Welcome card entrance, sidebar rubber-band resize, one Claude header with a Working/Ready pill, warm editor colors, card shadows and rounded pane corners fixed, Reduce Motion and Increase Contrast support, headless test mode.
- Claude button (branch `feature/claude-button`): the sidebar's bottom button is now "Claude" and opens a new Claude terminal (⌘T); every Claude tab, header and session row uses the Claude starburst logo, pulsing while working and dimmed when stopped.
- v0.2 Claude chat (branch `feature/v0-2-claude-chat`): each Claude tab is a chat by default (streamed formatted replies, tool rows with diffs, Allow/Deny cards, question cards, live Working card, Tasks card when Claude keeps a to-do list, Stop, permission mode picker, drop a file to @mention it, recent conversations to reopen), with a Terminal switch that resumes the same conversation. Tabs remember their conversation across restarts.
- Markdown preview (on `feature/notion-layout`, 2026-11-16): `.md` files open as a formatted page (Preview) with a Preview / Edit switch in the breadcrumb row; Edit is the Monaco editor. Shared renderer in `src/renderer/components/Markdown.tsx`, page styles in `styles/markdown-document.css`.
- Images in Markdown (2026-11-17): Preview shows relative images, Obsidian `![[embeds]]` and web images. In Edit, paste a screenshot or drop image files (Finder or the sidebar) and the link is inserted at the cursor; images from outside the folder are saved to `images/` next to the note as `<note>-<date-time>.png`. Local images load through the `vision-file://` scheme, which serves only image files inside an open folder.
- Zoom (2026-11-17): ⌘= / ⌘+ zoom in, ⌘− out, ⌘0 reset, in the View menu; all windows, remembered in `state.json` (`zoomLevel`).

- Notion-style redesign and chat extras (branch `feature/notion-layout`, 2026-11-16/17): flat full-window layout, gray tab strip with white active tab, traffic lights in the sidebar's top row, no wallpaper. Sidebar views picked from a gradient switcher (after cult-ui's gradient button group): Files (New File, New Folder, Refresh, Collapse All, hidden files), Claude (sessions plus a Usage card from `rate_limit_event`, plan from `initialize`), Inbox (WhatsApp-style chat with yourself, saved in userData/inbox.json). Chat: paste or drop images and files (no Shift), model picker, context meter, slash command menu, message queue, wave loading text (after Kokonut UI). New chats default to Edit automatically.
- Boards (branch `feature/boards`, 2026-11-17): Excalidraw canvas for `.excalidraw` files, New Board button in Files, autosave, tldraw-style defaults, follows the theme.
- Boards look like tldraw (branch `feature/boards-tldraw-look`, 2026-11-17): own toolbar, style panel, menu/undo and zoom around the canvas; sticky notes; tldraw palette and canvas color.

## Next
- Merge `feature/notion-layout` into `main` once Dan has used it for a bit.
- Later (Dan): notifications view and more sidebar views.
- Ideas not started: images in the Inbox, Kokonut-style tool rows and Allow/Deny cards, showing images when reopening old conversations.

- App icon and install (2026-11-19): eye-and-arc icon (`build/icon.icns`, drawn by `scripts/make_icon.py`); VISION lives in `/Applications` so it opens from Launchpad, Spotlight and the Dock.


## Known issues
- `npm audit`: 6 moderate warnings in electron-builder's minimatch (build tool only, not in the app).
- In dev mode the menu bar says "Electron"; the built `.app` says "VISION".
- The main UI bundle is about 1.9 MB; Monaco is already lazy loaded. Fine for a local app, revisit if startup feels slow.

