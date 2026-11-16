# VISION

Dan's personal macOS workspace: a file tree, a code editor and Claude Code side by side, on floating cards over a wallpaper. Personal use only.

The plan is in `IMPLEMENTATION_PLAN.md`, progress in `PROGRESS.md`, rules for coding agents in `AGENTS.md`.

## Setup

Needs Node 22+ and the `claude` CLI, installed and signed in (run `claude` once in Terminal).

```sh
npm install        # also downloads Electron and prepares the terminal helper
```

## Work on it (live preview)

```sh
npm run dev
```

VISION opens. Changes to the UI (`src/renderer`, `src/features/*/renderer`) show up instantly. Changes to the main process (`src/main`, `src/features/*/main`) restart the app by themselves.

## Check it

```sh
npm run typecheck  # TypeScript
npm test           # unit tests
npm run test:e2e   # builds, then drives the real app (uses a fake `claude`, costs nothing)
```

## Build the Mac app

```sh
npm run dist       # creates dist/mac-arm64/VISION.app
```

Drag `VISION.app` to `/Applications`. It is signed ad-hoc (free, no Apple account), so the first time: right-click it, choose Open, then Open.

## Customize

Colors, radii, spacing and fonts: `src/renderer/theme.ts`. Wallpaper: View > Change Wallpaper. New features: see "Adding a feature" in `AGENTS.md`.
