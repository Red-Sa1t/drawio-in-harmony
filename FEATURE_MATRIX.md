**draw.io 基本全量迁移功能矩阵（源码初版）**

基线为 Desktop v32.4.1 和其固定网页内核。此表按功能域组织，不宣称已经穷尽所有菜单、动态功能和参数组合；后续用 [静态动作/IPC/CLI 索引](validation/static-inventory.json) 和原版界面逐项补齐。当前没有任何功能被标为已在 HarmonyOS 验收通过。

状态含义：“待迁移”表示纳入范围、尚未完成实现和目标验证；“待盘点”表示需先确认该版本桌面端的实际可用入口；“待验证”表示实现已有、设备验证未完成；“已通过”需证据；“暂留”需关联独立记录；“基线差异”表示原版桌面与其他产品/平台的区别，不计作迁移成果。

源码位置简称：`G` = `drawio/src/main/webapp/js/grapheditor/`；`D` = `drawio/src/main/webapp/js/diagramly/`；`M` = `src/main/`。均相对于 `upstream/drawio-desktop/`。

| 编号 | 功能域 | 主要源码线索 | 迁移与验收要点 | 状态 |
| --- | --- | --- | --- | --- |
| F01 | 新建、模板、最近使用 | D/App.js、HomeDialog.js、ElectronApp.js | 空白及模板创建、路径与最近列表持久化 | 待迁移 |
| F02 | 图形库、搜索、拖入图形 | D/sidebar/Sidebar.js、G/Sidebar.js、D/App.js | 内置形状/图标/模板资源完整，断网可用 | 待迁移 |
| F03 | 选择、移动、缩放、旋转 | G/Actions.js、EditorUi.js | 鼠标/键盘操作及几何结果一致 | 待迁移 |
| F04 | 连线、连接点、路径点 | G/Actions.js、D/Menus.js | 自动连接、手动路径、锚点和标签位置 | 待迁移 |
| F05 | 撤销、重做、重复、删除 | G/Actions.js | 连续编辑与跨操作撤销的文档一致性 | 待迁移 |
| F06 | 分组、锁定、折叠、层级 | G/Actions.js | 组内编辑、进入退出组、前后顺序和折叠恢复 | 待迁移 |
| F07 | 对齐、分布、大小及布局 | G/Actions.js、D/Menus.js、M/args.js | 树/流程/有机/ELK 布局及组合参数 | 待迁移 |
| F08 | 颜色、线型、渐变、阴影、样式 | G/Actions.js、G/Format.js | 样式修改/复制/粘贴/默认样式持久化 | 待迁移 |
| F09 | 文字、富文本、标签、中文 | G/Actions.js、D/EditorUi.js | 富文本、换行、上下标、输入法组合输入 | 待迁移 |
| F10 | 图片、裁剪、背景和外部媒体 | G/Actions.js、D/EditorUi.js | 本地/嵌入图片、裁剪、外部引用的原版行为 | 待迁移 |
| F11 | 元数据、属性、标签、链接和提示 | G/Actions.js、D/Menus.js | 保存往返、搜索和导出中的对象属性 | 待迁移 |
| F12 | 多页、页签、页面顺序 | D/EditorUi.js、Menus.js | 新增/删除/重命名/复制/重排页面 | 待迁移 |
| F13 | 图层 | G/Actions.js、D/Dialogs.js | 可见性、锁定、图形归属和指定图层导出 | 待迁移 |
| F14 | 页面、纸张、单位、网格与标尺 | G/Actions.js、D/Menus.js | 页面设置、吸附、辅助线、比例和单位 | 待迁移 |
| F15 | 缩放、概览、全屏、深浅色和高对比 | G/Actions.js、D/Menus.js、M/window-bounds.js | 画布/界面缩放、窗口 DPI、主题跟随 | 待迁移 |
| F16 | 查找、替换、提取文本 | D/Menus.js | 跨页面和对象内容的实际范围与原版一致 | 待迁移 |
| F17 | 自定义图形、连接点、几何与样式 XML | G/Actions.js、D/Menus.js | 编辑自定义形状和底层 XML 后可继续编辑 | 待迁移 |
| F18 | 自定义库、暂存区、库文件 | D/DesktopLibrary.js、ElectronApp.js | 新建/打开/保存库、重启加载、路径授权 | 待迁移 |
| F19 | 打开/保存/另存为/重命名 | D/ElectronApp.js、M/electron.js | 中文路径、取消对话框、覆盖、只读、权限撤销 | 待迁移 |
| F20 | 自动保存、草稿、恢复、备份 | D/ElectronApp.js、M/backup-file.js | 未命名/已保存文档、异常退出和写入失败恢复 | 待迁移 |
| F21 | 外部文件变化、同步与冲突处理 | M/file-watcher.js、D/ElectronApp.js | 文件被外部修改、移动或删除后的提示和数据保护 | 待迁移 |
| F22 | PNG/SVG/PDF 内嵌图数据的重新编辑 | D/ElectronApp.js、M/electron.js | 导出后重新打开，恢复多页/图层/对象 | 待迁移 |
| F23 | Visio 导入及图形库导入 | D/ElectronApp.js、EditorUi.js、js/vsdxImporter.js | VSDX/VSSX 分别测试；旧 Visio 格式的支持范围先对照原版 | 待迁移 |
| F24 | Mermaid 导入和再编辑 | D/ElectronApp.js、EditorUi.js | 可编辑图/静态图两种模式、源码保留、布局 | 待迁移 |
| F25 | PlantUML 本地解析和再编辑 | D/EditorUi.js | 使用当前内核自带转换器，按原版支持的语法范围测试 | 待迁移 |
| F26 | CSV、文本和 SQL 等生成图形 | D/EditorUi.js、Menus.js、M/args.js | CSV 映射/布局参数；其余入口逐项确认 | 待迁移 |
| F27 | 其他格式导入 | D/EditorUi.js 的各 importer | GraphML、Gliffy、Lucid 等逐格式确认原版入口和资源，不先裁剪 | 待盘点 |
| F28 | PNG/JPEG 导出 | D/ElectronApp.js、M/electron.js | 缩放、边距、透明背景、尺寸、质量、指定页/图层 | 待迁移 |
| F29 | SVG 导出 | D/EditorUi.js、M/electron.js | 字体/图片嵌入、元数据、链接目标、主题、外部查看器显示 | 待迁移 |
| F30 | PDF 导出 | D/ElectronApp.js、M/electron.js | 所有页/页范围、裁剪、纸张、字体、内嵌可编辑数据 | 待迁移 |
| F31 | XML 和 HTML 导出 | D/EditorUi.js、M/args.js | 压缩/未压缩 XML；HTML 查看器图层、缩放和链接选项 | 待迁移 |
| F32 | 其他导出、动画及演示 | D/EditorUi.js、Menus.js、gif/ | VSDX、GIF 等逐项确认桌面入口及资源；不把 Web 代码存在当作桌面已支持 | 待盘点 |
| F33 | 打印与打印设置 | M/electron.js、print-options.js | 打印对话框、打印机、页范围、方向和缩放 | 待迁移 |
| F34 | CLI / 文件夹批量导出 | M/args.js、electron.js、export-files.js | 递归、超时、错误继续、覆盖策略、退出码和参数组合 | 待迁移 |
| F35 | 修复模型与命令行布局 | M/args.js、D/ElectronApp.js | normalize、layout 和格式转换组合 | 待迁移 |
| F36 | 文本/图形/图片/HTML/SVG 剪贴板 | D/ElectronApp.js、M/electron.js | 跨文档及外部应用往返，新旧 Electron 剪贴板 API 适配 | 待迁移 |
| F37 | 快捷键、右键、拖放、滚轮/触控板 | G/EditorUi.js、D/ElectronApp.js、M/electron.js | 系统快捷键冲突、原位粘贴、文件拖入和滚动/缩放区分 | 待迁移 |
| F38 | 多窗口与关闭行为 | M/electron.js、window-bounds.js | 多文档、未保存关闭、窗口位置恢复、导出隐藏窗口 | 待迁移 |
| F39 | 单实例、文件关联、二次打开文件 | M/electron.js、HAP Ability/Want | 用鸿蒙生命周期和文件路由替代不支持的锁/事件 | 待迁移 |
| F40 | 字体枚举、字体配置、公式排版 | M/electron.js、D/EditorUi.js、math4/ | 本地字体清单、缺字回退、MathJax 显示和导出一致 | 待迁移 |
| F41 | 拼写检查 | M/electron.js、D/Menus.js | 词典能力、启停和资源可达性 | 待迁移 |
| F42 | 语言、设置、配置文件、启动参数 | D/Menus.js、M/url-params.js、config-paths.js | 重启持久化、中文界面、配置路径与字体/模板授权 | 待迁移 |
| F43 | 随应用交付的内置插件 | D/App.js、ElectronApp.js、plugins/ | 对照公开插件注册表逐项验证；保留原版加载限制 | 待迁移 |
| F44 | 外部链接、系统打开、显示所在目录 | M/electron.js、SIG shell 支持表 | 文档内链接、允许的协议、用户授权路径 | 待迁移 |
| F45 | 系统近期文件、预览、缩略图 | M/electron.js、build/quicklook-preview.html、build/quicklook-entitlements.plist | 先列各平台基线，再核对鸿蒙可提供的等价集成 | 待盘点 |
| F46 | 更新检查、通知和安装更新 | M/update-mode.js、update-channel.js、electron-updater | 独立迁移渠道、HAP 更新、签名、用户数据保留；不更新回上游其他系统包 | 待迁移 |
| F47 | 安装、升级、卸载及数据生命周期 | HAP 配置、构建和签名流程 | 安装升级兼容、版本号、配置迁移、卸载行为 | 待迁移 |
| F48 | 键盘可达性、焦点、可访问性 | G/EditorUi.js、D/Dialogs.js、ArkWeb/运行时 | 对话框焦点、Tab 顺序、文字缩放和屏幕阅读能力 | 待迁移 |
| F49 | 数据授权、隔离与异常处理 | M/config-paths.js、preload、会话限制 | 非授权路径/消息拒绝，导入内容不能扩大文件访问权限 | 待迁移 |
| F50 | 大图性能和资源稳定性 | 编辑器、导入导出、多窗口 | 代表性文档延迟、内存、长时间编辑、连续导出 | 待迁移 |
| F51 | 构建复现、许可证和维护资料 | package-lock、运行时清单、许可证 | 源码/依赖/运行时可追溯，保留许可证及构建说明 | 待迁移 |
| B01 | Web 云账号、实时协作及外部插件 | Desktop README、D/ElectronApp.js 的条件分支 | 记录该桌面版本原本不可用的能力；若后续扩展目标再单独设计 | 基线差异，需 UI 复核 |

每项后续补充：原版操作步骤、样本文件、鸿蒙实现位置、运行时和设备版本、验证记录、差异以及暂留条目。初版没有任何正式暂留项；风险和环境不足保留为待处理工作。
