// Local fallback after devecocli's bundled Node 18 build stalled in this environment.
// ohpm dependencies are installed through devecocli first; SDK files are not modified.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--studio');
const supplied = index >= 0 ? process.argv[index + 1] : process.env.DEVECO_HOME;
if (!supplied) throw new Error('Pass --studio with the DevEco Studio root reported by devecocli');
const studio = path.resolve(supplied);
const hvigor = path.join(studio, 'tools/hvigor/hvigor/bin/hvigor.js');
if (!fs.existsSync(path.join(studio, 'product-info.json')) || !fs.existsSync(hvigor)) {
  throw new Error('Invalid DevEco Studio root');
}
const env = { ...process.env, DEVECO_SDK_HOME: path.join(studio, 'sdk'), JAVA_HOME: path.join(studio, 'jbr') };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
env[pathKey] = path.join(studio, 'jbr/bin') + path.delimiter + (env[pathKey] || '');
const stamp = new Date().toISOString().replaceAll(':', '-');
const logfile = path.join(root, `validation/hap-build-node22-${stamp}.log`);
const log = fs.createWriteStream(logfile);
const child = spawn(process.execPath, [hvigor, '--mode', 'module', '-p', 'module=electron@default',
  '-p', 'product=default', '-p', 'buildMode=debug', 'assembleHap', '--no-daemon', '--stacktrace'],
{ cwd: path.join(root, 'harmony/DrawioHarmony'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', data => { log.write(data); process.stdout.write(data); });
}
child.on('error', error => { log.end(String(error)); process.exitCode = 1; });
child.on('close', (code, signal) => {
  log.end();
  if (code === 0) {
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    const payload = JSON.parse(fs.readFileSync(path.join(root,
      'harmony/DrawioHarmony/web_engine/src/main/resources/resfile/resources/app/package.json'), 'utf8'));
    const kind = payload.name === 'draw.io' ? 'application' : 'probe';
    fs.copyFileSync(path.join(root, 'harmony/DrawioHarmony/electron/build/default/outputs/default/electron-default-unsigned.hap'),
      path.join(root, `artifacts/drawio-${kind}-api23-unsigned.hap`));
  }
  console.log(JSON.stringify({ code, signal, logfile, node: process.version }));
  process.exitCode = code === 0 ? 0 : 1;
});
