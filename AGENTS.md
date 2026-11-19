# VISION: project rules

## Read before writing any code
1. `/Users/danromanciuc/Documents/BUSINESS OS/💻 CODING/CLAUDE.md` and what it points to. These rules win over anything else in this repo.
2. `IMPLEMENTATION_PLAN.md` and `reference/clonk.png`.
3. `PROGRESS.md` to see where things stand.

## Project
VISION is Dan's personal macOS desktop app: a VS Code style workspace with Claude Code built in. Personal use only, never distributed. Stack, layout and build order are in `IMPLEMENTATION_PLAN.md`.

## Conventions
- Branches: `feature/...`, `fix/...`, `experiment/...`. Never work on `main`; merge locally when a version is done.
- Commits: `type: short description`, then `git push origin <branch>`.
- Remote: private GitHub repo `vision` (account `buildmarketsell`).
- Claude only through the `claude` CLI. No API keys, never touch its credentials.

## Checks (run on their own before Claude can finish)
- `npm run check` = lint (Oxlint, `.oxlintrc.json`) + typecheck + unit tests. The Stop hook in `.claude/settings.json` runs it and sends failures back. Before merging, also `VISION_HEADLESS=1 npm run test:e2e`.
- Oxlint, not ESLint: TypeScript 7 has no JS API, so typescript-eslint cannot run here (checked 2026-11-17).
- Lint enforces: no `any`, files under 300 lines, no `console.log`, React rules (no ref writes or impure calls during render), and the main/renderer import boundary. A rule is disabled on a line only with `-- reason` saying why the rule is wrong there.
- "Latest value" refs: use `useLatest` (`src/renderer/core/useLatest.ts`), never `ref.current = x` during render.

## Folder layout
- `src/main/`: app start (`index.ts`), windows and session restore (`windows.ts`), menu, saved state (`appState.ts` pure, `stateStore.ts` disk), login-shell PATH (`shellEnv.ts`), path checks (`paths.ts`), file system and watcher (`workspace/`).
- `src/preload/index.ts`: the only bridge; exposes `window.vision` (type `VisionApi` in `src/shared/ipc.ts`).
- `src/shared/`: types, IPC channel names (`IPC`), constants (`app.ts`).
- `src/renderer/`: `App.tsx`, `theme.ts` (all design tokens), `styles.css`, `core/` (feature types and index, commands and shortcuts, dock and its actions, workspace store, tab status), `components/` (Sidebar, Markdown, Welcome, Workspace, ErrorBoundary, ContextMenu, fileIcons).
- `src/features/<name>/`: `index.ts` (manifest), `renderer/`, optional `main/`.
- `tests/unit/` (vitest), `tests/e2e/` (Playwright driving Electron, with `fixtures/fake-claude.mjs`, which fakes both the terminal and the stream-json chat).

## Adding a feature
1. Create `src/features/<name>/index.ts` exporting a `Feature` (see `src/renderer/core/feature.ts`).
2. Add it to `src/features/registry.ts`. If it has main-process code, add its register function to `src/main/registry.ts`.
3. New IPC: add the channel to `IPC` and the method to `VisionApi` in `src/shared/ipc.ts`, then to `src/preload/index.ts`. Validate every argument in main; paths must pass `isInsideFolder`.
4. Features never import each other's files. Shared things go in `src/renderer/core` or `src/renderer/components`.

## Design rules (Apple principles + Dan's coding rules)
- System font (San Francisco) and SF Mono; type classes `.title`, `.display`, `.caption`, `.section-label` carry size-specific tracking. Don't add fonts.
- Feedback on press (`:active`), animate only transform and opacity, easing `var(--ease)` (critically damped, no overshoot). Every animation has a calmer version under `prefers-reduced-motion`.
- Solid surfaces only: no blur or glass (coding rules ban glassmorphism). Depth comes from `--shadow-card`, `--shadow-control`, `--shadow-popover`.
- Nested corners are concentric: inner radius = outer radius minus the inset.
- Menus and popovers grow from where they were opened (`transform-origin`).

## Top bar and sidebar button
- Top row is 36px like Notion's tab bar (Dan, 2026-11-19: "la barra de arriba más pequeñita como en notion"); `titleBarHeight` in `theme.ts`, traffic lights at y 12 in `windows.ts`. Change both together.
- Sidebar button (`SidebarToggle` in `Sidebar.tsx`) sits right of the traffic lights and never moves; ⌘\\ does the same. Hidden state is saved per folder (`sidebarCollapsed` in the layout). When hidden, the top-left pane's tab strip (`.dock-corner`, measured in `Dock.tsx`) leaves `--title-bar-inset` (112px) free for the lights and the button.

## Look (Dan, 2026-11-19: "look at how beautiful notion is... i want our app to be that beautiful")
- Notion is the reference for every screen: flat gray sidebar, plain icons, soft gray hover and selection, colored tags (`--color-tag-*`), big bold page titles. Compare with a Notion screenshot before calling a screen done.
- Sidebar view switcher: a row of plain icons, the open view on a soft gray square (`.view-row`), icons only so more views still fit. Replaced the orange gradient tray.
- Claude header shows no "Ready": the pill appears only for Working, Needs you, Starting, Stopped (Dan: "that ready has absolutely no point").
- No bars about connectors (needs sign-in, failed to connect): Claude says so when it needs one (Dan asked twice on 2026-11-19; the unit test in `banners.test.ts` guards it). Only "Browser connected" and usage limits get bars (`chatBanners.ts`).
- While Claude works, the chat shows Claude Code's line, not a card: a twinkling orange ✻, a playful verb and the seconds (`WorkingLine` in `LiveCards.tsx`). Dan: "i like it more the way its in claude code".

## To-do (`src/features/todo/`)
- Saved on this Mac in `userData/todos.json` (Dan chose this over syncing Notion Tasks, 2026-11-19), app-wide, through `src/main/jsonListStore.ts` (shared with the Inbox). Statuses To do / In progress / Done (`src/shared/todos.ts`).
- Sidebar view = checklist with two buttons that open the To-do page as a list or a board. The page has a List / Board switch, remembered in localStorage. Board: drag cards between columns; right-click a row or card to rename, move or delete; double-click to rename.

## Notion view (`src/features/notion/`)
- The table icon in the sidebar's icon row turns the whole window into Notion (Dan, 2026-11-19: "when i click on the button i want a notion view to open… everything changes. but the buttons up there dont"). A sidebar view with `main` replaces the panes (`Workspace.tsx`); the panes stay mounted underneath so Claude chats keep running, and any new tab (⌘T) switches back to them (`showPanes` in `Dock.tsx`). `ownBottomBar` hides the Claude button row. The active view lives in `core/activeView.ts`.
- VISION's own pages, not Dan's real Notion (Dan chose this, 2026-11-19). Saved app-wide in `userData/pages.json` and `databases.json`. Both sync through `createSyncedList` (`renderer/syncedList.ts`): edits show at once, page edits save 300 ms after typing stops (flushed on quit), broadcasts are skipped while saves are on their way.
- Pages: parent (sub-pages), emoji icon, cover (Notion color or an image shrunk to WebP, max 1.5 MB as a data URL), favorite, blocks. Blocks are a flat list with `indent` (Tab nests; a closed toggle hides deeper blocks). Pure logic in `src/shared/pageOps.ts` (unit tested): markdown shortcuts, what Enter makes, numbering, moving.
- Editor (`BlockEditor.tsx`, keys in `editorActions.ts`): one textarea per block. After an edit the caret is placed after the redraw (`FocusKeeper.focus`); arrows use `focusNow`. Two siblings must never share a React key: the title and the block list once did and left stale titles on screen.
- Databases: typed columns (Title always first), Notion's nine tag colors (`--color-tag-*`), table and board (grouped by the first Select), rows open in a side peek with notes. Shown full page, inline in a page (`/database`), or in an old dock tab (`DatabasePanel`, kept so saved layouts restore). Edits are pure in `src/shared/databaseOps.ts`.

## Calendar (`src/features/calendar/`)
- Google Calendar API with Google sign-in (Dan, 2026-11-19: "i want to be able to add events and also connect more calendars"; replaced the read-only iCal link). Dan's own Google Cloud project gives the Client ID/secret (Desktop app type), pasted once in the Calendar view.
- Sign-in: browser + loopback redirect on 127.0.0.1 with PKCE (`googleAuth.ts`), scopes `calendar.readonly` + `calendar.events`. Any number of accounts; all their calendars appear, each in Google's color, show/hide per calendar (default follows Google's `selected`; missing means hidden).
- Secrets: client secret and refresh tokens are encrypted with `safeStorage` (Keychain) in `userData/calendar.json` (mode 600), never sent to the page or logged (`calendarConfig.ts`).
- Main fetches 14 days (`singleEvents=true`, Google expands repeats), cached 3 minutes; the view refreshes every 5. New events: `toGoogleEvent` in `src/shared/calendar.ts` validates the form; timed events use the Mac's time zone, all-day ends the next day (Google's rule).
- If Google drops a sign-in (`invalid_grant`), that account shows "sign in again". Keep the Google Cloud app "In production": in Testing, Google expires sign-ins after 7 days.
- Calendar page (Dan, 2026-11-19: "que sea mi calendario tipo como notion calendar"): the Open calendar button in the Calendar view opens a tab with Notion Calendar's week (Monday first, 48px per hour, all-day row, now line, today's date in an accent circle). Prev/next/Today; click an empty slot (snapped to 30 min) or New event to add one in a popover. Layout math in `weekLayout.ts` (unit tested). Weeks come from `calendar:range` (max 62 days, cached 3 min, cleared after adding an event or changing accounts).
- Drag on empty space to pick a stretch (quarter hours, either direction, like Google Calendar; Dan 2026-11-19); a plain click picks an hour from the half hour. The picked stretch stays shaded while the popover is open. Math in `weekLayout.ts` (`minutesAt`, `dragRange`, `clickRange`).
- Popovers on a page go through `createPortal(…, document.body)`: dock panes clip fixed-position children.
- While the browser sign-in is open, the view shows "Waiting for Google…" with Cancel (3-minute limit). Before this, a sign-in Google blocked left every button silently disabled and Dan thought Save was broken (2026-11-19). Disabled buttons now look disabled (styles.css).
- Tests: `VISION_GOOGLE_TEST_BASE` points sign-in and the API at `tests/e2e/fixtures/fake-google.ts`, which also stands in for the browser.

## Claude sidebar view
- Usage card on top, then Past chats: the folder's saved conversations, newest first (Dan, 2026-11-19: "usage box at the top and instead of open sessions i want past chats"). Open tabs are no longer listed there; the tab strip shows them. Clicking a past chat goes to its tab if open, else opens it in a new tab (`newClaudeSession(sessionId, title)`). `SessionsView.tsx`.

## Claude chat (stream-json)
- Layout follows Claude Code in VS Code (Dan, 2026-11-17): your prompts are full-width bordered cards, Claude's replies have a dot in the tool-row icon column with text aligned to the tool labels, extra space before each new prompt. Styles in `src/renderer/styles/chat.css`.
- VISION runs `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-prompt-tool stdio` and sends `{"type":"control_request","request":{"subtype":"initialize"}}` first. Without `--permission-prompt-tool stdio`, permission requests are denied on the spot (`--permission-prompts host` alone is not enough).
- Permission requests and AskUserQuestion arrive as `control_request` / `can_use_tool`; answer with `control_response` (`behavior: allow` + `updatedInput`, answers in `updatedInput.answers`). Stop = `control_request` subtype `interrupt`.
- Real recorded sessions live in `tests/fixtures/claude/` and drive the reducer tests. When the CLI changes, record again and update those files.
- Effort: new chats start with `--effort medium`; the model picker's Effort row changes it mid-chat with `control_request` subtype `apply_flag_settings`, `settings: { effortLevel }`. Claude answers success even to an unknown level, so main checks it against `EFFORT_LEVELS` first.
- New chats start in `auto` permission mode (Dan, 2026-11-17: "I want it to actually edit automatically"). `acceptEdits` still asked before every command. Don't change the default back.
- Chat names: with the first message VISION sends `control_request` subtype `generate_session_title` (`description` = that message, `persist: true`), like VS Code. Claude replies `{ title }` (request id `vision-title`) and saves it as an `ai-title` line, so the saved list shows it too. Without this, `-p` sessions never get an `ai-title` and the list fell back to the last prompt.
- Saved conversations: `~/.claude/projects/<folder path with non-alphanumerics as ->/<session-id>.jsonl`; titles from `ai-title` lines. Read-only; never touch credentials.

## Themes
- One file per theme in `src/renderer/themes/` (colors, shadows, editor syntax colors), listed in `themes/index.ts`; the picker is in Settings. Started 2026-11-17 with VISION Light and Catppuccin Mocha (MIT palette); Dan will add more.
- New theme: copy `catppuccinMocha.ts`, fill every color (TypeScript checks none are missing), add it to `THEMES`. Never hard-code a color in CSS or components: add a token to `visionLight.ts` (which defines the list) and every theme.
- `src/renderer/core/appTheme.ts` applies the chosen one as CSS variables and remembers it; the terminal and Monaco follow it (`activeTheme()`, `monacoThemeName`). `theme.ts` keeps only what all themes share (sizes, radii, motion).

## Settings (gear after the Inbox)
- `src/features/settings/`: the sidebar view for settings, and where Dan will add his other app features (Dan, 2026-11-17). Each new setting or feature gets its own section in `SettingsView.tsx`; state shared with another feature goes in `src/renderer/core`.

## Terminal light / dark
- Sun/moon button in the Claude panel header (Terminal view) switches every terminal; remembered in localStorage (`src/renderer/core/terminalTheme.ts`, shared because Settings sets it too). It sets `body[data-terminal-theme]`, which overrides the `--color-terminal-*` variables (terminal.css), so terminal-colored parts of the chat follow too.
- Claude Code's own colors follow on their own: with its theme on `auto` it asks the terminal for its background (OSC 11) at start, and xterm.js answers with the current one. Checked 2026-11-17 in Claude's debug log (`detected=light`). A terminal already open keeps Claude's colors until Restart.

## Images in Markdown
- Pasted or dropped images are saved in `images/` next to the note (`src/shared/markdownImages.ts`, main side `saveImageNextTo`). Chosen 2026-11-17 so pictures sit with the note they belong to; it matches the BUSINESS OS rule (`assets/` = templates, `outputs/images/` = generated).
- Local images reach the page only through `vision-file://local/<path>` (`src/main/workspace/imageProtocol.ts`): image extensions only, inside an open folder only. The CSP `img-src` and DOMPurify's `ALLOWED_URI_REGEXP` in `Markdown.tsx` both list the scheme; keep the three in sync.

## Boards (Excalidraw)
- `src/features/board/`: any `.excalidraw` file opens as a board tab; "New Board" in the Files header creates `Untitled board.excalidraw` at the folder's top level. Chosen 2026-11-17 over tldraw, whose SDK needs a licence key outside development; Excalidraw is MIT.
- Boards save on their own 300 ms after a change (no ⌘S, no unsaved dot). A file that isn't Excalidraw JSON is shown as an error and never saved over. When the file changes on disk (Claude, git), the board reloads unless an edit is waiting to save.
- Looks like tldraw (Dan, 2026-11-17: "as similar to tldraw as you can"): Excalidraw's own controls are hidden in `board.css` and VISION draws tldraw's layout around the canvas: menu + undo/redo/delete/duplicate top left (`BoardCorners.tsx`), style panel top right (`StylePanel.tsx`), zoom bottom left, tools along the bottom (`BoardToolbar.tsx`). Excalidraw's shortcuts, right-click menu and text editing still work. Below 900 px wide the style panel shows only while drawing or with a selection.
- tldraw's style model (12 colors, fill, dash, size S–XL, font) maps onto Excalidraw fields in `boardStyle.ts` (pure, unit tested). Drawing colors there are fixed values, not theme tokens: they are saved in the files and Excalidraw inverts the canvas in dark mode. Same for the selection blue in `board.css`.
- Undo, redo, delete, duplicate and the shortcuts dialog press Excalidraw's own keys on its container (`pressKey`), because Excalidraw has no public API for them.
- Sticky notes are rectangles with `customData.boardNote`, so restyling keeps them notes (paper color only, dark text). N or the toolbar button adds one in the middle of the view and starts typing.
- Fonts: `scripts/postinstall.mjs` copies Excalidraw's fonts to `src/renderer/public/excalidraw/` (gitignored) so boards work offline; the CSP blocks the CDN fallback on purpose. Missing fonts after a fresh clone: run `npm install`.
- Board files over 5 MB don't open (the shared file-read limit); pasted images make boards heavy.

## Rebuild and restart (Dan's routine)
- When a change is done and tested, merge it into `main` and push. Then offer to rebuild and restart: restarting closes Dan's open chats, so ask first (he has said yes every time so far).
- Restart: quit VISION, `npm run dist` (with `ELECTRON_RUN_AS_NODE` unset), copy it to Applications (`ditto dist/mac-arm64/VISION.app /Applications/VISION.app`), then open `/Applications/VISION.app` with a clean environment (`env -i HOME=… USER=… SHELL=… LANG=… PATH=/usr/bin:/bin:/usr/sbin:/sbin open …`). Launched straight from a Claude Code session, VISION inherits its `CLAUDE_CODE_*` variables and the Claude panes inside it warn "Transcript saving is off".

## App icon
- `build/icon.icns` (eye under an arc, after Dan's reference, 2026-11-19), drawn by `scripts/make_icon.py`. To change it: edit the script, make `build/icon.png`, rebuild the `.icns` with `sips` + `iconutil`, then `npm run dist`.

## Gotchas
- Automated runs (tests, screenshots) must set `VISION_HEADLESS=1`: windows render but never show and there is no Dock icon, so nothing pops up on Dan's screen. The e2e tests already do.
- Tabs with `renderer: 'always'` (Claude, editors) draw on dockview's overlay layer, not inside the pane; style `.dv-render-overlay` too (its corners are rounded in styles.css).
- Tailwind scans `src/features` through `@source` in `styles.css`; keep that line or feature styles vanish.
- When run from inside VS Code, `ELECTRON_RUN_AS_NODE=1` is set and Electron starts as plain Node. The tests and `npm run dev` remove it; for any other Electron command, run `unset ELECTRON_RUN_AS_NODE` first.
- Never touch `window.webContents` after a window closes (it throws); use `WindowContext.webContents`.
- node-pty uses its prebuilt binary (no rebuild). `scripts/postinstall.mjs` makes its `spawn-helper` executable because npm blocks node-pty's own install script.
