import { registerClaudeChat } from '../features/claude-terminal/main/chatProcess';
import { registerClaudeTerminal } from '../features/claude-terminal/main/ptyHandlers';
import { registerTranscripts } from '../features/claude-terminal/main/transcripts';

/**
 * Main-process parts of features. Adding a feature with a main side = one line here.
 * (Renderer parts are listed in src/features/registry.ts.)
 */
export const mainFeatures: Array<() => void> = [registerClaudeTerminal, registerClaudeChat, registerTranscripts];
