import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { ActionCard, AppShell, PrimaryButton, SecondaryButton, WorkflowStep } from '@/components/app-shell';
import { SweetAlert, SweetAlertOptions } from '@/components/sweet-alert';
import { APP_TITLE, SERVER_URL } from '@/constants/app';
import { AppThemeColors } from '@/constants/app-theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/hooks/use-localization';
import { formatBusinessDate, message as msg, type Message } from '@/localization';
import { AppError, errorMessage } from '@/localization/errors';
import { updateExcelWorkbook } from '@/services/excelService';
import { downloadWorkbook, openWorkbook, pickExcelFile, shareWorkbook } from '@/services/fileService';
import { parseSalesMessage } from '@/services/parserService';
import { canUpdateSales, changeSalesMessage, chooseReplacement, createOperationLock } from '@/services/salesWorkflow';
import { getPersistedWorkbook, replacePersistedWorkbook, savePersistedWorkbook, validateWorkbookFile } from '@/services/workbookStorage';
import { AppState } from '@/types/sales';

const initialState: AppState = {
  selectedFile: null, pastedMessage: '', parsedMessage: null,
  statusMessage: msg('status.selectWorkbook'), statusStep: null,
  errorMessage: null, successMessage: null, isLoading: false, updateResult: null,
};

export default function HomeScreen() {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const lock = useRef(createOperationLock());
  const [alert, setAlert] = useState<SweetAlertOptions | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [pendingReminder, setPendingReminder] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const { colors } = useAppTheme();
  const { t, resolve, textStyle } = useLocalization();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const disabled = state.isLoading || storageLoading;

  function change(patch: Partial<AppState>) {
    current.current = { ...current.current, ...patch };
    setState(current.current);
  }
  function reportError(title: Message, error: unknown) {
    const message = errorMessage(error);
    change({ errorMessage: message, successMessage: null, statusMessage: title });
    setAlert({ kind: 'error', title, message });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (Platform.OS === 'web') return;
        const saved = await getPersistedWorkbook();
        if (!saved) return;
        await validateWorkbookFile(saved.uri);
        if (!active) return;
        current.current = { ...current.current, selectedFile: saved, statusMessage: msg('status.savedReady') };
        setState(current.current);
        setUpdatedAt(saved.updatedTimestamp);
        const now = new Date();
        const confirmed = saved.confirmedTimestamp ? new Date(saved.confirmedTimestamp) : now;
        setPendingReminder(now.getMonth() !== confirmed.getMonth() || now.getFullYear() !== confirmed.getFullYear() || now.getTime() - confirmed.getTime() >= 25 * 86400000);
      } catch (error) {
        if (active) setAlert({ kind: 'warning', title: msg('alerts.workbookUnavailable'), message: msg('alerts.workbookKept', { reason: errorMessage(error) }) });
      } finally {
        if (active) setStorageLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function runAction(title: Message, action: () => Promise<void>) {
    if (storageLoading || !lock.current.acquire()) return;
    change({ isLoading: true, errorMessage: null });
    try { await action(); }
    catch (error) { reportError(title, error); }
    finally { change({ isLoading: false, statusStep: null }); lock.current.release(); }
  }

  async function selectWorkbook() {
    await runAction(msg('alerts.selectionFailed'), async () => {
      const saved = await chooseReplacement(pickExcelFile, file => replacePersistedWorkbook({ ...file, confirmedTimestamp: Date.now(), updatedTimestamp: null }));
      if (!saved) return;
      change({ selectedFile: saved, updateResult: null, successMessage: null, statusMessage: msg('status.selected', { name: saved.name }) });
      setUpdatedAt(saved.updatedTimestamp);
      setPendingReminder(false);
    });
  }
  function requestWorkbookChange() {
    if (current.current.isLoading || storageLoading) return;
    setAlert({ kind: 'confirmation', title: msg('alerts.changeTitle'), message: msg('alerts.changeBody'), confirmLabel: msg('alerts.chooseWorkbook'), cancelLabel: msg('common.cancel'), onConfirm: () => { void selectWorkbook(); } });
  }
  function editMessage(message: string) {
    if (current.current.isLoading) return;
    current.current = changeSalesMessage(current.current, message);
    setState(current.current);
  }
  function parseMessage() {
    if (current.current.isLoading || storageLoading) return;
    try {
      change({ parsedMessage: parseSalesMessage(current.current.pastedMessage), errorMessage: null, successMessage: null, statusMessage: msg('status.parsed') });
    } catch (error) { change({ parsedMessage: null }); reportError(msg('alerts.parseFailed'), error); }
  }
  async function updateExcel() {
    if (!canUpdateSales(current.current)) return;
    const parsed = current.current.parsedMessage!;
    await runAction(msg('alerts.updateFailed'), async () => {
      const saved = await getPersistedWorkbook();
      if (!saved) throw new AppError('errors.noSavedWorkbook');
      const result = await updateExcelWorkbook({ uri: saved.uri, fileName: saved.name, parsed, onStatus: statusStep => change({ statusStep }) });
      change({ statusStep: msg('status.saving') });
      const replacement = await replacePersistedWorkbook({ uri: result.outputUri, name: result.fileName, updatedTimestamp: Date.now() });
      change({ selectedFile: replacement, updateResult: { ...result, outputUri: replacement.uri }, statusMessage: msg('status.saved'), successMessage: msg('status.success') });
      setUpdatedAt(replacement.updatedTimestamp);
      setAlert({ kind: 'success', title: msg('alerts.updatedTitle'), message: msg('alerts.updatedBody'), confirmLabel: msg('common.ok') });
    });
  }
  async function fileAction(action: 'open' | 'share' | 'export') {
    const file = current.current.selectedFile;
    if (!file) return;
    const failureKeys = { open: 'alerts.openFailed', share: 'alerts.shareFailed', export: 'alerts.exportFailed' } as const;
    const shareTitle = t('alerts.shareTitle', { name: file.name });
    await runAction(msg(failureKeys[action]), async () => {
      if (action === 'open') await openWorkbook(file.uri, shareTitle);
      if (action === 'share') await shareWorkbook(file.uri, file.name, shareTitle);
      if (action === 'export') {
        const outcome = await downloadWorkbook(file.uri, file.name, shareTitle);
        if (outcome === 'saved') setAlert({ kind: 'success', title: msg('alerts.exportedTitle'), message: msg('alerts.exportedBody', { name: file.name }) });
      }
    });
  }
  async function continueWorkbook() {
    await runAction(msg('alerts.confirmFailed'), async () => {
      const saved = await getPersistedWorkbook();
      if (!saved) throw new AppError('errors.selectWorkbookFirst');
      await savePersistedWorkbook({ ...saved, confirmedTimestamp: Date.now() });
      setPendingReminder(false);
    });
  }
  async function testServer() {
    await runAction(msg('alerts.connectionFailed'), async () => {
      const response = await fetch(`${SERVER_URL}/`);
      if (!response.ok) throw new AppError('errors.serverStatus', { status: response.status });
      await response.text();
      setAlert({ kind: 'success', title: msg('alerts.connectedTitle'), message: msg('alerts.connectedBody') });
    });
  }

  return <>
    <AppShell title={APP_TITLE} subtitle={t('sales.subtitle')}>
      {Platform.OS === 'web' && <Text style={styles.notice}>{t('sales.nativeOnly')}</Text>}
      <View style={[styles.workflow, wide && styles.workflowWide]}>
        <View style={styles.main}>
          <ActionCard>
            <WorkflowStep number={1} title={t('sales.chooseTitle')} description={t('sales.chooseDescription')} />
            <Text business={!storageLoading && !!state.selectedFile} style={styles.fileName}>{storageLoading ? t('sales.loadingWorkbook') : state.selectedFile?.name ?? t('sales.noWorkbook')}</Text>
            <Text style={styles.muted}>{t('sales.lastUpdated', { date: updatedAt ? formatBusinessDate(updatedAt) : msg('sales.neverUpdated') })}</Text>
            {pendingReminder && <View style={styles.reminder}>
              <Text style={styles.notice}>{t('sales.monthlyReminder')}</Text>
              <SecondaryButton title={t('sales.continueWorkbook')} disabled={disabled} onPress={() => { void continueWorkbook(); }} />
            </View>}
            {state.selectedFile ? <>
              <View style={styles.fileActions}>
                <View style={styles.action}><SecondaryButton title={t('sales.open')} disabled={disabled} onPress={() => { void fileAction('open'); }} /></View>
                <View style={styles.action}><SecondaryButton title={t('sales.share')} disabled={disabled} onPress={() => { void fileAction('share'); }} /></View>
                <View style={styles.action}><SecondaryButton title={t('sales.export')} disabled={disabled} onPress={() => { void fileAction('export'); }} /></View>
              </View>
              <SecondaryButton title={t('sales.changeWorkbook')} disabled={disabled} onPress={requestWorkbookChange} />
            </> : <PrimaryButton title={t('sales.selectFile')} disabled={disabled || Platform.OS === 'web'} onPress={() => { void selectWorkbook(); }} />}
          </ActionCard>
          <ActionCard>
            <WorkflowStep number={2} title={t('sales.pasteTitle')} description={t('sales.pasteDescription')} />
            <TextInput accessibilityLabel={t('sales.messageLabel')} style={[styles.textArea, state.pastedMessage ? { writingDirection: 'auto', textAlign: 'auto' } : textStyle]} multiline value={state.pastedMessage} onChangeText={editMessage} placeholder={t('sales.messagePlaceholder')} placeholderTextColor={colors.textMuted} textAlignVertical="top" editable={!disabled} />
            <View style={styles.fileActions}>
              <View style={styles.action}><PrimaryButton title={t('sales.parse')} disabled={disabled || !state.pastedMessage.trim()} onPress={parseMessage} /></View>
              <View style={styles.action}><SecondaryButton title={t('sales.clear')} disabled={disabled || !state.pastedMessage} onPress={() => editMessage('')} /></View>
            </View>
          </ActionCard>
        </View>
        <View style={[styles.review, wide && styles.reviewWide]}>
          <ActionCard>
            <WorkflowStep number={3} title={t('sales.reviewTitle')} description={t('sales.reviewDescription')} />
            {([
              [t('sales.date'), state.parsedMessage?.date ?? '—'], [t('sales.dsf'), state.parsedMessage?.dsf ?? '—'], [t('sales.todayValue'), state.parsedMessage ? String(state.parsedMessage.todayValue) : '—'],
            ]).map(([label, value]) => <View key={label} style={styles.valueRow}><Text style={styles.muted}>{label}</Text><Text business style={styles.value}>{value}</Text></View>)}
            {!state.parsedMessage && <Text style={styles.muted}>{t('sales.reparse')}</Text>}
            <PrimaryButton title={t(state.isLoading ? 'common.pleaseWait' : 'sales.update')} disabled={disabled || !canUpdateSales(state) || Platform.OS === 'web'} onPress={() => { void updateExcel(); }} />
            <Text accessibilityLiveRegion="polite" style={styles.status}>{resolve(state.statusStep ?? state.statusMessage)}</Text>
            {state.errorMessage && <Text style={styles.error}>{resolve(state.errorMessage)}</Text>}
            {state.successMessage && <Text style={styles.success}>{resolve(state.successMessage)}</Text>}
            <SecondaryButton title={t('sales.testConnection')} disabled={disabled} onPress={() => { void testServer(); }} />
          </ActionCard>
        </View>
      </View>
    </AppShell>
    <SweetAlert alert={alert} onClose={() => setAlert(null)} />
  </>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  workflow: { gap: 20 }, workflowWide: { flexDirection: 'row', alignItems: 'flex-start' }, main: { flex: 1, minWidth: 0 }, review: { minWidth: 0 }, reviewWide: { width: 340 },
  fileName: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 12 },
  notice: { color: colors.warningText, lineHeight: 22, marginBottom: 14 }, reminder: { backgroundColor: colors.warningBackground, padding: 12, borderRadius: 12 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, action: { flexGrow: 1, flexBasis: 100 },
  textArea: { minHeight: 200, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.text, backgroundColor: colors.input, fontSize: 16, lineHeight: 24 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 6 }, value: { fontSize: 16, color: colors.text, fontWeight: '700', flexShrink: 1 },
  status: { color: colors.textMuted, lineHeight: 22, marginVertical: 12 }, error: { color: colors.error, marginBottom: 12 }, success: { color: colors.success, marginBottom: 12 },
});
