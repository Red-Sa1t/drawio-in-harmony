// Copies the Electron runtime binaries that this repository does not redistribute
// from the pinned OHCodium checkout (upstream/ohcodium-runtime, see RUNTIME.md)
// into the HarmonyOS project. Only binaries and Chromium resources are copied;
// no adapted source file is touched. electron.hnp is produced at build time by
// patch-hnp-permission.mjs from the same checkout.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, 'upstream/ohcodium-runtime');
const source = path.join(runtime, 'ohos_hap');
const target = path.join(root, 'harmony/DrawioHarmony');
const commit = '6a52cc1aaa3580bccede7708968276600987835b';

if (!fs.existsSync(source)) {
  throw new Error('Clone https://github.com/HanversionOvO/MKCode into upstream/ohcodium-runtime first');
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: runtime, encoding: 'utf8' }).trim();
if (head !== commit) throw new Error(`upstream/ohcodium-runtime must be at ${commit}, found ${head}`);

const libs = ['libadapter.so', 'libc++_shared.so', 'libelectron.so', 'libffmpeg.so'];
const resfile = ['chrome_100_percent.pak', 'chrome_200_percent.pak', 'electron', 'icudtl.dat', 'locales',
  'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin'];
const copied = [];
for (const name of libs) {
  const from = path.join(source, 'electron/libs/arm64-v8a', name);
  if (fs.statSync(from).size < 1024) throw new Error(`${name} is an LFS pointer; run git lfs pull in the runtime checkout`);
  fs.mkdirSync(path.join(target, 'electron/libs/arm64-v8a'), { recursive: true });
  fs.copyFileSync(from, path.join(target, 'electron/libs/arm64-v8a', name));
  copied.push(`electron/libs/arm64-v8a/${name}`);
}
for (const name of resfile) {
  const from = path.join(source, 'web_engine/src/main/resources/resfile', name);
  fs.cpSync(from, path.join(target, 'web_engine/src/main/resources/resfile', name), { recursive: true });
  copied.push(`web_engine/src/main/resources/resfile/${name}`);
}
console.log(JSON.stringify({ runtimeCommit: commit, copied }, null, 2));
