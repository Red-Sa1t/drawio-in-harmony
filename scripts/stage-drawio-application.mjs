// Stage the fixed Desktop app into the already verified native host.
// Retains the inert probe files so switching payloads never deletes source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'application');
const target = path.join(root, 'harmony/DrawioHarmony/web_engine/src/main/resources/resfile/resources/app');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const core = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: path.join(source, 'drawio'), encoding: 'utf8'}).trim();
if (core !== '9034053fba80a435e27d68d374bc564b83917ae9') throw new Error('Unexpected editor core commit');
for (const required of ['node_modules/electron-store/package.json', 'drawio/src/main/webapp/index.html',
  'drawio/src/main/webapp/js/app.min.js', 'src/main/harmony-runtime.js']) {
  if (!fs.existsSync(path.join(source, required))) throw new Error(`Missing ${required}`);
}
const entries = ['package.json', 'src/main', 'node_modules', 'vendor/electron-context-menu',
  'drawio/src/main/webapp', 'drawio/VERSION', 'drawio/LICENSE', 'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'LICENSES.chromium.html', 'build/icon.png'];
const inventory = [];
// Audited npm installation/development metadata omitted by Hvigor; no runtime files.
const dependencyMetadata = new Set(['.package-lock.json', '.runkit_example.js', '.coveralls.yml',
  '.eslintrc', '.eslintrc.yml', '.npmignore', '.travis.yml', '.gitattributes', '.github']);
function copy(relative) {
  const input = path.join(source, relative);
  const resolved = fs.realpathSync(input);
  if (!resolved.startsWith(source + path.sep)) throw new Error(`Dependency escapes application: ${relative}`);
  const stat = fs.statSync(input);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(input)) {
      if (name === '.git' || name === '.bin') continue;
      if (relative.startsWith('node_modules') && dependencyMetadata.has(name)) continue;
      copy(path.join(relative, name));
    }
  } else {
    const output = path.join(target, relative);
    fs.mkdirSync(path.dirname(output), {recursive: true});
    fs.copyFileSync(input, output);
    inventory.push({path: relative.replaceAll(path.sep, '/'), bytes: stat.size, sha256: hash(input)});
  }
}
for (const entry of entries) copy(entry);
const manifest = {kind: 'drawio-desktop', version: '32.4.1', core,
  observedAt: new Date().toISOString(), entry: 'src/main/electron.js', files: inventory};
fs.writeFileSync(path.join(root, 'validation/application-payload.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({kind: manifest.kind, files: inventory.length,
  bytes: inventory.reduce((sum, file) => sum + file.bytes, 0)}));
