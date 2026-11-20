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
- Glass only on the two side panels (Dan chose it on 2026-11-19, replacing "solid surfaces only"): docked, the window is see-through and macOS's own frosted glass shows behind them (`vibrancy: 'sidebar'` in `windows.ts`; `body:has(.app-shell)` is transparent and each `main` paints `--color-card`); floating (peek), they blur the page with `backdrop-filter`. Tints are `--color-glass*` in every theme; macOS's light/dark follows the theme (`app.setScheme` → `nativeTheme.themeSource`). Reduce Transparency makes them solid again. `visualEffectState: 'active'` keeps the glass when VISION isn't the front app: with 'followWindow' macOS turned docked panels flat gray, which Dan didn't like (2026-11-20). Everything else stays solid; depth comes from `--shadow-card`, `--shadow-control`, `--shadow-popover`.
- Nested corners are concentric: inner radius = outer radius minus the inset.
- Menus and popovers grow from where they were opened (`transform-origin`).

## Page layout (Dan, 2026-11-20: "make some general rules for the future that will ensure everything looks nice")
Every page that fills the window uses the shared page frame in `styles.css`; never invent a page's own margins, widths or title size. To-do's board once sat 24px from the window edge with the menus hidden while every other page was centered.
- `.page-column`: centered, `--page-width` 900px, side margin `--page-gutter` (24px on narrow windows up to 96px on wide, like Notion), top `--page-top`. Dashboards add `data-width="wide"` (1200px). VISION's Notion pages use the same tokens.
- `.page-title`: the one big title (32px, bold). Icon above, controls below, in that order.
- `.page-wide`: boards and wide tables run to the window's right edge but start exactly under the title.
- `.page-bleed`: lists whose rows have their own padding bleed into the margin, so row text lines up with the title and only hover backgrounds stick out.
- A page's own rule that changes the frame's padding or margin uses a compound selector (`.content-column.page-column`), so it wins whatever order the CSS files load in.
- Spacing only from the 4/8/12/16/24/32/48 scale (`--space-*`), colors only from theme tokens.
- Check every new page with the menu and sidebar both open and hidden, at 1440 and 900 wide. `tests/e2e/pageFrame.spec.ts` checks To-do, Content and Settings that way; add each new page to its list.

## Menu (left) and sidebar (right) (Dan, 2026-11-19)
- Left: the feature menu (`FeatureMenu.tsx`), Notion-style rows in registry order: Workspace, To-do, Boards, Database, Calendar, Content, Inbox, and Settings pinned at the bottom (`pinBottom`). New features show up here; Dan has many planned. Its button sits right of the traffic lights (76px) and never moves; ⌘\\ does the same. Saved per folder as `menuCollapsed`.
- Right: the sidebar (`Sidebar.tsx`) shows the picked feature's panel (files for Workspace), folder name on top, Claude button at the bottom, resized from its left edge. Button top right; ⌘⇧\\ and View menu. Saved per folder as `sidebarCollapsed`, width as `sidebarWidth`.
- Each menu item opens its own thing (Dan, 2026-11-19: "each view from the menu should open its thing"): a view's `main` fills the window instead of the panes (which stay alive underneath). Workspace and Claude show the panes; To-do, Boards (the board picked on the right), Database, Calendar (week), Inbox and Settings have pages. A view without `component` has no sidebar panel, so the sidebar steps aside (To-do, Inbox, Settings). Pages without `ownTopBar` get an empty 36px top row for the lights and buttons.
- The two panel buttons are portaled to the end of `<body>`: Electron applies drag areas in page order, so a page's draggable top row placed after a button swallowed its clicks in the real window (Dan couldn't open the menu on the Inbox page, 2026-11-19). Tests can't click through drag areas; `sidebar.spec.ts` checks the order instead.
- Anything that measures itself (auto-height boxes, terminals) can mount hidden behind a menu page and measure 0: skip the measurement then. The chat box shrank to nothing when VISION started on Inbox (2026-11-19); `sidebar.spec.ts` guards it.
- Hidden panels peek like Notion: hovering the window edge (`.edge-zone`) or the panel button slides the panel out floating over the page; leaving closes it after 250 ms (`usePeek`).
- Top row is 36px like Notion's tab bar (`titleBarHeight` in `theme.ts`, traffic lights at y 12 in `windows.ts`; change both together). With the menu hidden, the top-left pane's strip (`.dock-corner`) leaves `--title-bar-inset` (112px); with the sidebar hidden, the top-right one (`.dock-corner-right`) leaves `--title-bar-inset-right` (44px). Both measured in `Dock.tsx`.

## Look (Dan, 2026-11-19: "look at how beautiful notion is... i want our app to be that beautiful")
- Notion is the reference for every screen: flat gray sidebar, plain icons, soft gray hover and selection, colored tags (`--color-tag-*`), big bold page titles. Compare with a Notion screenshot before calling a screen done.
- Claude header shows no "Ready": the pill appears only for Working, Needs you, Starting, Stopped (Dan: "that ready has absolutely no point").
- No bars about connectors (needs sign-in, failed to connect): Claude says so when it needs one (Dan asked twice on 2026-11-19; the unit test in `banners.test.ts` guards it). Only "Browser connected" and usage limits get bars (`chatBanners.ts`).
- While Claude works, the chat shows Claude Code's line, not a card: a twinkling orange ✻, a playful verb and the seconds (`WorkingLine` in `LiveCards.tsx`). Dan: "i like it more the way its in claude code".

## To-do (`src/features/todo/`)
- Saved on this Mac in `userData/todos.json` (Dan chose this over syncing Notion Tasks, 2026-11-19), app-wide, through `src/main/jsonListStore.ts` (shared with the Inbox). Statuses To do / In progress / Done (`src/shared/todos.ts`).
- Picking To-do in the menu fills the window with the To-do page (no sidebar panel). The page has a List / Board switch, remembered in localStorage. Board: drag cards between columns; right-click a row or card to rename, move or delete; double-click to rename.

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
- Calendar page (Dan, 2026-11-19: "que sea mi calendario tipo como notion calendar"): picking Calendar in the menu fills the window with Notion Calendar's week (Monday first, 48px per hour, all-day row, now line, today's date in an accent circle). Prev/next/Today; click an empty slot (snapped to 30 min) or New event to add one in a popover. Layout math in `weekLayout.ts` (unit tested). Weeks come from `calendar:range` (max 62 days, cached 3 min, cleared after adding an event or changing accounts).
- Drag on empty space to pick a stretch (quarter hours, either direction, like Google Calendar; Dan 2026-11-19); a plain click picks an hour from the half hour. The picked stretch stays shaded while the popover is open. Math in `weekLayout.ts` (`minutesAt`, `dragRange`, `clickRange`).
- Popovers on a page go through `createPortal(…, document.body)`: dock panes clip fixed-position children.
- While the browser sign-in is open, the view shows "Waiting for Google…" with Cancel (3-minute limit). Before this, a sign-in Google blocked left every button silently disabled and Dan thought Save was broken (2026-11-19). Disabled buttons now look disabled (styles.css).
- Tests: `VISION_GOOGLE_TEST_BASE` points sign-in and the API at `tests/e2e/fixtures/fake-google.ts`, which also stands in for the browser.

## Content (`src/features/content/`)
- Menu item for Dan's content work (Dan, 2026-11-20: "we're going to add a lot of stuff there"). First part: a dashboard of YouTube and Instagram numbers (`ContentPage.tsx`), full page, no sidebar panel. New content tools go on this page or as sections next to it.
- YouTube: an API key from Dan's Google Cloud project (YouTube Data API v3) + his channel handle; public numbers only (subscribers, total views, videos, latest 12 videos). Watch time would need a Google sign-in with `yt-analytics.readonly`: not built. Instagram: a long-lived token from a Meta app (Instagram API with Instagram login; Business/Creator accounts only); profile, latest posts, 28-day insights. The token is renewed weekly (`refresh_access_token`).
- Both checked against the platform before saving, so a wrong key never replaces a working one. Secrets encrypted in `userData/content.json` via `src/main/secrets.ts` (shared with Calendar). Main caches 10 minutes (YouTube's free quota).
- One reading a day per platform is saved (`history`, kept after disconnecting) and draws the growth line and "+N in 7 days"; logic in `src/shared/content.ts` (unit tested). Numbers are formatted in English on purpose (`format.ts`).
- Charts are bklit's "gradient glow" (Dan, 2026-11-20, bklit.com/recipes): a smooth line (monotone curve, never overshoots a reading; `chartPath.ts`, unit tested) over an accent fill that fades down and out at both sides, no grid; hover shows a dot, a tooltip card and the date as a dark pill. YouTube's chart switches Subscribers / Views (the shared `.segmented` switch). Focus the chart and use ← → to read each day. Tiles with history get bklit's "quiet sparkline". Styles in `chart.css`; colors follow the accent.
- Tests: `VISION_CONTENT_TEST_BASE` points both APIs at `tests/e2e/fixtures/fake-social.ts`; `content.spec.ts`.

## Workspace panel tabs (Dan, 2026-11-19)
- The Workspace sidebar has VS Code-style tabs in its top row (`WorkspacePanel.tsx`, `header` on the view): Files, Claude, Calendar, from features' `workspaceTabs` in registry order. Files shows the folder name and its action buttons below the tabs. Calendar here is the quick "what's next" list (`CalendarView`), not the week page. Replaced the short-lived Usage button.

## Claude tab (usage and past chats)
- Usage card on top, then Past chats: the folder's saved conversations, newest first (Dan, 2026-11-19: "usage box at the top and instead of open sessions i want past chats"). Open tabs are no longer listed there; the tab strip shows them. Clicking a past chat goes to its tab if open, else opens it in a new tab (`newClaudeSession(sessionId, title)`). `SessionsView.tsx`.

## Claude chat (stream-json)
- Copying text from the chat puts plain text only on the clipboard (`copyAsPlainText` in `ChatView.tsx`), so a Google Doc pastes it in its own font and sizes (Dan, 2026-11-19). Runs of empty lines become exactly one (`textForDocument` in `chat/copyText.ts`, unit tested): Dan wants one empty line between paragraphs in the doc, not two. The chat keeps its own look. Guarded by the first test in `workspace.spec.ts`.
- Messages sent while Claude works go to Claude at once, like Claude Code in VS Code (Dan, 2026-11-20; replaced the "sends when done" queue). Checked with the real CLI: a user message written to stdin mid-turn is read at the next tool step and answered in the same turn (one `result`); one that arrives too late starts the next turn. The reducer handles both.
- Image tabs: dragging the picture starts a real file drag (`startTreeDrag`), because other apps can't open `vision-file://` (Dan couldn't drop images into a Google Doc, 2026-11-20). Test: `explorerFinder.spec.ts`.
- Actions menu (Dan, 2026-11-20, after Claude Code's in VS Code): the "/" button left of the permission mode opens `ActionsMenu.tsx` over the full width of the message box: Filter actions…, then Context (attach image, mention a file, new chat), Model (+ effort), Permissions, Slash commands. List and filter are pure in `chat/actions.ts` (unit tested). Rewind, Bookmarks and Export aren't built; add them here when they are.
- Copy icons like VS Code (Dan, 2026-11-20: "nice looking and discrete"): one in each code block's top-right corner (`addCopyButtons` in `Markdown.tsx`, copies the code only) and one under the last text of each answer (`CopyButton`, `isLastTextOfAnswer` in `chat/copyText.ts`, copies the reply as plain text via `textForDocument`). Both stay invisible until hovered, focused or just used. The e2e test records the clipboard in the page so it never overwrites the Mac's.
- Layout follows Claude Code in VS Code (Dan, 2026-11-17): your prompts are full-width bordered cards, Claude's replies have a dot in the tool-row icon column with text aligned to the tool labels, extra space before each new prompt. Styles in `src/renderer/styles/chat.css`.
- VISION runs `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-prompt-tool stdio` and sends `{"type":"control_request","request":{"subtype":"initialize"}}` first. Without `--permission-prompt-tool stdio`, permission requests are denied on the spot (`--permission-prompts host` alone is not enough).
- Permission requests and AskUserQuestion arrive as `control_request` / `can_use_tool`; answer with `control_response` (`behavior: allow` + `updatedInput`, answers in `updatedInput.answers`). Stop = `control_request` subtype `interrupt`.
- Real recorded sessions live in `tests/fixtures/claude/` and drive the reducer tests. When the CLI changes, record again and update those files.
- Effort: new chats start with `--effort medium`; the model picker's Effort row changes it mid-chat with `control_request` subtype `apply_flag_settings`, `settings: { effortLevel }`. Claude answers success even to an unknown level, so main checks it against `EFFORT_LEVELS` first.
- New chats start in `auto` permission mode (Dan, 2026-11-17: "I want it to actually edit automatically"). `acceptEdits` still asked before every command. Don't change the default back.
- Chat names: with the first message VISION sends `control_request` subtype `generate_session_title` (`description` = that message, `persist: true`), like VS Code. Claude replies `{ title }` (request id `vision-title`) and saves it as an `ai-title` line, so the saved list shows it too. Without this, `-p` sessions never get an `ai-title` and the list fell back to the last prompt.
- When auto mode (or a rule or hook) refuses a tool, Claude sends `system` / `permission_denied` with `tool_use_id`: the tool's own row shows "Blocked by auto mode: <category>" and the full message on expand, never a banner (Dan, 2026-11-20: the long message as a pill "looks super ugly"). Notices are rounded boxes, not pills, so long text still reads well. Test: `chatFiles.spec.ts`, `chatDenials.test.ts`.
- Every file the chat mentions opens in a tab (Dan, 2026-11-20): file names in tool rows ("Edited page.html", inside the open folder only) and file names or paths Claude writes as `code` in a reply. `fileMention` (`src/shared/fileMentions.ts`) decides what looks like a file; `fs:locate` (`locateFile` in `main/workspace/findFiles.ts`) finds it in the folder by path, absolute path or bare name (shallowest match, never outside the folder or in hidden folders). Not found: the name is crossed out with "Not found in this folder".
- Folder paths in a reply (`outputs/images/`) reveal the folder in the files panel instead (Dan, 2026-11-20): `revealInFiles` (`renderer/core/reveal.ts`) calls the explorer's `revealPath`, which picks the Workspace view and Files tab, opens the sidebar, unfolds each parent, selects and scrolls to it.
- File tree: ⌘-click picks several rows (`picked` in `treeStore.ts`); dragging a picked row drags them all as a real macOS file drag (`startTreeDrag` → main `webContents.startDrag`), so they drop into Finder, Google Drive or any app (Dan, 2026-11-20). VISION's own drop targets then see plain files: `draggedTreePaths` (`core/treeDrag.ts`) tells tree files (chat mentions them, notes link them in place, the window ignores them) from Finder files. Right-click → Reveal in Finder (`shell.showItemInFolder`, `main/workspace/finderHandlers.ts`). Test: `explorerFinder.spec.ts` (it records the drag and Finder calls; nothing opens).
- File links in the chat (reply mentions and tool rows) open a menu on double-click or right-click: Show in Files, Open, Reveal in Finder, Copy Path (`FileLinkMenu.tsx`; Dan, 2026-11-20: "so i can drag and drop"). A single click waits 250 ms (`afterSingleClick`) so a double-click never also opens a tab. Menus inside dock panes must be portaled to the body or they land off-screen. Test: `chatFiles.spec.ts`.
- File search (Dan, 2026-11-20): magnifier in the Files header or ⌘P (`FileSearch.tsx`). Main walks the folder (`searchFolder` in `findFiles.ts`, skips hidden folders and node_modules); every typed word must appear in the path, accents ignored, best names first (`src/shared/fileSearch.ts`, unit tested). Results replace the tree while there is text; a file opens in a tab, a folder unfolds in the tree. Names only, not text inside files. Test: `fileSearch.spec.ts`.
- Image files open as a picture in their tab (`.image-view` in `EditorPanel.tsx`, through `vision-file://`), not "can't be shown as text". SVG stays editable as text.
- Saved conversations: `~/.claude/projects/<folder path with non-alphanumerics as ->/<session-id>.jsonl`; titles from `ai-title` lines. Read-only; never touch credentials.

## Themes
- One file per theme in `src/renderer/themes/` (colors, shadows, editor syntax colors), listed in `themes/index.ts`; the picker is in Settings. Started 2026-11-17 with VISION Light and Catppuccin Mocha (MIT palette); Dan will add more.
- New theme: copy `catppuccinMocha.ts`, fill every color (TypeScript checks none are missing), add it to `THEMES`. Never hard-code a color in CSS or components: add a token to `visionLight.ts` (which defines the list) and every theme.
- `src/renderer/core/appTheme.ts` applies the chosen one as CSS variables and remembers it; the terminal and Monaco follow it (`activeTheme()`, `monacoThemeName`). `theme.ts` keeps only what all themes share (sizes, radii, motion).

## Settings (gear after the Inbox)
- `src/features/settings/`: the sidebar view for settings, and where Dan will add his other app features (Dan, 2026-11-17). Each new setting or feature gets its own section in `SettingsView.tsx`; state shared with another feature goes in `src/renderer/core`.

## Colors and neon (Dan, 2026-11-20)
- Settings → Colors: accent (Theme default, 7 presets, any color via the Mac's picker) and the neon around the chat box (follows the accent by default), plus Neon on/off. `src/renderer/core/customColors.ts`, saved in localStorage `vision.colors`.
- The overrides are set on `<body>`; themes write theirs on `<html>`, so Dan's colors win and survive theme switches. Hover, soft fill and focus ring are mixed from the accent with `color-mix`; text on accent buttons picks white or near-black by contrast (`readableOn`, `src/shared/customColors.ts`, unit tested).
- Neon: `.neon` ring in `Composer.tsx`, styles in `chat-controls.css`: a rotating conic gradient masked to a 1.5px ring, transform-only animation, faster while Claude works, still under reduced motion. Test: `settingsColors.spec.ts`.

## Terminal light / dark
- Sun/moon button in the Claude panel header (Terminal view) switches every terminal; remembered in localStorage (`src/renderer/core/terminalTheme.ts`, shared because Settings sets it too). It sets `body[data-terminal-theme]`, which overrides the `--color-terminal-*` variables (terminal.css), so terminal-colored parts of the chat follow too.
- Claude Code's own colors follow on their own: with its theme on `auto` it asks the terminal for its background (OSC 11) at start, and xterm.js answers with the current one. Checked 2026-11-17 in Claude's debug log (`detected=light`). A terminal already open keeps Claude's colors until Restart.

## Images in Markdown
- Pasted or dropped images are saved in `images/` next to the note (`src/shared/markdownImages.ts`, main side `saveImageNextTo`). Chosen 2026-11-17 so pictures sit with the note they belong to; it matches the BUSINESS OS rule (`assets/` = templates, `outputs/images/` = generated).
- Local images reach the page only through `vision-file://local/<path>` (`src/main/workspace/imageProtocol.ts`): image extensions only, inside an open folder only. The CSP `img-src` and DOMPurify's `ALLOWED_URI_REGEXP` in `Markdown.tsx` both list the scheme; keep the three in sync.

## HTML preview (Dan, 2026-11-19: "if im coding an html page ... preview it directly inside VISION")
- `.html`/`.htm` tabs open in Preview with a Preview / Code switch and a reload button (`HtmlPreview.tsx`). The frame loads the file from disk through `vision-preview://local/<path>` (`src/main/workspace/previewProtocol.ts`), so relative CSS, JS, images and fonts work. It reloads after each save and when any file in the page's folder changes.
- Safety: the frame is sandboxed without same-origin (its scripts can't reach VISION), and the scheme serves only web file types inside an open folder, never anything hidden (`.env`, `.git`): rules in `src/shared/htmlPreview.ts`, unit tested; the e2e test checks a page can't read `.env`. The scheme is registered in the same `registerSchemesAsPrivileged` call as images (Electron allows one). CSP `frame-src` lists it.
- Next (not built): a browser tab for local dev servers (`localhost:5173`).

## Motion and scrollbars (Dan, 2026-11-20, after beui.dev's motion components)
- Feature menu and file tree: hover and selection are pills that glide between rows (`components/GlideHighlight.tsx`, `styles/glide.css`): `HoverGlide` follows the pointer and keyboard focus, `SelectedGlide` follows the selected row. The list needs `position: relative` and the pills come before its rows.
- File tree (`explorer/renderer/file-tree.css`): new rows fade in 25 ms apart (max 100 ms), a guide line under each open folder, folder icons turn as they open. Selection stays a static background.
- Scrollbars: no track, thin rounded thumb in the theme's `syntax.scrollbar` colors, shown only while scrolling or pointed at (`core/scrollbars.ts` sets `data-scrolling` / `data-scrollbar-hover`; `styles/scrollbars.css`). Never set `scrollbar-color`/`scrollbar-width`: Chromium then ignores the `::-webkit-scrollbar` styles.
- Theme switch: beui's circle blur via the View Transitions API (`revealTheme` in `core/appTheme.ts`, `styles/theme-reveal.css`): the new theme grows from the click, 700 ms, blur 8px → 0. Instant under reduced motion.
- Grain on both menus (`styles/grain.css`, after beui's grain gradient shader, done in CSS instead of WebGL so it can run all day): four drifting color clouds from `--color-grain1…4` (pastel in light themes, faint in dark so text stays readable) plus SVG film grain. Hidden with Reduce Transparency. Every theme needs the four grain colors.
- All in CSS (transform/opacity, `--ease`), no motion library. Test: `motion.spec.ts`.

## Boards (Excalidraw)
- `src/features/board/`: any `.excalidraw` file opens as a board tab; "New Board" in the Files header creates `Untitled board.excalidraw` at the folder's top level. Chosen 2026-11-17 over tldraw, whose SDK needs a licence key outside development; Excalidraw is MIT.
- Boards home (Dan, 2026-11-20: "nicely organized like you see them in figma… create folders"): Boards in the menu with no board open shows `BoardsHome.tsx`, after Figma's file browser. Recents = every board by last edit; Folders = real folders on disk that hold boards (at any depth) or are empty, so Claude and Finder see the same thing. Cards (`BoardCard.tsx`) show a picture of the board (`boardThumbnails.ts`: Excalidraw's `exportToBlob`, made one at a time, cached per edit time) or, for a folder, its three latest boards. Right-click or "…": Open, Rename, Duplicate, Move to…, Move to Trash; drag a card onto a folder or the breadcrumb to move it. Folder logic is pure in `boardLibrary.ts` (unit tested); actions in `libraryActions.ts`; main has `fs.move` (never overwrites) and `fs.modifiedTimes`. A board with videos saved next to it refuses to move alone (its links would break). The sidebar panel (`BoardsView.tsx`) is Figma's left column: Recents, All folders, then each folder. Any change made in VISION calls `libraryChanged()` so home and sidebar reload. The board's menu has "All boards" to come back. Test: `boardsHome.spec.ts`.
- Boards save on their own 300 ms after a change (no ⌘S, no unsaved dot). A file that isn't Excalidraw JSON is shown as an error and never saved over. When the file changes on disk (Claude, git), the board reloads unless an edit is waiting to save.
- Looks like FigJam (Dan, 2026-11-20: "i want my boards to be more like figjam… but also keep the good stuff"; was tldraw's layout since 2026-11-17): Excalidraw's own controls are hidden in `board.css` and VISION draws floating white cards around the canvas: top left the menu, the board's name and folder, then undo/redo/delete/duplicate (`BoardCorners.tsx`); style panel top right (`StylePanel.tsx`), kept from tldraw; FigJam's big rounded toolbar at the bottom in groups with the sticky-note stack in the middle (`BoardToolbar.tsx`); zoom bottom right, hidden below 760 px where it would sit under the toolbar. Excalidraw's shortcuts, right-click menu and text editing still work. Below 900 px wide the style panel shows only while drawing or with a selection.
- Canvas background: a theme-colored page (`--color-board-canvas`) behind a see-through Excalidraw canvas (`CANVAS_BACKGROUND = 'transparent'`), with FigJam's dot grid (`--color-board-dot`) drawn on its own `<canvas class="board-dots">` by `useDotGrid` (Dan, 2026-11-20: "when you zoom out the points look super nice, ours get super big and weird"). Zooming out, dots get smaller and lighter, and every other dot fades out before the grid doubles, so it never jumps; math in `dotGrid.ts` (unit tested). A CSS pattern was used before: at fractional sizes it drew uneven, blurry dots. Every theme needs both colors.
- Smoothness (same day, "figjam is incredibly smooth"): `window.EXCALIDRAW_THROTTLE_RENDER = true` (Excalidraw's opt-in: one draw per screen frame, a trackpad sends more events than that); pinch and ⌘-scroll zoom by a steady percentage (`useSmoothZoom`, math in `boardZoom.ts`) instead of Excalidraw's fixed step, with `shouldCacheIgnoreZoom` while zooming; the `<Excalidraw>` element is memoized so the zoom label re-rendering never re-renders the board; saving runs only when shapes, files or the new-shape style change (`contentKey`, Excalidraw's `hashElementsVersion`), never on scroll, so panning a board full of images doesn't re-write its file.
- tldraw's style model (12 colors, fill, dash, size S–XL, font) maps onto Excalidraw fields in `boardStyle.ts` (pure, unit tested). Drawing colors there are fixed values, not theme tokens: they are saved in the files and Excalidraw inverts the canvas in dark mode. Same for the selection blue in `board.css`.
- Undo, redo, delete, duplicate and the shortcuts dialog press Excalidraw's own keys on its container (`pressKey`), because Excalidraw has no public API for them.
- Any Mac font, any text size, any color (Dan, 2026-11-19). Fonts: `macFonts.ts` lists them with Chromium's `queryLocalFonts` (Electron grants it; no prompt) and adds each family, quoted, to Excalidraw's `FONT_FAMILY` table, which is all Excalidraw needs to draw and measure it. The saved font number is a hash of the name (`macFontId` in `boardFonts.ts`), so it's the same on every Mac; a missing font falls back to the default. Boards wait for the list before drawing. Size: typed px in the style panel (Enter or leaving the field applies). Color: "Custom color" opens VISION's own picker, after beui's motion color picker (Dan, 2026-11-20): square + hue slider with a loupe while dragging, eyedropper, HEX/RGB/HSL fields (`CustomColor.tsx`, `ColorPicker.tsx`, `ColorDrag.tsx`, `ColorFields.tsx`, `color-picker.css`; math in `colorMath.ts`, unit tested). No alpha: boards store #rrggbb (`hexOf`). Animations are CSS (transform/opacity, `--ease`), no motion library. Dragging previews with `CaptureUpdateAction.EVENTUALLY`; release, Enter or the eyedropper makes one undo step. Test: `boardText.spec.ts`.
- `restoreElements(..., { refreshDimensions: true })` does nothing unless `repairBindings: true` is also set (Excalidraw 0.18): text boxes kept their old size after a size change until 2026-11-19.
- Sticky notes are rectangles with `customData.boardNote`, so restyling keeps them notes (paper color only, dark text). N or the toolbar button adds one in the middle of the view and starts typing.
- Fonts: `scripts/postinstall.mjs` copies Excalidraw's fonts to `src/renderer/public/excalidraw/` (gitignored) so boards work offline; the CSP blocks the CDN fallback on purpose. Missing fonts after a fresh clone: run `npm install`.
- Known flaky test (since before 2026-11-20, about 1 run in 10 on main too): `board.spec.ts` sometimes finds the sticky note saved without its text. Probably the test types before the note's text box has focus; not yet looked into.
- Board files over 5 MB don't open (the shared file-read limit); pasted images make boards heavy.
- Media (Dan, 2026-11-19: "paste videos, images, websites"): images are Excalidraw's own. Any pasted web link becomes a live embed (`validateEmbeddable` = `isBoardEmbeddable` in `boardEmbeds.ts`). X and Reddit posts use their official embed pages (`renderEmbeddable`), because Excalidraw's version runs their scripts in the app page, which the CSP blocks. Instagram posts and reels (Dan, 2026-11-20) use `instagram.com/{p|reel}/ID/embed/`; the plain page shows a login wall in a frame. Share links with the account name first (`/name/reel/ID`) and `/reels/` work too.
- Video files dropped or pasted on a board are copied to `videos/` next to the board (a file already inside the board's folder is linked in place) and stored as an embeddable whose link is the relative path; `boardMedia.tsx` draws a native `<video>` through `vision-file://` (which streams videos with Range). Pasted files are read in `onPasteCapture`: once Excalidraw awaits, the clipboard's files are gone.
- Frames: `board/main/embedFrames.ts` drops X-Frame-Options and CSP `frame-ancestors` for sub-frames only, so most sites load, and adds a Referer to YouTube embeds (without one the built app gets YouTube error 153). CSP has `frame-src https: http:` and `media-src vision-file:`. Test: `tests/e2e/boardMedia.spec.ts`.

## Rebuild and restart (Dan's routine)
- When a change is done and tested, merge it into `main` and push. Then offer to rebuild and restart: restarting closes Dan's open chats, so ask first (he has said yes every time so far).
- Restart: quit VISION, `npm run dist` (with `ELECTRON_RUN_AS_NODE` unset), copy it to Applications (`ditto dist/mac-arm64/VISION.app /Applications/VISION.app`), then open `/Applications/VISION.app` with a clean environment (`env -i HOME=… USER=… SHELL=… LANG=… PATH=/usr/bin:/bin:/usr/sbin:/sbin open …`). Launched straight from a Claude Code session, VISION inherits its `CLAUDE_CODE_*` variables and the Claude panes inside it warn "Transcript saving is off".

## App icon
- `build/icon.icns` (eye under an arc, after Dan's reference, 2026-11-19), drawn by `scripts/make_icon.py`. To change it: edit the script, make `build/icon.png`, rebuild the `.icns` with `sips` + `iconutil`, then `npm run dist`.

## Gotchas
- `fileSearch.spec.ts` (⌘P focus) fails in the full e2e run but passes alone; it already did before 2026-11-20. Not fixed yet.
- Automated runs (tests, screenshots) must set `VISION_HEADLESS=1`: windows render but never show and there is no Dock icon, so nothing pops up on Dan's screen. The e2e tests already do.
- Tabs with `renderer: 'always'` (Claude, editors) draw on dockview's overlay layer, not inside the pane; style `.dv-render-overlay` too (its corners are rounded in styles.css).
- Tailwind scans `src/features` through `@source` in `styles.css`; keep that line or feature styles vanish.
- When run from inside VS Code, `ELECTRON_RUN_AS_NODE=1` is set and Electron starts as plain Node. The tests and `npm run dev` remove it; for any other Electron command, run `unset ELECTRON_RUN_AS_NODE` first.
- Never touch `window.webContents` after a window closes (it throws); use `WindowContext.webContents`.
- node-pty uses its prebuilt binary (no rebuild). `scripts/postinstall.mjs` makes its `spawn-helper` executable because npm blocks node-pty's own install script.
