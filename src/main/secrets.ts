import { safeStorage } from 'electron';

/** The Keychain can't encrypt right now; its message is shown to Dan as is. */
export class KeychainUnavailableError extends Error {
  constructor() {
    super('This Mac cannot keep the sign-in safe right now (Keychain unavailable).');
  }
}

/** Encrypts a secret with the macOS Keychain for saving in a JSON file. */
export function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) throw new KeychainUnavailableError();
  return safeStorage.encryptString(value).toString('base64');
}

/** The secret back, or null if it is missing or can't be decrypted on this Mac. */
export function decryptSecret(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return null;
  }
}

