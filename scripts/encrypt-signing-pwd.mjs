// Encrypt a signing password with the same key derivation hvigor uses at
// SignHap time (AES-128-GCM, key derived from the material/ dir next to the
// .p12 store). Lets hand-written build-profile.json5 signingConfigs carry a
// cipher-text password without routing through the IDE Signing Configs dialog.
// Usage: node encrypt-signing-pwd.mjs --material-dir <dir-containing-material> [--verify <hex-cipher>]
//        echo <plaintext> | node encrypt-signing-pwd.mjs --material-dir ...
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const materialDir = opt('--material-dir');
const verifyHex = opt('--verify');
const plaintext = opt('--plaintext') ?? fs.readFileSync(0, 'utf8').trim();
if (!materialDir || (!plaintext && !verifyHex)) {
  console.error('Usage: encrypt-signing-pwd.mjs --material-dir <dir> [--plaintext <pw>] [--verify <hex>]');
  process.exit(2);
}

// Mirrors DecipherUtil in hvigor-ohos-plugin's decipher-util.js.
const COMPONENT = new Int8Array([49, 243, 9, 115, 214, 175, 91, 184, 211, 190, 177, 88, 101, 131, 192, 119]);
const mat = path.resolve(materialDir, 'material');
// Every material entry is a directory holding exactly one file of raw bytes.
const readSingleFileDir = (dir) => {
  const entries = fs.readdirSync(dir).filter((f) => f !== '.DS_Store');
  if (entries.length !== 1) throw new Error(`expected exactly one entry in ${dir}, found ${entries.length}`);
  return new Int8Array(fs.readFileSync(path.join(dir, entries[0])));
};
const fdDir = path.join(mat, 'fd');
const fdEntries = fs.readdirSync(fdDir).filter((f) => f !== '.DS_Store');
if (fdEntries.length !== 3) throw new Error(`expected 3 entries in material/fd, found ${fdEntries.length}`);
const fds = fdEntries.map((e) => readSingleFileDir(path.join(fdDir, e)));
const salt = readSingleFileDir(path.join(mat, 'ac'));
const ce = Buffer.from(readSingleFileDir(path.join(mat, 'ce')));

const xorAll = (arrays) => {
  const out = new Int8Array(arrays[0].length);
  out.set(arrays[0]);
  for (let a = 1; a < arrays.length; a++) {
    for (let i = 0; i < out.length; i++) out[i] ^= arrays[a][i];
  }
  return out;
};
const rootKey = crypto.pbkdf2Sync(Buffer.from(xorAll([...fds, COMPONENT])).toString(), salt, 10000, 16, 'sha256');

// Cipher layout: 4-byte BE (ctLen + 16) + iv + ciphertext + 16-byte GCM tag.
const decrypt = (key, data) => {
  const tailLen = data.readUInt32BE(0);
  const ivLen = data.length - 4 - tailLen;
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, data.subarray(4, 4 + ivLen));
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(4 + ivLen, data.length - 16)), decipher.final()]);
};
const encrypt = (key, text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(ct.length + 16, 0);
  return Buffer.concat([head, iv, ct, cipher.getAuthTag()]).toString('hex');
};

const workKey = decrypt(rootKey, ce);
if (verifyHex) {
  console.log(`verify: ${JSON.stringify(decrypt(workKey, Buffer.from(verifyHex, 'hex')).toString('utf8'))}`);
}
if (plaintext) {
  const cipherHex = encrypt(workKey, plaintext);
  const roundTrip = decrypt(workKey, Buffer.from(cipherHex, 'hex')).toString('utf8');
  if (roundTrip !== plaintext) throw new Error('round-trip mismatch');
  console.log(cipherHex);
}
