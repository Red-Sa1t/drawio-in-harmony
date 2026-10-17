import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipboardAction } from '../main/clipboard-compat.js';

test('Electron 37 synchronous text reads and writes remain awaitable', async () => {
	let text = '';
	const action = createClipboardAction({clipboard: {
		writeText: value => { text = value; }, readText: () => text
	}});
	assert.ok(action('writeText', '中文') instanceof Promise);
	assert.equal(await action('readText'), '中文');
});

test('Electron 37 writes the native image and HTML together with original dimensions', async () => {
	const image = {};
	let written;
	let dataUrl;
	const action = createClipboardAction({
		nativeImage: {createFromDataURL: value => { dataUrl = value; return image; }},
		clipboard: {write: value => { written = value; }}
	});
	await action('writeImage', {dataUrl: 'data:image/png;base64,AAAA', w: 120, h: 80});
	assert.equal(dataUrl, 'data:image/png;base64,AAAA');
	assert.deepEqual(written, {image, html: '<img src="data:image/png;base64,AAAA" width="120" height="80">'});
});

test('Electron 44 writes a ClipboardItem containing the PNG bytes and HTML', async () => {
	const png = Buffer.from([137, 80, 78, 71]);
	let written;
	class ClipboardItem {
		constructor(data) { this.data = data; }
	}
	const action = createClipboardAction({ClipboardItem,
		nativeImage: {createFromDataURL: () => ({toPNG: () => png})},
		clipboard: {write: async value => { written = value; }}
	});
	await action('writeImage', {dataUrl: 'data:image/png;base64,AAAA', w: 120, h: 80});
	assert.equal(written.length, 1);
	assert.ok(written[0] instanceof ClipboardItem);
	assert.equal(written[0].data['image/png'].type, 'image/png');
	assert.deepEqual(Buffer.from(await written[0].data['image/png'].arrayBuffer()), png);
	assert.equal(written[0].data['text/html'], '<img src="data:image/png;base64,AAAA" width="120" height="80">');
});

test('Asynchronous clipboard text results are forwarded', async () => {
	const action = createClipboardAction({clipboard: {readText: async () => 'diagram'}});
	assert.equal(await action('readText'), 'diagram');
});

test('Native synchronous errors reject the operation instead of reporting success', async () => {
	const action = createClipboardAction({clipboard: {writeText: () => { throw new Error('denied'); }}});
	await assert.rejects(action('writeText', 'text'), /denied/);
});

test('Native asynchronous errors reject the operation', async () => {
	const action = createClipboardAction({clipboard: {readText: async () => { throw new Error('denied'); }}});
	await assert.rejects(action('readText'), /denied/);
});

test('Unsupported actions do not expose other clipboard methods', async () => {
	const action = createClipboardAction({clipboard: {clear: () => assert.fail('must not clear')}});
	assert.equal(await action('clear'), undefined);
});
