import type { Feature } from '../renderer/core/feature';
import { claudeTerminalFeature } from './claude-terminal';
import { editorFeature } from './editor';
import { explorerFeature } from './explorer';
import { inboxFeature } from './inbox';

/**
 * Renderer parts of every feature. Adding a feature = a new folder in src/features/
 * and one line here (plus src/main/registry.ts if it has a main-process part).
 * Order matters: sidebar view icons follow this order (Files first).
 */
export const features: Feature[] = [explorerFeature, claudeTerminalFeature, inboxFeature, editorFeature];
