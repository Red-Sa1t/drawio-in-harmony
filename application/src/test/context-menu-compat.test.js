import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeClipboardBookmark} from '../../vendor/electron-context-menu/clipboard-bookmark.js';

test('Electron 37 writes a URL and bookmark title together', async () => {
	const writes = [];
	await writeClipboardBookmark({clipboard: {write: value => writes.push(value)}}, '中文标题', 'https://example.org/a');
	assert.deepEqual(writes, [{text: 'https://example.org/a', bookmark: '中文标题'}]);
});

test('Electron 44 keeps the original ClipboardItem formats', async () => {
	class ClipboardItem { constructor(data) { this.data = data; } }
	let written;
	await writeClipboardBookmark({ClipboardItem, clipboard: {write: async value => { written = value; }}}, 'Title', 'https://example.org/');
	assert.ok(written[0] instanceof ClipboardItem);
	assert.deepEqual(written[0].data, {'text/plain': 'https://example.org/',
		'electron application/bookmark': {title: 'Title', url: 'https://example.org/'}});
});

for (const asyncFailure of [false, true]) {
	test(`clipboard ${asyncFailure ? 'rejection' : 'throw'} reaches the caller`, async () => {
		const failure = new Error('clipboard permission denied');
		const write = asyncFailure ? () => Promise.reject(failure) : () => { throw failure; };
		await assert.rejects(writeClipboardBookmark({clipboard: {write}}, 'Title', 'https://example.org/'), error => error === failure);
	});
}
