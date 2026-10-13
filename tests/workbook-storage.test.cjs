const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, RECORD, OLD, excelBytes } = require('./helpers.cjs');

test('reads legacy metadata and migrates all fields in one metadata write', async () => {
  const f = fixture({ values: [
    ['@SalesUpdater:workbook_uri', OLD], ['@SalesUpdater:workbook_name', 'Old.xlsx'],
    ['@SalesUpdater:workbook_confirmed_ts', '100'], ['@SalesUpdater:workbook_updated_ts', '200'],
  ] });
  const service = f.load('services/workbookStorage.ts');
  const saved = await service.getPersistedWorkbook();
  assert.equal(saved.uri, OLD);
  await service.savePersistedWorkbook({ ...saved, confirmedTimestamp: 300 });
  assert.equal(JSON.parse(f.values.get(RECORD)).updatedTimestamp, 200);
  assert.equal(JSON.parse(f.values.get(RECORD)).confirmedTimestamp, 300);
  assert.equal(f.operations.filter(x => x === 'metadata').length, 1);
});

test('validates replacement and commits metadata before deleting previous managed copy', async () => {
  const f = fixture();
  const service = f.load('services/workbookStorage.ts');
  const saved = await service.replacePersistedWorkbook({ uri: 'https://server/new.xlsx', name: 'New.xlsx', updatedTimestamp: 400 });
  assert.equal(JSON.parse(f.values.get(RECORD)).uri, saved.uri);
  assert.equal(saved.confirmedTimestamp, 100);
  assert.equal(f.files.has(OLD), false);
  assert.ok(f.operations.indexOf('validate') < f.operations.indexOf('metadata'));
  assert.ok(f.operations.indexOf('metadata') < f.operations.indexOf('delete:' + OLD));
});

for (const [label, options] of [
  ['metadata write', { saveFails: true }], ['storage read', { readFails: true }],
  ['partial copy', { copyFails: true }], ['network', { networkFails: true }],
  ['HTTP 503', { status: 503 }], ['HTTP 404', { status: 404 }],
  ['invalid Excel', { invalidExcel: true }], ['empty file', { empty: true }],
]) test(`${label} failure preserves previous file and metadata`, async () => {
  const f = fixture(options);
  const before = f.values.get(RECORD);
  const service = f.load('services/workbookStorage.ts');
  await assert.rejects(service.replacePersistedWorkbook({ uri: options.copyFails ? 'file:///picked.xlsx' : 'https://server/new.xlsx', name: 'New.xlsx' }));
  assert.equal(f.files.has(OLD), true);
  assert.equal(f.values.get(RECORD), before);
  assert.equal(f.operations.includes('delete:' + OLD), false);
  assert.equal([...f.files.keys()].filter(x => x.startsWith('file:///documents/')).length, 1);
});

test('cleanup failure does not invalidate a committed replacement', async () => {
  const f = fixture({ deleteFails: true });
  const saved = await f.load('services/workbookStorage.ts').replacePersistedWorkbook({ uri: 'file:///picked.xlsx', name: 'New.xlsx' });
  assert.equal(JSON.parse(f.values.get(RECORD)).uri, saved.uri);
  assert.equal(f.files.has(saved.uri), true);
});

test('never deletes an original file outside managed workbook copies', async () => {
  const f = fixture({ values: [[RECORD, JSON.stringify({ uri: 'file:///documents/original.xlsx', name: 'Original.xlsx' })]] });
  f.files.set('file:///documents/original.xlsx', f.bytes);
  await f.load('services/workbookStorage.ts').replacePersistedWorkbook({ uri: 'file:///picked.xlsx', name: 'New.xlsx' });
  assert.equal(f.files.has('file:///documents/original.xlsx'), true);
});

test('content validation accepts a real XLSX and rejects permissive SheetJS text formats and corrupt ZIPs', () => {
  const { validateExcelContents } = fixture().load('services/workbookStorage.ts');
  validateExcelContents(excelBytes());
  for (const text of ['a,b\n1,2', '<html><table><tr><td>Error</td></tr></table></html>', '{"error":"failed"}']) {
    assert.throws(() => validateExcelContents(Buffer.from(text).toString('base64')), /valid Excel/);
  }
  assert.throws(() => validateExcelContents(Buffer.from([0x50, 0x4b, 3, 4, 0, 0]).toString('base64')), /valid Excel/);
});
