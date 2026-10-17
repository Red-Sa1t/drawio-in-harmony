// 生成 application/THIRD_PARTY_NOTICES.txt：项目自身许可、运行时声明 + 生产依赖许可证全文。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'application');
const nm = path.join(app, 'node_modules');
const out = [];
const lic = name => fs.readFileSync(path.join(root, 'third_party_licenses', name), 'utf8').trim();
out.push(`draw.io（鸿蒙 PC 版）第三方声明 / Third-party notices

本应用基于 jgraph/drawio-desktop v32.4.1（GPL-3.0-only），内含 draw.io 编辑器核心（Apache-2.0）。
源代码：https://github.com/jgraph/drawio-desktop ；本鸿蒙适配的修改记录见随附的适配源码仓库。

本应用运行在 OpenHarmony 版 Electron 37.2.0 运行时之上。该运行时是社区移植版（来源：HanversionOvO/MKCode 仓库，
基于 openharmony-sig/electron 的移植思路），随应用分发的二进制包括 libelectron.so、libffmpeg.so、libadapter.so
及 electron.hnp。其上游组件的许可证如下；移植新增部分（宿主 ArkTS 代码、libadapter.so）的许可证以其提供方声明为准。

- Electron 37.2.0：MIT（全文见下）
- Chromium 138：BSD-3-Clause（全文见下）。Chromium 内含大量第三方组件，完整清单见随应用分发的
  LICENSES.chromium.html（取自 Electron 37.2.0 官方发行包，Chromium 版本 138.0.7204.45，与本运行时一致；
  本运行时的鸿蒙移植部分可能与官方构建存在差异）。
- Node.js 22.17.0：MIT，其内含依赖的许可证一并附在下方 Node.js LICENSE 中
- FFmpeg（libffmpeg.so，作为独立动态库随运行时分发）：Electron 默认构建的 FFmpeg 为 LGPL-2.1-or-later（全文见下）；
  本运行时的实际编译选项以其提供方说明为准。
  FFmpeg 源码：https://ffmpeg.org/download.html ；用户可替换该动态库。

以下为随应用分发的 npm 依赖及其许可证文本。

=================== Electron (MIT) ===================
${lic('electron-MIT.txt')}

=================== Chromium (BSD-3-Clause) ===================
${lic('chromium-BSD-3-Clause.txt')}

=================== Node.js ===================
${lic('nodejs-LICENSE.txt')}

=================== FFmpeg / libffmpeg.so (LGPL-2.1) ===================
${lic('ffmpeg-LGPL-2.1.txt')}
`);
// 包内未附许可证文件时，使用从上游取得的文本
const EXTRA = {'lazy-val': ['lazy-val-MIT.txt'], 'type-fest': ['type-fest-MIT.txt', 'type-fest-CC0-1.0.txt']};
const lic0 = name => lic(name);
const seen = [];
function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    if (n.startsWith('.')) continue;
    const p = path.join(dir, n);
    if (n.startsWith('@')) { walk(p); continue; }
    const pj = path.join(p, 'package.json');
    if (fs.existsSync(pj)) seen.push(p);
    const inner = path.join(p, 'node_modules');
    if (fs.existsSync(inner)) walk(inner);
  }
}
walk(nm);
const uniq = new Map();
for (const p of seen) {
  const j = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
  const key = `${j.name}@${j.version}`;
  if (uniq.has(key)) continue;
  const lic = fs.readdirSync(p).find(f => /^(licen[sc]e|copying)(\..*)?$/i.test(f));
  const extra = EXTRA[j.name];
  uniq.set(key, {license: typeof j.license === 'string' ? j.license : JSON.stringify(j.license || j.licenses || 'UNKNOWN'),
    text: lic ? fs.readFileSync(path.join(p, lic), 'utf8').trim() : (extra ? extra.map(f => lic0(f)).join('\n\n') : '')});
}
for (const [key, v] of [...uniq].sort()) {
  out.push(`\n==== ${key}  [${v.license}] ====\n${v.text || '(包内未附许可证文件，许可证标识见上)'}\n`);
}
fs.writeFileSync(path.join(app, 'THIRD_PARTY_NOTICES.txt'), out.join(''));
fs.copyFileSync(path.join(root, 'third_party_licenses/LICENSES.chromium.html'), path.join(app, 'LICENSES.chromium.html'));
console.log(JSON.stringify({packages: uniq.size, noText: [...uniq].filter(([, v]) => !v.text).map(([k]) => k)}));
