// Diagnostic preload only; never packaged with the app or installed into the SDK.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const output = path.resolve(__dirname, '../validation/hvigor-import-trace.log');
const original = Module._load;
fs.writeFileSync(output, `Node ${process.version}\n`);
let depth = 0;
Module._load = function (request, parent, isMain) {
  const at = Date.now();
  const nesting = depth++;
  fs.appendFileSync(output, `START ${nesting} ${request}\n`);
  try {
    return original.apply(this, arguments);
  } finally {
    depth--;
    fs.appendFileSync(output, `END ${nesting} ${Date.now() - at}ms ${request}\n`);
  }
};
