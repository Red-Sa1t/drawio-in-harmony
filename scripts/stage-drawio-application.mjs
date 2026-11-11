// Stage the fixed Desktop app into the already verified native host.
// Like upstream electron-builder (asar: true), the app ships as a single
// resources/app.asar instead of loose source files; only license texts stay
// loose next to it. Development sources excluded by upstream's "files" filter
// are dropped as well.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'application');
const resources = path.join(root, 'harmony/DrawioHarmony/web_engine/src/main/resources/resfile/resources');
const asarPath = path.join(resources, 'app.asar');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const core = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: path.join(source, 'drawio'), encoding: 'utf8'}).trim();
if (core !== '9034053fba80a435e27d68d374bc564b83917ae9') throw new Error('Unexpected editor core commit');
for (const required of ['node_modules/electron-store/package.json', 'drawio/src/main/webapp/index.html',
  'drawio/src/main/webapp/js/app.min.js', 'src/main/harmony-runtime.js']) {
  if (!fs.existsSync(path.join(source, required))) throw new Error(`Missing ${required}`);
}
const entries = ['package.json', 'src/main', 'node_modules', 'vendor/electron-context-menu',
  'drawio/src/main/webapp', 'drawio/VERSION', 'drawio/LICENSE', 'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'LICENSES.chromium.html', 'build/icon.png', 'build/harmony-icon.png'];
const looseLicenses = ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'LICENSES.chromium.html'];
// Audited npm installation/development metadata omitted by Hvigor; no runtime files.
const dependencyMetadata = new Set(['.package-lock.json', '.runkit_example.js', '.coveralls.yml',
  '.eslintrc', '.eslintrc.yml', '.npmignore', '.travis.yml', '.gitattributes', '.github']);
// Mirrors the "files" exclusions of upstream electron-builder-*.json.
const webapp = 'drawio/src/main/webapp/';
const keepDiagramly = new Set([`${webapp}js/diagramly/ElectronApp.js`, `${webapp}js/diagramly/DesktopLibrary.js`]);
function excluded(rel) {
  if (rel.endsWith('.map') || /(^|\/)WEB-INF(\/|$)/.test(rel)) return true;
  if (rel.startsWith(`${webapp}stencils/`) && rel.endsWith('.xml')) return true;
  if (rel.startsWith(`${webapp}shapes/`) || rel.startsWith(`${webapp}js/grapheditor/`)) return true;
  if (rel.startsWith(`${webapp}mxgraph/src/`) || rel === `${webapp}mxgraph/mxClient.js`) return true;
  if (rel.startsWith(`${webapp}js/diagramly/`) && !keepDiagramly.has(rel)) return true;
  return /^node_modules\/@cantoo\/pdf-lib\/(cjs|dist|src|ts3\.4)\//.test(rel);
}

// Store-listing consistency (AppGallery guideline 1.20): the editor's loading
// splash is an inline orange draw.io SVG that shows before any runtime CSS can
// apply, so the packaged index.html gets the app icon instead. The upstream
// submodule stays untouched.
const splashPage = `${webapp}index.html`;
const splashIcon = fs.readFileSync(path.join(source, 'build/harmony-icon.png')).toString('base64');
function contents(rel) {
  const data = fs.readFileSync(path.join(source, rel));
  const strings = uiStrings(rel, data);
  if (strings) return strings;
  if (rel === `${webapp}js/diagramly/ElectronApp.js`) {
    // Open-dialog file type label ("draw.io Diagrams"): use the localized "Diagram".
    const from = "{ name: 'draw.io Diagrams',";
    const source = data.toString('utf8');
    if (source.split(from).length !== 2) throw new Error('Open-dialog filter label not found once in ElectronApp.js');
    return Buffer.from(source.replace(from, "{ name: mxResources.get('diagram'),"), 'utf8');
  }
  if (rel === appBundle) {
    if (!data.includes('EditorUi.prototype.getSelectedLayoutContainers=')) {
      throw new Error('app.min.js no longer defines getSelectedLayoutContainers; revisit the layout shim');
    }
    // The template dialog writes a hardcoded "draw.io" category heading; use
    // the (renamed) resource string instead.
    // Help > Website / Support pointed at JGraph's site and support wiki, which
    // implies affiliation and sends users to JGraph; point them at this port.
    const swaps = [
      ['mxUtils.write(Ya,"draw.io")', 'mxUtils.write(Ya,mxResources.get("draw.io"))'],
      ['d.actions.addAction("website...",function(){d.openLink("https://www.drawio.com")})',
        'd.actions.addAction("website...",function(){d.openLink("https://red-sa1t.github.io/drawio-in-harmony/")})'],
      ['d.openLink("https://github.com/jgraph/drawio-desktop/wiki/Getting-Support")',
        'd.openLink("https://github.com/Red-Sa1t/drawio-in-harmony/issues")'],
    ];
    let bundle = data.toString('utf8');
    for (const [from, to] of swaps) {
      if (bundle.split(from).length !== 2) throw new Error(`Expected exactly one occurrence in app.min.js: ${from}`);
      bundle = bundle.replace(from, to);
    }
    return Buffer.from(bundle + layoutShim + appNameShim, 'utf8');
  }
  if (rel !== splashPage) return data;
  const html = data.toString('utf8');
  const svg = /<svg class="geSplashLogo"[\s\S]*?<\/svg>/;
  if (!svg.test(html)) throw new Error('Splash logo not found in index.html');
  return Buffer.from(html.replace(svg,
    `<img class="geSplashLogo" alt="" src="data:image/png;base64,${splashIcon}" style="border-radius:16px">`), 'utf8');
}

// Upstream draw.io v32.4.1 renamed EditorUi.getSelectedLayoutContainer() to
// getSelectedLayoutContainers(), but the prebuilt js/extensions.min.js (ELK and
// libavoid auto layout) still calls the old name, so every Arrange > Layout run
// threw "getSelectedLayoutContainer is not a function". The packaged app.min.js
// gets the old method back with its documented contract: the selected layout
// container when the selection is exactly one such vertex, otherwise null.
const appBundle = `${webapp}js/app.min.js`;
const layoutShim = '\n;if(typeof EditorUi!=="undefined"&&typeof EditorUi.prototype.getSelectedLayoutContainer!=="function")' +
  '{EditorUi.prototype.getSelectedLayoutContainer=function(){' +
  'var c=this.getSelectedLayoutContainers();return 1==c.length?c[0]:null;};}\n';
// Editor.appName ("draw.io") is the display name in editor messages; it must
// match the app name (AppScope app_name per locale). getServiceName() keeps
// "draw.io" because the editor branches on it internally.
const appNameShim = ';if(typeof Editor!=="undefined"){Editor.prototype.appName=' +
  '/^zh/i.test(String(mxClient.language||navigator.language||""))?"架构图编辑器":"Diagram Editor";}\n';

// AppGallery guidelines 9.4/9.5: "draw.io" is a JGraph Ltd trademark, so the
// editor's UI strings name the app instead. Only the stand-alone word is
// replaced; domains (app.diagrams.net, www.drawio.com) and the .drawio file
// format are left alone. Attribution stays in LICENSE / THIRD_PARTY_NOTICES.
const appNames = {'dia_zh.txt': '架构图编辑器', 'dia_zh-tw.txt': '架構圖編輯器'};
const brandWord = /(?<![\w@./-])draw\.io(?![\w/-]|\.\w)/gi;
function uiStrings(rel, data) {
  const match = /^drawio\/src\/main\/webapp\/resources\/(dia(?:_[\w-]+)?\.txt)$/.exec(rel);
  if (!match) return null;
  const name = appNames[match[1]] ?? 'Diagram Editor';
  // Values only: keys such as "draw.io=" are looked up by the editor code.
  const lines = data.toString('utf8').split('\n').map(line => {
    const eq = line.indexOf('=');
    return eq < 0 ? line : line.slice(0, eq + 1) + line.slice(eq + 1).replace(brandWord, name);
  });
  return Buffer.from(lines.join('\n'), 'utf8');
}

const files = [];
function collect(relative) {
  const input = path.join(source, relative);
  const resolved = fs.realpathSync(input);
  if (!resolved.startsWith(source + path.sep)) throw new Error(`Dependency escapes application: ${relative}`);
  const rel = relative.replaceAll(path.sep, '/');
  if (fs.statSync(input).isDirectory()) {
    for (const name of fs.readdirSync(input).sort()) {
      if (name === '.git' || name === '.bin') continue;
      if (rel.startsWith('node_modules') && dependencyMetadata.has(name)) continue;
      collect(path.join(relative, name));
    }
  } else if (!excluded(rel)) {
    files.push(rel);
  }
}
for (const entry of entries) collect(entry);

// asar layout: Pickle(uint32 headerSize) + Pickle(string headerJson) + file data.
function writeAsar(out, list) {
  const header = {files: {}};
  const blockSize = 4 * 1024 * 1024;
  const inventory = [];
  let offset = 0;
  for (const rel of list) {
    const data = contents(rel);
    const parts = rel.split('/');
    let dir = header;
    for (const part of parts.slice(0, -1)) dir = (dir.files[part] ??= {files: {}});
    const blocks = [];
    for (let i = 0; i < Math.max(data.length, 1); i += blockSize) blocks.push(hash(data.subarray(i, i + blockSize)));
    const digest = hash(data);
    dir.files[parts.at(-1)] = {size: data.length, offset: String(offset),
      integrity: {algorithm: 'SHA256', hash: digest, blockSize, blocks}};
    offset += data.length;
    inventory.push({path: rel, bytes: data.length, sha256: digest});
  }
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const payload = 4 + json.length + ((4 - (json.length % 4)) % 4);
  const headerPickle = Buffer.alloc(4 + payload);
  headerPickle.writeUInt32LE(payload, 0);
  headerPickle.writeUInt32LE(json.length, 4);
  json.copy(headerPickle, 8);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerPickle.length, 4);
  const fd = fs.openSync(out, 'w');
  try {
    fs.writeSync(fd, sizePickle);
    fs.writeSync(fd, headerPickle);
    for (const rel of list) fs.writeSync(fd, contents(rel));
  } finally {
    fs.closeSync(fd);
  }
  return inventory;
}

fs.mkdirSync(resources, {recursive: true});
// The loose payload directory would shadow nothing (app.asar wins) but would
// still ship as source files, so it is removed from the packaged resources.
fs.rmSync(path.join(resources, 'app'), {recursive: true, force: true});
const inventory = writeAsar(asarPath, files);
for (const name of looseLicenses) fs.copyFileSync(path.join(source, name), path.join(resources, name));

const manifest = {kind: 'drawio-desktop', version: '32.4.1', core, observedAt: new Date().toISOString(),
  entry: 'src/main/electron.js', packaging: 'asar', asar: 'resources/app.asar',
  asarSha256: hash(fs.readFileSync(asarPath)), looseFiles: looseLicenses, files: inventory};
fs.writeFileSync(path.join(root, 'validation/application-payload.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({kind: manifest.kind, asar: path.relative(root, asarPath).replaceAll(path.sep, '/'),
  files: inventory.length, bytes: inventory.reduce((sum, file) => sum + file.bytes, 0)}));
