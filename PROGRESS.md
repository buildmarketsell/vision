# Progress

## Done
- 2026-11-16: v0.1 and Claude sessions merged into `main`.
- Kickoff: plan, rules, private repo.
- v0.1 (branch `feature/v0-1-skeleton`): window with wallpaper and floating cards (Notion-style sidebar, clonk-style Claude pane), Welcome screen with recent folders, open any folder (Cmd+O, drag a folder onto the window, one folder per window, Cmd+Shift+N), file tree (create, rename, Move to Trash, live updates, hidden files toggle), Monaco editor (Cmd+S, unsaved dot, reload or keep edits when the file changes on disk, binary and >5 MB files refused), split panes with tabs (dockview), Claude terminal (runs `claude` in the folder, restart, resize), layout and windows restored on relaunch, `.app` build. Unit tests (12) and end-to-end tests (3) pass on the dev build and the packaged app.

- Claude sessions (branch `feature/claude-sessions`): open and close as many Claude sessions as wanted (sidebar "+ New session", ⌘T), each a tab named after its conversation, a "Claude" sidebar section with live dots, ⌘L jumps to the last session. Sidebar sections now stack (Claude above Files).
- Design polish (branch `feature/design-polish`): San Francisco type with size-specific tracking, press feedback, menus that grow from the click, Welcome card entrance, sidebar rubber-band resize, one Claude header with a Working/Ready pill, warm editor colors, card shadows and rounded pane corners fixed, Reduce Motion and Increase Contrast support, headless test mode.
- Claude button (branch `feature/claude-button`): the sidebar's bottom button is now "Claude" and opens a new Claude terminal (⌘T); every Claude tab, header and session row uses the Claude starburst logo, pulsing while working and dimmed when stopped.
- v0.2 Claude chat (branch `feature/v0-2-claude-chat`): each Claude tab is a chat by default (streamed formatted replies, tool rows with diffs, Allow/Deny cards, question cards, live Working card, Tasks card when Claude keeps a to-do list, Stop, permission mode picker, drop a file to @mention it, recent conversations to reopen), with a Terminal switch that resumes the same conversation. Tabs remember their conversation across restarts.

## Next
- Notion-style redesign (branch `feature/notion-layout`, Dan chose "Like Notion" on 2026-11-16; reference: his Notion app screenshot):
  - Flat, full window: no wallpaper (remove wallpaper.svg, useWallpaper, get/chooseWallpaper IPC, menu item, `wallpaperPath`), no floating cards. Sidebar flush left (`#F7F7F5`, 1px right border), one white page area, panes split by 1px lines (dockview theme gap 0, no radius/shadow, overlay radius 0).
  - Traffic lights in the sidebar's top row next to the folder name (row ~44px, `trafficLightPosition` to match).
  - Tab strip like Notion: gray strip, tabs ~240px with vertical dividers, active tab white and joined to the page, close on hover; empty strip area is a window drag region. Breadcrumbs under the tabs (editor already has them).
  - Sidebar view icons at the top (like Notion's Home/inbox row and VS Code's activity bar): active view shows icon + label in a gray pill. Views show one at a time (not stacked):
    - Files: header buttons New File, New Folder, Refresh, Collapse All, hidden-files toggle.
    - Claude: conversations list + New session, plus Account & Usage like the VS Code Claude panel: Session (5hr) % and Weekly (7 day) % bars with reset times. Data comes from `rate_limit_event` lines in the chat stream (`rate_limit_info.unifiedWindows.five_hour|seven_day.{utilization,resetsAt}`); keep the last values in localStorage so they show on startup.
  - Later (Dan): notifications view and more.
  - Update e2e tests (sessions now live in the Claude view) and check screenshots in headless mode.

## Known issues
- `npm audit`: 6 moderate warnings in electron-builder's minimatch (build tool only, not in the app).
- In dev mode the menu bar says "Electron"; the built `.app` says "VISION".
- The main UI bundle is about 1.9 MB; Monaco is already lazy loaded. Fine for a local app, revisit if startup feels slow.
- No app icon yet (uses Electron's default).
