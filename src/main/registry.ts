import { registerClaudeTerminal } from '../features/claude-terminal/main/ptyHandlers';

/**
 * Main-process parts of features. Adding a feature with a main side = one line here.
 * (Renderer parts are listed in src/features/registry.ts.)
 */
export const mainFeatures: Array<() => void> = [registerClaudeTerminal];
