# VISION: Implementation Plan

A personal desktop app for macOS: a calm, VS Code style workspace with Claude Code built in, styled after `reference/clonk.png`. Personal use only, never distributed. The app is called **VISION**; the name lives in one constant (`APP_NAME` in `src/shared/app.ts`).

The app starts small and grows for years. Two rules shape everything:

1. **It works on any folder.** Point it at a folder and it works, whatever is inside.
2. **Every feature is a module.** New things (a Miro-style canvas, a second brain, Notion, boards) plug in without rewriting the core.

---

## 0. Before any code (kickoff)

- [ ] `git init` in this folder, branch `main`, first commit with this plan, `reference/` and a `.gitignore` (`node_modules`, `out`, `dist`, `.env`, `.DS_Store`).
- [ ] Create a **private** GitHub repo and add it as `origin` (only after Dan's OK). From then on, push after every commit.
- [ ] Write `AGENTS.md` (project rules: stack, folder layout, naming, IPC pattern) and a one-line `CLAUDE.md` containing `@AGENTS.md`, because Claude Code reads `CLAUDE.md`, not `AGENTS.md`.
- [ ] `AGENTS.md` must say: "Follow `/Users/danromanciuc/Documents/BUSINESS OS/🧠 CONTEXT/coding-rules.md`. Read it before writing code." Those rules win over anything in this plan.
- [ ] Write `README.md`: what it is, setup, how to run in dev, how to build the `.app`.
- [ ] Write `PROGRESS.md`: done, next, known issues. Keep it short.

## 1. Core rules

### How Claude is connected
- Claude runs **only** through the official `claude` CLI, already logged in with Dan's Claude subscription.
- Never read, copy or reuse the CLI's auth token or credentials. Never call the Anthropic API directly. No API keys in this project.
- If `claude` isn't found, the Claude pane says: "Claude Code isn't installed. Install it, then run `claude` once in Terminal to sign in." With a Retry button.
- Apps opened from the Dock don't get the shell's PATH. On startup, run the login shell once (`$SHELL -ilc` printing PATH between two marker strings, 5 second timeout), parse the PATH between the markers, and use it for every child process. If it fails, fall back to the default PATH plus `/opt/homebrew/bin`, `/usr/local/bin` and `~/.local/bin`.

### Any folder works
- One window = one open folder. Several windows can be open at once (Cmd+Shift+N).
- Ways to open a folder: the Welcome screen (Open Folder button and recent folders), Cmd+O, and dragging a folder onto the window. Later (v0.3): dragging onto the Dock icon and a `ws <path>` terminal command.
- The app never assumes anything about the folder:
  - Not a git repo: hide git features silently.
  - Huge folders: the file tree loads one directory at a time. The watcher ignores `node_modules`, `.git`, `dist`, `build`, `out`, `.venv`, plus a configurable ignore list.
  - Hidden files are shown dimmed; a toggle hides them.
  - A folder that disappears while open: show "This folder was moved or deleted" with Open Folder.
- Claude always runs with `cwd` set to the open folder.

### Where data lives
- **App state** (window size, open tabs, pane layout, recent folders, settings): JSON in Electron's `userData` folder, with per-folder state keyed by the folder's path. The app never writes files into a folder just because it was opened, so it never dirties anyone's git repo.
- **Content Dan makes in the app** (boards, canvases, notes): plain files in the folder itself (under `.workspace/` or as normal files), so Claude can read them and git can version them. Created only when Dan creates that content.
- **Secrets** (Notion token etc.): encrypted with Electron `safeStorage` (its key is kept in the macOS Keychain) and saved in `userData`. Never plain text, never logged.

---

## 2. Stack

All free and open source.

- **Electron** + **electron-vite**, **React**, **TypeScript** in strict mode
- **Tailwind CSS**; every color, radius, spacing and font value in `src/renderer/theme.ts`
- **Monaco Editor** via `@monaco-editor/react`, **configured to load the local `monaco-editor` package** (`loader.config({ monaco })`, workers bundled by Vite). By default it loads from a CDN, which breaks offline.
- **xterm.js** (`@xterm/xterm`, `@xterm/addon-fit`) + **node-pty**. node-pty is a native module loaded from `node_modules` (electron-vite keeps it external). Its prebuilt binary works in Electron as is, so no rebuild; `scripts/postinstall.mjs` makes its helper executable.
- **dockview-react** for panes, tabs and dragging tabs between panes
- **chokidar** for file watching
- **zustand** for renderer state
- **lucide-react** icons
- **Inter** and **JetBrains Mono** bundled with the app (`@fontsource/*`), never loaded from a CDN
- **vitest** for unit tests, **Playwright** (its Electron support, `_electron.launch`) for one end-to-end test per feature
- **electron-builder** to build a local, unsigned `.app` (ad-hoc signed, free) into `/Applications`

Processes:
- `src/main/`: windows, file system, git, pty and claude processes, notifications, secrets
- `src/preload/`: a small typed bridge. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (so the preload must stay a single CommonJS bundle that only uses `contextBridge` and `ipcRenderer`).
- `src/renderer/`: all UI
- `src/shared/`: types and constants used by both sides (IPC channel types, `APP_NAME`)

Every IPC handler in main validates its input (paths must be inside the open folder unless the user picked them in a dialog).

---

## 3. Architecture: built to grow

### Core
The core does only what v0.1 needs, and grows when a feature needs more (no code "for later"):
- **Workspace:** open folder, file tree, read / write / watch files
- **Layout:** panes and tabs (dockview), saved and restored
- **Commands:** a registry of named actions with optional shortcuts (the command palette in v0.3 reads the same registry)
- **Storage:** read and write JSON in `userData` and in the folder

Added later, when the first feature needs it: settings schema per feature (v0.2), event bus (v0.2, Claude status), notifications service (v0.4).

### Features
Each feature lives in its own folder:

```
src/features/<name>/
  index.ts        // the manifest
  renderer/       // React components
  main/           // optional: IPC handlers for the main process
```

```ts
export interface Feature {
  id: string;
  name: string;
  sidebarViews?: SidebarView[];   // icon in the left rail + its panel
  tabTypes?: TabType[];           // what can open in a pane
  fileHandlers?: FileHandler[];   // which tab type opens which files
  commands?: Command[];
}
```

The interface only gets new fields when a feature needs them.

- Features are listed in `src/features/registry.ts` (renderer) and `src/main/registry.ts` (main-process handlers). Adding a feature = a new folder + one line in each registry.
- A feature never imports another feature's internals; it uses the core.
- IPC channels are typed in `src/shared/ipc.ts` and named `<feature>:<action>`.
- Each feature is wrapped in a React error boundary: if one breaks, its pane shows an error card with Reload, and the rest of the app keeps working.

v0.1 ships three features: `explorer`, `editor`, `claude-terminal`.

---

## 4. Look and feel

Follow section 8 of the coding rules (no emojis, no glassmorphism, no purple, useful text only, loading and error states everywhere).

**Direction (Dan, 2026-11-16): a combo of Notion and the clonk reference.**
- From **clonk** (`reference/clonk.png`): the wallpaper with floating rounded cards, the orange accent, the Claude pane with its live and task cards.
- From **Notion** (`reference/notion.png`, Dan's Notion app): the sidebar and page chrome. Warm off-white sidebar (`#F7F7F5`), workspace name at the top, a row of small icon buttons, sections with small gray labels ("Recents", "Files"), rows of icon + name with a soft rounded gray hover and a gray "selected" fill, no heavy borders. Tabs with file icons along the top of each pane, a breadcrumb bar under them (`folder / sub / file.md`), lots of white space, calm text. A rounded "New chat" pill at the bottom of the sidebar that focuses Claude.

- A soft landscape wallpaper behind the window (configurable). Panels float on top as **solid** rounded cards (radius 16px), with soft shadows and 8px gaps. No blur or see-through panels.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 px only.
- Fonts: Inter for the interface, JetBrains Mono for code and terminal. No others.
- Accent: warm orange `#F26B3A` for the app icon, progress bars, active states and the live dot. Everything else calm grays. Check text contrast on every surface.
- Panels white or near-white, 1px borders `rgba(0,0,0,0.06)`.
- Icons: lucide, 1.5px stroke, gray, orange when active.
- macOS window: `titleBarStyle: 'hiddenInset'`, traffic lights sit inside the top-left card; the top strip of each card is a drag region (`-webkit-app-region: drag`), buttons inside it are `no-drag`.
- Light theme in v0.1, colors already as tokens so dark theme (v0.3) only adds a second set.
- Match the reference's feel, not its pixels or branding. Own name and own icon.

```
+------------+----------------------------------------------+
|  SIDEBAR   |  PANE TOOLBAR                                |
|  icon rail +----------------------+-----------------------+
|  + panel   |   Pane A             |   Pane B              |
|            |   (editor)           |   (Claude)            |
+------------+----------------------+-----------------------+
```

---

## 5. Build order

Each version runs on its own branch (`feature/v0-1-skeleton` etc.), split into small commits (`feat: ...`, `fix: ...`), pushed after every commit, merged into `main` when the version is done. At the end of each version: run the app, run the tests, check against the reference image, update `PROGRESS.md` and `README.md`, then stop for Dan's review.

"Done" for every item means: works end to end, has a loading state and an error state where it can wait or fail, is committed, docs updated.

### v0.1: The simple version (start here)
Goal: open any folder, edit files, work with Claude.

- [ ] Electron + electron-vite + React + TS window, hidden title bar, builds to a `.app`
- [ ] Core: workspace, layout, commands, storage (section 3)
- [ ] Wallpaper with floating cards
- [ ] Welcome screen: Open Folder + recent folders (remove missing ones from the list)
- [ ] Open any folder (Cmd+O, drag onto window), one folder per window, Cmd+Shift+N new window
- [ ] Explorer: lazy file tree, file icons, create / rename / delete (delete uses `shell.trashItem`, so files go to the Trash), live updates when files change
- [ ] Editor: open a file in Monaco, Cmd+S saves, unsaved dot on the tab, reloads when changed on disk (asks first if there are unsaved edits), refuses binary files and files over 5 MB with a clear message
- [ ] Two panes side by side with tabs (dockview), Claude terminal in the right pane
- [ ] Claude terminal: `claude` in the open folder through node-pty, themed, Restart button, resizes correctly, process killed when its window closes
- [ ] Restores windows, folders, tabs and pane sizes on relaunch
- [ ] Clear states for: no folder, `claude` not found, file can't be read, folder removed
- [ ] Tests: unit tests for storage and path checks; one Playwright test that opens a temp folder, edits and saves a file, and sees the Claude pane start

**Done when** it works on three folders: a code repo, Dan's BUSINESS OS folder (emoji folder names, spaces in paths) and an empty folder.

### v0.2: Custom Claude interface (the reason for this app)
**Step 1, before any UI:** run one real session with
`claude -p --input-format stream-json --output-format stream-json --verbose`
(check `claude --help` for `--include-partial-messages`, which streams text as it's written) and save every raw event to a log file in `userData/logs/`. Build the parser from those real events, not from guesses. Turn a few of them into parser tests.

- [ ] Claude runs in the background with stream-json and stays alive between messages; sessions resume with `--resume <session_id>` (the id comes from the first event)
- [ ] **Header:** app icon, status ("Building · 4/7", "Idle", "Waiting for you"), model badge
- [ ] **Live card:** dark rounded card, pulsing orange "BUILDING" and "LIVE" labels with dots, streams Claude's latest text and tool activity in monospace
- [ ] **Tasks card:** built from Claude's todo or task tool events (use the tool names the logs show, not a hardcoded one), "Tasks 4/7" with an orange progress bar, click to expand the checklist
- [ ] **Conversation:** messages, tool calls as one-line rows that expand
- [ ] **Input:** Enter sends, Shift+Enter new line, Stop button (interrupts the run), drop a file from the explorer to mention it
- [ ] **Permissions.** Headless mode can't ask in a terminal; any tool that needs approval is refused. Two steps:
  1. A Settings choice of permission mode (`default`, `acceptEdits`, `plan`) and an allowed-tools list, passed as CLI flags.
  2. A small local MCP server inside the app, registered with `--mcp-config`, whose tool is passed to `--permission-prompt-tool`. Claude's permission requests then show as Allow / Deny cards in the chat. Build this as a standalone prototype first (coding rules, section 7), then bring it in.
- [ ] Questions Claude asks mid-task show as a card Dan can answer
- [ ] "Raw terminal" toggle keeps the v0.1 terminal one click away
- [ ] Past sessions for this folder, click one to resume. Read the session list from what the CLI stores for that folder under `~/.claude/projects/` (read-only, never touch credential files); if that format changes, the list hides and resume by id still works.
- [ ] The parser never crashes: unknown events are logged and shown as a small gray row
- [ ] Tests: parser unit tests from the real samples; one Playwright test with a fake `claude` script that prints recorded events

### v0.3: Workspace polish
- [ ] Drag tabs between panes, split right / down, close pane
- [ ] Tab types: Markdown (preview + edit toggle), image, PDF (Chromium's built-in viewer), web page
- [ ] Web page tab: a `WebContentsView` with a URL bar. It is drawn by the main process on top of the page, so its bounds must follow its pane, and it must hide while menus, the command palette or tab dragging are open.
- [ ] Pane toolbar: diff stat chip from `git diff HEAD --shortstat` (green / red; counts staged and unstaged changes, not untracked files; hidden outside git repos), buttons for code, browser, tasks, Claude; expand and toggle-sidebar on the right
- [ ] Search panel across the folder with `@vscode/ripgrep` (add its binary to `asarUnpack` in electron-builder), debounced
- [ ] Command palette (Cmd+Shift+P) and quick open (Cmd+P)
- [ ] Dark theme toggle
- [ ] Open folders dropped on the Dock icon (`open-file` event, plus a `CFBundleDocumentTypes` entry for folders in electron-builder `extendInfo`)
- [ ] `ws <path>` command: a small shell script installed to `~/.local/bin` (no admin password needed) that runs `open -a "<APP_NAME>" --args <path>`; the app uses `requestSingleInstanceLock` and the `second-instance` event to open the folder in a new window

### v0.4: Notifications
- [ ] One notifications service in the core: macOS notifications (Electron `Notification`) and an in-app list (bell icon, history)
- [ ] Claude notifies when it finishes or needs input, only when the window isn't focused; clicking it focuses the right window and pane
- [ ] Settings: which notifications are on, do-not-disturb
- Note: macOS shows notifications properly only from the built `.app`, not from dev mode. Allow them once in System Settings > Notifications.

### Later (each one is a feature module, in whatever order Dan wants)
Scope each one with Dan before building it. These are directions, not specs.
- **Boards:** kanban (columns, draggable cards) saved as JSON in `.workspace/boards/`, so Claude can read and edit them.
- **Canvas (Miro-style):** an infinite whiteboard tab built on Excalidraw (`@excalidraw/excalidraw`, MIT, free). Saved as `.excalidraw` files in the folder.
- **Second brain:** markdown notes with `[[links]]`, backlinks, tags, daily note, graph view, full-text search. Notes are plain `.md` files in the folder.
- **Notion:** sidebar panel for one database (status, open as tab, quick add). `@notionhq/client` in the main process only, token stored as in section 1.
- **Suggested features:** a second small `claude -p` call that returns 3 suggestions as JSON; "+" sends one as the next prompt. It uses Dan's Claude plan limits, so it runs only on request.

---

## 6. Quality rules (on top of the coding rules)

- The app must run after every commit.
- No `any` anywhere. Files under 300 lines, functions under 50.
- Never block the UI: file system, git and Claude work happens in main and streams results to the renderer.
- Kill every child process (pty, claude, watchers, MCP server) when its window closes or the app quits.
- Logs go to `~/Library/Logs/<APP_NAME>/main.log`. Never log file contents, tokens or secrets.
- Lazy load heavy parts (Monaco, PDF, web view, canvas).
- Run `npm audit` at the end of every version.
- Coding rules items that don't apply here: database / RLS rules (no database), `.env.example` (no keys).

## 7. Rules for the agent

- Read this plan, `AGENTS.md` and `reference/clonk.png` before each version.
- Work one version at a time and stop for Dan's review at the end of each.
- If a step is harder than planned, stop and give 2-3 options before going around it.
- Before adding a dependency, check it's maintained, free, and works with the current Electron version, and that it isn't something under 50 lines of own code.
- Don't add anything this plan doesn't list. Ask first.
