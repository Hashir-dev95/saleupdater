const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, screen, RECORD, OLD } = require('./helpers.cjs');
const MESSAGE = '*12.07.2026*\n*Dsf* : M.Yaseen\n*Today\'s valunne* : 50,885';

async function ready(options) {
  const f = fixture(options);
  const ui = screen(f);
  await ui.settle();
  return { f, ui };
}
function parse(ui) {
  ui.edit(MESSAGE);
  ui.button('Parse message').props.onPress();
}

test('workbook change requires confirmation; dismissing it never opens the picker', async () => {
  const { f, ui } = await ready();
  ui.button('Change workbook').props.onPress();
  assert.equal(ui.alert().kind, 'confirmation');
  assert.equal(f.operations.includes('picker'), false);
  ui.find(node => node.type === 'SweetAlert').props.onClose();
  assert.equal(ui.state().selectedFile.uri, OLD);
});
test('canceling the picker after confirmation preserves current workbook and metadata', async () => {
  const { f, ui } = await ready({ cancelPicker: true });
  const before = f.values.get(RECORD);
  ui.button('Change workbook').props.onPress();
  ui.alert().onConfirm();
  await ui.settle();
  assert.equal(ui.state().selectedFile.uri, OLD);
  assert.equal(f.values.get(RECORD), before);
  assert.equal(f.files.has(OLD), true);
});
test('editing or clearing sales invalidates parsed values and disables Update Excel', async () => {
  const { f, ui } = await ready();
  parse(ui);
  assert.equal(ui.button('Update Excel').props.disabled, false);
  const stalePress = ui.button('Update Excel').props.onPress;
  ui.edit(MESSAGE + '\nChanged');
  assert.equal(ui.state().parsedMessage, null);
  assert.equal(ui.button('Update Excel').props.disabled, true);
  stalePress();
  await ui.settle();
  assert.equal(f.operations.some(x => x.upload), false);
  ui.button('Parse message').props.onPress();
  ui.button('Clear message').props.onPress();
  assert.equal(ui.state().pastedMessage, '');
  assert.equal(ui.state().parsedMessage, null);
  assert.equal(ui.button('Update Excel').props.disabled, true);
});
test('success dialog waits for metadata persistence to complete', async () => {
  const { f, ui } = await ready();
  let release;
  const storage = f.mocks['@react-native-async-storage/async-storage'].default;
  const save = storage.setItem;
  storage.setItem = async (...args) => {
    await new Promise(resolve => { release = resolve; });
    return save(...args);
  };
  parse(ui);
  ui.button('Update Excel').props.onPress();
  await ui.settle();
  assert.equal(ui.alert(), null);
  assert.equal(ui.state().selectedFile.uri, OLD);
  assert.equal(f.files.has(OLD), true);
  release();
  await ui.settle();
  assert.equal(ui.alert().title, 'Excel updated!');
  assert.equal(JSON.parse(f.values.get(RECORD)).uri, ui.state().selectedFile.uri);
});
test('failed workbook selection preserves the active workbook', async () => {
  const { f, ui } = await ready({ saveFails: true });
  const before = f.values.get(RECORD);
  ui.button('Change workbook').props.onPress();
  ui.alert().onConfirm();
  await ui.settle();
  assert.equal(ui.alert().kind, 'error');
  assert.equal(ui.state().selectedFile.uri, OLD);
  assert.equal(f.values.get(RECORD), before);
  assert.equal(f.files.has(OLD), true);
});
test('rapid taps produce only one upload and success follows persistence', async () => {
  const { f, ui } = await ready();
  let release;
  const upload = f.mocks['expo-file-system/legacy'].uploadAsync;
  f.mocks['expo-file-system/legacy'].uploadAsync = async (...args) => {
    const result = await upload(...args);
    await new Promise(resolve => { release = resolve; });
    return result;
  };
  parse(ui);
  const press = ui.button('Update Excel').props.onPress;
  press(); press(); press();
  await ui.settle();
  assert.equal(f.operations.filter(x => x.upload).length, 1);
  assert.equal(ui.alert(), null);
  release();
  await ui.settle();
  assert.equal(ui.alert().title, 'Excel updated!');
  assert.equal(ui.alert().confirmLabel, 'Open workbook');
  assert.equal(ui.alert().cancelLabel, 'Done');
  assert.equal(JSON.parse(f.values.get(RECORD)).uri, ui.state().selectedFile.uri);
  assert.equal(f.files.has(ui.state().selectedFile.uri), true);
});
for (const options of [{ saveFails: true }, { status: 503 }, { invalidExcel: true }]) {
  test(`failed update ${JSON.stringify(options)} keeps workbook and never shows success`, async () => {
    const { f, ui } = await ready(options);
    const before = f.values.get(RECORD);
    parse(ui);
    ui.button('Update Excel').props.onPress();
    await ui.settle();
    assert.equal(ui.alert().kind, 'error');
    assert.equal(ui.state().successMessage, null);
    assert.equal(ui.state().selectedFile.uri, OLD);
    assert.equal(f.values.get(RECORD), before);
    assert.equal(f.files.has(OLD), true);
    // Lock is released after failure, permitting a retry.
    assert.equal(ui.button('Update Excel').props.disabled, false);
  });
}
for (const [title, options] of [['Open', { openFails: true }], ['Share', { shareFails: true }], ['Export', { exportFails: true }]]) {
  test(`screen ${title} failure preserves file, metadata, and selected workbook`, async () => {
    const { f, ui } = await ready(options);
    const before = f.values.get(RECORD);
    ui.button(title).props.onPress();
    await ui.settle();
    assert.equal(ui.alert().kind, 'error');
    assert.equal(ui.state().selectedFile.uri, OLD);
    assert.equal(f.values.get(RECORD), before);
    assert.equal(f.files.has(OLD), true);
  });
}
test('existing upload API and supported message formats remain compatible', async () => {
  const { f, ui } = await ready();
  const parser = f.load('services/parserService.ts');
  for (const label of ["Today's valunne", "Today's value", 'Today sales', 'Today v']) {
    const parsed = parser.parseSalesMessage(`12.07.2026\nD.S.F name = M.Yaseen\n${label}: 50,885`);
    assert.equal(parsed.todayValue, 50885);
    assert.equal(parsed.dsf, 'M.Yaseen');
  }
  parse(ui);
  ui.button('Update Excel').props.onPress();
  await ui.settle();
  const { url, params } = f.operations.find(x => x.upload).upload;
  assert.ok(url.endsWith('/api/excel/update'));
  assert.equal(params.fieldName, 'file');
  assert.equal(params.httpMethod, 'POST');
  assert.equal(params.parameters.todayValue, '50885');
  assert.equal(params.parameters.dsf, 'M.Yaseen');
  assert.equal(params.parameters.date, '12.07.2026');
});
