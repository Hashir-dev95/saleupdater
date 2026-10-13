const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute);
    const exports = {};
    cache.set(absolute, exports);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const requireModule = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(absolute), name);
        const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p));
        return load(target);
      }
      return require(name);
    };
    vm.runInNewContext(code, { exports, require: requireModule, console: { log() {}, warn() {}, error() {} }, global: {}, Buffer, URL, setTimeout }, { filename: absolute });
    return exports;
  }
  return load;
}

function excelBytes() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['DSF', 'Sales'], ['M.Yaseen', 10]]), 'Sales');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}
const RECORD = '@SalesUpdater:workbook';
const OLD = 'file:///documents/workbook_100.xlsx';
function fixture(options = {}) {
  const bytes = excelBytes();
  const oldRecord = { uri: OLD, name: 'Old.xlsx', confirmedTimestamp: 100, updatedTimestamp: 200 };
  const values = new Map(options.values ?? [[RECORD, JSON.stringify(oldRecord)]]);
  const files = new Map([[OLD, bytes], ['file:///picked.xlsx', bytes]]);
  const operations = [];
  const storage = {
    async getItem(key) { if (options.readFails) throw new Error('Storage read failed'); return values.get(key) ?? null; },
    async multiGet(keys) { return Promise.all(keys.map(async key => [key, await storage.getItem(key)])); },
    async setItem(key, value) { operations.push('metadata'); if (options.saveFails) throw new Error('Storage write failed'); values.set(key, value); },
  };
  const fileSystem = {
    documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' }, FileSystemUploadType: { MULTIPART: 1 },
    async getInfoAsync(uri) { return { exists: files.has(uri), isDirectory: false, size: files.get(uri)?.length ?? 0 }; },
    async readAsStringAsync(uri) { operations.push('validate'); if (!files.has(uri)) throw new Error('File not found'); return files.get(uri); },
    async copyAsync({ from, to }) { operations.push('copy'); files.set(to, files.get(from)); if (options.copyFails) throw new Error('Copy failed'); },
    async downloadAsync(source, target) { operations.push('download'); files.set(target, options.invalidExcel ? Buffer.from('HTTP error page').toString('base64') : options.empty ? '' : bytes); if (options.networkFails) throw new Error('Network failed'); return { status: options.status ?? 200, uri: target }; },
    async deleteAsync(uri) { operations.push('delete:' + uri); if (options.deleteFails) throw new Error('Delete failed'); files.delete(uri); },
    async getContentUriAsync(uri) { operations.push('content:' + uri); return 'content://workbook'; },
    async writeAsStringAsync(uri, value) { if (options.exportFails) throw new Error('Export failed'); operations.push('export:' + uri); files.set(uri, value); },
    async uploadAsync(url, uri, params) { operations.push({ upload: { url, uri, params } }); return { status: 200, body: JSON.stringify({ success: true, result: { downloadUrl: 'https://server/updated.xlsx' } }) }; },
    StorageAccessFramework: {
      async requestDirectoryPermissionsAsync() { operations.push('SAF'); return { granted: !options.cancelExport, directoryUri: 'content://downloads' }; },
      async createFileAsync() { operations.push('createExport'); return 'content://destination'; },
    },
  };
  const native = {
    Platform: { OS: options.platform ?? 'android' },
    StyleSheet: { create: x => x }, Text: 'Text', View: 'View', TextInput: 'TextInput', useWindowDimensions: () => ({ width: 1000 }),
  };
  const mocks = {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'expo-file-system/legacy': fileSystem,
    'expo-file-system': { File: class {} },
    'expo-document-picker': { async getDocumentAsync() { operations.push('picker'); return options.cancelPicker ? { canceled: true } : { canceled: false, assets: [{ uri: 'file:///picked.xlsx', name: 'New.xlsx' }] }; } },
    'expo-intent-launcher': { async startActivityAsync(action, params) { operations.push({ intent: { action, params } }); if (options.openFails) throw new Error('No Excel app installed'); } },
    'expo-sharing': { async isAvailableAsync() { return !options.sharingUnavailable; }, async shareAsync(uri, params) { operations.push({ share: { uri, params } }); if (options.shareFails) throw new Error('Share failed'); } },
    'react-native': native,
  };
  return { options, values, files, operations, oldRecord, bytes, mocks, native, load: loader(mocks) };
}

function screen(f) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(effect); } },
  };
  const jsx = (type, props) => ({ type, props });
  const load = loader({ ...f.mocks, react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/components/app-shell': Object.fromEntries(['ActionCard', 'AppShell', 'PrimaryButton', 'SecondaryButton', 'WorkflowStep'].map(name => [name, name])),
    '@/components/sweet-alert': { SweetAlert: 'SweetAlert' },
  });
  const Home = load('app/(tabs)/index.tsx').default;
  function render() { cursor = 0; return Home(); }
  function visit(predicate, node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const child of node) { const found = visit(predicate, child); if (found) return found; } return null; }
    if (predicate(node)) return node;
    return visit(predicate, node.props?.children);
  }
  function find(predicate) { return visit(predicate, render()); }
  render();
  effects.forEach(effect => effect());
  return {
    render, find, state: () => slots[0], alert: () => find(node => node.type === 'SweetAlert').props.alert,
    button: title => find(node => node.props?.title === title && /Button$/.test(node.type)),
    edit: message => find(node => node.type === 'TextInput').props.onChangeText(message),
    async settle() { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); },
  };
}
module.exports = { loader, fixture, screen, excelBytes, RECORD, OLD };
