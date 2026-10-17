# Electron 运行时验证记录

目标仍为 draw.io Desktop v32.4.1 的基本全量迁移，验收系统为 HarmonyOS 6.1.0 / API 23。本记录涉及运行时准备，不表示任何 draw.io 功能已完成鸿蒙验收。

## 已取得的候选底座

- 来源：[HanversionOvO/MKCode（OHCodium）](https://github.com/HanversionOvO/MKCode)。固定提交：`6a52cc1aaa3580bccede7708968276600987835b`。
- 本地只读基线：`upstream/ohcodium-runtime/`。它是社区分发的宿主与二进制，不能直接等同于官方 SIG 分支构建。
- 拉取并验证 15 个运行时文件，合计 213,866,566 字节；Git LFS 内容哈希和文件大小全部匹配固定提交。
- `libelectron.so` SHA-256：`e7096087da496c6d2c08845d0db194a5df04289c09f2f8e26756367c6e7b7bfb`。
- 已实测 ELF64 / little-endian / AArch64；动态依赖包含 `libadapter.so`、`libffmpeg.so` 和鸿蒙系统库。完整列表：[runtime-candidate.json](validation/runtime-candidate.json)。
- 真机报告已确认 Electron 37.2.0、Chrome 138.0.7204.45、Node 22.17.0、ABI 136，`process.platform=openharmony`、`process.arch=arm64`。见 [真机复核](validation/target-probe/REVIEW.md)。
- `electron.hnp` 是 ZIP 容器，包含启动器、ICU、V8 快照、两种语言和 Chromium 资源；与 resfile 中对应资源的哈希一致，启动器本身不同，应保留配套布局。目录见 [electron-hnp-contents.json](validation/electron-hnp-contents.json)。
- 原宿主 target SDK 为 API 20、compatible SDK 为 API 17，设备类型仅 `2in1`。API 23 适配在单独的 `harmony/DrawioHarmony/` 中进行。

## 条件与当前状态

1. **真实设备与 ABI 已确认。** HUAWEI MateBook Pro，API 23，系统报告 OpenHarmony-6.1.0.115，arm64-v8a / aarch64。详见 `validation/device-baseline.json`。不需要使用 Windows x86 模拟器替代。
2. **调试签名与安装已完成。** CLI 登录和签名生成成功，ACL 权限未删除；含 Electron HNP 的签名探针已安装运行。无需再次生成签名；不在项目资料中复制签名凭据。
3. **发布来源。** 宿主源码版权头引用 BSD-style LICENSE，但固定提交没有提供该文件；`web_engine/oh-package.json5` 又声明 Apache-2.0。需要核实上游来源、完整许可证文本和二进制 notices，正式发布前解决。当前文件仅用于本地研发验证。
4. **API 支持证据。** SIG master 的支持表不是这组社区 Electron 37 二进制的测试结果。每项能力应通过探针或应用回归验证。
5. **应用兼容性。** Desktop v32.4.1 直接导入 Electron 44 的 `ClipboardItem`；锁定的 `electron-context-menu@5.1.0` 要求 Node >=24；还需适配单实例生命周期、第三方 `electron-updater` 和字体枚举。保留对应功能，不能仅删除入口来满足启动。

上述属于研发和验证待办，尚未据此建立“无法迁移”的正式暂留项。

`electron-context-menu@5.1.0` 的 `writeBookmark()` 同样使用 `electron.ClipboardItem`。现已保留 MIT 完整包并建立本地兼容补丁，4 项针对性测试通过；依赖安装启用 engine-strict，没有忽略 engines。完整应用在 Windows Electron 37 上已完成 PNG/PDF 导出，目标菜单交互仍需验收。

独立 `application/` 工作树已实现主进程剪贴板兼容层，保留旧接口与新 ClipboardItem 接口的图片/HTML 表示和错误传播，7 项针对性单元测试通过。原版 `upstream/drawio-desktop/` 未修改；该层尚未进行目标设备的跨应用剪贴板测试。

## 能力探针与主机验证

探针源码：[probe/](probe/)。不依赖第三方 npm 包；使用隔离的 preload、限定 IPC 操作和发送者检查，报告持久化到独立目录。自动检查覆盖桥接、沙箱文件写入/读取/重命名、页面截图、PDF、打印机枚举和附加隐藏窗口。界面提供文件选择、另存、剪贴板、打印和 JSON 报告导出。

剪贴板操作仅由界面按钮触发，会覆盖现有剪贴板。读取文件必须由用户在系统选择器中选择。打印按钮进入实际打印流程，自动检查只枚举打印机。超时或取消不能直接作为功能不可迁移的证据；截图/PDF 的生成成功也不等于内容或字体已经验收。

Windows 官方 Electron 37.2.0 下载包已通过官方 SHA-256 清单校验，元数据见 [host-electron.json](validation/host-electron.json)。其实际 Node 为 22.17.0、ABI 为 136；这些是 Windows 运行值，不能替代鸿蒙运行值。

首次 Windows 自动运行 **6 项通过，0 项失败**，证据：[report.json](validation/host-probe/drawio-probe-4byRX6/report.json)。真机探针的隔离桥接、中文文件、剪贴板、文件选择/另存、截图/PDF 也已有通过记录；原生窗口与隐藏导出需要结合日志复核，不能只看 DOM 标题。实际打印、完整 draw.io 功能仍待验收。

在 `drawio-migration/` 下重跑：

```powershell
& ./toolchains/node-v22.23.3-win-x64/node.exe ./scripts/inspect-runtime.mjs
& ./toolchains/node-v22.23.3-win-x64/node.exe ./scripts/run-host-probe.mjs
```

## HarmonyOS 工程

`harmony/DrawioHarmony/` 使用工作目录中的创建技能生成，完整性检查通过；API 来源为 `user_input`，target/compatible 为 `6.1.0(23)`。`DEVECO_HOME` 使用 CLI 自动发现的 `D:\Tools\DevEco Studio`，只在创建命令进程内设置，没有修改全局环境。

工程标识 `com.example.drawioharmony`，完整应用版本 `0.1.0-drawio`，保留的探针包版本 `0.1.0-probe`；实际入口模块为 `electron`，其 EntryAbility 继承 WebAbility。原始模板的 `entry` 留作参考，不参与当前构建。

`scripts/stage-probe-host.mjs` 在新工程中接入配套宿主、经过校验的 ARM64 库、Electron HNP 和探针。没有引入 VSCodium 专用原生模块、rg/unzip HNP；这不减少 draw.io 功能范围。该脚本是首次接入工具，完成后拒绝覆盖已适配的宿主。

优先使用 CLI（在工程目录中）：

```powershell
devecocli build --modules electron --product default --build-mode debug
```

签名及安装前检查 ARM64 库、`electron.hnp` 和所选应用载荷。完整应用使用 `scripts/stage-drawio-application.mjs` 暂存，以 `verify-probe-hap.ps1 -PayloadKind application` 对全部清单文件和原生库核验；该脚本名称沿用早期探针阶段。

## 本机已完成的构建与打包修正

本机 `devecocli build` 使用的 Studio Node 18 在同步阶段长时间无进展。采用项目私有 Node 22.23.3、同一套 Hvigor 6.24.4、与 CLI 一致的 SDK/JBR 环境并禁用 daemon 后，同步和编译成功。此过程未修改 SDK。最初直接调用 Hvigor 时漏传 `DEVECO_SDK_HOME` 的错误亦保留在日志中；它不是创建技能的 SDK 元数据错误，后续通过传入 CLI 已确认的路径修正。

在 `drawio-migration/` 执行本机已验证的替代构建命令：

```powershell
& ./toolchains/node-v22.23.3-win-x64/node.exe ./scripts/build-hap.mjs --studio 'D:/Tools/DevEco Studio'
& ./scripts/verify-probe-hap.ps1
```

第一次 HAP 虽然编译成功，但不含 HNP。构建日志证实 Hvigor 的打包命令未提供 `--hnp-path`。本机 SDK 的 `app_packing_tool.jar` 实测接受这个选项；OpenHarmony 的 `Compressor.java` 和 `constants.h` 也定义了 `hnp/` 容器布局。

已添加 `hvigor/electron-hnp.ts` 构建插件：`PackageHap → PackElectronHnp → PackingCheck / SignHap`，在签名消费文件前重新打包。插件只处理本项目的 unsigned HAP，不修改已签名文件；打包后立即检查 HNP 存在。后续增量构建中此任务仍会执行，已通过一次完整任务链验证。

探针对照包：[drawio-probe-api23-signed.hap](artifacts/drawio-probe-api23-signed.hap)。所有配套运行资源和探针源码的包内哈希均通过检查；也检查了编译后的 `modules.abc`、HNP 声明和 API。确切哈希与大小见 [签名包记录](validation/hap-signed-validation.json)。完整应用包正在独立构建和验证，不以探针测试代替应用验收。

构建使用 SDK `6.1.1.125`，产物的 `targetAPIVersion` 和 `minAPIVersion` 均为 `60100023`。这是编译器版本和目标 API 的区别，真实设备环境另有实测证据。

首次完整编译有 290 处 ArkTS 警告和 10 处资源重名警告，涉及候选宿主原有的类绑定、废弃 API、异常处理及权限提示等。没有关闭检查或将这些警告标为已解决。日志：[首次完整构建](validation/hap-build-node22-2026-10-10T15-15-33.359Z.log)、[含 HNP 任务的构建](validation/hap-build-node22-2026-10-10T15-29-40.366Z.log)。

窗口诊断：当前社区宿主将额外窗口绑定到状态栏图标。未注册图标时出现 16000067 和原生窗口等待超时；注册后可见第二窗口、关闭回焦和隐藏 PDF 导出均有证据。应用增加限定 `openharmony` 的状态栏初始化；退出释放及完整多窗口行为仍需继续验收。详见 [真机复核](validation/target-probe/REVIEW.md)。
