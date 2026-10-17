import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'upstream/ohcodium-runtime');
const commit = '6a52cc1aaa3580bccede7708968276600987835b';
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== commit) throw new Error('Runtime source commit mismatch');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function elfInfo(data) {
  if (data.subarray(0, 4).toString('hex') !== '7f454c46') return null;
  if (data[4] !== 2 || data[5] !== 1) throw new Error('Expected little-endian ELF64');
  const machine = data.readUInt16LE(18);
  const sectionOffset = Number(data.readBigUInt64LE(40));
  const sectionSize = data.readUInt16LE(58);
  const sectionCount = data.readUInt16LE(60);
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const at = sectionOffset + index * sectionSize;
    return { type: data.readUInt32LE(at + 4), offset: Number(data.readBigUInt64LE(at + 24)),
      size: Number(data.readBigUInt64LE(at + 32)), link: data.readUInt32LE(at + 40) };
  });
  const needed = [];
  for (const section of sections.filter(item => item.type === 6)) {
    const strings = sections[section.link];
    for (let at = section.offset; at < section.offset + section.size; at += 16) {
      if (data.readBigInt64LE(at) !== 1n) continue;
      const start = strings.offset + Number(data.readBigUInt64LE(at + 8));
      needed.push(data.toString('utf8', start, data.indexOf(0, start)));
    }
  }
  // Embedded strings are supporting evidence only, never a substitute for process.versions.
  const raw = data.toString('latin1');
  const versionHints = [...new Set(raw.match(/(?:Electron|Chrome|Chromium)\/[0-9]+(?:\.[0-9]+){1,3}/g) || [])];
  return { bits: 64, endian: 'little', machine, arch: machine === 183 ? 'aarch64' : 'other', needed, versionHints };
}

const files = git('ls-files').split('\n');
const selected = files.filter(file => /^ohos_hap\/electron\/libs\/arm64-v8a\/[^/]+\.so$/.test(file)
  || file === 'ohos_hap/hnp/arm64-v8a/electron.hnp'
  || file.startsWith('ohos_hap/web_engine/src/main/resources/resfile/'));
const assets = selected.map(file => {
  const data = fs.readFileSync(path.join(repo, file));
  const original = execFileSync('git', ['-C', repo, 'show', `${commit}:${file}`]);
  const pointer = original.toString('utf8');
  const lfsHash = pointer.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const lfsSize = pointer.match(/^size (\d+)$/m)?.[1];
  const actualHash = sha256(data);
  return { path: file, bytes: data.length, sha256: actualHash,
    lfsExpectedSha256: lfsHash ?? null, lfsExpectedBytes: lfsSize ? Number(lfsSize) : null,
    verified: lfsHash ? actualHash === lfsHash && data.length === Number(lfsSize) : data.equals(original),
    elf: elfInfo(data) };
});
const report = {
  observedAt: new Date().toISOString(), repository: 'https://github.com/HanversionOvO/MKCode', commit,
  evidenceLevel: 'static-binary-inspection-only',
  claimedRuntime: { electron: '37.2.0', modules: '136', source: 'README.md' },
  measuredRuntimeVersions: null, targetDeviceValidation: 'not-performed',
  host: { compatibleSdk: '5.0.5(17)', targetSdk: '6.0.0(20)', deviceTypes: ['2in1'] },
  licensing: { rootLicenseFilePresent: files.some(file => /^licen[sc]e(?:\..*)?$/i.test(file)),
    note: 'Host files reference an absent BSD-style LICENSE; web_engine package declares Apache-2.0. Resolve provenance and notices before distribution.' },
  assets, totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  allAssetsVerified: assets.every(asset => asset.verified)
};
fs.writeFileSync(path.join(root, 'validation/runtime-candidate.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ commit, assets: assets.length, bytes: report.totalBytes,
  verified: report.allAssetsVerified, libraries: assets.filter(asset => asset.elf) }, null, 2));
if (!report.allAssetsVerified) process.exitCode = 1;
