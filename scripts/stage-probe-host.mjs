import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'upstream/ohcodium-runtime/ohos_hap');
const target = path.join(root, 'harmony/DrawioHarmony');
const finishInitialStage = process.argv.includes('--finish-initial-stage');
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'validation/runtime-candidate.json'), 'utf8'));
if (!evidence.allAssetsVerified || evidence.commit !== '6a52cc1aaa3580bccede7708968276600987835b') {
  throw new Error('Run inspect-runtime.mjs successfully first');
}
if (!fs.existsSync(path.join(target, 'build-profile.json5'))) throw new Error('Create the API 23 project with the creation skill first');
if (finishInitialStage && fs.existsSync(path.join(root, 'validation/host-staging.json'))) {
  throw new Error('Initial staging already completed; do not overwrite an adapted host');
}
if (!finishInitialStage) {
  for (const module of ['electron', 'web_engine']) {
    if (fs.existsSync(path.join(target, module))) throw new Error(`Refusing to overwrite existing ${module} module`);
  }
  for (const module of ['electron', 'web_engine']) {
    fs.cpSync(path.join(source, module), path.join(target, module), { recursive: true,
      filter: file => !file.replaceAll('\\', '/').includes('/libs/arm64-v8a/node_modules') });
  }
}
fs.mkdirSync(path.join(target, 'hnp/arm64-v8a'), { recursive: true });
fs.copyFileSync(path.join(source, 'hnp/arm64-v8a/electron.hnp'), path.join(target, 'hnp/arm64-v8a/electron.hnp'));
fs.cpSync(path.join(root, 'probe'), path.join(target, 'web_engine/src/main/resources/resfile/resources/app'), { recursive: true });

// Preserve the generated API 23 baseline; the generated entry module remains as a scaffold reference.
const profile = {
  app: { signingConfigs: [], products: [{ name: 'default', targetSdkVersion: '6.1.0(23)',
    compatibleSdkVersion: '6.1.0(23)', runtimeOS: 'HarmonyOS',
    buildOption: { nativeLib: { collectAllLibs: true }, strictMode: { caseSensitiveCheck: true, useNormalizedOHMUrl: true } } }],
    buildModeSet: [{ name: 'debug' }, { name: 'release' }] },
  modules: [{ name: 'electron', srcPath: './electron', targets: [{ name: 'default', applyToProducts: ['default'] }] },
    { name: 'web_engine', srcPath: './web_engine' }]
};
fs.writeFileSync(path.join(target, 'build-profile.json5'), JSON.stringify(profile, null, 2) + '\n');
const modulePath = path.join(target, 'electron/src/main/module.json5');
let manifest = fs.readFileSync(modulePath, 'utf8');
manifest = manifest.replace(/"hnpPackages":\s*\[[\s\S]*?\]/,
  '"hnpPackages": [{ "package": "electron.hnp", "type": "private", "independentSign": true }]');
manifest = manifest.replaceAll('$media:ohcodium_layered_icon', '$media:layered_image');
fs.writeFileSync(modulePath, manifest);
const permissionPath = path.join(target, 'web_engine/src/main/module.json5');
fs.writeFileSync(permissionPath, fs.readFileSync(permissionPath, 'utf8').replaceAll('"FormAbility"',
  '"EntryAbility", "BrowserAbility", "StatelessAbility"'));
fs.mkdirSync(path.join(target, 'electron/src/main/resources/base/media'), { recursive: true });
for (const filename of ['layered_image.json', 'background.png', 'foreground.png', 'startIcon.png']) {
  fs.copyFileSync(path.join(target, 'entry/src/main/resources/base/media', filename),
    path.join(target, 'electron/src/main/resources/base/media', filename));
}
fs.copyFileSync(path.join(target, 'entry/src/main/resources/base/media/foreground.png'),
  path.join(target, 'electron/src/main/resources/base/media/app_icon.png'));
for (const locale of ['base', 'en_US', 'zh_CN']) {
  const file = path.join(target, 'electron/src/main/resources', locale, 'element/string.json');
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/OHCodium|VSCodium|MKCode/g, 'draw.io Runtime Probe'));
  }
}
const appInfo = path.join(target, 'AppScope/app.json5');
const app = JSON.parse(fs.readFileSync(appInfo, 'utf8'));
app.app.versionCode = 100;
app.app.versionName = '0.1.0-probe';
fs.writeFileSync(appInfo, JSON.stringify(app, null, 2) + '\n');
const stage = { stagedAt: new Date().toISOString(), sourceCommit: evidence.commit,
  project: target, api: 23, payload: 'probe', distributionReady: false,
  adjustments: ['API 23 build product', 'Unique probe bundle/version', 'Exclude VSCodium-only native modules and rg/unzip HNP',
    'Resolve permission usedScene to actual host abilities', 'Probe label and scaffold icon'],
  pending: ['Compile', 'Sign with required ACL/HNP support', 'Validate on API 23 ARM64 device', 'Resolve missing license texts'] };
fs.writeFileSync(path.join(root, 'validation/host-staging.json'), JSON.stringify(stage, null, 2) + '\n');
console.log(JSON.stringify(stage, null, 2));
