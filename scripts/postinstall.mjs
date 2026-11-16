// Runs after npm install: downloads the Electron binary and makes node-pty's
// prebuilt spawn-helper executable (npm blocks node-pty's own install script).
import { chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync('npx', ['install-electron'], { stdio: 'inherit' });

for (const arch of ['darwin-arm64', 'darwin-x64']) {
  const helperPath = `node_modules/node-pty/prebuilds/${arch}/spawn-helper`;
  if (existsSync(helperPath)) chmodSync(helperPath, 0o755);
}
