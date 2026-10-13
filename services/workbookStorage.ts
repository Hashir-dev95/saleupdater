import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

const RECORD_KEY = '@SalesUpdater:workbook';
const LEGACY_KEYS = ['@SalesUpdater:workbook_uri', '@SalesUpdater:workbook_name', '@SalesUpdater:workbook_confirmed_ts', '@SalesUpdater:workbook_updated_ts'];
export interface SavedWorkbook {
  uri: string;
  name: string;
  confirmedTimestamp: number | null;
  updatedTimestamp: number | null;
}
let sequence = 0;
export function uniqueWorkbookName(): string {
  return `workbook_${Date.now()}_${++sequence}.xlsx`;
}

export function validateExcelContents(base64: string): void {
  const bytes = Buffer.from(base64, 'base64');
  // SheetJS also accepts HTML/CSV/plain text. Require an actual XLSX container.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) {
    throw new Error('The file is not a valid Excel (.xlsx) workbook.');
  }
  try {
    const workbook = XLSX.read(base64, { type: 'base64', bookFiles: true });
    const keys = (workbook as XLSX.WorkBook & { keys?: string[] }).keys;
    if (!keys?.includes('xl/workbook.xml') || !workbook.SheetNames.length ||
      workbook.SheetNames.some(name => !workbook.Sheets[name])) throw new Error('Missing workbook sheets');
  } catch {
    throw new Error('The file is not a valid Excel (.xlsx) workbook.');
  }
}

export async function validateWorkbookFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || info.size === 0) throw new Error('Workbook file is missing or empty.');
  validateExcelContents(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
}

export async function downloadValidatedWorkbook(source: string, target: string): Promise<void> {
  const result = await FileSystem.downloadAsync(source, target);
  if (!Number.isInteger(result.status) || result.status < 200 || result.status >= 300) throw new Error(`Workbook download failed (HTTP ${result.status}).`);
  await validateWorkbookFile(target);
}

function timestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export async function getPersistedWorkbook(): Promise<SavedWorkbook | null> {
  const record = await AsyncStorage.getItem(RECORD_KEY);
  if (record !== null) {
    const saved = JSON.parse(record);
    if (!saved || typeof saved.uri !== 'string' || !saved.uri || typeof saved.name !== 'string' || !saved.name) {
      throw new Error('Saved workbook metadata is invalid. Please select a workbook.');
    }
    return { uri: saved.uri, name: saved.name, confirmedTimestamp: timestamp(saved.confirmedTimestamp), updatedTimestamp: timestamp(saved.updatedTimestamp) };
  }
  const values = await AsyncStorage.multiGet(LEGACY_KEYS);
  const [uri, name, confirmed, updated] = values.map(([, value]) => value);
  return uri && name ? { uri, name, confirmedTimestamp: timestamp(confirmed), updatedTimestamp: timestamp(updated) } : null;
}

export async function savePersistedWorkbook(saved: SavedWorkbook): Promise<void> {
  // One write avoids partially updated URI/name/timestamp combinations.
  await AsyncStorage.setItem(RECORD_KEY, JSON.stringify(saved));
}

async function removeManagedCopy(uri: string): Promise<void> {
  const directory = FileSystem.documentDirectory;
  if (!directory || !uri.startsWith(directory)) return;
  const name = uri.slice(directory.length);
  if (!/^workbook_\d+(?:_\d+)?\.xlsx$/.test(name)) return;
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); }
  catch (error) { console.warn('Could not clean up a managed workbook copy', error); }
}

export async function replacePersistedWorkbook(params: {
  uri: string; name: string; confirmedTimestamp?: number | null; updatedTimestamp?: number | null;
}): Promise<SavedWorkbook> {
  if (!FileSystem.documentDirectory) throw new Error('Workbook storage is unavailable on this platform.');
  const previous = await getPersistedWorkbook();
  const target = FileSystem.documentDirectory + uniqueWorkbookName();
  // Never overwrite an existing copy, including after a clock reset or restart.
  if ((await FileSystem.getInfoAsync(target)).exists) throw new Error('Could not allocate a new workbook file. Please retry.');
  try {
    if (/^https?:\/\//i.test(params.uri)) await downloadValidatedWorkbook(params.uri, target);
    else {
      await FileSystem.copyAsync({ from: params.uri, to: target });
      await validateWorkbookFile(target);
    }
    const saved: SavedWorkbook = {
      uri: target, name: params.name,
      confirmedTimestamp: params.confirmedTimestamp === undefined ? previous?.confirmedTimestamp ?? Date.now() : params.confirmedTimestamp,
      updatedTimestamp: params.updatedTimestamp === undefined ? previous?.updatedTimestamp ?? null : params.updatedTimestamp,
    };
    await savePersistedWorkbook(saved);
    if (previous) await removeManagedCopy(previous.uri);
    return saved;
  } catch (error) {
    await removeManagedCopy(target);
    throw error;
  }
}
