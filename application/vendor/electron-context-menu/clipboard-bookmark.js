// Local Electron 37 / 44 compatibility; menu error handling remains in index.js.
export async function writeClipboardBookmark(electron, title, url) {
	if (typeof electron.ClipboardItem === 'function') {
		await electron.clipboard.write([
			new electron.ClipboardItem({
				'text/plain': url,
				'electron application/bookmark': {title, url},
			}),
		]);
	} else {
		await electron.clipboard.write({text: url, bookmark: title});
	}
}
