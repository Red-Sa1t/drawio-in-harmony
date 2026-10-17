import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = 'electron-v37.2.0-win32-x64.zip';
const base = 'https://github.com/electron/electron/releases/download/v37.2.0/';
const destination = path.join(root, 'toolchains', filename);
async function download(name) {
  const response = await fetch(base + name, { signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`Download ${name}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const sums = await download('SHASUMS256.txt');
const expected = sums.toString().split('\n').find(line => line.trim().endsWith(filename))?.split(/\s+/)[0];
if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Missing official SHA256');
const data = await fs.readFile(destination).catch(() => download(filename));
const actual = crypto.createHash('sha256').update(data).digest('hex');
if (actual !== expected) throw new Error('Electron archive checksum mismatch');
await fs.writeFile(destination, data);
await fs.writeFile(path.join(root, 'toolchains/electron-v37.2.0-SHASUMS256.txt'), sums);
const evidence = { source: base + filename, platform: 'win32', arch: 'x64', electron: '37.2.0',
  bytes: data.length, sha256: actual, verifiedAgainst: base + 'SHASUMS256.txt',
  purpose: 'Host probe validation only; not the HarmonyOS runtime' };
await fs.writeFile(path.join(root, 'validation/host-electron.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
