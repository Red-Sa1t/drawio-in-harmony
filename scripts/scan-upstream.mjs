import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = path.join(root, 'upstream', 'drawio-desktop');
const validation = path.join(root, 'validation');
const read = relative => fs.readFileSync(path.join(upstream, relative), 'utf8');
const head = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const location = (text, offset) => text.slice(0, offset).split('\n').length;
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

const actionFiles = [
  'drawio/src/main/webapp/js/grapheditor/Actions.js',
  'drawio/src/main/webapp/js/diagramly/ElectronApp.js',
  'drawio/src/main/webapp/js/diagramly/EditorUi.js',
  'drawio/src/main/webapp/js/diagramly/Menus.js'
];
const actions = [];
const sourceFiles = [];
for (const file of actionFiles) {
  const text = read(file);
  sourceFiles.push({ file, sha256: sha256(text) });
  for (const match of text.matchAll(/\baddAction\s*\(\s*(['"])([^'"]+)\1/g)) {
    actions.push({ name: match[2], file, line: location(text, match.index) });
  }
}

const mainFile = 'src/main/electron.js';
const main = read(mainFile);
const ipc = [...main.matchAll(/\bipcMain\.(on|once|handle)\s*\(\s*(['"])([^'"]+)\2/g)]
  .map(match => ({ name: match[3], kind: match[1], file: mainFile, line: location(main, match.index) }));
const requestStart = main.indexOf('ipcMain.on("rendererReq"');
if (requestStart < 0) throw new Error('Expected rendererReq dispatcher not found');
const requestActions = [...main.slice(requestStart).matchAll(/\bcase\s+(['"])([^'"]+)\1\s*:/g)]
  .map(match => ({ name: match[2], file: mainFile, line: location(main, requestStart + match.index) }));
const argsFile = 'src/main/args.js';
const args = read(argsFile);
const cliFlags = [...args.matchAll(/\blong\s*:\s*(['"])(--[^'"]+)\1/g)]
  .map(match => ({ name: match[2], file: argsFile, line: location(args, match.index) }));
const nativeCalls = [...main.matchAll(/\b(app|dialog|clipboard|shell|session|screen|nativeImage|nativeTheme|ipcMain|menu)\.(\w+)\s*\(/g)]
  .map(match => ({ name: `${match[1]}.${match[2]}`, file: mainFile, line: location(main, match.index) }));
const productionDependencies = Object.entries(lock.packages)
  .filter(([name, value]) => name && !value.dev)
  .map(([name, value]) => ({
    path: name, version: value.version, node: value.engines?.node ?? null,
    optional: value.optional === true, installScript: value.hasInstallScript === true
  }));

const inventory = {
  generatedAt: new Date().toISOString(),
  reference: {
    version: pkg.version,
    desktopCommit: head(upstream),
    coreCommit: head(path.join(upstream, 'drawio')),
    coreVersion: read('drawio/VERSION').trim(),
    requiredHostNode: pkg.engines.node,
    executingHostNode: process.version,
    electronRange: pkg.devDependencies.electron,
    lockedElectron: lock.packages['node_modules/electron'].version
  },
  limitation: 'Static candidates only: includes web-only, development-only and conditionally available actions. Dynamic actions and runtime behavior require manual/UI verification. These counts are not migration completion percentages.',
  sourceFiles,
  summary: {
    actionDeclarations: actions.length,
    distinctLiteralActions: new Set(actions.map(action => action.name)).size,
    ipcListenerDeclarations: ipc.length,
    distinctIpcChannels: new Set(ipc.map(item => item.name)).size,
    rendererRequestActions: requestActions.length,
    longCliFlagDeclarations: cliFlags.length,
    distinctDirectNativeCalls: new Set(nativeCalls.map(item => item.name)).size,
    productionDependencyEntries: productionDependencies.length
  },
  actions, ipc, requestActions, cliFlags, nativeCalls, productionDependencies
};

fs.mkdirSync(validation, { recursive: true });
fs.writeFileSync(path.join(validation, 'static-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');

const testLog = path.join(validation, 'upstream-v32.4.1-node22-tests.tap');
if (fs.existsSync(testLog)) {
  const bytes = fs.readFileSync(testLog);
  const text = bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))
    ? bytes.toString('utf16le').replace(/^\uFEFF/, '')
    : bytes.toString('utf8').replace(/^\uFEFF/, '');
  fs.writeFileSync(testLog, text, 'utf8');
  const results = {};
  for (const key of ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const match = text.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    if (!match) throw new Error(`Missing TAP result: ${key}`);
    results[key] = Number(match[1]);
  }
  fs.writeFileSync(path.join(validation, 'upstream-baseline.json'), JSON.stringify({
    generatedAt: inventory.generatedAt, reference: inventory.reference,
    testCommand: pkg.scripts.test,
    testEnvironment: { os: process.platform, arch: process.arch, node: process.version },
    results,
    log: path.basename(testLog),
    logSha256: sha256(text),
    scope: 'Upstream Node tests only; no Electron GUI, HAP build or HarmonyOS device validation.'
  }, null, 2) + '\n');
}

console.log(JSON.stringify({ reference: inventory.reference, summary: inventory.summary }, null, 2));
