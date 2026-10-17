import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--studio');
const supplied = index >= 0 ? process.argv[index + 1] : process.env.DEVECO_HOME;
if (!supplied) throw new Error('Pass --studio with the DevEco Studio root reported by devecocli');
const studio = path.resolve(supplied);
const project = path.join(root, 'harmony/DrawioHarmony');
const build = path.join(project, 'electron/build/default');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1])
  : path.join(root, 'artifacts/drawio-probe-api23-unsigned.hap');
const allowedRoots = [path.join(root, 'artifacts') + path.sep, path.join(build, 'outputs') + path.sep];
if (!allowedRoots.some(directory => output.startsWith(directory)) || !output.endsWith('-unsigned.hap')) {
  throw new Error('Output must be an unsigned HAP inside this project output or artifact directory');
}
fs.mkdirSync(path.dirname(output), { recursive: true });
// Regenerate hnp/ from upstream with the binaries' .permission policy before packing it.
const patch = spawnSync(process.execPath, [path.join(root, 'scripts/patch-hnp-permission.mjs'), '--studio', studio],
  { encoding: 'utf8', windowsHide: true });
console.log(patch.stdout || '');
if (patch.error || patch.status !== 0) throw new Error(`HNP permission patch failed: ${patch.error || patch.stderr}`);
const args =['-Dfile.encoding=UTF-8', '-jar',
  path.join(studio, 'sdk/default/openharmony/toolchains/lib/app_packing_tool.jar'),
  '--mode', 'hap', '--force', 'true',
  '--lib-path', path.join(build, 'intermediates/stripped_native_libs/default'),
  '--json-path', path.join(build, 'intermediates/package/default/module.json'),
  '--resources-path', path.join(build, 'intermediates/res/default/resources'),
  '--index-path', path.join(build, 'intermediates/res/default/resources.index'),
  '--pack-info-path', path.join(build, 'outputs/default/pack.info'),
  '--ets-path', path.join(build, 'intermediates/loader_out/default/ets'),
  '--pkg-context-path', path.join(build, 'intermediates/loader/default/pkgContextInfo.json'),
  '--hnp-path', path.join(project, 'hnp'), '--out-path', output];
const result = spawnSync(path.join(studio, 'jbr/bin/java.exe'), args, { encoding: 'utf8', windowsHide: true });
fs.writeFileSync(path.join(root, 'validation/hap-pack-hnp.log'), (result.stdout || '') + (result.stderr || ''));
console.log(result.stdout || '');
console.error(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = 1;
else {
  const listing = spawnSync('C:/Windows/System32/tar.exe', ['-tf', output], { encoding: 'utf8', windowsHide: true });
  if (listing.status !== 0 || !listing.stdout.split(/\r?\n/).includes('hnp/arm64-v8a/electron.hnp')) {
    throw new Error('Packer completed without required Electron HNP; refusing to proceed');
  }
  console.log(JSON.stringify({ output, hnpIncluded: true, note: 'Run full hash verification before deployment.' }));
}
