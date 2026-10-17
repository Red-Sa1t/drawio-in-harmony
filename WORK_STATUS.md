# 当前接续点

目标：基本全量迁移 draw.io Desktop v32.4.1 到 HarmonyOS 6.1.0 / API 23。
仍无正式无法迁移/暂留项，尚未完成全量功能矩阵验收。

## 已完成

- MateBook Pro 已连接并完成登录、调试签名、探针安装和启动。API23 / ARM64
  实测见 `validation/device-baseline.json`。不要再申请签名或输出签名凭据。
- 真机测得 Electron37.2.0 / Node22.17.0 / ABI136 / platform=openharmony。
- 探针文件读写/另存、隔离桥接、文本/图片/HTML 剪贴板、截图与 PDF 已有证据；
  实际打印取消。详见 `validation/target-probe/REVIEW.md`。
- 当前宿主额外窗口要求预先注册状态栏图标，否则 16000067。注册后的可见第二窗口、
  关闭回焦和隐藏 PDF 已验证；应用已添加限定平台的初始化。
- `application/` 网页子模块及生产依赖准备完成，保留固定上游版本。
  主进程剪贴板兼容和本地 MIT 右键菜单兼容合计 11 项新增测试。
- 完整测试 296 项：267 通过、29 跳过、0 失败。
- 真正 draw.io Desktop 在 Windows Electron37 的 PNG/PDF 导出成功，见
  `validation/application-host/`。该证据不代替目标设备测试。
- 完整应用已暂存到鸿蒙宿主，应用清单 `validation/application-payload.json`
  记录 7645 个文件。宿主版本更新为 0.1.0-drawio / code101。
  探针包独立保留在 `artifacts/drawio-probe-api23-signed.hap`。
- 完整应用 HAP 构建与签名成功；日志 `validation/application-hap-build-console.log`。

## 当前在做

核验、安装并诊断真机上的完整编辑器启动。继续单实例/Want、字体、更新和数据生命周期适配。
不要把探针能力或 Windows 导出成功描述为全量迁移完成。

## 可靠构建入口

在 `drawio-migration/`：

```powershell
& ./toolchains/node-v22.23.3-win-x64/node.exe ./scripts/stage-drawio-application.mjs
& ./toolchains/node-v22.23.3-win-x64/node.exe ./scripts/build-hap.mjs --studio 'D:/Tools/DevEco Studio'
& ./scripts/verify-probe-hap.ps1 -PayloadKind application -HapPath ./harmony/DrawioHarmony/electron/build/default/outputs/default/electron-default-signed.hap -SignatureStatus build-reported-signed
```

验证后从 `harmony/DrawioHarmony/` 执行 `devecocli run --module electron --skip-build --device <设备序列号>`。
CLI 构建用 Node18 曾停滞，替代入口使用同一 Hvigor/SDK/JBR 和私有 Node22，SDK 未修改。
HNP 自定义任务必须位于签名前；不要使用早期缺 HNP 的历史包。

读取探针沙箱用 SDK HDC 的 `shell -b <bundle> find data/storage/el2/base/files -name report.json`
和 `file recv -b <bundle> <relative-path> <Windows-backslash-path>`；CLI 没有沙箱文件传输命令。
`run-as` 不适用，调试挂载根目录不可枚举，但明确的应用数据路径可访问。

首次完整编译保留 290 处 ArkTS 警告及 10 处资源重名警告；候选宿主缺少完整许可证/二进制 notices，
正式发布前须解决来源与许可材料。详见 `RUNTIME.md`、`ADAPTATION.md`。

## 2026-10-12 真机核验（效率口径）

完整应用 HAP（`com.example.drawioharmony`）在 MateBook Pro / API 23 真机实测通过，截图见 `validation/state1..12.png`：
启动并显示中文编辑器；点击侧栏插入图形；点击“修改未保存”调出系统保存对话框，以中文文件名保存 `.drawio`；
文件>导出为>PDF 用系统对话框落盘（`导出测试.pdf` 3KB，已在文件选择器中见到）；文件>打开重新载入，图形保留。
更新器：`getUpdateMode` 在 openharmony 下返回 `off`，不会走 Windows/Linux 更新路径。
基本迁移视为完成；以下按效率口径暂留，不阻塞使用（见 DEFERRED.md 补充）。

## 2026-10-13 暂留项清零
包名改为 `com.neuohos.drawio`（已重新生成调试签名）。文件关联（冷/热启动）、打印（PDF + 系统阅读器）、
PNG/SVG/HTML 导出、字体枚举（真机 234 个族）、拼写词典、更新策略均已处理并在真机验证，详见 DEFERRED.md。
构建入口不变；`scripts/pack-probe-hnp.mjs` 的 tar 已改用 `C:/Windows/System32/tar.exe`，避免 Git tar 误读 HAP。
