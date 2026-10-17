# Draw.io in Harmony

把开源图表软件 [draw.io 桌面版](https://github.com/jgraph/drawio-desktop) v32.4.1 移植到鸿蒙 PC（HarmonyOS 6.1 / API 23，2in1 设备）的工程。

> 本项目不是 JGraph Ltd 的官方发布。"draw.io"是 JGraph Ltd 的商标；本项目使用的应用图标为原创设计。

应用以 Electron 运行时承载 draw.io 桌面版。在鸿蒙上，绘图编辑、`.drawio` 文件的打开与保存、PNG/SVG/HTML/PDF 导出、打印、剪贴板已经过真机回归。

## 目录结构

| 路径 | 内容 |
|---|---|
| `application/` | draw.io 桌面版 v32.4.1 源码及鸿蒙适配修改：`src/main/electron.js` 有改动，新增 `harmony-runtime.js`、`ohos-fonts.js`、`clipboard-compat.js` 及其测试；`application/drawio` 是 [jgraph/drawio](https://github.com/jgraph/drawio) 的子模块，固定在 v32.4.1，未作修改 |
| `harmony/DrawioHarmony/` | 鸿蒙工程（ArkTS 宿主）：`electron` 为 HAP 入口模块，`web_engine` 为 Electron 宿主适配层 |
| `scripts/` | 暂存载荷、给 HNP 写入权限段、打包、校验等构建脚本 |
| `probe/` | 运行时能力探针（早期验证用） |
| `store-listing/` | 应用市场介绍文案、截图、图标源文件 |
| `third_party_licenses/` | 第三方许可证原文 |
| `*.md`（根目录） | 可行性分析、迁移计划、运行时记录、适配说明、上架清单等过程文档 |
| `validation/*.json` | 构建与校验脚本读取的运行时和载荷清单 |

## 构建

需要准备：

- Windows 版 DevEco Studio（含 HarmonyOS SDK API 23）
- Node.js ≥ 22.12
- Git LFS
- 一台 HarmonyOS 6.1 的 2in1 设备，以及你自己的签名证书和 Profile。Profile 需要包含工程申请的 ACL 权限，见 [RELEASE.md](RELEASE.md)

步骤：

```bash
# 1. 拉取本仓库及 draw.io 核心子模块
git clone --recurse-submodules https://github.com/Red-Sa1t/drawio-in-harmony.git
cd drawio-in-harmony

# 2. 获取 Electron 运行时（本仓库不重新分发其二进制），固定到已验证的提交
git clone https://github.com/HanversionOvO/MKCode.git upstream/ohcodium-runtime
git -C upstream/ohcodium-runtime checkout 6a52cc1aaa3580bccede7708968276600987835b
git -C upstream/ohcodium-runtime lfs pull
node scripts/fetch-runtime-assets.mjs

# 3. 安装 draw.io 桌面版依赖，并把载荷暂存进鸿蒙工程
cd application && npm ci && cd ..
node scripts/stage-drawio-application.mjs

# 4. 在 DevEco Studio 中为 harmony/DrawioHarmony 配置签名（build-profile.json5 中的 signingConfigs 已置空），然后构建
node scripts/build-hap.mjs --studio "D:/Tools/DevEco Studio"
```

构建过程中，`scripts/pack-probe-hnp.mjs` 会调用 `scripts/patch-hnp-permission.mjs`。后者以运行时自带的 `electron.hnp` 为源，按 `web_engine` 模块申请的 kernel 权限为其中的二进制写入 `.permission` 段（为 API 26 的 kernelpermission 变更做准备），再打包进 HAP。

## 权限

工程申请的受限权限包括：`FILE_ACCESS_PERSIST`、`READ_WRITE_DOCUMENTS/DOWNLOAD/DESKTOP_DIRECTORY`、`READ_PASTEBOARD`、`kernel.ALLOW_WRITABLE_CODE_MEMORY`（供 V8 JIT 使用；未获授权时自动以 `--jitless` 降级运行）。用途和审批情况见 [RELEASE.md](RELEASE.md)。

## 许可证

- `application/` 中的 draw.io 桌面版及其修改：GPL-3.0，见 [LICENSE](LICENSE)。
- draw.io 核心（`application/drawio` 子模块）：Apache-2.0。
- `harmony/DrawioHarmony/` 中的 Electron 宿主适配层来自社区运行时 [OHCodium（HanversionOvO/MKCode）](https://github.com/HanversionOvO/MKCode)，保留了原版权头。其文件头引用 BSD-style 许可，`web_engine/oh-package.json5` 声明为 Apache-2.0，以上游声明为准。
- Electron 运行时二进制（Electron MIT、Chromium BSD-3-Clause 等）不随本仓库分发，相关声明见 `third_party_licenses/` 和 `application/THIRD_PARTY_NOTICES.txt`。
