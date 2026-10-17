import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const format = process.argv[2] || 'png';
if (!['png', 'pdf', 'svg'].includes(format)) throw new Error('Expected png, pdf or svg');
const outputDir = path.join(root, 'validation/application-host');
fs.mkdirSync(outputDir, {recursive: true});
const output = path.join(outputDir, `basic.${format}`);
const child = spawn(path.join(root, 'toolchains/electron-v37.2.0-win32-x64/electron.exe'), [
  path.join(root, 'application'), '--export', '--format', format, '--output', output,
  path.join(root, 'validation/fixtures/basic.drawio'), '--disable-update'
], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
const logs = [];
child.stdout.on('data', data => logs.push(data));
child.stderr.on('data', data => logs.push(data));
let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
child.on('error', error => { clearTimeout(timer); throw error; });
child.on('close', (code, signal) => {
  clearTimeout(timer);
  fs.writeFileSync(path.join(outputDir, `${format}.log`), Buffer.concat(logs));
  const evidence = {platform: 'win32', electron: '37.2.0', format, code, signal, timedOut,
    output, bytes: fs.existsSync(output) ? fs.statSync(output).size : 0,
    scope: 'Real draw.io Desktop CLI export on Windows; no target-device equivalence claimed.'};
  fs.writeFileSync(path.join(outputDir, `${format}.json`), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  if (code !== 0 || timedOut || !evidence.bytes) {
    console.error(Buffer.concat(logs).toString().slice(-5000));
    process.exitCode = 1;
  }
});
