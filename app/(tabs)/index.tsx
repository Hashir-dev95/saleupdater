import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ActionCard, AppShell, PrimaryButton, SecondaryButton, WorkflowStep } from '@/components/app-shell';
import { SweetAlert, SweetAlertOptions } from '@/components/sweet-alert';
import { APP_SUBTITLE, APP_TITLE, SERVER_URL } from '@/constants/app';
import { updateExcelWorkbook } from '@/services/excelService';
import { downloadWorkbook, openWorkbook, pickExcelFile, shareWorkbook } from '@/services/fileService';
import { parseSalesMessage } from '@/services/parserService';
import { canUpdateSales, changeSalesMessage, chooseReplacement, createOperationLock } from '@/services/salesWorkflow';
import { getPersistedWorkbook, replacePersistedWorkbook, savePersistedWorkbook, validateWorkbookFile } from '@/services/workbookStorage';
import { AppState } from '@/types/sales';

const initialState: AppState = {
  selectedFile: null, pastedMessage: '', parsedMessage: null,
  statusMessage: 'Select a workbook to begin.', statusStep: null,
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
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const disabled = state.isLoading || storageLoading;

  function change(patch: Partial<AppState>) {
    current.current = { ...current.current, ...patch };
    setState(current.current);
  }
  function reportError(title: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
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
        current.current = { ...current.current, selectedFile: saved, statusMessage: 'Saved workbook ready.' };
        setState(current.current);
        setUpdatedAt(saved.updatedTimestamp);
        const now = new Date();
        const confirmed = saved.confirmedTimestamp ? new Date(saved.confirmedTimestamp) : now;
        setPendingReminder(now.getMonth() !== confirmed.getMonth() || now.getFullYear() !== confirmed.getFullYear() || now.getTime() - confirmed.getTime() >= 25 * 86400000);
      } catch (error) {
        if (active) setAlert({ kind: 'warning', title: 'Workbook unavailable', message: `${error instanceof Error ? error.message : String(error)} Your saved workbook has been kept. You can retry or select a replacement.` });
      } finally {
        if (active) setStorageLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function runAction(title: string, action: () => Promise<void>) {
    if (storageLoading || !lock.current.acquire()) return;
    change({ isLoading: true, errorMessage: null });
    try { await action(); }
    catch (error) { reportError(title, error); }
    finally { change({ isLoading: false, statusStep: null }); lock.current.release(); }
  }

  async function selectWorkbook() {
    await runAction('Workbook selection failed', async () => {
      const saved = await chooseReplacement(pickExcelFile, file => replacePersistedWorkbook({ ...file, confirmedTimestamp: Date.now(), updatedTimestamp: null }));
      if (!saved) return;
      change({ selectedFile: saved, updateResult: null, successMessage: null, statusMessage: `Selected ${saved.name}` });
      setUpdatedAt(saved.updatedTimestamp);
      setPendingReminder(false);
    });
  }
  function requestWorkbookChange() {
    if (current.current.isLoading || storageLoading) return;
    setAlert({ kind: 'confirmation', title: 'Change workbook?', message: 'Choose a new Excel workbook. Your current workbook stays saved until the replacement is ready.', confirmLabel: 'Choose workbook', cancelLabel: 'Cancel', onConfirm: () => { void selectWorkbook(); } });
  }
  function editMessage(message: string) {
    if (current.current.isLoading) return;
    current.current = changeSalesMessage(current.current, message);
    setState(current.current);
  }
  function parseMessage() {
    if (current.current.isLoading || storageLoading) return;
    try {
      change({ parsedMessage: parseSalesMessage(current.current.pastedMessage), errorMessage: null, successMessage: null, statusMessage: 'Message parsed. Review the values before updating.' });
    } catch (error) { change({ parsedMessage: null }); reportError('Could not parse message', error); }
  }
  async function updateExcel() {
    if (!canUpdateSales(current.current)) return;
    const parsed = current.current.parsedMessage!;
    await runAction('Update failed', async () => {
      const saved = await getPersistedWorkbook();
      if (!saved) throw new Error('No saved workbook. Please select a workbook.');
      const result = await updateExcelWorkbook({ uri: saved.uri, fileName: saved.name, parsed, onStatus: statusStep => change({ statusStep }) });
      change({ statusStep: 'Saving validated workbook…' });
      const replacement = await replacePersistedWorkbook({ uri: result.outputUri, name: result.fileName, updatedTimestamp: Date.now() });
      change({ selectedFile: replacement, updateResult: { ...result, outputUri: replacement.uri }, statusMessage: 'Workbook updated and saved.', successMessage: 'Excel updated successfully.' });
      setUpdatedAt(replacement.updatedTimestamp);
      setAlert({ kind: 'success', title: 'Excel updated!', message: 'Your updated workbook is saved and ready to use.', confirmLabel: 'Open workbook', cancelLabel: 'Done', onConfirm: () => { void runAction('Could not open workbook', () => openWorkbook(replacement.uri)); } });
    });
  }
  async function fileAction(action: 'open' | 'share' | 'export') {
    const file = current.current.selectedFile;
    if (!file) return;
    await runAction(`Could not ${action} workbook`, async () => {
      if (action === 'open') await openWorkbook(file.uri);
      if (action === 'share') await shareWorkbook(file.uri, file.name);
      if (action === 'export') {
        const outcome = await downloadWorkbook(file.uri, file.name);
        if (outcome === 'saved') setAlert({ kind: 'success', title: 'Workbook exported', message: `${file.name} was saved to your selected folder.` });
      }
    });
  }
  async function continueWorkbook() {
    await runAction('Could not confirm workbook', async () => {
      const saved = await getPersistedWorkbook();
      if (!saved) throw new Error('Please select a workbook first.');
      await savePersistedWorkbook({ ...saved, confirmedTimestamp: Date.now() });
      setPendingReminder(false);
    });
  }
  async function testServer() {
    await runAction('Connection failed', async () => {
      const response = await fetch(`${SERVER_URL}/`);
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
      setAlert({ kind: 'success', title: 'Server connected', message: await response.text() });
    });
  }

  return <>
    <AppShell title={APP_TITLE} subtitle={APP_SUBTITLE}>
      {Platform.OS === 'web' && <Text style={styles.notice}>Use the Android or iOS app to select, update, and export workbooks.</Text>}
      <View style={[styles.workflow, wide && styles.workflowWide]}>
        <View style={styles.main}>
          <ActionCard>
            <WorkflowStep number={1} title="Choose your workbook" description="Keep one saved workbook ready for daily sales." />
            <Text style={styles.fileName}>{storageLoading ? 'Loading saved workbook…' : state.selectedFile?.name ?? 'No workbook selected'}</Text>
            <Text style={styles.muted}>Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : 'Never updated'}</Text>
            {pendingReminder && <View style={styles.reminder}>
              <Text style={styles.notice}>A new monthly workbook may be available.</Text>
              <SecondaryButton title="Continue current workbook" disabled={disabled} onPress={() => { void continueWorkbook(); }} />
            </View>}
            {state.selectedFile ? <>
              <View style={styles.fileActions}>
                <View style={styles.action}><SecondaryButton title="Open" disabled={disabled} onPress={() => { void fileAction('open'); }} /></View>
                <View style={styles.action}><SecondaryButton title="Share" disabled={disabled} onPress={() => { void fileAction('share'); }} /></View>
                <View style={styles.action}><SecondaryButton title="Export" disabled={disabled} onPress={() => { void fileAction('export'); }} /></View>
              </View>
              <SecondaryButton title="Change workbook" disabled={disabled} onPress={requestWorkbookChange} />
            </> : <PrimaryButton title="Select Excel file" disabled={disabled || Platform.OS === 'web'} onPress={() => { void selectWorkbook(); }} />}
          </ActionCard>
          <ActionCard>
            <WorkflowStep number={2} title="Paste and parse sales" description="Paste your WhatsApp message, then review the extracted values." />
            <TextInput accessibilityLabel="Sales message" style={styles.textArea} multiline value={state.pastedMessage} onChangeText={editMessage} placeholder="Paste WhatsApp sales message here" placeholderTextColor="#64748b" textAlignVertical="top" editable={!disabled} />
            <View style={styles.fileActions}>
              <View style={styles.action}><PrimaryButton title="Parse message" disabled={disabled || !state.pastedMessage.trim()} onPress={parseMessage} /></View>
              <View style={styles.action}><SecondaryButton title="Clear message" disabled={disabled || !state.pastedMessage} onPress={() => editMessage('')} /></View>
            </View>
          </ActionCard>
        </View>
        <View style={[styles.review, wide && styles.reviewWide]}>
          <ActionCard>
            <WorkflowStep number={3} title="Review and update" description="Update Excel when the workbook and parsed sales are ready." />
            {([
              ['Date', state.parsedMessage?.date ?? '—'], ['DSF', state.parsedMessage?.dsf ?? '—'], ["Today's value", state.parsedMessage ? String(state.parsedMessage.todayValue) : '—'],
            ]).map(([label, value]) => <View key={label} style={styles.valueRow}><Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}
            {!state.parsedMessage && <Text style={styles.muted}>Parse the message after every edit or clear.</Text>}
            <PrimaryButton title={state.isLoading ? 'Please wait…' : 'Update Excel'} disabled={disabled || !canUpdateSales(state) || Platform.OS === 'web'} onPress={() => { void updateExcel(); }} />
            <Text accessibilityLiveRegion="polite" style={styles.status}>{state.statusStep ?? state.statusMessage}</Text>
            {state.errorMessage && <Text style={styles.error}>{state.errorMessage}</Text>}
            {state.successMessage && <Text style={styles.success}>{state.successMessage}</Text>}
            <SecondaryButton title="Test server connection" disabled={disabled} onPress={() => { void testServer(); }} />
          </ActionCard>
        </View>
      </View>
    </AppShell>
    <SweetAlert alert={alert} onClose={() => setAlert(null)} />
  </>;
}

const styles = StyleSheet.create({
  workflow: { gap: 20 }, workflowWide: { flexDirection: 'row', alignItems: 'flex-start' }, main: { flex: 1, minWidth: 0 }, review: { minWidth: 0 }, reviewWide: { width: 340 },
  fileName: { fontSize: 19, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  muted: { fontSize: 14, color: '#64748b', lineHeight: 22, marginBottom: 12 },
  notice: { color: '#854d0e', lineHeight: 22, marginBottom: 14 }, reminder: { backgroundColor: '#fffbeb', padding: 12, borderRadius: 12 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, action: { flexGrow: 1, flexBasis: 100 },
  textArea: { minHeight: 200, padding: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, color: '#0f172a', backgroundColor: '#f8fafc', fontSize: 16, lineHeight: 24 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 6 }, value: { fontSize: 16, color: '#0f172a', fontWeight: '700', flexShrink: 1 },
  status: { color: '#475569', lineHeight: 22, marginVertical: 12 }, error: { color: '#b91c1c', marginBottom: 12 }, success: { color: '#047857', marginBottom: 12 },
});
