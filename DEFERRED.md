# 暂留项（2026-10-13 更新）

此前登记的暂留项已全部处理。以下是当前仍需注意的边界，不阻塞使用。

## 已完成（真机 MateBook Pro / API 23 验证）
| 项 | 做法 | 证据 |
| --- | --- | --- |
| F39 文件关联/双击打开/二次打开 | `utd.json5` 声明 `com.neuohos.drawio.diagram`（.drawio/.dio）+ `module.json5` viewData/file 技能；冷启动经 `cmdArgs` 传文件路径，热启动经 `kOpenURL`→`open-url`→`second-instance` | 系统“选择打开方式”出现 draw.io；冷/热启动均打开 `测试流程图.drawio`（`validation/a6.png`、`a8.png`） |
| F33 打印 | 鸿蒙无 `webContents.print` 系统界面：生成 PDF（页面尺寸单位换算为英寸）→ 保存对话框 → 系统阅读器打开，可在其中打印 | 用户已实测正常 |
| F28/F29/F31 导出 | 原生流程，无需改动 | PNG/SVG/HTML/PDF 均在真机落盘（`图一.png`、`图二.svg`、`图三.html`、`导出测试.pdf`） |
| F40 字体枚举 | `src/main/ohos-fonts.js` 读取 `/system/fonts`、`/data/fonts` 的 sfnt name 表（无 fc-list） | 真机枚举出 234 个字体族（HarmonyOS Sans、方正系列等） |
| F41 拼写检查 | 沿用 Chromium 词典机制 | 真机沙箱已自动下载 `Dictionaries/en-US-10-1.bdic` |
| F46 应用内更新 | 鸿蒙下 `getUpdateMode` 为 `off`（与 Store/Snap 同类），升级由应用市场负责 | 设计决定 |

## 仍需注意（非阻塞）
- 字体列表默认不显示系统字体：这是 draw.io 的可选项，需在“其它 > 配置”写入 `{"enableLocalFonts": true}`。
- 拼写检查只验证了词典下载，未做逐词校对；首次启用需联网下载词典。
- F45 系统“最近文件/缩略图”：未做（鸿蒙无对应的 Quick Look 类接口，属于平台差异）。
- PDF 打印依赖系统已安装 PDF 阅读器。
- 正式发布：调试签名、受限权限申请、运行时许可核实，见 RELEASE.md。
