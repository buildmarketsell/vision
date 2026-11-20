import type { Feature } from '../renderer/core/feature';
import { boardFeature } from './board';
import { claudeTerminalFeature } from './claude-terminal';
import { editorFeature } from './editor';
import { explorerFeature } from './explorer';
import { calendarFeature } from './calendar';
import { contentFeature } from './content';
import { inboxFeature } from './inbox';
import { settingsFeature } from './settings';
import { todoFeature } from './todo';
import { notionFeature } from './notion';

/**
 * Renderer parts of every feature. Adding a feature = a new folder in src/features/
 * and one line here (plus src/main/registry.ts if it has a main-process part).
 * Order matters: the menu and the Workspace tabs (Files, Claude, Calendar) follow this order (Workspace first, Dan's order 2026-11-19), and the first file handler
 * that matches a file wins, so the editor (matches everything) stays last.
 */
export const features: Feature[] = [explorerFeature, todoFeature, boardFeature, notionFeature, claudeTerminalFeature, calendarFeature, contentFeature, inboxFeature, settingsFeature, editorFeature];
