import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.join(root, 'toolchains/electron-v37.2.0-win32-x64/electron.exe');
const output = path.join(root, 'validation/host-probe');
fs.mkdirSync(output, { recursive: true });
const child = spawn(executable, [path.join(root, 'probe'), '--probe-auto', `--probe-output=${output}`],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const stdout = [];
const stderr = [];
child.stdout.on('data', data => stdout.push(data));
child.stderr.on('data', data => stderr.push(data));
const timeout = setTimeout(() => child.kill(), 180000);
child.on('error', error => { clearTimeout(timeout); throw error; });
child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  fs.writeFileSync(path.join(output, 'launcher-stdout.log'), Buffer.concat(stdout));
  fs.writeFileSync(path.join(output, 'launcher-stderr.log'), Buffer.concat(stderr));
  console.log(Buffer.concat(stdout).toString());
  console.error(Buffer.concat(stderr).toString());
  console.log(JSON.stringify({ code, signal, evidenceScope: 'Windows Electron 37 host only' }));
  process.exitCode = code === 0 ? 0 : 1;
});
