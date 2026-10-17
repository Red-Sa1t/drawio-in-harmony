# draw.io 运行时能力探针

将此目录完整放入配套 Electron HAP 的 `web_engine/src/main/resources/resfile/resources/app/`，或使用桌面 Electron 加载目录。

默认显示操作界面；`--probe-auto` 在隐藏窗口执行自动检查后退出，`--probe-output=<目录>` 指定报告父目录。每次启动创建新的 `drawio-probe-*` 目录，保留 JSON、PNG 和 PDF。自动运行退出码 0 只说明本次自动断言通过，不能代表目标 API、打印输出、字体或完整应用验收。

手动步骤：运行基础验证 → 选择测试文档 → 另存测试文件 → 点击剪贴板测试（会覆盖剪贴板）→ 打印 → 导出报告。另行验证输入法、窗口焦点/关闭、二次文件打开和导出外观。

探针不会自动读取其他文档，也不会自动执行剪贴板或打印操作。读写 IPC 仅接受固定命令，文件路径来自主进程系统选择器。`target.deviceVerified` 初始为 false，必须配套保存 CLI 的真实设备信息，禁止将主机测试报告当作 HarmonyOS 报告。
