import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../..');
const fakeClaude = join(projectRoot, 'tests/e2e/fixtures/fake-claude.mjs');

/** A throwaway folder with a few files, and settings that open it on launch. */
export function makeFixture(): { folder: string; userData: string } {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'vision-folder-')));
  writeFileSync(join(folder, 'hello.md'), '# Hello\n');
  mkdirSync(join(folder, 'notes'));
  writeFileSync(join(folder, 'notes', 'idea.txt'), 'An idea\n');
  const userData = mkdtempSync(join(tmpdir(), 'vision-userdata-'));
  writeFileSync(join(userData, 'state.json'), JSON.stringify({ windows: [{ folder, bounds: null }], recentFolders: [folder] }));
  return { folder, userData };
}

/** process.env without ELECTRON_RUN_AS_NODE (set when tests run inside VS Code), which would start Electron as plain Node. */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value;
  }
  return env;
}

/** `projectsDir` stands in for ~/.claude/projects; a fresh empty one when not given. */
export async function launch(userData: string, projectsDir = mkdtempSync(join(tmpdir(), 'vision-transcripts-'))): Promise<{ app: ElectronApplication; page: Page }> {
  // Set VISION_E2E_APP to the built VISION.app binary to test the packaged app instead of the dev build.
  const packaged = process.env['VISION_E2E_APP'];
  const app = await electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [projectRoot] }),
    env: {
      ...cleanEnv(),
      VISION_USER_DATA: userData,
      VISION_CLAUDE_COMMAND: fakeClaude,
      VISION_CLAUDE_PROJECTS_DIR: projectsDir,
      // Background mode: nothing shows on screen.
      VISION_HEADLESS: '1',
    },
  });
  const page = await app.firstWindow();
  return { app, page };
}
