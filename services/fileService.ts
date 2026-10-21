import { AppError } from '@/localization/errors';
import { createLocalizer } from '@/localization';
import { SelectedExcelFile } from '@/types/sales';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { downloadValidatedWorkbook, uniqueWorkbookName, validateWorkbookFile } from './workbookStorage';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function ensureLocalUri(uri: string): Promise<string> {
  if (!/^https?:\/\//i.test(uri)) {
    await validateWorkbookFile(uri);
    return uri;
  }
  if (!FileSystem.cacheDirectory) throw new AppError('errors.cachingUnavailable');
  const target = FileSystem.cacheDirectory + uniqueWorkbookName();
  try {
    await downloadValidatedWorkbook(uri, target);
    return target;
  } catch (error) {
    // Only remove the failed temporary download, never a saved workbook.
    try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch { /* best effort */ }
    throw error;
  }
}

export async function pickExcelFile(): Promise<SelectedExcelFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: [XLSX_MIME], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new AppError('errors.pickerMissingFile');
  return { uri: asset.uri, name: asset.name ?? 'Workbook.xlsx', mimeType: asset.mimeType ?? XLSX_MIME, size: asset.size };
}

export async function saveBase64ToUri(base64: string, uri: string): Promise<void> {
  new ExpoFile(uri).write(base64, { encoding: 'base64' });
}

export async function shareWorkbook(uri: string, fileName: string, dialogTitle = createLocalizer('en').t('alerts.shareTitle', { name: fileName })): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new AppError('errors.sharingUnavailable');
  const localUri = await ensureLocalUri(uri);
  await Sharing.shareAsync(localUri, { mimeType: XLSX_MIME, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle });
}

export async function openWorkbook(uri: string, shareTitle?: string): Promise<void> {
  if (Platform.OS === 'ios') {
    // iOS uses its document share sheet, including compatible Excel apps.
    await shareWorkbook(uri, 'Workbook.xlsx', shareTitle);
    return;
  }
  if (Platform.OS !== 'android') throw new AppError('errors.openNativeOnly');
  let target = await ensureLocalUri(uri);
  if (target.startsWith('file://')) target = await FileSystem.getContentUriAsync(target);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: target, flags: 1, type: XLSX_MIME });
}

export async function downloadWorkbook(uri: string, fileName: string, shareTitle?: string): Promise<'saved' | 'canceled' | 'shared'> {
  if (Platform.OS === 'ios') {
    // The share sheet offers Save to Files; its completion does not prove a save.
    await shareWorkbook(uri, fileName, shareTitle);
    return 'shared';
  }
  if (Platform.OS !== 'android') throw new AppError('errors.exportNativeOnly');
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return 'canceled';
  const localUri = await ensureLocalUri(uri);
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const destination = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, fileName, XLSX_MIME);
  await FileSystem.writeAsStringAsync(destination, base64, { encoding: FileSystem.EncodingType.Base64 });
  return 'saved';
}
