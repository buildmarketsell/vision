import type { Feature } from '../renderer/core/feature';
import { boardFeature } from './board';
import { claudeTerminalFeature } from './claude-terminal';
import { editorFeature } from './editor';
import { explorerFeature } from './explorer';
import { calendarFeature } from './calendar';
import { inboxFeature } from './inbox';
import { settingsFeature } from './settings';
import { todoFeature } from './todo';
import { databasesFeature } from './databases';

/**
 * Renderer parts of every feature. Adding a feature = a new folder in src/features/
 * and one line here (plus src/main/registry.ts if it has a main-process part).
 * Order matters: sidebar view icons follow this order (Files first), and the first file handler
 * that matches a file wins, so the editor (matches everything) stays last.
 */
export const features: Feature[] = [explorerFeature, claudeTerminalFeature, inboxFeature, todoFeature, databasesFeature, calendarFeature, settingsFeature, boardFeature, editorFeature];
