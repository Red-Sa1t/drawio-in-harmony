// Writes the HNP that the HAP packs: the pristine upstream electron.hnp with a
// .permission policy section set on every ELF binary inside it.
//
// From API26 a binary exec'd by the app no longer inherits the app's kernel
// permissions; HNP binaries with "independentSign": true must declare them in
// their own .permission section (llvm-objcopy). The upstream launcher only
// declares INHERIT_PARENT_PERMISSION, which does not cover kernel permissions,
// so the kernel permissions the app requests (ALLOW_WRITABLE_CODE_MEMORY, V8 JIT)
// are declared explicitly. They are read from web_engine's requestPermissions:
// installd rejects the whole HAP when a binary declares a permission the app
// does not hold ("illegal additional permission"), so the two must match.
//
// Only the patched entries are rewritten; every other ZIP record is copied
// byte for byte so attributes and layout match the upstream package.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--studio');
const supplied = index >= 0 ? process.argv[index + 1] : process.env.DEVECO_HOME;
if (!supplied) throw new Error('Pass --studio with the DevEco Studio root reported by devecocli');
const objcopy = path.join(path.resolve(supplied), 'sdk/default/openharmony/native/llvm/bin/llvm-objcopy.exe');
if (!fs.existsSync(objcopy)) throw new Error(`llvm-objcopy not found: ${objcopy}`);

const source = path.join(root, 'upstream/ohcodium-runtime/ohos_hap/hnp/arm64-v8a/electron.hnp');
const target = path.join(root, 'harmony/DrawioHarmony/hnp/arm64-v8a/electron.hnp');
const evidence = path.join(root, 'validation/electron-hnp-permission.json');
const moduleJson = path.join(root, 'harmony/DrawioHarmony/web_engine/src/main/module.json5');

function requestedKernelPermissions(file) {
  const text = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).join('\n');
  const key = text.indexOf('"requestPermissions"');
  if (key < 0) return [];
  const open = text.indexOf('[', key);
  let depth = 0;
  let close = open;
  for (; close < text.length; close++) {
    if (text[close] === '[') depth++;
    else if (text[close] === ']' && --depth === 0) break;
  }
  const names = text.slice(open, close).match(/ohos\.permission\.kernel\.[A-Z_]+/g) ?? [];
  return [...new Set(names)];
}

const policy = {
  requestPermissions: [
    ...requestedKernelPermissions(moduleJson).map(name => ({ name })),
    { name: 'ohos.permission.INHERIT_PARENT_PERMISSION' }
  ]
};
const policyBytes = Buffer.from(JSON.stringify(policy, null, 2) + '\n', 'utf8');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const crc32 = zlib.crc32 ?? (() => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  return data => {
    let c = 0xffffffff;
    for (const byte of data) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function readZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP end of central directory not found');
  const count = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory record');
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const size = 46 + nameLen + extraLen + commentLen;
    entries.push({
      central: Buffer.from(buffer.subarray(p, p + size)),
      name: buffer.toString('utf8', p + 46, p + 46 + nameLen),
      method: buffer.readUInt16LE(p + 10),
      compressedSize: buffer.readUInt32LE(p + 20),
      localOffset: buffer.readUInt32LE(p + 42)
    });
    p += size;
  }
  return { entries, cdOffset, eocd };
}

function entryData(buffer, entry) {
  const lh = entry.localOffset;
  if (buffer.readUInt32LE(lh) !== 0x04034b50) throw new Error(`Bad local header: ${entry.name}`);
  const start = lh + 30 + buffer.readUInt16LE(lh + 26) + buffer.readUInt16LE(lh + 28);
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Unsupported compression ${entry.method}: ${entry.name}`);
}

function setPermission(binary, work) {
  const input = path.join(work, 'in');
  const output = path.join(work, 'out');
  const json = path.join(work, 'permission.json');
  const dump = path.join(work, 'dump.json');
  fs.writeFileSync(input, binary);
  fs.writeFileSync(json, policyBytes);
  const run = args => spawnSync(objcopy, args, { encoding: 'utf8', windowsHide: true });
  let result = run(['--update-section', `.permission=${json}`, input, output]);
  if (result.status !== 0) result = run(['--add-section', `.permission=${json}`, input, output]);
  if (result.status !== 0) throw new Error(`llvm-objcopy failed: ${result.stderr || result.stdout}`);
  result = run(['--dump-section', `.permission=${dump}`, output, path.join(work, 'discard')]);
  if (result.status !== 0 || !fs.readFileSync(dump).equals(policyBytes)) {
    throw new Error('Written .permission section does not match the policy');
  }
  return fs.readFileSync(output);
}

const original = fs.readFileSync(source);
const { entries, cdOffset, eocd } = readZip(original);
const ordered = [...entries].sort((a, b) => a.localOffset - b.localOffset);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-hnp-'));
const parts = [];
const patched = [];
let offset = 0;
try {
  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    const end = i + 1 < ordered.length ? ordered[i + 1].localOffset : cdOffset;
    const data = entry.name.endsWith('/') ? null : entryData(original, entry);
    const isElf = data && data.length > 4 && data.readUInt32BE(0) === 0x7f454c46;
    entry.newOffset = offset;
    if (!isElf) {
      const record = original.subarray(entry.localOffset, end);
      parts.push(record);
      offset += record.length;
      continue;
    }
    const binary = setPermission(data, work);
    const compressed = entry.method === 8 ? zlib.deflateRawSync(binary, { level: 9 }) : binary;
    const crc = crc32(binary) >>> 0;
    const lh = entry.localOffset;
    const header = Buffer.from(original.subarray(lh, lh + 30 + original.readUInt16LE(lh + 26) + original.readUInt16LE(lh + 28)));
    header.writeUInt16LE(header.readUInt16LE(6) & ~0x0008, 6); // sizes are now in the header
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(binary.length, 22);
    entry.central.writeUInt16LE(entry.central.readUInt16LE(8) & ~0x0008, 8);
    entry.central.writeUInt32LE(crc, 16);
    entry.central.writeUInt32LE(compressed.length, 20);
    entry.central.writeUInt32LE(binary.length, 24);
    parts.push(header, compressed);
    offset += header.length + compressed.length;
    patched.push({ path: entry.name, bytes: binary.length, sha256: sha256(binary) });
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
if (patched.length === 0) throw new Error('No ELF binary found in the HNP');

const newCdOffset = offset;
for (const entry of entries) {
  entry.central.writeUInt32LE(entry.newOffset, 42);
  parts.push(entry.central);
  offset += entry.central.length;
}
const end = Buffer.from(original.subarray(eocd));
end.writeUInt32LE(offset - newCdOffset, 12);
end.writeUInt32LE(newCdOffset, 16);
parts.push(end);
const output = Buffer.concat(parts);

// Every non-ELF entry must come out identical to upstream.
const check = readZip(output);
for (const entry of check.entries) {
  const before = entries.find(e => e.name === entry.name);
  if (!before) throw new Error(`Entry lost: ${entry.name}`);
  if (entry.name.endsWith('/') || patched.some(p => p.path === entry.name)) continue;
  if (!entryData(output, entry).equals(entryData(original, before))) throw new Error(`Entry changed: ${entry.name}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const unchanged = fs.existsSync(target) && fs.readFileSync(target).equals(output);
if (!unchanged) fs.writeFileSync(target, output);
const record = {
  source: path.relative(root, source).replaceAll('\\', '/'),
  sourceSha256: sha256(original),
  output: path.relative(root, target).replaceAll('\\', '/'),
  outputSha256: sha256(output),
  permissionPolicy: policy,
  patched
};
fs.writeFileSync(evidence, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ hnp: record.output, sha256: record.outputSha256, patched: patched.map(p => p.path), unchanged }));
