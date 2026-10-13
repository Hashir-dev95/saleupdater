const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, RECORD, OLD } = require('./helpers.cjs');

test('picker cancellation returns null without changing storage', async () => {
  const f = fixture({ cancelPicker: true });
  const before = f.values.get(RECORD);
  assert.equal(await f.load('services/fileService.ts').pickExcelFile(), null);
  assert.equal(f.values.get(RECORD), before);
  assert.equal(f.files.has(OLD), true);
});
test('picker returns the actual provider URI instead of fabricating a cache path', async () => {
  const f = fixture();
  f.mocks['expo-document-picker'].getDocumentAsync = async () => ({ canceled: false, assets: [{ uri: 'content://provider/file', name: 'Provider.xlsx' }] });
  assert.equal((await f.load('services/fileService.ts').pickExcelFile()).uri, 'content://provider/file');
});
test('Android opens with content URI, Excel MIME type, and read permission', async () => {
  const f = fixture();
  await f.load('services/fileService.ts').openWorkbook(OLD);
  const intent = f.operations.find(x => x.intent).intent;
  assert.equal(intent.action, 'android.intent.action.VIEW');
  assert.equal(intent.params.data, 'content://workbook');
  assert.equal(intent.params.flags, 1);
  assert.equal(intent.params.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
test('iOS opening and export use the native share sheet without Android APIs', async () => {
  const f = fixture({ platform: 'ios' });
  const service = f.load('services/fileService.ts');
  await service.openWorkbook(OLD);
  assert.equal(await service.downloadWorkbook(OLD, 'Old.xlsx'), 'shared');
  assert.equal(f.operations.filter(x => x.share).length, 2);
  assert.equal(f.operations.find(x => x.share).share.params.UTI, 'org.openxmlformats.spreadsheetml.sheet');
  assert.equal(f.operations.includes('SAF'), false);
  assert.equal(f.operations.some(x => x.intent), false);
});
test('Android export cancellation creates no destination and preserves saved workbook', async () => {
  const f = fixture({ cancelExport: true });
  const before = f.values.get(RECORD);
  assert.equal(await f.load('services/fileService.ts').downloadWorkbook(OLD, 'Old.xlsx'), 'canceled');
  assert.equal(f.operations.includes('createExport'), false);
  assert.equal(f.values.get(RECORD), before);
});
test('Android export writes the validated workbook to SAF', async () => {
  const f = fixture();
  assert.equal(await f.load('services/fileService.ts').downloadWorkbook(OLD, 'Old.xlsx'), 'saved');
  assert.equal(f.files.get('content://destination'), f.bytes);
});
for (const [label, options, action] of [
  ['open', { openFails: true }, service => service.openWorkbook(OLD)],
  ['share', { shareFails: true }, service => service.shareWorkbook(OLD, 'Old.xlsx')],
  ['sharing unavailable', { sharingUnavailable: true }, service => service.shareWorkbook(OLD, 'Old.xlsx')],
  ['export', { exportFails: true }, service => service.downloadWorkbook(OLD, 'Old.xlsx')],
  ['HTTP download', { status: 503 }, service => service.shareWorkbook('https://server/bad.xlsx', 'Bad.xlsx')],
  ['invalid download', { invalidExcel: true }, service => service.openWorkbook('https://server/bad.xlsx')],
]) test(`${label} failure never deletes the saved workbook`, async () => {
  const f = fixture(options);
  const before = f.values.get(RECORD);
  await assert.rejects(action(f.load('services/fileService.ts')));
  assert.equal(f.files.has(OLD), true);
  assert.equal(f.values.get(RECORD), before);
  assert.equal(f.operations.includes('delete:' + OLD), false);
});
