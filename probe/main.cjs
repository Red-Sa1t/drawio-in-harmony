const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } = electron;
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const auto = process.argv.includes('--probe-auto');
const page = path.join(__dirname, 'index.html');
const pageURL = pathToFileURL(page).href;
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
let mainWindow;
let directory;
let busy = false;
let tray;
let secondaryWindow;
let bridgeReady;
const ready = new Promise(resolve => { bridgeReady = resolve; });
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(), purpose: 'runtime-capability-probe',
  target: { os: 'HarmonyOS 6.1.0', api: 23, deviceVerified: false },
  runtime: { versions: process.versions, platform: process.platform, arch: process.arch,
    release: os.release(), osVersion: os.version() },
  validationScope: ['Probe assertions only; does not establish draw.io feature parity.',
    'Match external device/version evidence before treating results as target validation.',
    'PNG/PDF require visual review; print callback does not confirm physical output.'],
  results: [], lifecycle: [],
  manualPending: ['clipboard', 'open-file', 'save-file', 'print', 'IME', 'window-focus-close',
    'Want-file-routing', 'PNG-PDF-visual-review', 'device-API-and-architecture']
};

function timed(promise, milliseconds = 20000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${milliseconds} ms`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}

async function persist() {
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

async function check(id, operation, timeoutMs = 20000) {
  const start = Date.now();
  let result;
  try {
    const pending = Promise.resolve().then(operation);
    const details = await (timeoutMs === null ? pending : timed(pending, timeoutMs));
    result = { id, status: details?.cancelled ? 'cancelled' : details?.externalReview ? 'pending' : 'passed', details };
  } catch (error) {
    result = { id, status: 'failed', error: String(error?.stack || error) };
  }
  result.durationMs = Date.now() - start;
  report.results.push(result);
  await persist();
  return result;
}

function ensure(value, message) {
  if (!value) throw new Error(message);
}

function authorize(event) {
  ensure(mainWindow && !mainWindow.isDestroyed(), 'Probe window unavailable');
  ensure(event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame
    && event.senderFrame.url === pageURL, 'Rejected IPC sender');
}

function observeWindow(window, name) {
  for (const event of ['ready-to-show', 'show', 'hide', 'focus', 'blur', 'close', 'closed']) {
    window.on(event, () => { report.lifecycle.push({ window: name, event, at: new Date().toISOString() }); });
  }
  window.webContents.on('render-process-gone', (_, details) => {
    report.results.push({ id: `${name}:render-process`, status: 'failed', details });
    void persist();
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

async function automatic() {
  await check('preload-contextBridge-ipc', async () => {
    const details = await ready;
    ensure(details.nodeExposed === false, 'Renderer exposes require despite isolation');
    return details;
  });
  await check('sandbox-file-roundtrip', async () => {
    const original = path.join(directory, '中文 空格.drawio');
    const renamed = path.join(directory, '重命名.drawio');
    const content = '<mxfile><diagram name="中文页面"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
    await fs.writeFile(original, content, { flag: 'wx' });
    ensure(await fs.readFile(original, 'utf8') === content, 'File content mismatch');
    await fs.rename(original, renamed);
    ensure(await fs.readFile(renamed, 'utf8') === content, 'Rename content mismatch');
    // Remove only this probe's known fixture. Device user files are never deleted.
    await fs.unlink(renamed);
    return { bytes: Buffer.byteLength(content), sha256: sha256(content), unicodePath: true };
  });
  await check('capture-page', async () => {
    const image = await mainWindow.webContents.capturePage();
    ensure(!image.isEmpty(), 'Empty capture');
    const png = image.toPNG();
    ensure(png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Invalid PNG header');
    await fs.writeFile(path.join(directory, 'capture.png'), png);
    return { size: image.getSize(), bytes: png.length, sha256: sha256(png), visualReview: 'pending' };
  });
  await check('print-to-pdf', async () => {
    const pdf = await mainWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    ensure(pdf.subarray(0, 5).toString() === '%PDF-', 'Invalid PDF header');
    await fs.writeFile(path.join(directory, 'fixture.pdf'), pdf);
    return { bytes: pdf.length, sha256: sha256(pdf), visualReview: 'pending' };
  });
  await check('printer-enumeration', async () => {
    const printers = await mainWindow.webContents.getPrintersAsync();
    ensure(Array.isArray(printers), 'Invalid printer list');
    return { count: printers.length, physicalPrinting: 'pending' };
  });
  await check('additional-hidden-window', async () => {
    const child = new BrowserWindow({ show: false, width: 480, height: 320,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    observeWindow(child, 'hidden');
    try {
      await timed(child.loadURL('data:text/html,<title>drawio-hidden-probe</title><p>Hidden export window</p>'));
      ensure(await child.webContents.executeJavaScript('document.title') === 'drawio-hidden-probe', 'Hidden window failed to load');
      const pdf = await child.webContents.printToPDF({ pageSize: 'A4' });
      ensure(pdf.subarray(0, 5).toString() === '%PDF-', 'Hidden window PDF header mismatch');
      await fs.writeFile(path.join(directory, 'hidden.pdf'), pdf);
      return { title: child.getTitle(), load: true, pdfBytes: pdf.length,
        externalReview: true, nativeWindow: 'Check device window list and hilog; DOM success is insufficient.' };
    } finally {
      child.destroy();
    }
  });
}

async function clipboardProbe() {
  await check('clipboard-text', async () => {
    const text = 'draw.io 鸿蒙剪贴板验证';
    await clipboard.writeText(text);
    ensure(await clipboard.readText() === text, 'Clipboard text mismatch');
    return { roundtrip: true };
  });
  await check('clipboard-image-html', async () => {
    const image = nativeImage.createFromBitmap(Buffer.from([0, 0, 255, 255]), { width: 1, height: 1 });
    const html = '<b>drawio-probe-html</b>';
    const modern = typeof electron.ClipboardItem === 'function';
    if (modern) {
      await clipboard.write([new electron.ClipboardItem({
        'image/png': new Blob([image.toPNG()], { type: 'image/png' }), 'text/html': html
      })]);
    } else {
      await clipboard.write({ image, html });
    }
    let readImage;
    let readHTML;
    if (typeof clipboard.readImage === 'function') {
      readImage = await clipboard.readImage();
      readHTML = await clipboard.readHTML();
    } else {
      const items = await clipboard.read();
      const png = items.find(item => item.types.includes('image/png'));
      const markup = items.find(item => item.types.includes('text/html'));
      ensure(png && markup, 'Clipboard lost PNG or HTML representation');
      readImage = nativeImage.createFromBuffer(Buffer.from(await (await png.getType('image/png')).arrayBuffer()));
      readHTML = await (await markup.getType('text/html')).text();
    }
    ensure(!readImage.isEmpty() && readImage.getSize().width === 1 && readImage.getSize().height === 1,
      'Clipboard image size mismatch');
    ensure(readImage.toBitmap().equals(image.toBitmap()), 'Clipboard image pixel mismatch');
    ensure(readHTML.includes('drawio-probe-html'), 'Clipboard HTML mismatch');
    return { api: modern ? 'ClipboardItem' : 'legacy', imageRoundtrip: true, htmlRoundtrip: true };
  });
}

const operations = {
  automatic,
  'runtime-tray': () => check('runtime-tray', async () => {
    if (!tray) {
      const pixels = Buffer.alloc(16 * 16 * 4);
      for (let offset = 0; offset < pixels.length; offset += 4) {
        pixels.set([0x16, 0x6d, 0xf0, 0xff], offset);
      }
      tray = new electron.Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }));
      tray.setToolTip('draw.io 迁移运行时验证');
      tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
    }
    return { externalReview: true, purpose: 'Test ATTACH_TO_STATUS_BAR_ITEM prerequisite',
      destroyed: tray.isDestroyed(), nativeRegistration: 'Verify status bar and hilog before window tests.' };
  }),
  'visible-window': () => check('additional-visible-window', async () => {
    if (secondaryWindow && !secondaryWindow.isDestroyed()) secondaryWindow.destroy();
    secondaryWindow = new BrowserWindow({ title: 'draw.io 第二窗口验证', width: 640, height: 480,
      show: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    observeWindow(secondaryWindow, 'visible');
    await secondaryWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<title>draw.io 第二窗口验证</title><h1>第二窗口 / Second window</h1><p>核对系统窗口列表、焦点与关闭行为。</p>'));
    return { externalReview: true, id: secondaryWindow.id, visible: secondaryWindow.isVisible(),
      bounds: secondaryWindow.getBounds(), trayCreated: Boolean(tray), nativeWindow: 'Requires device UI evidence.' };
  }),
  clipboard: clipboardProbe,
  'open-file': () => check('file-picker-read', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    if (selected.canceled) return { cancelled: true };
    ensure(selected.filePaths.length === 1, 'Expected one selected file');
    const file = selected.filePaths[0];
    const stat = await fs.stat(file);
    ensure(stat.isFile() && stat.size <= 32 * 1024 * 1024, 'Select a file up to 32 MiB for this probe');
    const data = await fs.readFile(file);
    return { basename: path.basename(file), bytes: data.length, sha256: sha256(data) };
  }, null),
  'save-file': () => check('file-picker-save', async () => {
    const selected = await dialog.showSaveDialog(mainWindow, { defaultPath: 'drawio-probe-中文.txt' });
    if (selected.canceled) return { cancelled: true };
    ensure(selected.filePath, 'No selected destination');
    const content = 'draw.io HarmonyOS probe / 中文保存测试\n';
    await fs.writeFile(selected.filePath, content);
    ensure(await fs.readFile(selected.filePath, 'utf8') === content, 'Saved content mismatch');
    return { basename: path.basename(selected.filePath), roundtrip: true };
  }, null),
  print: () => check('print-dialog-callback', () => new Promise((resolve, reject) => {
    mainWindow.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      if (!success && /cancel(?:ed|led)/i.test(reason || '')) resolve({ cancelled: true, reason });
      else if (!success) reject(new Error(`Print did not complete: ${reason}`));
      else resolve({ callbackSuccess: true, physicalOutput: 'pending-user-verification' });
    });
  }), null),
  'save-report': async () => {
    const selected = await dialog.showSaveDialog(mainWindow, { defaultPath: 'drawio-runtime-report.json' });
    if (!selected.canceled && selected.filePath) {
      await fs.writeFile(selected.filePath, JSON.stringify(report, null, 2) + '\n');
    }
  }
};

app.whenReady().then(async () => {
  const outputArg = process.argv.find(argument => argument.startsWith('--probe-output='));
  const parent = outputArg ? path.resolve(outputArg.slice('--probe-output='.length)) : app.getPath('userData');
  await fs.mkdir(parent, { recursive: true });
  directory = await fs.mkdtemp(path.join(parent, 'drawio-probe-'));
  report.artifactDirectory = directory;
  report.apiPresence = { ClipboardItem: typeof electron.ClipboardItem === 'function',
    singleInstanceLock: typeof app.requestSingleInstanceLock === 'function',
    note: 'Presence is not an operational support result. Lock deliberately not acquired by the diagnostic app.' };
  await persist();
  mainWindow = new BrowserWindow({ title: 'draw.io 迁移运行时验证', width: 1100, height: 800,
    show: !auto, webPreferences: { preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  observeWindow(mainWindow, 'main');
  ipcMain.handle('drawio-probe:ready', (event, details) => {
    authorize(event);
    ensure(details && typeof details.nodeExposed === 'boolean' && typeof details.userAgent === 'string', 'Invalid ready payload');
    bridgeReady({ nodeExposed: details.nodeExposed, userAgent: details.userAgent });
    return true;
  });
  ipcMain.handle('drawio-probe:report', event => { authorize(event); return report; });
  ipcMain.handle('drawio-probe:run', async (event, operation) => {
    authorize(event);
    ensure(typeof operation === 'string' && Object.hasOwn(operations, operation), 'Unknown operation');
    ensure(!busy, 'Probe operation already running');
    busy = true;
    try { await operations[operation](); return true; }
    finally { busy = false; }
  });
  await timed(mainWindow.loadFile(page));
  if (auto) {
    busy = true;
    await automatic();
    mainWindow.destroy();
    report.finishedAt = new Date().toISOString();
    await persist();
    console.log(JSON.stringify({ report: path.join(directory, 'report.json'), results: report.results.map(({ id, status }) => ({ id, status })) }));
    app.exit(report.results.some(result => result.status === 'failed') ? 1 : 0);
  }
}).catch(async error => {
  console.error(error);
  report.results.push({ id: 'startup', status: 'failed', error: String(error?.stack || error) });
  if (directory) await persist().catch(() => {});
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (!auto) app.quit();
});
